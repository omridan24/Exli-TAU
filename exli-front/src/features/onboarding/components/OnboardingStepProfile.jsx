import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Calendar, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../../hooks/useLanguage';

export const OnboardingStepProfile = ({ user, profile, setProfile, setModalType, onNext }) => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage(user?.uid);

  const handleNextStep = (e) => {
    if (e) e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleNextStep} className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">{t('onboarding.welcome', 'Welcome to Exli!')}</h1>
        <p className="text-slate-500 mt-2">{t('onboarding.startMessage', "Let's start by getting to know you.")}</p>
        <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-100 shadow-sm flex items-start sm:items-center justify-center gap-2 text-left sm:text-center">
            <span className="text-lg">💡</span> 
            <span>{t('onboarding.prepareRecommendation', "For the best experience, we recommend preparing up to a year's worth of expense reports and payslips in advance.")}</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Language Preference */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
            {t('onboarding.languagePreference', 'Language Preference')}
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${language?.startsWith('en') ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {t('onboarding.english', 'English')}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('he')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${language?.startsWith('he') ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {t('onboarding.hebrew', 'עברית')}
            </button>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
            {t('settings.profile.fullName', 'Full Name')} <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder={t('onboarding.fullNamePlaceholder', 'e.g., Jane Doe')}
            className="w-full p-4 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 transition-colors"
            required
          />
        </div>
        
        {/* Birthdate */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
            {t('settings.profile.birthdate', 'Birthdate')}
          </label>
          <button
            type="button"
            onClick={() => setModalType('birthdate')}
            className="w-full p-4 border border-slate-200 rounded-xl flex justify-between items-center font-bold hover:bg-slate-50 transition-all text-slate-700"
          >
            {profile.birthdate || t('onboarding.selectBirthdate', 'Select Birthdate')}
            <Calendar className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Family Status */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
            {t('settings.profile.familyStatus', 'Family Status')}
          </label>
          <button
            type="button"
            onClick={() => setModalType('status')}
            className="w-full p-4 border border-slate-200 rounded-xl bg-white font-bold flex justify-between items-center text-slate-700 hover:bg-slate-50 transition-all"
          >
            {profile.status ? t(`status.${profile.status}`, profile.status) : t('onboarding.selectStatus', 'Select Status')}
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* Work Title / Occupations */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
            {t('onboarding.workTitle', 'Work Title')}
          </label>
          <button
            type="button"
            onClick={() => setModalType('occupation')}
            className="w-full p-4 border border-slate-200 rounded-xl bg-white font-bold flex justify-between items-center text-slate-700 hover:bg-slate-50 transition-all"
          >
            {profile.occupations.length > 0 ? profile.occupations.map(occ => t(`occupations.${occ}`, occ)).join(', ') : t('onboarding.selectOccupations', 'Select Occupations')}
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
        <div className="text-sm font-bold text-slate-400">1 / 4</div>
        <button 
          type="submit" 
          className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 group"
        >
          {t('onboarding.next', 'Next')} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </form>
  );
};
