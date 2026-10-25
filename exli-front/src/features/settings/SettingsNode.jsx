import React, { useState, useEffect } from 'react';
import { Save, Globe, Languages } from 'lucide-react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, logUserAction } from '../../config/firebase';
import { OCCUPATIONS_LIST, STATUS_LIST } from '../../config/constants';
import { COUNTRIES_LIST, getCountryFlagUrl } from '../../config/countries';
import { Button } from '../../components/UI';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';

import { WorkplacePickerModal } from './components/WorkplacePickerModal';
import { SelectionModal } from './components/SelectionModal';
import { MultiSelectModal } from './components/MultiSelectModal';
import { DatePickerModal } from './components/DatePickerModal';
import { CategoryEditorModal } from './components/CategoryEditorModal';
import { ProfileTab } from './components/ProfileTab';
import { CategoriesTab } from './components/CategoriesTab';
import { HistoryTab } from './components/HistoryTab';
import { CurrencyTab } from './components/CurrencyTab';

const defaultCountryOptions = COUNTRIES_LIST.map(c => ({
  name: c.name,
  code: c.code,
  nameHe: c.nameHe,
  flag: (
    <img
      src={getCountryFlagUrl(c.code)}
      alt=""
      className="w-6 h-4 object-cover rounded-sm shadow-xs"
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  )
}));

export const SettingsNode = ({ userId, onUpdateProfile, categories, onUpdateCategories }) => {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage(userId);

  const [profile, setProfile] = useState({
    name: '', birthdate: '', occupations: [], status: '',
    country: '', city: '', university: '', isStudent: false, preferredCurrency: 'ILS', workplaces: [],
    taxCreditPoints: 2.25,
    monthlyPayday: 10,
    monthlyChargeDay: 10,
  });
  const [customCategories, setCustomCategories] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  // Modal Control
  const [modalType, setModalType] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWorkplacePicker, setShowWorkplacePicker] = useState(null);
  const [catModal, setCatModal] = useState(null);

  // API Data Lists
  const [countries, setCountries] = useState(defaultCountryOptions);
  const [cities, setCities] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [isApiLoading, setIsApiLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!userId) return;
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        const baseProfile = data.profile || data; // Handle both structures
        setProfile(prev => ({
          ...prev,
          ...baseProfile,
          occupations: baseProfile.occupations || baseProfile.occupation || [],
          workplaces: baseProfile.workplaces || [],
          monthlyPayday: baseProfile.monthlyPayday !== undefined ? baseProfile.monthlyPayday : (data.monthlyPayday || 10),
          monthlyChargeDay: baseProfile.monthlyChargeDay !== undefined ? baseProfile.monthlyChargeDay : (data.monthlyChargeDay || 10),
        }));
        setCustomCategories(data.customCategories || []);
      }

      // Load History
      const q = query(collection(db, 'users', userId, 'history'), orderBy('timestamp', 'desc'), limit(15));
      const hSnap = await getDocs(q);
      setHistory(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    init();
  }, [userId]);

  const fetchCities = async (countryName) => {
    if (!countryName) return;
    setModalType('city');
    setIsApiLoading(true);
    try {
      const response = await fetch(`https://countriesnow.space/api/v0.1/countries/cities/q?country=${encodeURIComponent(countryName)}`);
      const data = await response.json();
      setCities(!data.error && Array.isArray(data.data) ? data.data : ['No cities found', 'Other']);
    } catch (err) { setCities(['Error fetching', 'Other']); } finally { setIsApiLoading(false); }
  };

  const fetchUniversities = (country) => {
    if (!country) return;
    setModalType('university');
    setIsApiLoading(true);
    fetch("https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json")
      .then(res => res.json())
      .then(data => {
        const filtered = Array.isArray(data) ? data.filter(u => u.country?.toLowerCase() === country.toLowerCase()).map(u => u.name).sort() : [];
        setUniversities(filtered.length ? filtered : ['Other']);
      })
      .catch(() => setUniversities(['Other']))
      .finally(() => setIsApiLoading(false));
  };

  const handleSaveProfile = async (newProfile) => {
    const p = newProfile || profile;
    setProfile(p);
    if (onUpdateProfile) {
      onUpdateProfile(p);
    }
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'users', userId), {
        profile: p,
        // Support top-level sync for older components
        occupations: p.occupations,
        workplaces: p.workplaces,
        country: p.country,
        city: p.city,
        monthlyPayday: p.monthlyPayday,
        monthlyChargeDay: p.monthlyChargeDay
      }, { merge: true });
      await logUserAction(userId, 'PROFILE_UPDATE', 'Updated settings');
      setMsg(t('settings.savedSuccess'));
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg(t('settings.error')); } finally { setIsLoading(false); }
  };

  const handleOccupationConfirm = (selected) => {
    const last = selected.find(occ => !profile.occupations.includes(occ));
    const newP = { ...profile, occupations: selected };
    handleSaveProfile(newP);
    setModalType(null);
    if (last) setShowWorkplacePicker(last);
  };

  const addWorkplace = (company) => {
    const newW = [...profile.workplaces, { ...company, linkedOccupation: showWorkplacePicker }];
    handleSaveProfile({ ...profile, workplaces: newW });
    setShowWorkplacePicker(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in relative pb-20">

      {/* 1. STICKY TOP HEADER */}
      <div className="sticky top-0 z-40 bg-slate-50/90 backdrop-blur-md py-4 mb-8 -mx-6 px-6 border-b flex items-center justify-between">
        <div className="flex bg-slate-100 p-1 rounded-full">
          {['profile', 'currency', 'categories', 'history'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === tab ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{t(`settings.tabs.${tab}`)}</button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full p-1">
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${language === 'en' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('he')}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${language === 'he' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              עב
            </button>
          </div>
          {msg && <span className="text-emerald-600 font-bold text-sm animate-fade-in">{msg}</span>}
          <Button onClick={() => handleSaveProfile()} disabled={isLoading} className="shadow-lg shadow-emerald-200/50 px-10">
            {isLoading ? t('settings.saving') : <><Save className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('settings.save')}</>}
          </Button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <ProfileTab
          profile={profile}
          onUpdateProfile={(key, val) => setProfile(prev => ({ ...prev, [key]: val }))}
          handleSaveProfile={handleSaveProfile}
          onOpenModal={(type) => {
            if (type === 'city') { if (!profile.country) return alert(t('settings.profile.selectCountryFirst')); fetchCities(profile.country); }
            else if (type === 'university') { if (!profile.country) return alert(t('settings.profile.selectCountryFirst')); fetchUniversities(profile.country); }
            else setModalType(type);
          }}
          onOpenWorkplacePicker={(occ) => setShowWorkplacePicker(occ)}
          onOpenDatePicker={() => setShowDatePicker(true)}
        />
      )}

      {/* MODALS */}
      <SelectionModal isOpen={modalType === 'country'} title={t('settings.modals.selectCountry')} data={countries} selectedValue={profile.country} onSelect={(c) => { const name = c.name || c; handleSaveProfile({ ...profile, country: name, city: '' }); setModalType(null); }} onClose={() => setModalType(null)} />
      <SelectionModal isOpen={modalType === 'city'} title={t('settings.modals.citiesIn', { country: profile.country })} data={cities} isLoading={isApiLoading} selectedValue={profile.city} allowCustom={true} onSelect={(c) => { handleSaveProfile({ ...profile, city: c }); setModalType(null); }} onClose={() => setModalType(null)} />
      <SelectionModal isOpen={modalType === 'university'} title={t('settings.modals.universitiesIn', { country: profile.country })} data={universities} isLoading={isApiLoading} selectedValue={profile.university} allowCustom={true} onSelect={(u) => { handleSaveProfile({ ...profile, university: u }); setModalType(null); }} onClose={() => setModalType(null)} />
      <SelectionModal isOpen={modalType === 'status'} title={t('settings.modals.selectStatus')} data={STATUS_LIST} selectedValue={profile.status} onSelect={(s) => { handleSaveProfile({ ...profile, status: s }); setModalType(null); }} onClose={() => setModalType(null)} />

      {modalType === 'occupation' && <MultiSelectModal options={OCCUPATIONS_LIST} selectedValues={profile.occupations} onClose={() => setModalType(null)} onConfirm={handleOccupationConfirm} />}

      <WorkplacePickerModal isOpen={!!showWorkplacePicker} occupationName={showWorkplacePicker} onClose={() => setShowWorkplacePicker(null)} onSelect={addWorkplace} />
      <DatePickerModal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} onSave={(v) => handleSaveProfile({ ...profile, birthdate: v })} />

      {activeTab === 'currency' && (
        <CurrencyTab userId={userId} />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab
          customCategories={customCategories}
          onOpenCategoryModal={setCatModal}
          onDeleteCategory={async (id) => {
            const updated = customCategories.filter(c => c.id !== id);
            setCustomCategories(updated);
            await setDoc(doc(db, 'users', userId), { customCategories: updated }, { merge: true });
          }}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab history={history} />
      )}

      {catModal && <CategoryEditorModal category={catModal} onClose={() => setCatModal(null)} onSave={async (data) => {
        let updated = data.id ? customCategories.map(c => c.id === data.id ? data : c) : [...customCategories, { ...data, id: Date.now().toString() }];
        setCustomCategories(updated); setCatModal(null);
        await setDoc(doc(db, 'users', userId), { customCategories: updated }, { merge: true });
      }} />}
    </div>
  );
};
