import React from 'react';
import { SpecItem, ThemeType } from '../types';
import { motion } from 'motion/react';
import { Tags, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  onCategoryClick?: (category: string) => void;
  onUpdateSafetyAmount?: (amount: number) => void;
}

export default function CategorySummaryCards({ items, theme, categories, onCategoryClick, onUpdateSafetyAmount }: Props) {
  if (items.length === 0) return null;

  const [isEditingSafety, setIsEditingSafety] = React.useState(false);
  const [safetyInputVal, setSafetyInputVal] = React.useState('');

  // Helper to calculate category amount without labor costs (노무비 제외한 순수 재료비/자재비 합산)
  const getItemCategoryAmount = (item: SpecItem): number => {
    if (item.materialAmount !== undefined && item.materialAmount !== null && item.materialAmount !== 0) {
      return item.materialAmount;
    }
    if (item.laborAmount && item.laborAmount > 0) {
      if (item.materialAmount !== undefined && item.materialAmount !== null) {
        return item.materialAmount;
      }
      return Math.max(0, item.amount - item.laborAmount);
    }
    return item.amount || 0;
  };

  // Filter out '미분류', '외주', '열선', and '지금자재' for summary calculation
  const filteredItems = items.filter(item => {
    const cat = item.category || '미분류';
    return cat !== '미분류' && cat !== '외주' && cat !== '열선' && cat !== '지금자재';
  });

  if (filteredItems.length === 0) return null;

  const totalAmount = filteredItems.reduce((sum, item) => sum + getItemCategoryAmount(item), 0);
  
  // Calculate totals by category for filtered items (노무비 제외)
  const categoryData = filteredItems.reduce((acc, item) => {
    const cat = item.category || '미분류';
    if (!acc[cat]) {
      acc[cat] = { amount: 0, count: 0 };
    }
    acc[cat].amount += getItemCategoryAmount(item);
    acc[cat].count += 1;
    return acc;
  }, {} as Record<string, { amount: number; count: number }>);

  // Strictly follow the provided categories array order (except safety equipment)
  const sortedCategories = categories
    .map(name => {
      if (name === '안전장비류') return null;
      const data = categoryData[name];
      if (!data) return null;
      return {
        name,
        ...data,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      };
    })
    .filter((cat): cat is { name: string; amount: number; count: number; percentage: number } => cat !== null);

  // Append any extra categories that might exist but aren't in the main list
  const extraCategories = Object.entries(categoryData)
    .filter(([name]) => !categories.includes(name) && name !== '안전장비류')
    .map(([name, data]) => ({
      name,
      ...data,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const safetyData = categoryData['안전장비류'] || { amount: 0, count: 0 };
  const safetyCategory = {
    name: '안전장비류',
    amount: safetyData.amount,
    count: safetyData.count,
    percentage: totalAmount > 0 ? (safetyData.amount / totalAmount) * 100 : 0
  };

  const filteredFinalCategories = [...sortedCategories, ...extraCategories];
  filteredFinalCategories.push(safetyCategory);

  const unclassifiedItemsList = items.filter(item => !item.category || item.category === '미분류');
  const unclassifiedCount = unclassifiedItemsList.length;
  const unclassifiedAmount = unclassifiedItemsList.reduce((sum, item) => sum + getItemCategoryAmount(item), 0);

  if (theme === 'high-density') {
    return (
      <div className="mb-6 bg-white border border-[#141414]">
        <div className="bg-[#141414] text-white px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
              <Tags size={12} />
              카테고리별 요약 (Category Summary)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] opacity-60 italic font-mono">GROUPS: {filteredFinalCategories.length}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-0 divide-x divide-y divide-[#141414]">
          {/* Total Summary Card */}
          <div 
            onClick={() => onCategoryClick?.('all')}
            className="p-3 flex flex-col justify-between bg-indigo-50 hover:bg-indigo-100 transition-colors border-[#141414] cursor-pointer"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-black text-indigo-700 uppercase">전체 합계 (TOTAL)</span>
              <span className="text-[11px] font-mono font-bold bg-indigo-600 text-white px-1">100%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-mono font-black italic tracking-tighter text-indigo-900">₩{totalAmount.toLocaleString()}</span>
              <span className="text-[11px] opacity-60 uppercase font-bold text-indigo-700">All classified items</span>
            </div>
          </div>

          {unclassifiedCount > 0 && (
            <div 
              onClick={() => onCategoryClick?.('미분류')}
              className="p-3 flex flex-col justify-between bg-[#FFF2CC] hover:bg-[#FCE4D6] transition-colors border-l-4 border-l-amber-600 border-y border-r border-[#141414] cursor-pointer"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-black text-amber-800 uppercase">⚠️ 미분류 합계 (UNASSIGNED)</span>
                <span className="text-[9px] font-mono font-bold bg-amber-600 text-white px-1">분류 대기</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-mono font-black italic tracking-tighter text-amber-900">₩{unclassifiedAmount.toLocaleString()}</span>
                <span className="text-[11px] opacity-75 text-amber-800 uppercase font-black">{unclassifiedCount}개 품목 지정 필요</span>
              </div>
            </div>
          )}

          {filteredFinalCategories.map((cat) => {
            if (cat.name === '안전장비류') {
              return (
                <div 
                  key={cat.name} 
                  onClick={() => onCategoryClick?.(cat.name)}
                  className="p-3 flex flex-col justify-between bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors border-[#141414] cursor-pointer border-l-4 border-l-indigo-600"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[11px] font-black text-indigo-700 uppercase truncate" title={cat.name}>🛡️ {cat.name}</span>
                    <span className="text-[11px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1 border border-indigo-200">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {isEditingSafety ? (
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-mono font-bold text-indigo-600">₩</span>
                        <input
                          type="text"
                          value={safetyInputVal}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSafetyInputVal(val);
                          }}
                          onBlur={() => {
                            setIsEditingSafety(false);
                            onUpdateSafetyAmount?.(Number(safetyInputVal) || 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingSafety(false);
                              onUpdateSafetyAmount?.(Number(safetyInputVal) || 0);
                            } else if (e.key === 'Escape') {
                              setIsEditingSafety(false);
                            }
                          }}
                          className="w-full px-1.5 py-0.5 text-xs font-mono border border-indigo-500 rounded outline-none bg-white font-bold"
                          placeholder="금액..."
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-mono font-black italic tracking-tighter text-indigo-900">₩{cat.amount.toLocaleString()}</span>
                        <span 
                          className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200 shadow-sm flex items-center" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSafetyInputVal(cat.amount ? String(cat.amount) : '');
                            setIsEditingSafety(true);
                          }}
                        >
                          수동 ✎
                        </span>
                      </div>
                    )}
                    <span className="text-[9px] opacity-50 uppercase font-bold text-indigo-700 mt-1">{cat.count} items (수동입력 가능)</span>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={cat.name} 
                onClick={() => onCategoryClick?.(cat.name)}
                className="p-3 flex flex-col justify-between hover:bg-[#F9F9F9] transition-colors border-[#141414] cursor-pointer"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-black text-slate-500 uppercase truncate" title={cat.name}>{cat.name}</span>
                  <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-700 px-1 border border-blue-200">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-mono font-black italic tracking-tighter">₩{cat.amount.toLocaleString()}</span>
                  <span className="text-[11px] opacity-40 uppercase font-bold">{cat.count} items</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm border border-indigo-200">
            <PieChartIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">카테고리별 금액 일람</h2>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Category-wise Expenditure Summary</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            <TrendingUp size={14} />
            <span>총계: ₩{totalAmount.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 font-medium italic">EXCLUDES: 미분류, 외주, 열선, 지금자재</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Total Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onCategoryClick?.('all')}
          className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-200 border border-indigo-500 relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10 text-white">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-100">
                전체 분류 합계
              </span>
              <PieChartIcon size={16} className="text-indigo-200" />
            </div>
            <div className="text-2xl font-mono font-black mb-4 tracking-tight">
              ₩{totalAmount.toLocaleString()}
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full w-full" />
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-indigo-100 uppercase">
                <span>Total Items</span>
                <span>{filteredItems.length}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {unclassifiedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onCategoryClick?.('미분류')}
            className="bg-amber-50 p-5 rounded-2xl border border-amber-200 hover:border-amber-305 hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden border-l-4 border-l-amber-500 cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-amber-100 rounded-full blur-2xl group-hover:bg-amber-150 transition-colors" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest">
                  ⚠️ 미분류 합계
                </span>
                <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                  분류 필요
                </span>
              </div>
              
              <div className="text-xl font-mono font-black text-amber-900 mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                ₩{unclassifiedAmount.toLocaleString()}
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden border border-amber-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)]" 
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-amber-805 font-bold uppercase">Total Unclassified</span>
                  <span className="text-[11px] text-amber-900 font-bold font-mono">{unclassifiedCount}개 품목</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {filteredFinalCategories.map((cat, idx) => {
          if (cat.name === '안전장비류') {
            return (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => onCategoryClick?.(cat.name)}
                className="bg-indigo-50/50 p-5 rounded-2xl border-2 border-indigo-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer border-l-4 border-l-indigo-600"
              >
                <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-indigo-100 rounded-full blur-2xl" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                      🛡️ {cat.name}
                    </span>
                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  {isEditingSafety ? (
                    <div className="flex flex-col gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[9px] font-black text-indigo-600 uppercase">안전장비류 금액 입력</label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono font-bold text-slate-400">₩</span>
                        <input
                          type="text"
                          value={safetyInputVal}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSafetyInputVal(val);
                          }}
                          onBlur={() => {
                            setIsEditingSafety(false);
                            onUpdateSafetyAmount?.(Number(safetyInputVal) || 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingSafety(false);
                              onUpdateSafetyAmount?.(Number(safetyInputVal) || 0);
                            } else if (e.key === 'Escape') {
                              setIsEditingSafety(false);
                            }
                          }}
                          className="w-full px-2 py-1 text-xs font-mono border border-indigo-500 rounded-lg outline-none bg-white font-bold"
                          placeholder="금액 입력..."
                          autoFocus
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xl font-mono font-black text-slate-900 group-hover:scale-[1.02] origin-left transition-transform">
                        ₩{cat.amount.toLocaleString()}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSafetyInputVal(cat.amount ? String(cat.amount) : '');
                          setIsEditingSafety(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-full border border-indigo-100 shadow-sm transition-all"
                      >
                        수동 입력 ✎
                      </button>
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-between items-center border-t border-indigo-100/50 pt-2 font-bold text-indigo-500">
                    <span className="text-[11px] uppercase">Processed Items</span>
                    <span className="text-[11px] font-mono">{cat.count} (수동 입력됨)</span>
                  </div>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => onCategoryClick?.(cat.name)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">
                    {cat.name}
                  </span>
                  <span className="text-[11px] font-black text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>
                
                <div className="text-xl font-mono font-black text-slate-900 mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                  ₩{cat.amount.toLocaleString()}
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.05 }}
                      className="h-full bg-indigo-500 rounded-full group-hover:bg-indigo-600 transition-colors shadow-[0_0_8px_rgba(79,70,229,0.3)]" 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">Processed Items</span>
                    <span className="text-[11px] text-slate-600 font-bold font-mono">{cat.count}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
