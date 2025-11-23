import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  LayoutGrid, Upload, Users, PieChart as PieIcon, Settings, Plus,
  Trash2, Save, ArrowRight, CheckCircle, Activity, Shield, LogOut,
  FileText, DollarSign, Calendar
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, deleteDoc, serverTimestamp
} from 'firebase/firestore';

// --- Firebase Initialization (Adhering to Mandatory Rules) ---
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Shared/Utility Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false }) => {
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
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

// --- Feature Nodes ---

// 1. The Importer Node
const ImportNode = ({ userId, onComplete }) => {
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({ date: 0, description: 1, amount: 2, category: 3 });
  const [isSaving, setIsSaving] = useState(false);

  // Simulating a CSV parse
  const handleParse = () => {
    if (!rawData) return;
    const rows = rawData.split('\n').map(row => row.split(',').map(cell => cell.trim())).filter(row => row.length > 1);
    setParsedRows(rows);
    setStep(2);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const expensesRef = collection(db, 'artifacts', appId, 'users', userId, 'expenses');
      const batchPromises = parsedRows.slice(1).map(async (row) => { // Skip header
        const amount = parseFloat(row[columnMapping.amount]?.replace(/[^0-9.-]+/g, ""));
        if (isNaN(amount)) return null;

        return addDoc(expensesRef, {
          date: row[columnMapping.date] || new Date().toISOString(),
          description: row[columnMapping.description] || "Unknown",
          amount: amount,
          category: row[columnMapping.category] || "Uncategorized",
          source: "import",
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(batchPromises);
      setStep(3);
    } catch (error) {
      console.error("Error saving batch:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-6 h-6 text-emerald-600" /> Data Importer
          </h2>
          <p className="text-slate-500 mt-1">Import raw data from your bank or Excel.</p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 w-8 rounded-full ${step >= s ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm flex gap-3">
            <FileText className="w-5 h-5 shrink-0" />
            <p>Paste your CSV data below. For this demo, ensure columns are comma-separated. <br />Example: <code>2023-11-01, Grocery Store, 45.50, Food</code></p>
          </div>
          <textarea
            className="w-full h-64 p-4 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Paste data here..."
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={handleParse} disabled={!rawData}>Next: Map Columns <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-semibold mb-4 text-slate-700">Map your columns</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['Date', 'Description', 'Amount', 'Category'].map((field) => (
                <div key={field}>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.toLowerCase()]: parseInt(e.target.value) }))}
                    value={columnMapping[field.toLowerCase()]}
                  >
                    {parsedRows[0]?.map((_, idx) => (
                      <option key={idx} value={idx}>Column {idx + 1} ({parsedRows[0][idx]})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-medium">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(1, 6).map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="p-3 text-slate-500">{row[columnMapping.date]}</td>
                    <td className="p-3 font-medium text-slate-700">{row[columnMapping.description]}</td>
                    <td className="p-3 text-emerald-600 font-mono">{row[columnMapping.amount]}</td>
                    <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{row[columnMapping.category] || 'Uncategorized'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2 bg-slate-50 text-center text-xs text-slate-400">Showing first 5 rows preview</div>
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Processing...' : `Import ${parsedRows.length - 1} Transactions`}
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
  // Aggregate data by category
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

        <Card className="p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Monthly Trends</h3>
          <div className="h-64 w-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Trend charts available after 2 months of data
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold text-slate-700 mb-4">Recent Transactions</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {data.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Description</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td className="p-4 text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="p-4 font-medium text-slate-700">{item.description}</td>
                    <td className="p-4"><span className="px-2 py-1 rounded bg-slate-100 text-xs">{item.category}</span></td>
                    <td className="p-4 text-right font-mono text-slate-700">${parseFloat(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">No transactions found. Try importing data.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// 3. Social/Benchmark Node
const SocialNode = () => (
  <div className="p-6 animate-fade-in">
    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
      <Users className="w-6 h-6 text-purple-600" /> Community Benchmarks
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-white">
        <div className="text-sm text-purple-600 font-bold uppercase tracking-wider mb-2">Dining Out</div>
        <div className="text-3xl font-bold text-slate-800 mb-1">$450</div>
        <div className="text-xs text-slate-500">Avg. for users like you</div>
        <div className="mt-4 flex items-center text-xs text-green-600 font-medium bg-green-50 w-fit px-2 py-1 rounded">
          You are 12% below avg
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-blue-50 to-white">
        <div className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-2">Groceries</div>
        <div className="text-3xl font-bold text-slate-800 mb-1">$320</div>
        <div className="text-xs text-slate-500">Avg. for users like you</div>
        <div className="mt-4 flex items-center text-xs text-red-600 font-medium bg-red-50 w-fit px-2 py-1 rounded">
          You are 5% above avg
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-amber-50 to-white">
        <div className="text-sm text-amber-600 font-bold uppercase tracking-wider mb-2">Savings Rate</div>
        <div className="text-3xl font-bold text-slate-800 mb-1">18%</div>
        <div className="text-xs text-slate-500">Community Goal</div>
        <div className="mt-4 flex items-center text-xs text-slate-500 font-medium bg-slate-100 w-fit px-2 py-1 rounded">
          Keep going!
        </div>
      </Card>
    </div>

    <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl flex items-start gap-4">
      <Shield className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
      <div>
        <h4 className="font-bold text-blue-800 mb-1">Privacy First</h4>
        <p className="text-sm text-blue-700">
          Exli compares your spending categories anonymously. We never share your transaction details, specific locations, or raw amounts associated with your identity. Only aggregate percentages are used for community nodes.
        </p>
      </div>
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [activeNode, setActiveNode] = useState('dashboard'); // dashboard, import, analytics, social
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;

    const expensesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'expenses');
    const q = query(expensesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(data);
    }, (error) => {
      console.error("Error fetching expenses:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Calculation for Dashboard Summary
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
                User: {user.uid.slice(0, 6)}...
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* DASHBOARD VIEW (Grid of Nodes) */}
        {activeNode === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="mb-10 text-center max-w-2xl mx-auto">
              <h1 className="text-3xl font-extrabold text-slate-800 mb-3">Welcome to your financial command center.</h1>
              <p className="text-slate-500 text-lg">Configure your nodes to manage expenses, sync with partners, and analyze your growth.</p>
            </div>

            {/* High Level Stats */}
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
              <Card className="p-6 flex items-center gap-4 border-l-4 border-l-purple-500 opacity-60 cursor-not-allowed">
                <div className="p-3 rounded-full bg-purple-50 text-purple-600"><Users /></div>
                <div>
                  <div className="text-sm text-slate-500 font-medium">Partner Mode</div>
                  <div className="text-sm font-bold text-slate-800">Connect Account</div>
                </div>
              </Card>
            </div>

            {/* Nodes Grid */}
            <h2 className="text-xl font-bold text-slate-700 mb-4">Your Active Nodes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <NodeCard
                id="import"
                title="Data Importer"
                description="Parse CSVs from banks or Excel files. Map columns intelligently."
                icon={Upload}
                color="text-emerald-600"
              />
              <NodeCard
                id="analytics"
                title="Visual Analytics"
                description="Deep dive into your spending habits with interactive graphs."
                icon={PieIcon}
                color="text-blue-600"
              />
              <NodeCard
                id="social"
                title="Community"
                description="Compare your benchmarks anonymously with the Exli network."
                icon={Users}
                color="text-purple-600"
              />
              <NodeCard
                id="settings"
                title="Node Settings"
                description="Customize which modules are active in your dashboard."
                icon={Settings}
                color="text-slate-600"
              />
            </div>
          </div>
        )}

        {/* ACTIVE NODE VIEWS */}
        {activeNode !== 'dashboard' && (
          <div className="bg-white min-h-[600px] rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Node Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
              <button
                onClick={() => setActiveNode('dashboard')}
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 font-medium transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Dashboard
              </button>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400/20"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400/20"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400/20"></div>
              </div>
            </div>

            {/* Node Content */}
            <div className="flex-1 overflow-y-auto">
              {activeNode === 'import' && <ImportNode userId={user?.uid} onComplete={() => setActiveNode('analytics')} />}
              {activeNode === 'analytics' && <AnalyticsNode data={expenses} />}
              {activeNode === 'social' && <SocialNode />}
              {activeNode === 'settings' && (
                <div className="p-12 text-center text-slate-400">
                  <Settings className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-medium text-slate-600">Node Configuration</h3>
                  <p>This feature allows you to enable/disable specific modules to keep your experience clean.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}