import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Receipt } from 'lucide-react';
import { TaxCreditCalculator } from '../../settings/components/TaxCreditCalculator';

export const OnboardingStepTaxCredit = ({ profile, setProfile, onNext, onPrev, onSkip }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Receipt className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{t('settings.taxCredit.title', 'Tax Credit Points')}</h1>
        <p className="text-slate-500 mt-2">
          {t('onboarding.taxCreditDesc', 'This helps us calculate your net income accurately. You can skip this and configure it later in settings.')}
        </p>
      </div>

      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-2xl border-2 border-orange-200">
          <TaxCreditCalculator
              data={profile.taxCreditData}
              onUpdate={(points, data) => {
                  setProfile(prev => ({ ...prev, taxCreditPoints: points, taxCreditData: data }));
              }}
          />
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
        <button type="button" onClick={onPrev} className="text-sm font-bold text-slate-400 hover:text-slate-600 py-3">
          {t('onboarding.previous', 'Previous')}
        </button>
        <div className="text-sm font-bold text-slate-400">2 / 4</div>
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
