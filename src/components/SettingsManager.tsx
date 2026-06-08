import React from 'react';
import { X, Settings, Database, Zap, Palette, Trash2, AlertTriangle } from 'lucide-react';
import { ThemeType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  onResetData: () => void;
}

export default function SettingsManager({ isOpen, onClose, theme, onThemeChange, onResetData }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">시스템 설정</h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">System Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-grow space-y-8">
          {/* Theme Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Palette className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">인터페이스 테마</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'modern', name: 'Standard Modern', desc: '표준 깔끔한 디자인' },
                { id: 'high-density', name: 'High Density', desc: '산업용 고밀도 레이아웃' },
                { id: 'industrial', name: 'Industrial Dark', desc: '눈이 편한 다크 모드' },
                { id: 'minimal', name: 'Minimalist', desc: '최소한의 간결함' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => onThemeChange(t.id as ThemeType)}
                  className={`flex flex-col p-4 rounded-2xl border-2 transition-all text-left ${
                    theme === t.id 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                  }`}
                >
                  <span className={`font-bold text-sm ${theme === t.id ? 'text-indigo-600' : 'text-slate-700'}`}>{t.name}</span>
                  <span className="text-[11px] text-slate-400 mt-1">{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* AI/Performance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Zap className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">AI 프로세싱 성능</h3>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-sm text-slate-800">Turbo Processing Mode</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Gemini AI의 병렬 처리 속도를 최대로 높입니다.</p>
                </div>
                <div className="relative w-12 h-6 bg-indigo-600 rounded-full">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-100/50 rounded-lg border border-indigo-200/50">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">AI Agent Active: GPT-4o / Gemini 1.5 Pro</span>
              </div>
            </div>
          </section>

          {/* Data Management Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Database className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">데이터 및 캐시 관리</h3>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  if (window.confirm('모든 로컬 데이터를 초기화하시겠습니까? (샘플 데이터로 복구됨)')) {
                    onResetData();
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border border-red-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 group-hover:shake" />
                  <div className="text-left">
                    <p className="font-bold text-sm">로컬 데이터 전체 삭제</p>
                    <p className="text-[11px] opacity-70">현재 작업 중인 모든 내역서 데이터가 제거됩니다.</p>
                  </div>
                </div>
                <AlertTriangle className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200"
          >
            설정 저장 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
