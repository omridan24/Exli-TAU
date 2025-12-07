import React, { useState, useMemo } from 'react';
import { Upload, ArrowRight, Sparkles, CheckCircle, Trash2, XCircle, Plus, X } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { DEFAULT_CATEGORIES } from '../../config/constants.js';
import { Button } from '../../components/UI.jsx';

export const ExpenseNode = ({ userId, categories, expenses, onUpdateCategories, onComplete }) => {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [allRawRows, setAllRawRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({ date: '', description: '', amount: '', category: '', currency: '' });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Fixed order to prevent cards from moving while classifying
  //adding this to force rebuild
  const sortedCategories = categories;

  const handleFileChange = (e) => e.target.files[0] && setFile(e.target.files[0]);

  const handleUploadAndAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured.");
      const response = await fetch(`${CLOUD_RUN_URL}/analyze-file`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);
      const data = await response.json();
      setHeaders(data.columns);
      setAllRawRows(data.all_data || []);
      const suggestions = {};
      const findIndex = (name) => data.columns.indexOf(name);
      if (data.suggested_mapping) {
        Object.entries(data.suggested_mapping).forEach(([key, val]) => {
          const idx = findIndex(val);
          if (idx !== -1) suggestions[key] = idx;
        });
      }
      setColumnMapping(prev => ({ ...prev, ...suggestions }));
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to analyze file.");
    } finally {
      setIsLoading(false);
    }
  };
  const startSorting = () => { setStep(3); setCurrentIndex(0); setProcessedTransactions([]); };
  const handleQuickAddCategory = async () => { if (!newCatName.trim()) return; const newId = newCatName.toLowerCase().replace(/\s+/g, '_'); const colors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']; const randomColor = colors[Math.floor(Math.random() * colors.length)]; const newCat = { id: newId, name: newCatName, color: randomColor }; const updated = [...categories, newCat]; onUpdateCategories(updated); await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true }); handleCategorize(newCatName); setNewCatName(''); setIsCreatingCat(false); };
  const handleCategorize = (categoryName, isRefund = false) => { const rawRow = allRawRows[currentIndex]; let rawAmount = rawRow[columnMapping.amount]; let amount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, "")); if (isNaN(amount)) amount = 0; const currency = rawRow[columnMapping.currency] || "ILS"; const tx = { date: rawRow[columnMapping.date] || new Date().toISOString(), description: rawRow[columnMapping.description] || "Unknown", amount: amount, originalCategory: rawRow[columnMapping.category] || "Uncategorized", currency: currency, assignedCategory: categoryName, reportMonth: reportMonth, isRefund: isRefund, status: 'active' }; setProcessedTransactions(prev => [...prev, tx]); moveToNext(); };
  const handleSkip = () => moveToNext();
  const moveToNext = () => currentIndex < allRawRows.length - 1 ? setCurrentIndex(prev => prev + 1) : finishImport();
  const finishImport = async () => { setIsLoading(true); try { const expensesRef = collection(db, 'users', userId, 'expenses'); await Promise.all(processedTransactions.map(tx => addDoc(expensesRef, { ...tx, source: "smart_import", createdAt: serverTimestamp() }))); setStep(4); } catch (err) { setError("Failed to save transactions."); } finally { setIsLoading(false); } };
  const currentRaw = allRawRows[currentIndex];
  const displayData = currentRaw ? { date: currentRaw[columnMapping.date], desc: currentRaw[columnMapping.description], amount: currentRaw[columnMapping.amount], cat: currentRaw[columnMapping.category], curr: currentRaw[columnMapping.currency] || '' } : {};
  const suggestedCategoryId = useMemo(() => { if (!displayData.cat) return null; const cleanCat = String(displayData.cat).toLowerCase(); const match = categories.find(c => cleanCat.includes(c.id) || cleanCat.includes(c.name.toLowerCase())); return match ? match.id : null; }, [displayData.cat, categories]);

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> Expense Manager</h2>
          <p className="text-slate-500 mt-1">{step === 3 ? `Reviewing item ${currentIndex + 1} of ${allRawRows.length}` : "Upload bank files."}</p>
        </div>
      </div>
      {step === 0 && (<div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center"><h3 className="text-lg font-bold text-slate-800 mb-2">Select Expense Month</h3><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" /><Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button></div>)}
      {step === 1 && (<div className="space-y-6"><div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors relative"><input type="file" accept=".csv, .xls, .xlsx, .pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><div className="pointer-events-none"><Upload className={`w-12 h-12 mx-auto mb-4 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />{file ? <div><div className="font-bold text-lg text-slate-800">{file.name}</div></div> : <div><div className="font-bold text-lg text-slate-600">Click or Drag file here</div></div>}</div></div>{error && <div className="text-red-600 text-center">{error}</div>}<div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(0)}>Back</Button><Button onClick={handleUploadAndAnalyze} disabled={!file || isLoading}>{isLoading ? <><Sparkles className="w-4 h-4 animate-spin text-yellow-400" /> Analyzing with AI...</> : 'Upload & Analyze'} <ArrowRight className="w-4 h-4" /></Button></div></div>)}
      {step === 2 && (<div className="space-y-6"><div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4"><h3 className="font-bold text-blue-800">Verify Columns</h3></div><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (<div key={field}><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label><select className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none" onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.toLowerCase()]: parseInt(e.target.value) }))} value={columnMapping[field.toLowerCase()] ?? ""}><option value="">Select Column...</option>{headers.map((header, idx) => (<option key={idx} value={idx}>{header}</option>))}</select></div>))}</div>

        {/* New Data Preview Table */}
        <div className="mt-6 border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">File Preview (First 5 Rows)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-500 font-bold text-xs border-b border-slate-100">
                <tr>
                  {headers.map((h, i) => {
                    const isSelected = Object.values(columnMapping).includes(i);
                    const mappedField = Object.keys(columnMapping).find(key => columnMapping[key] === i);
                    return (
                      <th key={i} className={`p-3 whitespace-nowrap border-r border-slate-50 last:border-0 ${isSelected ? 'bg-blue-50 text-blue-700' : ''}`}>
                        {h}
                        {mappedField && <div className="mt-1 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full inline-block">{mappedField}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allRawRows.slice(0, 5).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/50">
                    {headers.map((_, cIdx) => {
                      const isSelected = Object.values(columnMapping).includes(cIdx);
                      return (
                        <td key={cIdx} className={`p-3 whitespace-nowrap text-slate-700 border-r border-slate-50 last:border-0 ${isSelected ? 'bg-blue-50/30 font-medium text-blue-900' : ''}`}>
                          {row[cIdx]}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={startSorting}>Start Sorting &rarr;</Button></div></div>)}
      {step === 3 && currentRaw && (<div className="max-w-2xl mx-auto"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8"><div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start"><div><h3 className="text-xl font-bold text-slate-800">{displayData.desc}</h3><div className="text-sm text-slate-500 mt-1">{displayData.date}</div></div><div className="text-right"><div className="text-3xl font-mono font-bold text-slate-800">{displayData.amount} <span className="text-lg text-slate-400">{displayData.curr}</span></div>{displayData.cat && (<div className="inline-block mt-2 px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">File: {displayData.cat}</div>)}</div></div><div className="p-6">{isCreatingCat ? (<div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-700 mb-2 text-sm">New Category Name</h4><div className="flex gap-2"><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-2 border border-slate-300 rounded-lg outline-none" placeholder="e.g. Pet Supplies" autoFocus /><Button onClick={handleQuickAddCategory} disabled={!newCatName}>Add</Button><Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button></div></div>) : (<div className="grid grid-cols-3 gap-3 mb-6">{sortedCategories.map(cat => { const isSuggested = suggestedCategoryId === cat.id; return (<button key={cat.id} onClick={() => handleCategorize(cat.name)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isSuggested ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className={`text-xs font-bold ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span></button>); })}<button onClick={() => setIsCreatingCat(true)} className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-slate-400 hover:text-emerald-600"><Plus className="w-6 h-6" /><span className="text-xs font-bold">New Cat</span></button></div>)}<div className="flex items-center justify-between border-t border-slate-100 pt-6"><button onClick={handleSkip} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors px-4 py-2"><Trash2 className="w-5 h-5" /> Skip</button><button onClick={() => handleCategorize('Refunded', true)} className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors px-4 py-2"><XCircle className="w-5 h-5" /> Mark Refunded</button></div></div></div></div>)}
      {step === 4 && (<div className="text-center py-12"><CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-slate-800 mb-2">Import Complete!</h3><Button onClick={onComplete}>Go to Dashboard</Button></div>)}
    </div>
  );
};