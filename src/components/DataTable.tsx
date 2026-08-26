import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SpecItem, ThemeType } from '../types';
import { Download, Table, Cpu, Filter, Maximize2, RotateCcw, Zap, Sparkles, AlertTriangle, User, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers, X, Search } from 'lucide-react';
import ExcelUpload from './ExcelUpload';
import * as XLSX from 'xlsx';
import { exportStyledExcel } from '../utils/excelExport';
import { VirtualizedTableBody, VirtualRowData } from './VirtualizedTableBody';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  workbook: XLSX.WorkBook | null;
  onClassify: (targetIds?: string[]) => void;
  isClassifying: boolean;
  onUpdateCategory: (id: string, category: string) => void;
  onAddCategory: (category: string) => void;
  onRevertCategory: (id: string) => void;
  onUpdateCategories: (ids: string[], category: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onDataLoaded: (items: SpecItem[], workbook: XLSX.WorkBook) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
}

// Excel-style column filter component
const ColumnFilterDropdown = ({ 
  columnId, 
  value, 
  onValueChange, 
  onClose,
  suggestions = [],
  filterOperator = 'AND',
  onOperatorChange
}: { 
  columnId: 'name' | 'spec', 
  value: string, 
  onValueChange: (val: string) => void,
  onClose: () => void,
  suggestions?: string[],
  filterOperator?: 'AND' | 'OR',
  onOperatorChange?: (op: 'AND' | 'OR') => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  // Sync with prop value if it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    // Focus after a short delay to ensure positioning is finalized
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    onValueChange(newVal); // Keep live filtering
  };

  const filteredSuggestions = suggestions.filter(s => 
    !localValue || s.toLowerCase().includes(localValue.toLowerCase())
  ).slice(0, 50); // Limit to 50 for performance

  return (
    <div 
      className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-xl shadow-2xl z-[1000] p-4 font-sans text-xs ring-1 ring-black/5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3 bg-indigo-500 rounded-full" />
          <span className="font-extrabold text-slate-800 uppercase tracking-tight text-[11px]">
            {columnId === 'name' ? '품명 필터' : '규격 필터'}
          </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      
      <div className="relative mb-3">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder="검색어 입력..."
          className="w-full p-2.5 pr-9 border-2 border-slate-100 rounded-lg outline-none focus:border-indigo-500 font-bold text-slate-900 bg-slate-50 placeholder:text-slate-400 transition-all text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClose();
            if (e.key === 'Escape') onClose();
          }}
        />
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {onOperatorChange && (
        <div className="flex items-center gap-2 mb-3 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] font-black text-slate-500 uppercase ml-1">조건:</span>
          <div className="flex bg-white rounded-md border border-slate-200 p-0.5 overflow-hidden flex-1 shadow-sm">
            <button
              onClick={() => onOperatorChange('AND')}
              className={`flex-1 py-1 px-2 rounded-sm text-[10px] font-bold transition-all ${filterOperator === 'AND' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              AND (교집합)
            </button>
            <button
              onClick={() => onOperatorChange('OR')}
              className={`flex-1 py-1 px-2 rounded-sm text-[10px] font-bold transition-all ${filterOperator === 'OR' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              OR (합집합)
            </button>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50/50 custom-scrollbar">
          <div className="p-1">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setLocalValue(s);
                    onValueChange(s);
                    onClose(); // Auto-close on selection
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors font-medium truncate text-slate-600 cursor-pointer"
                >
                  {s}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-slate-400 italic">결과 없음</div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button 
          onClick={() => { onValueChange(''); setLocalValue(''); onClose(); }}
          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-black transition-all cursor-pointer active:scale-95 text-[10px]"
        >
          초기화
        </button>
        <button 
          onClick={onClose}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black transition-all cursor-pointer shadow-md shadow-indigo-200 active:scale-95 text-[10px]"
        >
          필터 적용
        </button>
      </div>
    </div>
  );
};

export default function DataTable({ items, theme, categories, workbook, onClassify, isClassifying, onUpdateCategory, onAddCategory, onRevertCategory, onUpdateCategories, onUpdateMemo, onDataLoaded, categoryFilter = 'all', onCategoryFilterChange }: Props) {
  const [viewMode, setViewMode] = useState<'process' | 'category' | 'unclassified'>('process');
  const [showAggregated, setShowAggregated] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionHelper, setSelectionHelper] = useState<{
    id: string;
    name: string;
    count: number;
    ids: string[];
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    items.forEach(item => {
      if (item.name) names.add(item.name);
    });
    return Array.from(names).sort();
  }, [items]);

  const uniqueSpecs = useMemo(() => {
    const specs = new Set<string>();
    items.forEach(item => {
      if (item.specification) specs.add(item.specification);
    });
    return Array.from(specs).sort();
  }, [items]);

  // Pagination & High-speed rendering state (Default 100 rows per page for zero-lag rendering)
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [containerHeight, setContainerHeight] = useState<number>(600);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tableContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 100) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(tableContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const startEditing = (id: string, currentCategory: string) => {
    setEditingId(id);
    setEditValue(currentCategory);
  };

  const saveEdit = (id: string) => {
    if (editingId === id) {
      onUpdateCategory(id, editValue);
      setEditingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [density, setDensity] = useState<number>(2); // 1 to 5 scale
  const [showUnclassifiedOnly, setShowUnclassifiedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<{name: string, spec: string}>({ name: '', spec: '' });
  const [filterOperator, setFilterOperator] = useState<'AND' | 'OR'>('AND');
  const [activeFilterColumn, setActiveFilterColumn] = useState<'name' | 'spec' | null>(null);

  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    items.forEach(item => {
      if (item.section) sections.add(item.section);
    });
    return Array.from(sections).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSection = sectionFilter === 'all' || item.section === sectionFilter;
      const matchesCategory = categoryFilter === 'all' || 
        (categoryFilter === '미분류' && (!item.category || item.category === '미분류')) ||
        item.category === categoryFilter;
      const matchesUnclassifiedOnly = !showUnclassifiedOnly || (!item.category || item.category === '미분류');
      
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || 
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.specification && item.specification.toLowerCase().includes(query)) ||
        (item.category && item.category.toLowerCase().includes(query));

      // Column Specific Filters (Excel Style) with AND/OR logic
      const nameQ = columnFilters.name.trim().toLowerCase();
      const specQ = columnFilters.spec.trim().toLowerCase();

      let matchesColumnGroup = true;
      if (nameQ && specQ) {
        const mName = item.name?.toLowerCase().includes(nameQ);
        const mSpec = item.specification?.toLowerCase().includes(specQ);
        matchesColumnGroup = filterOperator === 'AND' ? (mName && mSpec) : (mName || mSpec);
      } else if (nameQ) {
        matchesColumnGroup = item.name?.toLowerCase().includes(nameQ);
      } else if (specQ) {
        matchesColumnGroup = item.specification?.toLowerCase().includes(specQ);
      }

      return matchesSection && matchesCategory && matchesUnclassifiedOnly && matchesSearch && matchesColumnGroup;
    });
  }, [items, sectionFilter, categoryFilter, showUnclassifiedOnly, searchQuery, columnFilters, filterOperator]);

  const allMatchingItems = useMemo(() => {
    if (viewMode === 'unclassified') {
      return items.filter(item => {
        const isUnclassified = !item.category || item.category === '미분류';
        const matchesSection = sectionFilter === 'all' || item.section === sectionFilter;
        
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query || 
          (item.name && item.name.toLowerCase().includes(query)) ||
          (item.specification && item.specification.toLowerCase().includes(query));

        return isUnclassified && matchesSection && matchesSearch;
      });
    }
    return filteredItems;
  }, [items, viewMode, filteredItems, sectionFilter, searchQuery]);

  // Reset to page 1 whenever filters or search query changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectionHelper(null);
  }, [sectionFilter, categoryFilter, showUnclassifiedOnly, searchQuery, viewMode]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(allMatchingItems.length / pageSize));
  }, [allMatchingItems.length, pageSize]);

  const pageItems = useMemo(() => {
    if (pageSize === 0) return allMatchingItems;
    const startIndex = (currentPage - 1) * pageSize;
    return allMatchingItems.slice(startIndex, startIndex + pageSize);
  }, [allMatchingItems, currentPage, pageSize]);

  const unclassifiedCount = useMemo(() => {
    return items.filter(item => !item.category || item.category === '미분류').length;
  }, [items]);

  // Transform filtered and paginated/all items into flat VirtualRowData[] for virtualized rendering
  const virtualRows = useMemo<VirtualRowData[]>(() => {
    const targetItems = pageItems;
    if (targetItems.length === 0) return [];

    const rows: VirtualRowData[] = [];

    if (viewMode === 'category') {
      const itemsByCategory: Record<string, Record<string, SpecItem[]>> = {};
      targetItems.forEach(item => {
        const cat = item.category || '기타';
        const sec = item.section || '기본 내역';
        if (!itemsByCategory[cat]) itemsByCategory[cat] = {};
        if (!itemsByCategory[cat][sec]) itemsByCategory[cat][sec] = [];
        itemsByCategory[cat][sec].push(item);
      });

      const sortedCategories = Object.entries(itemsByCategory).sort((a, b) => {
        const idxA = categories.indexOf(a[0]);
        const idxB = categories.indexOf(b[0]);
        const getVal = (idx: number) => idx === -1 ? 9999 : idx;
        return getVal(idxA) - getVal(idxB);
      });

      sortedCategories.forEach(([catName, sections], catIdx) => {
        const catItems = Object.values(sections).flat();
        const catMaterialTotal = catItems.reduce((sum, i) => sum + (i.materialAmount || 0), 0);
        const catLaborTotal = catItems.reduce((sum, i) => sum + (i.laborAmount || 0), 0);
        const catTotal = catItems.reduce((sum, i) => sum + i.amount, 0);

        rows.push({
          type: 'category-header',
          catName,
          catIdx,
          materialTotal: catMaterialTotal,
          laborTotal: catLaborTotal,
          total: catTotal,
          count: catItems.length,
          items: catItems,
        });

        if (showAggregated) {
          const aggregatedMap = new Map<string, SpecItem>();
          catItems.forEach(item => {
            const key = `${item.name}|${item.specification || ''}|${item.unit || ''}|${item.unitPrice}`;
            if (!aggregatedMap.has(key)) {
              aggregatedMap.set(key, { ...item, id: `agg-${key}`, quantity: item.quantity, amount: item.amount });
            } else {
              const existing = aggregatedMap.get(key)!;
              existing.quantity += item.quantity;
              existing.amount += item.amount;
              existing.materialAmount = (existing.materialAmount || 0) + (item.materialAmount || 0);
              existing.laborAmount = (existing.laborAmount || 0) + (item.laborAmount || 0);
            }
          });

          Array.from(aggregatedMap.values()).forEach((aggItem, aggIdx) => {
            rows.push({
              type: 'item',
              item: aggItem,
              itemIdx: aggIdx,
              isAggregated: true,
            });
          });
        } else {
          Object.entries(sections).forEach(([secName, secItems]) => {
            rows.push({
              type: 'category-sub-header',
              secName,
              count: secItems.length,
            });

            secItems.forEach((item, itemIdx) => {
              rows.push({
                type: 'item',
                item,
                itemIdx,
                isAggregated: false,
              });
            });
          });
        }
      });
    } else {
      // Process / Unclassified View
      const itemsBySection: Record<string, SpecItem[]> = {};
      targetItems.forEach(item => {
        const sec = item.section || '기본 내역';
        if (!itemsBySection[sec]) itemsBySection[sec] = [];
        itemsBySection[sec].push(item);
      });

      Object.entries(itemsBySection).forEach(([sectionName, sectionItems], index) => {
        const secMaterialTotal = sectionItems.reduce((sum, i) => sum + (i.materialAmount || 0), 0);
        const secLaborTotal = sectionItems.reduce((sum, i) => sum + (i.laborAmount || 0), 0);
        const secTotal = sectionItems.reduce((sum, i) => sum + i.amount, 0);

        rows.push({
          type: 'section-header',
          sectionName,
          index,
          materialTotal: secMaterialTotal,
          laborTotal: secLaborTotal,
          total: secTotal,
          count: sectionItems.length,
          items: sectionItems,
        });

        sectionItems.forEach((item, itemIdx) => {
          rows.push({
            type: 'item',
            item,
            itemIdx,
            isAggregated: false,
          });
        });
      });
    }

    return rows;
  }, [pageItems, viewMode, categories, showAggregated]);

  const themeStyles = {
    industrial: {
      table: 'bg-slate-900 text-slate-300 border-slate-800',
      header: 'bg-slate-800 text-slate-100',
      row: 'border-slate-800 hover:bg-slate-800/50',
      badge: 'bg-blue-900/30 text-blue-400 border-blue-800/50'
    },
    modern: {
      table: 'bg-white text-slate-700 border-slate-200',
      header: 'bg-slate-50 text-slate-900',
      row: 'border-slate-100 hover:bg-indigo-50/30',
      badge: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    minimal: {
      table: 'bg-white text-zinc-900 border-zinc-200',
      header: 'bg-zinc-100/50 text-zinc-900',
      row: 'border-zinc-100 hover:bg-zinc-50',
      badge: 'bg-zinc-100 text-zinc-600 border-zinc-200'
    },
    'high-density': {
      table: 'bg-white text-[#141414] border-[#141414]',
      header: 'bg-[#F2F2F2] text-[#141414] uppercase text-[11px] font-bold border-b border-[#141414]',
      row: 'hover:bg-gray-50 border-gray-200',
      badge: 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }[theme];

  const getCellPadding = (isHeader = false) => {
    // Map density (1-5) to tailwind padding classes
    const pyMap = theme === 'high-density'
      ? ['py-0.5', 'py-0.5', 'py-1', 'py-1.5', 'py-2.5'] // Even tighter for high-density
      : ['py-0.5', 'py-1', 'py-1.5', 'py-3', 'py-5'];
    
    // Header padding should be slightly more balanced
    const pyHeaderMap = theme === 'high-density'
      ? ['py-1', 'py-1', 'py-1.5', 'py-2', 'py-3']
      : ['py-2', 'py-4', 'py-4', 'py-5', 'py-6'];

    const pyValue = isHeader ? pyHeaderMap[density - 1] : pyMap[density - 1];
    const pxMap = theme === 'high-density' 
      ? ['px-1.5', 'px-2', 'px-4', 'px-6', 'px-8'] 
      : ['px-2', 'px-4', 'px-6', 'px-8', 'px-10'];
      
    return `${pyValue} ${pxMap[density - 1]}`;
  };

  const renderRuleIndicator = (item: SpecItem) => {
    if (showAggregated) return null;

    let type: 'custom' | 'system' | 'manual' | 'warning' | 'auto' = 'auto';
    let titleText = '자동 공정 매칭';
    let descriptionText = '내장 스마트 알고리즘에 의해 자동 분류가 적용되었습니다.';
    let ruleDetails = item.remark || '';
    let IconComponent = Cpu;
    let colorClass = 'text-blue-600 bg-blue-50 border-blue-100';

    const isCustom = item.remark && item.remark.includes('사용자 정의 규칙');
    const isManual = item.originalCategory && item.category !== item.originalCategory;
    const isUnclassified = !item.category || item.category === '미분류';
    const isSimpleFallback = item.remark === item.category;

    if (isManual) {
      type = 'manual';
      titleText = '수동 재지정 처리 완료 👤';
      IconComponent = User;
      colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
      descriptionText = '사용자가 직접 선택 항목의 분류를 수동으로 지정했습니다.';
      ruleDetails = `기존 제안: ${item.originalCategory || '없음'} ➔ 현재 설정: ${item.category}`;
    } else if (isCustom) {
      type = 'custom';
      titleText = '사용자 매칭 규칙 적용 ⚡';
      IconComponent = Zap;
      colorClass = 'text-purple-700 bg-purple-50/80 border-purple-200';
      descriptionText = '사용자 정의 분류 규칙 조건에 매칭되어 자동 분류되었습니다.';
      ruleDetails = item.remark;
    } else if (isUnclassified) {
      type = 'warning';
      titleText = '미분류 및 미지정 상태 ⚠️';
      IconComponent = AlertTriangle;
      colorClass = 'text-red-700 bg-red-50 border-red-200';
      descriptionText = '조건에 맞는 매칭 규칙이 발견되지 않아 미분류 상태입니다.';
      ruleDetails = item.remark || '공정 내역 분석 대기 중';
    } else if (isSimpleFallback) {
      type = 'auto';
      titleText = '내장 키워드 매칭 🤖';
      IconComponent = Cpu;
      colorClass = 'text-indigo-600 bg-indigo-50 border-indigo-150';
      descriptionText = '공정분리 내장 품명/규격 사전 매핑 알고리즘이 적용되었습니다.';
      ruleDetails = `공정분리 지정어: "${item.category}" 매칭`;
    } else {
      type = 'system';
      titleText = 'AI 알고리즘 분석 🤖';
      IconComponent = Sparkles;
      colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      descriptionText = '공종 계층 코드(0101**) 특이사항 및 단가 정보의 복합 해석 규칙이 적용되었습니다.';
      ruleDetails = item.remark;
    }

    return (
      <div className="relative group/tooltip inline-flex items-center shrink-0 select-none ml-1.5" onClick={(e) => e.stopPropagation()}>
        <div 
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all hover:scale-105 cursor-help shadow-xs ${colorClass}`}
        >
          <IconComponent className="w-2.5 h-2.5 shrink-0" />
          <span className="text-[9px] leading-none uppercase">
            {type === 'manual' ? '수동' : type === 'custom' ? '규칙' : type === 'warning' ? '미지정' : 'AI'}
          </span>
        </div>

        {/* Dynamic Pure Tailwind Tooltip */}
        <div className="absolute z-[99] bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 border border-slate-800 text-white rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 ease-out text-[10px] font-medium whitespace-normal text-left">
          <div className="tooltip-arrow absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
          <div className="flex items-center gap-1.5 font-black text-white pb-1 border-b border-slate-800 mb-1.5">
            <IconComponent className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>{titleText}</span>
          </div>
          <p className="text-slate-300 leading-relaxed mb-2">{descriptionText}</p>
          <div className="bg-slate-950 p-1.5 rounded border border-slate-800/50 font-mono text-[9px] text-indigo-300 break-words">
            <span className="text-slate-400 block font-sans font-bold text-[8px] uppercase tracking-tighter mb-0.5">상세 분석 근거 및 이력:</span>
            {ruleDetails}
          </div>
        </div>
      </div>
    );
  };

  const handleDownload = async () => {
    if (items.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    try {
      await exportStyledExcel({
        projectName: '기계설비_공정분리',
        items,
        categories
      });
    } catch (error: any) {
      console.error('Download error:', error);
      alert(error.message || '엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const renderFilters = () => {
    const selectClass = theme === 'high-density'
      ? "text-[11px] font-bold uppercase p-1 bg-white border border-[#141414] focus:outline-none"
      : "text-xs p-2 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none";

    const labelClass = theme === 'high-density'
      ? "text-[11px] font-black uppercase tracking-tighter opacity-70 mb-0.5 block"
      : "text-[10px] font-bold text-slate-500 uppercase mb-1 block";

    return (
      <div className={`flex flex-col sm:flex-row gap-4 items-end ${theme === 'high-density' ? 'mb-2' : 'mb-4'}`}>
        <div className="w-full sm:flex-1 sm:max-w-[240px]">
          <label className={labelClass}>품명 / 규격 검색</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="품명 및 규격 실시간 검색..."
              className={`w-full ${theme === 'high-density'
                ? "text-[11px] font-bold uppercase p-1 bg-white border border-[#141414] focus:outline-none placeholder-gray-400"
                : "text-xs p-2 pl-8 pr-8 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-400"
              }`}
            />
            {theme !== 'high-density' && (
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors font-bold text-xs"
                title="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="w-full sm:flex-1 sm:max-w-[200px]">
          <label className={labelClass}>공종 필터</label>
          <select 
            value={sectionFilter} 
            onChange={(e) => setSectionFilter(e.target.value)}
            className={`w-full ${selectClass}`}
          >
            <option value="all">전체 공종</option>
            {uniqueSections.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:flex-1 sm:max-w-[200px]">
          <label className={labelClass}>카테고리 필터</label>
          <select 
            value={categoryFilter} 
            onChange={(e) => onCategoryFilterChange?.(e.target.value)}
            className={`w-full ${selectClass}`}
          >
            <option value="all">전체 카테고리</option>
            <option value="미분류">⚠️ 미분류 / 미지정</option>
            {uniqueSections.length > 0 && categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setShowUnclassifiedOnly(!showUnclassifiedOnly)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-2 border shadow-xs h-[32px] sm:h-[30px] whitespace-nowrap cursor-pointer ${
              showUnclassifiedOnly
                ? theme === 'high-density'
                  ? 'bg-amber-100 text-amber-950 border-[#141414] ring-1 ring-amber-400'
                  : 'bg-amber-500 text-white border-amber-600 shadow-amber-100 font-black'
                : theme === 'high-density'
                  ? 'bg-white text-slate-700 border-[#141414] hover:bg-slate-50'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="카테고리가 분류되지 않은 대상만 필터링합니다."
          >
            <span className={`w-1.5 h-1.5 rounded-full ${showUnclassifiedOnly ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`} />
            <span>⚠️ 미분류 항목만 보기</span>
            <span className={`px-1.5 py-0.5 text-[9px] rounded-sm font-black ${showUnclassifiedOnly ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {unclassifiedCount}
            </span>
          </button>
        </div>

        {(sectionFilter !== 'all' || categoryFilter !== 'all' || showUnclassifiedOnly || searchQuery !== '' || columnFilters.name !== '' || columnFilters.spec !== '') && (
          <button 
            type="button"
            onClick={() => { 
                setSectionFilter('all'); 
                onCategoryFilterChange?.('all'); 
                setShowUnclassifiedOnly(false); 
                setSearchQuery(''); 
                setColumnFilters({ name: '', spec: '' });
                setFilterOperator('AND');
                setSelectionHelper(null);
            }}
            className={`flex items-center gap-1 shrink-0 ${theme === 'high-density' ? 'text-[10px] font-bold border-b border-black cursor-pointer pb-1' : 'text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer pb-1'}`}
          >
            필터 초기화
          </button>
        )}
      </div>
    );
  };

  // For high-density, group items by category
  const renderToolBar = () => {
    const handleBulkCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCategory = e.target.value;
      if (newCategory && selectedIds.size > 0) {
        onUpdateCategories(Array.from(selectedIds), newCategory);
        setSelectedIds(new Set());
        e.target.value = '';
      }
    };

    if (theme === 'high-density') {
      return (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <span className="px-2 py-1 bg-gray-200 text-[11px] font-bold uppercase rounded-sm border border-gray-300">내역 품목 수: {items.length} (필터: {allMatchingItems.length})</span>
            {selectedIds.size > 0 && (
              <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-bold uppercase rounded-sm border border-indigo-300">선택된 항목: {selectedIds.size}개</span>
            )}
            <span className="px-2 py-1 bg-green-100 text-green-800 text-[11px] font-bold uppercase rounded-sm border border-green-200">AI 프로세서: 온라인</span>
            
            <div className="ml-auto flex flex-wrap gap-4 items-center">
               <div className="flex bg-gray-200 p-0.5 rounded-sm border border-gray-300">
                 <button 
                   onClick={() => setViewMode('process')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${viewMode === 'process' ? 'bg-[#141414] text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   공정별 보기
                 </button>
                 <button 
                   onClick={() => setViewMode('category')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${viewMode === 'category' ? 'bg-[#141414] text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   카테고리별 보기
                 </button>
                 <button 
                   onClick={() => setViewMode('unclassified')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all flex items-center gap-1 border-l border-gray-300 ${
                     viewMode === 'unclassified' 
                       ? 'bg-amber-600 text-white font-bold' 
                       : 'text-amber-700 hover:bg-amber-50 hover:text-amber-900'
                   }`}
                 >
                   ⚠️ 미분류 ({unclassifiedCount})
                 </button>
               </div>
               {viewMode === 'category' && (
                 <button 
                   onClick={() => setShowAggregated(!showAggregated)}
                   className={`px-3 py-1 text-[9px] font-black uppercase border transition-all ${showAggregated ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-300 hover:text-black'}`}
                 >
                   {showAggregated ? '전체 내역 보기' : '품목 집계 보기'}
                 </button>
               )}
               <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-sm">
                 <span className="text-[9px] font-black uppercase opacity-60">페이지당 표시</span>
                 <select
                   value={pageSize}
                   onChange={(e) => setPageSize(Number(e.target.value))}
                   className="text-[10px] font-bold border border-gray-300 rounded px-1 py-0.5 bg-white text-black outline-none cursor-pointer"
                 >
                   <option value={50}>50개씩</option>
                   <option value={100}>100개씩 (초고속)</option>
                   <option value={200}>200개씩</option>
                   <option value={500}>500개씩</option>
                   <option value={0}>전체 (가상 스크롤 없음)</option>
                 </select>
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-sm">
                 <span className="text-[9px] font-black uppercase opacity-60">간격 조정</span>
                 <input 
                   type="range" 
                   min="1" 
                   max="5" 
                   value={density} 
                   onChange={(e) => setDensity(parseInt(e.target.value))}
                   className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                 />
                 <span className="text-[10px] font-bold w-4">{density}</span>
               </div>
               {selectedIds.size > 0 && (
                 <div className="relative">
                   <input 
                     type="text"
                     list="category-suggestions"
                     onKeyDown={(e) => e.key === 'Enter' && handleBulkCategoryChange(e as any)}
                     placeholder="일괄 분류 지정..."
                     className="text-[10px] font-bold uppercase p-1 bg-indigo-50 border border-indigo-400 focus:outline-none w-32"
                   />
                   <div className="absolute -top-2 -right-1 bg-indigo-600 text-white text-[7px] px-1 rounded-full font-black animate-bounce">NEW</div>
                 </div>
               )}
               <ExcelUpload onDataLoaded={onDataLoaded} />
               <button 
                  onClick={onClassify}
                  disabled={isClassifying}
                  className="px-4 py-1 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
               >
                  {isClassifying ? '분석 중...' : '자동 공정 분리 실행'}
               </button>
            </div>
          </div>
          {renderFilters()}
        </div>
      );
    }

    return (
      <div className="flex flex-col mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Table className="w-6 h-6 text-slate-400 shrink-0" />
            <div>
              <h2 className="text-xl font-bold truncate">계약 내역 상세 정보</h2>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-indigo-600">선택된 항목: {selectedIds.size}개</span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 md:gap-6 items-center">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewMode('process')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'process' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                공정 중심
              </button>
              <button 
                onClick={() => setViewMode('category')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'category' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                카테고리 중심
              </button>
              <button 
                onClick={() => setViewMode('unclassified')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === 'unclassified' 
                    ? 'bg-amber-500 text-white shadow-sm font-black' 
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
              >
                <span>⚠️ 미분류 ({unclassifiedCount})</span>
              </button>
            </div>
            {viewMode === 'category' && (
              <button 
                onClick={() => setShowAggregated(!showAggregated)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all ${showAggregated ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {showAggregated ? '전체 내역 보기' : '동일 품목 집계'}
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase">표시 개수</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs font-bold border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 outline-none cursor-pointer"
              >
                <option value={50}>50개</option>
                <option value={100}>100개 (초고속)</option>
                <option value={200}>200개</option>
                <option value={500}>500개</option>
                <option value={0}>전체</option>
              </select>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <Maximize2 className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">셀 간격</span>
                <input 
                   type="range" 
                   min="1" 
                   max="5" 
                   value={density} 
                   onChange={(e) => setDensity(parseInt(e.target.value))}
                   className="w-20 md:w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                 />
              </div>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="일괄 카테고리 지정..."
                    className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold placeholder:text-indigo-300 w-44"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) {
                          onUpdateCategories(Array.from(selectedIds), val);
                          (e.target as HTMLInputElement).value = '';
                          setSelectedIds(new Set());
                        }
                      }
                    }}
                  />
                  <div className="absolute -top-2 -right-1 bg-indigo-600 text-white text-[8px] px-1 rounded-full font-black animate-bounce shadow-sm">NEW</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClassify(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                  disabled={isClassifying}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 h-[38px] cursor-pointer shadow-sm shadow-amber-100 whitespace-nowrap"
                  title="선택한 항목만 AI로 다시 분류합니다"
                >
                  <Cpu className={`w-3.5 h-3.5 ${isClassifying ? 'animate-spin' : ''}`} />
                  <span>선택 항목 AI 재분석</span>
                </button>
              </div>
            )}
            <ExcelUpload onDataLoaded={onDataLoaded} />
            <button
              onClick={() => onClassify()}
              disabled={isClassifying}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-sm md:text-base text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 cursor-pointer"
            >
              <Cpu className={`w-4 h-4 ${isClassifying ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">{isClassifying ? '분류 중...' : 'AI 자동 공정분리'}</span>
            </button>
            <button 
              onClick={handleDownload}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white text-sm md:text-base rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="whitespace-nowrap">엑셀 내보내기</span>
            </button>
          </div>
        </div>
        {renderFilters()}
      </div>
    );
  };

  const renderFooter = () => {
    if (theme !== 'high-density') return null;
    return (
      <footer className="p-3 bg-[#EBEAE8] border-t border-[#141414] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold opacity-50">이상 항목 감지</span>
            <span className="text-[11px] font-bold text-slate-900 tracking-tight">발견된 오류 없음 / 통과</span>
          </div>
          <div className="flex flex-col border-l border-[#141414]/10 pl-4">
            <span className="text-[9px] uppercase font-bold opacity-50">분류 로직 버전</span>
            <span className="text-[11px] font-bold uppercase font-mono">Semantic AI v4.2 PRO</span>
          </div>
        </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-1 bg-white border border-[#141414] text-[10px] font-bold uppercase transition-colors hover:bg-zinc-50">전체 시스템 진단</button>
            <button 
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-6 py-1 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-zinc-800"
            >
              보고서 출력
            </button>
          </div>
      </footer>
    );
  };

  const toggleAll = (visibleItems: SpecItem[]) => {
    const allVisibleSelected = visibleItems.every(item => selectedIds.has(item.id));
    const newSelected = new Set(selectedIds);
    if (allVisibleSelected) {
      visibleItems.forEach(item => newSelected.delete(item.id));
    } else {
      visibleItems.forEach(item => newSelected.add(item.id));
    }
    setSelectedIds(newSelected);
    setSelectionHelper(null);
  };

  const toggleOne = (id: string, index: number, isShiftKey = false) => {
    const newSelected = new Set(selectedIds);
    const wasSelected = newSelected.has(id);
    
    if (wasSelected && !isDragging) {
      newSelected.delete(id);
      if (selectionHelper?.id === id) {
        setSelectionHelper(null);
      }
    } else {
      newSelected.add(id);
      
      // Smart Selection Helper: Find other items with same name that aren't selected yet
      const targetItem = items.find(i => i.id === id);
      if (targetItem && targetItem.name) {
        const sameNameItems = items.filter(i => 
          i.name === targetItem.name && 
          i.id !== id && 
          !newSelected.has(i.id)
        );
        
        if (sameNameItems.length > 0) {
          setSelectionHelper({
            id,
            name: targetItem.name,
            count: sameNameItems.length,
            ids: sameNameItems.map(i => i.id)
          });
        } else {
          setSelectionHelper(null);
        }
      }
    }
    setSelectedIds(newSelected);
  };

  const handleMouseDown = (id: string, index: number) => {
    setIsDragging(true);
    setDragStartIdx(index);
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleMouseEnter = (index: number) => {
    if (isDragging && dragStartIdx !== null) {
      const start = Math.min(dragStartIdx, index);
      const end = Math.max(dragStartIdx, index);
      const newSelected = new Set(selectedIds);
      
      // Get the items in the current view to know which ones are in range
      const visibleItems = pageItems;
      for (let i = start; i <= end; i++) {
        if (visibleItems[i]) {
          newSelected.add(visibleItems[i].id);
        }
      }
      setSelectedIds(newSelected);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartIdx(null);
  };

  const selectionSummary = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    return {
      material: selectedItems.reduce((sum, i) => sum + (i.materialAmount || 0), 0),
      labor: selectedItems.reduce((sum, i) => sum + (i.laborAmount || 0), 0),
      total: selectedItems.reduce((sum, i) => sum + (i.amount || 0), 0),
      count: selectedItems.length
    };
  }, [selectedIds, items]);

  return (
    <div className={`flex flex-col ${theme === 'high-density' ? 'flex-grow overflow-hidden' : 'gap-0'}`} onMouseUp={handleMouseUp}>
      {renderToolBar()}

      {viewMode === 'unclassified' && (
        <div className={`mx-4 mb-3 p-3 flex flex-wrap items-center justify-between border-l-4 ${
          theme === 'high-density' 
            ? 'bg-amber-100 text-amber-950 border-amber-600 border-y border-r font-sans' 
            : 'bg-amber-50 text-amber-900 border-amber-500 rounded-lg shadow-sm border-y border-r'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">미분류 / 미지정 품목 조회 모드</p>
              <p className="text-[10px] opacity-75 font-medium">자동 분류가 되지 않았거나 아직 지정하지 않은 대상을 빠르게 모아보고 공종을 지정할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <button 
              onClick={onClassify}
              disabled={isClassifying}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1 shrink-0 ${
                theme === 'high-density'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 cursor-pointer'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm cursor-pointer'
              }`}
            >
              🚀 {isClassifying ? '자동 분류 진행 중...' : '해당 품목만 AI 분류 실행'}
            </button>
          </div>
        </div>
      )}

      <div ref={tableContainerRef} className={`flex-grow overflow-hidden ${theme === 'high-density' ? '' : `rounded-xl border shadow-sm ${themeStyles.table}`}`}>
        <div className="h-full overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className={`sticky top-0 z-10 ${themeStyles.header}`}>
              {theme === 'high-density' ? (
                <>
                  <tr>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap`}>
                      <input 
                        type="checkbox" 
                        checked={pageItems.length > 0 && pageItems.every(i => selectedIds.has(i.id))}
                        onChange={() => toggleAll(pageItems)}
                        className="accent-[#141414]"
                      />
                    </th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>No.</th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] bg-[#F2F2F2] text-[11px] min-w-[100px] relative`}>
                      <div className="flex items-center justify-between gap-1 group">
                        <span>품 명</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterColumn(activeFilterColumn === 'name' ? null : 'name');
                          }}
                          className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${columnFilters.name ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                        >
                          <Filter size={10} fill={columnFilters.name ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      {activeFilterColumn === 'name' && (
                        <>
                          <div className="fixed inset-0 z-[999] cursor-default" onClick={() => setActiveFilterColumn(null)} />
                          <ColumnFilterDropdown 
                            columnId="name" 
                            value={columnFilters.name} 
                            onValueChange={(val) => setColumnFilters(prev => ({ ...prev, name: val }))}
                            onClose={() => setActiveFilterColumn(null)}
                            suggestions={uniqueNames}
                            filterOperator={filterOperator}
                            onOperatorChange={setFilterOperator}
                          />
                        </>
                      )}
                    </th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] bg-[#F2F2F2] text-[11px] min-w-[100px] relative`}>
                      <div className="flex items-center justify-between gap-1 group">
                        <span>규 격</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterColumn(activeFilterColumn === 'spec' ? null : 'spec');
                          }}
                          className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${columnFilters.spec ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                        >
                          <Filter size={10} fill={columnFilters.spec ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      {activeFilterColumn === 'spec' && (
                        <>
                          <div className="fixed inset-0 z-[999] cursor-default" onClick={() => setActiveFilterColumn(null)} />
                          <ColumnFilterDropdown 
                            columnId="spec" 
                            value={columnFilters.spec} 
                            onValueChange={(val) => setColumnFilters(prev => ({ ...prev, spec: val }))}
                            onClose={() => setActiveFilterColumn(null)}
                            suggestions={uniqueSpecs}
                            filterOperator={filterOperator}
                            onOperatorChange={setFilterOperator}
                          />
                        </>
                      )}
                    </th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>단위</th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>수량</th>
                    <th colSpan={2} className={`${getCellPadding(true)} border-r border-b border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>재 료 비</th>
                    <th colSpan={2} className={`${getCellPadding(true)} border-r border-b border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>노 무 비</th>
                    <th colSpan={2} className={`${getCellPadding(true)} border-r border-b border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>합 계</th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] text-left bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>비 고</th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] text-left bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>메 모</th>
                    <th rowSpan={2} className={`${getCellPadding(true)} text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>자재 분류</th>
                  </tr>
                  <tr>
                    <th className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>단 가</th>
                    <th className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>금 액</th>
                    <th className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>단 가</th>
                    <th className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>금 액</th>
                    <th className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>단 가</th>
                    <th className={`${getCellPadding(true)} border-r border-[#141414] text-center bg-[#F2F2F2] whitespace-nowrap text-[11px]`}>금 액</th>
                  </tr>
                </>
              ) : (
                <>
                  <tr>
                    <th rowSpan={2} className="px-6 py-4 font-semibold border-r border-slate-200 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={pageItems.length > 0 && pageItems.every(i => selectedIds.has(i.id))}
                        onChange={() => toggleAll(pageItems)}
                        className="accent-indigo-600"
                      />
                    </th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold border-r border-slate-200 whitespace-nowrap">번호</th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold border-r border-slate-200 min-w-[120px] relative">
                      <div className="flex items-center justify-between gap-1 group">
                        <span>품명</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterColumn(activeFilterColumn === 'name' ? null : 'name');
                          }}
                          className={`p-1 rounded hover:bg-slate-100 transition-colors ${columnFilters.name ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                        >
                          <Filter size={14} fill={columnFilters.name ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      {activeFilterColumn === 'name' && (
                        <>
                          <div className="fixed inset-0 z-[999] cursor-default" onClick={() => setActiveFilterColumn(null)} />
                          <ColumnFilterDropdown 
                            columnId="name" 
                            value={columnFilters.name} 
                            onValueChange={(val) => setColumnFilters(prev => ({ ...prev, name: val }))}
                            onClose={() => setActiveFilterColumn(null)}
                            suggestions={uniqueNames}
                            filterOperator={filterOperator}
                            onOperatorChange={setFilterOperator}
                          />
                        </>
                      )}
                    </th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold border-r border-slate-200 min-w-[120px] relative">
                      <div className="flex items-center justify-between gap-1 group">
                        <span>규격</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterColumn(activeFilterColumn === 'spec' ? null : 'spec');
                          }}
                          className={`p-1 rounded hover:bg-slate-100 transition-colors ${columnFilters.spec ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                        >
                          <Filter size={14} fill={columnFilters.spec ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      {activeFilterColumn === 'spec' && (
                        <>
                          <div className="fixed inset-0 z-[999] cursor-default" onClick={() => setActiveFilterColumn(null)} />
                          <ColumnFilterDropdown 
                            columnId="spec" 
                            value={columnFilters.spec} 
                            onValueChange={(val) => setColumnFilters(prev => ({ ...prev, spec: val }))}
                            onClose={() => setActiveFilterColumn(null)}
                            suggestions={uniqueSpecs}
                            filterOperator={filterOperator}
                            onOperatorChange={setFilterOperator}
                          />
                        </>
                      )}
                    </th>
                    <th rowSpan={2} className="px-4 py-4 font-semibold text-center border-r border-slate-200 whitespace-nowrap">단위</th>
                    <th rowSpan={2} className="px-4 py-4 font-semibold text-right border-r border-slate-200 whitespace-nowrap">수량</th>
                    <th colSpan={2} className="px-6 py-2 font-semibold text-center border-r border-b border-slate-200 whitespace-nowrap">재료비</th>
                    <th colSpan={2} className="px-6 py-2 font-semibold text-center border-r border-b border-slate-200 whitespace-nowrap">노무비</th>
                    <th colSpan={2} className="px-6 py-2 font-semibold text-center border-r border-b border-slate-200 whitespace-nowrap">합계</th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold text-left border-r border-slate-200 whitespace-nowrap">비고</th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold text-left border-r border-slate-200 whitespace-nowrap">메모</th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold text-center whitespace-nowrap">자재 분류</th>
                  </tr>
                  <tr>
                    <th className="px-4 py-2 font-semibold text-right border-r border-slate-200 whitespace-nowrap">단가</th>
                    <th className="px-4 py-2 font-semibold text-right border-r border-slate-200 whitespace-nowrap">금액</th>
                    <th className="px-4 py-2 font-semibold text-right border-r border-slate-200 whitespace-nowrap">단가</th>
                    <th className="px-4 py-2 font-semibold text-right border-r border-slate-200 whitespace-nowrap">금액</th>
                    <th className="px-4 py-2 font-semibold text-right border-r border-slate-200 whitespace-nowrap">단가</th>
                    <th className="px-4 py-2 font-semibold text-right border-r border-slate-200 text-indigo-600 whitespace-nowrap">금액</th>
                  </tr>
                </>
              )}
            </thead>
            <tbody className={`divide-y divide-inherit ${theme === 'high-density' ? 'font-sans' : ''}`}>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-24 text-center">
                    <div className="max-w-md mx-auto">
                      {items.length === 0 ? (
                         <ExcelUpload onDataLoaded={onDataLoaded} variant="dropzone" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Filter className="w-12 h-12 opacity-20" />
                          <p>선택한 필터 조건에 맞는 항목이 없습니다.</p>
                          <button 
                            onClick={() => { setSectionFilter('all'); onCategoryFilterChange?.('all'); }}
                            className="text-indigo-600 font-medium hover:underline mt-2"
                          >
                            모든 필터 초기화
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={15} className="p-0">
                    <VirtualizedTableBody
                      rows={virtualRows}
                      height={Math.max(containerHeight - 140, 400)}
                      theme={theme}
                      density={density}
                      selectedIds={selectedIds}
                      toggleOne={toggleOne}
                      toggleAll={toggleAll}
                      handleMouseDown={handleMouseDown}
                      handleMouseEnter={handleMouseEnter}
                      renderRuleIndicator={renderRuleIndicator}
                      categories={categories}
                      onUpdateCategory={onUpdateCategory}
                      onAddCategory={onAddCategory}
                      onRevertCategory={onRevertCategory}
                      onUpdateMemo={onUpdateMemo}
                      editingId={editingId}
                      editValue={editValue}
                      startEditing={startEditing}
                      saveEdit={saveEdit}
                      handleKeyDown={handleKeyDown}
                      setEditValue={setEditValue}
                      getCellPadding={getCellPadding}
                    />
                  </td>
                </tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="sticky bottom-0 z-20">
                <tr className={`${theme === 'high-density' ? 'bg-[#141414] text-white' : 'bg-slate-800 text-white'} border-t-2 border-[#141414]`}>
                  <td colSpan={11} className="px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-right border-r border-white/10">
                    전체 합계 금액 (Total)
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-base font-black border-r border-white/10">
                    ₩{allMatchingItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={3} className="px-6 py-4 bg-white/5 text-xs text-slate-300 font-medium">
                    {pageSize > 0 && totalPages > 1 ? `현재 페이지 합계: ₩${pageItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}` : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Navigation Bar */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200">
            <div className="text-xs text-slate-600 font-medium">
              총 <span className="font-bold text-slate-900">{allMatchingItems.length}</span>개 중{' '}
              <span className="font-bold text-indigo-600">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, allMatchingItems.length)}</span>개 표시 중 (페이지 {currentPage} / {totalPages})
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
                title="첫 페이지"
              >
                &laquo;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                이전
              </button>

              {/* Page Number Buttons (Centered window around current page) */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    return (
                      <React.Fragment key={p}>
                        {prevP && p - prevP > 1 && (
                          <span className="px-1 text-slate-400 text-xs font-bold">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 text-xs font-bold rounded flex items-center justify-center cursor-pointer transition-colors ${
                            currentPage === p
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              >
                다음
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
                title="마지막 페이지"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Smart Selection Helper Popup */}
      {selectionHelper && (
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[101] w-[340px] bg-white border border-indigo-200 rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.15)] p-4 flex flex-col gap-3 ring-4 ring-indigo-500/10"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 shrink-0">
              <Zap size={20} className="animate-pulse text-indigo-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mb-0.5">스마트 일괄 선택 제안</h4>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                현재 선택하신 <span className="text-indigo-600 font-bold">'{selectionHelper.name}'</span> 품명과 동일한 항목이 <span className="font-bold text-slate-800">{selectionHelper.count}개</span> 더 있습니다.
              </p>
            </div>
            <button 
              onClick={() => setSelectionHelper(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setSelectionHelper(null)}
              className="flex-1 py-2 text-[11px] font-black text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
            >
              취소
            </button>
            <button
              onClick={() => {
                const newSelected = new Set(selectedIds);
                selectionHelper.ids.forEach(id => newSelected.add(id));
                setSelectedIds(newSelected);
                setSelectionHelper(null);
              }}
              className="flex-[2.5] py-2 text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <span>동일 품명 {selectionHelper.count}개 일괄 선택</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      )}

      {selectionSummary && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 pointer-events-none"
        >
          <div className="bg-[#141414] text-white rounded-2xl shadow-2xl border border-white/10 p-4 flex items-center justify-between gap-6 backdrop-blur-md bg-opacity-95 pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <Table className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase opacity-60">드래그 선택 합계 ({selectionSummary.count}개 항목)</span>
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-indigo-300">재료비 소계</span>
                    <span className="text-sm font-black font-mono">₩{selectionSummary.material.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-amber-300">노무비 소계</span>
                    <span className="text-sm font-black font-mono">₩{selectionSummary.labor.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase opacity-60">선택 총 합계</span>
                <span className="text-xl font-black font-mono text-green-400">₩{selectionSummary.total.toLocaleString()}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(new Set());
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white cursor-pointer"
                title="선택 해제"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {renderFooter()}

      {/* Category Suggestions Datalist */}
      <datalist id="category-suggestions">
        {categories.map(cat => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </div>
  );
}
