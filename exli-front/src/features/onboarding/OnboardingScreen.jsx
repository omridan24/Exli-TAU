import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, setDoc } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { STATUS_LIST, OCCUPATIONS_LIST } from '../../config/constants';

import { SelectionModal } from '../settings/components/SelectionModal';
import { MultiSelectModal } from '../settings/components/MultiSelectModal';
import { DatePickerModal } from '../settings/components/DatePickerModal';

import { OnboardingStepProfile } from './components/OnboardingStepProfile';
import { OnboardingStepTaxCredit } from './components/OnboardingStepTaxCredit';
import { OnboardingStepUpload } from './components/OnboardingStepUpload';
import { OnboardingStepIncomeUpload } from './components/OnboardingStepIncomeUpload';
import { OnboardingStepComplete } from './components/OnboardingStepComplete';

export default function OnboardingScreen({ user, categories, onUpdateCategories, expenses, onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  
  const [profile, setProfile] = useState({
    name: '',
    birthdate: '',
    status: '',
    occupations: [],
    taxCreditData: {},
    taxCreditPoints: 2.25
  });

  const handleComplete = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        hasCompletedOnboarding: true,
        profile: { ...profile },
        occupations: profile.occupations
      }, { merge: true });
      onComplete();
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
      <div className={`bg-white rounded-3xl shadow-2xl p-8 animate-fade-in relative max-h-[90vh] overflow-y-auto transition-all duration-500 ease-in-out ${step === 3 || step === 4 ? 'w-full max-w-5xl' : 'w-full max-w-xl'}`}>
        
        <div className={step === 1 ? 'block' : 'hidden'}>
          <OnboardingStepProfile 
            user={user}
            profile={profile} 
            setProfile={setProfile} 
            setModalType={setModalType} 
            onNext={() => setStep(2)} 
          />
        </div>

        <div className={step === 2 ? 'block' : 'hidden'}>
          <OnboardingStepTaxCredit 
            profile={profile} 
            setProfile={setProfile} 
            onNext={() => setStep(3)} 
            onPrev={() => setStep(1)} 
            onSkip={() => setStep(3)} 
          />
        </div>

        <div className={step === 3 ? 'block' : 'hidden'}>
          <OnboardingStepUpload 
            user={user}
            categories={categories}
            onUpdateCategories={onUpdateCategories}
            expenses={expenses}
            onNext={() => setStep(4)} 
            onPrev={() => setStep(2)} 
            onSkip={() => setStep(4)} 
          />
        </div>

        <div className={step === 4 ? 'block' : 'hidden'}>
          <OnboardingStepIncomeUpload 
            user={user}
            onNext={() => setStep(5)} 
            onPrev={() => setStep(3)} 
            onSkip={() => setStep(5)} 
          />
        </div>

        <div className={step === 5 ? 'block' : 'hidden'}>
          <OnboardingStepComplete 
            onPrev={() => setStep(4)} 
            onComplete={handleComplete} 
            loading={loading} 
          />
        </div>

      </div>

      <SelectionModal 
        isOpen={modalType === 'status'} 
        title={t('settings.modals.selectStatus', 'Select Status')} 
        data={STATUS_LIST} 
        selectedValue={profile.status} 
        onSelect={(s) => { setProfile({ ...profile, status: s }); setModalType(null); }} 
        onClose={() => setModalType(null)} 
      />
      
      {modalType === 'occupation' && (
        <MultiSelectModal 
          options={OCCUPATIONS_LIST} 
          selectedValues={profile.occupations} 
          onClose={() => setModalType(null)} 
          onConfirm={(selected) => { setProfile({ ...profile, occupations: selected }); setModalType(null); }} 
        />
      )}
      
      <DatePickerModal 
        isOpen={modalType === 'birthdate'} 
        onClose={() => setModalType(null)} 
        onSave={(v) => { setProfile({ ...profile, birthdate: v }); setModalType(null); }} 
      />
    </div>
  );
}
