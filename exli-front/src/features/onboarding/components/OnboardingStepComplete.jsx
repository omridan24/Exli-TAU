import React from 'react';
import { useTranslation } from 'react-i18next';

export const OnboardingStepComplete = ({ onPrev, onComplete, loading }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-bold text-slate-800">{t('onboarding.allSet', "You're all set!")}</h2>
      <p className="text-slate-500">
        {t('onboarding.profileCreated', "Your profile has been created. Click below to finish the onboarding and enter the dashboard.")}
      </p>
      <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
        <button 
          onClick={onPrev}
          className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 px-4 rounded-xl hover:bg-slate-200 transition-colors"
        >
          {t('onboarding.previous', 'Previous')}
        </button>
        <button 
          onClick={onComplete}
          disabled={loading}
          className="flex-1 bg-emerald-600 text-white font-bold py-4 px-4 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? t('onboarding.finishing', 'Finishing...') : t('onboarding.complete', 'Complete Onboarding')}
        </button>
      </div>
    </div>
  );
};
