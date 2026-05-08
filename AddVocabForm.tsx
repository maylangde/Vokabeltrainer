import React from 'react';
import { 
  ArrowLeft, 
  ShieldCheck 
} from 'lucide-react';
import { translations } from '../i18n';

interface PrivacyPolicyProps {
  onBack: () => void;
  t: (k: keyof typeof translations.de) => string;
}

export const PrivacyPolicy = ({ onBack, t }: PrivacyPolicyProps) => {
  return (
    <div className="flex flex-col h-full bg-nude-dark">
      <div className="p-4 flex items-center gap-3 bg-white border-b border-brand/10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-brand hover:bg-brand/5 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-brand-dark">{t('privacy_policy')}</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-2xl mx-auto custom-scrollbar">
        <section className="space-y-4">
          <h2 className="text-lg font-black text-brand uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={18} /> {t('privacy_at_maylang')}
          </h2>
          <p className="text-sm text-brand-dark/70 leading-relaxed italic">
            {t('privacy_intro')}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-brand-dark">{t('privacy_what_save_title')}</h3>
          <p className="text-xs text-brand-dark/60 leading-relaxed">
            {t('privacy_what_save_desc')}
          </p>
          <ul className="list-disc list-inside text-xs text-brand-dark/60 space-y-1 ml-2">
            <li>{t('privacy_item_progress')}</li>
            <li>{t('privacy_item_history')}</li>
            <li>{t('privacy_item_settings')}</li>
            <li>{t('privacy_item_google')}</li>
          </ul>
          <p className="text-xs text-brand-dark/60 font-medium">{t('privacy_what_save_footer')}</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-brand-dark">{t('privacy_location_title')}</h3>
          <p className="text-xs text-brand-dark/60 leading-relaxed">
            {t('privacy_location_desc')}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-brand-dark">{t('privacy_duration_title')}</h3>
          <p className="text-xs text-brand-dark/60 leading-relaxed">
            {t('privacy_duration_desc')}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-brand-dark">{t('privacy_third_party_title')}</h3>
          <p className="text-xs text-brand-dark/60 leading-relaxed">
            {t('privacy_third_party_desc')}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-brand-dark">{t('privacy_contact_title')}</h3>
          <p className="text-xs text-brand-dark/60 leading-relaxed">
            {t('privacy_contact_desc')}
          </p>
        </section>
        
        <div className="pt-8 text-center">
          <p className="text-[10px] text-brand-dark/30 uppercase tracking-[0.2em]">{t('privacy_updated')}</p>
        </div>
      </div>
    </div>
  );
};
