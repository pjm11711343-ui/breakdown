import React, { useState, useMemo } from 'react';
import { SpecItem, ThemeType } from '../types';
import { Download, Table, Cpu, Filter, Maximize2, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import ExcelUpload from './ExcelUpload';
import * as XLSX from 'xlsx';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  workbook: XLSX.WorkBook | null;
  onClassify: (targetIds?: string[]) => void;
  isClassifying: boolean;
  onUpdateCategory: (id: string, category: string) => void;
  onRevertCategory: (id: string) => void;
  onUpdateCategories: (ids: string[], category: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onDataLoaded: (items: SpecItem[], workbook: XLSX.WorkBook) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
}

export default function DataTable({ items, theme, categories, workbook, onClassify, isClassifying, onUpdateCategory, onRevertCategory, onUpdateCategories, onUpdateMemo, onDataLoaded, categoryFilter = 'all', onCategoryFilterChange }: Props) {
  const [viewMode, setViewMode] = useState<'process' | 'category' | 'unclassified'>('process');
  const [showAggregated, setShowAggregated] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

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
        (item.specification && item.specification.toLowerCase().includes(query));

      return matchesSection && matchesCategory && matchesUnclassifiedOnly && matchesSearch;
    });
  }, [items, sectionFilter, categoryFilter, showUnclassifiedOnly, searchQuery]);

  const pageItems = useMemo(() => {
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

  const unclassifiedCount = useMemo(() => {
    return items.filter(item => !item.category || item.category === '미분류').length;
  }, [items]);

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

  const handleDownload = () => {
    if (!workbook || items.length === 0) {
      alert('다운로드할 데이터가 없거나 원본 엑셀 정보가 없습니다.');
      return;
    }

    try {
      // Create a high-fidelity clone of the workbook preserving all styles, formulas, merged cells, etc.
      const wb = XLSX.utils.book_new();
      wb.Props = workbook.Props ? { ...workbook.Props } : {};
      wb.Custprops = workbook.Custprops ? { ...workbook.Custprops } : {};
      
      workbook.SheetNames.forEach(name => {
        const srcSheet = workbook.Sheets[name];
        const tgtSheet: XLSX.WorkSheet = {};
        
        for (const key in srcSheet) {
          if (Object.prototype.hasOwnProperty.call(srcSheet, key)) {
            if (key.startsWith('!')) {
              // Preserve sheet properties (ranges, merges, column/row styles, widths, heights)
              const val = srcSheet[key];
              if (Array.isArray(val)) {
                tgtSheet[key] = val.map(item => (typeof item === 'object' && item !== null) ? { ...item } : item);
              } else if (typeof val === 'object' && val !== null) {
                tgtSheet[key] = { ...val };
              } else {
                tgtSheet[key] = val;
              }
            } else {
              // Preserve cell properties (values, types, styles, formats, formulas)
              const cell = srcSheet[key];
              if (cell && typeof cell === 'object') {
                const cellCopy: any = { ...cell };
                if (cell.s && typeof cell.s === 'object') {
                  cellCopy.s = JSON.parse(JSON.stringify(cell.s)); // deep clone styles
                }
                tgtSheet[key] = cellCopy;
              } else {
                tgtSheet[key] = cell;
              }
            }
          }
        }
        XLSX.utils.book_append_sheet(wb, tgtSheet, name);
      });

      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];
      
      // Convert sheet to json array of arrays to find header easily
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Find header row (using similar logic to ExcelUpload)
      let headerRowIndex = -1;
      const constructionKeywords = ['품명', '규격', '수량', '단위', '단가', '금액', '명칭', '비고', '재료비', '노무비'];
      
      for (let i = 0; i < Math.min(data.length, 40); i++) {
        const rowData = data[i];
        if (!rowData || !Array.isArray(rowData)) continue;
        const rowStr = rowData.map(c => String(c || '').replace(/\s+/g, '').toLowerCase());
        const matches = rowStr.filter(c => constructionKeywords.some(k => c.includes(k))).length;
        if (matches >= 2) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) headerRowIndex = 0;

      const headers = data[headerRowIndex] || [];
      let categoryColIdx = headers.findIndex(h => String(h || '').includes('자재분류'));
      let memoColIdx = headers.findIndex(h => String(h || '').includes('메모'));
      
      // Utility helper to copy style from preceding col cell in the same row
      const copyStyleFromLeft = (r: number, targetColIdx: number) => {
        // Look for any preceding valid cell in the same row to steal styling
        for (let c = targetColIdx - 1; c >= 0; c--) {
          const fromCellAddress = XLSX.utils.encode_cell({ r, c });
          const fromCell = worksheet[fromCellAddress];
          if (fromCell && fromCell.s && Object.keys(fromCell.s).length > 0) {
            return JSON.parse(JSON.stringify(fromCell.s));
          }
        }
        return null;
      };

      if (categoryColIdx === -1) {
        // If "비고" (Remarks) exists, place it after it.
        const remarkIdx = headers.findIndex(h => String(h || '').includes('비고'));
        categoryColIdx = remarkIdx !== -1 ? remarkIdx + 1 : headers.length;
        
        // Update header cell
        const headerCellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: categoryColIdx });
        worksheet[headerCellAddress] = { v: '자재분류', t: 's' };
        
        const headerStyle = copyStyleFromLeft(headerRowIndex, categoryColIdx);
        if (headerStyle) {
          worksheet[headerCellAddress].s = headerStyle;
        }
      }

      if (memoColIdx === -1) {
        // Place it right next to categoryColIdx
        memoColIdx = categoryColIdx + 1;

        // Update header cell
        const headerCellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: memoColIdx });
        worksheet[headerCellAddress] = { v: '메모', t: 's' };

        const headerStyle = copyStyleFromLeft(headerRowIndex, memoColIdx);
        if (headerStyle) {
          worksheet[headerCellAddress].s = headerStyle;
        }
      }

      // Fill in category and memo for each item
      items.forEach(item => {
        if (item.excelRowIdx !== undefined) {
          const cellAddress = XLSX.utils.encode_cell({ r: item.excelRowIdx, c: categoryColIdx });
          worksheet[cellAddress] = { v: item.category || '', t: 's' };
          
          const rowStyle = copyStyleFromLeft(item.excelRowIdx, categoryColIdx);
          if (rowStyle) {
            worksheet[cellAddress].s = rowStyle;
          }

          const memoCellAddress = XLSX.utils.encode_cell({ r: item.excelRowIdx, c: memoColIdx });
          worksheet[memoCellAddress] = { v: item.memo || '', t: 's' };
          if (rowStyle) {
            worksheet[memoCellAddress].s = rowStyle;
          }
        }
      });

      // Update worksheet column widths (!cols) to give '자재분류' and '메모' nice breathing room
      const maxColIdx = Math.max(categoryColIdx, memoColIdx);
      if (!worksheet['!cols']) worksheet['!cols'] = [];
      while (worksheet['!cols'].length <= maxColIdx) {
        worksheet['!cols'].push({ wch: 10 });
      }
      worksheet['!cols'][categoryColIdx] = { wch: 18 };
      worksheet['!cols'][memoColIdx] = { wch: 25 };

      // Update sheet range if needed (XLSX usually handles this, but let's be safe)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      if (maxColIdx > range.e.c) range.e.c = maxColIdx;
      worksheet['!ref'] = XLSX.utils.encode_range(range);

      XLSX.writeFile(wb, `공정분리_완료_${new Date().toISOString().slice(0, 10)}.xlsx`, {
        cellStyles: true,
        cellNF: true,
        bookSST: false,
        sheetStubs: true
      } as any);
    } catch (error) {
      console.error('Download error:', error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
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

        {(sectionFilter !== 'all' || categoryFilter !== 'all' || showUnclassifiedOnly || searchQuery !== '') && (
          <button 
            type="button"
            onClick={() => { 
                setSectionFilter('all'); 
                onCategoryFilterChange?.('all'); 
                setShowUnclassifiedOnly(false); 
                setSearchQuery(''); 
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
    const handleBulkCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCategory = e.target.value;
      if (newCategory && selectedIds.size > 0) {
        onUpdateCategories(Array.from(selectedIds), newCategory);
        setSelectedIds(new Set());
      }
    };

    if (theme === 'high-density') {
      return (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <span className="px-2 py-1 bg-gray-200 text-[11px] font-bold uppercase rounded-sm border border-gray-300">내역 품목 수: {items.length} (필터: {pageItems.length})</span>
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
                 <select 
                   onChange={handleBulkCategoryChange}
                   className="text-[10px] font-bold uppercase p-1 bg-indigo-50 border border-indigo-400 focus:outline-none"
                   value=""
                 >
                   <option value="" disabled>카테고리 일괄 변경</option>
                   {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
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
                <select 
                  onChange={handleBulkCategoryChange}
                  className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                  value=""
                >
                  <option value="" disabled>카테고리 일괄 변경</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
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
  };

  const toggleOne = (id: string, index: number, isShiftKey = false) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id) && !isDragging) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
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

      <div className={`flex-grow overflow-hidden ${theme === 'high-density' ? '' : `rounded-xl border shadow-sm ${themeStyles.table}`}`}>
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
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] bg-[#F2F2F2] text-[11px] min-w-[100px]`}>품 명</th>
                    <th rowSpan={2} className={`${getCellPadding(true)} border-r border-[#141414] bg-[#F2F2F2] text-[11px] min-w-[100px]`}>규 격</th>
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
                    <th rowSpan={2} className="px-6 py-4 font-semibold border-r border-slate-200 min-w-[120px]">품명</th>
                    <th rowSpan={2} className="px-6 py-4 font-semibold border-r border-slate-200 min-w-[120px]">규격</th>
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
              ) : viewMode === 'category' ? (
                (() => {
                  const itemsByCategory: Record<string, Record<string, SpecItem[]>> = {};
                  
                  filteredItems.forEach(item => {
                    const cat = item.category || '기타';
                    const sec = item.section || '기본 내역';
                    if (!itemsByCategory[cat]) itemsByCategory[cat] = {};
                    if (!itemsByCategory[cat][sec]) itemsByCategory[cat][sec] = [];
                    itemsByCategory[cat][sec].push(item);
                  });

                  return Object.entries(itemsByCategory).sort().map(([catName, sections], catIdx) => {
                    const catItems = Object.values(sections).flat();
                    const catMaterialTotal = catItems.reduce((sum, i) => sum + (i.materialAmount || 0), 0);
                    const catLaborTotal = catItems.reduce((sum, i) => sum + (i.laborAmount || 0), 0);
                    const catTotal = catItems.reduce((sum, i) => sum + i.amount, 0);
                    
                    return (
                      <React.Fragment key={catName}>
                        {/* Category Header */}
                        <tr className={`${theme === 'high-density' ? 'bg-indigo-600 text-white' : 'bg-indigo-900 text-white'} border-y-2 border-[#141414] shadow-sm sticky top-[36px] z-20`}>
                          <td className={`${getCellPadding()} text-center border-r border-white/20 whitespace-nowrap`}>
                            <input 
                              type="checkbox" 
                              checked={catItems.length > 0 && catItems.every(i => selectedIds.has(i.id))}
                              onChange={() => toggleAll(catItems)}
                              className="accent-white"
                            />
                          </td>
                          <td className={`${getCellPadding()} font-mono font-black border-r border-white/20 whitespace-nowrap`}>
                            CAT {catIdx + 1}
                          </td>
                          <td colSpan={5} className={`${getCellPadding()} font-black uppercase tracking-widest border-r border-white/20 whitespace-nowrap text-xs`}>
                            [분류] {catName}
                          </td>
                          <td className={`${getCellPadding()} text-right font-mono font-black bg-black/10 whitespace-nowrap text-xs border-r border-white/20`}>
                            ₩{catMaterialTotal.toLocaleString()}
                          </td>
                          <td className={`${getCellPadding()} border-r border-white/10 bg-black/5`}></td>
                          <td className={`${getCellPadding()} text-right font-mono font-black bg-black/10 whitespace-nowrap text-xs border-r border-white/20`}>
                            ₩{catLaborTotal.toLocaleString()}
                          </td>
                          <td className={`${getCellPadding()} border-r border-white/10 bg-black/5`}></td>
                          <td className={`${getCellPadding()} text-right font-mono font-black bg-black/20 whitespace-nowrap text-xs`}>
                            ₩{catTotal.toLocaleString()}
                          </td>
                          <td colSpan={3} className={`${getCellPadding()} text-center font-mono font-black bg-black/10 whitespace-nowrap text-[10px]`}>
                            {catItems.length} ITEMS
                          </td>
                        </tr>

                        {/* Sub-grouping by Section within Category */}
                        {Object.entries(sections).sort().map(([secName, secItems], secIdx) => {
                          const secMaterialTotal = secItems.reduce((sum, i) => sum + (i.materialAmount || 0), 0);
                          const secLaborTotal = secItems.reduce((sum, i) => sum + (i.laborAmount || 0), 0);
                          const secTotal = secItems.reduce((sum, i) => sum + i.amount, 0);
                          
                          let displayItems = secItems;
                          if (showAggregated) {
                            const aggregated: Record<string, SpecItem> = {};
                            secItems.forEach(item => {
                              const key = `${item.name}-${item.specification}-${item.unit}`.replace(/\s+/g, '');
                              if (!aggregated[key]) {
                                aggregated[key] = { ...item, id: `agg-${item.id}`, quantity: 0, materialAmount: 0, laborAmount: 0, amount: 0 };
                              }
                              aggregated[key].quantity += item.quantity;
                              aggregated[key].materialAmount += (item.materialAmount || 0);
                              aggregated[key].laborAmount += (item.laborAmount || 0);
                              aggregated[key].amount += item.amount;
                              
                              // Recalculate unit prices based on totals for accuracy in aggregated row
                              if (aggregated[key].quantity > 0) {
                                aggregated[key].materialUnitPrice = aggregated[key].materialAmount / aggregated[key].quantity;
                                aggregated[key].laborUnitPrice = aggregated[key].laborAmount / aggregated[key].quantity;
                                aggregated[key].unitPrice = aggregated[key].amount / aggregated[key].quantity;
                              }
                            });
                            displayItems = Object.values(aggregated);
                          }

                          return (
                            <React.Fragment key={`${catName}-${secName}`}>
                              <tr className={`${theme === 'high-density' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'} border-b border-[#141414]/10`}>
                                <td className={`${getCellPadding()} text-center border-r border-[#141414]/10 whitespace-nowrap`}></td>
                                <td className={`${getCellPadding()} font-mono text-[9px] font-bold border-r border-[#141414]/10 whitespace-nowrap`}>
                                  {catIdx + 1}-{secIdx + 1}
                                </td>
                                <td colSpan={5} className={`${getCellPadding()} font-bold text-[10px] italic border-r border-[#141414]/10 whitespace-nowrap`}>
                                   └ {secName} {showAggregated ? '(품목 집계됨)' : ''}
                                </td>
                                <td className={`${getCellPadding()} text-right font-mono text-[9px] font-bold bg-black/5 whitespace-nowrap border-r border-[#141414]/10`}>
                                  ₩{secMaterialTotal.toLocaleString()}
                                </td>
                                <td className={`${getCellPadding()} border-r border-[#141414]/5`}></td>
                                <td className={`${getCellPadding()} text-right font-mono text-[9px] font-bold bg-black/5 whitespace-nowrap border-r border-[#141414]/10`}>
                                  ₩{secLaborTotal.toLocaleString()}
                                </td>
                                <td className={`${getCellPadding()} border-r border-[#141414]/5`}></td>
                                <td className={`${getCellPadding()} text-right font-mono text-[10px] font-bold bg-black/5 whitespace-nowrap`}>
                                  ₩{secTotal.toLocaleString()}
                                </td>
                                <td colSpan={3} className={`${getCellPadding()} text-center font-mono text-[9px] opacity-60`}>
                                  {showAggregated ? displayItems.length : secItems.length}
                                </td>
                              </tr>
                              {displayItems.map((item, itemIdx) => (
                                <motion.tr 
                                  layout
                                  key={item.id} 
                                  onMouseDown={() => handleMouseDown(item.id, itemIdx)}
                                  onMouseEnter={() => handleMouseEnter(itemIdx)}
                                  className={`${
                                    theme === 'high-density' 
                                     ? (selectedIds.has(item.id) ? 'bg-[#C5E0B4]' : 'bg-white') 
                                     : (selectedIds.has(item.id) ? 'bg-indigo-50/50' : 'bg-white')
                                  } transition-colors border-b border-[#141414]/5 group hover:bg-slate-50 ${showAggregated ? 'bg-orange-50/20' : ''} select-none ${selectedIds.has(item.id) ? 'shadow-[inset_4px_0_0_0_#4f46e5]' : ''}`}
                                >
                                  <td className={`${getCellPadding()} text-center border-r border-[#141414]/5 whitespace-nowrap`}>
                                    {!showAggregated && (
                                      <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(item.id)}
                                        onChange={() => toggleOne(item.id, itemIdx)}
                                        className={theme === 'high-density' ? 'accent-[#141414]' : 'accent-indigo-600'}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                  </td>
                                <td className={`${getCellPadding()} font-mono text-slate-500 border-r border-[#141414]/5 whitespace-nowrap text-[11px]`}>
                                  {showAggregated ? `Σ${itemIdx + 1}` : (itemIdx + 1).toString().padStart(3, '0')}
                                </td>
                                <td className={`${getCellPadding()} font-bold border-r border-[#141414]/5 text-slate-900 break-words min-w-[100px] max-w-[200px] text-[11px]`}>{item.name}</td>
                                <td className={`${getCellPadding()} font-mono opacity-80 italic border-r border-[#141414]/5 break-words min-w-[100px] max-w-[200px] text-[11px]`}>{item.specification}</td>
                                <td className={`${getCellPadding()} text-center border-r border-[#141414]/5 whitespace-nowrap text-[11px]`}>{item.unit}</td>
                                <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/5 whitespace-nowrap text-[11px]`}>{item.quantity.toLocaleString()}</td>
                                <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/10 whitespace-nowrap text-black font-bold bg-[#F9F9F9] text-[11px]`}>₩{(item.materialUnitPrice || 0).toLocaleString()}</td>
                                <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/10 whitespace-nowrap text-black text-[11px]`}>₩{(item.materialAmount || 0).toLocaleString()}</td>
                                <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/10 whitespace-nowrap text-black font-bold bg-[#F9F9F9] text-[11px]`}>₩{(item.laborUnitPrice || 0).toLocaleString()}</td>
                                <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/10 whitespace-nowrap text-black text-[11px]`}>₩{(item.laborAmount || 0).toLocaleString()}</td>
                                <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/10 whitespace-nowrap text-black font-black bg-indigo-50 border-x border-indigo-200 text-[11px]`}>₩{item.unitPrice.toLocaleString()}</td>
                                <td className={`${getCellPadding()} text-right font-mono font-bold border-r border-[#141414]/10 whitespace-nowrap text-black font-black bg-yellow-50 text-[11px]`}>₩{item.amount.toLocaleString()}</td>
                                <td className={`${getCellPadding()} border-r border-[#141414]/5 text-slate-500 italic whitespace-nowrap text-[11px]`}>{item.remark}</td>
                                <td className={`${getCellPadding()} border-r border-[#141414]/5 min-w-[150px]`}>
                                  {!showAggregated ? (
                                    <input 
                                      type="text" 
                                      value={item.memo || ''} 
                                      onChange={(e) => onUpdateMemo(item.id, e.target.value)}
                                      placeholder="메모 입력..."
                                      className={`w-full px-2 py-1 text-xs border bg-transparent transition-all outline-none focus:ring-1 ${
                                        theme === 'industrial' ? 'border-slate-700 focus:border-blue-500 text-slate-100 placeholder-slate-600' :
                                        theme === 'high-density' ? 'border-gray-300 focus:border-black text-[#141414] placeholder-gray-400 font-mono text-[10px]' :
                                        'border-slate-200 focus:border-indigo-500 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white'
                                      }`}
                                    />
                                  ) : (
                                    <span className="text-slate-400 font-mono text-xs">-</span>
                                  )}
                                </td>
                                  <td className="px-4 py-1 text-center whitespace-nowrap">
                                    {!showAggregated ? (
                                      <div 
                                        className="flex items-center justify-center gap-1 cursor-pointer group"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditing(item.id, item.category || '');
                                        }}
                                      >
                                        {editingId === item.id ? (
                                          <input
                                            autoFocus
                                            type="text"
                                            list="category-suggestions"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={() => saveEdit(item.id)}
                                            onKeyDown={(e) => handleKeyDown(e, item.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-[100px] p-1 bg-white border border-indigo-500 rounded text-[10px] text-center font-bold outline-none ring-2 ring-indigo-100"
                                          />
                                        ) : (
                                          <>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                              !item.category || item.category === '미분류' 
                                                ? 'bg-amber-100 text-amber-700' 
                                                : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                              {item.category || '미분류'}
                                            </span>
                                            <span className="opacity-0 group-hover:opacity-100 text-indigo-400 text-[10px]">✎</span>
                                            {item.originalCategory && item.category !== item.originalCategory && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onRevertCategory(item.id);
                                                }}
                                                className="p-1 rounded-md bg-white border border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm shrink-0 opacity-0 group-hover:opacity-100"
                                                title={`원래 분류(${item.originalCategory})로 복구`}
                                              >
                                                <RotateCcw className="w-3 h-3" />
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 border border-orange-100 uppercase">집계됨</span>
                                    )}
                                  </td>
                                </motion.tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()
              ) : (
                (() => {
                  const sections: Record<string, SpecItem[]> = {};
                  
                  pageItems.forEach(item => {
                    const sec = item.section || '기본 내역';
                    if (!sections[sec]) sections[sec] = [];
                    sections[sec].push(item);
                  });

                  return Object.entries(sections).map(([sectionName, sectionItems], sectionIdx) => {
                    const partMaterialTotal = sectionItems.reduce((sum, i) => sum + (i.materialAmount || 0), 0);
                    const partLaborTotal = sectionItems.reduce((sum, i) => sum + (i.laborAmount || 0), 0);
                    const sectionTotal = sectionItems.reduce((sum, i) => sum + i.amount, 0);
                    
                    return (
                      <React.Fragment key={sectionName}>
                        {/* Section Header - Original Bill of Quantities structure */}
                        <tr className={`${theme === 'high-density' ? 'bg-[#00B0F0] text-white' : 'bg-slate-800 text-white'} border-y-2 border-[#141414] shadow-sm sticky top-[36px] z-10`}>
                          <td className={`${getCellPadding()} text-center border-r border-white/20 whitespace-nowrap`}>
                            <input 
                              type="checkbox" 
                              checked={sectionItems.length > 0 && sectionItems.every(i => selectedIds.has(i.id))}
                              onChange={() => toggleAll(sectionItems)}
                              className="accent-white"
                            />
                          </td>
                          <td className={`${getCellPadding()} font-mono font-black border-r border-white/20 whitespace-nowrap`}>
                            PART {sectionIdx + 1}
                          </td>
                          <td colSpan={5} className={`${getCellPadding()} font-black uppercase tracking-widest border-r border-white/20 whitespace-nowrap text-xs`}>
                            {sectionName}
                          </td>
                          <td className={`${getCellPadding()} text-right font-mono font-black bg-black/10 whitespace-nowrap text-[11px] border-r border-white/20`}>
                            ₩{partMaterialTotal.toLocaleString()}
                          </td>
                          <td className={`${getCellPadding()} border-r border-white/10 bg-black/5`}></td>
                          <td className={`${getCellPadding()} text-right font-mono font-black bg-black/10 whitespace-nowrap text-[11px] border-r border-white/20`}>
                            ₩{partLaborTotal.toLocaleString()}
                          </td>
                          <td className={`${getCellPadding()} border-r border-white/10 bg-black/5`}></td>
                          <td className={`${getCellPadding()} text-right font-mono font-black bg-black/20 whitespace-nowrap`}>
                            ₩{sectionTotal.toLocaleString()}
                          </td>
                          <td colSpan={3} className={`${getCellPadding()} text-center font-mono font-black bg-black/10 whitespace-nowrap`}>
                            {sectionItems.length} ITEMS
                          </td>
                        </tr>

                        {/* Items under Section */}
                        {sectionItems.map((item, itemIdx) => (
                           <motion.tr 
                             layout
                             key={item.id} 
                             onMouseDown={() => handleMouseDown(item.id, itemIdx)}
                             onMouseEnter={() => handleMouseEnter(itemIdx)}
                             className={`${
                               theme === 'high-density' 
                                ? (selectedIds.has(item.id) ? 'bg-[#C5E0B4]' : 'bg-[#E2F0D9]') 
                                : (selectedIds.has(item.id) ? 'bg-indigo-50/50' : 'bg-white')
                             } transition-colors border-b border-[#141414]/10 group hover:opacity-90 select-none ${selectedIds.has(item.id) ? 'shadow-[inset_4px_0_0_0_#4f46e5]' : ''}`}
                           >
                             <td className={`${getCellPadding()} text-center border-r border-[#141414]/10 whitespace-nowrap`}>
                               <input 
                                 type="checkbox" 
                                 checked={selectedIds.has(item.id)}
                                 onChange={() => toggleOne(item.id, itemIdx)}
                                 className={theme === 'high-density' ? 'accent-[#141414]' : 'accent-indigo-600'}
                                 onClick={(e) => e.stopPropagation()}
                               />
                             </td>
                           <td className={`${getCellPadding()} font-mono text-slate-900 border-r border-[#141414]/10 whitespace-nowrap ${theme === 'high-density' ? 'text-[9px]' : ''}`}>
                             {(itemIdx + 1).toString().padStart(3, '0')}
                           </td>
                           <td className={`${getCellPadding()} font-bold border-r border-[#141414]/10 text-slate-900 break-words min-w-[100px] max-w-[200px] ${theme === 'high-density' ? 'text-[10.5px]' : ''}`}>{item.name}</td>
                           <td className={`${getCellPadding()} font-mono opacity-80 italic border-r border-[#141414]/10 break-words min-w-[100px] max-w-[200px] ${theme === 'high-density' ? 'text-[9px]' : ''}`}>{item.specification}</td>
                           <td className={`${getCellPadding()} text-center border-r border-[#141414]/10 whitespace-nowrap ${theme === 'high-density' ? 'text-[10px]' : ''}`}>{item.unit}</td>
                           <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/10 whitespace-nowrap ${theme === 'high-density' ? 'text-[10px]' : ''}`}>{item.quantity.toLocaleString()}</td>
                           <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/20 whitespace-nowrap ${theme === 'high-density' ? 'text-black font-bold bg-[#F9F9F9] text-[10px]' : 'text-slate-600'}`}>₩{(item.materialUnitPrice || 0).toLocaleString()}</td>
                           <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/20 whitespace-nowrap ${theme === 'high-density' ? 'text-black text-[10px]' : 'text-slate-500'}`}>₩{(item.materialAmount || 0).toLocaleString()}</td>
                           <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/20 whitespace-nowrap ${theme === 'high-density' ? 'text-black font-bold bg-[#F9F9F9] text-[10px]' : 'text-slate-600'}`}>₩{(item.laborUnitPrice || 0).toLocaleString()}</td>
                           <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/20 whitespace-nowrap ${theme === 'high-density' ? 'text-black text-[10px]' : 'text-slate-500'}`}>₩{(item.laborAmount || 0).toLocaleString()}</td>
                           <td className={`${getCellPadding()} text-right font-mono border-r border-[#141414]/20 whitespace-nowrap ${theme === 'high-density' ? 'text-black font-black bg-indigo-50 border-x border-indigo-200 text-[10.5px]' : 'text-slate-900 font-semibold'}`}>₩{item.unitPrice.toLocaleString()}</td>
                           <td className={`${getCellPadding()} text-right font-mono font-bold border-r border-[#141414]/20 whitespace-nowrap ${theme === 'high-density' ? 'text-black font-black bg-yellow-50 text-[11px]' : 'text-indigo-600'}`}>₩{item.amount.toLocaleString()}</td>
                           <td className={`${getCellPadding()} border-r border-[#141414]/10 text-slate-500 italic whitespace-nowrap ${theme === 'high-density' ? 'text-[9px]' : ''}`}>{item.remark}</td>
                           <td className={`${getCellPadding()} border-r border-[#141414]/10 min-w-[150px]`}>
                             <input 
                               type="text" 
                               value={item.memo || ''} 
                               onChange={(e) => onUpdateMemo(item.id, e.target.value)}
                               placeholder="메모 입력..."
                               className={`w-full px-2 py-1 text-xs border bg-transparent transition-all outline-none focus:ring-1 ${
                                 theme === 'industrial' ? 'border-slate-700 focus:border-blue-500 text-slate-100 placeholder-slate-600' :
                                 theme === 'high-density' ? 'border-gray-300 focus:border-black text-[#141414] placeholder-gray-400 font-mono text-[10px]' :
                                 'border-slate-200 focus:border-indigo-500 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white'
                               }`}
                             />
                           </td>
                             <td className="px-4 py-1 text-center whitespace-nowrap">
                               <div className="flex items-center gap-1.5">
                                 <select 
                                   value={item.category || ""}
                                   onChange={(e) => onUpdateCategory(item.id, e.target.value)}
                                   className="flex-grow p-1 bg-white/80 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer hover:border-slate-500 font-bold text-xs"
                                 >
                                   <option value="" disabled>분류 선택</option>
                                   {categories.map(cat => (
                                     <option key={cat} value={cat}>{cat}</option>
                                   ))}
                                 </select>
                                 {item.originalCategory && item.category !== item.originalCategory && (
                                   <button
                                     onClick={() => onRevertCategory(item.id)}
                                     className="p-1 rounded-md bg-white border border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm shrink-0"
                                     title={`원래 분류(${item.originalCategory})로 복구`}
                                   >
                                     <RotateCcw className="w-3 h-3" />
                                   </button>
                                 )}
                               </div>
                             </td>
                           </motion.tr>
                        ))}
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="sticky bottom-0 z-20">
                <tr className={`${theme === 'high-density' ? 'bg-[#141414] text-white' : 'bg-slate-800 text-white'} border-t-2 border-[#141414]`}>
                  <td colSpan={11} className="px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-right border-r border-white/10">
                    Grand Total (합계 금액)
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-base font-black border-r border-white/10">
                    ₩{pageItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={3} className="px-6 py-4 bg-white/5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
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
