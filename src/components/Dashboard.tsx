import React from 'react';
import { SpecItem, ThemeType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, TrendingUp, Info, LayoutGrid, ArrowRight, Package, Wrench } from 'lucide-react';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  onOpenSectionSummary: () => void;
}

export default function Dashboard({ items, theme, onOpenSectionSummary }: Props) {
  if (!items || items.length === 0) return null;
  
  // Material vs Labor calculation
  const getItemMaterialAmount = (item: SpecItem): number => {
    if (item.category === '외주') return item.materialAmount || 0;
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

  const totalMaterialAmount = items.reduce((sum, item) => sum + getItemMaterialAmount(item), 0);
  const totalLaborAmount = items.reduce((sum, item) => sum + getItemLaborAmount(item), 0);
  const totalContractAmount = items.reduce((sum, item) => sum + (item.amount || (getItemMaterialAmount(item) + getItemLaborAmount(item))), 0);

  const materialPercent = totalContractAmount > 0 ? (totalMaterialAmount / totalContractAmount) * 100 : 0;
  const laborPercent = totalContractAmount > 0 ? (totalLaborAmount / totalContractAmount) * 100 : 0;

  // For chart, include all classified categories (including '외주')
  const classifiedItems = items.filter(item => {
    const cat = item.category || '미분류';
    return cat !== '미분류';
  });

  const categoryTotals = classifiedItems.reduce((acc, item) => {
    const cat = item.category || '미분류';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += getItemCategoryAmount(item);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  const colors = ['#4F46E5', '#0284C7', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  if (theme === 'high-density') {
    return (
      <div className="border-b border-[#141414] bg-[#F4F4F2]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-[#141414]">
          <div className="p-3.5 border-r border-b lg:border-b-0 border-[#141414] flex flex-col justify-between">
            <span className="text-[10px] uppercase opacity-60 font-black mb-1">총 계약 합계 금액</span>
            <span className="text-xl lg:text-2xl font-mono leading-none tracking-tighter italic font-black text-indigo-950">
              ₩{totalContractAmount.toLocaleString()}
            </span>
            <div className="mt-2 pt-1 border-t border-[#141414]/20 flex justify-between text-[10px] font-mono">
              <span className="text-sky-700 font-bold">자재: ₩{totalMaterialAmount.toLocaleString()}</span>
              <span className="text-amber-700 font-bold">외주: ₩{totalLaborAmount.toLocaleString()}</span>
            </div>
          </div>
          <div className="p-3.5 border-r lg:border-r border-b lg:border-b-0 border-[#141414] flex flex-col justify-between">
            <span className="text-[10px] uppercase opacity-60 font-black mb-1">분리된 공정 수</span>
            <span className="text-xl lg:text-2xl font-mono leading-none italic font-bold">
              {Object.keys(categoryTotals).length} <small className="text-xs opacity-50 font-normal">Categories</small>
            </span>
            <div className="mt-2 text-[10px] text-slate-500 font-mono">
              자재 {materialPercent.toFixed(0)}% / 외주 {laborPercent.toFixed(0)}%
            </div>
          </div>
          <div className="p-3.5 border-r border-[#141414] flex flex-col justify-between">
            <span className="text-[10px] uppercase opacity-60 font-black mb-1">분석 완료 품목</span>
            <span className="text-xl lg:text-2xl font-mono leading-none text-blue-700 italic font-black">
              {items.length} <small className="text-xs font-normal opacity-60">Items</small>
            </span>
            <div className="mt-2 text-[10px] text-slate-500 font-mono">
              분류 품목: {classifiedItems.length}건
            </div>
          </div>
          <div className="p-3.5 flex flex-col justify-between bg-white relative group cursor-pointer overflow-hidden border-b lg:border-b-0 border-[#141414]" onClick={onOpenSectionSummary}>
            <div className="absolute inset-0 bg-yellow-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
            <div className="relative z-10">
              <span className="text-[10px] uppercase opacity-60 font-black mb-1 group-hover:text-black">공정 상세 분석 리포트</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-black uppercase text-indigo-600 group-hover:text-black">OPEN_REPORT</span>
                <LayoutGrid size={16} className="group-hover:rotate-90 transition-transform text-indigo-400 group-hover:text-black" />
              </div>
            </div>
            <div className="relative z-10 text-[10px] opacity-60 group-hover:text-black font-mono">
              층별/구간별 매트릭스
            </div>
          </div>
        </div>
        
        {/* Category breakdown row for High Density */}
        <div className="flex overflow-x-auto bg-white/40 backdrop-blur-xs divide-x divide-[#141414]">
          {chartData.slice(0, 8).map((cat) => (
            <div key={cat.name} className="flex-1 min-w-[170px] p-2.5 flex flex-col justify-between hover:bg-white transition-colors">
              <span className="text-[10px] font-bold text-slate-600 truncate mb-1 uppercase tracking-tight">
                {cat.name === '외주' ? '🛠️ 외주 (외주비)' : cat.name}
              </span>
              <div className="flex items-end justify-between">
                <span className="text-xs font-mono font-bold italic">₩{cat.value.toLocaleString()}</span>
                <span className="text-[10px] font-black text-indigo-600">
                  {totalContractAmount > 0 ? ((cat.value / totalContractAmount) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Summary Card with Material / Outsourcing split */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-700">총 계약 합계 금액</span>
            </div>
            <button 
              onClick={onOpenSectionSummary}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 shadow-2xs"
            >
              공정 분석 <ArrowRight size={12} />
            </button>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
            ₩{totalContractAmount.toLocaleString()}
          </div>

          {/* Sub-breakdown rows */}
          <div className="mt-5 space-y-2.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 font-bold text-blue-700">
                <Package size={13} /> 자재비 합계 ({materialPercent.toFixed(1)}%)
              </span>
              <span className="font-mono font-bold text-slate-800">₩{totalMaterialAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 font-bold text-amber-700">
                <Wrench size={13} /> 외주비 합계 ({laborPercent.toFixed(1)}%)
              </span>
              <span className="font-mono font-bold text-slate-800">₩{totalLaborAmount.toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500" style={{ width: `${materialPercent}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${laborPercent}%` }} />
            </div>
          </div>
        </div>
        
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <p className="text-slate-500 leading-snug">
              총 <span className="font-bold text-slate-800">{items.length}개</span> 품목 중 <span className="font-bold text-indigo-700">{classifiedItems.length}개</span> 분류 완료
            </p>
          </div>
        </div>
      </div>

      {/* Bar Chart Card */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">공종별 금액 분포 (외주비 포함)</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono">
            {chartData.length} Categories
          </span>
        </div>
        
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                dy={8}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)' }}
                formatter={(value: number) => [`₩${value.toLocaleString()}`, '금액']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === '외주' ? '#F59E0B' : colors[index % colors.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

