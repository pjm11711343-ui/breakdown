/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SpecItem, ThemeType, Project } from './types';
import { autoClassify } from './utils/classifier';
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
import { Settings, FileSpreadsheet, LogOut, ChevronRight, Tags, BarChart3, Download, Share2, Copy, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import * as XLSX from 'xlsx';
import LZString from 'lz-string';

const INITIAL_CATEGORIES = [
  '백강관', '강관부속', 'STS위생관', 'STS위생부속', 'STS난방관', 'STS난방부속', 
  '고강도PVC', 'PVC', 'PB', '냉매배관', '난방코일', '난방분배기', 
  '밸브류', '수도계량기', '감압변', '스리브', '내화충진재', '고정틀', 
  '조립식가대', 'SUPPORT류', '마감자재', '통합거치대', '보온재', '소모잡자재', 
  '공구손료', '안전장비류', '가설공사', '명판', '휀장비류', '기타자재',
  '지금자재', '외주'
];

const STORAGE_KEY = 'mechauto_session_data';

const SAMPLE_ITEMS: SpecItem[] = [
  // 옥외배관공사
  { id: 'bw-1', name: 'STS 유니온 (나사)', specification: 'D 40', unit: 'EA', quantity: 1, materialUnitPrice: 14010, materialAmount: 14010, laborUnitPrice: 0, laborAmount: 0, unitPrice: 14010, amount: 14010, category: 'STS위생부속', section: '010102 옥외배관공사', remark: '' },
  { id: 'bw-2', name: 'STS 니플 (나사)', specification: 'D 40', unit: 'EA', quantity: 3, materialUnitPrice: 0, materialAmount: 0, laborUnitPrice: 0, laborAmount: 0, unitPrice: 0, amount: 0, category: '지금자재', section: '010102 옥외배관공사', remark: '지급자재' },
  { id: 'bw-3', name: 'STS 후렌지접합', specification: 'D 40', unit: '개소', quantity: 1, materialUnitPrice: 0, materialAmount: 0, laborUnitPrice: 22620, laborAmount: 22620, unitPrice: 22620, amount: 22620, category: 'STS위생부속', section: '010102 옥외배관공사', remark: '' },
  
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

function minifyState(items: SpecItem[], theme: string | null, categories: string[], projectName: string) {
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
  const [items, setItems] = useState<SpecItem[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSectionSummaryOpen, setIsSectionSummaryOpen] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState(0);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  // Project Management State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  
  // Share Project State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Session Recovery State
  const [pendingSession, setPendingSession] = useState<{ items: SpecItem[], theme: ThemeType, timestamp: number } | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  // Check for existing session and projects on mount
  useEffect(() => {
    // Load Projects
    const savedProjects = localStorage.getItem(PROJECTS_KEY);
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error('Failed to parse projects', e);
      }
    }

    // Check Shared link
    const checkSharedLink = async () => {
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
            // strip leading hatch if needed
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
          // 100% robust clean-up and URL-decoding
          try {
            shareDataStr = decodeURIComponent(shareDataStr).trim();
          } catch (e) {
            console.warn("Failed to decodeURIComponent shareDataStr", e);
          }

          // Clear URL share parameter
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
              
              // Clear pending session to prevent recovery popup if successfully loaded shared config
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

    const runInitCheck = async () => {
      const loadedShare = await checkSharedLink();
      
      // Load Last Session if share wasn't loaded
      if (!loadedShare) {
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
    };

    runInitCheck();
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (items.length > 0 && theme) {
      const sessionData = {
        items,
        theme,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    }
  }, [items, theme]);

  const handleShareProject = async () => {
    if (items.length === 0) {
      showNotification('공유할 데이터가 없습니다. 먼저 내역을 가져오거나 파일을 로드해주세요.', 'error');
      return;
    }
    try {
      showNotification('공유 링크 생성 중...', 'info');
      const minState = minifyState(items, theme, categories, currentProjectName);
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

  const handleSaveProject = (name: string) => {
    if (!theme) {
      showNotification('테마를 먼저 선택해야 저장할 수 있습니다.', 'error');
      return;
    }

    try {
      const existingId = projects.find(p => p.name === name)?.id;
      const newProject: Project = {
        id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        name,
        items,
        theme: theme,
        categories,
        updatedAt: Date.now()
      };

      setProjects(prev => {
        const updated = prev.some(p => p.name === name)
          ? prev.map(p => p.name === name ? newProject : p)
          : [...prev, newProject];
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        return updated;
      });

      setCurrentProjectName(name);
      showNotification(`현장 '${name}' 정보가 성공적으로 저장되었습니다.`, 'success');
    } catch (e) {
      console.error('Failed to save project', e);
      showNotification('저장 중 오류가 발생했습니다. 저장공간이 부족할 수 있습니다.', 'error');
    }
  };

  const handleLoadProject = (project: Project) => {
    try {
      setItems(project.items || []);
      setTheme(project.theme);
      setCategories(project.categories || INITIAL_CATEGORIES);
      setCurrentProjectName(project.name);
      showNotification(`현장 '${project.name}' 데이터를 불러왔습니다.`, 'info');
    } catch (e) {
      showNotification('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteProject = (id: string) => {
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
      showNotification(`현장 '${projectToDelete.name}' 프로젝트가 삭제되었습니다.`, 'info');
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
    showNotification('새로운 현장 작업 공간이 준비되었습니다.', 'info');
  };

  const restoreSession = () => {
    if (pendingSession) {
      setItems(pendingSession.items);
      setTheme(pendingSession.theme);
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
            categories
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
  };

  const handleUpdateCategory = (id: string, newCategory: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, category: newCategory, remark: newCategory } : item
    ));
  };

  const handleRevertCategory = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id && item.originalCategory 
        ? { ...item, category: item.originalCategory, remark: item.originalCategory } 
        : item
    ));
    showNotification('품목 분류가 원래 상태로 복구되었습니다.', 'info');
  };

  const handleUpdateCategories = (ids: string[], newCategory: string) => {
    setItems(prev => prev.map(item => 
      ids.includes(item.id) ? { ...item, category: newCategory, remark: newCategory } : item
    ));
    showNotification(`${ids.length}개 항목의 카테고리가 '${newCategory}'(으)로 변경되었습니다.`, 'success');
  };

  const handleUpdateMemo = (id: string, newMemo: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, memo: newMemo } : item
    ));
  };

  const handleDataLoaded = (newItems: SpecItem[], wb: XLSX.WorkBook) => {
    // Apply automatic classification based on rules immediately upon upload
    const classifiedItems = newItems.map(item => {
      const { category, remark } = autoClassify(item);
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

  const handleDownloadResults = () => {
    if (items.length === 0) {
      showNotification('다운로드할 데이터가 없습니다.', 'error');
      return;
    }

    try {
      // Prepare data for Excel
      const exportData = items.map(item => ({
        '현장/공종': item.section,
        '품명': item.name,
        '규격': item.specification || item.spec,
        '단위': item.unit,
        '수량': item.quantity,
        '메모': item.memo || '',
        '비고': item.remark,
        '분류': item.category
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "분류결과");

      // Set column widths
      ws['!cols'] = [
        { wch: 30 }, // 현장/공종
        { wch: 40 }, // 품명
        { wch: 30 }, // 규격
        { wch: 10 }, // 단위
        { wch: 10 }, // 수량
        { wch: 25 }, // 메모
        { wch: 25 }, // 비고
        { wch: 15 }, // 분류
      ];

      // Add custom styles to the newly created worksheet if we are doing direct JSON export
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellAddress];
          if (!cell) continue;

          // Initialize cell style object
          cell.s = {
            font: { name: '맑은 고딕', sz: 10 },
            border: {
              top: { style: 'thin', color: { rgb: 'DDE3EA' } },
              bottom: { style: 'thin', color: { rgb: 'DDE3EA' } },
              left: { style: 'thin', color: { rgb: 'DDE3EA' } },
              right: { style: 'thin', color: { rgb: 'DDE3EA' } }
            },
            alignment: { vertical: 'center' }
          };

          if (r === 0) {
            // Header row formatting - Premium styling!
            cell.s.font = { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: 'FFFFFF' } };
            cell.s.fill = { fgColor: { rgb: '2B3E50' } }; // Dark slate/denim blue
            cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            cell.s.border = {
              top: { style: 'medium', color: { rgb: '1A252F' } },
              bottom: { style: 'medium', color: { rgb: '1A252F' } },
              left: { style: 'thin', color: { rgb: '4E6174' } },
              right: { style: 'thin', color: { rgb: '4E6174' } }
            };
          } else {
            // Data row alternating backgrounds (zebra striping)
            if (r % 2 === 0) {
              cell.s.fill = { fgColor: { rgb: 'F9FBFD' } }; // Soft baby blue/slate tint
            }
            
            // Text alignment styles based on the column purpose
            if (c === 0 || c === 3 || c === 6) { // '현장/공종', '단위', '분류' 
              cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            } else if (c === 4) { // '수량'
              cell.s.alignment = { horizontal: 'right', vertical: 'center' };
              cell.z = '#,##0'; // format string
            } else { // '품명', '규격', '비고'
              cell.s.alignment = { horizontal: 'left', vertical: 'center' };
            }
          }
        }
      }

      // Download file
      const fileName = currentProjectName 
        ? `분류결과_${currentProjectName}_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `분류결과_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      XLSX.writeFile(wb, fileName, {
        cellStyles: true,
        cellNF: true,
        bookSST: false,
        sheetStubs: true
      } as any);
      showNotification('결과 파일이 다운로드되었습니다.', 'success');
    } catch (e) {
      console.error('Export failed', e);
      showNotification('파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const renderHeader = () => {
    if (theme === 'high-density') {
      return (
        <header className="flex items-center justify-between px-6 py-3 bg-[#141414] text-white">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center font-bold text-lg rounded-sm">M</div>
            <h1 className="text-sm font-semibold tracking-widest uppercase truncate max-w-[300px]">기계설비 공정분리 툴 v4.0</h1>
            
            <div className="h-6 w-px bg-white/20 mx-2" />
            
            <ProjectSiteManager 
              projects={projects}
              currentProjectName={currentProjectName}
              theme={theme}
              onSave={handleSaveProject}
              onLoad={handleLoadProject}
              onDelete={handleDeleteProject}
              onNew={handleNewProject}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="text-[11px] opacity-60 font-mono">가동 상태: 정상</div>
            <div className="flex gap-2 items-center">
              {items.length > 0 && (
                <>
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
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <span>데이터 관리</span>
            <ChevronRight size={14} />
            <span className="text-indigo-500 font-medium font-mono uppercase tracking-wider">{theme || '신규'} 테마</span>
            <ChevronRight size={14} />
            <div className="ml-2">
              <ProjectSiteManager 
                projects={projects}
                currentProjectName={currentProjectName}
                theme={theme}
                onSave={handleSaveProject}
                onLoad={handleLoadProject}
                onDelete={handleDeleteProject}
                onNew={handleNewProject}
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">기계설비 공정 분석 마스터</h1>
        </div>
        
        {theme && (
          <div className="flex items-center gap-3">
             {items.length > 0 && (
               <>
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

      {/* Sidebar Navigation */}
      <aside className={`fixed left-0 top-0 h-full w-64 border-r hidden lg:flex flex-col z-20 ${
        theme === 'industrial' ? 'bg-slate-900 border-slate-800' : 
        theme === 'high-density' ? 'bg-[#EBEAE8] border-[#141414]' :
        'bg-white border-slate-200 shadow-sm'
      }`}>
        {theme === 'high-density' ? (
          <div className="bg-[#141414] p-4 text-white">
             <span className="text-[10px] uppercase font-bold tracking-widest">레이아웃 및 시스템 구성</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-10 px-6 pt-10">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">MechAuto</span>
          </div>
        )}

        <nav className={`flex-grow space-y-0 ${theme === 'high-density' ? '' : 'px-6 space-y-1'}`}>
          <NavItem 
            icon={<FileSpreadsheet size={theme === 'high-density' ? 14 : 20} />} 
            label="계약 내역서" 
            active={activeTab === 'list'} 
            onClick={() => setActiveTab('list')}
            theme={theme}
            subtitle={theme === 'high-density' ? '품명/규격 중심 표준 입찰 양식' : undefined}
          />
          <NavItem 
            icon={<BarChart3 size={theme === 'high-density' ? 14 : 20} />} 
            label="단가 분석 뷰" 
            active={activeTab === 'analysis'} 
            onClick={() => setActiveTab('analysis')}
            theme={theme}
            subtitle={theme === 'high-density' ? '품목별 단가 편차 및 이상 징후 분석' : undefined}
          />
          <NavItem 
            icon={<Settings size={theme === 'high-density' ? 14 : 20} />} 
            label="시스템 설정" 
            theme={theme}
            onClick={() => setIsSettingsOpen(true)}
            subtitle={theme === 'high-density' ? 'AI 로직 및 환경 변수 설정' : undefined}
          />
          <button 
            onClick={() => setIsCategoryManagerOpen(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
              theme === 'high-density' 
                ? 'p-3 border-b border-[#141414] text-left opacity-70 hover:bg-white/50' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl font-medium text-sm'
            }`}
          >
            <Tags size={theme === 'high-density' ? 14 : 20} />
            <span>카테고리 관리</span>
          </button>
        </nav>

        <div className={theme === 'high-density' ? 'p-4 border-t border-[#141414]' : 'px-6 pb-10'}>
          <button 
            onClick={() => setTheme(null)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
              theme === 'high-density' 
                ? 'bg-[#141414] text-white text-[10px] font-bold uppercase justify-center' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl'
            }`}
          >
            <LogOut size={theme === 'high-density' ? 12 : 20} />
            <span className={theme === 'high-density' ? 'tracking-widest' : 'font-medium text-sm'}>양식 다시 선택</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`lg:ml-64 min-h-screen flex flex-col ${theme === 'high-density' ? 'bg-white' : ''} w-full`}>
        {/* Mobile Navigation (Visible only when sidebar is hidden) */}
        <div className="lg:hidden flex items-center justify-around p-2 bg-white border-b border-slate-200 sticky top-0 z-40">
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'list' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
          >
            <FileSpreadsheet size={20} />
            <span className="text-[10px] font-bold">내역서</span>
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'analysis' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
          >
            <BarChart3 size={20} />
            <span className="text-[10px] font-bold">분석</span>
          </button>
          <button 
            onClick={() => setIsCategoryManagerOpen(true)}
            className="flex flex-col items-center gap-1 p-2 text-slate-400"
          >
            <Tags size={20} />
            <span className="text-[10px] font-bold">카테고리</span>
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center gap-1 p-2 text-slate-400"
          >
            <Settings size={20} />
            <span className="text-[10px] font-bold">설정</span>
          </button>
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
              />

              <SettingsManager 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                onThemeChange={setTheme}
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
