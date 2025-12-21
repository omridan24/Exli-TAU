import React, { useState, useMemo, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL, logUserAction } from '../../config/firebase.js';
import { DEFAULT_CATEGORIES } from '../../config/constants.js';

import { ExpenseMonthSelector } from './components/ExpenseMonthSelector';
import { ExpenseUpload } from './components/ExpenseUpload';
import { ExpenseManualForm } from './components/ExpenseManualForm';
import { ExpenseStepVerify } from './components/ExpenseStepVerify';
import { ExpenseStepCategorize } from './components/ExpenseStepCategorize';
import { ExpenseSuccess } from './components/ExpenseSuccess';

export const ExpenseNode = ({ userId, categories, expenses, onUpdateCategories, onComplete }) => {
  const [step, setStep] = useState(0);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allTransactions, setAllTransactions] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editAmountValue, setEditAmountValue] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    currency: 'ILS',
    category: ''
  });

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isLoading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading]);

  const sortedCategories = categories;

  const processingTimeEstimate = useMemo(() => {
    if (!files.length) return null;
    const hasPdf = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
    return hasPdf ? "30s - 1 min" : "10s - 20s";
  }, [files]);

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
    return isoString.split('T')[0];
  };

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
      if (data.status === 'error') throw new Error(data.message);

      const initProcessed = data.files.map(f => ({
        ...f,
        columnMapping: mapBackendToIndices(f.suggested_mapping, f.columns)
      }));

      setProcessedFiles(initProcessed);
      setStep(2);
      logUserAction(userId, 'FILE_ANALYSIS', `Analyzed ${files.length} files`);
    } catch (err) {
      setError(err.message || "Failed to analyze files.");
      logUserAction(userId, 'ANALYSIS_ERROR', `Error: ${err.message}`);
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
      setProcessedTransactions(prev => prev.slice(0, -1));
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
      logUserAction(userId, 'MANUAL_EXPENSE', `Added ${manualData.amount} for ${manualData.description}`);
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
    const newCat = { id: newId, name: newCatName, color: randomColor, icon: 'Star' };
    const updated = [...categories, newCat];
    onUpdateCategories(updated);
    await setDoc(doc(db, 'users', userId), {
      customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id))
    }, { merge: true });

    logUserAction(userId, 'CATEGORY_CREATE', `Created category: ${newCatName}`);
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
      logUserAction(userId, 'IMPORT_COMPLETE', `Imported ${processedTransactions.length} transactions`);
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
    <div className="p-6 max-w-4xl mx-auto animate-fade-in min-h-[600px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> Expense Manager</h2>
          <p className="text-slate-500 mt-1">
            {isManualMode ? "Add single expense." : step === 3 ? `Item ${currentIndex + 1} of ${allTransactions.length}` : "Upload & Merge."}
          </p>
        </div>
      </div>

      {step === 0 && !isManualMode && (
        <ExpenseMonthSelector
          reportMonth={reportMonth}
          setReportMonth={setReportMonth}
          onContinue={() => setStep(1)}
        />
      )}

      {step === 1 && !isManualMode && (
        <ExpenseUpload
          files={files}
          onFileChange={handleFileChange}
          onRemoveFile={removeFile}
          onManualConfig={() => setIsManualMode(true)}
          error={error}
          onBack={() => setStep(0)}
          processingTimeEstimate={processingTimeEstimate}
          onAnalyze={handleUploadAndAnalyze}
          isLoading={isLoading}
        />
      )}

      {isManualMode && !isCreatingCat && (
        <ExpenseManualForm
          manualData={manualData}
          setManualData={setManualData}
          categories={sortedCategories}
          onCategorize={handleCategorize}
          onCreateCategory={() => setIsCreatingCat(true)}
          onCancel={() => setIsManualMode(false)}
        />
      )}

      {step === 2 && currentFileData && (
        <ExpenseStepVerify
          currentFileIndex={currentFileIndex}
          totalFiles={processedFiles.length}
          fileData={currentFileData}
          onPrevFile={() => setCurrentFileIndex(prev => prev - 1)}
          onNextFile={() => setCurrentFileIndex(prev => prev + 1)}
          onUpdateMapping={updateMapping}
          onBack={() => setStep(1)}
          onStartCategorizing={startSorting}
        />
      )}

      {(step === 3 || (isManualMode && isCreatingCat)) && (
        <ExpenseStepCategorize
          isCreatingCat={isCreatingCat}
          setIsCreatingCat={setIsCreatingCat}
          newCatName={newCatName}
          setNewCatName={setNewCatName}
          onQuickAddCategory={handleQuickAddCategory}
          currentTx={currentTx}
          currentIndex={currentIndex}
          handleUndo={handleUndo}
          isEditingAmount={isEditingAmount}
          editAmountValue={editAmountValue}
          setEditAmountValue={setEditAmountValue}
          onSaveAmountEdit={handleSaveAmountEdit}
          onShiftAmount={handleShiftAmount}
          onStartEditAmount={() => { setIsEditingAmount(true); setEditAmountValue(currentTx.amount); }}
          categories={sortedCategories}
          suggestedCategoryId={suggestedCategoryId}
          onCategorize={handleCategorize}
          onSkip={handleSkip}
          cleanDateDisplay={cleanDateDisplay}
        />
      )}

      {step === 4 && (
        <ExpenseSuccess
          isManualMode={isManualMode}
          onReset={() => { setStep(0); setFiles([]); setProcessedFiles([]); setIsManualMode(false); }}
          onComplete={onComplete}
        />
      )}
    </div>
  );
};
