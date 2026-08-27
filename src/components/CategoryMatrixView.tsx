import React, { useState, useMemo, useRef } from 'react';
import { SpecItem, ThemeType } from '../types';
import {
  Download,
  Printer,
  Search,
  Filter,
  Columns,
  Layers,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import { exportStyledExcel } from '../utils/excelExport';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  projectName?: string;
  onOpenCategoryManager?: () => void;
}

interface MatrixItemRow {
  key: string;
  category: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
  totalAmount: number;
  sectionQuantities: Record<string, number>;
}

interface MatrixCategoryGroup {
  category: string;
  items: MatrixItemRow[];
  subtotalQuantity: number;
  subtotalAmount: number;
  sectionSubtotals: Record<string, number>;
}

export default function CategoryMatrixView({
  items,
  theme,
  categories,
  projectName = '기계설비공사',
  onOpenCategoryManager
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPageGuides, setShowPageGuides] = useState(true);
  const [hideZeroQty, setHideZeroQty] = useState(true);
  const [autoHideEmptySectionCols, setAutoHideEmptySectionCols] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [isSectionPickerOpen, setIsSectionPickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // 1. Extract and normalize all unique sections (공종/구간)
  const allSections = useMemo(() => {
    const sectionSet = new Set<string>();
    items.forEach(item => {
      const sec = (item.section || '기타 공정').trim();
      if (sec) sectionSet.add(sec);
    });

    // If empty, supply default standard construction sections
    if (sectionSet.size === 0) {
      return [
        '옥외 (위생)',
        '기계실 (위생)',
        '세대내 급수급탕 (36m2)',
        '세대내 급수급탕 (45m2)',
        '세대내 급수급탕 (59m2)',
        '세대내 급수급탕 (84m2)',
        '세대외 (급수)',
        '주차장 (급수)',
        '주차장 (배수)',
        '근생 (급수급탕)',
        '부대시설 (급수급탕)'
      ];
    }

    return Array.from(sectionSet);
  }, [items]);

  // 2. Extract available categories with their item count and total quantity
  const availableCategories = useMemo(() => {
    const map = new Map<string, { count: number; totalQty: number }>();
    items.forEach(item => {
      const cat = (item.category || '미분류').trim() || '미분류';
      const qty = item.quantity || 0;
      const cur = map.get(cat) || { count: 0, totalQty: 0 };
      cur.count += 1;
      cur.totalQty += qty;
      map.set(cat, cur);
    });

    const allKeys = Array.from(map.keys());
    const ordered = [
      ...categories.filter(c => allKeys.includes(c)),
      ...allKeys.filter(c => !categories.includes(c))
    ];

    return ordered.map(cat => ({
      name: cat,
      count: map.get(cat)?.count || 0,
      totalQty: map.get(cat)?.totalQty || 0
    }));
  }, [items, categories]);

  // 3. Aggregate data by (Category -> Name + Spec + Unit + UnitPrice)
  const groupedData = useMemo<MatrixCategoryGroup[]>(() => {
    if (!items || items.length === 0) return [];

    const categoryMap = new Map<string, Map<string, MatrixItemRow>>();

    items.forEach(item => {
      const cat = (item.category || '미분류').trim() || '미분류';
      const name = (item.name || '').trim();
      const spec = (item.specification || '').trim();
      const unit = (item.unit || 'EA').trim() || 'EA';
      const unitPrice = item.materialUnitPrice || item.unitPrice || 0;
      const section = (item.section || '기타 공정').trim() || '기타 공정';
      const quantity = item.quantity || 0;
      const amount = item.amount || (quantity * unitPrice);

      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, new Map<string, MatrixItemRow>());
      }

      const itemMap = categoryMap.get(cat)!;
      const itemKey = `${name}:::${spec}:::${unit}:::${unitPrice}`;

      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, {
          key: itemKey,
          category: cat,
          name,
          specification: spec,
          unit,
          unitPrice,
          totalQuantity: 0,
          totalAmount: 0,
          sectionQuantities: {}
        });
      }

      const row = itemMap.get(itemKey)!;
      row.totalQuantity += quantity;
      row.totalAmount += amount;
      row.sectionQuantities[section] = (row.sectionQuantities[section] || 0) + quantity;
    });

    // Build Category Groups
    const result: MatrixCategoryGroup[] = [];

    // Ensure defined categories order first, then any extra
    const allCatKeys = Array.from(categoryMap.keys());
    const orderedCats = [
      ...categories.filter(c => allCatKeys.includes(c)),
      ...allCatKeys.filter(c => !categories.includes(c))
    ];

    orderedCats.forEach(cat => {
      const itemMap = categoryMap.get(cat);
      if (!itemMap || itemMap.size === 0) return;

      const rawItems = Array.from(itemMap.values());

      // Filter by search term and zero quantity
      const filteredItems = rawItems.filter(item => {
        // If hideZeroQty is ON, hide items where totalQuantity <= 0
        if (hideZeroQty && item.totalQuantity <= 0) return false;

        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.specification.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      });

      if (filteredItems.length === 0) return;

      // Calculate Subtotals for category
      let subtotalQty = 0;
      let subtotalAmt = 0;
      const sectionSubtotals: Record<string, number> = {};

      filteredItems.forEach(item => {
        subtotalQty += item.totalQuantity;
        subtotalAmt += item.totalAmount;
        Object.entries(item.sectionQuantities).forEach(([sec, q]) => {
          sectionSubtotals[sec] = (sectionSubtotals[sec] || 0) + Number(q || 0);
        });
      });

      // If hideZeroQty is ON, hide category if subtotal quantity <= 0
      if (hideZeroQty && subtotalQty <= 0) return;

      result.push({
        category: cat,
        items: filteredItems,
        subtotalQuantity: subtotalQty,
        subtotalAmount: subtotalAmt,
        sectionSubtotals
      });
    });

    // Filter by selected category dropdown
    if (selectedCategory !== 'all') {
      return result.filter(g => g.category === selectedCategory);
    }

    return result;
  }, [items, categories, searchTerm, selectedCategory, hideZeroQty]);

  // 4. Calculate Grand Totals & Section Totals across current view
  const grandTotal = useMemo(() => {
    let totalQty = 0;
    let totalAmt = 0;
    const sectionTotals: Record<string, number> = {};

    groupedData.forEach(group => {
      totalQty += group.subtotalQuantity;
      totalAmt += group.subtotalAmount;
      Object.entries(group.sectionSubtotals).forEach(([sec, q]) => {
        sectionTotals[sec] = (sectionTotals[sec] || 0) + Number(q || 0);
      });
    });

    return {
      totalQty,
      totalAmt,
      sectionTotals
    };
  }, [groupedData]);

  // 5. Visible sections list based on hidden toggle & Zero Quantity Column Auto-Hide
  const visibleSections = useMemo(() => {
    return allSections.filter(sec => {
      // If user explicitly hid this section in picker
      if (hiddenSections[sec]) return false;

      // If auto-hide empty section columns is ON and total sum across active items is 0
      const totalQtyForSection = grandTotal.sectionTotals[sec] || 0;
      if (autoHideEmptySectionCols && totalQtyForSection <= 0) return false;

      return true;
    });
  }, [allSections, hiddenSections, autoHideEmptySectionCols, grandTotal.sectionTotals]);

  // 6. Parse section headers into 2-tier (대공종 / 세부구간)
  const parsedSections = useMemo(() => {
    return visibleSections.map(sec => {
      // Check if format contains separator like "기계설비 > 옥외 (위생)" or code like "010102 옥외배관공사"
      let mainGroup = '기계설비';
      let subGroup = sec;

      if (sec.includes('>')) {
        const parts = sec.split('>');
        mainGroup = parts[0].trim();
        subGroup = parts.slice(1).join('>').trim();
      } else if (sec.includes(':')) {
        const parts = sec.split(':');
        mainGroup = parts[0].trim();
        subGroup = parts.slice(1).join(':').trim();
      } else if (/^\d+/.test(sec)) {
        // Strip leading numbers like "010102 옥외배관공사" -> main: "기계설비", sub: "옥외배관공사"
        subGroup = sec.replace(/^\d+[\s._-]*/, '').trim() || sec;
      }

      return {
        raw: sec,
        mainGroup,
        subGroup
      };
    });
  }, [visibleSections]);

  // Total items count across groups
  const totalItemCount = useMemo(() => {
    return groupedData.reduce((sum: number, g: MatrixCategoryGroup) => sum + g.items.length, 0);
  }, [groupedData]);

  // Toggle Collapse Category
  const toggleCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groupedData.forEach(g => {
      next[g.category] = true;
    });
    setCollapsedCategories(next);
  };

  const expandAll = () => {
    setCollapsedCategories({});
  };

  // Direct Excel Download handler
  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportStyledExcel({
        projectName: projectName || '기계설비_공정분리',
        items,
        categories
      });
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  const isHighDensity = theme === 'high-density';

  return (
    <div className="flex flex-col flex-grow w-full space-y-4 font-sans print:p-0 print:m-0">
      {/* Top Action & Control Bar */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isHighDensity
            ? 'bg-[#E7E6E1] border-[#141414] text-black shadow-sm'
            : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        } print:hidden`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Info Badge */}
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isHighDensity
                  ? 'bg-[#141414] text-white'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  카테고리별 공정·구간별 집계표 (Matrix 양식)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  도면 내역 표준 서식
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                현장명: <strong>{projectName}</strong> | 총 {groupedData.length}개 카테고리 / {totalItemCount.toLocaleString()}개 규격 집계 | 총 공사비: <strong>₩{grandTotal.totalAmt.toLocaleString()}</strong>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Zero Quantity Items Hide/Show Toggle */}
            <button
              type="button"
              onClick={() => setHideZeroQty(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                hideZeroQty
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="수량이 0인 품목 및 카테고리를 표에서 숨김/표시"
            >
              <Filter size={14} />
              <span>수량 0 품목 숨김 {hideZeroQty ? 'ON' : 'OFF'}</span>
            </button>

            {/* Zero Quantity Section Column Auto-Hide Toggle */}
            <button
              type="button"
              onClick={() => setAutoHideEmptySectionCols(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                autoHideEmptySectionCols
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="선택된 카테고리/내역 중 합계 수량이 0인 구간 열을 표에서 자동으로 숨김/표시"
            >
              <Columns size={14} />
              <span>합수량 0 구간열 숨김 {autoHideEmptySectionCols ? 'ON' : 'OFF'}</span>
            </button>

            {/* Page Guide Toggle */}
            <button
              type="button"
              onClick={() => setShowPageGuides(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                showPageGuides
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="A4/A3 인쇄용 페이지 구분선 및 워터마크 표시"
            >
              {showPageGuides ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>페이지 가이드 {showPageGuides ? 'ON' : 'OFF'}</span>
            </button>

            {/* Section Column Filter */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSectionPickerOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <Columns size={14} />
                <span>구간 열 ({visibleSections.length}/{allSections.length})</span>
                <ChevronDown size={13} />
              </button>

              {isSectionPickerOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-800">구간 열 표시 설정</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHiddenSections({});
                          setAutoHideEmptySectionCols(false);
                        }}
                        className="text-[11px] text-indigo-600 hover:underline font-bold"
                      >
                        전체 표시
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">합수량 0 구간열 자동 숨김</span>
                    <input
                      type="checkbox"
                      checked={autoHideEmptySectionCols}
                      onChange={e => setAutoHideEmptySectionCols(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {allSections.map(sec => {
                      const totalQty = grandTotal.sectionTotals[sec] || 0;
                      const isAutoHidden = autoHideEmptySectionCols && totalQty <= 0;
                      const isChecked = !hiddenSections[sec] && !isAutoHidden;

                      return (
                        <label
                          key={sec}
                          className={`flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors ${
                            isAutoHidden ? 'opacity-50 bg-slate-50/60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <span className="truncate text-xs">{sec}</span>
                            {totalQty > 0 ? (
                              <span className="text-[10px] text-indigo-600 font-bold shrink-0">
                                ({totalQty.toLocaleString()})
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 py-0.2 bg-slate-200/80 text-slate-600 rounded font-medium shrink-0">
                                0
                              </span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isAutoHidden) {
                                // If user manually checks an auto-hidden column, disable autoHide or remove from hidden
                                setAutoHideEmptySectionCols(false);
                                setHiddenSections(prev => {
                                  const next = { ...prev };
                                  delete next[sec];
                                  return next;
                                });
                              } else {
                                setHiddenSections(prev => ({
                                  ...prev,
                                  [sec]: isChecked
                                }));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all cursor-pointer"
            >
              <Printer size={14} />
              <span>인쇄 / PDF 출력</span>
            </button>

            {/* Excel Download Button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? '엑셀 생성 중...' : '엑셀 다운로드 (서식 포함)'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search input */}
            <div className="relative min-w-[220px] max-w-sm flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="품명, 규격, 카테고리 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category dropdown filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">카테고리:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 text-slate-700 cursor-pointer"
              >
                <option value="all">전체 카테고리 ({groupedData.length}개 표시)</option>
                {availableCategories
                  .filter(cat => (!hideZeroQty || cat.totalQty > 0))
                  .map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} {cat.totalQty > 0 ? `(${cat.totalQty.toLocaleString()} EA)` : '(수량 0)'}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              모두 펼치기
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              모두 접기
            </button>
          </div>
        </div>
      </div>

      {/* Main Matrix Table Container */}
      <div
        ref={printContainerRef}
        className={`relative overflow-x-auto rounded-2xl border shadow-md ${
          isHighDensity
            ? 'bg-white border-[#141414]'
            : 'bg-white border-slate-300'
        } print:border-none print:shadow-none print:rounded-none`}
      >
        <table className="w-full border-collapse text-[11px] text-slate-800 leading-tight">
          {/* Table Header: 2-Tier Header matching the construction sheet */}
          <thead className="sticky top-0 z-30 bg-slate-100 text-slate-900 select-none shadow-xs">
            {/* Top Tier Header */}
            <tr className="border-b border-slate-400 bg-[#E2E8F0] font-bold text-center">
              <th
                rowSpan={2}
                className="border-r border-slate-300 px-3 py-2 text-left min-w-[140px] max-w-[180px]"
              >
                품 명
              </th>
              <th
                rowSpan={2}
                className="border-r border-slate-300 px-2.5 py-2 text-center min-w-[90px]"
              >
                규 격
              </th>
              <th
                rowSpan={2}
                className="border-r border-slate-300 px-2 py-2 text-center min-w-[45px]"
              >
                단위
              </th>
              {/* 내역물량 3-Column Spanning Header */}
              <th
                colSpan={3}
                className="border-r-2 border-slate-400 px-3 py-1.5 text-center bg-[#CBD5E1] text-slate-900"
              >
                내역물량
              </th>
              {/* Section Matrix 2-Tier Headers */}
              {parsedSections.map((sec, idx) => (
                <th
                  key={`top-sec-${idx}`}
                  className="border-r border-slate-300 px-2 py-1.5 text-center min-w-[72px] bg-[#E2E8F0] text-[10px] truncate"
                  title={sec.raw}
                >
                  {sec.mainGroup}
                </th>
              ))}
            </tr>

            {/* Bottom Tier Header */}
            <tr className="border-b-2 border-slate-400 bg-[#F1F5F9] font-bold text-center text-[10px]">
              {/* Sub-headers for 내역물량 */}
              <th className="border-r border-slate-300 px-2 py-1 text-right min-w-[65px] bg-[#F1F5F9]">
                수량(M)
              </th>
              <th className="border-r border-slate-300 px-2 py-1 text-right min-w-[75px] bg-[#F1F5F9]">
                단가
              </th>
              <th className="border-r-2 border-slate-400 px-2 py-1 text-right min-w-[85px] bg-[#E2E8F0] text-indigo-950 font-extrabold">
                금액
              </th>
              {/* Sub-headers for sections (e.g. 옥외 위생, 기계실, etc.) */}
              {parsedSections.map((sec, idx) => (
                <th
                  key={`sub-sec-${idx}`}
                  className="border-r border-slate-300 px-1.5 py-1 text-center min-w-[72px] font-semibold text-slate-700 whitespace-pre-wrap leading-tight bg-[#F8FAFC]"
                  title={sec.raw}
                >
                  {sec.subGroup}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body: Grouped by Category */}
          <tbody>
            {groupedData.length === 0 ? (
              <tr>
                <td
                  colSpan={6 + visibleSections.length}
                  className="py-16 text-center text-slate-400"
                >
                  <Info size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-sm">표시할 집계 데이터가 없습니다.</p>
                  <p className="text-xs mt-1">상단에서 내역서를 업로드하거나 검색 필터를 조정해 보세요.</p>
                </td>
              </tr>
            ) : (
              groupedData.map((group, groupIdx) => {
                const isCollapsed = collapsedCategories[group.category];
                return (
                  <React.Fragment key={`cat-group-${group.category}`}>
                    {/* Category Header Banner if needed or directly items */}
                    {!isCollapsed &&
                      group.items.map((item, itemIdx) => {
                        // Check if previous item had the same name for optical grouping
                        const prevItem = itemIdx > 0 ? group.items[itemIdx - 1] : null;
                        const isSameNameAsPrev = prevItem && prevItem.name === item.name;

                        return (
                          <tr
                            key={`item-${item.key}-${itemIdx}`}
                            className={`border-b border-slate-200 transition-colors hover:bg-amber-50/40 ${
                              itemIdx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                            }`}
                          >
                            {/* 품 명 */}
                            <td
                              className={`border-r border-slate-300 px-3 py-1.5 font-medium text-slate-900 ${
                                isSameNameAsPrev ? 'text-slate-400 pl-5 text-[10px]' : 'font-bold'
                              }`}
                            >
                              {item.name || '-'}
                            </td>

                            {/* 규 격 */}
                            <td className="border-r border-slate-300 px-2 py-1.5 text-center font-mono text-slate-700">
                              {item.specification || '-'}
                            </td>

                            {/* 단 위 */}
                            <td className="border-r border-slate-300 px-1 py-1.5 text-center text-slate-500">
                              {item.unit || 'EA'}
                            </td>

                            {/* 수량(M) */}
                            <td className="border-r border-slate-300 px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                              {item.totalQuantity > 0 ? item.totalQuantity.toLocaleString() : '-'}
                            </td>

                            {/* 단가 */}
                            <td className="border-r border-slate-300 px-2 py-1.5 text-right font-mono text-slate-600">
                              {item.unitPrice > 0 ? item.unitPrice.toLocaleString() : '-'}
                            </td>

                            {/* 금액 */}
                            <td className="border-r-2 border-slate-400 px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
                              {item.totalAmount > 0 ? item.totalAmount.toLocaleString() : '-'}
                            </td>

                            {/* Section Quantities */}
                            {parsedSections.map((sec, sIdx) => {
                              const q = item.sectionQuantities[sec.raw] || 0;
                              return (
                                <td
                                  key={`val-${item.key}-${sIdx}`}
                                  className={`border-r border-slate-300 px-1.5 py-1.5 text-center font-mono text-xs ${
                                    q > 0
                                      ? 'text-slate-900 font-semibold bg-amber-50/20'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {q > 0 ? q.toLocaleString() : ''}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                    {/* Category Subtotal Row (소계) - Golden / Earthy Olive highlight as shown in user's image */}
                    <tr
                      onClick={() => toggleCollapse(group.category)}
                      className="border-b-2 border-slate-400 bg-[#D4C287] hover:bg-[#C9B678] text-slate-950 font-bold select-none cursor-pointer transition-colors"
                      title="클릭하여 이 카테고리 접기/펼치기"
                    >
                      {/* Col 1: Category Name */}
                      <td className="border-r border-slate-400/80 px-3 py-2 text-left flex items-center justify-between">
                        <span className="font-extrabold tracking-wide">{group.category}</span>
                        <span className="text-[10px] opacity-70 ml-1">
                          {isCollapsed ? `[접힘 - ${group.items.length}개 품목]` : ''}
                        </span>
                      </td>

                      {/* Col 2: Representative Unit (EA) */}
                      <td className="border-r border-slate-400/80 px-2 py-2 text-center">
                        EA
                      </td>

                      {/* Col 3: '소계' Label */}
                      <td className="border-r border-slate-400/80 px-2 py-2 text-center font-extrabold text-[11px]">
                        소계
                      </td>

                      {/* Col 4: Subtotal Quantity */}
                      <td className="border-r border-slate-400/80 px-2 py-2 text-right font-mono font-extrabold">
                        {group.subtotalQuantity > 0 ? group.subtotalQuantity.toLocaleString() : '-'}
                      </td>

                      {/* Col 5: Unit Price Placeholder */}
                      <td className="border-r border-slate-400/80 px-2 py-2 text-center text-slate-600">
                        -
                      </td>

                      {/* Col 6: Subtotal Total Amount */}
                      <td className="border-r-2 border-slate-500 px-2 py-2 text-right font-mono font-black text-slate-950">
                        {group.subtotalAmount.toLocaleString()}
                      </td>

                      {/* Section Subtotal Quantities */}
                      {parsedSections.map((sec, sIdx) => {
                        const secSubtotal = group.sectionSubtotals[sec.raw] || 0;
                        return (
                          <td
                            key={`cat-sub-${group.category}-${sIdx}`}
                            className="border-r border-slate-400/80 px-1.5 py-2 text-center font-mono font-bold text-slate-900"
                          >
                            {secSubtotal > 0 ? secSubtotal.toLocaleString() : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })
            )}

            {/* Page Guide Marker (Multi-page watermark like shown in user image) */}
            {showPageGuides && groupedData.length > 0 && (
              <tr className="bg-slate-100 border-y border-dashed border-indigo-300 print:hidden select-none">
                <td
                  colSpan={6 + visibleSections.length}
                  className="py-1 text-center font-bold text-[10px] text-indigo-600 tracking-widest bg-indigo-50/70"
                >
                  --- 인쇄 페이지 구분 기준 영역 (A4 / A3 가로 양식 매트릭스) ---
                </td>
              </tr>
            )}

            {/* Grand Total Row (합 계) - Highlighted in distinct light green/blue band */}
            {groupedData.length > 0 && (
              <tr className="border-t-2 border-b-2 border-slate-600 bg-[#CFE2F3] text-slate-950 font-black text-xs select-none">
                {/* Merged Title: 합 계 */}
                <td
                  colSpan={3}
                  className="border-r border-slate-400 px-4 py-2.5 text-center tracking-widest text-sm font-black"
                >
                  합 계 (GRAND TOTAL)
                </td>

                {/* Grand Total Quantity */}
                <td className="border-r border-slate-400 px-2 py-2.5 text-right font-mono font-black text-sm">
                  {grandTotal.totalQty.toLocaleString()}
                </td>

                {/* Blank Unit Price */}
                <td className="border-r border-slate-400 px-2 py-2.5 text-center text-slate-500">
                  -
                </td>

                {/* Grand Total Amount */}
                <td className="border-r-2 border-slate-500 px-3 py-2.5 text-right font-mono font-black text-sm text-indigo-950 bg-[#B8D5E5]">
                  ₩{grandTotal.totalAmt.toLocaleString()}
                </td>

                {/* Grand Total Quantities per Section */}
                {parsedSections.map((sec, sIdx) => {
                  const totalSecQ = grandTotal.sectionTotals[sec.raw] || 0;
                  return (
                    <td
                      key={`grand-sec-${sIdx}`}
                      className="border-r border-slate-400 px-1.5 py-2.5 text-center font-mono font-black text-slate-950"
                    >
                      {totalSecQ > 0 ? totalSecQ.toLocaleString() : '-'}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Notes & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 px-1 print:hidden">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-500" />
          <span>
            카테고리 소계 행(금색)을 클릭하면 해당 항목들을 접거나 펼칠 수 있으며, <strong>[엑셀 다운로드]</strong> 시 동일한 구간별 수량 매트릭스가 엑셀 시트에 그대로 보존됩니다.
          </span>
        </div>
        <div>
          <span>출력 일자: {new Date().toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    </div>
  );
}
