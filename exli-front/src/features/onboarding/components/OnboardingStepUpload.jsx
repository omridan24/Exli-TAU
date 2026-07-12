import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { ExpenseNode } from '../../expenses/ExpenseNode';

export const OnboardingStepUpload = ({ user, categories, expenses, onUpdateCategories, onNext, onPrev, onSkip }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <ExpenseNode 
        userId={user?.uid} 
        categories={categories}
        expenses={expenses}
        onUpdateCategories={onUpdateCategories}
        onComplete={onNext}
        compact={true}
      />
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
        <button type="button" onClick={onPrev} className="text-sm font-bold text-slate-400 hover:text-slate-600 py-3 flex items-center gap-2 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {t('onboarding.previous', 'Previous')}
        </button>
        <div className="text-sm font-bold text-slate-400">3 / 4</div>
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
