import React from 'react';
import { SpecItem, ThemeType } from '../types';
import { motion } from 'motion/react';
import { Tags, TrendingUp, PieChart as PieChartIcon, Building2, Package, Wrench, ShieldCheck, AlertCircle, ArrowUpRight, Calculator } from 'lucide-react';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  projectName?: string;
  isProjectLocked?: boolean;
  categoryEstimates?: Record<string, number>;
  onCategoryClick?: (category: string) => void;
  onUpdateSafetyAmount?: (amount: number) => void;
  onUpdateCategoryEstimate?: (category: string, amount: number) => void;
}

export default function CategorySummaryCards({
  items,
  theme,
  categories,
  projectName,
  isProjectLocked,
  categoryEstimates = {},
  onCategoryClick,
  onUpdateSafetyAmount,
  onUpdateCategoryEstimate
}: Props) {
  const [isEditingSafety, setIsEditingSafety] = React.useState(false);
  const [safetyInputVal, setSafetyInputVal] = React.useState('');
  const [showComparison, setShowComparison] = React.useState(false);
  const [editingEstimate, setEditingEstimate] = React.useState<string | null>(null);
  const [estimateInput, setEstimateInput] = React.useState('');

  if (items.length === 0) return null;

  // 1. Precise breakdown of Material Cost vs Labor/Outsourcing Cost for each item
  const getItemMaterialAmount = (item: SpecItem): number => {
    if (item.category === '외주') {
      return item.materialAmount || 0;
    }
    if (item.materialAmount !== undefined && item.materialAmount !== null && item.materialAmount > 0) {
      return item.materialAmount;
    }
    if (item.laborAmount && item.laborAmount > 0) {
      return Math.max(0, (item.amount || 0) - item.laborAmount);
    }
    return item.amount || 0;
  };

  const getItemLaborAmount = (item: SpecItem): number => {
    if (item.category === '외주') {
      return item.laborAmount && item.laborAmount > 0 ? item.laborAmount : (item.amount || 0);
    }
    return item.laborAmount || 0;
  };

  const getItemCategoryAmount = (item: SpecItem): number => {
    const cat = item.category || '미분류';
    if (cat === '외주') {
      return getItemLaborAmount(item) + (item.materialAmount || 0);
    }
    return getItemMaterialAmount(item);
  };

  // Grand totals across ALL items in the contract
  const totalMaterialAmount = items.reduce((sum, item) => sum + getItemMaterialAmount(item), 0);
  const totalLaborAmount = items.reduce((sum, item) => sum + getItemLaborAmount(item), 0);
  const totalContractAmount = items.reduce((sum, item) => sum + (item.amount || (getItemMaterialAmount(item) + getItemLaborAmount(item))), 0);

  const materialPercent = totalContractAmount > 0 ? (totalMaterialAmount / totalContractAmount) * 100 : 0;
  const laborPercent = totalContractAmount > 0 ? (totalLaborAmount / totalContractAmount) * 100 : 0;

  // Filter out only '미분류' for the standard category matrix (미분류 gets its own dedicated card)
  const classifiedItems = items.filter(item => {
    const cat = item.category || '미분류';
    return cat !== '미분류';
  });

  // Calculate totals by category for classified items (including '외주')
  const categoryData = classifiedItems.reduce((acc, item) => {
    const cat = item.category || '미분류';
    if (!acc[cat]) {
      acc[cat] = { amount: 0, materialAmount: 0, laborAmount: 0, count: 0 };
    }
    const catAmt = getItemCategoryAmount(item);
    const matAmt = getItemMaterialAmount(item);
    const labAmt = getItemLaborAmount(item);

    acc[cat].amount += catAmt;
    acc[cat].materialAmount += matAmt;
    acc[cat].laborAmount += labAmt;
    acc[cat].count += 1;
    return acc;
  }, {} as Record<string, { amount: number; materialAmount: number; laborAmount: number; count: number }>);

  // Follow the provided categories array order (except safety equipment)
  const sortedCategories = categories
    .map(name => {
      if (name === '안전장비류') return null;
      const data = categoryData[name];
      if (!data) return null;
      return {
        name,
        ...data,
        percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
      };
    })
    .filter((cat): cat is { name: string; amount: number; materialAmount: number; laborAmount: number; count: number; percentage: number } => cat !== null);

  // Append extra categories (e.g. dynamically added)
  const extraCategories = Object.entries(categoryData)
    .filter(([name]) => !categories.includes(name) && name !== '안전장비류')
    .map(([name, data]) => ({
      name,
      ...data,
      percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const safetyData = categoryData['안전장비류'] || { amount: 0, materialAmount: 0, laborAmount: 0, count: 0 };
  const safetyCategory = {
    name: '안전장비류',
    amount: safetyData.amount,
    materialAmount: safetyData.materialAmount,
    laborAmount: safetyData.laborAmount,
    count: safetyData.count,
    percentage: totalContractAmount > 0 ? (safetyData.amount / totalContractAmount) * 100 : 0
  };

  const filteredFinalCategories = [...sortedCategories, ...extraCategories];
  if (safetyData.count > 0 || categories.includes('안전장비류')) {
    filteredFinalCategories.push(safetyCategory);
  }

  const unclassifiedItemsList = items.filter(item => !item.category || item.category === '미분류');
  const unclassifiedCount = unclassifiedItemsList.length;
  const unclassifiedAmount = unclassifiedItemsList.reduce((sum, item) => sum + (item.amount || getItemCategoryAmount(item)), 0);

  const displayProjectName = projectName?.trim() || '기본 프로젝트 (현장 미지정)';

  // High-Density Theme Rendering
  if (theme === 'high-density') {
    return (
      <div className="mb-6 bg-white border border-[#141414]">
        {/* Prominent Site Name Banner */}
        <div className="bg-[#141414] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#141414]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-yellow-400 text-black font-black text-xs flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-yellow-400">현장명 (SITE NAME)</span>
                <span className="text-[10px] font-mono px-1 bg-white/20 text-white font-bold">
                  {isProjectLocked ? '완료/잠김' : '작업중'}
                </span>
              </div>
              <h2 className="text-base font-black tracking-tight leading-tight uppercase text-white">
                {displayProjectName}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 px-2.5 py-1 border border-white/20 text-right">
              <span className="text-[9px] uppercase opacity-70 block">총 계약 합계 (자재+외주)</span>
              <span className="text-sm font-mono font-black text-yellow-400">₩{totalContractAmount.toLocaleString()}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 border border-white/10 text-right">
              <span className="text-[9px] uppercase opacity-70 block">자재비: {materialPercent.toFixed(1)}%</span>
              <span className="text-xs font-mono font-bold text-sky-300">₩{totalMaterialAmount.toLocaleString()}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 border border-white/10 text-right">
              <span className="text-[9px] uppercase opacity-70 block">외주비: {laborPercent.toFixed(1)}%</span>
              <span className="text-xs font-mono font-bold text-amber-300">₩{totalLaborAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="bg-[#F2F2F2] border-b border-[#141414] px-4 py-1.5 flex items-center justify-between text-black">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Tags size={13} />
              <span className="text-[11px] font-black uppercase tracking-wider">
                카테고리별 공정 분리 요약
              </span>
            </div>
            <button 
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-black uppercase transition-all ${
                showComparison 
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]' 
                : 'bg-white text-slate-700 border-[#141414] hover:bg-[#EBEAE8]'
              }`}
            >
              <Calculator size={10} />
              수기 물량 비교 {showComparison ? 'OFF' : 'ON'}
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="font-bold">총 품목: {items.length}건</span>
            <span className="opacity-50">|</span>
            <span className="text-indigo-700 font-bold">분류군: {filteredFinalCategories.length}개</span>
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-0 divide-x divide-y divide-[#141414]">
          {/* Total Summary Card */}
          <div 
            onClick={() => onCategoryClick?.('all')}
            className="p-3 flex flex-col justify-between bg-indigo-50 hover:bg-indigo-100 transition-colors border-[#141414] cursor-pointer"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-black text-indigo-700 uppercase">총계약 합계 (TOTAL)</span>
              <span className="text-[10px] font-mono font-bold bg-indigo-600 text-white px-1">100%</span>
            </div>
            <div className="flex flex-col mb-2">
              <span className="text-base font-mono font-black italic tracking-tighter text-indigo-900 leading-tight">
                ₩{totalContractAmount.toLocaleString()}
              </span>
              <span className="text-[10px] opacity-60 uppercase font-bold text-indigo-700">전체 품목 종합</span>
            </div>
            <div className="pt-1.5 border-t border-indigo-200/80 space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between text-slate-700">
                <span>자재비:</span>
                <span className="font-bold text-blue-700">₩{totalMaterialAmount.toLocaleString()} ({materialPercent.toFixed(0)}%)</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>외주비:</span>
                <span className="font-bold text-amber-700">₩{totalLaborAmount.toLocaleString()} ({laborPercent.toFixed(0)}%)</span>
              </div>
            </div>
          </div>

          {/* Unassigned Warning Card */}
          {unclassifiedCount > 0 && (
            <div 
              onClick={() => onCategoryClick?.('미분류')}
              className="p-3 flex flex-col justify-between bg-[#FFF2CC] hover:bg-[#FCE4D6] transition-colors border-l-4 border-l-amber-600 border-y border-r border-[#141414] cursor-pointer"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-black text-amber-800 uppercase">⚠️ 미분류 합계</span>
                <span className="text-[9px] font-mono font-bold bg-amber-600 text-white px-1">분류 대기</span>
              </div>
              <div className="flex flex-col mb-2">
                <span className="text-base font-mono font-black italic tracking-tighter text-amber-900 leading-tight">
                  ₩{unclassifiedAmount.toLocaleString()}
                </span>
                <span className="text-[10px] opacity-75 text-amber-800 uppercase font-black">{unclassifiedCount}개 품목 지정 필요</span>
              </div>
              <div className="text-[9px] text-amber-800 font-bold bg-amber-200/70 px-1 py-0.5 text-center">
                클릭 시 미분류 목록 필터
              </div>
            </div>
          )}

          {/* Category Cards */}
          {filteredFinalCategories.map((cat) => {
            const isOutsourcing = cat.name === '외주';
            const isSafety = cat.name === '안전장비류';

            if (isSafety) {
              return (
                <div 
                  key={cat.name} 
                  onClick={() => onCategoryClick?.(cat.name)}
                  className={`p-3 flex flex-col justify-between bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors border-[#141414] cursor-pointer border-l-4 border-l-indigo-600 ${showComparison ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[11px] font-black text-indigo-700 uppercase truncate" title={cat.name}>🛡️ {cat.name}</span>
                    {!showComparison && (
                      <span className="text-[11px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1 border border-indigo-200">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {isEditingSafety ? (
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-mono font-bold text-indigo-600">₩</span>
                        <input
                          type="text"
                          value={safetyInputVal}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSafetyInputVal(val ? Number(val).toLocaleString() : '');
                          }}
                          onBlur={() => {
                            setIsEditingSafety(false);
                            const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                            onUpdateSafetyAmount?.(Number(rawVal) || 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingSafety(false);
                              const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                              onUpdateSafetyAmount?.(Number(rawVal) || 0);
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
                        {!showComparison && (
                          <span 
                            className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200 shadow-xs flex items-center" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSafetyInputVal(cat.amount ? String(cat.amount) : '');
                              setIsEditingSafety(true);
                            }}
                          >
                            수동 ✎
                          </span>
                        )}
                      </div>
                    )}
                    {!showComparison && <span className="text-[9px] opacity-50 uppercase font-bold text-indigo-700">{cat.count} items</span>}
                    
                    {showComparison && (
                      <div className="mt-1 pt-1 border-t border-dashed border-indigo-200/50 space-y-1">
                        <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[9px] font-black text-indigo-600">수기:</span>
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-white border border-indigo-200 px-1 py-0.5 text-[9px] font-mono font-bold text-indigo-900"
                          />
                        </div>
                        {categoryEstimates[cat.name] > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-indigo-400">대비:</span>
                            <span className={`text-[9px] font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                              {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (isOutsourcing) {
              return (
                <div 
                  key={cat.name} 
                  onClick={() => onCategoryClick?.(cat.name)}
                  className={`p-3 flex flex-col justify-between bg-amber-50/50 hover:bg-amber-100/60 transition-colors border-[#141414] cursor-pointer border-l-4 border-l-amber-500 ${showComparison ? 'ring-1 ring-inset ring-amber-200' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[11px] font-black text-amber-900 uppercase truncate flex items-center gap-1" title={cat.name}>
                      🛠️ {cat.name}
                    </span>
                    {!showComparison && (
                      <span className="text-[11px] font-mono font-bold bg-amber-200 text-amber-900 px-1 border border-amber-300">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-mono font-black italic tracking-tighter text-amber-950">
                      ₩{cat.amount.toLocaleString()}
                    </span>
                    {!showComparison && (
                      <div className="flex justify-between items-center text-[10px] text-amber-800 mt-1 font-mono">
                        <span>{cat.count} items</span>
                        <span className="font-bold">외주</span>
                      </div>
                    )}

                    {showComparison && (
                      <div className="mt-1 pt-1 border-t border-dashed border-amber-300/50 space-y-1">
                        <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[9px] font-black text-amber-700">수기:</span>
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-white border border-amber-200 px-1 py-0.5 text-[9px] font-mono font-bold text-amber-900"
                          />
                        </div>
                        {categoryEstimates[cat.name] > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-amber-600">대비:</span>
                            <span className={`text-[9px] font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                              {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={cat.name} 
                onClick={() => onCategoryClick?.(cat.name)}
                className={`p-3 flex flex-col justify-between hover:bg-[#F9F9F9] transition-colors border-[#141414] cursor-pointer ${showComparison ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-black text-slate-600 uppercase truncate" title={cat.name}>{cat.name}</span>
                  {!showComparison && (
                    <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-700 px-1 border border-blue-200">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-mono font-black italic tracking-tighter">₩{cat.amount.toLocaleString()}</span>
                    {!showComparison && <span className="text-[10px] opacity-50 uppercase font-bold">{cat.count} items</span>}
                  </div>

                  {showComparison && (
                    <div className="mt-1 pt-1.5 border-t border-dashed border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-black text-indigo-600">수기:</span>
                        <div className="relative flex-grow">
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="실행물량..."
                            className="w-full bg-slate-50 border border-slate-200 px-1 py-0.5 text-[10px] font-mono font-bold text-indigo-900 outline-none focus:border-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      
                      {categoryEstimates[cat.name] && categoryEstimates[cat.name] > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-400">대비:</span>
                          <span className={`text-[10px] font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                            {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      ) : (
                        <div className="text-[8px] italic text-slate-400 text-center">수기 금액 입력 시 대비 계산</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard (Industrial / Modern / Minimal) Theme Rendering
  return (
    <div className="mb-10 space-y-5">
      {/* 1. Prominent Site Name Banner with Grand Total Breakdown */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 md:p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-indigo-50/70 via-slate-50/40 to-transparent rounded-full pointer-events-none -mr-16 -mt-16" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Site Identity */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-indigo-200 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-extrabold uppercase tracking-wider border border-indigo-100">
                  현재 작업 현장
                </span>
                {isProjectLocked ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-bold border border-emerald-200">
                    <ShieldCheck size={12} /> 완료 및 보호됨
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium">
                    내역 분리 진행중
                  </span>
                )}
                <span className="text-xs text-slate-400 font-medium">
                  총 {items.length}개 품목 ({filteredFinalCategories.length}개 카테고리)
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {displayProjectName}
              </h1>
            </div>
          </div>

          {/* Grand Total Breakdown Pill Matrix */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80">
            {/* Total Contract Sum */}
            <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <div className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">총 계약 합계 금액</div>
              <div className="text-xl md:text-2xl font-mono font-black tracking-tight">
                ₩{totalContractAmount.toLocaleString()}
              </div>
            </div>

            {/* Split: Material vs Outsourcing */}
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase">
                  <Package size={12} />
                  <span>자재비 합계 ({materialPercent.toFixed(1)}%)</span>
                </div>
                <div className="text-base font-mono font-black text-slate-800">
                  ₩{totalMaterialAmount.toLocaleString()}
                </div>
              </div>

              <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase">
                  <Wrench size={12} />
                  <span>외주비 합계 ({laborPercent.toFixed(1)}%)</span>
                </div>
                <div className="text-base font-mono font-black text-slate-800">
                  ₩{totalLaborAmount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proportional Split Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> 자재비: ₩{totalMaterialAmount.toLocaleString()} ({materialPercent.toFixed(1)}%)
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 외주비: ₩{totalLaborAmount.toLocaleString()} ({laborPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-blue-500 transition-all duration-500" 
              style={{ width: `${materialPercent}%` }} 
              title={`자재비: ${materialPercent.toFixed(1)}%`}
            />
            <div 
              className="h-full bg-amber-500 transition-all duration-500" 
              style={{ width: `${laborPercent}%` }} 
              title={`외주비: ${laborPercent.toFixed(1)}%`}
            />
          </div>
        </div>
      </motion.div>

      {/* 2. Category Summary Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shadow-xs border border-indigo-200">
              <PieChartIcon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-0.5">카테고리별 공종 금액 일람</h2>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Category-wise Expenditure Summary (자재 + 외주)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                showComparison 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'
              }`}
            >
              <Calculator size={14} />
              {showComparison ? '비교 모드 종료' : '수기 물량 비교'}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              <TrendingUp size={14} />
              <span>총 {filteredFinalCategories.length}개 카테고리</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Total Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onCategoryClick?.('all')}
            className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-200/70 border border-indigo-500 relative overflow-hidden group cursor-pointer text-white flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-white/10 rounded-full blur-2xl" />
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-100">
                  총계약 합계 (전체)
                </span>
                <PieChartIcon size={16} className="text-indigo-200" />
              </div>
              <div className="text-2xl font-mono font-black mb-3 tracking-tight">
                ₩{totalContractAmount.toLocaleString()}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-indigo-400/40 text-[11px] font-medium text-indigo-100">
              <div className="flex justify-between items-center">
                <span>자재비 ({materialPercent.toFixed(0)}%)</span>
                <span className="font-mono font-bold">₩{totalMaterialAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>외주비 ({laborPercent.toFixed(0)}%)</span>
                <span className="font-mono font-bold">₩{totalLaborAmount.toLocaleString()}</span>
              </div>
              <div className="pt-1 flex justify-between items-center text-[10px] text-indigo-200">
                <span>전체 품목 수</span>
                <span className="font-mono font-bold">{items.length}개</span>
              </div>
            </div>
          </motion.div>

          {/* Unassigned Warning Card */}
          {unclassifiedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onCategoryClick?.('미분류')}
              className="bg-amber-50 p-5 rounded-2xl border border-amber-200 hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden border-l-4 border-l-amber-500 cursor-pointer flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-amber-100 rounded-full blur-2xl" />
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest">
                    ⚠️ 미분류 합계
                  </span>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    분류 필요
                  </span>
                </div>
                
                <div className="text-xl font-mono font-black text-amber-900 mb-3">
                  ₩{unclassifiedAmount.toLocaleString()}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 pt-2 border-t border-amber-200/60">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[11px] text-amber-800 font-bold uppercase">대기 품목</span>
                  <span className="text-[11px] text-amber-900 font-bold font-mono">{unclassifiedCount}개 품목</span>
                </div>
                <div className="text-[10px] text-amber-700 font-medium">
                  클릭하여 미분류 품목 일괄 지정
                </div>
              </div>
            </motion.div>
          )}

          {/* Category Cards */}
          {filteredFinalCategories.map((cat, idx) => {
            const isOutsourcing = cat.name === '외주';
            const isSafety = cat.name === '안전장비류';

            if (isSafety) {
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => onCategoryClick?.(cat.name)}
                  className="bg-indigo-50/40 p-5 rounded-2xl border-2 border-indigo-200/80 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer border-l-4 border-l-indigo-600 flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-indigo-100 rounded-full blur-2xl" />
                  
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[11px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1">
                        🛡️ {cat.name}
                      </span>
                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    {isEditingSafety ? (
                      <div className="flex flex-col gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[9px] font-black text-indigo-600 uppercase">안전장비류 금액 입력</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono font-bold text-slate-400">₩</span>
                          <input
                            type="text"
                            value={safetyInputVal}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setSafetyInputVal(val ? Number(val).toLocaleString() : '');
                            }}
                            onBlur={() => {
                              setIsEditingSafety(false);
                              const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                              onUpdateSafetyAmount?.(Number(rawVal) || 0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setIsEditingSafety(false);
                                const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                                onUpdateSafetyAmount?.(Number(rawVal) || 0);
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
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xl font-mono font-black text-slate-900 group-hover:scale-[1.02] origin-left transition-transform">
                          ₩{cat.amount.toLocaleString()}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSafetyInputVal(cat.amount ? String(cat.amount) : '');
                            setIsEditingSafety(true);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-slate-50 px-2 py-0.5 rounded-full border border-indigo-200 shadow-2xs transition-all"
                        >
                          수동 ✎
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-between items-center border-t border-indigo-100/70 pt-2 font-bold text-indigo-600 text-xs">
                    <span className="text-[10px] uppercase">등록 품목</span>
                    <span className="text-[11px] font-mono">{cat.count}건 (수동 입력)</span>
                  </div>
                </motion.div>
              );
            }

            if (isOutsourcing) {
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => onCategoryClick?.(cat.name)}
                  className="bg-amber-50/40 p-5 rounded-2xl border-2 border-amber-200/80 shadow-xs hover:shadow-lg hover:border-amber-300 hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer border-l-4 border-l-amber-500 flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-amber-100 rounded-full blur-2xl group-hover:bg-amber-200/60 transition-colors" />
                  
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1">
                        🛠️ {cat.name} (외주비)
                      </span>
                      <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="text-xl font-mono font-black text-slate-900 mb-2 group-hover:scale-[1.02] origin-left transition-transform">
                      ₩{cat.amount.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2 border-t border-amber-200/60">
                    <div className="h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, cat.percentage)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.03 }}
                        className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)]" 
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-amber-700 font-bold uppercase">외주 품목수</span>
                      <span className="text-[11px] text-amber-900 font-bold font-mono">{cat.count}건</span>
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
                transition={{ delay: idx * 0.02 }}
                onClick={() => onCategoryClick?.(cat.name)}
                className={`bg-white p-5 rounded-2xl border transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between ${
                  showComparison ? 'border-indigo-300 shadow-md ring-1 ring-indigo-100' : 'border-slate-200 shadow-2xs hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5'
                }`}
              >
                <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors" />
                
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors truncate" title={cat.name}>
                      {cat.name}
                    </span>
                    {!showComparison && (
                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xl font-mono font-black text-slate-900 mb-2 group-hover:scale-[1.02] origin-left transition-transform">
                    ₩{cat.amount.toLocaleString()}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  {showComparison ? (
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[9px] font-black text-indigo-500 uppercase">수기 실행물량</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-slate-400">₩</span>
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="실행 금액 입력"
                            className="w-full bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono font-bold text-indigo-900 rounded-md outline-none focus:border-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      
                      {categoryEstimates[cat.name] && categoryEstimates[cat.name] > 0 ? (
                        <div className="flex items-center justify-between bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100/50">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">대비(Ratio)</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                              {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] italic text-slate-400 text-center py-1">실행물량 입력 대기</div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, cat.percentage)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.03 }}
                          className="h-full bg-indigo-500 rounded-full group-hover:bg-indigo-600 transition-colors shadow-[0_0_8px_rgba(79,70,229,0.3)]" 
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">포함 품목</span>
                        <span className="text-[11px] text-slate-600 font-bold font-mono">{cat.count}건</span>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

