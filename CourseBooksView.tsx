import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger';
}

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onConfirm, 
  confirmText = "Bestätigen", 
  cancelText = "Abbrechen", 
  type = "default" 
}: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-dark/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden border border-brand/10"
          >
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
                <button onClick={onClose} className="text-brand-dark/20 hover:text-brand transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="text-brand-dark/70 leading-relaxed">
                {children}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={onClose}
                  className="flex-1 px-8 py-3.5 rounded-2xl bg-brand-light/50 text-brand-dark/60 text-xs font-black uppercase tracking-widest hover:bg-brand/5 border border-brand/10 transition-all"
                >
                  {cancelText}
                </button>
                <button 
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${
                    type === 'danger' 
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' 
                      : 'bg-brand text-white hover:bg-brand-dark shadow-brand/20'
                  }`}
                >
                  <Check size={16} />
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
