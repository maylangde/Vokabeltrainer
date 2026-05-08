import React, { useState, useMemo } from 'react';
import { Plus, Search, ArrowLeft, ArrowUpDown, Filter, FileText, Edit2, Trash2, BookOpen } from 'lucide-react';
import { db } from '../db';
import { Vocabulary } from '../types';

interface ThemesViewProps {
  allVocab?: Vocabulary[];
  onStartSession: (tag: string) => void;
}

export const ThemesView = ({ allVocab = [], onStartSession }: ThemesViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Vocabulary, direction: 'asc' | 'desc' }>({ key: 'grundform', direction: 'asc' });

  const tags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    (allVocab || []).forEach(v => {
      (v.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  }, [allVocab]);

  const handleStartCreate = () => {
    setEditingTag(null);
    setNewThemeName('');
    setSelectedIds(new Set());
    setIsEditing(true);
  };

  const handleStartEdit = (tag: string) => {
    setEditingTag(tag);
    setNewThemeName(tag);
    const ids = allVocab
      .filter(v => (v.tags || []).includes(tag))
      .map(v => v.id!)
      .filter(id => id !== undefined);
    setSelectedIds(new Set(ids));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!newThemeName.trim()) return;

    const tagToUse = newThemeName.trim();
    
    if (editingTag) {
      const itemsWithOldTag = allVocab.filter(v => (v.tags || []).includes(editingTag));
      for (const item of itemsWithOldTag) {
        const newTags = (item.tags || []).filter(t => t !== editingTag);
        await db.vocabulary.update(item.id!, { tags: newTags });
      }
    }

    const selectedItems = allVocab.filter(v => selectedIds.has(v.id!));
    for (const item of selectedItems) {
      const currentTags = item.tags || [];
      if (!currentTags.includes(tagToUse)) {
        await db.vocabulary.update(item.id!, { tags: [...currentTags, tagToUse] });
      }
    }

    setIsEditing(false);
    setEditingTag(null);
    setNewThemeName('');
    setSelectedIds(new Set());
  };

  const handleDelete = async (tag: string) => {
    if (confirm(`Möchtest du das Thema "${tag}" wirklich löschen? Die Vokabeln bleiben erhalten, aber die Zuordnung zum Thema wird entfernt.`)) {
      const itemsWithTag = allVocab.filter(v => (v.tags || []).includes(tag));
      for (const item of itemsWithTag) {
        const newTags = (item.tags || []).filter(t => t !== tag);
        await db.vocabulary.update(item.id!, { tags: newTags });
      }
    }
  };

  const filteredVocab = useMemo(() => {
    let result = [...allVocab];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(v => 
        v.grundform.toLowerCase().includes(lower) || 
        v.englisch.toLowerCase().includes(lower)
      );
    }
    
    result.sort((a, b) => {
      const valA = (a[sortConfig.key] || '').toString().toLowerCase();
      const valB = (b[sortConfig.key] || '').toString().toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [allVocab, searchTerm, sortConfig]);

  const toggleSort = (key: keyof Vocabulary) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (isEditing) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsEditing(false)}
              className="p-2 hover:bg-brand/10 rounded-xl text-brand transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-brand-dark">
              {editingTag ? 'Thema bearbeiten' : 'Neues Thema erstellen'}
            </h1>
          </div>
          <button 
            onClick={handleSave}
            disabled={!newThemeName.trim() || selectedIds.size === 0}
            className="btn-primary !py-3 !px-8 disabled:opacity-50"
          >
            Speichern
          </button>
        </div>

        <div className="card space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-brand-dark/60 uppercase tracking-widest">Name des Themas</label>
            <input 
              type="text"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="z.B. Urlaub, Business, Küche..."
              className="w-full px-4 py-3 rounded-2xl border border-brand/20 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="text-xs font-bold text-brand-dark/60 uppercase tracking-widest">Vokabeln auswählen ({selectedIds.size})</label>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand/40" size={16} />
                <input 
                  type="text"
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-brand/10 focus:ring-2 focus:ring-brand focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="border border-brand/10 rounded-2xl overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="bg-brand-light/50">
                      <th className="p-4 w-12">
                        <input 
                          type="checkbox" 
                          checked={filteredVocab.length > 0 && filteredVocab.every(v => selectedIds.has(v.id!))}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIds);
                            filteredVocab.forEach(v => {
                              if (e.target.checked) newSelected.add(v.id!);
                              else newSelected.delete(v.id!);
                            });
                            setSelectedIds(newSelected);
                          }}
                          className="w-4 h-4 rounded border-brand/20 text-brand focus:ring-brand"
                        />
                      </th>
                      <th className="p-4 text-xs font-bold text-brand-dark/60 uppercase cursor-pointer hover:text-brand" onClick={() => toggleSort('grundform')}>
                        <div className="flex items-center gap-1">Grundform <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="p-4 text-xs font-bold text-brand-dark/60 uppercase cursor-pointer hover:text-brand" onClick={() => toggleSort('englisch')}>
                        <div className="flex items-center gap-1">Englisch <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="p-4 text-xs font-bold text-brand-dark/60 uppercase cursor-pointer hover:text-brand" onClick={() => toggleSort('wortart')}>
                        <div className="flex items-center gap-1">Wortart <ArrowUpDown size={12} /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand/5">
                    {filteredVocab.map(v => (
                      <tr 
                        key={v.id} 
                        className={`hover:bg-brand/5 transition-colors cursor-pointer ${selectedIds.has(v.id!) ? 'bg-brand/5' : ''}`}
                        onClick={() => {
                          const newSelected = new Set(selectedIds);
                          if (newSelected.has(v.id!)) newSelected.delete(v.id!);
                          else newSelected.add(v.id!);
                          setSelectedIds(newSelected);
                        }}
                      >
                        <td className="p-4">
                          <input 
                            type="checkbox"
                            checked={selectedIds.has(v.id!)}
                            onChange={() => {}} // Handled by row click
                            className="w-4 h-4 rounded border-brand/20 text-brand focus:ring-brand"
                          />
                        </td>
                        <td className="p-4 text-sm font-medium text-brand-dark">{v.grundform}</td>
                        <td className="p-4 text-sm text-brand-dark/70">{v.englisch}</td>
                        <td className="p-4 text-xs">
                          <span className="px-2 py-1 bg-brand/10 text-brand rounded-lg font-bold">
                            {v.wortart}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-brand-dark">Themen</h1>
        <button 
          onClick={handleStartCreate}
          className="btn-primary !py-3 !px-6"
        >
          <Plus size={20} /> Thema anlegen
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {tags.length === 0 ? (
          <div className="col-span-full card py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto text-brand">
              <Filter size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-brand-dark">Keine Themen gefunden</h3>
              <p className="text-brand-dark/60 max-w-xs mx-auto">
                Erstelle dein erstes Thema, um deine Vokabeln gezielt zu gruppieren.
              </p>
            </div>
          </div>
        ) : (
          tags.map(([tag, count]) => (
            <div key={tag} className="card group hover:selected-effect transition-all duration-300 flex flex-col h-full">
              <div className="space-y-4 flex-grow">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-brand/10 rounded-2xl text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                    <FileText size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleStartEdit(tag)}
                      className="p-2 text-brand/40 hover:text-brand hover:bg-brand/10 rounded-lg transition-all"
                      title="Bearbeiten"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(tag)}
                      className="p-2 text-brand/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-brand-dark">{tag}</h3>
                    <span className="text-xs font-mono font-bold text-brand bg-brand/5 px-2 py-1 rounded-lg">
                      {count} Wörter
                    </span>
                  </div>
                  <p className="text-xs text-brand-dark/60 mt-1">Gezieltes Training für dieses Thema.</p>
                </div>
              </div>
              <button 
                onClick={() => onStartSession(tag)}
                className="mt-6 btn-action w-full !text-sm !py-4"
              >
                <BookOpen size={18} />
                Thema üben
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
