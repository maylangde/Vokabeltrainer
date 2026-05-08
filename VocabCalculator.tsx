import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Vocabulary } from '../types';

interface AddVocabFormProps {
  onSave: (data: Partial<Vocabulary>) => void;
  onCancel: () => void;
  initialData?: Partial<Vocabulary>;
}

export const AddVocabForm = ({ onSave, onCancel, initialData }: AddVocabFormProps) => {
  const [formData, setFormData] = useState<Partial<Vocabulary>>(initialData || {
    wortart: 'Nomen',
    level: 'A1',
    box_level: '1',
    fehlerquote: 0,
    is_hidden: false,
    source_name: 'Manuelle Eingabe',
    naechste_faelligkeit: new Date().toISOString()
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Wortart</label>
          <select name="wortart" value={formData.wortart} onChange={handleChange} className="input">
            <option value="Nomen">Nomen</option>
            <option value="Verb">Verb</option>
            <option value="Adjektiv">Adjektiv</option>
            <option value="Sonstige">Sonstige</option>
          </select>
        </div>
        <div>
          <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Sprachniveau</label>
          <select name="level" value={formData.level} onChange={handleChange} className="input">
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Grundform (Deutsch)</label>
          <input 
            name="grundform" 
            value={formData.grundform || ''} 
            onChange={handleChange} 
            className="input" 
            placeholder="z.B. Apfel oder essen"
            required 
          />
        </div>
        <div>
          <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Übersetzung (Englisch)</label>
          <input 
            name="englisch" 
            value={formData.englisch || ''} 
            onChange={handleChange} 
            className="input" 
            placeholder="e.g. apple or to eat"
            required 
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {formData.wortart === 'Nomen' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-brand/5 rounded-2xl border border-brand/10"
          >
            <div>
              <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Artikel</label>
              <select name="n_artikel" value={formData.n_artikel || ''} onChange={handleChange} className="input">
                <option value="">-</option>
                <option value="der">der</option>
                <option value="die">die</option>
                <option value="das">das</option>
              </select>
            </div>
            <div>
              <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Nominativ Singular</label>
              <input name="n_nom_sg" value={formData.n_nom_sg || ''} onChange={handleChange} className="input" placeholder="Apfel" />
            </div>
            <div>
              <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Nominativ Plural</label>
              <input name="n_nom_pl" value={formData.n_nom_pl || ''} onChange={handleChange} className="input" placeholder="Äpfel" />
            </div>
          </motion.div>
        )}

        {formData.wortart === 'Verb' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6 p-6 bg-brand/5 rounded-2xl border border-brand/10"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Hilfsverb</label>
                <select name="v_hilfsverb" value={formData.v_hilfsverb || ''} onChange={handleChange} className="input">
                  <option value="">-</option>
                  <option value="haben">haben</option>
                  <option value="sein">sein</option>
                </select>
              </div>
              <div>
                <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Partizip II</label>
                <input name="v_partizip_ii" value={formData.v_partizip_ii || ''} onChange={handleChange} className="input" placeholder="gegessen" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-brand uppercase tracking-widest">Präsens Formen</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <input name="v_praesens_ich" placeholder="ich esse" value={formData.v_praesens_ich || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praesens_du" placeholder="du isst" value={formData.v_praesens_du || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praesens_er" placeholder="er/sie/es isst" value={formData.v_praesens_er || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praesens_wir" placeholder="wir essen" value={formData.v_praesens_wir || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praesens_ihr" placeholder="ihr esst" value={formData.v_praesens_ihr || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praesens_sie" placeholder="sie essen" value={formData.v_praesens_sie || ''} onChange={handleChange} className="input text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-brand uppercase tracking-widest">Präteritum Formen</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <input name="v_praet_ich" placeholder="ich aß" value={formData.v_praet_ich || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praet_du" placeholder="du aßt" value={formData.v_praet_du || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praet_er" placeholder="er/sie/es aß" value={formData.v_praet_er || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praet_wir" placeholder="wir aßen" value={formData.v_praet_wir || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praet_ihr" placeholder="ihr aßt" value={formData.v_praet_ihr || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_praet_sie" placeholder="sie aßen" value={formData.v_praet_sie || ''} onChange={handleChange} className="input text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-brand uppercase tracking-widest">Imperativ</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input name="v_imperativ_du" placeholder="iss!" value={formData.v_imperativ_du || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_imperativ_ihr" placeholder="esst!" value={formData.v_imperativ_ihr || ''} onChange={handleChange} className="input text-xs" />
                <input name="v_imperativ_sie" placeholder="essen Sie!" value={formData.v_imperativ_sie || ''} onChange={handleChange} className="input text-xs" />
              </div>
            </div>
          </motion.div>
        )}

        {formData.wortart === 'Adjektiv' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-brand/5 rounded-2xl border border-brand/10"
          >
            <div>
              <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Komparativ</label>
              <input name="adj_komparativ" value={formData.adj_komparativ || ''} onChange={handleChange} className="input" placeholder="z.B. schöner" />
            </div>
            <div>
              <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Superlativ</label>
              <input name="adj_superlativ" value={formData.adj_superlativ || ''} onChange={handleChange} className="input" placeholder="z.B. am schönsten" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Beispielsatz</label>
        <textarea 
          name="beispielsatz" 
          value={formData.beispielsatz || ''} 
          onChange={handleChange} 
          className="input min-h-[100px]" 
          placeholder="Schreibe einen Satz mit diesem Wort..."
        />
      </div>

      <div>
        <label className="label text-xs font-bold text-brand-dark/50 uppercase tracking-widest mb-2 block">Themen (Tags, mit Komma trennen)</label>
        <input 
          type="text"
          name="tags_input"
          value={formData.tags?.join(', ') || ''}
          onChange={(e) => {
            const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t !== '');
            setFormData(prev => ({ ...prev, tags }));
          }}
          className="input"
          placeholder="z.B. Urlaub, Essen, Arbeit"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 btn-secondary !py-3">Abbrechen</button>
        <button type="submit" className="flex-1 btn-primary !py-3">Vokabel speichern</button>
      </div>
    </form>
  );
};
