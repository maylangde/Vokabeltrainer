import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  History, 
  Target, 
  Clock 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { User } from 'firebase/auth';
import { Vocabulary, LearningHistory, LearningSession, UserSettings } from '../types';

interface DashboardProps {
  vocab?: Vocabulary[];
  history?: LearningHistory[];
  sessions?: LearningSession[];
  settings?: UserSettings[];
  onUpdateSetting: (key: string, value: any) => void;
  onNavigate: (view: 'dashboard' | 'learn' | 'settings' | 'calculator' | 'themes' | 'sync') => void;
  onSetBoxFilter: (box: string | undefined) => void;
  now: Date;
  t: (key: any) => string;
  user: User | null;
  syncing: boolean;
  lastSyncTime: string | null;
  onSync: () => void;
}

export const Dashboard = ({ 
  vocab = [], 
  history = [], 
  sessions = [], 
  settings = [], 
  onUpdateSetting, 
  onNavigate, 
  onSetBoxFilter, 
  now, 
  t, 
  user, 
  syncing, 
  lastSyncTime, 
  onSync 
}: DashboardProps) => {
  const [comparisonPeriod, setComparisonPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  
  const learnedIds = useMemo(() => {
    const ids = new Set<number>();
    vocab.forEach(v => {
      if (v.id && (v.box_level !== '1' || (v.times_correct || 0) > 0 || (v.times_incorrect || 0) > 0)) {
        ids.add(v.id);
      }
    });
    (history || []).forEach(h => {
      if (h.vocab_id) ids.add(h.vocab_id);
    });
    return ids;
  }, [vocab, history]);
  
  const dueCount = (vocab || []).filter(v => 
    v.box_level !== 'Archiv' && 
    v.box_level !== '1' && 
    v.naechste_faelligkeit &&
    new Date(v.naechste_faelligkeit) <= now
  ).length;

  const boxDueCounts = useMemo(() => {
    const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    (vocab || []).forEach(v => {
      if (v.box_level !== 'Archiv' && v.box_level !== '1' && v.naechste_faelligkeit && new Date(v.naechste_faelligkeit) <= now) {
        counts[v.box_level] = (counts[v.box_level] || 0) + 1;
      }
    });
    return counts;
  }, [vocab, now]);
  
  const dailyVocabLimit = (settings || []).find(s => s.key === 'daily_vocab_limit')?.value || 50;
  const dailyMinutesGoal = (settings || []).find(s => s.key === 'daily_minutes_goal')?.value || 15;
  const learningMode = (settings || []).find(s => s.key === 'learning_mode')?.value || 'time';
  const newVocabLimit = (settings || []).find(s => s.key === 'new_vocab_limit')?.value ?? 15;

  const todaySessions = useMemo(() => {
    const today = startOfDay(now);
    return (sessions || []).filter(s => new Date(s.start_time) >= today);
  }, [sessions, now]);

  const todayMinutes = useMemo(() => {
    return todaySessions.reduce((acc, s) => {
      if (!s.start_time) return acc;
      const start = new Date(s.start_time);
      const end = s.end_time ? new Date(s.end_time) : now;
      if (isNaN(start.getTime())) return acc;
      
      const diff = s.end_time 
        ? (s.duration_seconds || 0) / 60 
        : Math.min((end.getTime() - start.getTime()) / (1000 * 60), 240);
      
      return acc + (diff > 0 ? diff : 0);
    }, 0);
  }, [todaySessions, now]);

  const todayVocab = useMemo(() => todaySessions.reduce((acc, s) => acc + (s.vocab_count || 0), 0), [todaySessions]);

  const totalMinutes = useMemo(() => {
    return (sessions || []).reduce((acc, s) => {
      if (!s.start_time) return acc;
      const start = new Date(s.start_time);
      const end = s.end_time ? new Date(s.end_time) : now;
      if (isNaN(start.getTime())) return acc;
      
      const diff = s.end_time 
        ? (s.duration_seconds || 0) / 60 
        : Math.min((end.getTime() - start.getTime()) / (1000 * 60), 240);
      
      return acc + (diff > 0 ? diff : 0);
    }, 0);
  }, [sessions, now]);

  const totalVocab = useMemo(() => (sessions || []).reduce((acc, s) => acc + (s.vocab_count || 0), 0), [sessions]);
  const totalCorrect = useMemo(() => (sessions || []).reduce((acc, s) => acc + (s.correct_count || 0), 0), [sessions]);

  const vpm = totalMinutes > 0 ? (totalVocab / totalMinutes).toFixed(1) : '0';
  const correctVpm = totalMinutes > 0 ? (totalCorrect / totalMinutes).toFixed(1) : '0';
  const efficiency = totalVocab > 0 ? Math.round((totalCorrect / totalVocab) * 100) : 0;

  const last7Days = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(now, 6 - i);
      return {
        start: startOfDay(d),
        end: new Date(startOfDay(d).getTime() + 86400000),
        dateStr: format(d, 'dd.MM.'),
        count: 0,
        correct: 0,
        time: 0
      };
    });

    (history || []).forEach(h => {
      const hDate = new Date(h.timestamp);
      const day = days.find(d => hDate >= d.start && hDate < d.end);
      if (day) {
        day.count++;
        if (h.correct === 1) day.correct++;
      }
    });

    (sessions || []).forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const sDate = new Date(s.start_time);
      const day = days.find(d => sDate >= d.start && sDate < d.end);
      if (day) {
        const duration = (s.duration_seconds !== undefined && s.duration_seconds !== null)
          ? s.duration_seconds / 60 
          : (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60);
        
        if (!isNaN(duration)) {
          day.time += Math.min(duration, 240);
        }
      }
    });

    return days.map(({ dateStr, count, correct, time }) => ({ date: dateStr, count, correct, time }));
  }, [history, sessions, now]);

  const errorByWortart = useMemo(() => {
    const counts: Record<string, number> = {};
    const vocabMap = new Map(vocab.map(v => [v.id, v.wortart]));
    
    (history || []).forEach(h => {
      if (h.correct === 0) {
        const wortart = vocabMap.get(h.vocab_id);
        if (wortart) {
          counts[wortart] = (counts[wortart] || 0) + 1;
        }
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [history, vocab]);

  const distribution = useMemo(() => {
    const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, 'Archiv': 0 };
    
    vocab.forEach(v => {
      if (v.box_level !== '1' || (v.times_correct || 0) > 0 || (v.times_incorrect || 0) > 0) {
        counts[v.box_level] = (counts[v.box_level] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ 
      name: name === 'Archiv' ? 'Archiv' : `Box ${name}`, 
      value 
    }));
  }, [vocab]);

  const processedVocabCount = useMemo(() => {
    return vocab.filter(v => v.box_level !== '1' || (v.times_correct || 0) > 0 || (v.id && learnedIds.has(v.id))).length;
  }, [vocab, learnedIds]);

  const maylangStats = useMemo(() => {
    const maylangOnly = vocab.filter(v => 
      !v.source_name || 
      v.source_name === 'Maylang' || 
      v.source_name.toLowerCase().includes('maylang')
    );
    if (maylangOnly.length === 0) return { percent: 0, touched: 0, total: 0 };
    
    const touchedCount = maylangOnly.filter(v => v.id && learnedIds.has(v.id)).length;
    
    return {
      percent: Math.round((touchedCount / maylangOnly.length) * 100),
      touched: touchedCount,
      total: maylangOnly.length
    };
  }, [vocab, learnedIds]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark">{t('dashboard')}</h1>
          <p className="text-[#8c4200] mt-1">{t('progress_overview')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-sm font-mono text-brand">{format(now, 'dd. MMMM yyyy')}</span>
        </div>
      </div>
      
      <div className="card !p-6">
        <div className="flex items-center gap-2 border-b border-[#f07e261a] pb-4 mb-6">
          <BarChart3 size={18} className="text-brand" />
          <h3 className="text-sm font-bold text-brand-dark uppercase tracking-widest">Statistik Übersicht</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 border border-[#f07e2626] rounded-2xl overflow-hidden divide-x divide-y divide-[#f07e2626]">
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Bereit</span>
            <span className="text-2xl font-black text-brand-dark">{dueCount}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Gelernt</span>
            <span className="text-2xl font-black text-brand-dark">{totalVocab}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Archiv</span>
            <span className="text-2xl font-black text-emerald-500">{(vocab || []).filter(v => v.box_level === 'Archiv').length}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Fehler</span>
            <span className="text-2xl font-black text-red-500">{(history || []).filter(h => h.correct === 0).length}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Minuten</span>
            <span className="text-2xl font-black text-brand-dark">{totalMinutes.toFixed(0)}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">VOK / MIN</span>
            <span className="text-2xl font-black text-brand-dark">{vpm}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Richtig / MIN</span>
            <span className="text-2xl font-black text-brand-dark">{correctVpm}</span>
          </div>
          <div className="flex flex-col p-6 bg-[#fcfaf5]">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2 font-sans">Aktive Wörter</span>
            <span className="text-2xl font-black text-brand-dark">{processedVocabCount}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card !p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-brand" />
              <h3 className="text-[10px] font-black text-brand-dark uppercase tracking-widest leading-tight">
                Maylang<br />Fortschritt
              </h3>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-brand uppercase">{maylangStats.touched} / {maylangStats.total}</div>
              <div className="text-[10px] font-bold text-brand-dark/40 italic">({maylangStats.percent}%)</div>
            </div>
          </div>
          <div className="w-full bg-[#f07e261a] h-2.5 rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${maylangStats.percent}%` }}
              className="bg-[#f07e26] h-full shadow-[0_0_10px_#f07e264d]"
            />
          </div>
        </div>

        <div className="card !p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-brand" />
              <h3 className="text-[10px] font-black text-brand-dark uppercase tracking-widest">
                Tagesziel:<br />Vokabeln
              </h3>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-brand uppercase">{Math.round(todayVocab)} / {dailyVocabLimit}</div>
            </div>
          </div>
          <div className="w-full bg-[#f07e261a] h-2.5 rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((todayVocab / dailyVocabLimit) * 100, 100)}%` }}
              className="bg-[#f07e26] h-full shadow-[0_0_10px_#f07e264d]"
            />
          </div>
        </div>

        <div className="card !p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-brand" />
              <h3 className="text-[10px] font-black text-brand-dark uppercase tracking-widest">
                Tagesziel:<br />Zeit
              </h3>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-brand uppercase">{todayMinutes.toFixed(0)} / {dailyMinutesGoal} min</div>
            </div>
          </div>
          <div className="w-full bg-[#f07e261a] h-2.5 rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((todayMinutes / dailyMinutesGoal) * 100, 100)}%` }}
              className="bg-[#f07e26] h-full shadow-[0_0_10px_#f07e264d]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <div className="flex items-center gap-2 border-b border-brand/20 pb-2">
            <TrendingUp size={18} className="text-brand" />
            <h3 className="text-sm font-bold text-brand-dark uppercase tracking-widest">{t('learning_activity')}</h3>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f07e2622" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#f07e26', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#f07e26', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #f07e26', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '10px' }}
                />
                <Line type="monotone" dataKey="count" name={t('learned')} stroke="#f07e26" strokeWidth={2} dot={{ r: 3, fill: '#f07e26' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="time" name={t('minutes')} stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2 border-b border-brand/20 pb-2">
            <History size={18} className="text-brand" />
            <h3 className="text-sm font-bold text-brand-dark uppercase tracking-widest">{t('box_distribution')}</h3>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#c2410c'][index % 6]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #f07e26', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
