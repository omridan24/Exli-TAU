import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import {
  LayoutGrid, Upload, Users, PieChart as PieIcon, Settings,
  ArrowRight, CheckCircle, Activity, Shield, DollarSign, Calendar
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';

// --- CONFIGURATION ---

// 1. PASTE YOUR CLOUD RUN URL HERE (No trailing slash)
// Example: "https://exli-processor-fw87sfs-uc.a.run.app"
const CLOUD_RUN_URL = import.meta.env.VITE_CLOUD_RUN_URL;


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "exli-local-v1";

// --- SHARED COMPONENTS ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false }) => {
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- FEATURE NODES ---

// 1. The Smart Import Node (Connected to Cloud Run)
const ImportNode = ({ userId, onComplete }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data from Server
  const [headers, setHeaders] = useState([]);      // List of column names ["Date", "Amount", ...]
  const [parsedRows, setParsedRows] = useState([]); // List of lists [[...], [...]]

  // Mapping: Stores the INDEX of the column (0, 1, 2...)
  const [columnMapping, setColumnMapping] = useState({
    date: '', description: '', amount: '', category: '', currency: ''
  });

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Send file to Python Backend
      const response = await fetch(`${CLOUD_RUN_URL}/analyze-file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();

      // 2. Update state with server response
      setHeaders(data.columns);
      setParsedRows(data.preview_data);

      // 3. Apply the "Smart Mapping" suggestions from Python
      // The server returns names like { date: "Transaction Date" }
      // We convert that to indices for the UI logic
      const suggestions = {};

      // Helper to find index of a column name
      const findIndex = (name) => data.columns.indexOf(name);

      if (data.suggested_mapping) {
        if (data.suggested_mapping.date) suggestions.date = findIndex(data.suggested_mapping.date);
        if (data.suggested_mapping.description) suggestions.description = findIndex(data.suggested_mapping.description);
        if (data.suggested_mapping.amount) suggestions.amount = findIndex(data.suggested_mapping.amount);
        if (data.suggested_mapping.category) suggestions.category = findIndex(data.suggested_mapping.category);
        if (data.suggested_mapping.currency) suggestions.currency = findIndex(data.suggested_mapping.currency);
      }

      // Remove any -1 (not found) values
      Object.keys(suggestions).forEach(key => {
        if (suggestions[key] === -1) delete suggestions[key];
      });

      setColumnMapping(prev => ({ ...prev, ...suggestions }));
      setStep(2);

    } catch (err) {
      console.error(err);
      setError("Failed to analyze file. Check if Cloud Run URL is correct and server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const expensesRef = collection(db, 'artifacts', appId, 'users', userId, 'expenses');

      // parsedRows contains raw data. We map it using the indices selected by the user.
      const batchPromises = parsedRows.map(async (row) => {
        // Get raw amount
        const rawAmount = row[columnMapping.amount];
        // Clean string to number (remove currency symbols, commas)
        const amount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, ""));

        if (isNaN(amount)) return null;

        return addDoc(expensesRef, {
          date: row[columnMapping.date] || new Date().toISOString(),
          description: row[columnMapping.description] || "Unknown",
          amount: amount,
          category: row[columnMapping.category] || "Uncategorized",
          currency: row[columnMapping.currency] || "ILS",
          source: "import_cloud_v1",
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(batchPromises);
      setStep(3);
    } catch (error) {
      console.error("Error saving batch:", error);
      setError("Failed to save data to Firebase.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-6 h-6 text-emerald-600" /> Smart Importer
          </h2>
          <p className="text-slate-500 mt-1">Upload your bank statement (Excel or CSV).</p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 w-8 rounded-full ${step >= s ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors relative">
            <input
              type="file"
              accept=".csv, .xls, .xlsx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="pointer-events-none">
              <Upload className={`w-12 h-12 mx-auto mb-4 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
              {file ? (
                <div>
                  <div className="font-bold text-lg text-slate-800">{file.name}</div>
                  <div className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-lg text-slate-600">Click or Drag file here</div>
                  <div className="text-sm text-slate-400">Supports CSV, Excel (XLS/XLSX)</div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleUploadAndAnalyze} disabled={!file || isLoading}>
              {isLoading ? 'Analyzing on Cloud...' : 'Upload & Analyze'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-semibold mb-4 text-slate-700 flex justify-between">
              <span>Confirm Column Mapping</span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">AI Suggestions Applied</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (
                <div key={field}>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.toLowerCase()]: parseInt(e.target.value) }))}
                    value={columnMapping[field.toLowerCase()] ?? ""}
                  >
                    <option value="">Select Column...</option>
                    {headers.map((header, idx) => (
                      <option key={idx} value={idx}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-medium">
                <tr>
                  {headers.map((h, i) => <th key={i} className="p-3 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, i) => (
                  <tr key={i} className="bg-white hover:bg-slate-50">
                    {row.map((cell, j) => (
                      <td key={j} className={`p-3 whitespace-nowrap ${j === columnMapping.amount ? 'font-mono text-emerald-600 font-bold' :
                        j === columnMapping.date ? 'text-blue-600' : 'text-slate-500'
                        }`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2 bg-slate-50 text-center text-xs text-slate-400">Showing first 5 rows from file</div>
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Import Transactions'}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Import Successful!</h3>
          <p className="text-slate-500 mb-6">Your data has been added to the Exli database.</p>
          <Button onClick={onComplete}>Return to Dashboard</Button>
        </div>
      )}
    </div>
  );
};

// 2. The Analytics Node
const AnalyticsNode = ({ data }) => {
  const categoryData = useMemo(() => {
    const agg = {};
    data.forEach(item => {
      const cat = item.category || 'Uncategorized';
      agg[cat] = (agg[cat] || 0) + Number(item.amount);
    });
    return Object.keys(agg).map(key => ({ name: key, value: agg[key] }));
  }, [data]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  return (
    <div className="p-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <PieIcon className="w-6 h-6 text-blue-600" /> Financial Overview
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Spending by Category</h3>
          {categoryData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">No data available</div>
          )}
        </Card>
      </div>
    </div>
  );
};

// 3. Social Node Placeholder
const SocialNode = () => (
  <div className="p-6 animate-fade-in">
    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
      <Users className="w-6 h-6 text-purple-600" /> Community Benchmarks
    </h2>
    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed">
      Feature coming soon!
    </div>
  </div>
);

// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [activeNode, setActiveNode] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Data
  useEffect(() => {
    if (!user) return;
    const expensesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'expenses');
    const q = query(expensesRef, orderBy('date', 'desc'));

    return onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Data fetch error:", error));
  }, [user]);

  const totalSpent = useMemo(() => expenses.reduce((acc, curr) => acc + Number(curr.amount), 0), [expenses]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-emerald-600 font-bold animate-pulse">Loading Exli...</div>;

  const NodeCard = ({ id, title, icon: Icon, description, color }) => (
    <button
      onClick={() => setActiveNode(id)}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-emerald-200 transition-all text-left group relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon className="w-24 h-24" />
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color.replace('text-', 'bg-').replace('600', '100')} ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-lg text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 relative z-10">{description}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 font-bold text-2xl text-emerald-600 cursor-pointer tracking-tight"
            onClick={() => setActiveNode('dashboard')}
          >
            <LayoutGrid className="w-8 h-8" />
            Exli
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                {user.uid.slice(0, 6)}...
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">

        {activeNode === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              <Card className="p-6 flex items-center gap-4 border-l-4 border-l-emerald-500">
                <div className="p-3 rounded-full bg-emerald-50 text-emerald-600"><DollarSign /></div>
                <div>
                  <div className="text-sm text-slate-500 font-medium">Total Tracked</div>
                  <div className="text-2xl font-bold text-slate-800">${totalSpent.toLocaleString()}</div>
                </div>
              </Card>
              <Card className="p-6 flex items-center gap-4 border-l-4 border-l-blue-500">
                <div className="p-3 rounded-full bg-blue-50 text-blue-600"><Calendar /></div>
                <div>
                  <div className="text-sm text-slate-500 font-medium">Transactions</div>
                  <div className="text-2xl font-bold text-slate-800">{expenses.length}</div>
                </div>
              </Card>
            </div>

            <h2 className="text-xl font-bold text-slate-700 mb-4">Your Active Nodes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <NodeCard
                id="import"
                title="Smart Importer"
                description="Upload Excel/CSV. AI auto-detects columns."
                icon={Upload}
                color="text-emerald-600"
              />
              <NodeCard
                id="analytics"
                title="Visual Analytics"
                description="Charts and breakdowns of your spending."
                icon={PieIcon}
                color="text-blue-600"
              />
              <NodeCard
                id="social"
                title="Community"
                description="Benchmarks (Coming Soon)."
                icon={Users}
                color="text-purple-600"
              />
              <NodeCard
                id="settings"
                title="Node Settings"
                description="Configure modules."
                icon={Settings}
                color="text-slate-600"
              />
            </div>
          </div>
        )}

        {activeNode !== 'dashboard' && (
          <div className="bg-white min-h-[600px] rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
              <button
                onClick={() => setActiveNode('dashboard')}
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 font-medium transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Dashboard
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeNode === 'import' && <ImportNode userId={user?.uid} onComplete={() => setActiveNode('analytics')} />}
              {activeNode === 'analytics' && <AnalyticsNode data={expenses} />}
              {activeNode === 'social' && <SocialNode />}
              {activeNode === 'settings' && <div className="p-12 text-center text-slate-400">Settings Coming Soon</div>}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}