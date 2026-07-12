import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { IncomeNode } from '../../Income/IncomeNode';

export const OnboardingStepIncomeUpload = ({ user, onNext, onPrev, onSkip }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <IncomeNode userId={user?.uid} onComplete={onNext} compact={true} />

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
        <button type="button" onClick={onPrev} className="text-sm font-bold text-slate-400 hover:text-slate-600 py-3">
          {t('onboarding.previous', 'Previous')}
        </button>
        <div className="text-sm font-bold text-slate-400">4 / 4</div>
        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={onSkip}
            className="bg-slate-100 text-slate-600 font-bold py-3 px-6 rounded-xl hover:bg-slate-200 transition-colors"
          >
            {t('onboarding.skip', 'Skip')}
          </button>
          <button 
            type="button" 
            onClick={onNext}
            className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 group"
          >
            {t('onboarding.next', 'Next')} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
