import React, { useState, useMemo } from 'react';
import { Upload, ArrowRight, Sparkles, CheckCircle, Trash2, XCircle, Plus, X, FileText, ChevronLeft, ChevronRight, CreditCard, PenTool, Edit2, Check, ArrowUp, ArrowDown, Clock, RotateCcw } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { DEFAULT_CATEGORIES, CURRENCIES } from '../../config/constants.js';
import { Button } from '../../components/UI.jsx';

export const ExpenseNode = ({ userId, categories, expenses, onUpdateCategories, onComplete }) => {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);

  // Multi-file state
  const [processedFiles, setProcessedFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  // Categorization state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allTransactions, setAllTransactions] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Editing Amount State
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editAmountValue, setEditAmountValue] = useState('');

  // Manual Entry State
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    currency: 'ILS',
    category: ''
  });

  const sortedCategories = categories;

  // --- TIME ESTIMATE ---
  const processingTimeEstimate = useMemo(() => {
    if (!files.length) return null;
    const hasPdf = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
    return hasPdf ? "30s - 1 min" : "10s - 20s";
  }, [files]);

  // --- HELPERS ---
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString();
    if (!isNaN(dateStr) && !dateStr.includes('-') && !dateStr.includes('/')) {
      const date = new Date((dateStr - (25567 + 2)) * 86400 * 1000);
      return date.toISOString();
    }
    const str = String(dateStr).trim();
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  };

  const cleanDateDisplay = (isoString) => {
    if (!isoString) return "";
    return isoString.split('T')[0]; // Returns YYYY-MM-DD
  };

  // --- FILE HANDLERS ---
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length + files.length > 4) {
      alert("Maximum 4 files allowed.");
      return;
    }
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleUploadAndAnalyze = async () => {
    if (files.length === 0) return;
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured.");
      const response = await fetch(`${CLOUD_RUN_URL}/analyze-file`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);

      const data = await response.json();
      const initProcessed = data.files.map(f => ({
        ...f,
        columnMapping: mapBackendToIndices(f.suggested_mapping, f.columns)
      }));

      setProcessedFiles(initProcessed);
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to analyze files.");
    } finally {
      setIsLoading(false);
    }
  };

  const mapBackendToIndices = (mapping, headers) => {
    const result = {};
    if (!mapping) return {};
    Object.entries(mapping).forEach(([key, val]) => {
      const idx = headers.indexOf(val);
      if (idx !== -1) result[key] = idx;
    });
    return result;
  };

  const updateMapping = (field, val) => {
    const updated = [...processedFiles];
    updated[currentFileIndex].columnMapping = {
      ...updated[currentFileIndex].columnMapping,
      [field]: parseInt(val)
    };
    setProcessedFiles(updated);
  };

  const startSorting = () => {
    let queue = [];
    processedFiles.forEach(file => {
      const { all_data, columnMapping, card_info } = file;
      const fileTx = all_data.map(row => {
        let rawAmount = row[columnMapping.amount];
        let amount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, ""));
        if (isNaN(amount)) amount = 0;

        return {
          date: parseDate(row[columnMapping.date]),
          description: row[columnMapping.description] || "Unknown",
          amount: Math.abs(amount),
          originalCategory: row[columnMapping.category] || "Uncategorized",
          currency: row[columnMapping.currency] || "ILS",
          sourceCard: card_info
        };
      });
      queue = [...queue, ...fileTx];
    });

    setAllTransactions(queue);
    setCurrentIndex(0);
    setProcessedTransactions([]);
    setStep(3);
  };

  // --- ACTIONS ---
  const handleShiftAmount = (direction) => {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= allTransactions.length) return;

    const newTransactions = [...allTransactions];
    const currentItem = newTransactions[currentIndex];
    const targetItem = newTransactions[targetIndex];

    const tempAmount = currentItem.amount;
    const tempCurrency = currentItem.currency;

    newTransactions[currentIndex] = { ...currentItem, amount: targetItem.amount, currency: targetItem.currency };
    newTransactions[targetIndex] = { ...targetItem, amount: tempAmount, currency: tempCurrency };

    setAllTransactions(newTransactions);
  };

  const handleSaveAmountEdit = () => {
    const newAmount = parseFloat(editAmountValue);
    if (!isNaN(newAmount) && newAmount > 0) {
      const updatedTx = [...allTransactions];
      updatedTx[currentIndex].amount = newAmount;
      setAllTransactions(updatedTx);
    }
    setIsEditingAmount(false);
  };

  const handleCategorize = (categoryName, isRefund = false) => {
    if (isEditingAmount) handleSaveAmountEdit();

    if (isManualMode) {
      if (!manualData.amount || !manualData.description) {
        alert("Please enter amount and description");
        return;
      }
      saveManualTransaction(categoryName);
      return;
    }

    const currentTx = allTransactions[currentIndex];
    const tx = {
      ...currentTx,
      date: currentTx.date || new Date().toISOString(),
      assignedCategory: categoryName,
      reportMonth: reportMonth,
      isRefund: isRefund,
      status: 'active'
    };
    setProcessedTransactions(prev => [...prev, tx]);
    moveToNext();
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProcessedTransactions(prev => prev.slice(0, -1)); // Remove the last processed item so we can redo it
    }
  };

  const saveManualTransaction = async (categoryName) => {
    setIsLoading(true);
    try {
      const expensesRef = collection(db, 'users', userId, 'expenses');
      const manualMonth = manualData.date.slice(0, 7);

      await addDoc(expensesRef, {
        date: new Date(manualData.date).toISOString(),
        description: manualData.description,
        amount: parseFloat(manualData.amount),
        currency: manualData.currency,
        assignedCategory: categoryName,
        reportMonth: manualMonth,
        source: 'manual',
        status: 'active',
        createdAt: serverTimestamp()
      });
      setStep(4);
    } catch (e) {
      setError("Failed to save manual expense.");
    } finally {
      setIsLoading(false);
      setIsManualMode(false);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return;
    const newId = newCatName.toLowerCase().replace(/\s+/g, '_');
    const colors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newCat = { id: newId, name: newCatName, color: randomColor };
    const updated = [...categories, newCat];
    onUpdateCategories(updated);
    await setDoc(doc(db, 'users', userId), { customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id)) }, { merge: true });

    handleCategorize(newCatName);
    setNewCatName('');
    setIsCreatingCat(false);
  };

  const handleSkip = () => moveToNext();
  const moveToNext = () => currentIndex < allTransactions.length - 1 ? setCurrentIndex(prev => prev + 1) : finishImport();

  const finishImport = async () => {
    setIsLoading(true);
    try {
      const expensesRef = collection(db, 'users', userId, 'expenses');
      await Promise.all(processedTransactions.map(tx => addDoc(expensesRef, { ...tx, source: "smart_import", createdAt: serverTimestamp() })));
      setStep(4);
    } catch (err) { setError("Failed to save transactions."); }
    finally { setIsLoading(false); }
  };

  const currentTx = allTransactions[currentIndex];
  const suggestedCategoryId = useMemo(() => {
    if (isManualMode) return null;
    if (!currentTx || !currentTx.originalCategory) return null;
    const cleanCat = String(currentTx.originalCategory).toLowerCase();
    const match = categories.find(c => cleanCat.includes(c.id) || cleanCat.includes(c.name.toLowerCase()));
    return match ? match.id : null;
  }, [currentTx, categories, isManualMode]);

  const currentFileData = processedFiles[currentFileIndex];

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> Expense Manager</h2>
          <p className="text-slate-500 mt-1">
            {isManualMode ? "Add single expense." : step === 3 ? `Item ${currentIndex + 1} of ${allTransactions.length}` : "Upload & Merge."}
          </p>
        </div>
      </div>

      {step === 0 && !isManualMode && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Select Expense Month</h3>
          <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" />
          <Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button>
        </div>
      )}

      {step === 1 && !isManualMode && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative flex flex-col items-center justify-center min-h-[200px]">
              <input type="file" accept=".csv, .xls, .xlsx, .pdf" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Upload className="w-12 h-12 text-slate-300 mb-4" />
              <div className="font-bold text-lg text-slate-600">Drop files here or Click</div>
              <p className="text-sm text-slate-400 mt-1">Up to 4 files (PDF, Excel, CSV)</p>
            </div>

            <div onClick={() => setIsManualMode(true)} className="w-1/3 border-2 border-slate-100 rounded-2xl p-8 text-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <PenTool className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
              </div>
              <div className="font-bold text-slate-600 group-hover:text-emerald-700">Add Manually</div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0"><FileText className="w-5 h-5" /></div>
                    <div className="min-w-0"><div className="font-bold text-slate-700 truncate text-sm">{f.name}</div><div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div></div>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          {error && <div className="text-red-600 text-center">{error}</div>}
          <div className="flex justify-between items-center">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <div className="flex items-center gap-4">
              {processingTimeEstimate && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 animate-fade-in">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. {processingTimeEstimate}</span>
                </div>
              )}
              <Button onClick={handleUploadAndAnalyze} disabled={files.length === 0 || isLoading}>
                {isLoading ? <><Sparkles className="w-4 h-4 animate-spin text-yellow-400" /> Analyzing {files.length} files...</> : <>Analyze Files <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isManualMode && !isCreatingCat && (
        <div className="max-w-lg mx-auto bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PenTool className="w-5 h-5 text-emerald-500" /> New Transaction</h3>
          <div className="space-y-4 mb-8">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Amount</label>
              <div className="flex gap-2">
                <input type="number" className="flex-1 p-3 border border-slate-200 rounded-xl text-2xl font-bold outline-none focus:border-emerald-500" placeholder="0.00" autoFocus value={manualData.amount} onChange={e => setManualData({ ...manualData, amount: e.target.value })} />
                <select className="w-24 p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none" value={manualData.currency} onChange={e => setManualData({ ...manualData, currency: e.target.value })}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-bold text-slate-400 uppercase">Description</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500" placeholder="e.g. Lunch at Aroma" value={manualData.description} onChange={e => setManualData({ ...manualData, description: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase">Date</label><input type="date" className="w-full p-3 border border-slate-200 rounded-xl font-medium outline-none" value={manualData.date} onChange={e => setManualData({ ...manualData, date: e.target.value })} /></div>
          </div>
          <div className="text-xs font-bold text-slate-400 uppercase mb-3">Select Category to Save</div>
          <div className="grid grid-cols-3 gap-2">
            {sortedCategories.map(cat => (
              <button key={cat.id} onClick={() => handleCategorize(cat.name)} className="p-2 rounded-lg border border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div><span className="text-xs font-bold text-slate-600">{cat.name}</span>
              </button>
            ))}
            <button onClick={() => setIsCreatingCat(true)} className="p-2 rounded-lg border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"><Plus className="w-4 h-4 mx-auto" /></button>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100"><Button variant="secondary" onClick={() => setIsManualMode(false)} className="w-full justify-center">Cancel</Button></div>
        </div>
      )}

      {step === 2 && currentFileData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <button disabled={currentFileIndex === 0} onClick={() => setCurrentFileIndex(prev => prev - 1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
            <div className="text-center">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Verifying File {currentFileIndex + 1} of {processedFiles.length}</div>
              <div className="font-bold text-slate-800 flex items-center justify-center gap-2"><CreditCard className="w-4 h-4 text-emerald-500" /> {currentFileData.card_info}</div>
              <div className="text-xs text-slate-400 truncate max-w-[200px] mx-auto">{currentFileData.filename}</div>
            </div>
            <button disabled={currentFileIndex === processedFiles.length - 1} onClick={() => setCurrentFileIndex(prev => prev + 1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-6 h-6 text-slate-600" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (
              <div key={field}>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label>
                <select className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm" onChange={(e) => updateMapping(field.toLowerCase(), e.target.value)} value={currentFileData.columnMapping[field.toLowerCase()] ?? ""}><option value="">Select Column...</option>{currentFileData.columns.map((header, idx) => (<option key={idx} value={idx}>{header}</option>))}</select>
              </div>
            ))}
          </div>
          <div className="mt-6 border rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="bg-slate-50 p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">Preview: {currentFileData.card_info}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 font-bold text-xs border-b border-slate-100">
                  <tr>{currentFileData.columns.map((h, i) => { const isSelected = Object.values(currentFileData.columnMapping).includes(i); const mappedField = Object.keys(currentFileData.columnMapping).find(key => currentFileData.columnMapping[key] === i); return (<th key={i} className={`p-3 whitespace-nowrap border-r border-slate-50 last:border-0 ${isSelected ? 'bg-blue-50 text-blue-700' : ''}`}>{h}{mappedField && <div className="mt-1 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full inline-block">{mappedField}</div>}</th>); })}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentFileData.preview_data.map((row, rIdx) => (<tr key={rIdx} className="hover:bg-slate-50/50">{currentFileData.columns.map((_, cIdx) => { const isSelected = Object.values(currentFileData.columnMapping).includes(cIdx); return (<td key={cIdx} className={`p-3 whitespace-nowrap text-slate-700 border-r border-slate-50 last:border-0 ${isSelected ? 'bg-blue-50/30 font-medium text-blue-900' : ''}`}>{row[cIdx]}</td>) })}</tr>))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={startSorting}>Start Categorizing ({processedFiles.length} files) &rarr;</Button></div>
        </div>
      )}

      {(step === 3 || (isManualMode && isCreatingCat)) && (
        <div className="max-w-2xl mx-auto">
          {isCreatingCat ? (
            <div className="mb-6 p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
              <h4 className="font-bold text-slate-800 mb-4 text-lg">Create New Category</h4>
              <div className="flex gap-2"><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500" placeholder="e.g. Pet Supplies" autoFocus /><Button onClick={handleQuickAddCategory} disabled={!newCatName}>Create</Button><Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button></div>
            </div>
          ) : (
            step === 3 && currentTx && (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8 relative">
                <div className="absolute top-4 right-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm opacity-80"><CreditCard className="w-3 h-3" /> {currentTx.sourceCard}</div>

                {/* Header (Prev Button + Details) */}
                <div className="absolute top-4 left-4">
                  {currentIndex > 0 && (
                    <button onClick={handleUndo} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors">
                      <RotateCcw className="w-3 h-3" /> Previous
                    </button>
                  )}
                </div>

                <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start pt-12">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{currentTx.description}</h3>
                    <div className="text-sm text-slate-500 mt-1">{cleanDateDisplay(currentTx.date)}</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {isEditingAmount ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          autoFocus
                          value={editAmountValue}
                          onChange={(e) => setEditAmountValue(e.target.value)}
                          className="w-32 p-2 text-2xl font-mono font-bold text-slate-800 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button onClick={handleSaveAmountEdit} className="p-2 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200"><Check className="w-5 h-5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 group">
                        <div className="flex flex-col gap-1 mr-2 opacity-50 hover:opacity-100 transition-opacity">
                          <button onClick={() => handleShiftAmount(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500" title="Move amount to PREVIOUS transaction"><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={() => handleShiftAmount(1)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500" title="Move amount to NEXT transaction"><ArrowDown className="w-4 h-4" /></button>
                        </div>
                        <div className="text-3xl font-mono font-bold text-slate-800">
                          {currentTx.amount} <span className="text-lg text-slate-400">{currentTx.currency}</span>
                        </div>
                        <button onClick={() => { setIsEditingAmount(true); setEditAmountValue(currentTx.amount); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100" title="Edit Amount">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {currentTx.originalCategory && (<div className="inline-block mt-2 px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">File: {currentTx.originalCategory}</div>)}
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {sortedCategories.map(cat => { const isSuggested = suggestedCategoryId === cat.id; return (<button key={cat.id} onClick={() => handleCategorize(cat.name)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isSuggested ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className={`text-xs font-bold ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span></button>); })}
                    <button onClick={() => setIsCreatingCat(true)} className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-slate-400 hover:text-emerald-600"><Plus className="w-6 h-6" /><span className="text-xs font-bold">New Cat</span></button>
                    <button onClick={() => handleCategorize('Refunded', true)} className="p-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-amber-700"><XCircle className="w-6 h-6" /><span className="text-xs font-bold">Refunded</span></button>
                  </div>
                  <div className="border-t border-slate-100 pt-6">
                    <button onClick={handleSkip} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors px-4 py-3 rounded-xl font-bold border border-transparent hover:border-slate-200">
                      <Trash2 className="w-5 h-5" /> Skip Transaction
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {step === 4 && (<div className="text-center py-12"><CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-slate-800 mb-2">{isManualMode ? "Expense Added!" : "Import Complete!"}</h3><div className="flex justify-center gap-4 mt-6"><Button onClick={() => { setStep(0); setFiles([]); setProcessedFiles([]); setIsManualMode(false); }}>Add More</Button><Button variant="secondary" onClick={onComplete}>Go to Dashboard</Button></div></div>)}
    </div>
  );
};