import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Tags } from 'lucide-react';

interface Props {
  categories: string[];
  onUpdate: (categories: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryManager({ categories, onUpdate, isOpen, onClose }: Props) {
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      onUpdate([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleDelete = (index: number) => {
    const newList = categories.filter((_, i) => i !== index);
    onUpdate(newList);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingValue(categories[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editingValue.trim()) {
      const newList = [...categories];
      newList[editingIndex] = editingValue.trim();
      onUpdate(newList);
      setEditingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Tags className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">카테고리 관리</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="새 카테고리 이름 입력..."
              className="flex-grow px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button 
              onClick={handleAdd}
              className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-2">
            {categories.map((cat, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors"
              >
                {editingIndex === idx ? (
                  <>
                    <input 
                      type="text" 
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="flex-grow px-3 py-1 border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingIndex(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-md">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-grow font-medium text-slate-700">{cat}</span>
                    <button 
                      onClick={() => startEditing(idx)}
                      className="p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(idx)}
                      className="p-1.5 text-slate-400 hover:bg-white hover:text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
