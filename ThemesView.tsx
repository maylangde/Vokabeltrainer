import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight,
  Download, 
  RefreshCw,
  Library
} from 'lucide-react';
import { Vocabulary, Chapter, CourseBook } from '../types';
import { COURSE_BOOKS, CHAPTERS } from '../course-books-data';

interface CourseBooksViewProps {
  vocab: Vocabulary[];
  onStartSession?: (bookId: string, chapterTitle: string) => void;
  onDownloadChapter: (chapter: Chapter) => void;
  isDownloading: string | null;
  t: (k: any) => string;
  isManagement?: boolean;
}

export const CourseBooksView = ({ 
  vocab, 
  onStartSession, 
  onDownloadChapter, 
  isDownloading, 
  t, 
  isManagement = false 
}: CourseBooksViewProps) => {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const getBookProgress = (bookId: string) => {
    const book = COURSE_BOOKS.find(b => b.id === bookId);
    if (!book) return 0;
    const bookWords = vocab.filter(v => v.source_name === book.title);
    if (bookWords.length === 0) return 0;
    const learned = bookWords.filter(v => v.box_level === 'Archiv').length;
    return Math.round((learned / bookWords.length) * 100);
  };

  const getSeriesProgress = (seriesName: string) => {
    const seriesBooks = COURSE_BOOKS.filter(b => b.series === seriesName);
    const bookTitles = seriesBooks.map(b => b.title);
    const seriesWords = vocab.filter(v => bookTitles.includes(v.source_name));
    if (seriesWords.length === 0) return 0;
    const learned = seriesWords.filter(v => v.box_level === 'Archiv').length;
    return Math.round((learned / seriesWords.length) * 100);
  };

  const getChapterProgress = (bookId: string, chapterTitle: string) => {
    const book = COURSE_BOOKS.find(b => b.id === bookId);
    const chapterWords = vocab.filter(v => v.source_name === book?.title && v.source_group === chapterTitle);
    if (chapterWords.length === 0) return 0;
    const learned = chapterWords.filter(v => v.box_level === 'Archiv').length;
    return Math.round((learned / chapterWords.length) * 100);
  };

  const isChapterDownloaded = (bookId: string, chapterTitle: string) => {
    const book = COURSE_BOOKS.find(b => b.id === bookId);
    return vocab.some(v => v.source_name === book?.title && v.source_group === chapterTitle);
  };

  if (selectedBookId) {
    const book = COURSE_BOOKS.find(b => b.id === selectedBookId)!;
    const chapters = CHAPTERS[selectedBookId] || [];
    const totalProgress = getBookProgress(selectedBookId);

    return (
      <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button 
            onClick={() => setSelectedBookId(null)}
            className="flex items-center gap-2 text-brand hover:translate-x-[-4px] transition-transform font-bold text-[10px] uppercase tracking-widest"
          >
            <ChevronLeft size={14} /> Zurück zu den Büchern
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-black text-brand-dark uppercase tracking-widest">{book.title}</div>
              <div className="text-[8px] text-brand-dark/40 font-bold uppercase tracking-tighter">Level {book.level} • {totalProgress}% abgeschlossen</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
              <BookOpen size={20} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {chapters.map((chapter) => {
            const progress = getChapterProgress(book.id, chapter.title);
            const downloaded = isChapterDownloaded(book.id, chapter.title);
            const downloading = isDownloading === chapter.id;

            return (
              <button
                key={chapter.id}
                onClick={() => {
                  if (downloaded) {
                    if (onStartSession) {
                      onStartSession(book.id, chapter.title);
                    }
                  } else {
                    onDownloadChapter(chapter);
                  }
                }}
                className={`relative overflow-hidden group transition-all p-4 rounded-xl text-left h-20 flex flex-col justify-center border ${
                  downloaded 
                    ? 'bg-white/50 border-brand/10 hover:border-brand hover:shadow-md' 
                    : 'bg-brand/5 border-dashed border-brand/20 opacity-70 hover:opacity-100'
                }`}
              >
                {downloaded && progress > 0 && (
                  <div 
                    className="absolute top-0 left-0 h-full bg-emerald-500/10 transition-all duration-1000 ease-out pointer-events-none" 
                    style={{ width: `${progress}%` }}
                  />
                )}
                
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${downloaded ? 'bg-brand/10 text-brand' : 'bg-brand/5 text-brand-dark/30'}`}>
                    {chapter.number}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-brand-dark group-hover:text-brand transition-colors truncate">{chapter.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-brand-dark/40 font-medium uppercase tracking-widest leading-none">{chapter.vocabCount} Vokabeln</span>
                      {downloaded && progress > 0 && (
                        <span className="text-[9px] text-emerald-600 font-black leading-none">{progress}%</span>
                      )}
                    </div>
                  </div>

                  {!downloaded && (
                    <div className="text-brand shrink-0">
                      {downloading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><RefreshCw size={14} /></motion.div> : <Download size={14} />}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (selectedSeries) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
        <div className="flex items-center justify-between px-1">
          <button 
            onClick={() => setSelectedSeries(null)}
            className="flex items-center gap-1 text-xs font-black text-brand hover:underline"
          >
            <ChevronLeft className="w-4 h-4" />
            Zurück zu den Bänden
          </button>
          <div className="text-right">
            <h3 className="text-xs font-black text-brand-dark uppercase tracking-widest">{selectedSeries}</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COURSE_BOOKS.filter(b => b.series === selectedSeries).map((book) => {
            const progress = getBookProgress(book.id);
            
            return (
              <button
                key={book.id}
                onClick={() => setSelectedBookId(book.id)}
                className={`px-4 py-3 rounded-xl text-xs font-black transition-all relative overflow-hidden h-20 flex flex-col items-center justify-center border text-center ${
                  selectedBookId === book.id
                    ? 'selected-effect-inner ring-2 ring-brand ring-offset-1' 
                    : 'bg-white/50 text-brand-dark/40 hover:text-brand border-brand/5 hover:border-brand/20'
                }`}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-emerald-500/10 transition-all duration-1000 ease-out pointer-events-none" 
                  style={{ width: `${progress}%` }}
                />
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[10px] sm:text-xs text-brand-dark font-black">{book.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 opacity-70">
                    <span className="text-[8px] px-1 py-0.5 bg-brand/5 rounded leading-none">Level {book.level}</span>
                    {progress > 0 && <span className="text-[8px] text-emerald-600 leading-none">{progress}%</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const seriesNames = Array.from(new Set(COURSE_BOOKS.map(b => b.series)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-[#f07e261a] pb-4">
        <Library size={18} className="text-brand" />
        <h3 className="text-sm font-bold text-brand-dark uppercase tracking-widest leading-none">
          {isManagement ? 'Bücher verwalten' : 'Kursbegleitend lernen'}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {seriesNames.map((series) => {
          const seriesProgress = getSeriesProgress(series);
          const bookCount = COURSE_BOOKS.filter(b => b.series === series).length;
          
          return (
            <button
              key={series}
              onClick={() => setSelectedSeries(series)}
              className="card !p-5 relative overflow-hidden group hover:shadow-lg transition-all border border-[#f07e261a] hover:border-brand/30"
            >
              <div 
                className="absolute top-0 left-0 h-full bg-brand/5 transition-all duration-1000 ease-out pointer-events-none" 
                style={{ width: `${seriesProgress}%` }}
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-black text-brand-dark group-hover:text-brand transition-colors">{series}</h4>
                    <p className="text-[9px] text-brand-dark/40 font-bold uppercase tracking-wider">{bookCount} Bände vorhanden</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-lg font-black text-brand">{seriesProgress}%</span>
                  <ChevronRight size={16} className="text-brand/30 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
