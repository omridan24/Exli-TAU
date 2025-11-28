import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  LayoutGrid, Upload, Users, PieChart as PieIcon, Settings,
  ArrowRight, CheckCircle, Activity, Shield, DollarSign, Calendar,
  Trash2, SkipForward, ThumbsUp, Tag, XCircle, Plus, Edit2, Save, X, LogOut, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc
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

// --- DEFAULT DATA ---
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

// --- SHARED COMPONENTS ---
const Card = ({ children, className = "" }) => (<div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>{children}</div>);
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false }) => {
  const variants = { primary: "bg-emerald-600 text-white hover:bg-emerald-700", secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200", danger: "bg-red-50 text-red-600 hover:bg-red-100", ghost: "bg-transparent text-slate-500 hover:bg-slate-100" };
  return (<button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}>{children}</button>);
};

// --- LOGO COMPONENT ---
const ExliLogo = () => (
  <img src="/logo.svg" alt="Exli" className="w-8 h-8 object-contain" />
);

// --- LOGIN SCREEN (Clean) ---
const LoginScreen = () => {
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setIsChecking(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Auth Error:", err);
      setError("Login failed. Please try again.");
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <img src="/logo.svg" alt="Exli Logo" className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to Exli</h1>
        <p className="text-slate-500 mb-8">Your personal finance operating system.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl text-left border border-red-100 flex gap-2">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <button onClick={handleGoogleLogin} disabled={isChecking} className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 font-bold text-slate-700 disabled:opacity-50">
          {isChecking ? "Signing in..." : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" /> Continue with Google</>}
        </button>
      </div>
    </div>
  );
};

// --- ACCESS DENIED SCREEN ---
const AccessDeniedScreen = ({ email, onLogout, onRetry }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center animate-fade-in">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
      <p className="text-slate-500 mb-6">Email <span className="font-mono font-bold text-slate-800">{email}</span> is not on the whitelist.</p>
      <div className="flex gap-2">
        <Button onClick={onRetry} variant="primary" className="flex-1 justify-center">Retry Check</Button>
        <Button onClick={onLogout} variant="secondary" className="flex-1 justify-center">Sign Out</Button>
      </div>
    </div>
  </div>
);

// --- APP NODES (ImportNode, AnalyticsNode, SettingsNode) ---
// Kept condensed for brevity, logic matches previous functional versions
const ImportNode = ({ userId, categories, onUpdateCategories, onComplete }) => { const [step, setStep] = useState(0); const [file, setFile] = useState(null); const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState(null); const [headers, setHeaders] = useState([]); const [allRawRows, setAllRawRows] = useState([]); const [columnMapping, setColumnMapping] = useState({ date: '', description: '', amount: '', category: '', currency: '' }); const [currentIndex, setCurrentIndex] = useState(0); const [processedTransactions, setProcessedTransactions] = useState([]); const [isCreatingCat, setIsCreatingCat] = useState(false); const [newCatName, setNewCatName] = useState(''); const handleFileChange = (e) => e.target.files[0] && setFile(e.target.files[0]); const handleUploadAndAnalyze = async () => { if (!file) return; setIsLoading(true); setError(null); const formData = new FormData(); formData.append('file', file); try { if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured."); const response = await fetch(`${CLOUD_RUN_URL}/analyze-file`, { method: 'POST', body: formData }); if (!response.ok) throw new Error(`Server Error: ${response.statusText}`); const data = await response.json(); setHeaders(data.columns); setAllRawRows(data.all_data || []); const suggestions = {}; const findIndex = (name) => data.columns.indexOf(name); if (data.suggested_mapping) { Object.entries(data.suggested_mapping).forEach(([key, val]) => { const idx = findIndex(val); if (idx !== -1) suggestions[key] = idx; }); } setColumnMapping(prev => ({ ...prev, ...suggestions })); setStep(2); } catch (err) { setError(err.message || "Failed to analyze file."); } finally { setIsLoading(false); } }; const startSorting = () => { setStep(3); setCurrentIndex(0); setProcessedTransactions([]); }; const handleQuickAddCategory = async () => { if (!newCatName.trim()) return; const newId = newCatName.toLowerCase().replace(/\s+/g, '_'); const colors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']; const randomColor = colors[Math.floor(Math.random() * colors.length)]; const newCat = { id: newId, name: newCatName, color: randomColor }; const updated = [...categories, newCat]; onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); handleCategorize(newCatName); setNewCatName(''); setIsCreatingCat(false); }; const handleCategorize = (categoryName, isRefund = false) => { const rawRow = allRawRows[currentIndex]; let rawAmount = rawRow[columnMapping.amount]; let amount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, "")); if (isNaN(amount)) amount = 0; const tx = { date: rawRow[columnMapping.date] || new Date().toISOString(), description: rawRow[columnMapping.description] || "Unknown", amount: amount, originalCategory: rawRow[columnMapping.category] || "Uncategorized", currency: rawRow[columnMapping.currency] || "ILS", assignedCategory: categoryName, reportMonth: reportMonth, isRefund: isRefund, status: 'active' }; setProcessedTransactions(prev => [...prev, tx]); moveToNext(); }; const handleSkip = () => moveToNext(); const moveToNext = () => currentIndex < allRawRows.length - 1 ? setCurrentIndex(prev => prev + 1) : finishImport(); const finishImport = async () => { setIsLoading(true); try { const expensesRef = collection(db, 'users', userId, 'expenses'); await Promise.all(processedTransactions.map(tx => addDoc(expensesRef, { ...tx, source: "smart_import", createdAt: serverTimestamp() }))); setStep(4); } catch (err) { setError("Failed to save transactions."); } finally { setIsLoading(false); } }; const currentRaw = allRawRows[currentIndex]; const displayData = currentRaw ? { date: currentRaw[columnMapping.date], desc: currentRaw[columnMapping.description], amount: currentRaw[columnMapping.amount], cat: currentRaw[columnMapping.category], curr: currentRaw[columnMapping.currency] || '' } : {}; const suggestedCategoryId = useMemo(() => { if (!displayData.cat) return null; const cleanCat = String(displayData.cat).toLowerCase(); const match = categories.find(c => cleanCat.includes(c.id) || cleanCat.includes(c.name.toLowerCase())); return match ? match.id : null; }, [displayData.cat, categories]); return (<div className="p-6 max-w-4xl mx-auto animate-fade-in"><div className="flex items-center justify-between mb-8"><div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> Smart Importer</h2><p className="text-slate-500 mt-1">{step === 3 ? `Reviewing item ${currentIndex + 1} of ${allRawRows.length}` : "Upload bank files."}</p></div></div>{step === 0 && (<div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center"><Calendar className="w-12 h-12 text-emerald-500 mx-auto mb-4" /><h3 className="text-lg font-bold text-slate-800 mb-2">Select Report Month</h3><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" /><Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button></div>)}{step === 1 && (<div className="space-y-6"><div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors relative"><input type="file" accept=".csv, .xls, .xlsx" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><div className="pointer-events-none"><Upload className={`w-12 h-12 mx-auto mb-4 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />{file ? <div><div className="font-bold text-lg text-slate-800">{file.name}</div></div> : <div><div className="font-bold text-lg text-slate-600">Click or Drag file here</div></div>}</div></div>{error && <div className="text-red-600 text-center">{error}</div>}<div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(0)}>Back</Button><Button onClick={handleUploadAndAnalyze} disabled={!file || isLoading}>{isLoading ? 'Analyzing...' : 'Upload & Analyze'} <ArrowRight className="w-4 h-4" /></Button></div></div>)}{step === 2 && (<div className="space-y-6"><div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4"><h3 className="font-bold text-blue-800">Verify Columns</h3></div><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (<div key={field}><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label><select className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none" onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.toLowerCase()]: parseInt(e.target.value) }))} value={columnMapping[field.toLowerCase()] ?? ""}><option value="">Select Column...</option>{headers.map((header, idx) => (<option key={idx} value={idx}>{header}</option>))}</select></div>))}</div><div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={startSorting}>Start Sorting &rarr;</Button></div></div>)}{step === 3 && currentRaw && (<div className="max-w-2xl mx-auto"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8"><div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start"><div><h3 className="text-xl font-bold text-slate-800">{displayData.desc}</h3><div className="text-sm text-slate-500 mt-1">{displayData.date}</div></div><div className="text-right"><div className="text-3xl font-mono font-bold text-slate-800">{displayData.amount} <span className="text-lg text-slate-400">{displayData.curr}</span></div>{displayData.cat && (<div className="inline-block mt-2 px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">File: {displayData.cat}</div>)}</div></div><div className="p-6">{isCreatingCat ? (<div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-700 mb-2 text-sm">New Category Name</h4><div className="flex gap-2"><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-2 border border-slate-300 rounded-lg outline-none" placeholder="e.g. Pet Supplies" autoFocus /><Button onClick={handleQuickAddCategory} disabled={!newCatName}>Add</Button><Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button></div></div>) : (<div className="grid grid-cols-3 gap-3 mb-6">{categories.map(cat => { const isSuggested = suggestedCategoryId === cat.id; return (<button key={cat.id} onClick={() => handleCategorize(cat.name)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isSuggested ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className={`text-xs font-bold ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span></button>); })}<button onClick={() => setIsCreatingCat(true)} className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-slate-400 hover:text-emerald-600"><Plus className="w-6 h-6" /><span className="text-xs font-bold">New Cat</span></button></div>)}<div className="flex items-center justify-between border-t border-slate-100 pt-6"><button onClick={handleSkip} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors px-4 py-2"><Trash2 className="w-5 h-5" /> Skip</button><button onClick={() => handleCategorize('Refunded', true)} className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors px-4 py-2"><XCircle className="w-5 h-5" /> Mark Refunded</button></div></div></div></div>)}{step === 4 && (<div className="text-center py-12"><CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-slate-800 mb-2">Import Complete!</h3><Button onClick={onComplete}>Go to Dashboard</Button></div>)}</div>); };
const AnalyticsNode = ({ data, categories, userId }) => { const [selectedMonth, setSelectedMonth] = useState('average'); const availableMonths = useMemo(() => { const months = new Set(data.map(d => d.reportMonth).filter(Boolean)); return Array.from(months).sort().reverse(); }, [data]); const filteredData = useMemo(() => selectedMonth === 'average' ? data : data.filter(d => d.reportMonth === selectedMonth), [data, selectedMonth]); const categoryStats = useMemo(() => { const agg = {}; filteredData.forEach(item => { if (item.isRefund) return; const cat = item.assignedCategory || 'Uncategorized'; agg[cat] = (agg[cat] || 0) + Number(item.amount); }); if (selectedMonth === 'average' && availableMonths.length > 0) { Object.keys(agg).forEach(key => agg[key] = agg[key] / availableMonths.length); } return Object.keys(agg).map(key => ({ name: key, value: agg[key], color: categories.find(c => c.name === key)?.color || '#64748b' })).sort((a, b) => b.value - a.value); }, [filteredData, selectedMonth, availableMonths, categories]); const handleDelete = async (docId) => { if (confirm('Delete?')) await deleteDoc(doc(db, 'users', userId, 'expenses', docId)); }; const handleCategoryChange = async (docId, newCat) => { await updateDoc(doc(db, 'users', userId, 'expenses', docId), { assignedCategory: newCat }); }; return (<div className="p-6 animate-fade-in"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><PieIcon className="w-6 h-6 text-blue-600" /> {selectedMonth === 'average' ? 'All-Time Averages' : `Report: ${selectedMonth}`}</h2><div className="flex items-center gap-2 overflow-x-auto pb-2"><button onClick={() => setSelectedMonth('average')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === 'average' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📊 Averages</button>{availableMonths.map(m => (<button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{m}</button>))}</div></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12"><Card className="p-6"><h3 className="font-bold text-slate-700 mb-4">Spending Breakdown</h3><div className="h-64"><ResponsiveContainer><PieChart><Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>{categoryStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(val) => `$${val.toFixed(0)}`} /><Legend /></PieChart></ResponsiveContainer></div></Card><Card className="p-6"><h3 className="font-bold text-slate-700 mb-4">Summary</h3><div className="space-y-3">{categoryStats.map(stat => (<div key={stat.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div><span className="font-medium text-slate-700">{stat.name}</span></div><div className="font-mono font-bold text-slate-800">${stat.value.toFixed(2)}</div></div>))}</div></Card></div>{selectedMonth !== 'average' && (<div className="mt-8"><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Transactions for {selectedMonth}</h3><div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4">Amount</th><th className="p-4">Category</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredData.map(tx => (<tr key={tx.id} className="hover:bg-slate-50 group"><td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td><td className="p-4 font-medium text-slate-800">{tx.description}</td><td className="p-4 font-mono font-bold text-slate-700">${tx.amount.toFixed(2)}</td><td className="p-4"><select className="bg-transparent border-none text-slate-600 font-medium cursor-pointer hover:text-emerald-600" value={tx.assignedCategory} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td><td className="p-4 text-right"><button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div></div>)}</div>); };
const SettingsNode = ({ userId, categories, onUpdateCategories }) => { const [newCatName, setNewCatName] = useState(''); const [newCatColor, setNewCatColor] = useState('#000000'); const handleAdd = async () => { if (!newCatName) return; const newId = newCatName.toLowerCase().replace(/\s+/g, '_'); const newCat = { id: newId, name: newCatName, color: newCatColor }; const updated = [...categories, newCat]; onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); setNewCatName(''); }; const handleRemove = async (catId) => { const updated = categories.filter(c => c.id !== catId); onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); }; return (<div className="p-6 animate-fade-in max-w-2xl mx-auto"><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-600" /> Category Manager</h2><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8"><h3 className="font-bold text-slate-700 mb-4">Add New Category</h3><div className="flex gap-4"><input type="text" placeholder="Category Name" className="flex-1 p-3 border border-slate-300 rounded-xl outline-none" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} /><input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="w-12 h-12 p-1 rounded-xl border border-slate-300 cursor-pointer" /><Button onClick={handleAdd}><Plus className="w-5 h-5" /></Button></div></div><div className="space-y-2">{categories.map(cat => (<div key={cat.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm"><div className="flex items-center gap-4"><div className="w-6 h-6 rounded-full border border-slate-100 shadow-sm" style={{ backgroundColor: cat.color }}></div><span className="font-bold text-slate-700">{cat.name}</span></div><button onClick={() => handleRemove(cat.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2"><Trash2 className="w-5 h-5" /></button></div>))}</div></div>); };
const SocialNode = () => <div className="p-12 text-center text-slate-400">Community Benchmarks Coming Soon</div>;

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
          console.log("Checking whitelist for:", u.email);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            setDebugStatus({ status: 'Allowed', email: u.email, error: null });
            setIsWhitelisted(true);
          } else {
            console.warn("Whitelist check failed: Doc does not exist");
            setDebugStatus({ status: 'Denied', email: u.email, error: 'Document not found in whitelist' });
            setIsWhitelisted(false);
          }
        } catch (e) {
          console.error("Whitelist check error:", e);
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

  if (!user) return <LoginScreen />;

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
            <button onClick={() => setActiveNode('analytics')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-left group transition-all"><div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform"><PieIcon /></div><h3 className="font-bold text-lg text-slate-800">Analytics</h3><p className="text-slate-500 text-sm mt-1">View spending breakdown.</p></button>
            <button onClick={() => setActiveNode('settings')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-left group transition-all"><div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 mb-4 group-hover:scale-110 transition-transform"><Settings /></div><h3 className="font-bold text-lg text-slate-800">Settings</h3><p className="text-slate-500 text-sm mt-1">Manage categories & prefs.</p></button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl min-h-[600px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><button onClick={() => setActiveNode('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium"><ArrowRight className="rotate-180 w-4 h-4" /> Back to Dashboard</button></div>
            <div className="flex-1 overflow-y-auto">
              {activeNode === 'import' && <ImportNode userId={user?.uid} categories={categories} onUpdateCategories={setCategories} onComplete={() => setActiveNode('analytics')} />}
              {activeNode === 'analytics' && <AnalyticsNode data={expenses} categories={categories} userId={user?.uid} />}
              {activeNode === 'settings' && <SettingsNode userId={user?.uid} categories={categories} onUpdateCategories={setCategories} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}