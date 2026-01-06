import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Receipt, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDocs } from 'firebase/firestore';
import { db, CLOUD_RUN_URL, logUserAction } from '../../config/firebase.js';
import { DEFAULT_CATEGORIES } from '../../config/constants.js';

import { ExpenseMonthSelector } from './components/ExpenseMonthSelector';
import { ExpenseUpload } from './components/ExpenseUpload';
import { ExpenseManualForm } from './components/ExpenseManualForm';
import { ExpenseStepVerify } from './components/ExpenseStepVerify';
import { ExpenseStepCategorize } from './components/ExpenseStepCategorize';
import { ExpenseSuccess } from './components/ExpenseSuccess';
import { ProgressBar } from './components/ProgressBar';
import { RecurringCard } from './components/RecurringCard';
import { RecurringForm } from './components/RecurringForm';

export const ExpenseNode = ({ userId, categories, expenses, onUpdateCategories, onComplete }) => {
  const { t } = useTranslation();
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
  const [uploadProgress, setUploadProgress] = useState(null); // { progress_percent, current_step, etc }
  const [editingExpense, setEditingExpense] = useState(null);
  const [showManualTypeSelector, setShowManualTypeSelector] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [recurringExpenses, setRecurringExpenses] = useState([]);

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

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Fetch recurring expenses
  useEffect(() => {
    if (!userId) return;
    fetchRecurringExpenses();
  }, [userId]);

  const fetchRecurringExpenses = async () => {
    try {
      const recurringRef = collection(db, 'users', userId, 'recurring_expenses');
      const snapshot = await getDocs(recurringRef);
      const recurring = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecurringExpenses(recurring);
    } catch (err) {
      console.error('Failed to fetch recurring expenses:', err);
    }
  };

  const sortedCategories = categories;

  const processingTimeEstimate = useMemo(() => {
    if (!files.length) return null;
    const hasPdf = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
    const baseMin = hasPdf ? 30 : 20;
    const baseMax = hasPdf ? 60 : 30;

    if (files.length === 1) {
      return hasPdf ? "30s - 1 min" : "20s - 30s";
    }

    const min = baseMin * files.length;
    const max = baseMax * files.length;
    return `${min}s - ${max}s`;
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
      alert(t('expenses.maxFilesError'));
      return;
    }
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const pollUploadStatus = async (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${CLOUD_RUN_URL}/upload-status?job_id=${jobId}`);
        if (!response.ok) {
          clearInterval(interval);
          throw new Error(`Polling failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Update progress
        if (data.progress) {
          setUploadProgress(data.progress);
        }

        // Check if completed
        if (data.status === 'completed' && data.result) {
          clearInterval(interval);
          setPollingInterval(null);
          setUploadProgress(null);

          // Process result same as sync
          const initProcessed = data.result.files.map(f => ({
            ...f,
            columnMapping: mapBackendToIndices(f.suggested_mapping, f.columns)
          }));

          setProcessedFiles(initProcessed);
          setIsLoading(false);
          setStep(2);
          logUserAction(userId, 'FILE_ANALYSIS', `Analyzed ${files.length} files (async)`);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPollingInterval(null);
          setUploadProgress(null);
          setIsLoading(false);
          setError(data.progress?.current_step || "Processing failed");
          logUserAction(userId, 'ANALYSIS_ERROR', `Async job failed`);
        }
      } catch (err) {
        clearInterval(interval);
        setPollingInterval(null);
        setUploadProgress(null);
        setIsLoading(false);
        setError(err.message || "Failed to poll status");
      }
    }, 1500); // Poll every 1.5 seconds

    setPollingInterval(interval);
  };

  const handleUploadAndAnalyze = async () => {
    if (files.length === 0) return;

    setIsLoading(true);
    setError(null);
    setUploadProgress(null);

    // Start estimated progress animation
    const hasPdf = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
    const estimatedSeconds = hasPdf ? files.length * 60 : files.length * 15;

    let elapsed = 0;
    const progressInterval = setInterval(() => {
      elapsed += 3;  // Update every 3 seconds
      const percent = Math.min(95, Math.floor((elapsed / estimatedSeconds) * 100));

      setUploadProgress({
        progress_percent: percent,
        current_step: hasPdf ? `Processing ${files.length} file(s)... Est. ${estimatedSeconds}s` : `Analyzing ${files.length} file(s)...`,
        estimated_seconds_remaining: Math.max(0, estimatedSeconds - elapsed),
        completed_files: Math.floor((percent / 100) * files.length),
        total_files: files.length
      });
    }, 3000);  // Update every 3 seconds instead of 1 second

    setPollingInterval(progressInterval);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured.");

      const response = await fetch(`${CLOUD_RUN_URL}/analyze-file`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);

      const data = await response.json();
      if (data.status === 'error') throw new Error(data.message);

      // Stop progress animation
      clearInterval(progressInterval);
      setPollingInterval(null);
      setUploadProgress({ progress_percent: 100, current_step: "Complete!" });

      // Small delay to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));

      const initProcessed = data.files.map(f => ({
        ...f,
        columnMapping: mapBackendToIndices(f.suggested_mapping, f.columns)
      }));

      setProcessedFiles(initProcessed);
      setUploadProgress(null);
      setStep(2);
      logUserAction(userId, 'FILE_ANALYSIS', `Analyzed ${files.length} files`);
    } catch (err) {
      clearInterval(progressInterval);
      setPollingInterval(null);
      setUploadProgress(null);
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

  const handleUpdateTransaction = (updatedFields) => {
    const updatedTx = [...allTransactions];
    updatedTx[currentIndex] = {
      ...updatedTx[currentIndex],
      ...updatedFields
    };
    setAllTransactions(updatedTx);
    setIsEditingAmount(false);
  };

  // State for Card Popup
  const [cardPopup, setCardPopup] = useState({ show: false, prevCard: '', nextCard: '' });
  // State for showing previous choice on undo
  const [lastUndoChoice, setLastUndoChoice] = useState(null);

  const handleCategorize = (categoryName, isRefund = false, isSuspect = false, recurringId = null, note = null) => {
    // Guard: Prevent race condition double-submission
    if (isLoading) return;

    if (isManualMode) {
      if (!manualData.amount || !manualData.description) {
        alert(t('expenses.manual.enterAmountAndDescription'));
        return;
      }
      saveManualTransaction(categoryName, isRefund, isSuspect);
      return;
    }

    const currentTx = allTransactions[currentIndex];

    const tx = {
      ...currentTx,
      date: currentTx.date || new Date().toISOString(),
      assignedCategory: categoryName,
      reportMonth: reportMonth,
      isRefund: isRefund,
      isSuspect: isSuspect, // Add suspect flag
      isRecurring: !!recurringId, // NEW: mark as recurring
      recurringExpenseId: recurringId || null, // NEW: link to recurring
      note: note || currentTx.note || null, // Save the note (e.g., suspect reason)
      status: 'active'
    };

    // Check for card change
    const nextIndex = currentIndex + 1;
    if (nextIndex < allTransactions.length) {
      const nextTx = allTransactions[nextIndex];
      if (currentTx.sourceCard !== nextTx.sourceCard) {
        setCardPopup({ show: true, prevCard: currentTx.sourceCard, nextCard: nextTx.sourceCard });
        // Don't move next yet, wait for popup close
        setProcessedTransactions(prev => [...prev, tx]);
        return;
      }
    }

    setProcessedTransactions(prev => [...prev, tx]);
    setLastUndoChoice(null); // Clear undo choice on new forward move
    moveToNext();
  };

  const confirmCardSwitch = () => {
    setCardPopup({ ...cardPopup, show: false });
    moveToNext();
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const lastTx = processedTransactions[processedTransactions.length - 1]; // Get the one we are undoing
      setLastUndoChoice(lastTx?.assignedCategory || (lastTx?.isRefund ? 'Refunded' : null) || (lastTx?.isSuspect ? 'Suspect' : null));
      setCurrentIndex(prev => prev - 1);
      setProcessedTransactions(prev => prev.slice(0, -1));
    }
  };

  const saveManualTransaction = async (categoryName, isRefund = false, isSuspect = false) => {
    setIsLoading(true);
    try {
      const expensesRef = collection(db, 'users', userId, 'expenses');

      await addDoc(expensesRef, {
        date: new Date(manualData.date).toISOString(),
        description: manualData.description,
        amount: parseFloat(manualData.amount),
        currency: manualData.currency,
        assignedCategory: categoryName,
        reportMonth: reportMonth,
        isRefund: isRefund,
        isSuspect: isSuspect,
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

  const handleSkip = () => {
    if (isLoading) return;
    moveToNext();
  };
  const moveToNext = () => currentIndex < allTransactions.length - 1 ? setCurrentIndex(prev => prev + 1) : finishImport();

  const finishImport = async () => {
    setIsLoading(true);
    try {
      const expensesRef = collection(db, 'users', userId, 'expenses');

      // Group transactions by signature to handle legitimate duplicates (e.g., 2 coffees same day)
      const transactionGroups = {};
      processedTransactions.forEach(tx => {
        const sig = `${tx.date.split('T')[0]}_${tx.amount}_${tx.description.replace(/[^a-zA-Z0-9]/g, '')}`;
        if (!transactionGroups[sig]) transactionGroups[sig] = [];
        transactionGroups[sig].push(tx);
      });

      // Save with deterministic IDs + counter for same-day duplicates
      const savePromises = [];
      Object.entries(transactionGroups).forEach(([sig, txList]) => {
        txList.forEach((tx, index) => {
          const txDate = tx.date.split('T')[0];
          const safeDesc = tx.description.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
          const safeCard = tx.sourceCard ? tx.sourceCard.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : 'unknown';
          const uniqueId = `${txDate}_${tx.amount}_${safeDesc}_${safeCard}_${index}`;

          savePromises.push(setDoc(doc(expensesRef, uniqueId), {
            ...tx,
            source: "smart_import",
            createdAt: serverTimestamp()
          }));
        });
      });

      await Promise.all(savePromises);
      logUserAction(userId, 'IMPORT_COMPLETE', `Imported ${processedTransactions.length} transactions`);
      setStep(4);
    } catch (err) {
      console.error('Save error:', err);
      setError("Failed to save transactions.");
    } finally {
      setIsLoading(false);
    }
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
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Upload className="w-6 h-6 text-emerald-600" /> {t('expenses.title')}</h2>
          <p className="text-slate-500 mt-1">
            {isManualMode ? t('expenses.addSingleExpense') : step === 3 ? t('expenses.itemCount', { current: currentIndex + 1, total: allTransactions.length }) : t('expenses.uploadAndMerge')}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Upload Files (2 columns on large screens) */}
            <div className="lg:col-span-2">
              <ExpenseUpload
                files={files}
                onFileChange={handleFileChange}
                onRemoveFile={removeFile}
                onManualConfig={() => setShowManualTypeSelector(true)}
                error={error}
                onBack={() => setStep(0)}
                processingTimeEstimate={processingTimeEstimate}
                onAnalyze={handleUploadAndAnalyze}
                isLoading={isLoading}
              />
            </div>

            {/* Right: Recurring Expenses (1 column) */}
            <div className="lg:col-span-1">
              <RecurringCard
                userId={userId}
                categories={sortedCategories}
                recurringExpenses={recurringExpenses}
                onUpdate={fetchRecurringExpenses}
              />
            </div>
          </div>

          {/* Progress Bar for Async Processing */}
          {isLoading && uploadProgress && (
            <div className="mt-6">
              <ProgressBar
                progress={uploadProgress}
                processingTimeEstimate={processingTimeEstimate}
              />
            </div>
          )}
        </div>
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
          lastUndoChoice={lastUndoChoice} // Pass undo choice
          onUpdateTransaction={handleUpdateTransaction} // New generic update
          categories={sortedCategories}
          suggestedCategoryId={suggestedCategoryId}
          onCategorize={handleCategorize}
          onSkip={handleSkip}
          cleanDateDisplay={cleanDateDisplay}
          recurringExpenses={recurringExpenses}
        />
      )}

      {cardPopup.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl scale-100">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{t('expenses.cardPopup.cardCompleted')}</h3>
            <p className="text-slate-500 mb-6 font-medium">
              {t('expenses.cardPopup.youFinished', { prevCard: cardPopup.prevCard })}
              <br />{t('expenses.cardPopup.movingTo', { nextCard: cardPopup.nextCard })}
            </p>
            <button onClick={confirmCardSwitch} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-200">
              {t('expenses.cardPopup.continue')}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <ExpenseSuccess
          isManualMode={isManualMode}
          onReset={() => {
            setStep(0);
            setFiles([]);
            setProcessedFiles([]);
            setIsManualMode(false);
            // Reset manual data for next entry
            setManualData({
              date: new Date().toISOString().slice(0, 10),
              description: '',
              amount: '',
              currency: 'ILS',
              category: ''
            });
          }}
          onComplete={onComplete}
        />
      )}

      {/* Manual Entry Type Selector Modal */}
      {showManualTypeSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-slate-800">{t('expenses.manualTypeSelector.title')}</h3>
              <button onClick={() => setShowManualTypeSelector(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">{t('expenses.manualTypeSelector.chooseType')}</p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowManualTypeSelector(false);
                  setIsManualMode(true);
                }}
                className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center text-center group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
                <div className="font-bold text-slate-800">{t('expenses.manualTypeSelector.oneTime')}</div>
                <div className="text-xs text-slate-500 mt-1">{t('expenses.manualTypeSelector.oneTimeDesc')}</div>
              </button>

              <button
                onClick={() => {
                  setShowManualTypeSelector(false);
                  setShowRecurringForm(true);
                }}
                className="p-6 rounded-xl border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center text-center group"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-purple-600" />
                </div>
                <div className="font-bold text-slate-800">{t('expenses.manualTypeSelector.recurring')}</div>
                <div className="text-xs text-slate-500 mt-1">{t('expenses.manualTypeSelector.recurringDesc')}</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Form Modal */}
      {showRecurringForm && (
        <RecurringForm
          userId={userId}
          categories={sortedCategories}
          editData={editingExpense}
          onAddCategory={async (categoryData) => {
            const newId = categoryData.name.toLowerCase().replace(/\s+/g, '_');
            const newCat = {
              id: newId,
              name: categoryData.name,
              icon: categoryData.icon || 'Star',
              color: categoryData.color || '#10b981'
            };
            const updated = [...categories, newCat];
            onUpdateCategories(updated);

            // Save to Firestore
            await setDoc(doc(db, 'users', userId), {
              customCategories: updated.filter(c => !DEFAULT_CATEGORIES.find(dc => dc.id === c.id))
            }, { merge: true });
          }}
          onSave={() => {
            setShowRecurringForm(false);
            setEditingExpense(null);
            fetchRecurringExpenses();
          }}
          onCancel={() => {
            setShowRecurringForm(false);
            setEditingExpense(null);
          }}
        />
      )}
    </div >
  );
};
