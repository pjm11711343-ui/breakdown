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
  // Row height calculated based on density
  const getRowHeight = (row: VirtualRowData) => {
    if (row.type === 'section-header' || row.type === 'category-header') {
      return 36;
    }
    if (row.type === 'category-sub-header') {
      return 28;
    }
    // item row
    const baseHeight = theme === 'high-density' ? 28 : 38;
    return baseHeight + (density - 2) * 6;
  };

  const itemHeight = theme === 'high-density' ? 30 + (density - 2) * 4 : 40 + (density - 2) * 6;

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
          className={`flex items-center text-xs font-bold ${
            theme === 'high-density' ? 'bg-indigo-600 text-white' : 'bg-indigo-900 text-white'
          } border-b border-[#141414] select-none`}
        >
          <div className="w-10 text-center shrink-0">
            <input 
              type="checkbox" 
              checked={row.items.length > 0 && row.items.every(i => selectedIds.has(i.id))}
              onChange={() => toggleAll(row.items)}
              className="accent-white cursor-pointer"
            />
          </div>
          <div className="w-16 font-mono font-black shrink-0 px-2">CAT {row.catIdx + 1}</div>
          <div className="flex-1 font-black uppercase tracking-wider px-2 truncate">[분류] {row.catName}</div>
          <div className="w-24 text-right font-mono font-bold px-2 shrink-0">재: ₩{row.materialTotal.toLocaleString()}</div>
          <div className="w-24 text-right font-mono font-bold px-2 shrink-0">노: ₩{row.laborTotal.toLocaleString()}</div>
          <div className="w-28 text-right font-mono font-black px-2 shrink-0 text-amber-300">합: ₩{row.total.toLocaleString()}</div>
          <div className="w-20 text-center font-mono text-[10px] px-2 shrink-0">{row.count} ITEMS</div>
        </div>
      );
    }

    if (row.type === 'category-sub-header') {
      return (
        <div 
          style={style} 
          className={`flex items-center text-[10px] font-bold ${
            theme === 'high-density' ? 'bg-gray-100 text-gray-800' : 'bg-slate-100 text-slate-700'
          } border-b border-slate-200 px-4 select-none`}
        >
          <div className="w-10 shrink-0" />
          <div className="w-16 shrink-0" />
          <div className="flex-1 truncate font-mono">↳ 공종: {row.secName}</div>
          <div className="w-20 text-center text-slate-500 font-mono shrink-0">{row.count}건</div>
        </div>
      );
    }

    if (row.type === 'section-header') {
      return (
        <div 
          style={style} 
          className={`flex items-center text-xs font-bold ${
            theme === 'high-density' ? 'bg-[#00B0F0] text-white' : 'bg-slate-800 text-white'
          } border-b border-[#141414] select-none`}
        >
          <div className="w-10 text-center shrink-0">
            <input 
              type="checkbox" 
              checked={row.items.length > 0 && row.items.every(i => selectedIds.has(i.id))}
              onChange={() => toggleAll(row.items)}
              className="accent-white cursor-pointer"
            />
          </div>
          <div className="w-16 font-mono font-black shrink-0 px-2">PART {row.index + 1}</div>
          <div className="flex-1 font-black uppercase tracking-wider px-2 truncate">{row.sectionName}</div>
          <div className="w-24 text-right font-mono font-bold px-2 shrink-0">재: ₩{row.materialTotal.toLocaleString()}</div>
          <div className="w-24 text-right font-mono font-bold px-2 shrink-0">노: ₩{row.laborTotal.toLocaleString()}</div>
          <div className="w-28 text-right font-mono font-black px-2 shrink-0 text-amber-300">합: ₩{row.total.toLocaleString()}</div>
          <div className="w-20 text-center font-mono text-[10px] px-2 shrink-0">{row.count} ITEMS</div>
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
        className={`flex items-center border-b text-xs select-none transition-all duration-200 ${
          theme === 'high-density'
            ? (isSelected ? 'bg-[#C5E0B4] border-[#2d5a27]/30 ring-1 ring-inset ring-[#2d5a27]/10' : 'bg-white hover:bg-slate-50 border-[#141414]/10')
            : (isSelected ? 'bg-indigo-50 border-indigo-200 ring-1 ring-inset ring-indigo-500/5' : 'bg-white hover:bg-slate-50 border-slate-100')
        } ${isSelected ? 'z-10 shadow-[inset_4px_0_0_0_#4f46e5,0_2px_4px_rgba(0,0,0,0.02)]' : ''}`}
      >
        {/* Checkbox */}
        <div className="w-10 text-center shrink-0" onClick={(e) => e.stopPropagation()}>
          {!isAggregated && (
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => toggleOne(item.id, itemIdx)}
              className={theme === 'high-density' ? 'accent-[#141414] cursor-pointer' : 'accent-indigo-600 cursor-pointer'}
            />
          )}
        </div>

        {/* Index */}
        <div className="w-12 text-center font-mono text-slate-500 shrink-0 text-[10px]">
          {isAggregated ? `Σ${itemIdx + 1}` : (itemIdx + 1).toString().padStart(3, '0')}
        </div>

        {/* Name */}
        <div className="w-44 px-2 font-bold text-slate-900 truncate shrink-0" title={item.name}>
          {item.name}
        </div>

        {/* Spec */}
        <div className="w-40 px-2 text-slate-600 opacity-80 truncate shrink-0 text-[11px]" title={item.specification}>
          {item.specification}
        </div>

        {/* Unit */}
        <div className="w-12 text-center text-slate-600 shrink-0 text-[11px]">
          {item.unit}
        </div>

        {/* Quantity */}
        <div className="w-16 text-right font-mono px-2 text-slate-800 shrink-0 text-[11px]">
          {item.quantity.toLocaleString()}
        </div>

        {/* Material Unit Price */}
        <div className="w-20 text-right font-mono px-2 text-slate-600 shrink-0 text-[11px]">
          ₩{(item.materialUnitPrice || 0).toLocaleString()}
        </div>

        {/* Material Amount */}
        <div className="w-24 text-right font-mono px-2 text-slate-700 shrink-0 text-[11px]">
          ₩{(item.materialAmount || 0).toLocaleString()}
        </div>

        {/* Labor Unit Price */}
        <div className="w-20 text-right font-mono px-2 text-slate-600 shrink-0 text-[11px]">
          ₩{(item.laborUnitPrice || 0).toLocaleString()}
        </div>

        {/* Labor Amount */}
        <div className="w-24 text-right font-mono px-2 text-slate-700 shrink-0 text-[11px]">
          ₩{(item.laborAmount || 0).toLocaleString()}
        </div>

        {/* Total Unit Price */}
        <div className="w-20 text-right font-mono px-2 font-semibold text-slate-900 bg-indigo-50/40 shrink-0 text-[11px]">
          ₩{item.unitPrice.toLocaleString()}
        </div>

        {/* Total Amount */}
        <div className="w-28 text-right font-mono px-2 font-bold text-indigo-600 bg-amber-50/40 shrink-0 text-[11px]">
          ₩{item.amount.toLocaleString()}
        </div>

        {/* Remark */}
        <div className="w-24 px-2 text-slate-500 italic truncate shrink-0 text-[10px]" title={item.remark}>
          {item.remark}
        </div>

        {/* Memo */}
        <div className="w-36 px-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!isAggregated ? (
            <input 
              type="text" 
              value={item.memo || ''} 
              onChange={(e) => onUpdateMemo(item.id, e.target.value)}
              placeholder="메모..."
              className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 rounded bg-white/80 focus:border-indigo-500 outline-none"
            />
          ) : (
            <span className="text-slate-400 font-mono text-xs">-</span>
          )}
        </div>

        {/* Category & Actions */}
        <div className="w-48 px-2 flex items-center gap-1 shrink-0 justify-center" onClick={(e) => e.stopPropagation()}>
          {renderRuleIndicator(item)}
          {!isAggregated ? (
            <div className="flex items-center gap-1 flex-1 relative group/category">
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
                className="w-full p-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold outline-none cursor-pointer focus:border-indigo-500"
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
