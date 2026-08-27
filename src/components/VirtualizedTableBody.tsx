import React, { CSSProperties } from 'react';
import { List } from 'react-window';
import { SpecItem, ThemeType } from '../types';
import { RotateCcw } from 'lucide-react';

export type VirtualRowData = 
  | { type: 'section-header'; sectionName: string; index: number; materialTotal: number; laborTotal: number; total: number; count: number; items: SpecItem[] }
  | { type: 'category-header'; catName: string; catIdx: number; materialTotal: number; laborTotal: number; total: number; count: number; items: SpecItem[] }
  | { type: 'category-sub-header'; secName: string; count: number }
  | { type: 'item'; item: SpecItem; itemIdx: number; isAggregated?: boolean };

interface VirtualizedTableBodyProps {
  rows: VirtualRowData[];
  height: number;
  theme: ThemeType;
  density: number;
  selectedIds: Set<string>;
  toggleOne: (id: string, index: number) => void;
  toggleAll: (items: SpecItem[]) => void;
  handleMouseDown: (id: string, index: number) => void;
  handleMouseEnter: (index: number) => void;
  renderRuleIndicator: (item: SpecItem) => React.ReactNode;
  categories: string[];
  onUpdateCategory: (id: string, category: string) => void;
  onAddCategory: (category: string) => void;
  onRevertCategory: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  editingId: string | null;
  editValue: string;
  startEditing: (id: string, currentCategory: string) => void;
  saveEdit: (id: string) => void;
  handleKeyDown: (e: React.KeyboardEvent, id: string) => void;
  setEditValue: (value: string) => void;
  getCellPadding: (isHeader?: boolean) => string;
}

export const VirtualizedTableBody: React.FC<VirtualizedTableBodyProps> = ({
  rows,
  height,
  theme,
  density,
  selectedIds,
  toggleOne,
  toggleAll,
  handleMouseDown,
  handleMouseEnter,
  renderRuleIndicator,
  categories,
  onUpdateCategory,
  onAddCategory,
  onRevertCategory,
  onUpdateMemo,
  editingId,
  editValue,
  startEditing,
  saveEdit,
  handleKeyDown,
  setEditValue,
  getCellPadding
}) => {
  const itemHeight = theme === 'high-density' ? 28 + (density - 2) * 4 : 36 + (density - 2) * 5;
  const isHighDensity = theme === 'high-density';
  const borderCellClass = isHighDensity ? 'border-r border-[#141414]/15' : 'border-r border-slate-100';

  interface RowProps {}

  const Row: React.FC<{
    ariaAttributes: {
      "aria-posinset": number;
      "aria-setsize": number;
      role: "listitem";
    };
    index: number;
    style: CSSProperties;
  } & RowProps> = ({ index, style }) => {
    const row = rows[index];
    if (!row) return null;

    if (row.type === 'category-header') {
      return (
        <div 
          style={style} 
          className={`flex items-center min-w-[1616px] w-full text-xs font-bold ${
            isHighDensity ? 'bg-indigo-700 text-white border-[#141414]' : 'bg-indigo-900 text-white border-slate-800'
          } border-b select-none`}
        >
          <div className="w-[44px] shrink-0 flex items-center justify-center">
            <input 
              type="checkbox" 
              checked={row.items.length > 0 && row.items.every(i => selectedIds.has(i.id))}
              onChange={() => toggleAll(row.items)}
              className="accent-white cursor-pointer"
            />
          </div>
          <div className="w-[50px] shrink-0 font-mono font-black text-center text-[11px] text-indigo-200">
            C{row.catIdx + 1}
          </div>
          <div className="w-[556px] shrink-0 font-black uppercase tracking-wider px-3 truncate text-xs text-white">
            [분류] {row.catName}
          </div>
          <div className="w-[182px] shrink-0 text-right font-mono font-bold px-2 text-indigo-200 text-xs">
            재: ₩{row.materialTotal.toLocaleString()}
          </div>
          <div className="w-[182px] shrink-0 text-right font-mono font-bold px-2 text-indigo-200 text-xs">
            노: ₩{row.laborTotal.toLocaleString()}
          </div>
          <div className="w-[198px] shrink-0 text-right font-mono font-black px-2 text-amber-300 text-xs">
            합: ₩{row.total.toLocaleString()}
          </div>
          <div className="w-[404px] shrink-0 text-right font-mono text-[10px] px-4 text-indigo-200">
            {row.count} ITEMS
          </div>
        </div>
      );
    }

    if (row.type === 'category-sub-header') {
      return (
        <div 
          style={style} 
          className={`flex items-center min-w-[1616px] w-full text-[11px] font-bold ${
            isHighDensity ? 'bg-slate-100 text-slate-800' : 'bg-slate-100/90 text-slate-700'
          } border-b border-slate-200 px-2 select-none`}
        >
          <div className="w-[44px] shrink-0" />
          <div className="w-[50px] shrink-0" />
          <div className="w-[1118px] shrink-0 truncate font-mono px-3 text-slate-700">
            ↳ 공종: <span className="font-bold text-slate-900">{row.secName}</span>
          </div>
          <div className="w-[404px] shrink-0 text-right text-slate-500 font-mono px-4 text-[10px]">
            {row.count}건
          </div>
        </div>
      );
    }

    if (row.type === 'section-header') {
      return (
        <div 
          style={style} 
          className={`flex items-center min-w-[1616px] w-full text-xs font-bold ${
            isHighDensity ? 'bg-[#00B0F0] text-white border-[#141414]' : 'bg-sky-600 text-white border-sky-700'
          } border-b select-none`}
        >
          <div className="w-[44px] shrink-0 flex items-center justify-center">
            <input 
              type="checkbox" 
              checked={row.items.length > 0 && row.items.every(i => selectedIds.has(i.id))}
              onChange={() => toggleAll(row.items)}
              className="accent-white cursor-pointer"
            />
          </div>
          <div className="w-[50px] shrink-0 font-mono font-black text-center text-[10px] text-sky-100">
            P{row.index + 1}
          </div>
          <div className="w-[556px] shrink-0 font-black uppercase tracking-wider px-3 truncate text-xs text-white">
            {row.sectionName}
          </div>
          <div className="w-[182px] shrink-0 text-right font-mono font-bold px-2 text-sky-100 text-xs">
            재: ₩{row.materialTotal.toLocaleString()}
          </div>
          <div className="w-[182px] shrink-0 text-right font-mono font-bold px-2 text-sky-100 text-xs">
            노: ₩{row.laborTotal.toLocaleString()}
          </div>
          <div className="w-[198px] shrink-0 text-right font-mono font-black px-2 text-amber-200 text-xs">
            합: ₩{row.total.toLocaleString()}
          </div>
          <div className="w-[404px] shrink-0 text-right font-mono text-[10px] px-4 text-sky-100">
            {row.count} ITEMS
          </div>
        </div>
      );
    }

    const { item, itemIdx, isAggregated } = row;
    const isSelected = selectedIds.has(item.id);

    return (
      <div 
        style={style}
        onMouseDown={() => handleMouseDown(item.id, itemIdx)}
        onMouseEnter={() => handleMouseEnter(itemIdx)}
        className={`flex items-center min-w-[1616px] w-full border-b text-xs select-none transition-colors ${
          isHighDensity
            ? (isSelected ? 'bg-[#C5E0B4] border-[#2d5a27]/30' : 'bg-white hover:bg-slate-50/80 border-[#141414]/15')
            : (isSelected ? 'bg-indigo-50/90 border-indigo-200' : 'bg-white hover:bg-slate-50 border-slate-100')
        } ${isSelected ? 'shadow-[inset_3px_0_0_0_#4f46e5]' : ''}`}
      >
        {/* 1. Checkbox: 44px */}
        <div className={`w-[44px] h-full shrink-0 flex items-center justify-center ${borderCellClass}`} onClick={(e) => e.stopPropagation()}>
          {!isAggregated && (
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => toggleOne(item.id, itemIdx)}
              className={isHighDensity ? 'accent-[#141414] cursor-pointer' : 'accent-indigo-600 cursor-pointer'}
            />
          )}
        </div>

        {/* 2. No: 50px */}
        <div className={`w-[50px] h-full shrink-0 flex items-center justify-center font-mono text-slate-500 text-[10px] ${borderCellClass}`}>
          {isAggregated ? `Σ${itemIdx + 1}` : (itemIdx + 1).toString().padStart(3, '0')}
        </div>

        {/* 3. Name: 230px */}
        <div className={`w-[230px] h-full shrink-0 flex items-center px-2.5 font-bold text-slate-900 truncate text-[11px] ${borderCellClass}`} title={item.name}>
          <span className="truncate">{item.name}</span>
        </div>

        {/* 4. Spec: 210px */}
        <div className={`w-[210px] h-full shrink-0 flex items-center px-2 text-slate-600 truncate text-[11px] ${borderCellClass}`} title={item.specification}>
          <span className="truncate">{item.specification || '-'}</span>
        </div>

        {/* 5. Unit: 48px */}
        <div className={`w-[48px] h-full shrink-0 flex items-center justify-center text-slate-600 text-[11px] font-medium ${borderCellClass}`}>
          {item.unit || '-'}
        </div>

        {/* 6. Quantity: 68px */}
        <div className={`w-[68px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-800 text-[11px] font-medium ${borderCellClass}`}>
          {item.quantity.toLocaleString()}
        </div>

        {/* 7. Material Unit Price: 84px */}
        <div className={`w-[84px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-600 text-[11px] ${borderCellClass}`}>
          ₩{(item.materialUnitPrice || 0).toLocaleString()}
        </div>

        {/* 8. Material Amount: 98px */}
        <div className={`w-[98px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-700 text-[11px] font-medium ${borderCellClass}`}>
          ₩{(item.materialAmount || 0).toLocaleString()}
        </div>

        {/* 9. Labor Unit Price: 84px */}
        <div className={`w-[84px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-600 text-[11px] ${borderCellClass}`}>
          ₩{(item.laborUnitPrice || 0).toLocaleString()}
        </div>

        {/* 10. Labor Amount: 98px */}
        <div className={`w-[98px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-700 text-[11px] font-medium ${borderCellClass}`}>
          ₩{(item.laborAmount || 0).toLocaleString()}
        </div>

        {/* 11. Total Unit Price: 88px */}
        <div className={`w-[88px] h-full shrink-0 flex items-center justify-end px-2 font-mono font-semibold text-slate-900 bg-indigo-50/30 text-[11px] ${borderCellClass}`}>
          ₩{item.unitPrice.toLocaleString()}
        </div>

        {/* 12. Total Amount: 110px */}
        <div className={`w-[110px] h-full shrink-0 flex items-center justify-end px-2 font-mono font-bold text-indigo-600 bg-amber-50/40 text-[11px] ${borderCellClass}`}>
          ₩{item.amount.toLocaleString()}
        </div>

        {/* 13. Remark: 104px */}
        <div className={`w-[104px] h-full shrink-0 flex items-center px-2 text-slate-500 italic truncate text-[10px] ${borderCellClass}`} title={item.remark}>
          <span className="truncate">{item.remark || '-'}</span>
        </div>

        {/* 14. Memo: 130px */}
        <div className={`w-[130px] h-full shrink-0 flex items-center px-2 ${borderCellClass}`} onClick={(e) => e.stopPropagation()}>
          {!isAggregated ? (
            <input 
              type="text" 
              value={item.memo || ''} 
              onChange={(e) => onUpdateMemo(item.id, e.target.value)}
              placeholder="메모..."
              className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 rounded bg-white focus:border-indigo-500 outline-none placeholder:text-slate-300"
            />
          ) : (
            <span className="text-slate-400 font-mono text-xs">-</span>
          )}
        </div>

        {/* 15. Category & Actions: 170px */}
        <div className="w-[170px] h-full shrink-0 px-2 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          {renderRuleIndicator(item)}
          {!isAggregated ? (
            <div className="flex items-center gap-1 flex-1 min-w-0 relative group/category">
              <input 
                type="text"
                list="category-suggestions"
                defaultValue={item.category || ""}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val !== item.category) {
                    onUpdateCategory(item.id, val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    onUpdateCategory(item.id, val);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="분류 선택/입력"
                className="w-full p-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-500 truncate"
              />
              {item.originalCategory && item.category !== item.originalCategory && (
                <button
                  type="button"
                  onClick={() => onRevertCategory(item.id)}
                  className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                  title={`원래 분류(${item.originalCategory})로 복구`}
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 border border-orange-100 rounded">집계됨</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <List
      style={{ height, width: '100%' }}
      rowCount={rows.length}
      rowHeight={itemHeight}
      rowComponent={Row}
      rowProps={{}}
      className="custom-scrollbar"
    />
  );
};

