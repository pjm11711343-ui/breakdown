import React from 'react';
import { SpecItem, ThemeType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { BarChart3, TrendingUp, Info, LayoutGrid, ArrowRight } from 'lucide-react';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  onOpenSectionSummary: () => void;
}

export default function Dashboard({ items, theme, onOpenSectionSummary }: Props) {
  const filteredItems = items.filter(item => {
    const cat = item.category || '미분류';
    return !['미분류', '외주', '열선', '지금자재'].includes(cat);
  });

  const categoryTotals = filteredItems.reduce((acc, item) => {
    const cat = item.category || '미분류';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += item.amount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  const totalAmount = filteredItems.reduce((sum, item) => sum + item.amount, 0);

  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

  if (theme === 'high-density') {
    return (
      <div className="border-b border-[#141414] bg-[#F4F4F2]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-[#141414]">
          <div className="p-4 border-r border-b lg:border-b-0 border-[#141414] flex flex-col">
            <span className="text-[11px] uppercase opacity-50 font-bold mb-1">총 계약 합계 금액</span>
            <span className="text-xl lg:text-2xl font-mono leading-none tracking-tighter italic font-black">₩{totalAmount.toLocaleString()}</span>
          </div>
          <div className="p-4 border-r lg:border-r border-b lg:border-b-0 border-[#141414] flex flex-col">
            <span className="text-[11px] uppercase opacity-50 font-bold mb-1">분리된 공정 수</span>
            <span className="text-xl lg:text-2xl font-mono leading-none italic">{Object.keys(categoryTotals).length} <small className="text-xs opacity-50">Groups</small></span>
          </div>
          <div className="p-4 border-r border-[#141414] flex flex-col">
            <span className="text-[11px] uppercase opacity-50 font-bold mb-1">분석 완료 품목</span>
            <span className="text-xl lg:text-2xl font-mono leading-none text-blue-600 italic">{items.length}</span>
          </div>
          <div className="p-4 flex flex-col bg-white relative group cursor-pointer overflow-hidden border-b lg:border-b-0 border-[#141414]" onClick={onOpenSectionSummary}>
            <div className="absolute inset-0 bg-yellow-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
            <div className="relative z-10">
              <span className="text-[11px] uppercase opacity-50 font-bold mb-1 group-hover:text-black">공정 상세 분석 리포트</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black uppercase text-indigo-600 group-hover:text-black">OPEN_ANALYSIS</span>
                <LayoutGrid size={16} className="group-hover:rotate-90 transition-transform text-indigo-400 group-hover:text-black" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Category breakdown row for High Density */}
        <div className="flex overflow-x-auto bg-white/30 backdrop-blur-sm divide-x divide-[#141414]">
          {chartData.slice(0, 6).map((cat, idx) => (
            <div key={cat.name} className="flex-1 min-w-[180px] p-3 flex flex-col justify-between hover:bg-white transition-colors">
              <span className="text-[9px] font-bold text-slate-500 truncate mb-1 uppercase tracking-tight">{cat.name}</span>
              <div className="flex items-end justify-between">
                <span className="text-xs font-mono font-bold italic">₩{cat.value.toLocaleString()}</span>
                <span className="text-[9px] font-black text-blue-500">{((cat.value / totalAmount) * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
      {/* Summary Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">총 계약 합계</span>
            </div>
            <button 
              onClick={onOpenSectionSummary}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1.5 rounded-full"
            >
              공정 분석 <ArrowRight size={12} />
            </button>
          </div>
          <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
            ₩{totalAmount.toLocaleString()}
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 text-sm">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Info className="w-4 h-4" />
            </div>
            <p className="text-slate-500 leading-snug">
              총 <span className="font-bold text-slate-800">{items.length}</span>개의 품목이 분석되었습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Bar Chart Card */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-5 h-4 text-slate-400" />
          <h3 className="font-bold text-slate-800">공종별 금액 분포</h3>
        </div>
        
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`₩${value.toLocaleString()}`, '합계']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
