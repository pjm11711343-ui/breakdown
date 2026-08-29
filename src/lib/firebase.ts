import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  disableNetwork,
  setLogLevel
} from 'firebase/firestore';
import LZString from 'lz-string';
import { Project, SpecItem, CustomClassificationRule, ThemeType, AppConfig } from '../types';
import config from '../../firebase-applet-config.json';

// Silence verbose internal Firestore backoff logging
try {
  setLogLevel('silent');
} catch (e) {}

const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Circuit breaker state for quota management
const STORAGE_QUOTA_KEY = 'firestore_quota_exceeded_timestamp';

let isQuotaExceeded = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_QUOTA_KEY) || sessionStorage.getItem(STORAGE_QUOTA_KEY);
    if (stored) {
      const ts = Number(stored);
      // Daily quota resets in 24 hours (86400000 ms)
      if (Date.now() - ts < 86400000) {
        // Automatically disable network on startup if already known to be exceeded
        try {
          disableNetwork(db).catch(() => {});
        } catch (e) {}
        return true;
      }
    }
  } catch (e) {}
  return false;
})();

let quotaListeners: ((exceeded: boolean) => void)[] = [];

export function isCloudQuotaExceeded(): boolean {
  return isQuotaExceeded;
}

export function onQuotaStateChange(listener: (exceeded: boolean) => void): () => void {
  quotaListeners.push(listener);
  listener(isQuotaExceeded);
  return () => {
    quotaListeners = quotaListeners.filter(l => l !== listener);
  };
}

function notifyQuotaState(exceeded: boolean) {
  isQuotaExceeded = exceeded;
  try {
    if (exceeded) {
      localStorage.setItem(STORAGE_QUOTA_KEY, Date.now().toString());
      sessionStorage.setItem(STORAGE_QUOTA_KEY, Date.now().toString());
      // Immediately disable network to stop background backoff/retry noise
      disableNetwork(db).catch(() => {});
    } else {
      localStorage.removeItem(STORAGE_QUOTA_KEY);
      sessionStorage.removeItem(STORAGE_QUOTA_KEY);
    }
  } catch (e) {}
  quotaListeners.forEach(l => l(exceeded));
}

function checkQuotaState(): boolean {
  if (isQuotaExceeded) {
    return false; // Skip Firestore calls when quota is exceeded
  }
  return true;
}

function handleFirestoreError(err: any, context: string): void {
  const errMsg = err?.message || String(err);
  const errCode = err?.code || '';
  if (
    errCode === 'resource-exhausted' ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded')
  ) {
    if (!isQuotaExceeded) {
      console.warn(`[Firestore] Quota reached (${context}). Gracefully switching to local storage cache.`);
    }
    notifyQuotaState(true);
  } else {
    console.warn(`[Firestore] ${context} error:`, err);
  }
}

// Helper to serialize SpecItems safely for Firestore
function serializeItems(items: SpecItem[]): { items?: any[]; itemsCompressed?: string } {
  if (!items || items.length === 0) {
    return { items: [] };
  }

  // Sanitize undefined values
  const cleanItems = items.map(item => ({
    id: item.id || '',
    name: item.name || '',
    specification: item.specification || '',
    unit: item.unit || '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    materialUnitPrice: typeof item.materialUnitPrice === 'number' ? item.materialUnitPrice : 0,
    materialAmount: typeof item.materialAmount === 'number' ? item.materialAmount : 0,
    laborUnitPrice: typeof item.laborUnitPrice === 'number' ? item.laborUnitPrice : 0,
    laborAmount: typeof item.laborAmount === 'number' ? item.laborAmount : 0,
    unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
    amount: typeof item.amount === 'number' ? item.amount : 0,
    category: item.category || '미분류',
    section: item.section || '기타 공정',
    remark: item.remark || '',
    originalCategory: item.originalCategory || item.category || '미분류',
    excelRowIdx: typeof item.excelRowIdx === 'number' ? item.excelRowIdx : null,
    memo: item.memo || '',
    executionAmount: typeof item.executionAmount === 'number' ? item.executionAmount : 0
  }));

  const jsonStr = JSON.stringify(cleanItems);
  // If data is relatively large (> 400KB), store compressed
  if (jsonStr.length > 300000) {
    const compressed = LZString.compressToUTF16(jsonStr);
    return { itemsCompressed: compressed };
  }

  return { items: cleanItems };
}

// Helper to deserialize SpecItems
function deserializeItems(data: any): SpecItem[] {
  if (data.itemsCompressed) {
    try {
      const decompressed = LZString.decompressFromUTF16(data.itemsCompressed);
      if (decompressed) {
        return JSON.parse(decompressed);
      }
    } catch (e) {
      console.error('Failed to decompress items from Firestore', e);
    }
  }

  if (Array.isArray(data.items)) {
    return data.items.map((item: any) => ({
      id: item.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
      name: item.name || '',
      specification: item.specification || '',
      unit: item.unit || '',
      quantity: Number(item.quantity) || 0,
      materialUnitPrice: Number(item.materialUnitPrice) || 0,
      materialAmount: Number(item.materialAmount) || 0,
      laborUnitPrice: Number(item.laborUnitPrice) || 0,
      laborAmount: Number(item.laborAmount) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      amount: Number(item.amount) || 0,
      category: item.category || '미분류',
      section: item.section || '기타 공정',
      remark: item.remark || '',
      originalCategory: item.originalCategory || item.category,
      excelRowIdx: typeof item.excelRowIdx === 'number' ? item.excelRowIdx : undefined,
      memo: item.memo || '',
      executionAmount: Number(item.executionAmount) || 0
    }));
  }

  return [];
}

/**
 * 1. Save or update project in Firestore
 */
export async function saveProjectToFirestore(project: Project): Promise<void> {
  if (!checkQuotaState()) return;
  if (!project.id && !project.name) return;

  try {
    const docId = project.id || encodeURIComponent(project.name.trim());
    const projectRef = doc(db, 'projects', docId);

    const { items: serializedItems, itemsCompressed } = serializeItems(project.items || []);

    const dataToSave: any = {
      id: docId,
      name: project.name,
      theme: project.theme || 'industrial',
      config: project.config || {
        theme: project.theme || 'industrial',
        fontFamily: '"Gulim", "굴림", Dotum, "돋움", sans-serif',
        fontSize: 11
      },
      categories: project.categories || [],
      updatedAt: project.updatedAt || Date.now(),
      status: project.status || 'working',
      categoryEstimates: project.categoryEstimates || {},
      itemCount: project.items?.length || 0,
      serverSyncedAt: serverTimestamp()
    };

    if (itemsCompressed) {
      dataToSave.itemsCompressed = itemsCompressed;
      dataToSave.items = [];
    } else {
      dataToSave.items = serializedItems || [];
    }

    await setDoc(projectRef, dataToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveProject');
  }
}

/**
 * 2. Delete project from Firestore
 */
export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  if (!checkQuotaState()) return;
  if (!projectId) return;

  try {
    const projectRef = doc(db, 'projects', projectId);
    await deleteDoc(projectRef);
  } catch (err) {
    handleFirestoreError(err, 'deleteProject');
  }
}

/**
 * 3. Subscribe to real-time project list from Firestore
 */
export function subscribeProjectsFromFirestore(callback: (projects: Project[]) => void): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const projectsCol = collection(db, 'projects');
    const q = query(projectsCol);

    return onSnapshot(
      q,
      snapshot => {
        const projects: Project[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const items = deserializeItems(data);
          projects.push({
            id: docSnap.id,
            name: data.name || '무제 현장',
            items,
            theme: data.theme || 'industrial',
            config: data.config,
            categories: data.categories || [],
            categoryEstimates: data.categoryEstimates || {},
            commencementDate: data.commencementDate,
            completionDate: data.completionDate,
            buildingCount: data.buildingCount,
            householdCount: data.householdCount,
            highestFloor: data.highestFloor,
            lowestFloor: data.lowestFloor,
            updatedAt: data.updatedAt || Date.now(),
            status: data.status || 'working'
          });
        });

        // Sort by updatedAt descending
        projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(projects);
      },
      error => {
        handleFirestoreError(error, 'project subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup project subscription');
    return () => {};
  }
}

/**
 * 4. Save active global session to Firestore (so any new PC opening gets the exact latest state)
 */
export async function saveActiveSessionToFirestore(session: {
  projectName: string;
  items: SpecItem[];
  theme: ThemeType | null;
  fontFamily: string;
  fontSize: number;
  categories: string[];
  categoryEstimates?: Record<string, number>;
  isLocked?: boolean;
  commencementDate?: string;
  completionDate?: string;
  buildingCount?: string;
  householdCount?: string;
  highestFloor?: string;
  lowestFloor?: string;
}): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const sessionRef = doc(db, 'app_state', 'latest_active_session');
    const { items: serializedItems, itemsCompressed } = serializeItems(session.items || []);

    const dataToSave: any = {
      projectName: session.projectName || '',
      theme: session.theme || null,
      fontFamily: session.fontFamily || '"Gulim", "굴림", Dotum, "돋움", sans-serif',
      fontSize: session.fontSize || 11,
      categories: session.categories || [],
      categoryEstimates: session.categoryEstimates || {},
      commencementDate: session.commencementDate || '',
      completionDate: session.completionDate || '',
      buildingCount: session.buildingCount || '',
      householdCount: session.householdCount || '',
      highestFloor: session.highestFloor || '',
      lowestFloor: session.lowestFloor || '',
      isLocked: !!session.isLocked,
      itemCount: session.items?.length || 0,
      updatedAt: Date.now(),
      serverSyncedAt: serverTimestamp()
    };

    if (itemsCompressed) {
      dataToSave.itemsCompressed = itemsCompressed;
      dataToSave.items = [];
    } else {
      dataToSave.items = serializedItems || [];
    }

    await setDoc(sessionRef, dataToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveActiveSession');
  }
}

/**
 * 5. Fetch or subscribe active session from Firestore
 */
export function subscribeActiveSessionFromFirestore(
  callback: (session: {
    projectName: string;
    items: SpecItem[];
    theme: ThemeType | null;
    fontFamily: string;
    fontSize: number;
    categories: string[];
    categoryEstimates: Record<string, number>;
    isLocked: boolean;
    commencementDate?: string;
    completionDate?: string;
    buildingCount?: string;
    householdCount?: string;
    highestFloor?: string;
    lowestFloor?: string;
    updatedAt: number;
  } | null) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const sessionRef = doc(db, 'app_state', 'latest_active_session');

    return onSnapshot(
      sessionRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const items = deserializeItems(data);
          callback({
            projectName: data.projectName || '',
            items,
            theme: data.theme || null,
            fontFamily: data.fontFamily || '"Gulim", "굴림", Dotum, "돋움", sans-serif',
            fontSize: data.fontSize || 11,
            categories: data.categories || [],
            categoryEstimates: data.categoryEstimates || {},
            isLocked: !!data.isLocked,
            commencementDate: data.commencementDate,
            completionDate: data.completionDate,
            buildingCount: data.buildingCount,
            householdCount: data.householdCount,
            highestFloor: data.highestFloor,
            lowestFloor: data.lowestFloor,
            updatedAt: data.updatedAt || 0
          });
        } else {
          callback(null);
        }
      },
      error => {
        handleFirestoreError(error, 'active session subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup active session subscription');
    return () => {};
  }
}

/**
 * 6. Custom classification rules syncing across PCs
 */
export async function saveCustomRulesToFirestore(rules: CustomClassificationRule[]): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const rulesRef = doc(db, 'app_settings', 'custom_rules');
    await setDoc(rulesRef, {
      rules: rules || [],
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, 'saveCustomRules');
  }
}

export function subscribeCustomRulesFromFirestore(
  callback: (rules: CustomClassificationRule[]) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const rulesRef = doc(db, 'app_settings', 'custom_rules');
    return onSnapshot(
      rulesRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.rules)) {
            callback(data.rules);
          }
        }
      },
      error => {
        handleFirestoreError(error, 'rules subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup rules subscription');
    return () => {};
  }
}

/**
 * 7. Custom Categories syncing across sessions and devices
 */
export async function saveCategoriesToFirestore(categories: string[]): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const catRef = doc(db, 'app_settings', 'categories');
    await setDoc(catRef, {
      categories: categories || [],
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, 'saveCategories');
  }
}

export function subscribeCategoriesFromFirestore(
  callback: (categories: string[]) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const catRef = doc(db, 'app_settings', 'categories');
    return onSnapshot(
      catRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            callback(data.categories);
          }
        }
      },
      error => {
        handleFirestoreError(error, 'categories subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup categories subscription');
    return () => {};
  }
}

/**
 * 8. Global UI configuration (Font Size, Family, etc.)
 */
export async function saveGlobalUIConfigToFirestore(config: {
  fontFamily: string;
  fontSize: number;
}): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const uiRef = doc(db, 'app_settings', 'ui_config');
    await setDoc(uiRef, {
      ...config,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, 'saveGlobalUIConfig');
  }
}

export function subscribeGlobalUIConfigFromFirestore(
  callback: (config: { fontFamily: string; fontSize: number }) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const uiRef = doc(db, 'app_settings', 'ui_config');
    return onSnapshot(
      uiRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fontFamily && data.fontSize) {
            callback({
              fontFamily: data.fontFamily,
              fontSize: data.fontSize
            });
          }
        }
      },
      error => {
        handleFirestoreError(error, 'ui config subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup ui config subscription');
    return () => {};
  }
}
