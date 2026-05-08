import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { User } from 'firebase/auth';
import { Logo } from './Logo';
import { LEARNING_TIPS } from '../constants';

interface LoadingScreenProps {
  syncInitialized: boolean;
  user: User | null;
}

export const LoadingScreen = ({ syncInitialized, user }: LoadingScreenProps) => {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * LEARNING_TIPS.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LEARNING_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-brand-light flex flex-col items-center justify-center p-8 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md space-y-8"
      >
        <div className="flex justify-center">
          <Logo className="w-24 h-24 text-brand animate-pulse" />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-brand-dark">Maylang wird geladen...</h2>
          {!syncInitialized && user && (
            <div className="flex items-center justify-center gap-2 text-brand font-bold uppercase tracking-widest text-[10px] animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              Synchronisiere Cloud-Daten
            </div>
          )}
          <div className="w-48 h-1.5 bg-brand/10 rounded-full mx-auto overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-full h-full bg-brand"
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-6 rounded-3xl shadow-xl shadow-brand/5 border border-brand/10"
          >
            <p className="text-[10px] font-bold text-brand uppercase tracking-widest mb-2">Lern-Tipp</p>
            <p className="text-sm text-brand-dark leading-relaxed italic">
              "{LEARNING_TIPS[tipIndex]}"
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
