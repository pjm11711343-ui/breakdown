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
  serverTimestamp
} from 'firebase/firestore';
import LZString from 'lz-string';
import { Project, SpecItem, CustomClassificationRule, ThemeType, AppConfig } from '../types';
import config from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

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
    memo: item.memo || ''
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
      memo: item.memo || ''
    }));
  }

  return [];
}

/**
 * 1. Save or update project in Firestore
 */
export async function saveProjectToFirestore(project: Project): Promise<void> {
  if (!project.id && !project.name) return;
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
}

/**
 * 2. Delete project from Firestore
 */
export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  if (!projectId) return;
  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);
}

/**
 * 3. Subscribe to real-time project list from Firestore
 */
export function subscribeProjectsFromFirestore(callback: (projects: Project[]) => void): () => void {
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
          updatedAt: data.updatedAt || Date.now(),
          status: data.status || 'working'
        });
      });

      // Sort by updatedAt descending
      projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      callback(projects);
    },
    error => {
      console.error('Firestore project subscription error:', error);
    }
  );
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
  isLocked?: boolean;
}): Promise<void> {
  const sessionRef = doc(db, 'app_state', 'latest_active_session');

  const { items: serializedItems, itemsCompressed } = serializeItems(session.items || []);

  const dataToSave: any = {
    projectName: session.projectName || '',
    theme: session.theme || null,
    fontFamily: session.fontFamily || '"Gulim", "굴림", Dotum, "돋움", sans-serif',
    fontSize: session.fontSize || 11,
    categories: session.categories || [],
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
    isLocked: boolean;
    updatedAt: number;
  } | null) => void
): () => void {
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
          isLocked: !!data.isLocked,
          updatedAt: data.updatedAt || 0
        });
      } else {
        callback(null);
      }
    },
    error => {
      console.error('Firestore active session subscription error:', error);
    }
  );
}

/**
 * 6. Custom classification rules syncing across PCs
 */
export async function saveCustomRulesToFirestore(rules: CustomClassificationRule[]): Promise<void> {
  const rulesRef = doc(db, 'app_settings', 'custom_rules');
  await setDoc(rulesRef, {
    rules: rules || [],
    updatedAt: Date.now()
  });
}

export function subscribeCustomRulesFromFirestore(
  callback: (rules: CustomClassificationRule[]) => void
): () => void {
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
      console.error('Firestore rules subscription error:', error);
    }
  );
}
