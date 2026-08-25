/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SpecItem, ThemeType, Project, CustomClassificationRule } from './types';
import { autoClassify } from './utils/classifier';
import { exportStyledExcel } from './utils/excelExport';
import TemplateSelector from './components/TemplateSelector';
import Dashboard from './components/Dashboard';
import SectionSummaryCards from './components/SectionSummaryCards';
import CategorySummaryCards from './components/CategorySummaryCards';
import DataTable from './components/DataTable';
import PriceAnalysis from './components/PriceAnalysis';
import ExcelUpload from './components/ExcelUpload';
import CategoryManager from './components/CategoryManager';
import SettingsManager from './components/SettingsManager';
import ProjectSiteManager from './components/ProjectSiteManager';
import SiteListSidebar from './components/SiteListSidebar';
import { Settings, FileSpreadsheet, LogOut, ChevronRight, Tags, BarChart3, Download, Share2, Copy, Check, X, Save, Lock, KeySquare, Sliders, Cloud, CheckCircle2, RefreshCw, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  saveProjectToFirestore,
  deleteProjectFromFirestore,
  subscribeProjectsFromFirestore,
  saveActiveSessionToFirestore,
  subscribeActiveSessionFromFirestore,
  saveCustomRulesToFirestore,
  subscribeCustomRulesFromFirestore
} from './lib/firebase';

import * as XLSX from 'xlsx';
import LZString from 'lz-string';

const INITIAL_CATEGORIES = [
  '백강관', '강관부속', 'STS위생관', 'STS위생부속', 'STS난방관', 'STS난방부속', 
  '고강도PVC', 'PVC', 'PB', '냉매배관', '난방코일', '난방분배기', 
  '밸브류', '수도계량기', '감압변', '스리브', '입상고정틀+내화충진재', 
  '조립식가대', 'SUPPORT류', '마감자재', '통합거치대', '보온재', '소모잡자재', 
  '공구손료', '안전장비류', '명판', '휀장비류', '기타자재', '지금자재', 
  '외주', '가설공사'
];

const STORAGE_KEY = 'mechauto_session_data';

const SAMPLE_ITEMS: SpecItem[] = [
  // 옥외배관공사
  { id: 'bw-1', name: 'STS 유니온 (나사)', specification: 'D 40', unit: 'EA', quantity: 1, materialUnitPrice: 14010, materialAmount: 14010, laborUnitPrice: 0, laborAmount: 0, unitPrice: 14010, amount: 14010, category: 'STS위생부속', section: '010102 옥외배관공사', remark: '' },
  { id: 'bw-2', name: 'STS 니플 (나사)', specification: 'D 40', unit: 'EA', quantity: 3, materialUnitPrice: 0, materialAmount: 0, laborUnitPrice: 0, laborAmount: 0, unitPrice: 0, amount: 0, category: '지금자재', section: '010102 옥외배관공사', remark: '지급자재' },
  { id: 'bw-3', name: 'STS 후렌지접합', specification: 'D 40', unit: '개소', quantity: 1, materialUnitPrice: 0, materialAmount: 0, laborUnitPrice: 22620, laborAmount: 22620, unitPrice: 0, amount: 0, category: '미분류', section: '010102 옥외배관공사', remark: '' },
  
  // 기계실배관공사
  { id: 'ms-1', name: 'STS 엘보 (SR)', specification: 'D 25', unit: 'EA', quantity: 32, materialUnitPrice: 2769, materialAmount: 88608, laborUnitPrice: 0, laborAmount: 0, unitPrice: 2769, amount: 88608, category: 'STS위생부속', section: '01010401 기계실배관공사', remark: '에폭시코팅' },
  { id: 'ms-2', name: 'STS 숫아답타소켓 (SR)', specification: 'D 25', unit: 'EA', quantity: 22, materialUnitPrice: 4356, materialAmount: 95832, laborUnitPrice: 0, laborAmount: 0, unitPrice: 4356, amount: 95832, category: 'STS위생부속', section: '01010401 기계실배관공사', remark: '' },
  { id: 'ms-3', name: 'STS K-유니온 (SR)', specification: 'D 25', unit: 'EA', quantity: 18, materialUnitPrice: 10704, materialAmount: 192672, laborUnitPrice: 0, laborAmount: 0, unitPrice: 10704, amount: 192672, category: 'STS위생부속', section: '01010401 기계실배관공사', remark: '' },
];

// Field mappings for SpecItem compaction
const FIELD_MAP: Record<string, string> = {
  id: 'i',
  name: 'n',
  specification: 's',
  unit: 'u',
  quantity: 'q',
  materialUnitPrice: 'm',
  materialAmount: 'ma',
  laborUnitPrice: 'l',
  laborAmount: 'la',
  unitPrice: 'p',
  amount: 'a',
  category: 'c',
  section: 't',
  remark: 'r',
  originalCategory: 'o',
  excelRowIdx: 'x',
  memo: 'mo'
};

const REVERSE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
);

function minifyState(items: SpecItem[], theme: string | null, categories: string[], projectName: string, fontFamily: string, fontSize: number) {
  const minifiedItems = items.map(item => {
    const minItem: Record<string, any> = {};
    for (const [key, value] of Object.entries(item)) {
      const shortKey = FIELD_MAP[key] || key;
      minItem[shortKey] = value;
    }
    return minItem;
  });

  return {
    its: minifiedItems,
    th: theme,
    ff: fontFamily,
    fs: fontSize,
    cats: categories,
    pName: projectName
  };
}

function unminifyState(minState: any) {
  const items = (minState.its || []).map((minItem: any) => {
    const item: Record<string, any> = {};
    for (const [key, value] of Object.entries(minItem)) {
      const longKey = REVERSE_FIELD_MAP[key] || key;
      item[longKey] = value;
    }
    return item as SpecItem;
  });

  return {
    items,
    theme: minState.th,
    fontFamily: minState.ff || '"Gulim", "굴림", Dotum, "돋움", sans-serif',
    fontSize: minState.fs || 11,
    categories: minState.cats,
    projectName: minState.pName
  };
}

function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
  return btoa(binString);
}

async function compressState(stateObj: any): Promise<string> {
  const jsonStr = JSON.stringify(stateObj);
  try {
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);
    if (compressed) {
      return 'lz:' + compressed;
    }
  } catch (e) {
    console.warn("lz-string compression failed, falling back to older raw encoding", e);
  }

  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([jsonStr]).stream();
      // @ts-ignore
      const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
      const chunks: BlobPart[] = [];
      const reader = compressedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const blob = new Blob(chunks);
      const buffer = await blob.arrayBuffer();
      const b64 = bytesToBase64(new Uint8Array(buffer));
      return 'gz:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  } catch (e) {
    console.warn("CompressionStream failed, falling back to standard encoding", e);
  }
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  const b64 = bytesToBase64(utf8Bytes);
  return 'raw:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompressState(encoded: string): Promise<any> {
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch (e) {
    // ignore
  }

  // 1. New lz-string decompression
  if (decoded.startsWith('lz:')) {
    const rawPayload = decoded.slice(3);
    const decompressed = LZString.decompressFromEncodedURIComponent(rawPayload);
    if (decompressed) {
      return JSON.parse(decompressed);
    }
    throw new Error("Failed to decompress using lz-string");
  }

  // 2. Old backward compatible fallback
  let isGzip = false;
  let cleanB64 = decoded;
  if (decoded.startsWith('gz:')) {
    isGzip = true;
    cleanB64 = decoded.slice(3);
  } else if (decoded.startsWith('raw:')) {
    isGzip = false;
    cleanB64 = decoded.slice(4);
  }

  let base64 = cleanB64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  const bytes = base64ToBytes(base64);

  if (isGzip && typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([bytes]).stream();
      // @ts-ignore
      const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
      const chunks: BlobPart[] = [];
      const reader = decompressedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const blob = new Blob(chunks);
      const text = await blob.text();
      return JSON.parse(text);
    } catch (e) {
      console.warn("DecompressionStream failed, fallback to standard decoding", e);
    }
  }

  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

const PROJECTS_KEY = 'mechauto_projects';

export default function App() {
  const [theme, setTheme] = useState<ThemeType | null>(null);
  const [fontFamily, setFontFamily] = useState<string>('"Gulim", "굴림", Dotum, "돋움", sans-serif');
  const [fontSize, setFontSize] = useState<number>(11);
  const [items, setItems] = useState<SpecItem[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [categoryManagerTab, setCategoryManagerTab] = useState<'categories' | 'rules'>('categories');
  const [customClassificationRules, setCustomClassificationRules] = useState<CustomClassificationRule[]>(() => {
    try {
      const saved = localStorage.getItem('mechauto_custom_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((r: any) => ({
            ...r,
            priority: typeof r.priority === 'number' ? r.priority : 10
          }));
        }
      }
    } catch (e) {
      console.error('Error loading custom rules:', e);
    }
    return [
      { id: 'rule-sample-1', pattern: '소음방지', category: 'PB', isEnabled: true, priority: 20, description: '소음방지 키워드 매칭 기본 규칙' },
      { id: 'rule-sample-2', pattern: '안전보호구', category: '지금자재', isEnabled: true, priority: 10, description: '안전 장비 및 수동 보호구 자동 지금자재 처리용' }
    ];
  });

  // Persist classification rules to local and Firestore
  useEffect(() => {
    try {
      localStorage.setItem('mechauto_custom_rules', JSON.stringify(customClassificationRules));
      saveCustomRulesToFirestore(customClassificationRules).catch(err => {
        console.warn('Failed to sync rules to Firestore:', err);
      });
    } catch (e) {
      console.error('Error saving custom rules:', e);
    }
  }, [customClassificationRules]);

  const handleApplyRules = (updatedRules = customClassificationRules) => {
    if (items.length === 0) {
      showNotification('적용할 시트 데이터가 없습니다. 먼저 엑셀 파일을 업로드해 주세요.', 'error');
      return;
    }
    
    checkLockAndProceed(() => {
      let changedCount = 0;
      setItems(prevItems => {
        return prevItems.map(item => {
          const { category: newCategory, remark } = autoClassify(item, updatedRules);
          const finalCategory = newCategory || item.category;
          if (finalCategory !== item.category) {
            changedCount++;
            return {
              ...item,
              category: finalCategory,
              originalCategory: finalCategory,
              remark: remark || item.remark
            };
          }
          return item;
        });
      });
      showNotification(`분류 규칙 일괄 적용 완료! ${changedCount}개의 품목 카테고리가 재조정되었습니다.`, 'success');
    });
  };

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSectionSummaryOpen, setIsSectionSummaryOpen] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState(0);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Project Management State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  
  // Cloud & Local Sync Status
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastCloudSyncedTime, setLastCloudSyncedTime] = useState<string>('');
  const [isAutoSavingIndicator, setIsAutoSavingIndicator] = useState(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>('');
  const [isAutoSaveActive, setIsAutoSaveActive] = useState(true);
  const [isManualSaveNamingOpen, setIsManualSaveNamingOpen] = useState(false);
  const [manualSaveName, setManualSaveName] = useState('');
  
  // Completion & Locking States
  const [isProjectLocked, setIsProjectLocked] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [onUnlockSuccessCallback, setOnUnlockSuccessCallback] = useState<(() => void) | null>(null);
  
  // Share Project State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Session Recovery State
  const [pendingSession, setPendingSession] = useState<{ items: SpecItem[], theme: ThemeType, timestamp: number } | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  // 1. Setup real-time Firestore listeners & Cloud Hydration
  useEffect(() => {
    // Load local projects cache first
    const savedProjects = localStorage.getItem(PROJECTS_KEY);
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error('Failed to parse projects', e);
      }
    }

    // Subscribe to Firestore Projects for real-time multi-PC synchronization
    const unsubscribeProjects = subscribeProjectsFromFirestore(firestoreProjects => {
      if (firestoreProjects && firestoreProjects.length >= 0) {
        setProjects(firestoreProjects);
        try {
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(firestoreProjects));
        } catch (e) {
          // ignore
        }
        setCloudSyncStatus('synced');
        setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
      }
    });

    // Subscribe to Firestore Custom Rules
    const unsubscribeRules = subscribeCustomRulesFromFirestore(firestoreRules => {
      if (firestoreRules && firestoreRules.length > 0) {
        setCustomClassificationRules(firestoreRules);
        try {
          localStorage.setItem('mechauto_custom_rules', JSON.stringify(firestoreRules));
        } catch (e) {
          // ignore
        }
      }
    });

    // Check Shared link or Firestore Active Session on Mount
    const checkSharedOrCloudSession = async () => {
      try {
        let shareDataStr = '';
        
        // Check query spec first
        const urlParams = new URLSearchParams(window.location.search);
        const queryShare = urlParams.get('share');
        if (queryShare) {
          shareDataStr = queryShare;
        } else {
          // Check hash
          const hash = window.location.hash;
          if (hash) {
            const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
            const hashParams = new URLSearchParams(cleanHash);
            const hashShare = hashParams.get('share');
            if (hashShare) {
              shareDataStr = hashShare;
            } else if (cleanHash.startsWith('share=')) {
              shareDataStr = cleanHash.substring(6);
            } else if (cleanHash.includes('share=')) {
              const idx = cleanHash.indexOf('share=');
              shareDataStr = cleanHash.substring(idx + 6);
            }
          }
        }

        if (shareDataStr) {
          try {
            shareDataStr = decodeURIComponent(shareDataStr).trim();
          } catch (e) {
            console.warn("Failed to decodeURIComponent shareDataStr", e);
          }

          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);

          showNotification('공유된 프로젝트 데이터를 불러오는 중...', 'info');
          
          const state = await decompressState(shareDataStr);
          if (state) {
            const restoredState = unminifyState(state);
            
            if (restoredState.items && restoredState.items.length > 0) {
              setItems(restoredState.items);
              if (restoredState.theme) setTheme(restoredState.theme);
              if (restoredState.categories) setCategories(restoredState.categories);
              if (restoredState.projectName) setCurrentProjectName(restoredState.projectName);
              
              setIsRecoveryModalOpen(false);
              setPendingSession(null);
              
              showNotification(`공유된 프로젝트 데이터를 성공적으로 불러왔습니다.`, 'success');
              return true;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load shared link', e);
        showNotification('공유 링크 데이터 해석 및 로드 중 오류가 발생했습니다.', 'error');
      }
      return false;
    };

    let unsubscribeActiveSession: (() => void) | null = null;

    const runInitCheck = async () => {
      const loadedShare = await checkSharedOrCloudSession();
      
      // If no explicit share link, subscribe to active cloud session
      if (!loadedShare) {
        unsubscribeActiveSession = subscribeActiveSessionFromFirestore(cloudSession => {
          if (cloudSession && cloudSession.items && cloudSession.items.length > 0) {
            // If local is currently empty or initial load, auto hydrate from cloud
            setItems(prevItems => {
              if (prevItems.length === 0) {
                if (cloudSession.theme) setTheme(cloudSession.theme);
                if (cloudSession.fontFamily) setFontFamily(cloudSession.fontFamily);
                if (cloudSession.fontSize) setFontSize(cloudSession.fontSize);
                if (cloudSession.categories && cloudSession.categories.length > 0) setCategories(cloudSession.categories);
                if (cloudSession.projectName) setCurrentProjectName(cloudSession.projectName);
                setIsProjectLocked(!!cloudSession.isLocked);
                return cloudSession.items;
              }
              return prevItems;
            });
          } else {
            // Fallback to local session recovery if cloud is empty
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (parsed.items && parsed.items.length > 0) {
                  setPendingSession(parsed);
                  setIsRecoveryModalOpen(true);
                }
              } catch (e) {
                console.error('Failed to parse saved session', e);
              }
            }
          }
        });
      }
    };

    runInitCheck();

    return () => {
      unsubscribeProjects();
      unsubscribeRules();
      if (unsubscribeActiveSession) unsubscribeActiveSession();
    };
  }, []);

  // Update root styles for font
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', fontFamily);
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`);
  }, [fontFamily, fontSize]);

  // Auto-save logic
  useEffect(() => {
    if (items.length > 0 && theme) {
      const sessionData = {
        items,
        theme,
        fontFamily,
        fontSize,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    }
  }, [items, theme, fontFamily, fontSize]);

  // Real-time site-specific auto-saving hook (Syncs to both Local & Firestore Cloud)
  useEffect(() => {
    if (isAutoSaveActive && items.length > 0 && theme) {
      setIsAutoSavingIndicator(true);
      setCloudSyncStatus('syncing');

      const existingProj = currentProjectName ? projects.find(p => p.name === currentProjectName) : null;
      const existingId = existingProj?.id;
      const updatedProject: Project = {
        id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        name: currentProjectName || '작업 현장',
        items,
        theme,
        config: {
          theme,
          fontFamily,
          fontSize
        },
        categories,
        updatedAt: Date.now(),
        status: existingProj?.status || (isProjectLocked ? 'completed' : 'working')
      };

      if (currentProjectName) {
        setProjects(prev => {
          const updated = prev.some(p => p.name === currentProjectName)
            ? prev.map(p => p.name === currentProjectName ? updatedProject : p)
            : [...prev, updatedProject];
          try {
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        // Save project to Firestore
        saveProjectToFirestore(updatedProject).catch(err => {
          console.warn('Firestore auto-save project failed:', err);
        });
      }

      // Save global active session to Firestore so any PC opening gets this exact state!
      saveActiveSessionToFirestore({
        projectName: currentProjectName,
        items,
        theme,
        fontFamily,
        fontSize,
        categories,
        isLocked: isProjectLocked
      }).then(() => {
        setCloudSyncStatus('synced');
        setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
      }).catch(err => {
        console.warn('Firestore auto-save session failed:', err);
        setCloudSyncStatus('error');
      });

      const now = new Date();
      setLastAutoSavedTime(now.toTimeString().split(' ')[0]);

      const timer = setTimeout(() => {
        setIsAutoSavingIndicator(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [items, theme, fontFamily, fontSize, categories, currentProjectName, isAutoSaveActive, isProjectLocked]);

  const handleManualSave = () => {
    if (!theme) {
      showNotification('테마를 먼저 선택해야 저장할 수 있습니다.', 'error');
      return;
    }
    if (items.length === 0) {
      showNotification('저장할 내역 데이터가 없습니다.', 'error');
      return;
    }

    if (currentProjectName) {
      handleSaveProject(currentProjectName);
      const now = new Date();
      setLastAutoSavedTime(now.toTimeString().split(' ')[0]);
      showNotification(`현장 [ ${currentProjectName} ] 정보가 클라우드 및 모든 기기에 저장되었습니다.`, 'success');
    } else {
      setManualSaveName('');
      setIsManualSaveNamingOpen(true);
    }
  };

  const handleConfirmManualSave = () => {
    if (!manualSaveName.trim()) {
      showNotification('현장명을 입력해야 저장이 가능합니다.', 'error');
      return;
    }
    handleSaveProject(manualSaveName.trim());
    const now = new Date();
    setLastAutoSavedTime(now.toTimeString().split(' ')[0]);
    setIsManualSaveNamingOpen(false);
  };

  const handleShareProject = async () => {
    if (items.length === 0) {
      showNotification('공유할 데이터가 없습니다. 먼저 내역을 가져오거나 파일을 로드해주세요.', 'error');
      return;
    }
    try {
      showNotification('공유 링크 생성 중...', 'info');
      const minState = minifyState(items, theme, categories, currentProjectName, fontFamily, fontSize);
      const encoded = await compressState(minState);
      
      const shareLink = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
      setShareUrl(shareLink);
      setIsShareModalOpen(true);
      setCopied(false);
    } catch (e) {
      console.error('Failed to generate share URL', e);
      showNotification('공유 링크 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      showNotification('공유 링크가 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy', err);
      showNotification('링크 복사에 실패했습니다. 직접 복사해주세요.', 'error');
    });
  };

  const handleSaveProject = async (name: string) => {
    if (!theme) {
      showNotification('테마를 먼저 선택해야 저장할 수 있습니다.', 'error');
      return;
    }

    try {
      setCloudSyncStatus('syncing');
      const existingId = projects.find(p => p.name === name)?.id;
      const newProject: Project = {
        id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        name,
        items,
        theme: theme,
        config: {
          theme: theme,
          fontFamily,
          fontSize
        },
        categories,
        updatedAt: Date.now(),
        status: projects.find(p => p.name === name)?.status || 'working'
      };

      setProjects(prev => {
        const updated = prev.some(p => p.name === name)
          ? prev.map(p => p.name === name ? newProject : p)
          : [...prev, newProject];
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        return updated;
      });

      setCurrentProjectName(name);

      // Persist to Cloud Firestore
      await saveProjectToFirestore(newProject);
      await saveActiveSessionToFirestore({
        projectName: name,
        items,
        theme,
        fontFamily,
        fontSize,
        categories,
        isLocked: isProjectLocked
      });

      setCloudSyncStatus('synced');
      setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
      showNotification(`현장 '${name}' 정보가 클라우드 및 모든 기기에 성공적으로 저장되었습니다.`, 'success');
    } catch (e) {
      console.error('Failed to save project', e);
      setCloudSyncStatus('error');
      showNotification('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
  };

  const handleLoadProject = (project: Project) => {
    try {
      setItems(project.items || []);
      setTheme(project.theme);
      if (project.config) {
        setFontFamily(project.config.fontFamily || '"Gulim", "굴림", Dotum, "돋움", sans-serif');
        setFontSize(project.config.fontSize || 11);
      }
      setCategories(project.categories || INITIAL_CATEGORIES);
      setCurrentProjectName(project.name);
      
      // 세로(새로) 현장 선택 시 기본적으로 완료된 내역(completed) 상태 및 수정 락 활성화
      setIsProjectLocked(true);
      
      const updatedProject: Project = { 
        ...project, 
        status: 'completed' as const 
      };

      setProjects(prev => {
        const updated = prev.map(p => p.id === project.id ? updatedProject : p);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        return updated;
      });

      // Synchronize active session & project status to Firestore
      saveProjectToFirestore(updatedProject).catch(console.warn);
      saveActiveSessionToFirestore({
        projectName: project.name,
        items: project.items || [],
        theme: project.theme,
        fontFamily: project.config?.fontFamily || '"Gulim", "굴림", Dotum, "돋움", sans-serif',
        fontSize: project.config?.fontSize || 11,
        categories: project.categories || INITIAL_CATEGORIES,
        isLocked: true
      }).catch(console.warn);

      showNotification(`현장 '${project.name}' 내역이 '내역분리 완료(수정 보호)' 상태로 로드되었습니다.`, 'success');
    } catch (e) {
      showNotification('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleCompleteProject = async () => {
    if (!currentProjectName) {
      showNotification('내역분리 완료를 수행할 활성화된 현장이 없습니다.', 'error');
      return;
    }

    setIsProjectLocked(true);

    const existingProj = projects.find(p => p.name === currentProjectName);
    let targetProject: Project;

    if (existingProj) {
      targetProject = {
        ...existingProj,
        status: 'completed',
        items,
        updatedAt: Date.now()
      };

      setProjects(prev => {
        const updated = prev.map(p => p.name === currentProjectName ? targetProject : p);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        return updated;
      });
    } else {
      const newProjId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      targetProject = {
        id: newProjId,
        name: currentProjectName,
        items,
        theme: theme || 'industrial',
        config: { theme: theme || 'industrial', fontFamily, fontSize },
        categories,
        updatedAt: Date.now(),
        status: 'completed'
      };
      setProjects(prev => {
        const updated = [...prev, targetProject];
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        return updated;
      });
    }

    try {
      await saveProjectToFirestore(targetProject);
      await saveActiveSessionToFirestore({
        projectName: currentProjectName,
        items,
        theme,
        fontFamily,
        fontSize,
        categories,
        isLocked: true
      });
      setCloudSyncStatus('synced');
      setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
    } catch (err) {
      console.warn('Failed to sync completed status to Firestore:', err);
    }

    showNotification('현장의 내역분리가 완료 처리되어 모든 PC 및 기기에 동기화되었습니다. (수정 시 비밀번호 필요)', 'success');
  };

  const checkLockAndProceed = (action: () => void) => {
    if (isProjectLocked && currentProjectName) {
      setOnUnlockSuccessCallback(() => action);
      setIsPasswordModalOpen(true);
      setPasswordInput('');
      return false;
    }
    action();
    return true;
  };

  const handleVerifyPassword = () => {
    if (passwordInput === '4714') {
      setIsProjectLocked(false);
      setIsPasswordModalOpen(false);
      showNotification('비밀번호 인증 성공! 안심 수정 모드가 활성화되었습니다.', 'success');
      
      if (currentProjectName) {
        const existingProj = projects.find(p => p.name === currentProjectName);
        if (existingProj) {
          const updatedProj: Project = {
            ...existingProj,
            status: 'working',
            updatedAt: Date.now()
          };
          setProjects(prev => {
            const updated = prev.map(p => p.name === currentProjectName ? updatedProj : p);
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
            return updated;
          });
          saveProjectToFirestore(updatedProj).catch(console.warn);
        }
      }

      if (onUnlockSuccessCallback) {
        onUnlockSuccessCallback();
        setOnUnlockSuccessCallback(null);
      }
    } else {
      showNotification('비밀번호가 일치하지 않습니다. 다시 입력해주세요.', 'error');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const projectToDelete = projects.find(p => p.id === id);
      if (!projectToDelete) return;

      setProjects(prev => {
        const updated = prev.filter(p => p.id !== id);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        return updated;
      });
      
      if (projectToDelete.name === currentProjectName) {
        setCurrentProjectName('');
      }

      await deleteProjectFromFirestore(id);

      showNotification(`현장 '${projectToDelete.name}' 프로젝트가 클라우드에서 삭제되었습니다.`, 'info');
    } catch (e) {
      console.error('Failed to delete project', e);
      showNotification('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleNewProject = () => {
    const hasData = items.length > 0;
    if (hasData) {
      const confirmNew = window.confirm('현재 작업 중인 데이터가 초기화됩니다. 정말로 새 현장 작업을 시작하시겠습니까?');
      if (!confirmNew) return;
    }
    
    setItems([]);
    setTheme(null);
    setWorkbook(null);
    setCurrentProjectName('');
    setIsProjectLocked(false);
    showNotification('새로운 현장 작업 공간이 준비되었습니다.', 'info');
  };

  const handleAddNewProject = async (name: string) => {
    if (!name.trim()) return;

    // Auto-save existing project first if active to prevent data loss
    if (items.length > 0 && currentProjectName && theme) {
      try {
        const existingId = projects.find(p => p.name === currentProjectName)?.id;
        const currentData: Project = {
          id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
          name: currentProjectName,
          items,
          theme,
          config: { theme, fontFamily, fontSize },
          categories,
          updatedAt: Date.now(),
          status: projects.find(p => p.name === currentProjectName)?.status || 'working'
        };
        setProjects(prev => {
          const updated = prev.some(p => p.name === currentProjectName)
            ? prev.map(p => p.name === currentProjectName ? currentData : p)
            : [...prev, currentData];
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
          return updated;
        });
        saveProjectToFirestore(currentData).catch(console.warn);
      } catch (e) {
        console.error('Failed to auto-save before new project swap', e);
      }
    }

    // Setup new empty project instance
    const newProjId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newProject: Project = {
      id: newProjId,
      name: name.trim(),
      items: [],
      theme: theme || 'industrial',
      config: {
        theme: theme || 'industrial',
        fontFamily,
        fontSize
      },
      categories: INITIAL_CATEGORIES,
      updatedAt: Date.now(),
      status: 'working'
    };

    setProjects(prev => {
      const updated = [...prev, newProject];
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
      return updated;
    });

    setItems([]);
    setTheme(theme || 'industrial');
    setWorkbook(null);
    setCurrentProjectName(name.trim());
    setIsProjectLocked(false);

    await saveProjectToFirestore(newProject);
    await saveActiveSessionToFirestore({
      projectName: name.trim(),
      items: [],
      theme: theme || 'industrial',
      fontFamily,
      fontSize,
      categories: INITIAL_CATEGORIES,
      isLocked: false
    });

    showNotification(`새 현장 '${name.trim()}' 추가 및 클라우드 동기화가 완료되었습니다. 기계설비 엑셀 파일을 업로드해 주세요!`, 'success');
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        appName: 'mechauto_spec_analyzer',
        version: '1.0',
        backupDate: new Date().toISOString(),
        projects
      };
      
      const fileData = JSON.stringify(backupData, null, 2);
      const blob = new Blob([fileData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `기계설비_공정분석_백업_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification('모든 현장 데이터 백업 파일(.json)이 다운로드되었습니다.', 'success');
    } catch (e) {
      console.error('Failed to export backup', e);
      showNotification('백업 파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleImportBackup = (importedData: any) => {
    try {
      let importedProjects: Project[] = [];
      
      if (importedData && Array.isArray(importedData)) {
        importedProjects = importedData;
      } else if (importedData && Array.isArray(importedData.projects)) {
        importedProjects = importedData.projects;
      } else {
        showNotification('유효한 백업 데이터 형식이 아닙니다.', 'error');
        return;
      }

      if (importedProjects.length === 0) {
        showNotification('백업될 현장 데이터가 비어 있습니다.', 'info');
        return;
      }

      setProjects(prev => {
        const updated = [...prev];
        let overwriteCount = 0;
        let newCount = 0;

        importedProjects.forEach(ip => {
          if (!ip.name || !Array.isArray(ip.items)) return;

          const matchIdx = updated.findIndex(p => p.name.trim() === ip.name.trim());
          if (matchIdx !== -1) {
            updated[matchIdx] = {
              ...updated[matchIdx],
              ...ip,
              id: updated[matchIdx].id || ip.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
              updatedAt: ip.updatedAt || Date.now()
            };
            overwriteCount++;
          } else {
            updated.push({
              ...ip,
              id: ip.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
              updatedAt: ip.updatedAt || Date.now()
            });
            newCount++;
          }
        });

        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        
        let msg = `성공적으로 데이터를 복원하였습니다.`;
        if (newCount > 0) msg += ` (신규 ${newCount}개 추가)`;
        if (overwriteCount > 0) msg += ` (기존 ${overwriteCount}개 갱신)`;
        
        showNotification(msg, 'success');
        return updated;
      });
    } catch (e) {
      console.error('Import backup failed', e);
      showNotification('백업 데이터를 복원하는 중에 실패했습니다. 파일 형식을 확인해주세요.', 'error');
    }
  };

  const restoreSession = () => {
    if (pendingSession) {
      setItems((pendingSession as any).items);
      setTheme((pendingSession as any).theme);
      if ((pendingSession as any).fontFamily) setFontFamily((pendingSession as any).fontFamily);
      if ((pendingSession as any).fontSize) setFontSize((pendingSession as any).fontSize);
      setIsProjectLocked(false);
      setIsRecoveryModalOpen(false);
      setPendingSession(null);
      showNotification('이전 작업 세션이 복구되었습니다.', 'success');
    }
  };

  const discardSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsRecoveryModalOpen(false);
    setPendingSession(null);
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleClassify = async () => {
    checkLockAndProceed(async () => {
      setIsClassifying(true);
      setClassifyProgress(0);
      try {
        const BATCH_SIZE = 500; // Increased batch size further to minimize requests
        const allClassifications: any[] = [];
        const totalItems = items.length;
        
        for (let i = 0; i < totalItems; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              items: batch.map(bi => ({ 
                id: bi.id, 
                name: bi.name, 
                specification: bi.specification,
                materialUnitPrice: bi.materialUnitPrice,
                laborUnitPrice: bi.laborUnitPrice,
                section: bi.section,
                remark: bi.remark
              })),
              categories,
              customRules: customClassificationRules
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
            throw new Error(errorData.message || errorData.error || `Server responded with ${response.status}`);
          }
          
          const classifications = await response.json();
          allClassifications.push(...classifications);
          setClassifyProgress(Math.min(Math.round(((i + batch.length) / totalItems) * 100), 100));
        }
        
        const newItems = items.map(item => {
          const found = allClassifications.find((c: any) => c.id === item.id);
          // Also update remark field with category name as requested by user
          return found ? { ...item, category: found.category, remark: found.category } : item;
        });
        
        setItems(newItems);
        showNotification(`총 ${newItems.length}개의 항목이 분류되었습니다.`, 'success');
      } catch (error: any) {
        console.error('Classification failed:', error);
        showNotification(error.message || '분류 중 오류가 발생했습니다.', 'error');
      } finally {
        setIsClassifying(false);
        setTimeout(() => setClassifyProgress(0), 500);
      }
    });
  };

  const handleUpdateCategory = (id: string, newCategory: string) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, category: newCategory, remark: newCategory } : item
      ));
    });
  };

  const handleRevertCategory = (id: string) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        item.id === id && item.originalCategory 
          ? { ...item, category: item.originalCategory, remark: item.originalCategory } 
          : item
      ));
      showNotification('품목 분류가 원래 상태로 복구되었습니다.', 'info');
    });
  };

  const handleUpdateCategories = (ids: string[], newCategory: string) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        ids.includes(item.id) ? { ...item, category: newCategory, remark: newCategory } : item
      ));
      showNotification(`${ids.length}개 항목의 카테고리가 '${newCategory}'(으)로 변경되었습니다.`, 'success');
    });
  };

  const handleUpdateMemo = (id: string, newMemo: string) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, memo: newMemo } : item
      ));
    });
  };

  const handleUpdateSafetyAmount = (amount: number) => {
    checkLockAndProceed(() => {
      setItems(prev => {
        const idx = prev.findIndex(item => item.id === 'manual-safety-item');
        if (idx !== -1) {
          if (amount <= 0) {
            return prev.filter(item => item.id !== 'manual-safety-item');
          }
          return prev.map(item => 
            item.id === 'manual-safety-item' 
              ? { 
                  ...item, 
                  materialUnitPrice: amount,
                  materialAmount: amount, 
                  unitPrice: amount, 
                  amount: amount 
                } 
              : item
          );
        } else if (amount > 0) {
          const newItem: SpecItem = {
            id: 'manual-safety-item',
            name: '안전장비류 (수동 입력)',
            specification: '현장안전용품',
            unit: '식',
            quantity: 1,
            materialUnitPrice: amount,
            materialAmount: amount,
            laborUnitPrice: 0,
            laborAmount: 0,
            unitPrice: amount,
            amount: amount,
            category: '안전장비류',
            section: '가설 및 안전공사',
            remark: '수동 입력'
          };
          return [...prev, newItem];
        }
        return prev;
      });
      showNotification('안전장비류 수동 입력 금액이 반영되었습니다.', 'success');
    });
  };

  const handleDataLoaded = (newItems: SpecItem[], wb: XLSX.WorkBook) => {
    // Apply automatic classification based on rules immediately upon upload
    const classifiedItems = newItems.map(item => {
      const { category, remark } = autoClassify(item, customClassificationRules);
      const finalCategory = category || item.category;
      return { 
        ...item, 
        category: finalCategory,
        originalCategory: finalCategory, // Store initial rule-based classification
        remark: remark || item.remark 
      };
    });
    
    setItems(classifiedItems);
    setWorkbook(wb);
    showNotification(`엑셀 파일 업로드 완료: ${classifiedItems.length}개의 항목을 불러왔으며, 규칙 기반 자동 분류가 적용되었습니다.`, 'success');
  };

  const handleDownloadResults = async () => {
    if (items.length === 0) {
      showNotification('다운로드할 데이터가 없습니다.', 'error');
      return;
    }

    try {
      showNotification('고급 서식 엑셀 파일 생성 중...', 'info');
      await exportStyledExcel({
        projectName: currentProjectName || '기계설비_공정분리',
        items,
        categories
      });
      showNotification('셀 서식과 재료비 단가/금액이 포함된 고급 엑셀 파일이 다운로드되었습니다.', 'success');
    } catch (e: any) {
      console.error('Export failed', e);
      showNotification(e.message || '파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const renderHeader = () => {
    if (theme === 'high-density') {
      return (
        <header className="flex items-center justify-between px-6 py-3 bg-[#141414] text-white">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center font-bold text-lg rounded-sm">M</div>
            <h1 className="text-sm font-semibold tracking-widest uppercase truncate max-w-[200px]">기계설비 공정분리 툴 v4.0</h1>
            
            <div className="h-6 w-px bg-white/20 mx-1" />
            
            <ProjectSiteManager 
              projects={projects}
              currentProjectName={currentProjectName}
              theme={theme}
              onSave={handleSaveProject}
              onLoad={handleLoadProject}
              onDelete={handleDeleteProject}
              onNew={handleNewProject}
              onAddNewProject={handleAddNewProject}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
            />

            {/* 실시간 자동 저장 스위치 및 상태 지시등 (High Density) */}
            <div className="flex items-center gap-3 bg-white/5 px-2.5 py-1 rounded border border-white/10" id="hd-autosave-panel">
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isAutoSaveActive;
                    setIsAutoSaveActive(nextVal);
                    showNotification(nextVal ? '실시간 자동 저장이 활성화되었습니다.' : '실시간 자동 저장이 비활성화되었습니다.', 'info');
                  }}
                  className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-white/20 transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoSaveActive ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                  title="실시간 자동 저장 켜기/끄기"
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-[1px] ${
                      isAutoSaveActive ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-[10px] text-zinc-300 font-mono select-none">자동 저장</span>
              </div>
              {currentProjectName && (
                <div className="hidden sm:flex items-center gap-1 text-[9px] text-emerald-400 font-mono pl-1.5 border-l border-white/10">
                  <span className={`w-1.5 h-1.5 rounded-full ${isAutoSaveActive && isAutoSavingIndicator ? 'bg-amber-400 animate-pulse' : (isAutoSaveActive ? 'bg-emerald-400' : 'bg-zinc-500')}`} />
                  <span>{isAutoSaveActive ? (lastAutoSavedTime ? `완료 (${lastAutoSavedTime})` : '활성화됨') : '꺼짐'}</span>
                </div>
              )}
            </div>

            {/* 내역분리 완료 제어부 (High Density) */}
            {currentProjectName && (
              <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded border border-white/10" id="hd-completion-panel">
                {isProjectLocked ? (
                  <>
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 font-mono">
                      🔒 내역분리 완료
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOnUnlockSuccessCallback(null);
                        setIsPasswordModalOpen(true);
                        setPasswordInput('');
                      }}
                      className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-[9px] font-bold rounded text-white transition-colors cursor-pointer"
                      title="비밀번호(4714)를 입력하여 수정을 허용합니다"
                    >
                      잠금해제
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 font-mono">
                      🔓 수정중
                    </span>
                    <button
                      type="button"
                      onClick={handleCompleteProject}
                      className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-[9px] font-bold rounded text-white transition-colors cursor-pointer"
                      title="내역분리를 완료하고 데이터를 보호합니다"
                    >
                      완료처리
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[9px] font-mono border border-white/15" title="모든 PC 및 기기와 실시간 클라우드 동기화 중">
              <Cloud size={11} className={cloudSyncStatus === 'syncing' ? 'text-amber-400 animate-spin' : 'text-sky-400'} />
              <span className="text-white/80">클라우드:</span>
              <span className="text-emerald-400 font-bold">
                {cloudSyncStatus === 'syncing' ? '동기화 중...' : (lastCloudSyncedTime ? `동기화됨 (${lastCloudSyncedTime})` : '연결됨')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-[11px] opacity-60 font-mono hidden md:block">가동 상태: 정상</div>
            <div className="flex gap-2 items-center">
              {items.length > 0 && (
                <>
                  <button 
                    onClick={handleManualSave}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold uppercase rounded border border-emerald-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="현재 수동 저장"
                  >
                    <Save size={12} />
                    수동 저장
                  </button>
                  <button 
                    onClick={handleShareProject}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-[10px] font-bold uppercase rounded border border-amber-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 size={12} />
                    공유하기
                  </button>
                  <button 
                    onClick={handleDownloadResults}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-[10px] font-bold uppercase rounded border border-blue-400 text-white transition-colors flex items-center gap-1.5"
                  >
                    <Download size={12} />
                    결과 다운로드
                  </button>
                </>
              )}
              <button 
                onClick={() => setItems([])}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase rounded border border-white/20 transition-colors"
              >
                데이터 초기화
              </button>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] uppercase font-bold text-green-400">AI 프로세서 활성화</span>
            </div>
          </div>
        </header>
      );
    }

    return (
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-6 lg:p-10 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mb-1">
            <span>데이터 관리</span>
            <ChevronRight size={14} />
            <span className="text-indigo-500 font-medium font-mono uppercase tracking-wider">{theme || '신규'} 테마</span>
            <ChevronRight size={14} />
            <div className="ml-2 flex flex-wrap items-center gap-2">
              <ProjectSiteManager 
                projects={projects}
                currentProjectName={currentProjectName}
                theme={theme}
                onSave={handleSaveProject}
                onLoad={handleLoadProject}
                onDelete={handleDeleteProject}
                onNew={handleNewProject}
                onAddNewProject={handleAddNewProject}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
              />
              {/* 클라우드 동기화 상태 뱃지 (Standard) */}
              <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/85 px-3 py-1 rounded-full shadow-sm select-none border border-slate-200/50 transition-all font-sans text-xs" id="standard-cloud-sync-panel" title="다른 PC나 브라우저에서 열어도 작업 내역이 동일하게 유지됩니다">
                <Cloud size={14} className={cloudSyncStatus === 'syncing' ? 'text-amber-500 animate-spin' : 'text-indigo-600'} />
                <span className="font-bold text-slate-700">클라우드</span>
                <span className={`w-1.5 h-1.5 rounded-full ${cloudSyncStatus === 'syncing' ? 'bg-amber-400 animate-ping' : (cloudSyncStatus === 'error' ? 'bg-rose-500' : 'bg-emerald-500')}`} />
                <span className="text-[11px] font-mono text-slate-500">
                  {cloudSyncStatus === 'syncing' ? '동기화중' : (lastCloudSyncedTime ? `동기화됨 (${lastCloudSyncedTime})` : '실시간 연결')}
                </span>
              </div>
              {/* 실시간 자동 저장 스위치 및 상태 지시등 (Standard) */}
              <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/85 px-3 py-1 rounded-full shadow-sm select-none border border-slate-200/50 transition-all font-sans" id="standard-autosave-panel">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isAutoSaveActive;
                    setIsAutoSaveActive(nextVal);
                    showNotification(nextVal ? '실시간 자동 저장이 활성화되었습니다.' : '실시간 자동 저장이 비활성화되었습니다.', 'info');
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoSaveActive ? 'bg-indigo-600 animate-none' : 'bg-slate-300'
                  }`}
                  title="실시간 자동 저장 켜기/끄기"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-[2px] ${
                      isAutoSaveActive ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-600">실시간 자동 저장</span>
                {currentProjectName && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isAutoSaveActive && isAutoSavingIndicator ? 'bg-amber-500 animate-ping' : (isAutoSaveActive ? 'bg-emerald-500' : 'bg-slate-400')}`} />
                )}
                {currentProjectName && (
                  <span className="text-[11px] font-medium font-mono text-slate-500">
                    {isAutoSaveActive ? (lastAutoSavedTime ? `완료 (${lastAutoSavedTime})` : '활성화됨') : '비활성'}
                  </span>
                )}
              </div>

              {/* 내역분리 완료 제어부 (Standard) */}
              {currentProjectName && (
                <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/85 px-3 py-1 rounded-full shadow-sm select-none border border-slate-200/50 transition-all font-sans" id="standard-completion-panel">
                  {isProjectLocked ? (
                    <>
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1 font-sans">
                        🔒 내역분리 완료
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOnUnlockSuccessCallback(null);
                          setIsPasswordModalOpen(true);
                          setPasswordInput('');
                        }}
                        className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-[10px] font-bold rounded-full text-white transition-all shadow-sm cursor-pointer"
                        title="비밀번호(4714)를 입력하여 수정을 허용합니다"
                      >
                        수정하기 (암호)
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 font-sans">
                        🔓 작업중
                      </span>
                      <button
                        type="button"
                        onClick={handleCompleteProject}
                        className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold rounded-full text-white transition-all shadow-sm cursor-pointer"
                        title="기계설비 공정 분류 및 내역 조율을 마감하고 완료 처리합니다"
                      >
                        내역분리 완료
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">기계설비 공정 분석 마스터</h1>
        </div>
        
        {theme && (
          <div className="flex items-center gap-3">
             {items.length > 0 && (
               <>
                 <button 
                   onClick={handleManualSave}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-lg shadow-emerald-100 text-sm font-bold cursor-pointer"
                   title="현장 수동 저장"
                 >
                   <Save size={16} />
                   <span>수동 저장</span>
                 </button>
                 <button 
                   onClick={handleShareProject}
                   className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-lg shadow-amber-200 text-sm font-bold cursor-pointer"
                 >
                   <Share2 size={16} />
                   <span>공유하기</span>
                 </button>
                 <button 
                   onClick={handleDownloadResults}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm font-bold"
                 >
                   <Download size={16} />
                   <span>결과 다운로드</span>
                 </button>
               </>
             )}
             <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <img 
                    key={i}
                    src={`https://picsum.photos/seed/${i + 10}/32/32`} 
                    className="w-8 h-8 rounded-full border-2 border-white"
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                ))}
             </div>
             <div className="text-xs text-slate-400 font-medium ml-2 text-right">
                박주민 님 외 2인이<br/>함께 검토 중입니다
             </div>
          </div>
        )}
      </header>
    );
  };

  if (!theme) {
    return (
      <div className="min-h-screen bg-slate-50">
        {renderHeader()}
        <TemplateSelector onSelect={setTheme} />
        {notification && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
             <span className={`px-6 py-2 rounded-full text-white text-sm font-bold shadow-xl ${notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
                {notification.message}
             </span>
          </div>
        )}
      </div>
    );
  }

  const themeClasses = {
    industrial: 'bg-slate-950 text-slate-100',
    modern: 'bg-slate-50 text-slate-900',
    minimal: 'bg-zinc-50 text-zinc-900',
    'high-density': 'bg-[#F4F4F2] text-[#141414] font-sans'
  }[theme];

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-500 relative`}>
      {/* Password Verification Dialog Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`w-full max-w-sm overflow-hidden shadow-2xl border-2 ${
                theme === 'high-density' ? 'bg-[#E7E6E1] border-[#141414] rounded-none' : 'bg-white border-slate-100 rounded-2xl'
              }`}
            >
              <div className={`px-6 py-4 border-b flex justify-between items-center ${
                theme === 'high-density' ? 'bg-[#141414] text-white border-b-2 border-black' : 'bg-indigo-50 border-b border-indigo-100 text-indigo-900'
              }`}>
                <div className="flex items-center gap-2">
                  <Lock size={16} className={theme === 'high-density' ? 'text-yellow-400' : 'text-indigo-600'} />
                  <h3 className="text-xs font-black uppercase tracking-widest">수정 권한 확인</h3>
                </div>
                <button onClick={() => setIsPasswordModalOpen(false)} className="hover:rotate-90 transition-transform">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    theme === 'high-density' ? 'bg-black text-yellow-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <KeySquare size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">여기는 '내역분리 완료' 보호구역입니다.</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    공정이 완료 마감처리된 현장입니다. 수동 수정을 허용하고 편집하시려면 관리자 비밀번호를 입력하십시오.
                  </p>
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-2">관리자 비밀번호 (Admin Password)</label>
                  <input
                    autoFocus
                    type="password"
                    maxLength={4}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                    placeholder="숫자 4자리를 입력하세요"
                    className={`w-full text-center tracking-widest text-lg font-black py-2.5 border focus:ring-0 outline-none transition-all text-slate-900 ${
                      theme === 'high-density' ? 'border-[#141414] rounded-none focus:bg-[#dfddd6]' : 'border-slate-200 rounded-xl focus:border-indigo-500'
                    }`}
                  />
                  <p className="mt-2 text-[9px] text-zinc-400 text-center font-mono">가이드: 비밀번호는 '4714' 입니다.</p>
                </div>
              </div>
              <div className="px-6 py-4 flex gap-2 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                    theme === 'high-density' ? 'border-[#141414] hover:bg-slate-200 text-[#141414] bg-[#E7E6E1]' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                  }`}
                >
                  취소(닫기)
                </button>
                <button
                  type="button"
                  onClick={handleVerifyPassword}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white ${
                    theme === 'high-density' ? 'bg-[#141414] hover:bg-black' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100'
                  }`}
                >
                  잠금 해제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Recovery Modal */}
      <AnimatePresence>
        {isRecoveryModalOpen && pendingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full border border-slate-200"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">이어서 작업하시겠습니까?</h3>
                <p className="text-slate-500 text-sm mb-6">
                  마지막으로 작업하던 <span className="font-bold text-slate-700">{pendingSession.items.length}개</span>의 내역 데이터가 남아있습니다.<br/>
                  <span className="text-xs opacity-75">저장 시각: {new Date(pendingSession.timestamp).toLocaleString()}</span>
                </p>
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={restoreSession}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                  >
                    이전 작업 복구하기
                  </button>
                  <button
                    onClick={discardSession}
                    className="w-full py-3 bg-white text-slate-500 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    새로 시작하기
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Local Session Recovery System v1.0</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Classification Loading Overlay */}
      <AnimatePresence>
        {isClassifying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center backdrop-blur-md bg-slate-900/60"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center text-center"
            >
              <div className="relative w-24 h-24 mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={251.2}
                    animate={{ strokeDashoffset: 251.2 * (1 - classifyProgress / 100) }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-indigo-600"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-xl text-slate-800">
                  {classifyProgress}%
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">AI 공정 분류 중</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Gemini AI가 내역서 항목을 분석하여<br/>
                최적의 카테고리로 자동 분류하고 있습니다.
              </p>
              
              <div className="w-full flex items-center gap-2 justify-center py-2 bg-slate-50 rounded-xl">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-600"
                    />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Processing Data</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Share Project Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60"
            onClick={() => setIsShareModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden relative ${
                theme === 'industrial' ? 'bg-slate-900 border-slate-800 text-slate-100' :
                theme === 'high-density' ? 'bg-[#F4F4F2] border-[#141414] text-[#141414]' :
                'bg-white border-slate-200 text-slate-800'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`p-6 pb-4 border-b flex items-center justify-between ${
                theme === 'industrial' ? 'border-slate-800' :
                theme === 'high-density' ? 'border-[#141414] bg-[#EBEAE8]' :
                'border-slate-100 bg-slate-50'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    theme === 'industrial' ? 'bg-amber-500/10 text-amber-500' :
                    theme === 'high-density' ? 'bg-[#141414] text-white' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    <Share2 size={20} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg leading-tight ${theme === 'high-density' ? 'font-sans uppercase text-xs tracking-wider' : 'font-sans'}`}>
                      {theme === 'high-density' ? 'Project Share Link' : '프로젝트 공유하기'}
                    </h3>
                    <p className={`text-xs mt-0.5 ${theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {currentProjectName ? `'${currentProjectName}' 현장 공유` : '작업 중인 현장 공유'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    theme === 'industrial' ? 'hover:bg-slate-800 text-slate-400' :
                    theme === 'high-density' ? 'hover:bg-black/10 text-[#141414]' :
                    'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <p className={`text-sm leading-relaxed ${theme === 'industrial' ? 'text-slate-300' : 'text-slate-600'}`}>
                  현재 분석 중인 <strong>현장 공정 분류 정보, 자재 명세 목록({items.length}개) 및 사용자 지정 카테고리</strong>가 포함된 압축 공유 링크입니다. 상대방이 이 링크를 열면 실시간으로 동일한 전체 작업본을 즉시 이식받을 수 있습니다.
                </p>

                <div className="space-y-2">
                  <label className={`text-xs font-bold uppercase tracking-wider block ${
                    theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    공유용 압축 URL
                  </label>
                  <div className={`flex gap-2 p-2 border rounded-xl items-center ${
                    theme === 'industrial' ? 'border-slate-800 bg-slate-950' :
                    theme === 'high-density' ? 'border-[#141414] bg-white text-xs' :
                    'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className={`flex-grow bg-transparent border-none text-xs outline-none focus:ring-0 ${
                        theme === 'industrial' ? 'text-slate-300' : 'text-slate-600'
                      }`}
                      onClick={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.select();
                      }}
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-w-[70px] justify-center ${
                        copied
                          ? 'bg-green-600 text-white'
                          : theme === 'industrial' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' :
                            theme === 'high-density' ? 'bg-[#141414] text-white hover:opacity-90' :
                            'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check size={12} />
                          <span>복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>복사</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className={`p-4 rounded-xl flex items-center justify-between border ${
                  theme === 'industrial' ? 'bg-slate-950/40 border-slate-800/80' :
                  theme === 'high-density' ? 'border-[#141414]/30 bg-[#EBEAE8]' :
                  'bg-indigo-50/40 border-indigo-100/60'
                }`}>
                  <div className="space-y-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                      theme === 'industrial' ? 'text-slate-400' : 'text-slate-400'
                    }`}>
                      Payload Summary
                    </span>
                    <span className="font-mono text-xs font-semibold">
                      Gzip Compressed Payload State
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-indigo-600 font-mono">
                      {Math.ceil(shareUrl.length / 1024)} KB
                    </div>
                    <div className={`text-[9px] font-mono font-medium ${theme === 'industrial' ? 'text-slate-500' : 'text-slate-400'}`}>
                      URL Safe Base64
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`p-4 border-t flex justify-end gap-2 ${
                theme === 'industrial' ? 'border-slate-800' :
                theme === 'high-density' ? 'border-[#141414] bg-[#EBEAE8]' :
                'border-slate-100 bg-slate-50'
              }`}>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                    theme === 'industrial' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' :
                    theme === 'high-density' ? 'border border-[#141414] hover:bg-black/5 text-[#141414]' :
                    'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm'
                  }`}
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Save Naming Modal */}
      <AnimatePresence>
        {isManualSaveNamingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`w-full max-w-sm overflow-hidden shadow-2xl relative ${
                theme === 'high-density' ? 'bg-white border-2 border-[#141414]' : 'bg-white rounded-2xl border border-slate-100'
              }`}
            >
              <div className={`px-6 py-4 border-b flex justify-between items-center ${
                theme === 'high-density' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Save size={16} />
                  <h3 className="text-sm font-bold uppercase tracking-tight">새 현장 수동 저장</h3>
                </div>
                <button onClick={() => setIsManualSaveNamingOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                  신규 현장 프로젝트명 (Site Name)
                </label>
                <input
                  autoFocus
                  type="text"
                  value={manualSaveName}
                  onChange={(e) => setManualSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmManualSave()}
                  placeholder="예: 마포 웰스트림 아파트 기계설비공사"
                  className={`w-full px-4 py-3 text-sm font-bold border focus:ring-0 outline-none transition-all text-slate-900 ${
                    theme === 'high-density' ? 'border-[#141414] rounded-none focus:bg-yellow-50' : 'border-slate-200 rounded-xl focus:border-indigo-500'
                  }`}
                />
                <p className="mt-3 text-[10px] text-slate-500 leading-normal">
                  현재 분석 및 가공된 내역 품목 정보가 이 현장명으로 안전하게 영구 저장됩니다. 향후 '현장 보관함'에서 언제든 다시 불러올 수 있습니다.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-2 border-t border-slate-50 bg-slate-50/50">
                <button
                  onClick={() => setIsManualSaveNamingOpen(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                    theme === 'high-density' ? 'border-[#141414] hover:bg-slate-100 text-black' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmManualSave}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white transition-opacity ${
                    theme === 'high-density' ? 'bg-[#141414] hover:bg-black' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-100'
                  }`}
                >
                  저장 및 동기화
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-0 left-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
              notification.type === 'success' ? 'bg-green-500/90 text-white border-green-400' :
              notification.type === 'error' ? 'bg-red-500/90 text-white border-red-400' :
              'bg-blue-500/90 text-white border-blue-400'
            }`}
          >
            {notification.type === 'success' && (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Project Sites & Navigation Sidebar */}
      <SiteListSidebar 
        projects={projects}
        currentProjectName={currentProjectName}
        theme={theme}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isProjectLocked={isProjectLocked}
        cloudSyncStatus={cloudSyncStatus}
        lastCloudSyncedTime={lastCloudSyncedTime}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLoadProject={(proj) => {
          handleLoadProject(proj);
          setIsMobileSidebarOpen(false);
        }}
        onDeleteProject={handleDeleteProject}
        onAddNewProject={handleAddNewProject}
        onNewProject={() => {
          handleNewProject();
          setIsMobileSidebarOpen(false);
        }}
        onOpenCategoryManager={(tab) => {
          setCategoryManagerTab(tab);
          setIsCategoryManagerOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        onResetTheme={() => setTheme(null)}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      {/* Main Content Area */}
      <main className={`lg:ml-72 xl:ml-80 min-h-screen flex flex-col ${theme === 'high-density' ? 'bg-white' : ''} w-full lg:w-[calc(100%-18rem)] xl:w-[calc(100%-20rem)]`}>
        {/* Mobile Navigation (Visible only when sidebar is hidden on small screens) */}
        <div className="lg:hidden flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 sticky top-0 z-40">
          <button 
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs"
          >
            <Menu size={16} />
            <span>현장 목록</span>
            {projects.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px]">
                {projects.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'list' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
            >
              <FileSpreadsheet size={15} />
              <span>내역서</span>
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analysis' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
            >
              <BarChart3 size={15} />
              <span>단가분석</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {renderHeader()}

        <div className={theme === 'high-density' ? 'flex-grow flex flex-col overflow-hidden' : 'p-6 lg:p-10'}>
          <AnimatePresence mode="wait">
            <motion.div
              layout
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-grow flex flex-col"
            >
              {activeTab === 'list' ? (
                <>
                  <Dashboard 
                    items={items} 
                    theme={theme} 
                    onOpenSectionSummary={() => setIsSectionSummaryOpen(true)} 
                  />
                  <CategorySummaryCards 
                    items={items} 
                    theme={theme} 
                    categories={INITIAL_CATEGORIES}
                    onCategoryClick={(cat) => setCategoryFilter(cat)}
                    onUpdateSafetyAmount={handleUpdateSafetyAmount}
                  />
                  {isSectionSummaryOpen && (
                    <SectionSummaryCards 
                      items={items} 
                      theme={theme} 
                      onClose={() => setIsSectionSummaryOpen(false)} 
                    />
                  )}
                  <DataTable 
                    items={items} 
                    theme={theme} 
                    categories={categories}
                    workbook={workbook}
                    onClassify={handleClassify}
                    isClassifying={isClassifying}
                    onUpdateCategory={handleUpdateCategory}
                    onRevertCategory={handleRevertCategory}
                    onUpdateCategories={handleUpdateCategories}
                    onUpdateMemo={handleUpdateMemo}
                    onDataLoaded={handleDataLoaded}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={setCategoryFilter}
                  />
                </>
              ) : (
                <PriceAnalysis items={items} theme={theme} />
              )}

              <CategoryManager 
                isOpen={isCategoryManagerOpen}
                onClose={() => setIsCategoryManagerOpen(false)}
                categories={categories}
                onUpdate={setCategories}
                customRules={customClassificationRules}
                onUpdateRules={setCustomClassificationRules}
                onApplyRules={handleApplyRules}
                initialTab={categoryManagerTab}
              />

              <SettingsManager 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                onThemeChange={setTheme}
                fontFamily={fontFamily}
                onFontFamilyChange={setFontFamily}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                onResetData={() => {
                  setItems(SAMPLE_ITEMS);
                  showNotification('데이터가 초기 샘플로 복구되었습니다.', 'info');
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, theme, subtitle, onClick }: { icon: React.ReactNode, label: string, active?: boolean, theme: ThemeType, subtitle?: string, onClick?: () => void }) {
  if (theme === 'high-density') {
    return (
      <button 
        onClick={onClick}
        className={`w-full p-3 border-b border-[#141414] text-left transition-all ${
        active ? 'bg-white' : 'opacity-70 hover:bg-white/50'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-xs flex items-center gap-2">
            {icon}
            {label}
          </span>
          {active && <span className="text-[10px] bg-blue-100 text-blue-800 px-1 border border-blue-200">선택됨</span>}
        </div>
        {subtitle && <p className="text-[11px] opacity-60 leading-tight italic">{subtitle}</p>}
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}>
      {icon}
      {label}
    </button>
  );
}
