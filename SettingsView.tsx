import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  Download, 
  RefreshCw, 
  Filter, 
  CheckCircle2, 
  Play, 
  Languages, 
  Shuffle, 
  Database, 
  Target, 
  Library, 
  Plus, 
  Target as TargetIcon,
  Clock,
  PlusCircle,
  AlertCircle,
  X,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import { Vocabulary, Chapter, UserSettings, LearningHistory } from '../types';
import { COURSE_BOOKS } from '../course-books-data';
import { BOX_INTERVALS } from '../constants';
import { OwlLogo } from './OwlLogo';
import { CourseBooksView } from './CourseBooksView';
import { getVocabKey } from '../lib/utils';

interface LearnProps {
  vocab?: Vocabulary[];
  globalHistory?: LearningHistory[];
  onUpdate: (v: Vocabulary, correct: boolean, isNew: boolean, points: number, relatedIds?: number[]) => void;
  onUndo: (prevVocab: Vocabulary, wasCorrect: boolean, wasNew: boolean, points: number) => void;
  settings?: UserSettings[];
  onStartSession: () => void;
  onEndSession: () => void;
  onSessionStatusChange: (active: boolean) => void;
  onUpdateSetting: (key: string, value: any) => void;
  tagFilter?: string;
  onClearTagFilter: () => void;
  onSetTagFilter: (tag: string) => void;
  sourceFilter?: string[];
  onSetSourceFilter: (source: string[]) => void;
  groupFilter?: string;
  onSetGroupFilter: (group: string | undefined) => void;
  levelFilter?: string[];
  onSetLevelFilter: (levels: string[]) => void;
  onManageThemes: () => void;
  boxFilter?: string;
  onSetBoxFilter: (box: string | undefined) => void;
  now: Date;
  t: (key: any) => string;
  onDownloadCourseBookChapter: (chapter: Chapter) => void;
  isDownloadingCourseBook: string | null;
  onInstallSpecial?: () => Promise<void>;
  isImporting?: boolean;
}

export const Learn = ({ 
  vocab = [], 
  globalHistory = [],
  onUpdate, 
  onUndo,
  settings = [], 
  onStartSession, 
  onEndSession,
  onSessionStatusChange,
  onUpdateSetting,
  tagFilter,
  onClearTagFilter,
  onSetTagFilter,
  sourceFilter = [],
  onSetSourceFilter,
  groupFilter,
  onSetGroupFilter,
  levelFilter = [],
  onSetLevelFilter,
  onManageThemes,
  boxFilter,
  onSetBoxFilter,
  now, 
  t, 
  onDownloadCourseBookChapter, 
  isDownloadingCourseBook, 
  onInstallSpecial, 
  isImporting 
}: LearnProps) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selType, setSelType] = useState<'maylang' | 'lists' | 'special' | 'course-books'>(() => {
    if (sourceFilter?.includes('Verben mit Präposition')) return 'special';
    if (tagFilter || (sourceFilter && sourceFilter.length > 0) || groupFilter) return 'lists';
    return 'maylang';
  });

  const [mode, setMode] = useState<'de-en' | 'en-de' | 'mixed' | null>(null);
  const [selectedMode, setSelectedMode] = useState<'de-en' | 'en-de' | 'mixed'>('mixed');
  const [queue, setQueue] = useState<{ vocab: Vocabulary, direction: 'de-en' | 'en-de', relatedIds: number[] }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const progressValue = useMotionValue(0);

  useEffect(() => {
    if (queue.length > 0) {
      progressValue.set((currentIdx / queue.length) * 100);
    }
  }, [currentIdx, queue.length, progressValue]);

  const progressWidth = useTransform(progressValue, (v) => `${v}%`);

  const progressBarColor = useTransform(
    progressValue,
    [0, 100],
    ["#f27c22", "#22c55e"]
  );

  const greenOpacity = useTransform(x, [0, 200], [0, 0.7]);
  const redOpacity = useTransform(x, [-200, 0], [0.7, 0]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    x.stop();
    x.set(0);
  }, [currentIdx, showAnswer, x]);

  useEffect(() => {
    onSessionStatusChange(!!mode && !isFinished);
    return () => onSessionStatusChange(false);
  }, [mode, isFinished, onSessionStatusChange]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [promotedInSession, setPromotedInSession] = useState<Set<number>>(new Set());
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0, new: 0 });
  const [history, setHistory] = useState<{
    prevVocab: Vocabulary;
    wasCorrect: boolean;
    wasNew: boolean;
    points: number;
    wasPromoted: boolean;
    addedToQueue: boolean;
  }[]>([]);

  const learnedIds = useMemo(() => {
    const ids = new Set<number>();
    vocab.forEach(v => {
      if (v.id && (v.box_level !== '1' || (v.times_correct || 0) > 0 || (v.times_incorrect || 0) > 0)) {
        ids.add(v.id);
      }
    });
    (globalHistory || []).forEach(h => {
      if (h.vocab_id) ids.add(h.vocab_id);
    });
    return ids;
  }, [vocab, globalHistory]);

  useEffect(() => {
    if (boxFilter && !mode) {
      startLearning(boxFilter);
    }
  }, [boxFilter]);

  const levelProgressData = useMemo(() => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Business'];
    const data: Record<string, { percent: number, touched: number, total: number }> = {};
    
    levels.forEach(lvl => {
      const levelWords = (vocab || []).filter(v => {
        const isMaylang = !v.source_name || v.source_name === 'Maylang' || v.source_name.toLowerCase().includes('maylang');
        const levelMatch = v.level && v.level.toString().trim().toUpperCase() === lvl.toUpperCase();
        return isMaylang && levelMatch;
      });
      const totalCount = levelWords.length;
      if (totalCount === 0) {
        data[lvl] = { percent: 0, touched: 0, total: 0 };
      } else {
        const touchedCount = levelWords.filter(v => v.id && learnedIds.has(v.id)).length;
        data[lvl] = { 
          percent: Math.round((touchedCount / totalCount) * 100),
          touched: touchedCount,
          total: totalCount
        };
      }
    });
    return data;
  }, [vocab, learnedIds]);

  const globalModeProgress = useMemo(() => {
    const calcProgress = (sourceName: string) => {
      const words = vocab.filter(v => 
        v.source_name === sourceName || 
        (sourceName === 'Maylang' && (!v.source_name || v.source_name.toLowerCase().includes('maylang')))
      );
      if (words.length === 0) return 0;
      const touched = words.filter(v => v.id && learnedIds.has(v.id)).length;
      return Math.round((touched / words.length) * 100);
    };

    return {
      maylang: calcProgress('Maylang'),
      special: calcProgress('Verben mit Präposition')
    };
  }, [vocab, learnedIds]);

  const sessionVocab = useMemo(() => {
    let filtered = vocab.filter(v => v.box_level !== 'Archiv');
    
    if (selType === 'maylang') {
      filtered = filtered.filter(v => 
        (v.source_name || '').toLowerCase().includes('maylang') || !v.source_name
      );
      if (levelFilter.length > 0) {
        filtered = filtered.filter(v => v.level && levelFilter.includes(v.level));
      }
    } else if (selType === 'special') {
      filtered = filtered.filter(v => v.source_name === 'Verben mit Präposition');
    } else { // Type 'lists'
      if (tagFilter) {
        filtered = filtered.filter(v => (v.tags || []).includes(tagFilter));
      }
      if (groupFilter) {
        filtered = filtered.filter(v => v.source_group === groupFilter);
      }
      if (sourceFilter.length > 0) {
        filtered = filtered.filter(v => v.source_name && sourceFilter.includes(v.source_name));
      }
      if (levelFilter.length > 0) {
        filtered = filtered.filter(v => v.level && levelFilter.includes(v.level));
      }
    }
    return filtered;
  }, [vocab, selType, levelFilter, tagFilter, groupFilter, sourceFilter]);

  const boxDueCountsLocal = useMemo(() => {
    const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    sessionVocab.forEach(v => {
      if (v.box_level !== 'Archiv' && v.id && learnedIds.has(v.id) && v.naechste_faelligkeit && new Date(v.naechste_faelligkeit) <= now) {
        counts[v.box_level] = (counts[v.box_level] || 0) + 1;
      }
    });
    return counts;
  }, [sessionVocab, learnedIds, now]);

  const dailyVocabLimit = useMemo(() => (settings || []).find(s => s.key === 'daily_vocab_limit')?.value || 30, [settings]);
  const dailyMinutesGoal = useMemo(() => (settings || []).find(s => s.key === 'daily_minutes_goal')?.value || 15, [settings]);
  const learningMode = useMemo(() => (settings || []).find(s => s.key === 'learning_mode')?.value || 'time', [settings]);
  const newVocabLimit = useMemo(() => (settings || []).find(s => s.key === 'new_vocab_limit')?.value ?? 15, [settings]);

  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getSliderTrackClass = (val: number, min: number, max: number) => {
    if (val >= min && val <= max) return 'bg-emerald-500/10';
    const dist = Math.min(Math.abs(val - min), Math.abs(val - max));
    if (dist < 5) return 'bg-amber-500/10';
    return 'bg-brand/10';
  };

  useEffect(() => {
    if (mode && learningMode === 'time' && timeLeft > 0 && !isFinished) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsFinished(true);
            onEndSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, learningMode, timeLeft, isFinished, onEndSession]);

  const box2PlusCount = useMemo(() => vocab.filter(v => v.box_level !== '1' && v.box_level !== 'Archiv').length, [vocab]);
  const showBoxDisclaimer = box2PlusCount < 20;

  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [isPrepExpanded, setIsPrepExpanded] = useState(false);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const generateDailyPicks = (target: number, learnedCount: number, pool: (Vocabulary & { relatedIds: number[] })[]): (Vocabulary & { relatedIds: number[] })[] => {
    let distribution = { Nomen: 0.40, Verb: 0.33, Adjektiv: 0.07, Sonstige: 0.20 };
    if (learnedCount > 4000) distribution = { Nomen: 0.66, Verb: 0.14, Adjektiv: 0.20, Sonstige: 0.00 };
    else if (learnedCount > 2000) distribution = { Nomen: 0.53, Verb: 0.20, Adjektiv: 0.20, Sonstige: 0.07 };
    else if (learnedCount > 500) distribution = { Nomen: 0.47, Verb: 0.27, Adjektiv: 0.13, Sonstige: 0.13 };

    const slots: Record<string, number> = {};
    slots['Verb'] = Math.round(target * distribution.Verb);
    slots['Adjektiv'] = Math.round(target * distribution.Adjektiv);
    slots['Sonstige'] = Math.round(target * distribution.Sonstige);
    slots['Nomen'] = target - (slots['Verb'] + slots['Adjektiv'] + slots['Sonstige']);

    const result: (Vocabulary & { relatedIds: number[] })[] = [];
    const availableByType: Record<string, (Vocabulary & { relatedIds: number[] })[]> = {
      Nomen: [], Verb: [], Adjektiv: [], Sonstige: []
    };

    const LEVEL_MAP: Record<string, number> = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
    pool.forEach(v => {
      let type = v.wortart;
      if (type === 'Nomen' || type === 'Verb' || type === 'Adjektiv') availableByType[type].push(v);
      else availableByType['Sonstige'].push(v);
    });

    Object.keys(availableByType).forEach(type => {
      availableByType[type].sort((a, b) => {
        const lvlA = LEVEL_MAP[a.level] || 99;
        const lvlB = LEVEL_MAP[b.level] || 99;
        if (lvlA === lvlB) return Math.random() - 0.5;
        return lvlA - lvlB;
      });
    });

    const takeFromType = (type: string, count: number) => {
      if (count <= 0) return 0;
      const selected = availableByType[type].splice(0, count);
      result.push(...selected);
      return count - selected.length;
    };

    let extraNeeded = 0;
    extraNeeded += takeFromType('Sonstige', slots['Sonstige']);
    extraNeeded += takeFromType('Adjektiv', slots['Adjektiv']);
    extraNeeded += takeFromType('Verb', slots['Verb']);
    extraNeeded += takeFromType('Nomen', slots['Nomen']);

    if (extraNeeded > 0) extraNeeded = takeFromType('Nomen', extraNeeded);
    if (extraNeeded > 0) extraNeeded = takeFromType('Verb', extraNeeded);
    if (extraNeeded > 0) extraNeeded = takeFromType('Adjektiv', extraNeeded);
    if (extraNeeded > 0) extraNeeded = takeFromType('Sonstige', extraNeeded);

    return result;
  };

  const startLearning = (boxFilter?: string) => {
    setSessionStartTime(Date.now());
    let pool = sessionVocab;
    if (boxFilter) {
      pool = pool.filter(v => 
        v.box_level === boxFilter && 
        v.id && 
        learnedIds.has(v.id) && 
        v.naechste_faelligkeit && 
        new Date(v.naechste_faelligkeit) <= now
      );
    }

    const groupedPool = new Map<string, Vocabulary[]>();
    pool.forEach(v => {
      const key = getVocabKey(v);
      if (!groupedPool.has(key)) groupedPool.set(key, []);
      groupedPool.get(key)!.push(v);
    });

    const uniquePool: (Vocabulary & { relatedIds: number[] })[] = [];
    groupedPool.forEach(members => {
      const rep = members[0];
      uniquePool.push({
        ...rep,
        relatedIds: members.slice(1).map(m => m.id!)
      });
    });

    let selectedVocab: (Vocabulary & { relatedIds: number[] })[] = [];
    if (boxFilter) {
      selectedVocab = uniquePool;
    } else {
      const learnedCount = vocab.filter(v => v.box_level === 'Archiv').length;
      selectedVocab = generateDailyPicks(dailyVocabLimit, learnedCount, uniquePool);
    }

    let newQueue: { vocab: Vocabulary, direction: 'de-en' | 'en-de', relatedIds: number[] }[] = [];
    if (selectedMode === 'mixed') {
      selectedVocab.forEach((v: any) => {
        const nextDirection = v.last_direction === 'de-en' ? 'en-de' : 'de-en';
        newQueue.push({ vocab: v, direction: nextDirection, relatedIds: v.relatedIds || [] });
      });
      newQueue = shuffleArray(newQueue);
    } else {
      selectedVocab.forEach((v: any) => {
        newQueue.push({ vocab: v, direction: selectedMode, relatedIds: v.relatedIds || [] });
      });
      newQueue = shuffleArray(newQueue);
    }
    
    setQueue(newQueue);
    setMode(selectedMode);
    setCurrentIdx(0);
    setShowAnswer(false);
    setShowGrammar(false);
    setIsFinished(false);
    setPromotedInSession(new Set());
    setSessionStats({ total: 0, correct: 0, new: 0 });
    if (learningMode === 'time') setTimeLeft(dailyMinutesGoal * 60);
    onStartSession();
  };

  const handleManualEnd = () => {
    setIsFinished(true);
    const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    setSessionDuration(duration);
    onEndSession();
  };

  useEffect(() => {
    setIsProcessing(false);
    if (!isFinished && queue.length > 0 && currentIdx >= queue.length) {
      const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
      setSessionDuration(duration);
      setIsFinished(true);
      onEndSession();
    }
  }, [currentIdx, isFinished, queue.length, onEndSession, sessionStartTime]);

  const handleResult = (correct: boolean) => {
    x.stop();
    x.set(0);
    if (isProcessing || isFinished) return;
    const current = queue[currentIdx];
    if (!current) {
      setIsFinished(true);
      onEndSession();
      return;
    }

    setIsProcessing(true);
    const isNew = !learnedIds.has(current.vocab.id);
    let newBox = current.vocab.box_level === 'Archiv' ? 6 : parseInt(current.vocab.box_level);
    let newFehlerquote = current.vocab.fehlerquote;
    
    if (correct) {
      if (isNew) {
        newBox = 1;
        setPromotedInSession(prev => new Set(prev).add(current.vocab.id!));
      } else {
        if (!promotedInSession.has(current.vocab.id!)) {
          newBox = Math.min(newBox + 1, 6);
          setPromotedInSession(prev => new Set(prev).add(current.vocab.id!));
        }
      }
    } else {
      newBox = 1;
      newFehlerquote += 1;
      if (promotedInSession.has(current.vocab.id!)) {
        setPromotedInSession(prev => {
          const next = new Set(prev);
          next.delete(current.vocab.id!);
          return next;
        });
      }
    }

    const boxStr = newBox === 6 ? 'Archiv' : newBox.toString();
    const customIntervals = settings.find(s => s.key === 'box_intervals')?.value || BOX_INTERVALS;
    const interval = customIntervals[boxStr] || 0;
    const nextDue = new Date();
    nextDue.setHours(nextDue.getHours() + Math.round(interval * 24));

    const updatedVocab: Vocabulary = {
      ...current.vocab,
      box_level: boxStr,
      fehlerquote: newFehlerquote,
      naechste_faelligkeit: nextDue.toISOString(),
      last_direction: current.direction
    };

    onUpdate(updatedVocab, correct, isNew, 1, current.relatedIds);
    const wasPromoted = correct && !promotedInSession.has(current.vocab.id!);
    
    setHistory(prev => [...prev, {
      prevVocab: current.vocab,
      wasCorrect: correct,
      wasNew: isNew,
      points: 1,
      wasPromoted,
      addedToQueue: !correct
    }]);

    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0),
      new: prev.new + (isNew ? 1 : 0)
    }));

    const nextQueue = queue.map(item => 
      item.vocab.id === updatedVocab.id ? { ...item, vocab: updatedVocab } : item
    );
    if (!correct) nextQueue.push({ ...current, vocab: updatedVocab });
    setQueue(nextQueue);

    const isLastItem = currentIdx >= nextQueue.length - 1;
    if (!isLastItem) {
      setCurrentIdx(prev => prev + 1);
      setShowAnswer(false);
      setShowGrammar(false);
    } else {
      if (learningMode === 'time' && timeLeft > 0) {
        setQueue(prev => [...prev].sort(() => Math.random() - 0.5));
        setCurrentIdx(0);
        setShowAnswer(false);
        setShowGrammar(false);
      } else {
        const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
        setSessionDuration(duration);
        setIsFinished(true);
        onEndSession();
      }
    }
  };

  const handleUndo = async () => {
    if (isProcessing || isFinished || history.length === 0 || currentIdx === 0) return;
    setIsProcessing(true);
    const lastAction = history[history.length - 1];
    try {
      await onUndo(lastAction.prevVocab, lastAction.wasCorrect, lastAction.wasNew, lastAction.points);
      setSessionStats(prev => ({
        total: Math.max(0, prev.total - 1),
        correct: Math.max(0, prev.correct - (lastAction.wasCorrect ? 1 : 0)),
        new: Math.max(0, prev.new - (lastAction.wasNew ? 1 : 0))
      }));
      if (lastAction.wasPromoted) {
        setPromotedInSession(prev => {
          const next = new Set(prev);
          next.delete(lastAction.prevVocab.id!);
          return next;
        });
      }
      setQueue(prev => {
        const next = [...prev];
        if (lastAction.addedToQueue) next.pop();
        next[currentIdx - 1] = { ...next[currentIdx - 1], vocab: lastAction.prevVocab };
        return next;
      });
      setCurrentIdx(prev => prev - 1);
      setShowAnswer(true);
      setShowGrammar(false);
      setHistory(prev => prev.slice(0, -1));
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getGermanDisplay = (v: Vocabulary) => {
    if (v.wortart === 'Nomen' && v.n_artikel) return `${v.n_artikel} ${v.grundform}`;
    return v.grundform;
  };

  if (sessionVocab.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        {tagFilter ? (
          <>
            <Filter className="w-16 h-16 text-brand/40" />
            <h2 className="text-2xl font-bold text-brand-dark">Thema leer</h2>
            <p className="text-brand-dark/70 text-center max-w-xs">
              Es wurden keine Vokabeln im Thema "{tagFilter}" gefunden.
            </p>
            <button onClick={onClearTagFilter} className="btn-secondary !py-2 !px-4 !text-[10px] mt-4">
              Zurück zum allgemeinen Lernen
            </button>
          </>
        ) : selType === 'special' ? (
          <>
            <Library className="w-16 h-16 text-brand/40" />
            <h2 className="text-2xl font-bold text-brand-dark">Keine Spezial-Vokabeln</h2>
            <p className="text-brand-dark/70 text-center max-w-xs">
              Die "Verben mit Präposition" wurden noch nicht geladen oder sind alle im Archiv.
            </p>
            <button onClick={() => onInstallSpecial?.()} disabled={isImporting} className="btn-primary !py-3 !px-6 mt-4">
              {isImporting ? 'Lädt...' : 'Spezial-Vokabeln jetzt laden'}
            </button>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-16 h-16 text-brand" />
            <h2 className="text-2xl font-bold text-brand-dark">Alles erledigt!</h2>
            <p className="text-brand-dark/70">Du hast alle fälligen Vokabeln für heute gelernt.</p>
          </>
        )}
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="w-full space-y-8 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black text-brand-dark tracking-tight">{t('what_to_learn')}</h2>
              <button 
                onClick={() => setIsPrepExpanded(!isPrepExpanded)}
                className="inline-flex items-center gap-2 bg-brand/10 text-brand px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand/20 transition-colors"
              >
                <Play size={10} fill="currentColor" className={isPrepExpanded ? 'rotate-90' : ''} /> {t('session_prep')}
                {isPrepExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            <div className="space-y-10">
              <AnimatePresence>
                {isPrepExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-10">
                    <section className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-black shadow-lg shadow-brand/20">1</div>
                          <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest">{t('vocabularies')}</h3>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button onClick={() => { setSelType('maylang'); onSetSourceFilter([]); onSetGroupFilter(undefined); }} className={`card !p-4 !p-6 flex flex-col md:flex-row items-center gap-4 transition-all relative overflow-hidden ${selType === 'maylang' ? 'selected-effect text-brand' : 'bg-brand-light/20 border-brand/10 hover:border-brand/30'}`}>
                          <div className="absolute top-0 left-0 h-full bg-emerald-500/10 transition-all duration-1000 pointer-events-none" style={{ width: `${globalModeProgress.maylang}%` }} />
                          <div className={`w-10 h-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10 ${selType === 'maylang' ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>
                            <OwlLogo className="w-10 h-10 transition-all duration-300" fill={selType === 'maylang' ? 'white' : '#f27c22'} />
                          </div>
                          <div className="font-black text-xs md:text-sm text-brand-dark relative z-10 text-center md:text-left">Wortschatz Maylang</div>
                        </button>

                        <button onClick={() => { setSelType('course-books'); onSetSourceFilter([]); onSetGroupFilter(undefined); }} className={`card !p-4 !p-6 flex flex-col md:flex-row items-center gap-4 transition-all relative overflow-hidden ${selType === 'course-books' ? 'selected-effect text-brand' : 'bg-brand-light/20 border-brand/10 hover:border-brand/30'}`}>
                          <div className={`w-10 h-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10 ${selType === 'course-books' ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>
                            <BookOpen size={24} />
                          </div>
                          <div className="font-black text-xs md:text-sm text-brand-dark relative z-10 text-center md:text-left">Kursbücher</div>
                        </button>

                        <button onClick={() => { setSelType('special'); onSetSourceFilter(['Verben mit Präposition']); onSetGroupFilter(undefined); }} className={`card !p-4 !p-6 flex flex-col md:flex-row items-center gap-4 transition-all relative overflow-hidden ${selType === 'special' ? 'selected-effect text-brand' : 'bg-brand-light/20 border-brand/10 hover:border-brand/30'}`}>
                          <div className="absolute top-0 left-0 h-full bg-emerald-500/10 transition-all duration-1000 pointer-events-none" style={{ width: `${globalModeProgress.special}%` }} />
                          <div className={`w-10 h-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10 ${selType === 'special' ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>
                            <Library size={24} />
                          </div>
                          <div className="font-black text-xs md:text-sm text-brand-dark relative z-10 text-center md:text-left">Verben / Präp.</div>
                        </button>

                        <button onClick={() => { setSelType('lists'); onSetSourceFilter([]); onSetGroupFilter(undefined); }} className={`card !p-4 !p-6 flex flex-col md:flex-row items-center gap-4 transition-all ${selType === 'lists' ? 'selected-effect text-brand' : 'bg-brand-light/20 border-brand/10 hover:border-brand/30'}`}>
                          <div className={`w-10 h-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${selType === 'lists' ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>
                            <Database size={24} />
                          </div>
                          <div className="font-black text-xs md:text-sm text-brand-dark text-center md:text-left">Listen & Themen</div>
                        </button>
                      </div>

                      {selType === 'maylang' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card !p-6 space-y-4 bg-brand-light/20 border-brand/10">
                          <h4 className="text-xs font-bold text-brand-dark uppercase tracking-widest flex items-center gap-2">
                            <Target size={14} className="text-brand" /> Level auswählen
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['A1', 'A2', 'B1', 'B2'].map(level => {
                              const data = levelProgressData[level] || { percent: 0, touched: 0, total: 0 };
                              return (
                                <button key={level} onClick={() => onSetLevelFilter(levelFilter.includes(level) ? levelFilter.filter(l => l !== level) : [...levelFilter, level])} className={`px-4 py-2 rounded-xl text-xs font-black transition-all relative overflow-hidden h-14 ${levelFilter.includes(level) ? 'selected-effect-inner ring-2 ring-brand' : 'bg-white/50 text-brand-dark/40 hover:text-brand'}`}>
                                  <div className="absolute top-0 left-0 h-full bg-emerald-500/20 pointer-events-none" style={{ width: `${data.percent}%` }} />
                                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                                    <span className="text-sm">{level} <span className="text-[8px] opacity-70">({data.touched}/{data.total})</span></span>
                                    <span className="text-[8px] opacity-60">{data.percent}%</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                      {selType === 'course-books' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <CourseBooksView 
                            vocab={vocab}
                            onStartSession={(bookId, chapterTitle) => {
                              onSetSourceFilter([COURSE_BOOKS.find(b => b.id === bookId)?.title || bookId]);
                              onSetGroupFilter(chapterTitle);
                              startLearning();
                            }}
                            onDownloadChapter={onDownloadCourseBookChapter}
                            isDownloading={isDownloadingCourseBook}
                            t={t}
                          />
                        </motion.div>
                      )}

                      {selType === 'lists' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card !p-12 space-y-4 bg-brand-light/10 border-dashed border-brand/20 flex flex-col items-center justify-center text-center">
                          <Plus size={32} className="text-brand/30" />
                          <h3 className="text-sm font-black text-brand-dark uppercase">Listen & Themen</h3>
                          <p className="text-[10px] text-brand-dark/40 font-bold uppercase tracking-widest mt-1">Demnächst verfügbar</p>
                        </motion.div>
                      )}
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-black shadow-lg shadow-brand/20">2</div>
                        <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest">{t('learning_direction')}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'de-en', label: 'DE → EN', sub: t('de_to_en'), icon: Languages },
                          { id: 'en-de', label: 'EN → DE', sub: t('en_to_de'), icon: BookOpen },
                          { id: 'mixed', label: t('mixed'), sub: t('random_change'), icon: Shuffle },
                        ].map(item => (
                          <button key={item.id} onClick={() => setSelectedMode(item.id as any)} className={`card !p-5 text-center flex flex-col items-center gap-3 transition-all ${selectedMode === item.id ? 'selected-effect' : 'bg-brand-light/20 border-brand/10'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${selectedMode === item.id ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}><item.icon size={24} /></div>
                            <div className="font-black text-sm text-brand-dark">{item.label}</div>
                            <div className="text-[10px] text-brand-dark/40 font-medium">{item.sub}</div>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-black shadow-lg shadow-brand/20">3</div>
                        <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest">{t('session_goal')}</h3>
                      </div>
                      <div className="card !p-8 space-y-8 bg-brand-light/20 border-brand/10">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                          <h4 className="text-xs font-bold text-brand-dark uppercase tracking-widest flex items-center gap-2"><TargetIcon size={14} className="text-brand" /> {t('how_to_measure')}</h4>
                          <div className="flex p-1.5 bg-white/80 rounded-2xl border border-brand/10">
                            {['count', 'time'].map(m => (
                              <button key={m} onClick={() => onUpdateSetting('learning_mode', m)} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${learningMode === m ? 'selected-effect-inner' : 'text-brand-dark/40'}`}>{t(m === 'count' ? 'card_count' : 'time_limit')}</button>
                            ))}
                          </div>
                        </div>
                        <div className="pt-4 border-t border-brand/5">
                          {learningMode === 'count' ? (
                            <div className="space-y-6">
                              <span className="text-4xl font-black text-brand-dark">{dailyVocabLimit} <span className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">{t('vocab_count')}</span></span>
                              <input type="range" min="5" max="100" step="5" value={dailyVocabLimit} onChange={(e) => onUpdateSetting('daily_vocab_limit', parseInt(e.target.value))} className={`w-full h-2.5 rounded-full appearance-none cursor-pointer accent-brand ${getSliderTrackClass(dailyVocabLimit, 45, 55)}`} />
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <span className="text-4xl font-black text-brand-dark">{dailyMinutesGoal} <span className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">{t('minutes')}</span></span>
                              <input type="range" min="5" max="60" step="5" value={dailyMinutesGoal} onChange={(e) => onUpdateSetting('daily_minutes_goal', parseInt(e.target.value))} className={`w-full h-2.5 rounded-full appearance-none cursor-pointer accent-brand ${getSliderTrackClass(dailyMinutesGoal, 15, 20)}`} />
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => startLearning()} disabled={sessionVocab.length === 0} className="btn-action w-full !py-6">
                <Play size={24} fill="currentColor" /> {sessionVocab.length === 0 ? t('no_vocab_available') : t('start_session')}
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pb-8">
                {['1', '2', '3', '4', '5'].map(boxNum => {
                  const due = boxDueCountsLocal[boxNum] || 0;
                  return (
                    <button key={boxNum} onClick={() => startLearning(boxNum)} disabled={due === 0} className={`px-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all shadow-xl ${due === 0 ? 'bg-[#f5f0e8] border-[#e5dec9] text-[#a89d85] cursor-not-allowed shadow-none' : 'bg-[#fff5eb] border-[#f07e26] text-[#8c4200] hover:bg-[#f07e26] hover:text-white active:scale-95'}`}>
                      Box {boxNum} ({due})
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
      </div>
    );
  }

  if (isFinished) {
    const mins = Math.floor(sessionDuration / 60);
    const secs = sessionDuration % 60;
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center">
        <CheckCircle2 size={48} className="text-brand" />
        <h2 className="text-3xl font-bold text-brand-dark">{t('session_finished')}</h2>
        <p className="text-brand-dark/70">Du hast {queue.length} {t('cards_processed')}.</p>
        <p className="text-sm font-bold text-brand">{sessionStats.correct} / {sessionStats.total} richtig ({mins}m {secs}s)</p>
        <button onClick={() => setMode(null)} className="btn-primary !py-3 !px-8">{t('back_to_dashboard')}</button>
      </div>
    );
  }

  const current = queue[currentIdx];
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between bg-white/50 p-4 rounded-2xl border border-brand/10">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-brand uppercase">{learningMode === 'time' ? t('time_remaining') : t('progress')}</span>
              <span className="text-sm font-mono text-brand-dark font-bold">{learningMode === 'time' ? formatTime(timeLeft) : `${currentIdx + 1} / ${queue.length}`}</span>
            </div>
            <div className="flex flex-col border-l border-brand/10 pl-4">
              <span className="text-[10px] font-bold text-brand uppercase">Richtig</span>
              <span className="text-sm font-mono font-bold text-brand-dark">{sessionStats.correct}</span>
            </div>
          </div>
          <button onClick={handleManualEnd} className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase flex items-center gap-1.5"><X size={14} /> Beenden</button>
        </div>
        <div className="w-full h-1.5 bg-brand/10 rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ width: progressWidth, backgroundColor: progressBarColor }} initial={{ width: 0 }} transition={{ duration: 0.4 }} />
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={currentIdx + (showAnswer ? '-back' : '-front')}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            drag={showAnswer}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 100) handleResult(true);
              else if (info.offset.x < -100) handleResult(false);
              else x.set(0);
            }}
            style={{ x, rotate }}
            className={`card min-h-[400px] flex flex-col items-center justify-center text-center p-8 relative cursor-grab active:cursor-grabbing`}
          >
            <motion.div className="absolute inset-0 bg-green-500 pointer-events-none" style={{ opacity: greenOpacity }} />
            <motion.div className="absolute inset-0 bg-red-500 pointer-events-none" style={{ opacity: redOpacity }} />

            {!showAnswer ? (
              <div className="space-y-8 w-full relative z-10">
                <span className="text-xs font-bold text-brand uppercase">{current.direction === 'de-en' ? t('de_en') : t('en_de')}</span>
                <h2 className="text-5xl font-bold text-brand-dark leading-tight">{current.direction === 'de-en' ? getGermanDisplay(current.vocab) : current.vocab.englisch}</h2>
                <button onClick={() => setShowAnswer(true)} className="btn-primary px-12 mt-8">{t('show_answer')}</button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-between py-4 relative z-10">
                <div className="space-y-6">
                  <span className="text-xs font-bold text-brand uppercase">{t('answer')}</span>
                  <h2 className="text-5xl font-bold text-brand-dark leading-tight">{current.direction === 'de-en' ? current.vocab.englisch : getGermanDisplay(current.vocab)}</h2>
                </div>
                <div className="mt-8 p-6 bg-brand/5 rounded-2xl text-left space-y-4">
                  <div className="flex justify-between font-bold text-brand-dark"><span>{current.vocab.wortart}</span><span>{current.vocab.level}</span></div>
                  {current.vocab.beispielsatz && <p className="text-sm italic text-brand-dark/80 italic mt-4">"{current.vocab.beispielsatz}"</p>}
                </div>
                <div className="mt-8 flex justify-between w-full px-4 text-[10px] font-bold text-brand/40 uppercase">
                  <span>← Falsch</span>
                  <button onClick={() => setShowAnswer(false)} className="text-brand hover:text-brand-dark">Zurück</button>
                  <span>Richtig →</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-center">
        {currentIdx > 0 && <button onClick={handleUndo} className="text-[10px] font-bold text-brand-dark/30 hover:text-brand uppercase flex items-center gap-1.5"><RotateCcw size={12} /> {t('undo_last_card')}</button>}
      </div>
    </div>
  );
};
