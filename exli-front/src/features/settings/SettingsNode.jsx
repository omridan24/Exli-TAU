import React, { useState, useEffect } from 'react';
import {
  Save, User, Briefcase, Heart, History, Clock, MapPin,
  GraduationCap, Globe, X, ChevronRight, ChevronLeft,
  Plus, Search, Check, Edit3, Trash2, Grid, Calendar, Building2, Settings, ArrowRight
} from 'lucide-react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, logUserAction } from '../../config/firebase';
import { OCCUPATIONS_LIST, STATUS_LIST, DEFAULT_CATEGORIES } from '../../config/constants';
import { Button, Card, CategoryIcon } from '../../components/UI';

// Available Icons for Custom Categories
const ICON_OPTIONS = [
  "Star", "Zap", "HeartPulse", "Car", "ShoppingCart", "Utensils", "ShoppingBag",
  "Home", "Ticket", "Briefcase", "Gift", "Plane", "Coffee", "Wifi", "GraduationCap", "PawPrint", "HelpCircle"
];

// --- SUB-COMPONENT: LOGO RENDERER ---
const LogoImage = ({ logo, domain, className = "w-10 h-10" }) => {
  const [error, setError] = useState(false);
  const logoUrl = domain && domain !== 'independent' ? `https://logo.clearbit.com/${domain}` : logo;

  if (error || !logoUrl) {
    return (
      <div className={`${className} rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200`}>
        <Building2 className="w-1/2 h-1/2 text-slate-400" />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg border border-slate-100 flex items-center justify-center bg-white overflow-hidden`}>
      <img src={logoUrl} alt="" className="w-full h-full object-contain p-1" onError={() => setError(true)} />
    </div>
  );
};

// --- MODAL: WORKPLACE PICKER ---
const WorkplacePickerModal = ({ isOpen, occupationName, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchTerm.length < 2) { setSuggestions([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${searchTerm}`);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-emerald-50/30">
          <h3 className="text-xl font-black text-slate-800 uppercase">Workplace</h3>
          <p className="text-xs text-emerald-600 font-bold">Where are you a {occupationName}?</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
              placeholder="Search company..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {loading && <div className="text-center py-4 animate-pulse text-slate-400 text-xs">Searching...</div>}
            {suggestions.map(s => (
              <button key={s.domain} onClick={() => onSelect(s)} className="w-full p-3 flex items-center justify-between hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 group">
                <div className="flex items-center gap-3">
                  <LogoImage logo={s.logo} domain={s.domain} />
                  <div className="text-left">
                    <div className="font-bold text-slate-700 text-sm">{s.name}</div>
                    <div className="text-[10px] text-slate-400">{s.domain}</div>
                  </div>
                </div>
                <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
              </button>
            ))}
            <button onClick={() => onSelect({ name: 'Independent', domain: 'independent', logo: '' })} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center gap-2 transition-all">
              <Briefcase className="w-4 h-4" /> I am Independent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MODAL: GENERIC SELECTION (For Country, City, Status, University) ---
const SelectionModal = ({ isOpen, title, data = [], onClose, onSelect, selectedValue, isLoading, allowCustom = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  if (!isOpen) return null;

  const filtered = data.filter(o => {
    const name = o.name || o;
    return String(name).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
        </div>

        {!isAddingCustom ? (
          <>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <input
                type="text"
                placeholder="Search..."
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center py-10 animate-pulse text-slate-400 font-bold">Loading options...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((opt, i) => {
                    const name = opt.name || opt;
                    const val = opt.code || name;
                    return (
                      <button
                        key={i}
                        onClick={() => onSelect(opt)}
                        className={`p-4 rounded-xl text-left font-bold border transition-all flex items-center justify-between group ${selectedValue === name ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-3">
                          {opt.flag && opt.flag}
                          <span className="truncate">{name}</span>
                        </div>
                        {selectedValue === name && <Check className="w-5 h-5" />}
                      </button>
                    );
                  })}
                  {allowCustom && (
                    <button onClick={() => setIsAddingCustom(true)} className="p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" /> Add Other
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 p-10 flex flex-col justify-center">
            <h4 className="text-lg font-bold text-slate-700 mb-4 text-center">Custom Value</h4>
            <input
              type="text"
              className="w-full p-4 text-2xl font-bold border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-500 text-center mb-8"
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              placeholder="Type here..."
            />
            <div className="flex gap-4">
              <Button variant="secondary" onClick={() => setIsAddingCustom(false)} className="flex-1 justify-center">Back</Button>
              <Button onClick={() => onSelect(customValue)} className="flex-1 justify-center">Confirm</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MODAL: MULTI-SELECT (Job Titles) ---
const MultiSelectModal = ({ options, onClose, onConfirm, selectedValues = [] }) => {
  const [selected, setSelected] = useState(selectedValues);
  const [searchTerm, setSearchTerm] = useState('');
  const [customJob, setCustomJob] = useState('');

  const toggle = (val) => {
    if (selected.includes(val)) setSelected(selected.filter(s => s !== val));
    else if (selected.length < 3) setSelected([...selected, val]);
    else alert("Max 3 occupations.");
  };

  const handleAddCustom = () => {
    if (customJob.trim() && !selected.includes(customJob)) {
      if (selected.length < 3) { toggle(customJob.trim()); setCustomJob(''); }
      else alert("Max 3 occupations.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center"><h3 className="text-xl font-bold">Occupations (Max 3)</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6" /></button></div>
        <div className="p-4 bg-slate-50 border-b space-y-3">
          <input type="text" placeholder="Search standard jobs..." className="w-full p-3 rounded-xl border outline-none focus:border-emerald-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="flex gap-2">
            <input type="text" placeholder="Add custom job title..." className="flex-1 p-3 rounded-xl border text-sm outline-none focus:border-emerald-500" value={customJob} onChange={e => setCustomJob(e.target.value)} />
            <button onClick={handleAddCustom} className="bg-slate-900 text-white px-6 rounded-xl font-bold text-sm">Add</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selected.filter(s => !options.includes(s)).map(job => (
            <button key={job} onClick={() => toggle(job)} className="p-3 rounded-xl text-left font-bold bg-emerald-50 border-2 border-emerald-500 text-emerald-700 flex justify-between items-center">{job} <Check className="w-4 h-4" /></button>
          ))}
          {options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase())).map(job => (
            <button key={job} onClick={() => toggle(job)} className={`p-3 rounded-xl text-left font-bold border transition-all flex justify-between items-center ${selected.includes(job) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{job} {selected.includes(job) && <Check className="w-4 h-4" />}</button>
          ))}
        </div>
        <div className="p-4 border-t"><Button onClick={() => onConfirm(selected)} className="w-full justify-center">Confirm Selection</Button></div>
      </div>
    </div>
  );
};

// --- MODAL: DATE PICKER ---
const DatePickerModal = ({ isOpen, onClose, value, onSave }) => {
  const [step, setStep] = useState('year');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  if (!isOpen) return null;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const handleSelectYear = (y) => { setSelectedYear(y); setStep('month'); };
  const handleSelectMonth = (i) => { setSelectedMonth(i); setStep('day'); };
  const handleSelectDay = (d) => {
    const newDate = new Date(Date.UTC(selectedYear, selectedMonth, d));
    onSave(newDate.toISOString().split('T')[0]);
    setStep('year'); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            {step !== 'year' && <button onClick={() => setStep(step === 'day' ? 'month' : 'year')} className="p-2 border rounded-full"><ChevronLeft className="w-4 h-4" /></button>}
            <h3 className="font-bold uppercase tracking-tight">{step}</h3>
          </div>
          <button onClick={onClose}><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'year' && <div className="grid grid-cols-4 gap-2">{years.map(y => <button key={y} onClick={() => handleSelectYear(y)} className="p-3 border rounded-xl hover:bg-emerald-50">{y}</button>)}</div>}
          {step === 'month' && <div className="grid grid-cols-2 gap-2">{months.map((m, i) => <button key={m} onClick={() => handleSelectMonth(i)} className="p-4 border rounded-xl hover:bg-emerald-50">{m}</button>)}</div>}
          {step === 'day' && <div className="grid grid-cols-5 gap-2">{Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map(d => <button key={d} onClick={() => handleSelectDay(d)} className="p-3 border rounded-xl hover:bg-emerald-50">{d}</button>)}</div>}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export const SettingsNode = ({ userId }) => {
  const [profile, setProfile] = useState({
    name: '', birthdate: '1995-01-01', occupations: [], status: '',
    country: '', city: '', university: '', isStudent: false, preferredCurrency: 'ILS', workplaces: []
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
  const [countries, setCountries] = useState([]);
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
          workplaces: baseProfile.workplaces || []
        }));
        setCustomCategories(data.customCategories || []);
      }

      // Load History
      const q = query(collection(db, 'users', userId, 'history'), orderBy('timestamp', 'desc'), limit(15));
      const hSnap = await getDocs(q);
      setHistory(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Countries
      fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags')
        .then(res => res.json())
        .then(data => {
          const formatted = data.map(c => ({
            name: c.name.common,
            code: c.cca2,
            flag: c.flags.svg ? <img src={c.flags.svg} className="w-6 h-4 object-cover" /> : null
          })).sort((a, b) => a.name.localeCompare(b.name));
          setCountries(formatted);
        });
    };
    init();
  }, [userId]);

  const fetchCities = async (countryName) => {
    if (!countryName) return;
    setModalType('city');
    setIsApiLoading(true);
    try {
      const response = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName })
      });
      const data = await response.json();
      setCities(!data.error ? data.data : ['No cities found', 'Other']);
    } catch (err) { setCities(['Error fetching', 'Other']); } finally { setIsApiLoading(false); }
  };

  const fetchUniversities = (country) => {
    if (!country) return;
    setModalType('university');
    setIsApiLoading(true);
    fetch("https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json")
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(u => u.country.toLowerCase() === country.toLowerCase()).map(u => u.name).sort();
        setUniversities(filtered.length ? filtered : ['Other']);
      }).finally(() => setIsApiLoading(false));
  };

  const handleSaveProfile = async (newProfile) => {
    const p = newProfile || profile;
    setProfile(p);
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'users', userId), {
        profile: p,
        // Support top-level sync for older components
        occupations: p.occupations,
        workplaces: p.workplaces,
        country: p.country,
        city: p.city
      }, { merge: true });
      await logUserAction(userId, 'PROFILE_UPDATE', 'Updated settings');
      setMsg("Saved Successfully!");
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg("Error."); } finally { setIsLoading(false); }
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
          {['profile', 'categories', 'history'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all capitalize ${activeTab === tab ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{tab}</button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {msg && <span className="text-emerald-600 font-bold text-sm animate-fade-in">{msg}</span>}
          <Button onClick={() => handleSaveProfile()} disabled={isLoading} className="shadow-lg shadow-emerald-200/50 px-10">
            {isLoading ? 'Saving...' : <><Save className="w-5 h-5 mr-2" /> Save Settings</>}
          </Button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-2"><User className="text-emerald-500" /> Identity</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Full Name</label><input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500" /></div>
                <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Birthdate</label><button onClick={() => setShowDatePicker(true)} className="w-full p-4 border rounded-2xl flex justify-between items-center font-bold hover:bg-slate-50 transition-all">{profile.birthdate} <Calendar className="w-5 h-5 text-slate-400" /></button></div>
                <div onClick={() => setModalType('status')} className="cursor-pointer"><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Family Status</label><div className="w-full p-4 border rounded-xl bg-white font-bold flex justify-between items-center">{profile.status || "Select..."} <ChevronRight className="w-4 h-4 text-slate-300" /></div></div>
              </div>

              <div className="space-y-6">
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Work & Career</label>
                <button onClick={() => setModalType('occupation')} className="w-full p-4 border-2 border-dashed rounded-2xl text-slate-400 font-bold hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"><Plus /> Add Title</button>
                <div className="space-y-3">
                  {profile.workplaces.map((w, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-2xl shadow-sm group">
                      <div className="flex items-center gap-3">
                        <LogoImage logo={w.logo} domain={w.domain} />
                        <div><div className="text-sm font-black text-slate-700">{w.name}</div><div className="text-[10px] text-emerald-600 font-bold uppercase">{w.linkedOccupation}</div></div>
                      </div>
                      <button onClick={() => handleSaveProfile({ ...profile, workplaces: profile.workplaces.filter((_, idx) => idx !== i) })} className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 border-t pt-8">
              <div onClick={() => setModalType('country')} className="cursor-pointer group">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Country</label>
                <div className="w-full p-4 border rounded-xl bg-white font-bold group-hover:border-emerald-50 flex justify-between items-center transition-all">{profile.country || "Select..."} <Globe className="text-slate-300" /></div>
              </div>
              <div onClick={() => { if (!profile.country) return alert("Select country first"); fetchCities(profile.country); }} className={`cursor-pointer group ${!profile.country && 'opacity-50 pointer-events-none'}`}>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">City</label>
                <div className="w-full p-4 border rounded-xl bg-white font-bold group-hover:border-emerald-50 flex justify-between items-center transition-all">{profile.city || "Select..."} <MapPin className="text-slate-300" /></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className={profile.isStudent ? 'text-blue-500' : 'text-slate-300'} />
                    <label htmlFor="isStudent" className="font-bold text-slate-700 cursor-pointer">I am a Student</label>
                  </div>
                  <input type="checkbox" id="isStudent" checked={profile.isStudent} onChange={e => handleSaveProfile({ ...profile, isStudent: e.target.checked })} className="w-5 h-5 rounded text-emerald-600" />
                </div>
                {profile.isStudent && (
                  <div onClick={() => { if (!profile.country) return alert("Select country first"); fetchUniversities(profile.country); }} className="cursor-pointer p-4 bg-white border rounded-xl font-bold flex justify-between items-center">
                    {profile.university || 'Select University...'} <ChevronRight className="text-slate-300" />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODALS */}
      <SelectionModal isOpen={modalType === 'country'} title="Select Country" data={countries} selectedValue={profile.country} onSelect={(c) => { const name = c.name || c; handleSaveProfile({ ...profile, country: name, city: '' }); setModalType(null); }} onClose={() => setModalType(null)} />
      <SelectionModal isOpen={modalType === 'city'} title={`Cities in ${profile.country}`} data={cities} isLoading={isApiLoading} selectedValue={profile.city} allowCustom={true} onSelect={(c) => { handleSaveProfile({ ...profile, city: c }); setModalType(null); }} onClose={() => setModalType(null)} />
      <SelectionModal isOpen={modalType === 'university'} title={`Universities in ${profile.country}`} data={universities} isLoading={isApiLoading} selectedValue={profile.university} allowCustom={true} onSelect={(u) => { handleSaveProfile({ ...profile, university: u }); setModalType(null); }} onClose={() => setModalType(null)} />
      <SelectionModal isOpen={modalType === 'status'} title="Select Status" data={STATUS_LIST} selectedValue={profile.status} onSelect={(s) => { handleSaveProfile({ ...profile, status: s }); setModalType(null); }} onClose={() => setModalType(null)} />
      {modalType === 'occupation' && <MultiSelectModal options={OCCUPATIONS_LIST} selectedValues={profile.occupations} onClose={() => setModalType(null)} onConfirm={handleOccupationConfirm} />}

      <WorkplacePickerModal isOpen={!!showWorkplacePicker} occupationName={showWorkplacePicker} onClose={() => setShowWorkplacePicker(null)} onSelect={addWorkplace} />
      <DatePickerModal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} onSave={(v) => handleSaveProfile({ ...profile, birthdate: v })} />

      {activeTab === 'categories' && (
        <Card className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Categories</h2>
            <Button onClick={() => setCatModal({ name: '', color: '#10b981', icon: 'Star', id: null })}><Plus className="w-4 h-4 mr-2" /> New</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[...DEFAULT_CATEGORIES, ...customCategories].map(cat => (
              <div key={cat.id} className="p-4 rounded-2xl border flex items-center justify-between bg-white shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}><CategoryIcon iconName={cat.icon} className="w-5 h-5" color="white" /></div>
                  <span className="font-bold">{cat.name}</span>
                </div>
                {customCategories.some(c => c.id === cat.id) && (
                  <button onClick={async () => {
                    const updated = customCategories.filter(c => c.id !== cat.id);
                    setCustomCategories(updated);
                    await setDoc(doc(db, 'users', userId), { customCategories: updated }, { merge: true });
                  }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">Activity History</h2>
          <div className="space-y-3">
            {history.map(item => (
              <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border flex items-center gap-4 hover:bg-white transition-all">
                <Clock className="text-slate-400" />
                <div><div className="font-bold">{item.description}</div><div className="text-[10px] uppercase text-slate-400 tracking-widest">{item.actionType}</div></div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {catModal && <CategoryEditorModal category={catModal} onClose={() => setCatModal(null)} onSave={async (data) => {
        let updated = data.id ? customCategories.map(c => c.id === data.id ? data : c) : [...customCategories, { ...data, id: Date.now().toString() }];
        setCustomCategories(updated); setCatModal(null);
        await setDoc(doc(db, 'users', userId), { customCategories: updated }, { merge: true });
      }} />}
    </div>
  );
};