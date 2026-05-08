import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { db } from '../db';
import { Vocabulary } from '../types';
import { getDeterministicVocabId } from '../lib/utils';
import { AddVocabForm } from './AddVocabForm';
import { Modal } from './Modal';

interface VocabListViewProps {
  allVocab?: Vocabulary[];
  user: User | null;
}

export const VocabListView = ({ allVocab = [], user }: VocabListViewProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVocab, setEditingVocab] = useState<Vocabulary | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('Alle');
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const filtered = useMemo(() => {
    return (allVocab || []).filter(v => {
      const matchesSearch = v.grundform.toLowerCase().includes(search.toLowerCase()) || 
                           v.englisch.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'Alle' || 
                         (filterType === 'Sonstige' ? !['Nomen', 'Verb', 'Adjektiv'].includes(v.wortart) : v.wortart === filterType);
      return matchesSearch && matchesType;
    }).sort((a, b) => a.grundform.localeCompare(b.grundform));
  }, [allVocab, search, filterType]);

  const handleSaveVocab = async (data: Partial<Vocabulary>) => {
    try {
      const now = new Date().toISOString();
      const cloudId = editingVocab?.cloudId || getDeterministicVocabId(data, data.source_name || 'manual', data.source_group);
      
      const vocabData = { 
        ...data, 
        updatedAt: now,
        cloudId
      };
      
      if (editingVocab) {
        const id = editingVocab.id!;
        await db.vocabulary.update(id, vocabData);
        setEditingVocab(null);
      } else {
        await db.vocabulary.add(vocabData as Vocabulary);
        setIsAdding(false);
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern der Vokabel.');
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    setModalConfig({
      isOpen: true,
      title: 'Vokabel löschen',
      message: 'Möchtest du diese Vokabel wirklich unwiderruflich löschen?',
      onConfirm: async () => {
        await db.vocabulary.delete(id);
        setModalConfig(null);
      }
    });
  };

  if (isAdding || editingVocab) {
    return (
      <div className="space-y-8 pb-12">
        <div className="flex items-center gap-4">
          <button onClick={() => { setIsAdding(false); setEditingVocab(null); }} className="p-2 hover:bg-brand/10 rounded-full text-brand transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-brand-dark">{editingVocab ? 'Vokabel bearbeiten' : 'Neue Vokabel'}</h1>
        </div>
        
        <div className="card">
          <AddVocabForm 
            onSave={handleSaveVocab} 
            onCancel={() => { setIsAdding(false); setEditingVocab(null); }} 
            initialData={editingVocab || undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-brand-dark">Meine Vokabeln</h1>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary flex items-center justify-center gap-2 !py-3 !px-6"
        >
          <Plus size={20} />
          Vokabel hinzufügen
        </button>
      </div>

      <div className="card space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/40" size={18} />
            <input 
              type="text" 
              placeholder="Suchen nach Deutsch oder Englisch..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-12"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-brand/40" />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input min-w-[140px]"
            >
              <option value="Alle">Alle Wortarten</option>
              <option value="Nomen">Nomen</option>
              <option value="Verb">Verb</option>
              <option value="Adjektiv">Adjektiv</option>
              <option value="Sonstige">Sonstige</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-[10px] font-bold text-brand uppercase tracking-widest px-4">
            <span>Vokabel</span>
            <span>Aktionen</span>
          </div>
          
          <div className="divide-y divide-brand/10">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-brand/60 italic">Keine Vokabeln gefunden.</p>
              </div>
            ) : (
              filtered.map(v => (
                <div key={v.id} className="py-4 flex items-center justify-between group hover:bg-brand/5 hover:shadow-md hover:shadow-brand/5 px-4 -mx-4 rounded-xl transition-all duration-300">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-brand-dark">{v.grundform}</span>
                      <span className="text-xs text-brand/60 font-medium">({v.wortart})</span>
                    </div>
                    <div className="text-sm text-brand-dark/60">{v.englisch}</div>
                    {v.tags && v.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.tags.map(tag => (
                          <span key={tag} className="text-[8px] font-bold text-brand/50 bg-brand/5 px-1.5 py-0.5 rounded-md uppercase tracking-tighter border border-brand/5">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingVocab(v)}
                      className="p-2 text-brand-dark/40 hover:text-brand hover:bg-brand/10 rounded-lg transition-all"
                      title="Bearbeiten"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(v.id)}
                      className="p-2 text-brand-dark/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalConfig && (
        <Modal 
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          onClose={() => setModalConfig(null)}
          onConfirm={modalConfig.onConfirm}
        >
          <p className="text-brand-dark/70 text-sm leading-relaxed">{modalConfig.message}</p>
        </Modal>
      )}
    </div>
  );
};
