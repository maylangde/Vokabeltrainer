import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Cloud,
  Info,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  LayoutDashboard,
  BookOpen,
  Settings,
  AlertCircle,
  BarChart3,
  Cloud as SyncIcon, // Alias if needed
  Database,
  Library,
  Languages,
  Play,
  FilePlus,
  RefreshCw as RefreshCwIcon,
  Search,
  CheckCircle2,
  Filter,
  X,
  Target,
  Shuffle,
  ChevronDown,
  ChevronUp,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { translations, Language } from './i18n';
import { db } from './db';
import { Vocabulary, Chapter, UserSettings } from './types';
import { COURSE_BOOKS, CHAPTERS } from './course-books-data';
import { auth, storage, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, uploadString, getDownloadURL, deleteObject, getBytes } from 'firebase/storage';
import { BOX_INTERVALS } from './constants';

// Components
import { Logo } from './components/Logo';
import { OwlLogo } from './components/OwlLogo';
import { LoadingScreen } from './components/LoadingScreen';
import { Modal } from './components/Modal';
import { Dashboard } from './components/Dashboard';
import { CourseBooksView } from './components/CourseBooksView';
import { Learn } from './components/Learn';
import { SettingsView } from './components/SettingsView';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { ThemesView } from './components/ThemesView';
import { VocabCalculator } from './components/VocabCalculator';

// Utils
import { getVocabKey, getDeterministicVocabId } from './lib/utils';

// Detect if running in Electron
const isElectron = /electron/i.test(navigator.userAgent);

// --- Main App ---

export default function App() {
  const [now, setNow] = useState(new Date());
  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncInitialized, setSyncInitialized] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [sessionDirtyCids, setSessionDirtyCids] = useState<Set<string>>(new Set());
  const [conflictData, setConflictData] = useState<{ 
    localTime: string; 
    cloudTime: string; 
    cloudSnapshot: any;
    resolve: (choice: 'local' | 'cloud' | 'merge') => void;
  } | null>(null);

  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Trigger initial sync with a defensive timeout (5s)
        try {
          await Promise.race([
            performInitialSync(u.uid),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Sync Timeout')), 5000))
          ]);
          console.log('✅ Initial sync completed safely');
        } catch (e) {
          console.warn('⚠️ Initial sync failed or timed out. Proceeding in local mode:', e);
          setStatus('Cloud-Limit erreicht oder Verbindung verzögert. Lokaler Modus aktiv.');
          setTimeout(() => setStatus(''), 4000);
        }
        setSyncInitialized(true);
      } else {
        setSyncInitialized(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const deleteUserCloudData = async () => {
    if (!user) return;
    
    setModalConfig({
      isOpen: true,
      title: 'Cloud-Daten löschen',
      type: 'danger',
      confirmText: 'Ja, alles löschen',
      children: (
        <div className="space-y-4">
          <p className="text-sm text-brand-dark">
            Möchtest du wirklich alle deine Lernfortschritte in der Cloud löschen? Dein lokaler Stand auf diesem Gerät wird dabei ebenfalls auf Anfang zurückgesetzt.
          </p>
          <p className="text-xs text-brand-dark/60 bg-red-50 p-3 rounded-xl border border-red-100">
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </div>
      ),
      onConfirm: async () => {
        setSyncing(true);
        try {
          const nowStr = new Date().toISOString();
          
          await db.transaction('rw', db.vocabulary, db.learning_history, db.learning_sessions, async () => {
             const allVocab = await db.vocabulary.toArray();
             const resetVocab = allVocab.map(v => ({
               ...v,
               box_level: '1',
               times_correct: 0,
               times_incorrect: 0,
               naechste_faelligkeit: nowStr,
               last_seen: nowStr,
               resetAt: nowStr,
               updatedAt: nowStr
             }));
             await db.vocabulary.bulkPut(resetVocab);
             await db.learning_history.clear();
             await db.learning_sessions.clear();
          });

          const snapshot = {
            vocab_progress: {},
            settings: {},
            history: [],
            sessions: [],
            version: 1,
            lastActivity: nowStr,
            globalResetAt: nowStr,
            updatedAt: nowStr
          };

          const snapshotRef = ref(storage, `users/${user.uid}/progress_snapshot.json`);
          const metaRef = ref(storage, `users/${user.uid}/snapshot_meta.json`);

          await Promise.all([
            uploadString(snapshotRef, JSON.stringify(snapshot)),
            uploadString(metaRef, JSON.stringify({ 
              lastActivity: nowStr, 
              isReset: true,
              globalResetAt: nowStr 
            }))
          ]);

          setLastSyncTime(null);
          localStorage.setItem('maylang_last_global_reset', nowStr);
          localStorage.removeItem('maylang_last_sync_time');
          setStatus('Alle Cloud-Daten und lokaler Stand wurden erfolgreich zurückgesetzt.');
          setTimeout(() => setStatus(''), 5000);
          logout();
        } catch (err) {
          console.error('Delete/Reset failed:', err);
          setStatus('Fehler beim Zurücksetzen der Daten.');
          setTimeout(() => setStatus(''), 5000);
        } finally {
          setSyncing(false);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  async function uploadSnapshot(userId: string) {
    if (!userId) return;
    setSyncing(true);
    try {
      const nowStr = new Date().toISOString();
      console.log('📤 Preparing Differential Upload...');

      // 1. Fetch only items with learning progress (Box > 1 or stats)
      const learnedItems = await db.vocabulary
        .filter(v => (v.box_level && v.box_level !== '1') || (v.times_correct || 0) > 0 || (v.times_incorrect || 0) > 0 || !!v.resetAt)
        .toArray();

      const [settings, history, sessions] = await Promise.all([
        db.user_settings.toArray(),
        db.learning_history.orderBy('timestamp').toArray(),
        db.learning_sessions.orderBy('start_time').toArray()
      ]);

      const vocabProgress: Record<string, any> = {};
      const downloadedChapters = new Set<string>();

      // Build chapter map for metadata
      const chapterTitleMap = new Map<string, string>();
      Object.entries(CHAPTERS).forEach(([bookId, chs]) => {
        const book = COURSE_BOOKS.find(b => b.id === bookId);
        if (book) {
          const bTitle = (book.title || '').trim().toLowerCase();
          chs.forEach(ch => {
            const cTitle = (ch.title || '').trim().toLowerCase();
            chapterTitleMap.set(`${bTitle}|${cTitle}`, ch.id);
          });
        }
      });

      learnedItems.forEach(v => {
        if (v.source_name && v.source_group) {
          const key = `${v.source_name.trim().toLowerCase()}|${v.source_group.trim().toLowerCase()}`;
          const chId = chapterTitleMap.get(key);
          if (chId) downloadedChapters.add(chId);
        }

        if (v.cloudId) {
          vocabProgress[v.cloudId] = {
            box_level: v.box_level || '1',
            times_correct: v.times_correct || 0,
            times_incorrect: v.times_incorrect || 0,
            naechste_faelligkeit: v.naechste_faelligkeit || nowStr,
            updatedAt: v.updatedAt || nowStr,
            resetAt: v.resetAt || null
          };
        }
      });

      const snapshot = {
        vocab_progress: vocabProgress,
        settings: Object.fromEntries(settings.map(s => [s.key, s.value])),
        downloaded_chapters: Array.from(downloadedChapters),
        history: history.map(({ id, vocab_id, ...h }) => {
          const v = learnedItems.find(item => item.id === vocab_id);
          return { ...h, vocab_cloud_id: v?.cloudId || null };
        }),
        sessions: sessions.map(({ id, ...s }) => s),
        lastActivity: nowStr,
        itemCount: Object.keys(vocabProgress).length
      };

      console.log(`📤 Uploading Safe File: ${Object.keys(vocabProgress).length} items with progress.`);

      const snapshotRef = ref(storage, `users/${userId}/progress_snapshot.json`);
      const metaRef = ref(storage, `users/${userId}/snapshot_meta.json`);

      await Promise.all([
        uploadString(snapshotRef, JSON.stringify(snapshot)),
        uploadString(metaRef, JSON.stringify({ 
          lastActivity: nowStr, 
          deviceId: navigator.userAgent,
          itemCount: Object.keys(vocabProgress).length
        }))
      ]);

      setLastSyncTime(nowStr);
      localStorage.setItem('maylang_last_sync_time', nowStr);
      console.log('✅ Upload successful.');

    } catch (err) {
      console.error('❌ Upload failed:', err);
    } finally {
      setSyncing(false);
    }
  }

  const performInitialSync = async (userId: string, force: boolean = false) => {
    if (!userId) return;
    
    setSyncing(true);
    try {
      const metaRef = ref(storage, `users/${userId}/snapshot_meta.json`);
      const snapshotRef = ref(storage, `users/${userId}/progress_snapshot.json`);

      console.log('🔍 Checking Cloud Status...');
      const metaBytes = await getBytes(metaRef).catch(() => null);
      
      if (!metaBytes) {
        console.log('ℹ️ No cloud profile found, uploading local state...');
        await uploadSnapshot(userId);
        return;
      }

      const cloudMeta = JSON.parse(new TextDecoder().decode(metaBytes));
      const cloudLastActivity = cloudMeta.lastActivity;

      console.log('📥 Downloading Cloud Safe File...');
      const snapshotBytes = await getBytes(snapshotRef);
      const cloudSnapshot = JSON.parse(new TextDecoder().decode(snapshotBytes));

      // 1. Chapters Auto-Restore (Only if local is empty)
      const localCount = await db.vocabulary.count();
      if (localCount < 100 && cloudSnapshot.downloaded_chapters?.length > 0) {
        console.log('📥 Restoring chapters for new device...');
        for (const chId of cloudSnapshot.downloaded_chapters) {
          for (const bookChapters of Object.values(CHAPTERS)) {
            const ch = bookChapters.find(c => c.id === chId);
            if (ch) await downloadAndImportChapter(ch).catch(e => console.error(e));
          }
        }
      }

      // 2. Merge Settings
      if (cloudSnapshot.settings) {
        console.log('⚙️ Syncing settings...');
        await db.transaction('rw', db.user_settings, async () => {
          for (const [key, value] of Object.entries(cloudSnapshot.settings)) {
            await db.user_settings.put({ key, value: value as any });
          }
        });
      }

      // 3. Perform Additive/Max Merge on Progress
      const cloudProgress = cloudSnapshot.vocab_progress || {};
      const cloudIds = Object.keys(cloudProgress);
      
      if (cloudIds.length > 0) {
        await db.transaction('rw', db.vocabulary, db.learning_sessions, db.learning_history, async () => {
          const matchingItems = await db.vocabulary.where('cloudId').anyOf(cloudIds).toArray();
          const toPut: any[] = [];
          const localIdMap = new Map<string, number>(); // cloudId -> localId
          
          const getBoxWeight = (bl: string) => {
             if (bl === 'Archiv') return 6;
             return parseInt(bl) || 1;
          };

          matchingItems.forEach(lv => {
            localIdMap.set(lv.cloudId!, lv.id!);
            const rv = cloudProgress[lv.cloudId!];
            
            const localWeight = getBoxWeight(lv.box_level || '1');
            const remoteWeight = getBoxWeight(rv.box_level || '1');
            
            toPut.push({
              ...lv,
              box_level: localWeight >= remoteWeight ? lv.box_level : rv.box_level,
              times_correct: (lv.times_correct || 0) + (rv.times_correct || 0),
              times_incorrect: (lv.times_incorrect || 0) + (rv.times_incorrect || 0),
              naechste_faelligkeit: (lv.naechste_faelligkeit > rv.naechste_faelligkeit) ? lv.naechste_faelligkeit : rv.naechste_faelligkeit,
              last_seen: (lv.last_seen && rv.last_seen) 
                ? (lv.last_seen > rv.last_seen ? lv.last_seen : rv.last_seen)
                : (lv.last_seen || rv.last_seen),
              updatedAt: new Date().toISOString()
            });
          });
          
          if (toPut.length > 0) {
            await db.vocabulary.bulkPut(toPut);
            console.log(`✅ Merged progress for ${toPut.length} items.`);
          }

          // 4. Merge Sessions & History
          if (cloudSnapshot.sessions || cloudSnapshot.history) {
             console.log('📜 Syncing activities...');
             if (cloudSnapshot.sessions) {
                const existingSessions = new Set((await db.learning_sessions.toArray()).map(s => s.start_time));
                const sessionsToUpdate = cloudSnapshot.sessions.filter((s: any) => !existingSessions.has(s.start_time));
                if (sessionsToUpdate.length > 0) {
                   await db.learning_sessions.bulkAdd(sessionsToUpdate);
                }
             }
             if (cloudSnapshot.history) {
                const existingHistory = new Set((await db.learning_history.toArray()).map(h => h.timestamp));
                const historyToUpdate = [];
                for (const h of cloudSnapshot.history) {
                   if (!existingHistory.has(h.timestamp) && h.vocab_cloud_id) {
                      const localId = localIdMap.get(h.vocab_cloud_id);
                      if (localId) {
                         historyToUpdate.push({
                            ...h,
                            vocab_id: localId
                         });
                      }
                   }
                }
                if (historyToUpdate.length > 0) {
                   await db.learning_history.bulkAdd(historyToUpdate);
                }
             }
          }
        });
      }

      localStorage.setItem('maylang_last_sync_time', cloudLastActivity);
      setLastSyncTime(cloudLastActivity);
      console.log('✅ Sync completed.');

    } catch (err) {
      console.error('❌ Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinLoadingTimePassed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Sanitize existing sessions with inflated durations (one-time check)
  useEffect(() => {
    const sanitizeSessions = async () => {
      const allSessions = await db.learning_sessions.toArray();
      const updates = allSessions.filter(s => {
        if (!s.start_time || !s.end_time) return false;
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        
        // Aggressive sanitization:
        // 1. If session is longer than 4 hours and doesn't have duration_seconds set
        // 2. If session is longer than 30 minutes but has very few words (stale session)
        // 3. If the ratio of minutes to words is suspiciously high (e.g. > 10 mins per word)
        const vocabCount = s.vocab_count || 0;
        const isStale = diffMinutes > 30 && vocabCount < 5;
        const isInflated = diffMinutes > 240 && !s.duration_seconds;
        const isSuspicious = diffMinutes > 30 && vocabCount > 0 && (diffMinutes / vocabCount) > 10;
        
        return isInflated || isStale || isSuspicious;
      }).map(s => {
        // Estimate duration based on vocab_count (e.g. 1 minute per 5 words, min 1 min, max 30 mins)
        const estimatedMinutes = Math.max(1, Math.min(30, (s.vocab_count || 0) * 0.5));
        return {
          ...s,
          duration_seconds: estimatedMinutes * 60
        };
      });

      if (updates.length > 0) {
        console.log(`Sanitizing ${updates.length} inflated sessions.`);
        await db.learning_sessions.bulkPut(updates);
      }
    };
    sanitizeSessions();
  }, []);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    type?: 'default' | 'danger';
    confirmText?: string;
    children?: React.ReactNode;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [pendingView, setPendingView] = useState<'dashboard' | 'learn' | 'settings' | 'calculator' | 'themes' | 'sync' | null>(null);

  const [view, setView] = useState<'dashboard' | 'learn' | 'settings' | 'calculator' | 'themes' | 'sync'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('currentSessionId');
      return saved ? parseInt(saved) : null;
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentSessionId) {
        localStorage.setItem('currentSessionId', currentSessionId.toString());
      } else {
        localStorage.removeItem('currentSessionId');
      }
    } catch (e) {
      // Ignore storage errors in private mode
    }
  }, [currentSessionId]);
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [selectedSource, setSelectedSource] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [selectedLevel, setSelectedLevel] = useState<string[]>([]);
  const [selectedBox, setSelectedBox] = useState<string | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [gsUrl, setGsUrl] = useState('');
  const [gsGroup, setGsGroup] = useState('');

  const processData = async (data: any[], sourceName: string, sourceGroup?: string) => {
    const items = data.map((row: any, index: number) => {
      const cloudId = getDeterministicVocabId(row, sourceName, sourceGroup);
      
      return {
        cloudId,
        wortart: row.Wortart || 'Sonstige',
        grundform: row.Grundform || '',
        englisch: row.Englisch || '',
        beispielsatz: row.Beispielsatz || '',
        level: row.Level || '',
        v_hilfsverb: row.V_Hilfsverb || '',
        v_partizip_ii: row.V_Partizip_II || '',
        v_praesens_ich: row.V_Praesens_ich || '',
        v_praesens_du: row.V_Praesens_du || '',
        v_praesens_er: row.V_Praesens_er || '',
        v_praesens_wir: row.V_Praesens_wir || '',
        v_praesens_ihr: row.V_Praesens_ihr || '',
        v_praesens_sie: row.V_Praesens_sie || '',
        v_praet_ich: row.V_Praet_ich || '',
        v_praet_du: row.V_Praet_du || '',
        v_praet_er: row.V_Praet_er || '',
        v_praet_wir: row.V_Praet_wir || '',
        v_praet_ihr: row.V_Praet_ihr || '',
        v_praet_sie: row.V_Praet_sie || '',
        v_imperativ_du: row.V_Imperativ_du || '',
        v_imperativ_ihr: row.V_Imperativ_ihr || '',
        v_imperativ_sie: row.V_Imperativ_Sie || '',
        n_artikel: row.N_Artikel || '',
        n_nom_sg: row.N_Nom_Sg || '',
        n_nom_pl: row.N_Nom_Pl || '',
        adj_komparativ: row.Adj_Komparativ || '',
        adj_superlativ: row.Adj_Superlativ || '',
        box_level: '1',
        naechste_faelligkeit: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fehlerquote: 0,
        source_name: sourceName,
        source_group: sourceGroup,
        is_hidden: false
      };
    });
    await db.vocabulary.bulkAdd(items);
    setStatus(`${data.length} Vokabeln aus "${sourceName}" erfolgreich importiert.`);
  };

  const handleImportFromGoogleSheets = async () => {
    if (!gsUrl) return;
    setIsImporting(true);
    setStatus('Lade Daten von Google Sheets...');
    try {
      const match = gsUrl.match(/[-\w]{25,}/);
      if (!match) throw new Error('Ungültige Google Sheets URL');
      const id = match[0];
      
      // Try to get document title from XLSX export which often contains it in metadata
      const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
      
      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error('Fehler beim Abrufen der Daten. Ist das Sheet öffentlich freigegeben?');
      
      const arrayBuffer = await response.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      
      let docTitle = `Google Sheets (${id.substring(0, 8)}...)`;
      if (wb.Props && wb.Props.Title) {
        docTitle = wb.Props.Title;
      } else if (wb.SheetNames && wb.SheetNames.length > 0) {
        docTitle = wb.SheetNames[0];
      }

      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      
      await processData(data, docTitle, gsGroup);
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : 'Fehler beim Importieren.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    const wb = XLSX.utils.book_new();
    const headers = [
      "Wortart", "Grundform", "Englisch", "Beispielsatz", "Level", 
      "V_Hilfsverb", "V_Partizip_II", "V_Praesens_ich", "V_Praesens_du", "V_Praesens_er", 
      "V_Praesens_wir", "V_Praesens_ihr", "V_Praesens_sie", "V_Praet_ich", "V_Praet_du", 
      "V_Praet_er", "V_Praet_wir", "V_Praet_ihr", "V_Praet_sie", "V_Imperativ_du", 
      "V_Imperativ_ihr", "V_Imperativ_Sie", "N_Artikel", "N_Nom_Sg", "N_Nom_Pl", 
      "Adj_Komparativ", "Adj_Superlativ"
    ];
    const vocabData = [
      headers,
      ["Nomen", "Apfel", "Apple", "Ich esse einen Apfel.", "A1", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "der", "Apfel", "Äpfel", "", ""],
      ["Verb", "essen", "to eat", "Wir essen Brot.", "A1", "haben", "gegessen", "esse", "isst", "isst", "essen", "esst", "essen", "aß", "aßt", "aß", "aßen", "aßt", "aßen", "iss", "esst", "essen Sie", "", "", "", "", ""],
      ["Adjektiv", "schön", "beautiful", "Das Haus ist schön.", "A1", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "schöner", "am schönsten"],
      ["Sonstige", "und", "and", "Du und ich.", "A1", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ];
    const wsVocab = XLSX.utils.aoa_to_sheet(vocabData);
    XLSX.utils.book_append_sheet(wb, wsVocab, "Vokabeln");

    if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      const fileName = `Maylang_Vokabel_Vorlage.${format}`;
      const filePath = await ipcRenderer.invoke('save-dialog', {
        title: 'Vorlage speichern',
        defaultPath: fileName,
        filters: [{ name: format === 'xlsx' ? 'Excel' : 'CSV', extensions: [format] }]
      });

      if (filePath) {
        const data = format === 'xlsx' 
          ? Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
          : XLSX.utils.sheet_to_csv(wsVocab);
        
        const result = await ipcRenderer.invoke('write-file', { 
          filePath, 
          data, 
          encoding: format === 'xlsx' ? 'binary' : 'utf8' 
        });
        
        if (result.success) {
          setStatus('Vorlage erfolgreich gespeichert unter: ' + filePath);
        } else {
          setStatus('Fehler beim Speichern: ' + result.error);
        }
      }
    } else {
      if (format === 'xlsx') {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Maylang_Vokabel_Vorlage.xlsx");
      } else {
        const csv = XLSX.utils.sheet_to_csv(wsVocab);
        saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "Maylang_Vokabel_Vorlage.csv");
      }
      setStatus('Vorlage heruntergeladen.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets["Vokabeln"] || wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        await processData(data, file.name, gsGroup);
      } catch (err) {
        console.error(err);
        setStatus('Fehler beim Einlesen der Datei.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportData = async () => {
    const vocab = await db.vocabulary.toArray();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vocab), "Vokabeln");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      const filePath = await ipcRenderer.invoke('save-dialog', {
        title: 'Vokabeln exportieren',
        defaultPath: 'Maylang_Vokabel_Export.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });

      if (filePath) {
        const result = await ipcRenderer.invoke('write-file', { 
          filePath, 
          data: Buffer.from(wbout), 
          encoding: 'binary' 
        });
        if (result.success) {
          setStatus('Vokabeln erfolgreich exportiert nach: ' + filePath);
        } else {
          setStatus('Fehler beim Exportieren: ' + result.error);
        }
      }
    } else {
      saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Maylang_Vokabel_Export.xlsx");
      setStatus('Vokabeln erfolgreich exportiert.');
    }
  };

  const allVocab = useLiveQuery(() => db.vocabulary.toArray());
  const [isDownloadingCourseBook, setIsDownloadingCourseBook] = useState<string | null>(null);

  const downloadAndImportChapter = async (chapter: Chapter) => {
    setIsDownloadingCourseBook(chapter.id);
    try {
      const bookTitle = COURSE_BOOKS.find(b => b.id === chapter.bookId)?.title || chapter.bookId;
      
      // Use integrated course books data
      const { default: courseData } = await import('./data/course-books.json');
      
      // Filter items for this specific book and chapter
      const jsonData = courseData.filter((item: any) => 
        item.source_name === bookTitle && 
        item.source_group === chapter.title
      );

      if (jsonData.length === 0) {
        throw new Error('Keine integrierten Daten für dieses Kapitel gefunden.');
      }

      const items: Vocabulary[] = jsonData.map((row: any) => {
        return {
          cloudId: row.cloudId,
          wortart: row.Wortart || 'Sonstige',
          grundform: row.Grundform || '',
          englisch: row.Englisch || '',
          beispielsatz: row.Beispielsatz || '',
          level: row.Level || chapter.bookId.split('-')[1].toUpperCase(),
          v_hilfsverb: row.V_Hilfsverb || '',
          v_partizip_ii: row.V_Partizip_II || '',
          v_praesens_ich: row.V_Praesens_Ich || '',
          v_praesens_du: row.V_Praesens_Du || '',
          v_praesens_er: row.V_Praesens_Er || '',
          v_praesens_wir: row.V_Praesens_wir || '',
          v_praesens_ihr: row.V_Praesens_ihr || '',
          v_praesens_sie: row.V_Praesens_sie || '',
          v_praet_ich: row.V_Praet_Ich || '',
          v_praet_du: row.V_Praet_Du || '',
          v_praet_er: row.V_Praet_Er || '',
          v_praet_wir: row.V_Praet_wir || '',
          v_praet_ihr: row.V_Praet_ihr || '',
          v_praet_sie: row.V_Praet_sie || '',
          v_imperativ_du: row.V_Imperativ_Du || '',
          n_artikel: row.N_Artikel || '',
          n_nom_sg: row.N_Nom_Sg || '',
          n_nom_pl: row.N_Nom_Pl || '',
          adj_komparativ: row.Adj_Komparativ || '',
          adj_superlativ: row.Adj_Superlativ || '',
          box_level: '1',
          naechste_faelligkeit: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fehlerquote: 0,
          source_name: bookTitle,
          source_group: chapter.title,
          is_hidden: false
        };
      });

      await db.vocabulary.bulkAdd(items);
      setIsDownloadingCourseBook(null);
    } catch (err) {
      console.error('Integration error:', err);
      setIsDownloadingCourseBook(null);
      throw err;
    }
  };

  const importCourseBookChapter = async (chapter: Chapter) => {
    try {
      await downloadAndImportChapter(chapter);
    } catch (err) {
      console.error('Download error:', err);
    }
  };
  const vocab = useMemo(() => (allVocab || []).filter(v => !v.is_hidden), [allVocab]);
  const history = useLiveQuery(() => db.learning_history.toArray());
  const sessions = useLiveQuery(() => db.learning_sessions.toArray());
  const settings = useLiveQuery(() => db.user_settings.toArray());
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

  const language = (settings?.find(s => s.key === 'ui_language')?.value || 'de') as Language;
  const t = (key: keyof typeof translations['de']) => {
    return translations[language]?.[key] || translations['de'][key] || key;
  };

  useEffect(() => {
    if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      
      const handleTriggerExport = () => {
        handleExportData();
      };
      
      const handleTriggerImport = () => {
        handleNativeImport();
      };

      ipcRenderer.on('trigger-export', handleTriggerExport);
      ipcRenderer.on('trigger-import', handleTriggerImport);

      return () => {
        ipcRenderer.removeListener('trigger-export', handleTriggerExport);
        ipcRenderer.removeListener('trigger-import', handleTriggerImport);
      };
    }
  }, [isElectron]);

  const handleNativeImport = async () => {
    if (!isElectron) return;
    const { ipcRenderer } = (window as any).require('electron');
    
    const filePaths = await ipcRenderer.invoke('open-dialog', {
      title: 'Vokabeln importieren',
      filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
      const filePath = filePaths[0];
      const result = await ipcRenderer.invoke('read-file', { filePath, encoding: 'binary' });
      
      if (result.success) {
        try {
          const wb = XLSX.read(result.data, { type: 'binary' });
          const ws = wb.Sheets["Vokabeln"] || wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          const fileName = filePath.split(/[\\/]/).pop();
          await processData(data, fileName || 'Import');
        } catch (err) {
          console.error(err);
          setStatus('Fehler beim Einlesen der Datei.');
        }
      } else {
        setStatus('Fehler beim Lesen der Datei: ' + result.error);
      }
    }
  };

  const loadVerbenMitPraeposition = async () => {
    setIsImporting(true);
    setStatus('Lade Verben mit Präposition...');
    
    try {
      // Use dynamic import for bundling efficiency
      const { default: data } = await import('./data/verben.json');

      const items = data.map((row: any) => {
        return {
          cloudId: row.cloudId,
          wortart: row.Wortart || 'Verb',
          grundform: row.Grundform || '',
          englisch: row.Englisch || '',
          beispielsatz: row.Beispielsatz || '',
          level: row.Level || '',
          v_hilfsverb: row.V_Hilfsverb || '',
          v_partizip_ii: row.V_Partizip_II || '',
          v_praesens_ich: row.V_Praesens_ich || '',
          v_praesens_du: row.V_Praesens_du || '',
          v_praesens_er: row.V_Praesens_er || '',
          v_praesens_wir: row.V_Praesens_wir || '',
          v_praesens_ihr: row.V_Praesens_ihr || '',
          v_praesens_sie: row.V_Praesens_sie || '',
          v_praet_ich: row.V_Praet_ich || '',
          v_praet_du: row.V_Praet_du || '',
          v_praet_er: row.V_Praet_er || '',
          v_praet_wir: row.V_Praet_wir || '',
          v_praet_ihr: row.V_Praet_ihr || '',
          v_praet_sie: row.V_Praet_sie || '',
          v_imperativ_du: row.V_Imperativ_du || '',
          v_imperativ_ihr: row.V_Imperativ_ihr || '',
          v_imperativ_sie: row.V_Imperativ_Sie || '',
          n_artikel: row.N_Artikel || '',
          n_nom_sg: row.N_Nom_Sg || '',
          n_nom_pl: row.N_Nom_Pl || '',
          adj_komparativ: row.Adj_Komparativ || '',
          adj_superlativ: row.Adj_Superlativ || '',
          box_level: '1',
          naechste_faelligkeit: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fehlerquote: 0,
          source_name: 'Verben mit Präposition',
          is_hidden: false
        };
      });
      
      await db.vocabulary.bulkAdd(items);
      await db.user_settings.put({ key: 'special_vocab_auto_loaded', value: true });
      setStatus(`${items.length} Verben mit Präposition erfolgreich installiert.`);
      setTimeout(() => setStatus(''), 5000);
    } catch (err) {
      console.error(err);
      setStatus(`Fehler beim Laden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const loadBaseVocabulary = async () => {
    setIsImporting(true);
    setStatus('Lade Basisvokabular und bereinige alte Listen...');
    
    try {
      // Extensive cleanup of legacy "Basic" or older "Maylang" variants
      const legacyVocab = await db.vocabulary
        .filter(v => {
          const name = (v.source_name || '').toLowerCase();
          const group = (v.source_group || '').toLowerCase();
          return name.includes('maylang') || name.includes('basic') || 
                 group.includes('maylang') || group.includes('basic');
        })
        .toArray();
      
      if (legacyVocab.length > 0) {
        await db.vocabulary.bulkDelete(legacyVocab.map(v => v.id!).filter(id => id !== undefined));
        console.log(`Cleared ${legacyVocab.length} legacy entries.`);
      }

      // Use dynamic import for bundling efficiency
      const { default: data } = await import('./data/maylang.json');
      
      const items = data.map((row: any) => {
        return {
          cloudId: row.cloudId,
          wortart: row.Wortart || 'Sonstige',
          grundform: row.Grundform || '',
          englisch: row.Englisch || '',
          beispielsatz: row.Beispielsatz || '',
          level: row.Level || '',
          v_hilfsverb: row.V_Hilfsverb || '',
          v_partizip_ii: row.V_Partizip_II || '',
          v_praesens_ich: row.V_Praesens_ich || '',
          v_praesens_du: row.V_Praesens_du || '',
          v_praesens_er: row.V_Praesens_er || '',
          v_praesens_wir: row.V_Praesens_wir || '',
          v_praesens_ihr: row.V_Praesens_ihr || '',
          v_praesens_sie: row.V_Praesens_sie || '',
          v_praet_ich: row.V_Praet_ich || '',
          v_praet_du: row.V_Praet_du || '',
          v_praet_er: row.V_Praet_er || '',
          v_praet_wir: row.V_Praet_wir || '',
          v_praet_ihr: row.V_Praet_ihr || '',
          v_praet_sie: row.V_Praet_sie || '',
          v_imperativ_du: row.V_Imperativ_du || '',
          v_imperativ_ihr: row.V_Imperativ_ihr || '',
          v_imperativ_sie: row.V_Imperativ_Sie || '',
          n_artikel: row.N_Artikel || '',
          n_nom_sg: row.N_Nom_Sg || '',
          n_nom_pl: row.N_Nom_Pl || '',
          adj_komparativ: row.Adj_Komparativ || '',
          adj_superlativ: row.Adj_Superlativ || '',
          box_level: '1',
          naechste_faelligkeit: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fehlerquote: 0,
          source_name: 'Maylang',
          is_hidden: false
        };
      });
      
      await db.vocabulary.bulkAdd(items);
      const importedCount = items.length;
      
      await db.user_settings.put({ key: 'base_vocab_auto_loaded', value: true });
      setStatus(`${importedCount} Maylang Vokabeln (A1-B2) erfolgreich installiert.`);
      setTimeout(() => setStatus(''), 5000);
    } catch (err) {
      console.error(err);
      setStatus(`Fehler beim Laden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsImporting(false);
    }
  };

  const isAutoLoading = useRef(false);
  useEffect(() => {
    const autoLoad = async () => {
      if (!allVocab || !settings || isAutoLoading.current) return;
      
      const baseAutoLoaded = settings.find((s: any) => s.key === 'base_vocab_auto_loaded')?.value;
      const hasBase = allVocab.some(v => (v.source_name || '').toLowerCase().includes('maylang') || !v.source_name);
      
      const specialAutoLoaded = settings.find((s: any) => s.key === 'special_vocab_auto_loaded')?.value;
      const hasSpecial = allVocab.some(v => v.source_name === 'Verben mit Präposition');

      if ((!baseAutoLoaded && !hasBase) || (!specialAutoLoaded && !hasSpecial)) {
        isAutoLoading.current = true;
        try {
          if (!baseAutoLoaded && !hasBase) {
            await loadBaseVocabulary();
          }
          if (!specialAutoLoaded && !hasSpecial) {
            await loadVerbenMitPraeposition();
          }
        } finally {
          isAutoLoading.current = false;
        }
      }
    };
    
    autoLoad();
  }, [allVocab, settings]);

  const isAppReady = allVocab !== undefined && history !== undefined && sessions !== undefined && settings !== undefined && minLoadingTimePassed && syncInitialized;

  // Migration: Ensure all vocabulary has updatedAt and cloudId
  useEffect(() => {
    const migrateCloudIds = async () => {
      try {
        const now = new Date().toISOString();
        const generateSafeUUID = () => {
          try {
            return crypto.randomUUID();
          } catch (e) {
            return Math.random().toString(36).substring(2) + Date.now().toString(36);
          }
        };
        
        // 1. Migrate Vocabulary
        const allVocabRecords = await db.vocabulary.toArray();
        const vocabUpdates = allVocabRecords.filter(v => 
          !v.updatedAt || 
          !v.cloudId || 
          (v.source_name && v.source_name.toLowerCase().includes('maylang') && !v.cloudId.startsWith('maylang_'))
        ).map(v => {
          const isMaylang = v.source_name && v.source_name.toLowerCase().includes('maylang');
          const stableSourceName = isMaylang ? 'Maylang' : (v.source_name || 'manual');
          return {
            ...v,
            updatedAt: v.updatedAt || now,
            cloudId: getDeterministicVocabId(v, stableSourceName, v.source_group)
          };
        });
        
        if (vocabUpdates.length > 0) {
          console.log(`Migrating ${vocabUpdates.length} vocabulary records to stable cloudIds`);
          await db.vocabulary.bulkPut(vocabUpdates);
        }

        // 2. Migrate History
        const allHistory = await db.learning_history.toArray();
        const historyUpdates = allHistory.filter(h => !h.cloudId).map(h => ({
          ...h,
          cloudId: generateSafeUUID()
        }));
        if (historyUpdates.length > 0) {
          console.log(`Migrating ${historyUpdates.length} history records`);
          await db.learning_history.bulkPut(historyUpdates);
        }

        // 3. Migrate Sessions
        const allSessions = await db.learning_sessions.toArray();
        const sessionsUpdates = allSessions.filter(s => !s.cloudId).map(s => ({
          ...s,
          cloudId: generateSafeUUID()
        }));
        if (sessionsUpdates.length > 0) {
          console.log(`Migrating ${sessionsUpdates.length} session records`);
          await db.learning_sessions.bulkPut(sessionsUpdates);
        }
      } catch (err) {
        console.error('Migration failed:', err);
      }
    };
    migrateCloudIds();
  }, []);

  // Periodic background sync and on-focus sync
  useEffect(() => {
    if (!user || !syncInitialized) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab focus regained, triggering sync...');
        performInitialSync(user.uid);
      }
    };

    const interval = setInterval(() => {
      console.log('Background periodic sync checking...');
      performInitialSync(user.uid);
    }, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, syncInitialized]);

  const TABS = useMemo(() => [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'learn', icon: BookOpen, label: t('learn') },
    { id: 'calculator', icon: BarChart3, label: t('vocab_calculator') },
    { id: 'settings', icon: Settings, label: t('settings') },
    { id: 'sync', icon: RefreshCw, label: 'Konto-Sync' },
  ], [t]);

  if (!allVocab || !history || !sessions || !settings) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 animate-pulse">
            <Logo className="w-full h-full" />
          </div>
          <span className="text-brand font-bold animate-pulse">Lade Daten...</span>
        </div>
      </div>
    );
  }

  const handleUpdateVocab = async (v: Vocabulary, correct: boolean, isNew: boolean, points: number, relatedIds: number[] = []) => {
    const nowStr = new Date().toISOString();
    v.times_correct = (v.times_correct || 0) + (correct ? 1 : 0);
    v.times_incorrect = (v.times_incorrect || 0) + (correct ? 0 : 1);
    v.last_seen = nowStr;
    v.updatedAt = nowStr;

    await db.transaction('rw', db.vocabulary, db.learning_history, db.learning_sessions, async () => {
      await db.vocabulary.put(v);
      
      // Update related duplicates if any
      if (relatedIds.length > 0) {
        for (const id of relatedIds) {
          await db.vocabulary.update(id, {
            box_level: v.box_level,
            naechste_faelligkeit: v.naechste_faelligkeit,
            fehlerquote: v.fehlerquote,
            last_direction: v.last_direction,
            times_correct: v.times_correct,
            times_incorrect: v.times_incorrect,
            last_seen: v.last_seen,
            updatedAt: v.updatedAt
          });
        }
      }

      const historyCloudId = crypto.randomUUID();
      await db.learning_history.add({
        cloudId: historyCloudId,
        vocab_id: v.id!,
        timestamp: new Date().toISOString(),
        correct: correct ? 1 : 0,
        session_id: currentSessionId || undefined
      });
      
      if (currentSessionId) {
        const session = await db.learning_sessions.get(currentSessionId);
        if (session) {
          const now = new Date();
          const lastActivity = session.last_activity_time ? new Date(session.last_activity_time) : null;
          
          let additionalSeconds = 10;
          if (lastActivity) {
            const diff = Math.round((now.getTime() - lastActivity.getTime()) / 1000);
            additionalSeconds = Math.min(diff, 300); 
          }
          
          const updatedSession = {
            vocab_count: (session.vocab_count || 0) + points,
            correct_count: (session.correct_count || 0) + (correct ? points : 0),
            new_vocab_count: (session.new_vocab_count || 0) + (isNew ? points : 0),
            duration_seconds: (session.duration_seconds || 0) + additionalSeconds,
            last_activity_time: now.toISOString(),
            end_time: now.toISOString()
          };
          await db.learning_sessions.update(currentSessionId, updatedSession);
        }
      }

      // Instead of immediate cloud sync for vocabulary progress, we buffer the cloudId
      if (user && v.cloudId) {
        setSessionDirtyCids(prev => {
          const next = new Set(prev);
          next.add(v.cloudId!);
          if (relatedIds.length > 0) {
            // We'll fetch related ones from DB later during batch sync to be safe
          }
          return next;
        });
      }
    });
  };

  const handleUndoVocab = async (prevVocab: Vocabulary, wasCorrect: boolean, wasNew: boolean, points: number) => {
    await db.transaction('rw', db.vocabulary, db.learning_history, db.learning_sessions, async () => {
      await db.vocabulary.put(prevVocab);
      
      // Also undo related duplicates
      const key = getVocabKey(prevVocab);
      const duplicates = await db.vocabulary
        .where('grundform').equalsIgnoreCase(prevVocab.grundform)
        .and(v => v.wortart === prevVocab.wortart && v.id !== prevVocab.id)
        .toArray();
      
      for (const d of duplicates) {
        if (getVocabKey(d) === key) {
          await db.vocabulary.update(d.id!, {
            box_level: prevVocab.box_level,
            naechste_faelligkeit: prevVocab.naechste_faelligkeit,
            fehlerquote: prevVocab.fehlerquote,
            last_direction: prevVocab.last_direction
          });
        }
      }
      
      // Find the last history entry for this vocab in this session
      const lastHistory = await db.learning_history
        .where('vocab_id').equals(prevVocab.id!)
        .and(h => h.session_id === (currentSessionId || 0))
        .last();
      
      if (lastHistory) {
        await db.learning_history.delete(lastHistory.id!);
      }
      
      if (currentSessionId) {
        const session = await db.learning_sessions.get(currentSessionId);
        if (session) {
          await db.learning_sessions.update(currentSessionId, {
            vocab_count: Math.max(0, (session.vocab_count || 0) - points),
            correct_count: Math.max(0, (session.correct_count || 0) - (wasCorrect ? points : 0)),
            new_vocab_count: Math.max(0, (session.new_vocab_count || 0) - (wasNew ? points : 0))
          });
        }
      }
    });
  };

  const startSession = async () => {
    // Check for stale session (older than 4 hours)
    if (currentSessionId) {
      const session = await db.learning_sessions.get(currentSessionId);
      if (session) {
        const start = new Date(session.start_time);
        const hoursSinceStart = (Date.now() - start.getTime()) / (1000 * 60 * 60);
        if (hoursSinceStart > 4) {
          // It's stale, close it and start a new one
          await endSession();
        } else {
          return; // Still valid
        }
      }
    }

    const cloudId = crypto.randomUUID();
    const id = await db.learning_sessions.add({
      cloudId,
      start_time: new Date().toISOString(),
      vocab_count: 0,
      correct_count: 0,
      new_vocab_count: 0,
      duration_seconds: 0,
      last_activity_time: new Date().toISOString()
    });
    setCurrentSessionId(id as number);
  };

  const endSession = async () => {
    if (currentSessionId) {
      const session = await db.learning_sessions.get(currentSessionId);
      const now = new Date();
      if (session) {
        const start = new Date(session.start_time);
        const durationSeconds = Math.round((now.getTime() - start.getTime()) / 1000);
        
        await db.learning_sessions.update(currentSessionId, {
          end_time: now.toISOString(),
          duration_seconds: (session.duration_seconds !== undefined && session.duration_seconds !== null) ? session.duration_seconds : durationSeconds
        });
      }

      // Perform snapshot cloud sync after session
      if (user) {
        await uploadSnapshot(user.uid);
      }

      setCurrentSessionId(null);
      try {
        localStorage.removeItem('currentSessionId');
      } catch (e) {
        // Ignore storage errors
      }
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    await db.user_settings.put({ key, value });
  };

  const handleTabClick = (nextView: any) => {
    if (showPrivacy) setShowPrivacy(false);
    if (isSessionActive && nextView !== view) {
      setPendingView(nextView);
      setIsPauseModalOpen(true);
    } else {
      setView(nextView);
      if (nextView !== 'learn' && nextView !== 'themes') {
        setSelectedTag(undefined);
        setSelectedSource([]);
        setSelectedLevel([]);
      }
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (isSessionActive) return; // Prevent swipe during active session
    const currentIndex = TABS.findIndex(t => t.id === view);
    if (currentIndex === -1) return;

    if (direction === 'left' && currentIndex < TABS.length - 1) {
      handleTabClick(TABS[currentIndex + 1].id);
    } else if (direction === 'right' && currentIndex > 0) {
      handleTabClick(TABS[currentIndex - 1].id);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-nude overflow-hidden font-sans select-none">
      {showPrivacy ? (
        <PrivacyPolicy onBack={() => setShowPrivacy(false)} t={t} />
      ) : (
        <div className="min-h-screen md:h-screen flex flex-col md:flex-row relative overflow-hidden bg-white">
      <AnimatePresence>
        {!isAppReady && <LoadingScreen syncInitialized={syncInitialized} user={user} />}
      </AnimatePresence>

      <Modal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
        title="Session pausieren?"
        onConfirm={() => {
          if (pendingView) {
            setView(pendingView);
            setPendingView(null);
            // Session will be auto-ended by Learn's useEffect if needed
          }
          setIsPauseModalOpen(false);
        }}
        confirmText="Ja, pausieren"
        cancelText="Weiterlernen"
      >
        Möchtest du die aktuelle Lernsession pausieren und den Bereich wechseln? Dein Fortschritt in dieser Session bleibt erhalten, solange du das Fenster nicht schließt.
      </Modal>

      {modalConfig && (
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig(prev => prev ? { ...prev, isOpen: false } : null)}
          title={modalConfig.title}
          type={modalConfig.type}
          confirmText={modalConfig.confirmText}
          onConfirm={modalConfig.onConfirm}
        >
          {modalConfig.children}
        </Modal>
      )}

      {conflictData && (
        <Modal
          isOpen={!!conflictData}
          onClose={() => setConflictData(null)}
          title="Synchronisations-Konflikt"
          confirmText="Zusammenführen"
          onConfirm={() => conflictData.resolve('merge')}
        >
          <div className="space-y-4">
            <p className="text-sm text-brand-dark">
              Wir haben zwei verschiedene Lernstände gefunden.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-brand/5 rounded-xl border border-brand/10 space-y-1">
                <p className="text-[10px] font-black uppercase text-brand-dark/40">Lokal</p>
                <p className="text-xs font-bold text-brand-dark">Zuletzt: {conflictData.localTime !== 'Unbekannt' ? new Date(conflictData.localTime).toLocaleString() : 'Unbekannt'}</p>
                <button 
                  onClick={() => conflictData.resolve('local')}
                  className="w-full mt-2 py-1.5 bg-white border border-brand/20 text-brand-dark text-[10px] font-bold rounded-lg hover:bg-brand/5"
                >
                  Lokalen Stand behalten
                </button>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                <p className="text-[10px] font-black uppercase text-emerald-600/60">Cloud (Snapshot)</p>
                <p className="text-xs font-bold text-emerald-700">Zuletzt: {new Date(conflictData.cloudTime).toLocaleString()}</p>
                <button 
                  onClick={() => conflictData.resolve('cloud')}
                  className="w-full mt-2 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700"
                >
                  Cloud-Stand verwenden
                </button>
              </div>
            </div>
            <p className="text-[10px] text-brand-dark/40 italic">
              "Zusammenführen" kombiniert beide Stände: Die jeweils neuere Information gewinnt.
            </p>
          </div>
        </Modal>
      )}

      {/* Mobile Tab Bar */}
      <div className={`md:hidden sticky top-0 z-30 bg-nude-dark/95 backdrop-blur-md border-b border-brand/10 p-2 flex flex-col transition-opacity duration-500 ${isSessionActive ? 'pointer-events-auto' : ''}`}>
        <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-60">
          <div className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
          <span className="text-[8px] font-black uppercase tracking-widest text-brand-dark/50">
            {user ? 'Cloud-Sync Aktiv' : 'Lokaler Modus'}
          </span>
        </div>
        <div className="flex items-center justify-around">
          {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 relative ${
              view === tab.id 
                ? 'text-brand scale-110' 
                : 'text-brand-dark/40 scale-100 active:scale-95'
            } ${isSessionActive ? 'opacity-30' : 'opacity-100'}`}
          >
            <tab.icon size={18} className={tab.id === 'sync' && syncing ? 'animate-spin' : ''} strokeWidth={view === tab.id ? 2.5 : 2} />
            <span className={`text-[8px] font-bold uppercase tracking-widest ${view === tab.id ? 'opacity-100' : 'opacity-60'}`}>{tab.label}</span>
            {view === tab.id && (
              <motion.div 
                layoutId="mobileActiveTab"
                className="absolute -bottom-1 w-1 h-1 rounded-full bg-brand"
              />
            )}
          </button>
        ))}
        </div>
      </div>

      {/* Desktop Sidebar overlay for mobile (partially hidden) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop only or for extra options) */}
      <nav className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        fixed md:relative inset-y-0 left-0 w-64 bg-nude-dark border-r border-brand/10 p-6 hidden md:flex flex-col gap-8 z-40 transition-transform duration-300 ease-in-out
        md:flex-shrink-0 overflow-y-auto custom-scrollbar
      `}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex-shrink-0">
            <Logo className="w-full h-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight leading-none text-brand-dark">Maylang</span>
            <span className="text-[10px] font-bold text-brand-dark/60 uppercase tracking-[0.2em]">Vokabeltrainer</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 relative">
          <div className="flex items-center gap-2 px-4 py-1.5 mb-1">
            <div className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40">
              {user ? 'Cloud-Sync Aktiv' : 'Lokaler Modus'}
            </span>
          </div>
          {TABS.map(item => (
            <button 
              key={item.id}
              onClick={() => { 
                setView(item.id as any); 
                if (item.id !== 'learn' && item.id !== 'themes') {
                  setSelectedTag(undefined);
                  setSelectedSource([]);
                  setSelectedLevel(undefined);
                }
                setIsSidebarOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                view === item.id 
                  ? 'selected-effect-inner' 
                  : 'text-brand hover:bg-brand/10'
              }`}
            >
              <item.icon size={20} className={item.id === 'sync' && syncing ? 'animate-spin' : ''} strokeWidth={view === item.id ? 2.5 : 2} />
              <div className="flex flex-col items-start">
                <span className={`font-semibold ${view === item.id ? 'translate-x-1' : ''} transition-transform`}>{item.label}</span>
                {item.id === 'sync' && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-brand-dark/40 bg-brand/5 px-1.5 py-0.5 rounded">
                    NEU & OPTIONAL
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-8 flex flex-col items-center gap-3 border-t border-brand/5">
          {/* Temporärer Feedback Button für Beta */}
          <a 
            href="mailto:jeanmayrichter@gmail.com?subject=Maylang Beta Feedback"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand/20 mb-2"
          >
            <MessageSquare size={16} />
            Feedback geben
          </a>

          <a 
            href="https://maylang.de" 
            target="_blank" 
            rel="noopener noreferrer"
            className="opacity-60 hover:opacity-100 transition-opacity transform hover:scale-105 duration-300"
          >
            <img src="/ML_Eule.svg" alt="Owl Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
          </a>
          <div className="flex flex-col items-center">
            <a 
              href="https://maylang.de" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[11px] text-brand-dark/60 hover:text-brand transition-colors font-bold tracking-wide"
            >
              Maylang.de
            </a>
            <p className="text-[9px] text-brand/40 font-mono">
              Beta v0.8.7
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="watermark" />
        <motion.main 
          drag={isSessionActive ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 100) {
              handleSwipe(info.offset.x > 0 ? 'right' : 'left');
            }
          }}
          className="flex-1 p-0 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar relative"
        >
          <div className="p-4 md:p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
              {view === 'dashboard' && (
                <Dashboard 
                  vocab={vocab} 
                  history={history} 
                  sessions={sessions} 
                  settings={settings} 
                  onUpdateSetting={handleUpdateSetting}
                  onNavigate={(v) => {
                    setView(v as any);
                    if (v !== 'learn' && v !== 'themes') {
                      setSelectedTag(undefined);
                      setSelectedSource([]);
                      setSelectedLevel([]);
                      setSelectedBox(undefined);
                    }
                  }}
                  onSetBoxFilter={setSelectedBox}
                  now={now}
                  t={t}
                  user={user}
                  syncing={syncing}
                  lastSyncTime={lastSyncTime}
                  onSync={() => user && performInitialSync(user.uid, true)}
                />
              )}
              {view === 'learn' && (
                <Learn 
                  vocab={vocab} 
                  globalHistory={history}
                  onUpdate={handleUpdateVocab} 
                  onUndo={handleUndoVocab}
                  settings={settings} 
                  onStartSession={startSession} 
                  onEndSession={endSession} 
                  onSessionStatusChange={setIsSessionActive}
                  onUpdateSetting={handleUpdateSetting}
                  tagFilter={selectedTag}
                  onClearTagFilter={() => setSelectedTag(undefined)}
                  onSetTagFilter={setSelectedTag}
                  sourceFilter={selectedSource}
                  onSetSourceFilter={setSelectedSource}
                  groupFilter={selectedGroup}
                  onSetGroupFilter={setSelectedGroup}
                  levelFilter={selectedLevel}
                  onSetLevelFilter={setSelectedLevel}
                  boxFilter={selectedBox}
                  onSetBoxFilter={setSelectedBox}
                  onManageThemes={() => setView('themes')}
                  now={now}
                  t={t}
                  onDownloadCourseBookChapter={importCourseBookChapter}
                  isDownloadingCourseBook={isDownloadingCourseBook}
                  onInstallSpecial={loadVerbenMitPraeposition}
                  isImporting={isImporting}
                />
              )}
              {view === 'calculator' && (
                <div className="max-w-2xl mx-auto py-8">
                  <h1 className="text-3xl font-bold text-brand-dark mb-8">{t('vocab_calculator')}</h1>
                  <VocabCalculator t={t} learnedCount={learnedIds.size} />
                </div>
              )}
              {view === 'settings' && (
                <SettingsView 
                  allVocab={allVocab} 
                  settings={settings} 
                  onInstallBase={loadBaseVocabulary}
                  onInstallVerbenMitPraeposition={loadVerbenMitPraeposition}
                  isImportingBase={isImporting}
                  isImportingSpecial={isImporting}
                  baseStatus={status}
                  onProcessData={processData}
                  onExportData={handleExportData}
                  onDownloadTemplate={handleDownloadTemplate}
                  onImportFile={handleImportFile}
                  onImportFromGoogleSheets={handleImportFromGoogleSheets}
                  status={status}
                  setStatus={setStatus}
                  isImporting={isImporting}
                  gsUrl={gsUrl}
                  setGsUrl={setGsUrl}
                  gsGroup={gsGroup}
                  setGsGroup={setGsGroup}
                  t={t}
                  language={language}
                  viewMode="settings"
                  onDownloadCourseBookChapter={importCourseBookChapter}
                  isDownloadingCourseBook={isDownloadingCourseBook}
                  user={user}
                  syncing={syncing}
                  lastSyncTime={lastSyncTime}
                  onLogin={signInWithGoogle}
                  onLogout={logout}
                  onSync={() => user && performInitialSync(user.uid, true)}
                  onShowPrivacy={() => setShowPrivacy(true)}
                />
              )}
              {view === 'sync' && (
                <div className="space-y-6 max-w-2xl mx-auto px-4 md:px-0 pb-12">
                   <header className="text-center space-y-2">
                     <h2 className="text-3xl font-black text-brand-dark uppercase tracking-tight italic">Multi-Device Sync</h2>
                     <p className="text-brand-dark/40 font-bold uppercase tracking-[0.2em] text-xs">NEU & OPTIONAL</p>
                   </header>

                   <div className="card !p-8 space-y-6">
                      <div className="flex items-center gap-6">
                         <div className="w-20 h-20 rounded-3xl bg-brand/5 border-2 border-brand/10 flex items-center justify-center text-brand overflow-hidden shadow-inner">
                            {user ? (
                              <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Cloud size={40} strokeWidth={1.5} />
                            )}
                         </div>
                         <div className="flex-1">
                           <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">
                             {user ? user.displayName : 'Lokaler Modus'}
                           </h3>
                           <p className="text-sm text-brand-dark/60 font-medium">
                             {user ? 'Deine Daten sind sicher in der Cloud gespeichert.' : 'Deine Daten werden aktuell nur in diesem Browser gespeichert.'}
                           </p>
                         </div>
                      </div>

                      <div className="p-5 bg-brand-light/20 rounded-2xl border border-brand/5 space-y-3">
                         <div className="flex items-center gap-2 text-brand">
                            <Info size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Wie es funktioniert</span>
                         </div>
                         <p className="text-[11px] text-brand-dark/70 leading-relaxed">
                           Durch die Anmeldung mit deinem Google-Konto werden deine Vokabeln, Box-Level und dein Lernverlauf automatisch synchronisiert. 
                           So kannst du nahtlos zwischen Smartphone, Tablet und Computer wechseln.
                         </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        {!user ? (
                           <button 
                             onClick={signInWithGoogle}
                             className="btn-primary w-full !py-4 flex items-center justify-center gap-3 shadow-xl shadow-brand/20 active:scale-[0.98] transition-all"
                           >
                              <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
                              Mit Google synchronisieren
                           </button>
                        ) : (
                           <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 <button 
                                   onClick={() => performInitialSync(user.uid, true)}
                                   disabled={syncing}
                                   className="btn-secondary !py-4 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                                 >
                                    <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
                                    {syncing ? 'Synchronisiere...' : 'Jetzt laden'}
                                 </button>
                                 <button 
                                   onClick={logout}
                                   className="border-2 border-brand/10 text-brand-dark/60 hover:bg-brand/5 !py-4 rounded-2xl font-bold transition-all text-sm uppercase tracking-widest"
                                 >
                                    Abmelden
                                 </button>
                              </div>
                              
                              <div className="pt-6 border-t border-brand/5">
                                <h4 className="text-[10px] font-black text-brand-dark/30 uppercase tracking-[0.2em] mb-3">Datenkontrolle</h4>
                                <button 
                                  onClick={deleteUserCloudData}
                                  className="w-full text-red-500 hover:text-red-600 font-bold text-[10px] uppercase tracking-widest py-2 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  <Trash2 size={14} />
                                  Alle Cloud-Daten unwiderruflich löschen
                                </button>
                              </div>
                           </div>
                        )}
                        {user && lastSyncTime && (
                           <p className="text-center text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2">
                             Zuletzt synchronisiert: {lastSyncTime}
                           </p>
                        )}
                      </div>
                   </div>

                   <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl flex gap-4">
                      <AlertCircle className="text-amber-600 shrink-0" size={24} />
                      <div className="space-y-1">
                        <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Privatsphäre-Hinweis</p>
                        <p className="text-[11px] text-amber-800/80 leading-relaxed italic">
                          Dieses Feature ist optional. Wenn du dich nicht anmeldest, bleiben alle Daten lokal in deinem Browser (IndexedDB). 
                          Wir speichern nur lernerfolgsrelevante Daten (Vokabeln & Statistik). Wir teilen deine Daten nie mit Dritten.
                        </p>
                      </div>
                   </div>

                   <button 
                     onClick={() => setView('dashboard')}
                     className="w-full text-brand/40 hover:text-brand font-bold uppercase tracking-[0.2em] text-[10px] py-4 transition-colors"
                   >
                     Zurück zum Dashboard
                   </button>
                </div>
              )}
              {view === 'themes' && (
                <ThemesView 
                  allVocab={allVocab} 
                  onStartSession={(tag) => {
                    setSelectedTag(tag);
                    setView('learn');
                  }} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
      </div>
     </div>
      )}
    </div>
  );
}
