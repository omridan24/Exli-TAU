import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  LayoutGrid, Upload, Users, PieChart as PieIcon, Settings,
  ArrowRight, CheckCircle, Activity, Shield, DollarSign, Calendar,
  Trash2, SkipForward, ThumbsUp, Tag, XCircle, Plus, Edit2, Save, X, LogOut, Lock, AlertTriangle, User,
  MapPin, Briefcase, GraduationCap, Globe, Search, Check, Heart, Clock, Sparkles, Cloud, Wallet
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc, writeBatch
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// --- CONFIGURATION ---

// 1. LOCAL DEVELOPMENT (.env)

const CLOUD_RUN_URL = import.meta.env.VITE_CLOUD_RUN_URL;
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};




const app = initializeApp(firebaseConfig);

// --- APP CHECK ---
if (typeof window !== 'undefined') {
  if (location.hostname === "localhost") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    if (RECAPTCHA_SITE_KEY && !RECAPTCHA_SITE_KEY.includes("PASTE_YOUR")) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }
  } catch (e) {
    console.warn("App Check warning:", e);
  }
}

const auth = getAuth(app);
const db = getFirestore(app);

// --- DATA LISTS ---
const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', color: '#f97316' },
  { id: 'groceries', name: 'Groceries', color: '#10b981' },
  { id: 'transport', name: 'Transport', color: '#3b82f6' },
  { id: 'shopping', name: 'Shopping', color: '#8b5cf6' },
  { id: 'housing', name: 'Housing', color: '#eab308' },
  { id: 'health', name: 'Health', color: '#ef4444' },
  { id: 'entertainment', name: 'Entertainment', color: '#ec4899' },
  { id: 'income', name: 'Income', color: '#059669' },
  { id: 'other', name: 'Other', color: '#64748b' }
];

const OCCUPATIONS_LIST = [
  "Software Engineer", "Doctor", "Teacher", "Student", "Designer", "Product Manager",
  "Data Scientist", "Lawyer", "Accountant", "Marketer", "Salesperson", "Consultant",
  "Entrepreneur", "Artist", "Writer", "Nurse", "Architect", "Chef", "Pilot", "Police Officer"
];

const STATUS_LIST = ["Single", "Married", "Divorced", "Widowed", "Partnership"];

// --- SHARED COMPONENTS ---
const Card = ({ children, className = "" }) => (<div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>{children}</div>);
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false }) => {
  const variants = { primary: "bg-emerald-600 text-white hover:bg-emerald-700", secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200", danger: "bg-red-50 text-red-600 hover:bg-red-100", ghost: "bg-transparent text-slate-500 hover:bg-slate-100" };
  return (<button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}>{children}</button>);
};

const ExliLogo = () => (
  <img src="/logo.svg" alt="Exli" className="w-8 h-8 object-contain" />
);

// --- MODALS ---
const SelectionModal = ({ isOpen, onClose, title, data, onSelect, multiSelect = false, selectedItems = [], allowCustom = false }) => {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;

  const allItems = [...data];
  if (multiSelect) {
    selectedItems.forEach(item => {
      const exists = allItems.some(d => (d.name || d) === item);
      if (!exists) allItems.unshift(item);
    });
  }

  const filteredData = allItems.filter(item =>
    (item.name || item).toString().toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (item) => {
    const val = item.name || item;
    if (multiSelect) {
      if (selectedItems.includes(val)) {
        onSelect(selectedItems.filter(i => i !== val));
      } else if (selectedItems.length < 3) {
        onSelect([...selectedItems, val]);
      }
    } else {
      onSelect(item);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div><h3 className="text-xl font-bold text-slate-800">{title}</h3>{multiSelect && <p className="text-xs text-slate-500">Select up to 3</p>}</div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input type="text" placeholder={`Search ${title}...`} className="w-full pl-10 p-3 bg-slate-50 border-none rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allowCustom && search && !filteredData.find(i => (i.name || i).toString().toLowerCase() === search.toLowerCase()) && (
              <div className="col-span-full mb-2">
                <button onClick={() => handleSelect(search)} className="w-full p-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add "{search}"</button>
              </div>
            )}
            {filteredData.length === 0 && !search && <div className="col-span-full text-center py-10 text-slate-400">Loading or No items found...</div>}
            {filteredData.map((item, idx) => {
              const val = item.name || item;
              const isSelected = multiSelect ? selectedItems.includes(val) : selectedItems === val;
              return (
                <button key={idx} onClick={() => handleSelect(item)} className={`p-4 rounded-xl text-left border-2 transition-all group relative flex flex-col justify-between min-h-[100px] ${isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-white bg-white hover:border-emerald-200 hover:shadow-md'}`}>
                  <div className="font-bold text-slate-700 break-words pr-2">{val}</div>
                  {item.flag && <div className="text-3xl mt-2">{item.flag}</div>}
                  {item.icon && <div className="text-emerald-100 group-hover:text-emerald-200 transition-colors mt-auto self-end">{item.icon}</div>}
                  {isSelected && <div className="absolute top-2 right-2 text-emerald-600 bg-white rounded-full p-0.5"><Check className="w-4 h-4" /></div>}
                </button>
              );
            })}
          </div>
        </div>
        {multiSelect && <div className="p-4 border-t border-slate-100 bg-white flex justify-end"><Button onClick={onClose}>Done ({selectedItems.length})</Button></div>}
      </div>
    </div>
  );
};

const InputModal = ({ isOpen, onClose, title, value, onSave, type = "text" }) => {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value, isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
        <input type={type} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-emerald-500 text-lg mb-6" value={val} onChange={e => setVal(e.target.value)} autoFocus />
        <div className="flex gap-2"><Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button><Button onClick={() => { onSave(val); onClose(); }} className="flex-1 justify-center">Save</Button></div>
      </div>
    </div>
  );
};

// --- LOGIN SCREEN ---
const LoginScreen = () => {
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setIsChecking(true);
    setError(null);
    try { await signInWithPopup(auth, provider); } catch (err) { console.error("Auth Error:", err); setError("Login failed. Please try again."); setIsChecking(false); }
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6"><img src="/logo.svg" alt="Exli Logo" className="w-12 h-12" /></div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to Exli</h1>
        <p className="text-slate-500 mb-8">Your personal finance operating system.</p>
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl text-left border border-red-100 flex gap-2"><Lock className="w-4 h-4 mt-0.5 shrink-0" /><span className="break-words">{error}</span></div>}
        <button onClick={handleGoogleLogin} disabled={isChecking} className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 font-bold text-slate-700 disabled:opacity-50">{isChecking ? "Signing in..." : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" /> Continue with Google</>}</button>
      </div>
    </div>
  );
};

// --- ACCESS DENIED SCREEN ---
const AccessDeniedScreen = ({ email, onLogout, onRetry }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center animate-fade-in">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500"><Lock className="w-8 h-8" /></div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
      <p className="text-slate-500 mb-6">Email <span className="font-mono font-bold text-slate-800">{email}</span> is not on the whitelist.</p>
      <div className="flex gap-2"><Button onClick={onRetry} variant="primary" className="flex-1 justify-center">Retry Check</Button><Button onClick={onLogout} variant="secondary" className="flex-1 justify-center">Sign Out</Button></div>
    </div>
  </div>
);

// --- INCOME NODE (NEW) ---
const IncomeNode = ({ userId, onComplete }) => {
  const [step, setStep] = useState(0);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);

  // Income Data State
  const [incomeData, setIncomeData] = useState({
    bruto: '', neto: '', taxes: '', pension: '', other_deposits: ''
  });

  const handleFileChange = (e) => e.target.files[0] && setFile(e.target.files[0]);

  const handleAnalyzeIncome = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured.");
      const response = await fetch(`${CLOUD_RUN_URL}/analyze-income`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);

      const res = await response.json();
      if (res.status === 'success' && res.data) {
        // Auto-fill form with AI data
        setIncomeData({
          bruto: res.data.bruto || '',
          neto: res.data.neto || '',
          taxes: res.data.taxes || '',
          pension: res.data.pension || '',
          other_deposits: res.data.other_deposits || ''
        });
        setStep(2); // Go to review
      } else {
        throw new Error("AI could not extract data.");
      }
    } catch (err) {
      setError(err.message || "Failed to analyze file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save to users/{id}/income collection
      await addDoc(collection(db, 'users', userId, 'income'), {
        ...incomeData,
        month: reportMonth,
        createdAt: serverTimestamp(),
        source: file ? 'ai_scan' : 'manual'
      });
      setStep(3); // Success
    } catch (err) {
      setError("Failed to save income data.");
    } finally {
      setIsLoading(false);
    }
  };

  const IncomeCard = ({ label, field, color, icon: Icon }) => (
    <div className={`p-4 rounded-xl border ${color} bg-white flex flex-col gap-2 transition-all focus-within:ring-2 ring-offset-1`}>
      <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-light">₪</span>
        <input
          type="number"
          value={incomeData[field]}
          onChange={(e) => setIncomeData({ ...incomeData, [field]: parseFloat(e.target.value) || '' })}
          className="w-full pl-6 py-1 text-2xl font-bold text-slate-800 outline-none placeholder:text-slate-200"
          placeholder="0"
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-6 h-6 text-emerald-600" /> Income Manager</h2>
          <p className="text-slate-500 mt-1">Track your earnings and deductions.</p>
        </div>
      </div>

      {step === 0 && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <Calendar className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Select Income Month</h3>
          <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" />
          <Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-8">
          {/* Option A: Upload */}
          <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center relative overflow-hidden group">
            <input type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="pointer-events-none relative z-0">
              <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-emerald-500 group-hover:scale-110 transition-transform">
                {isLoading ? <Sparkles className="w-8 h-8 animate-pulse" /> : <Upload className="w-8 h-8" />}
              </div>
              <h3 className="font-bold text-slate-700">Auto-Fill from Payslip</h3>
              <p className="text-sm text-slate-400 mt-1 mb-4">Upload Image or PDF. We'll extract the numbers.</p>
              <div className="inline-flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
                <Shield className="w-3 h-3" /> Please redact personal ID/Address before uploading.
              </div>
              {file && <div className="mt-4 font-bold text-emerald-600">{file.name}</div>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-400 text-sm font-medium">OR ENTER MANUALLY</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <div className="flex justify-center gap-4">
            {file && (
              <Button onClick={handleAnalyzeIncome} disabled={isLoading}>
                {isLoading ? 'Scanning...' : 'Extract Data'} <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStep(2)}>Skip Upload &rarr;</Button>
          </div>
          {error && <div className="text-red-500 text-center">{error}</div>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IncomeCard label="Bruto Income" field="bruto" color="border-emerald-200 text-emerald-600" icon={DollarSign} />
            <IncomeCard label="Neto (Bank)" field="neto" color="border-blue-200 text-blue-600" icon={Wallet} />
            <IncomeCard label="Total Taxes" field="taxes" color="border-red-200 text-red-600" icon={Activity} />
            <IncomeCard label="Pension" field="pension" color="border-purple-200 text-purple-600" icon={Shield} />
            <IncomeCard label="Other Deposits" field="other_deposits" color="border-orange-200 text-orange-600" icon={Tag} />
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
            <div>
              <div className="text-xs font-bold text-blue-400 uppercase">Calculated Savings Potential</div>
              <div className="text-xl font-bold text-blue-800">
                ₪ {((incomeData.neto || 0) + (incomeData.pension || 0) + (incomeData.other_deposits || 0)).toLocaleString()}
              </div>
            </div>
            <Button onClick={handleSave}>Save Income Report</Button>
          </div>
          <button onClick={() => setStep(1)} className="text-slate-400 text-sm hover:text-slate-600 w-full text-center">Back to Upload</button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Income Saved!</h3>
          <p className="text-slate-500 mb-6">Your financial picture for <b>{reportMonth}</b> is updated.</p>
          <Button onClick={onComplete}>Back to Dashboard</Button>
        </div>
      )}
    </div>
  );
};

// --- APP NODES (ImportNode, AnalyticsNode, SettingsNode) ---
// Note: Keeping ImportNode (Expenses) collapsed for brevity as it is unchanged from previous step.
const ImportNode = ({ userId, categories, expenses, onUpdateCategories, onComplete }) => { const [step, setStep] = useState(0); const [file, setFile] = useState(null); const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState(null); const [headers, setHeaders] = useState([]); const [allRawRows, setAllRawRows] = useState([]); const [columnMapping, setColumnMapping] = useState({ date: '', description: '', amount: '', category: '', currency: '' }); const [currentIndex, setCurrentIndex] = useState(0); const [processedTransactions, setProcessedTransactions] = useState([]); const [isCreatingCat, setIsCreatingCat] = useState(false); const [newCatName, setNewCatName] = useState(''); const sortedCategories = useMemo(() => { if (!expenses || expenses.length === 0) return categories; const usage = {}; expenses.forEach(tx => { const cat = tx.assignedCategory || tx.category || 'Uncategorized'; usage[cat] = (usage[cat] || 0) + 1; }); return [...categories].sort((a, b) => (usage[b.name] || 0) - (usage[a.name] || 0)); }, [categories, expenses]); const handleFileChange = (e) => e.target.files[0] && setFile(e.target.files[0]); const handleUploadAndAnalyze = async () => { if (!file) return; setIsLoading(true); setError(null); const formData = new FormData(); formData.append('file', file); try { if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured."); const response = await fetch(`${CLOUD_RUN_URL}/analyze-file`, { method: 'POST', body: formData }); if (!response.ok) throw new Error(`Server Error: ${response.statusText}`); const data = await response.json(); setHeaders(data.columns); setAllRawRows(data.all_data || []); const suggestions = {}; const findIndex = (name) => data.columns.indexOf(name); if (data.suggested_mapping) { Object.entries(data.suggested_mapping).forEach(([key, val]) => { const idx = findIndex(val); if (idx !== -1) suggestions[key] = idx; }); } setColumnMapping(prev => ({ ...prev, ...suggestions })); setStep(2); } catch (err) { setError(err.message || "Failed to analyze file."); } finally { setIsLoading(false); } }; const startSorting = () => { setStep(3); setCurrentIndex(0); setProcessedTransactions([]); }; const handleQuickAddCategory = async () => { if (!newCatName.trim()) return; const newId = newCatName.toLowerCase().replace(/\s+/g, '_'); const colors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']; const randomColor = colors[Math.floor(Math.random() * colors.length)]; const newCat = { id: newId, name: newCatName, color: randomColor }; const updated = [...categories, newCat]; onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); try { const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'categories', newId); await setDoc(publicRef, { name: newCatName, createdBy: 'community' }, { merge: true }); } catch (e) { console.warn("Could not share to community:", e); } handleCategorize(newCatName); setNewCatName(''); setIsCreatingCat(false); }; const handleCategorize = (categoryName, isRefund = false) => { const rawRow = allRawRows[currentIndex]; let rawAmount = rawRow[columnMapping.amount]; let amount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, "")); if (isNaN(amount)) amount = 0; const currency = rawRow[columnMapping.currency] || "ILS"; const tx = { date: rawRow[columnMapping.date] || new Date().toISOString(), description: rawRow[columnMapping.description] || "Unknown", amount: amount, originalCategory: rawRow[columnMapping.category] || "Uncategorized", currency: currency, assignedCategory: categoryName, reportMonth: reportMonth, isRefund: isRefund, status: 'active' }; setProcessedTransactions(prev => [...prev, tx]); moveToNext(); }; const handleSkip = () => moveToNext(); const moveToNext = () => currentIndex < allRawRows.length - 1 ? setCurrentIndex(prev => prev + 1) : finishImport(); const finishImport = async () => { setIsLoading(true); try { const expensesRef = collection(db, 'users', userId, 'expenses'); await Promise.all(processedTransactions.map(tx => addDoc(expensesRef, { ...tx, source: "smart_import", createdAt: serverTimestamp() }))); setStep(4); } catch (err) { setError("Failed to save transactions."); } finally { setIsLoading(false); } }; const currentRaw = allRawRows[currentIndex]; const displayData = currentRaw ? { date: currentRaw[columnMapping.date], desc: currentRaw[columnMapping.description], amount: currentRaw[columnMapping.amount], cat: currentRaw[columnMapping.category], curr: currentRaw[columnMapping.currency] || '' } : {}; const suggestedCategoryId = useMemo(() => { if (!displayData.cat) return null; const cleanCat = String(displayData.cat).toLowerCase(); const match = categories.find(c => cleanCat.includes(c.id) || cleanCat.includes(c.name.toLowerCase())); return match ? match.id : null; }, [displayData.cat, categories]); return (<div className="p-6 max-w-4xl mx-auto animate-fade-in"><div className="flex items-center justify-between mb-8"><div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> Smart Importer</h2><p className="text-slate-500 mt-1">{step === 3 ? `Reviewing item ${currentIndex + 1} of ${allRawRows.length}` : "Upload bank files."}</p></div></div>{step === 0 && (<div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center"><Calendar className="w-12 h-12 text-emerald-500 mx-auto mb-4" /><h3 className="text-lg font-bold text-slate-800 mb-2">Select Report Month</h3><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" /><Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button></div>)}{step === 1 && (<div className="space-y-6"><div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors relative"><input type="file" accept=".csv, .xls, .xlsx" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><div className="pointer-events-none"><Upload className={`w-12 h-12 mx-auto mb-4 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />{file ? <div><div className="font-bold text-lg text-slate-800">{file.name}</div></div> : <div><div className="font-bold text-lg text-slate-600">Click or Drag file here</div></div>}</div></div>{error && <div className="text-red-600 text-center">{error}</div>}<div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(0)}>Back</Button><Button onClick={handleUploadAndAnalyze} disabled={!file || isLoading}>{isLoading ? <><Sparkles className="w-4 h-4 animate-spin text-yellow-400" /> Analyzing with AI...</> : 'Upload & Analyze'} <ArrowRight className="w-4 h-4" /></Button></div></div>)}{step === 2 && (<div className="space-y-6"><div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4"><h3 className="font-bold text-blue-800">Verify Columns</h3></div><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (<div key={field}><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label><select className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none" onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.toLowerCase()]: parseInt(e.target.value) }))} value={columnMapping[field.toLowerCase()] ?? ""}><option value="">Select Column...</option>{headers.map((header, idx) => (<option key={idx} value={idx}>{header}</option>))}</select></div>))}</div><div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={startSorting}>Start Sorting &rarr;</Button></div></div>)}{step === 3 && currentRaw && (<div className="max-w-2xl mx-auto"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8"><div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start"><div><h3 className="text-xl font-bold text-slate-800">{displayData.desc}</h3><div className="text-sm text-slate-500 mt-1">{displayData.date}</div></div><div className="text-right"><div className="text-3xl font-mono font-bold text-slate-800">{displayData.amount} <span className="text-lg text-slate-400">{displayData.curr}</span></div>{displayData.cat && (<div className="inline-block mt-2 px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">File: {displayData.cat}</div>)}</div></div><div className="p-6">{isCreatingCat ? (<div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-700 mb-2 text-sm">New Category Name</h4><div className="flex gap-2"><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-2 border border-slate-300 rounded-lg outline-none" placeholder="e.g. Pet Supplies" autoFocus /><Button onClick={handleQuickAddCategory} disabled={!newCatName}>Add</Button><Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button></div></div>) : (<div className="grid grid-cols-3 gap-3 mb-6">{sortedCategories.map(cat => { const isSuggested = suggestedCategoryId === cat.id; return (<button key={cat.id} onClick={() => handleCategorize(cat.name)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isSuggested ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className={`text-xs font-bold ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span></button>); })}<button onClick={() => setIsCreatingCat(true)} className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-slate-400 hover:text-emerald-600"><Plus className="w-6 h-6" /><span className="text-xs font-bold">New Cat</span></button></div>)}<div className="flex items-center justify-between border-t border-slate-100 pt-6"><button onClick={handleSkip} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors px-4 py-2"><Trash2 className="w-5 h-5" /> Skip</button><button onClick={() => handleCategorize('Refunded', true)} className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors px-4 py-2"><XCircle className="w-5 h-5" /> Mark Refunded</button></div></div></div></div>)}{step === 4 && (<div className="text-center py-12"><CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-slate-800 mb-2">Import Complete!</h3><Button onClick={onComplete}>Go to Dashboard</Button></div>)}</div>); };

// --- ANALYTICS & SETTINGS (Condensed) ---
const AnalyticsNode = ({ data, categories, userId }) => { const [selectedMonth, setSelectedMonth] = useState('average'); const dominantCurrency = useMemo(() => { if (!data.length) return '$'; const counts = {}; data.forEach(d => { const c = d.currency || 'ILS'; counts[c] = (counts[c] || 0) + 1; }); return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b); }, [data]); const availableMonths = useMemo(() => { const months = new Set(data.map(d => d.reportMonth).filter(Boolean)); return Array.from(months).sort().reverse(); }, [data]); const filteredData = useMemo(() => selectedMonth === 'average' ? data : data.filter(d => d.reportMonth === selectedMonth), [data, selectedMonth]); const categoryStats = useMemo(() => { const agg = {}; filteredData.forEach(item => { if (item.isRefund) return; const cat = item.assignedCategory || 'Uncategorized'; agg[cat] = (agg[cat] || 0) + Number(item.amount); }); if (selectedMonth === 'average' && availableMonths.length > 0) { Object.keys(agg).forEach(key => agg[key] = agg[key] / availableMonths.length); } return Object.keys(agg).map(key => ({ name: key, value: agg[key], color: categories.find(c => c.name === key)?.color || '#64748b' })).sort((a, b) => b.value - a.value); }, [filteredData, selectedMonth, availableMonths, categories]); const handleDelete = async (docId) => { if (confirm('Delete?')) await deleteDoc(doc(db, 'users', userId, 'expenses', docId)); }; const handleCategoryChange = async (docId, newCat) => { await updateDoc(doc(db, 'users', userId, 'expenses', docId), { assignedCategory: newCat }); }; const handleDeleteMonth = async () => { if (selectedMonth === 'average') return; if (!confirm(`Are you sure?`)) return; try { const batch = writeBatch(db); filteredData.forEach(tx => { const ref = doc(db, 'users', userId, 'expenses', tx.id); batch.delete(ref); }); await batch.commit(); setSelectedMonth('average'); } catch (error) { console.error("Error:", error); } }; return (<div className="p-6 animate-fade-in"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><PieIcon className="w-6 h-6 text-blue-600" /> {selectedMonth === 'average' ? 'All-Time Averages' : `Report: ${selectedMonth}`}</h2><div className="flex items-center gap-2 overflow-x-auto pb-2"><button onClick={() => setSelectedMonth('average')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === 'average' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📊 Averages</button>{availableMonths.map(m => (<button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{m}</button>))}</div></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12"><Card className="p-6"><h3 className="font-bold text-slate-700 mb-4">Spending Breakdown</h3><div className="h-64"><ResponsiveContainer><PieChart><Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>{categoryStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(val) => `${dominantCurrency} ${val.toFixed(0)}`} /><Legend /></PieChart></ResponsiveContainer></div></Card><Card className="p-6"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Summary</h3>{selectedMonth !== 'average' && (<button onClick={handleDeleteMonth} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /> Delete Month</button>)}</div><div className="space-y-3">{categoryStats.map(stat => (<div key={stat.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div><span className="font-medium text-slate-700">{stat.name}</span></div><div className="font-mono font-bold text-slate-800">{dominantCurrency} {stat.value.toFixed(2)}</div></div>))}</div></Card></div>{selectedMonth !== 'average' && (<div className="mt-8"><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Transactions for {selectedMonth}</h3><div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4">Amount</th><th className="p-4">Category</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredData.map(tx => (<tr key={tx.id} className="hover:bg-slate-50 group"><td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td><td className="p-4 font-medium text-slate-800">{tx.description}</td><td className="p-4 font-mono font-bold text-slate-700">{tx.currency || dominantCurrency} {tx.amount.toFixed(2)}</td><td className="p-4"><select className="bg-transparent border-none text-slate-600 font-medium cursor-pointer hover:text-emerald-600" value={tx.assignedCategory} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td><td className="p-4 text-right"><button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div></div>)}</div>); };
const SettingsNode = ({ userId, categories, onUpdateCategories }) => { const [newCatName, setNewCatName] = useState(''); const [newCatColor, setNewCatColor] = useState('#000000'); const [communityCats, setCommunityCats] = useState([]); const [modalType, setModalType] = useState(null); const [profile, setProfile] = useState({ age: '', status: 'Single', city: '', country: '', isStudent: false, occupation: [], university: '' }); const [isSavingProfile, setIsSavingProfile] = useState(false); const [countries, setCountries] = useState([]); const [cities, setCities] = useState([]); const [universities, setUniversities] = useState([]); useEffect(() => { const loadProfile = async () => { const snap = await getDoc(doc(db, 'users', userId)); if (snap.exists() && snap.data().profile) { setProfile(prev => ({ ...prev, ...snap.data().profile })); } }; loadProfile(); }, [userId]); useEffect(() => { fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags').then(res => res.json()).then(data => { const formatted = data.map(c => ({ name: c.name.common, code: c.cca2, flag: c.flags.svg ? <img src={c.flags.svg} className="w-6 h-4 object-cover" /> : c.cca2 })).sort((a, b) => a.name.localeCompare(b.name)); setCountries(formatted); }).catch(err => console.error(err)); }, []); useEffect(() => { if (modalType === 'community_cat') { const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'categories')); onSnapshot(q, snap => { const list = snap.docs.map(d => d.data().name).sort(); setCommunityCats([...new Set(list)]); }); } }, [modalType]); const fetchCities = async (countryName) => { if (!countryName) return; setModalType('city'); setCities([]); setCities(['Loading...']); try { const response = await fetch("https://countriesnow.space/api/v0.1/countries/cities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: countryName }) }); const data = await response.json(); if (!data.error) { setCities(data.data); } else { setCities(['No cities found', 'Other']); } } catch (err) { setCities(['Error fetching cities', 'Other']); } }; const fetchUniversities = (country) => { if (!country) return; setModalType('university'); setUniversities(['Loading...']); if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) { setUniversities(['Error: Backend not connected', 'Other']); return; } fetch(`${CLOUD_RUN_URL}/get-universities?country=${encodeURIComponent(country)}`).then(res => res.json()).then(data => { if (!data || data.length === 0) { setUniversities(['No universities found', 'Other']); } else { setUniversities(data); } }).catch(err => { setUniversities(['Error fetching universities', 'Other']); }); }; const handleSaveProfile = async (newProfile) => { const p = newProfile || profile; setProfile(p); setIsSavingProfile(true); try { await setDoc(doc(db, 'users', userId), { profile: p }, { merge: true }); } catch (error) { console.error(error); } finally { setIsSavingProfile(false); } }; const handleAdd = async (nameInput) => { const name = nameInput || newCatName; if (!name) return; const newId = name.toLowerCase().replace(/\s+/g, '_'); const newCat = { id: newId, name: name, color: newCatColor }; const updated = [...categories, newCat]; onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); try { const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'categories', newId); await setDoc(publicRef, { name: name, createdBy: 'community' }, { merge: true }); } catch (e) { console.warn("Could not share:", e); } setNewCatName(''); if (modalType === 'community_cat') setModalType(null); }; const handleRemove = async (catId) => { const updated = categories.filter(c => c.id !== catId); onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); }; const ProfileItem = ({ icon: Icon, label, value, onClick }) => (<div onClick={onClick} className="p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors"><Icon className="w-5 h-5" /></div><div><div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div><div className="font-semibold text-slate-800 text-lg">{Array.isArray(value) ? (value.length > 0 ? value.join(", ") : "Select...") : (value || "Select...")}</div></div></div><ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 -ml-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-2" /></div>); return (<div className="p-6 animate-fade-in max-w-4xl mx-auto space-y-8"><SelectionModal isOpen={modalType === 'country'} onClose={() => setModalType(null)} title="Select Country" data={countries} onSelect={(c) => { const countryName = c.name || c; const newP = { ...profile, country: countryName, city: '' }; handleSaveProfile(newP); }} /><SelectionModal isOpen={modalType === 'city'} onClose={() => setModalType(null)} title={`Select City in ${profile.country}`} data={cities} allowCustom={true} onSelect={(c) => handleSaveProfile({ ...profile, city: c })} /><SelectionModal isOpen={modalType === 'occupation'} onClose={() => setModalType(null)} title="Select Occupation (Max 3)" data={OCCUPATIONS_LIST} multiSelect allowCustom={true} selectedItems={profile.occupation} onSelect={(newOccupations) => handleSaveProfile({ ...profile, occupation: newOccupations })} /><SelectionModal isOpen={modalType === 'university'} onClose={() => setModalType(null)} title={`Universities in ${profile.country}`} data={universities} allowCustom={true} onSelect={(u) => handleSaveProfile({ ...profile, university: u })} /><InputModal isOpen={modalType === 'age'} onClose={() => setModalType(null)} title="Your Age" value={profile.age} type="number" onSave={(val) => handleSaveProfile({ ...profile, age: val })} /><SelectionModal isOpen={modalType === 'status'} onClose={() => setModalType(null)} title="Relationship Status" data={STATUS_LIST} selectedItems={profile.status} onSelect={(s) => handleSaveProfile({ ...profile, status: s })} /><SelectionModal isOpen={modalType === 'community_cat'} onClose={() => setModalType(null)} title="Community Categories" data={communityCats} allowCustom={true} onSelect={(name) => handleAdd(name)} /><div><h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><User className="w-8 h-8 text-emerald-500" /> My Profile</h2><p className="text-slate-500 mt-1">Manage your identity for better financial benchmarks.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ProfileItem icon={Globe} label="Country" value={profile.country} onClick={() => setModalType('country')} /><ProfileItem icon={MapPin} label="City" value={profile.city} onClick={() => { if (!profile.country) return alert("Please select a country first."); fetchCities(profile.country); }} /><ProfileItem icon={Briefcase} label="Occupation" value={profile.occupation} onClick={() => setModalType('occupation')} /><ProfileItem icon={Clock} label="Age" value={profile.age} onClick={() => setModalType('age')} /><ProfileItem icon={Heart} label="Status" value={profile.status} onClick={() => setModalType('status')} /><div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-center gap-3"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${profile.isStudent ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}><GraduationCap className="w-5 h-5" /></div><div><div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Student Status</div><div className="text-sm font-medium text-slate-700">{profile.isStudent ? 'Active Student' : 'Not a Student'}</div></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={profile.isStudent} onChange={(e) => { const isStudent = e.target.checked; handleSaveProfile({ ...profile, isStudent }); if (isStudent && profile.country) fetchUniversities(profile.country); }} className="sr-only peer" /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div></label></div>{profile.isStudent && (<div onClick={() => { if (!profile.country) return alert("Select country first"); fetchUniversities(profile.country); }} className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-between"><span className="text-sm font-bold text-blue-700">{profile.university || "Select University..."}</span><Edit2 className="w-4 h-4 text-blue-400" /></div>)}</div></div><div className="mt-8 pt-8 border-t border-slate-200"><h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-600" /> Transaction Categories</h2><div className="flex gap-2 mb-4"><Button onClick={() => setModalType('community_cat')} variant="secondary" className="flex items-center gap-2"><Cloud className="w-4 h-4" /> Browse Community</Button><div className="w-px bg-slate-200 mx-2"></div><input type="text" placeholder="Custom Name" className="flex-1 p-3 border border-slate-300 rounded-xl outline-none" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} /><input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="w-12 h-12 p-1 rounded-xl border border-slate-300 cursor-pointer" /><Button onClick={() => handleAdd(null)}><Plus className="w-5 h-5" /></Button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{categories.map(cat => (<div key={cat.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm group"><div className="flex items-center gap-3 overflow-hidden"><div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></div><span className="font-bold text-slate-700 truncate text-sm">{cat.name}</span></div><button onClick={() => handleRemove(cat.id)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button></div>))}</div></div></div>); };

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeNode, setActiveNode] = useState('dashboard');
  const [isWhitelisted, setIsWhitelisted] = useState(null);
  const [debugStatus, setDebugStatus] = useState({ status: 'Initializing...', email: null, error: null });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setDebugStatus({ status: 'Checking whitelist...', email: u.email, error: null });
        try {
          const ref = doc(db, 'whitelist', u.email);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setDebugStatus({ status: 'Allowed', email: u.email, error: null });
            setIsWhitelisted(true);
          } else {
            setDebugStatus({ status: 'Denied', email: u.email, error: 'Document not found in whitelist' });
            setIsWhitelisted(false);
          }
        } catch (e) {
          setDebugStatus({ status: 'Error', email: u.email, error: e.message });
          setIsWhitelisted(false);
        }
      } else {
        setIsWhitelisted(null);
        setDebugStatus({ status: 'Logged Out', email: null, error: null });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isWhitelisted) return;
    const q = query(collection(db, 'users', user.uid, 'expenses'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user, isWhitelisted]);

  useEffect(() => {
    if (!user || !isWhitelisted) return;
    const loadCats = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists() && snap.data().customCategories) {
        setCategories([...DEFAULT_CATEGORIES, ...snap.data().customCategories]);
      }
    };
    loadCats();
  }, [user, isWhitelisted]);

  if (!user) return <LoginScreen debugStatus={debugStatus} />;

  if (isWhitelisted === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Verifying access permissions...</div>;
  }

  if (isWhitelisted === false) {
    return <AccessDeniedScreen email={user.email} onLogout={() => signOut(auth)} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="font-bold text-2xl text-emerald-600 flex gap-2 cursor-pointer" onClick={() => setActiveNode('dashboard')}><ExliLogo /> Exli</div>
        <div className="flex items-center gap-4"><div className="text-xs text-slate-400 font-mono">{user.email}</div><button onClick={() => signOut(auth)} className="text-slate-400 hover:text-slate-600"><LogOut className="w-5 h-5" /></button></div>
      </header>
      <main className="max-w-6xl mx-auto p-6">
        {activeNode === 'dashboard' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            <button onClick={() => setActiveNode('import')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-left group transition-all"><div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform"><Upload /></div><h3 className="font-bold text-lg text-slate-800">Smart Importer</h3><p className="text-slate-500 text-sm mt-1">Upload files, categorize row-by-row.</p></button>
            <button onClick={() => setActiveNode('income')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-left group transition-all"><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform"><Wallet /></div><h3 className="font-bold text-lg text-slate-800">Income Manager</h3><p className="text-slate-500 text-sm mt-1">Track monthly earnings & payslips.</p></button>
            <button onClick={() => setActiveNode('analytics')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-left group transition-all"><div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform"><PieIcon /></div><h3 className="font-bold text-lg text-slate-800">Analytics</h3><p className="text-slate-500 text-sm mt-1">View spending breakdown.</p></button>
            <button onClick={() => setActiveNode('settings')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-left group transition-all"><div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 mb-4 group-hover:scale-110 transition-transform"><Settings /></div><h3 className="font-bold text-lg text-slate-800">Settings</h3><p className="text-slate-500 text-sm mt-1">Manage categories & prefs.</p></button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl min-h-[600px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><button onClick={() => setActiveNode('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium"><ArrowRight className="rotate-180 w-4 h-4" /> Back to Dashboard</button></div>
            <div className="flex-1 overflow-y-auto">
              {activeNode === 'import' && <ImportNode userId={user?.uid} categories={categories} expenses={expenses} onUpdateCategories={setCategories} onComplete={() => setActiveNode('analytics')} />}
              {activeNode === 'income' && <IncomeNode userId={user?.uid} onComplete={() => setActiveNode('dashboard')} />}
              {activeNode === 'analytics' && <AnalyticsNode data={expenses} categories={categories} userId={user?.uid} />}
              {activeNode === 'settings' && <SettingsNode userId={user?.uid} categories={categories} onUpdateCategories={setCategories} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}