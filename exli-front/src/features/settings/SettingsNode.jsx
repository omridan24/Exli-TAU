import React, { useState, useEffect } from 'react';
import { Save, User, Briefcase, Heart, History, Clock, MapPin, GraduationCap, Globe, X, ChevronRight, ChevronLeft, Plus, Search, Check, Edit3, Trash2, Grid, Calendar } from 'lucide-react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, logUserAction } from '../../config/firebase';
import { OCCUPATIONS_LIST, STATUS_LIST, DEFAULT_CATEGORIES } from '../../config/constants';
import { Button, Card, CategoryIcon } from '../../components/UI';

// Available Icons for Custom Categories
const ICON_OPTIONS = [
  "Star", "Zap", "HeartPulse", "Car", "ShoppingCart", "Utensils", "ShoppingBag",
  "Home", "Ticket", "Briefcase", "Gift", "Plane", "Coffee", "Wifi", "GraduationCap", "PawPrint", "HelpCircle"
];

// --- MODAL COMPONENTS ---

// 1. Redesigned Card-Based Date Picker Modal
const DatePickerModal = ({ isOpen, onClose, value, onSave }) => {
  const [step, setStep] = useState('year'); // 'year', 'month', 'day'
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Calculate days based on selected month/year
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const days = selectedYear !== null && selectedMonth !== null
    ? Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1)
    : [];

  const handleSelectYear = (year) => {
    setSelectedYear(year);
    setStep('month');
  };

  const handleSelectMonth = (index) => {
    setSelectedMonth(index);
    setStep('day');
  };

  const handleSelectDay = (day) => {
    // Use UTC to prevent timezone shifts
    const newDate = new Date(Date.UTC(selectedYear, selectedMonth, day));
    onSave(newDate.toISOString().split('T')[0]);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep('year');
    setSelectedYear(null);
    setSelectedMonth(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            {step !== 'year' && (
              <button
                onClick={() => setStep(step === 'day' ? 'month' : 'year')}
                className="p-2 hover:bg-white rounded-full transition-colors shadow-sm border border-slate-200"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {step === 'year' && "Select Year"}
              {step === 'month' && `Select Month (${selectedYear})`}
              {step === 'day' && `Select Day (${months[selectedMonth]})`}
            </h3>
          </div>
          <button onClick={resetAndClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

          {/* STEP: YEAR */}
          {step === 'year' && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => handleSelectYear(y)}
                  className="p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* STEP: MONTH */}
          {step === 'month' && (
            <div className="grid grid-cols-2 gap-3">
              {months.map((m, i) => (
                <button
                  key={m}
                  onClick={() => handleSelectMonth(i)}
                  className="p-6 rounded-2xl border-2 border-slate-100 font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95 text-lg"
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* STEP: DAY */}
          {step === 'day' && (
            <div className="grid grid-cols-5 gap-2">
              {days.map(d => (
                <button
                  key={d}
                  onClick={() => handleSelectDay(d)}
                  className="aspect-square flex items-center justify-center rounded-xl border-2 border-slate-100 font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Progress */}
        <div className="p-4 bg-slate-50 flex justify-center gap-2 border-t border-slate-100">
          <div className={`h-1.5 w-8 rounded-full transition-all ${step === 'year' ? 'bg-emerald-500 w-12' : 'bg-slate-200'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-all ${step === 'month' ? 'bg-emerald-500 w-12' : 'bg-slate-200'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-all ${step === 'day' ? 'bg-emerald-500 w-12' : 'bg-slate-200'}`} />
        </div>
      </div>
    </div>
  );
};

// 2. Generic Selection Modal
const SelectionModal = ({ title, options = [], onClose, onSelect, selectedValue, isLoading, onSearchChange, allowCustom = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const safeOptions = Array.isArray(options) ? options : [];
  const filtered = safeOptions.filter(o => String(o).toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    if (onSearchChange) onSearchChange(searchTerm);
  }, [searchTerm, onSearchChange]);

  const handleCustomSelect = () => {
    if (customValue.trim()) onSelect(customValue);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
        </div>

        {!isCustom ? (
          <>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-12 p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2">
                  <Clock className="w-6 h-6 animate-spin text-slate-300" />
                  <span>Loading options...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map(opt => (
                    <button
                      key={opt}
                      onClick={() => onSelect(opt)}
                      className={`p-4 rounded-xl text-left font-bold transition-all flex items-center justify-between group ${selectedValue === opt ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-700' : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md'}`}
                    >
                      <span className="truncate">{opt}</span>
                      {selectedValue === opt && <Check className="w-5 h-5" />}
                    </button>
                  ))}
                  {allowCustom && (
                    <button
                      onClick={() => setIsCustom(true)}
                      className="p-4 rounded-xl text-left font-bold border-2 border-dashed border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" /> Other (Add New)
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 p-8 flex flex-col justify-center">
            <h4 className="text-lg font-bold text-slate-700 mb-4 text-center">Enter Custom Value</h4>
            <input
              type="text"
              className="w-full p-4 text-xl font-bold border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-500 mb-6 text-center"
              placeholder={`Type ${title}...`}
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              autoFocus
            />
            <div className="flex gap-4">
              <Button variant="secondary" onClick={() => setIsCustom(false)} className="flex-1 justify-center">Back</Button>
              <Button onClick={handleCustomSelect} disabled={!customValue} className="flex-1 justify-center">Confirm</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 3. Multi-Select Modal
const MultiSelectModal = ({ options, onClose, onConfirm, selectedValues = [] }) => {
  const [selected, setSelected] = useState(selectedValues);
  const [searchTerm, setSearchTerm] = useState('');
  const [customJob, setCustomJob] = useState('');

  const filtered = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (val) => {
    if (selected.includes(val)) {
      setSelected(selected.filter(s => s !== val));
    } else {
      if (selected.length >= 3) {
        alert("You can select up to 3 occupations.");
        return;
      }
      setSelected([...selected, val]);
    }
  };

  const addCustom = () => {
    if (customJob && !selected.includes(customJob)) {
      if (selected.length >= 3) {
        alert("You can select up to 3 occupations.");
        return;
      }
      setSelected([...selected, customJob]);
      setCustomJob('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Select Occupations (Max 3)</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
        </div>
        <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
          <input
            type="text"
            placeholder="Search jobs..."
            className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type custom job..."
              className="flex-1 p-2 rounded-lg border border-slate-200 text-sm"
              value={customJob}
              onChange={e => setCustomJob(e.target.value)}
            />
            <button onClick={addCustom} disabled={!customJob} className="bg-slate-900 text-white px-4 rounded-lg text-sm font-bold disabled:opacity-50">Add</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          {selected.filter(s => !options.includes(s)).map(job => (
            <button key={job} onClick={() => toggle(job)} className="p-3 rounded-xl text-left font-bold bg-emerald-50 border-2 border-emerald-500 text-emerald-700 flex justify-between items-center">
              {job} <Check className="w-4 h-4" />
            </button>
          ))}
          {filtered.map(job => (
            <button
              key={job}
              onClick={() => toggle(job)}
              className={`p-3 rounded-xl text-left font-bold transition-all flex justify-between items-center ${selected.includes(job) ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-700' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
            >
              {job}
              {selected.includes(job) && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <Button onClick={() => onConfirm(selected)} className="w-full justify-center">Done ({selected.length})</Button>
        </div>
      </div>
    </div>
  );
};

// 4. Category Editor Modal
const CategoryEditorModal = ({ category, onSave, onClose }) => {
  const [data, setData] = useState({ ...category });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-slate-800 mb-4">{category.id ? 'Edit Category' : 'New Category'}</h3>

        <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
        <input
          type="text"
          value={data.name}
          onChange={e => setData({ ...data, name: e.target.value })}
          className="w-full p-3 border border-slate-200 rounded-xl mb-4 font-bold text-slate-700 outline-none focus:border-emerald-500"
        />

        <label className="text-xs font-bold text-slate-400 uppercase">Color</label>
        <div className="flex gap-2 flex-wrap mb-4">
          {['#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ef4444', '#ec4899', '#6366f1', '#0ea5e9'].map(c => (
            <button
              key={c}
              onClick={() => setData({ ...data, color: c })}
              className={`w-8 h-8 rounded-full border-2 ${data.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <label className="text-xs font-bold text-slate-400 uppercase">Icon</label>
        <div className="grid grid-cols-5 gap-2 mb-6 h-32 overflow-y-auto p-1">
          {ICON_OPTIONS.map(icon => (
            <button
              key={icon}
              onClick={() => setData({ ...data, icon })}
              className={`p-2 rounded-lg flex items-center justify-center border ${data.icon === icon ? 'bg-slate-100 border-slate-800' : 'border-transparent hover:bg-slate-50'}`}
            >
              <CategoryIcon iconName={icon} className="w-5 h-5 text-slate-600" />
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
          <Button onClick={() => onSave(data)} disabled={!data.name} className="flex-1 justify-center">Save</Button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN SETTINGS COMPONENT ---
export const SettingsNode = ({ userId }) => {
  const [profile, setProfile] = useState({
    name: '', birthdate: '1995-01-01', occupations: [], status: '',
    country: '', city: '', university: '', isStudent: false, preferredCurrency: 'ILS'
  });
  const [customCategories, setCustomCategories] = useState([]);
  const [history, setHistory] = useState([]);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  // Modals
  const [modalConfig, setModalConfig] = useState(null);
  const [catModal, setCatModal] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // API Data
  const [countriesList, setCountriesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [universitiesList, setUniversitiesList] = useState([]);
  const [isApiLoading, setIsApiLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!userId) return;

      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        let occArray = data.occupations || [];
        if (!occArray.length && data.occupation) occArray = [data.occupation];
        setProfile(prev => ({ ...prev, ...data, occupations: occArray }));
        setCustomCategories(data.customCategories || []);
      }

      const q = query(collection(db, 'users', userId, 'history'), orderBy('timestamp', 'desc'), limit(20));
      const historySnap = await getDocs(q);
      setHistory(historySnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Countries
      try {
        const res = await fetch("https://restcountries.com/v3.1/all?fields=name");
        const data = await res.json();
        const sorted = data.map(c => c.name.common).sort();
        setCountriesList(sorted);
      } catch (e) { console.error("Countries API failed", e); }
    };
    init();
  }, [userId]);

  // Fetch Cities & Universities when Country changes
  useEffect(() => {
    if (!profile.country) return;

    setCitiesList([]);
    setUniversitiesList([]);
    setIsApiLoading(true);

    const fetchCities = async () => {
      try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: profile.country })
        });
        const data = await res.json();
        if (!data.error) setCitiesList(data.data);
        else setCitiesList(['Tel Aviv', 'Jerusalem', 'Haifa', 'New York', 'London', 'Paris', 'Other']);
      } catch (e) {
        setCitiesList(['Tel Aviv', 'Jerusalem', 'Haifa', 'New York', 'London', 'Paris', 'Other']);
      }
    };

    const fetchUniversities = async () => {
      try {
        // Raw GitHub JSON (Super Fast)
        const res = await fetch("https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json");
        const data = await res.json();
        const filtered = data
          .filter(u => u.country.toLowerCase() === profile.country.toLowerCase())
          .map(u => u.name)
          .sort();
        setUniversitiesList(filtered.length ? filtered : ['Other']);
      } catch (e) {
        setUniversitiesList(['Other']);
      }
    };

    Promise.allSettled([fetchCities(), fetchUniversities()])
      .then(() => setIsApiLoading(false));

  }, [profile.country]);

  const calculateAge = (birthdate) => {
    if (!birthdate) return 0;
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const age = calculateAge(profile.birthdate);
      await setDoc(doc(db, 'users', userId), { ...profile, age, customCategories }, { merge: true });
      await logUserAction(userId, 'PROFILE_UPDATE', 'Updated settings');
      setMsg("Saved Successfully!");
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg("Error saving."); }
    finally { setIsLoading(false); }
  };

  // --- Category Handlers (with Instant Save) ---
  const handleAddCategory = () => setCatModal({ name: '', color: '#10b981', icon: 'Star', id: null });
  const handleEditCategory = (cat) => setCatModal({ ...cat });

  const saveCategory = async (catData) => {
    let updated;
    if (catData.id) {
      updated = customCategories.map(c => c.id === catData.id ? catData : c);
    } else {
      const newId = catData.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      updated = [...customCategories, { ...catData, id: newId }];
    }
    setCustomCategories(updated);
    setCatModal(null);
    // Persist Immediately
    await setDoc(doc(db, 'users', userId), { customCategories: updated }, { merge: true });
    await logUserAction(userId, 'CATEGORY_UPDATE', `Updated/Added category ${catData.name}`);
  };

  const deleteCategory = async (id) => {
    if (confirm('Delete this category?')) {
      const updated = customCategories.filter(c => c.id !== id);
      setCustomCategories(updated);
      // Persist Immediately
      await setDoc(doc(db, 'users', userId), { customCategories: updated }, { merge: true });
      await logUserAction(userId, 'CATEGORY_DELETE', 'Deleted custom category');
    }
  };

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const formatDate = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleString() : '';

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in relative pb-20">
      <div className="flex justify-center gap-2 mb-8 bg-slate-100 p-1 rounded-full w-fit mx-auto">
        {['profile', 'categories', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-full font-bold transition-all capitalize ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><User className="w-6 h-6 text-emerald-500" /> My Profile</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Full Name</label>
              <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Birthdate</label>
              <div onClick={() => setShowDatePicker(true)} className="w-full p-4 border border-slate-200 rounded-2xl bg-white flex justify-between items-center cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-500 transition-colors">
                    <Calendar className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                  </div>
                  <span className="font-black text-slate-700 text-lg tracking-tight">{profile.birthdate}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </div>
              <div className="mt-2 text-right text-sm text-slate-400 font-medium italic">Age: <span className="text-emerald-600 font-black not-italic">{calculateAge(profile.birthdate)}</span> years old</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div onClick={() => setModalConfig({ type: 'multi', title: 'Select Occupations', options: OCCUPATIONS_LIST, field: 'occupations' })} className="cursor-pointer">
                <label className="block text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Occupations</label>
                <div className="w-full p-3 border border-slate-200 rounded-xl bg-white font-medium hover:border-emerald-500 transition-colors min-h-[50px] flex flex-wrap gap-2">
                  {profile.occupations.length > 0 ? profile.occupations.map(job => (
                    <span key={job} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold">{job}</span>
                  )) : <span className="text-slate-300">Select...</span>}
                </div>
              </div>

              <div onClick={() => setModalConfig({ type: 'single', title: 'Select Status', options: STATUS_LIST, field: 'status' })} className="cursor-pointer">
                <label className="block text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Heart className="w-4 h-4" /> Family Status</label>
                <div className="w-full p-3 border border-slate-200 rounded-xl bg-white font-medium flex justify-between items-center hover:border-emerald-500 transition-colors">
                  {profile.status || <span className="text-slate-300">Select...</span>}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setModalConfig({ type: 'single', title: 'Select Country', options: countriesList, field: 'country' })} className="cursor-pointer">
                <label className="block text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> Country</label>
                <div className="w-full p-3 border border-slate-200 rounded-xl bg-white font-medium hover:border-emerald-500 transition-colors truncate">{profile.country || 'Select...'}</div>
              </div>
              <div onClick={() => setModalConfig({ type: 'single', title: 'Select City', options: citiesList, field: 'city', isLoading: isApiLoading })} className={`cursor-pointer ${!profile.country && 'opacity-50 pointer-events-none'}`}>
                <label className="block text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> City</label>
                <div className="w-full p-3 border border-slate-200 rounded-xl bg-white font-medium hover:border-emerald-500 transition-colors truncate">{profile.city || 'Select...'}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <input type="checkbox" id="isStudent" checked={profile.isStudent} onChange={e => setProfile({ ...profile, isStudent: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <label htmlFor="isStudent" className="font-bold text-slate-700 cursor-pointer select-none">I am a Student</label>
              </div>
              {profile.isStudent && (
                <div onClick={() => setModalConfig({ type: 'single', title: 'Select University', options: universitiesList, field: 'university', isLoading: isApiLoading })} className="cursor-pointer animate-fade-in">
                  <label className="block text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> University</label>
                  <div className="w-full p-3 border border-slate-200 rounded-xl bg-white font-medium hover:border-emerald-500 transition-colors truncate">{profile.university || 'Select...'}</div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="text-emerald-600 font-bold animate-pulse">{msg}</span>
              <Button onClick={handleSaveProfile} disabled={isLoading}>{isLoading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}</Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'categories' && (
        <Card className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Grid className="w-6 h-6 text-purple-500" /> Manage Categories</h2>
            <Button onClick={handleAddCategory} className="px-4 py-2 text-sm"><Plus className="w-4 h-4" /> New</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allCategories.map(cat => {
              const isCustom = customCategories.some(c => c.id === cat.id);
              return (
                <div key={cat.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color }}>
                      <CategoryIcon iconName={cat.icon} className="w-4 h-4" color="white" />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                  </div>
                  {isCustom && (
                    <div className="flex gap-1">
                      <button onClick={() => handleEditCategory(cat)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><History className="w-6 h-6 text-blue-500" /> Activity History</h2>
          <div className="space-y-4">
            {history.length === 0 ? <div className="text-center text-slate-400 py-8">No recent activity.</div> : history.map(item => (
              <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="bg-white p-2 rounded-full border border-slate-200"><Clock className="w-4 h-4 text-slate-400" /></div>
                <div className="flex-1"><div className="font-bold text-slate-700 text-sm">{item.description}</div><div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{item.actionType}</div></div>
                <div className="text-xs text-slate-400 font-medium whitespace-nowrap">{formatDate(item.timestamp)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modalConfig && (
        modalConfig.type === 'single'
          ? <SelectionModal title={modalConfig.title} options={modalConfig.options} isLoading={modalConfig.isLoading} selectedValue={profile[modalConfig.field]} onClose={() => setModalConfig(null)} onSelect={(val) => { setProfile({ ...profile, [modalConfig.field]: val }); setModalConfig(null); }} />
          : <MultiSelectModal title={modalConfig.title} options={modalConfig.options} selectedValues={profile[modalConfig.field]} onClose={() => setModalConfig(null)} onConfirm={(vals) => { setProfile({ ...profile, [modalConfig.field]: vals }); setModalConfig(null); }} />
      )}

      {catModal && <CategoryEditorModal category={catModal} onClose={() => setCatModal(null)} onSave={saveCategory} />}
      <DatePickerModal
        isOpen={showDatePicker}
        value={profile.birthdate}
        onClose={() => setShowDatePicker(false)}
        onSave={(val) => setProfile({ ...profile, birthdate: val })}
      />
    </div>
  );
};