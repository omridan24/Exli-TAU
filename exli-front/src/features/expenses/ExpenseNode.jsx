import React, { useState, useMemo } from 'react';
import { Upload, ArrowRight, Sparkles, CheckCircle, Trash2, XCircle, Plus, X, FileText, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { DEFAULT_CATEGORIES } from '../../config/constants.js';
import { Button } from '../../components/UI.jsx';

export const ExpenseNode = ({ userId, categories, expenses, onUpdateCategories, onComplete }) => {
  const [step, setStep] = useState(0);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Multi-file state
  const [processedFiles, setProcessedFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0); // For verification step carousel

  // Categorization state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allTransactions, setAllTransactions] = useState([]); // Combined queue
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const sortedCategories = categories;

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

      // Transform backend response into state format
      // backend returns { status: 'success', files: [ { filename, card_info, columns, suggested_mapping, all_data, ... }, ... ] }
      const initProcessed = data.files.map(f => ({
        ...f,
        // convert backend mapping dict to array indices for the dropdowns
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

  // Helper to convert { date: "DateColumn" } -> { date: 0 }
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
    // Merge all files into one transaction queue
    let queue = [];
    processedFiles.forEach(file => {
      const { all_data, columnMapping, card_info } = file;
      const fileTx = all_data.map(row => {
        let rawAmount = row[columnMapping.amount];
        let amount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, ""));
        if (isNaN(amount)) amount = 0;

        return {
          date: row[columnMapping.date],
          description: row[columnMapping.description] || "Unknown",
          amount: amount,
          originalCategory: row[columnMapping.category] || "Uncategorized",
          currency: row[columnMapping.currency] || "ILS",
          sourceCard: card_info // "Visa 5096"
        };
      });
      queue = [...queue, ...fileTx];
    });

    setAllTransactions(queue);
    setCurrentIndex(0);
    setProcessedTransactions([]);
    setStep(3);
  };

  const handleCategorize = (categoryName, isRefund = false) => {
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

  // Helper for rendering current card in Step 3
  const currentTx = allTransactions[currentIndex];
  const suggestedCategoryId = useMemo(() => {
    if (!currentTx || !currentTx.originalCategory) return null;
    const cleanCat = String(currentTx.originalCategory).toLowerCase();
    const match = categories.find(c => cleanCat.includes(c.id) || cleanCat.includes(c.name.toLowerCase()));
    return match ? match.id : null;
  }, [currentTx, categories]);

  // Helpers for Step 2
  const currentFileData = processedFiles[currentFileIndex];

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> Expense Manager</h2>
          <p className="text-slate-500 mt-1">{step === 3 ? `Item ${currentIndex + 1} of ${allTransactions.length}` : "Upload & Merge."}</p>
        </div>
      </div>

      {step === 0 && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Select Expense Month</h3>
          <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" />
          <Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative flex flex-col items-center justify-center min-h-[200px]">
            <input type="file" accept=".csv, .xls, .xlsx, .pdf" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Upload className="w-12 h-12 text-slate-300 mb-4" />
            <div className="font-bold text-lg text-slate-600">Drop files here or Click</div>
            <p className="text-sm text-slate-400 mt-1">Up to 4 files (PDF, Excel, CSV)</p>
          </div>

          {/* File Cards Grid */}
          {files.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-700 truncate text-sm">{f.name}</div>
                      <div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div>
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="text-red-600 text-center">{error}</div>}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={handleUploadAndAnalyze} disabled={files.length === 0 || isLoading}>
              {isLoading ? <><Sparkles className="w-4 h-4 animate-spin text-yellow-400" /> Analyzing {files.length} files...</> : 'Analyze Files'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && currentFileData && (
        <div className="space-y-6">
          {/* File Navigation Header */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <button
              disabled={currentFileIndex === 0}
              onClick={() => setCurrentFileIndex(prev => prev - 1)}
              className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-6 h-6 text-slate-600" />
            </button>

            <div className="text-center">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Verifying File {currentFileIndex + 1} of {processedFiles.length}</div>
              <div className="font-bold text-slate-800 flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                {currentFileData.card_info}
              </div>
              <div className="text-xs text-slate-400 truncate max-w-[200px] mx-auto">{currentFileData.filename}</div>
            </div>

            <button
              disabled={currentFileIndex === processedFiles.length - 1}
              onClick={() => setCurrentFileIndex(prev => prev + 1)}
              className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-6 h-6 text-slate-600" />
            </button>
          </div>

          {/* Verification Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (
              <div key={field}>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label>
                <select
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm"
                  onChange={(e) => updateMapping(field.toLowerCase(), e.target.value)}
                  value={currentFileData.columnMapping[field.toLowerCase()] ?? ""}
                >
                  <option value="">Select Column...</option>
                  {currentFileData.columns.map((header, idx) => (
                    <option key={idx} value={idx}>{header}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Data Preview Table */}
          <div className="mt-6 border rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="bg-slate-50 p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">Preview: {currentFileData.card_info}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 font-bold text-xs border-b border-slate-100">
                  <tr>
                    {currentFileData.columns.map((h, i) => {
                      const isSelected = Object.values(currentFileData.columnMapping).includes(i);
                      const mappedField = Object.keys(currentFileData.columnMapping).find(key => currentFileData.columnMapping[key] === i);
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
                  {currentFileData.preview_data.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50">
                      {currentFileData.columns.map((_, cIdx) => {
                        const isSelected = Object.values(currentFileData.columnMapping).includes(cIdx);
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

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={startSorting}>Start Categorizing ({processedFiles.length} files) &rarr;</Button>
          </div>
        </div>
      )}

      {step === 3 && currentTx && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8 relative">
            {/* Source Badge */}
            <div className="absolute top-4 right-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm opacity-80">
              <CreditCard className="w-3 h-3" /> {currentTx.sourceCard}
            </div>

            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start pt-10">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{currentTx.description}</h3>
                <div className="text-sm text-slate-500 mt-1">{currentTx.date}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-mono font-bold text-slate-800">{currentTx.amount} <span className="text-lg text-slate-400">{currentTx.currency}</span></div>
                {currentTx.originalCategory && (
                  <div className="inline-block mt-2 px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">File: {currentTx.originalCategory}</div>
                )}
              </div>
            </div>

            <div className="p-6">
              {isCreatingCat ? (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-2 text-sm">New Category Name</h4>
                  <div className="flex gap-2">
                    <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-2 border border-slate-300 rounded-lg outline-none" placeholder="e.g. Pet Supplies" autoFocus />
                    <Button onClick={handleQuickAddCategory} disabled={!newCatName}>Add</Button>
                    <Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {sortedCategories.map(cat => {
                    const isSuggested = suggestedCategoryId === cat.id;
                    return (
                      <button key={cat.id} onClick={() => handleCategorize(cat.name)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isSuggested ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                        <span className={`text-xs font-bold ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span>
                      </button>
                    );
                  })}
                  <button onClick={() => setIsCreatingCat(true)} className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-slate-400 hover:text-emerald-600">
                    <Plus className="w-6 h-6" /><span className="text-xs font-bold">New Cat</span>
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                <button onClick={handleSkip} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors px-4 py-2"><Trash2 className="w-5 h-5" /> Skip</button>
                <button onClick={() => handleCategorize('Refunded', true)} className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors px-4 py-2"><XCircle className="w-5 h-5" /> Mark Refunded</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Import Complete!</h3>
          <Button onClick={onComplete}>Go to Dashboard</Button>
        </div>
      )}
    </div>
  );
};