import React, { useState, useEffect } from 'react';
import { Wallet, Receipt, Repeat, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { CURRENCIES } from '../../config/constants.js';

import { IncomeUpload } from './components/IncomeUpload';
import { IncomeForm } from './components/IncomeForm';
import { IncomeSuccess } from './components/IncomeSuccess';
import { RecurringIncomeCard } from './components/RecurringIncomeCard';
import { RecurringIncomeForm } from './components/RecurringIncomeForm';
import { OneTimeIncomeForm } from './components/OneTimeIncomeForm';
import { IncomeBatchReview } from './components/IncomeBatchReview';
import { useCurrencyPrefs } from '../../lib/fx/useCurrencyPrefs';

export const IncomeNode = ({ userId, onComplete, compact = false }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [files, setFiles] = useState([]);
    const [batchResults, setBatchResults] = useState([]);
    const [selectedResultIndex, setSelectedResultIndex] = useState(null);
    // Seeded from the user's real default currency (docs/fx/01-fx-plan.md §4)
    // rather than a hardcoded 'USD' - still independently changeable here,
    // since a job can pay in a different currency than the one you live in.
    const { prefs: currencyPrefs } = useCurrencyPrefs(userId);
    const [currency, setCurrency] = useState(currencyPrefs.defaultCurrency);
    useEffect(() => { setCurrency(currencyPrefs.defaultCurrency); }, [currencyPrefs.defaultCurrency]);
    const [workplaces, setWorkplaces] = useState([]);
    const [incomeData, setIncomeData] = useState({
        source_name: '', bruto: '', neto: '', taxes: '', pension: '', other_deposits: ''
    });
    const [uploadProgress, setUploadProgress] = useState(null);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [recurringIncomes, setRecurringIncomes] = useState([]);
    const [showManualSelector, setShowManualSelector] = useState(false);
    const [showRecurringForm, setShowRecurringForm] = useState(false);
    const [showOneTimeForm, setShowOneTimeForm] = useState(false);
    const [isManualMode, setIsManualMode] = useState(false);
    const [extractedData, setExtractedData] = useState(null);

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

    // Fetch recurring income
    const fetchRecurringIncome = async () => {
        try {
            const incomeRef = collection(db, 'users', userId, 'recurring_income');
            const snapshot = await getDocs(incomeRef);
            const incomes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecurringIncomes(incomes);
        } catch (err) {
            console.error('Failed to fetch recurring income:', err);
        }
    };

    useEffect(() => {
        const loadUserData = async () => {
            if (!userId) return;
            const snap = await getDoc(doc(db, 'users', userId));
            if (snap.exists()) {
                const data = snap.data();
                if (data.preferredCurrency) setCurrency(data.preferredCurrency);

                // Fetch unified workplaces from profile
                const savedWorkplaces = data.profile?.workplaces || data.workplaces || [];
                setWorkplaces(savedWorkplaces);
            }
            fetchRecurringIncome();
        }
        loadUserData();
    }, [userId]);

    useEffect(() => {
        return () => {
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [pollingInterval]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleInputChange = (field, val) => setIncomeData(prev => ({ ...prev, [field]: val }));

    const handleAnalyzeBatch = async (uploadedFiles) => {
        const fs = uploadedFiles && uploadedFiles.length > 0 ? uploadedFiles : files;
        if (!fs || fs.length === 0) return;

        setIsLoading(true);
        setError(null);
        setUploadProgress(null);

        // Start progress estimation
        const estimatedSeconds = 30; // slightly longer for batch
        let elapsed = 0;
        const progressInterval = setInterval(() => {
            elapsed += 1;
            const percent = Math.min(95, Math.floor((elapsed / estimatedSeconds) * 100));
            setUploadProgress({
                progress_percent: percent,
                current_step: t('income.upload.analyzingPayslip', 'Analyzing payslips...'),
                estimated_seconds_remaining: Math.max(0, estimatedSeconds - elapsed)
            });
        }, 1000);

        setPollingInterval(progressInterval);

        const formData = new FormData();
        fs.forEach(f => formData.append('files', f));
        formData.append('userId', userId);

        try {
            if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) {
                throw new Error("Backend URL not configured.");
            }

            const response = await fetch(`${CLOUD_RUN_URL}/analyze-payslips-batch`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);

            const res = await response.json();

            // Stop progress
            clearInterval(progressInterval);
            setPollingInterval(null);
            setUploadProgress({ progress_percent: 100, current_step: "Analysis Complete!" });

            await new Promise(resolve => setTimeout(resolve, 800));

            if (res.status === 'success' && res.results) {
                // Pre-process results: status from backend is "success" or "error", map to pending for UI review
                const processedResults = res.results.map(r => ({
                    ...r,
                    status: r.status === 'success' ? 'pending' : 'error'
                }));
                setBatchResults(processedResults);
                setUploadProgress(null);
                setStep(4); // Go to batch review
            } else {
                throw new Error("AI could not extract detailed data from these payslips.");
            }
        } catch (err) {
            clearInterval(progressInterval);
            setPollingInterval(null);
            setUploadProgress(null);
            setError(err.message || "Failed to analyze payslips.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!incomeData.source_name) {
            setError("Please provide a name or source for this income.");
            return;
        }
        setIsLoading(true);
        try {
            const originalFields = {
                bruto: Number(incomeData.bruto), neto: Number(incomeData.neto), taxes: Number(incomeData.taxes),
                pension: Number(incomeData.pension), other_deposits: Number(incomeData.other_deposits)
            };
            // Saved in the currency it was entered in; a ForeignCurrencyAlert offers the conversion later.
            await addDoc(collection(db, 'users', userId, 'income'), {
                ...incomeData,
                ...originalFields,
                month: reportMonth, currency, createdAt: serverTimestamp(), source: 'manual'
            });
            setStep(3);
        } catch (err) { setError("Failed to save income data."); } finally { setIsLoading(false); }
    };

    const resetForAnother = () => {
        setIncomeData({ source_name: '', bruto: '', neto: '', taxes: '', pension: '', other_deposits: '' });
        setFiles([]);
        setBatchResults([]);
        setSelectedResultIndex(null);
        setStep(1);
    };

    return (
        <div className={`animate-fade-in ${compact ? '' : 'p-6 max-w-4xl mx-auto'}`}>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-emerald-600" /> {t('income.title')}
                    </h2>
                    <p className="text-slate-500 mt-1">{t('income.trackMonthlyEarnings')}</p>
                </div>

            </div>

            {step === 1 && (
                <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-3'} gap-6`}>
                    {/* Left: Upload & Manual Entry */}
                    <div className={compact ? '' : 'lg:col-span-2'}>
                        <IncomeUpload
                            files={files}
                            onFileChange={handleFileChange}
                            onRemoveFile={(idx) => {
                                setFiles(prev => prev.filter((_, i) => i !== idx));
                            }}
                            onManualConfig={() => setShowManualSelector(true)}
                            isLoading={isLoading}
                            uploadProgress={uploadProgress}
                            onAnalyze={() => handleAnalyzeBatch()}
                            error={error}
                        />
                    </div>

                    {/* Right: Recurring Income Dashboard */}
                    <div className={compact ? 'mt-6' : 'lg:col-span-1'}>
                        <RecurringIncomeCard
                            userId={userId}
                            workplaces={workplaces}
                            recurringIncomes={recurringIncomes}
                            onUpdate={fetchRecurringIncome}
                        />
                    </div>
                </div>
            )}

            {step === 2 && (
                <IncomeForm
                    incomeData={incomeData}
                    handleInputChange={handleInputChange}
                    workplaces={workplaces}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                    handleSave={handleSave}
                    isLoading={isLoading}
                    error={error}
                    onBack={() => { setStep(1); setIsManualMode(false); }}
                />
            )}

            {step === 3 && (
                <IncomeSuccess
                    reportMonth={reportMonth}
                    onReset={resetForAnother}
                    onComplete={onComplete}
                />
            )}

            {step === 4 && (
                <IncomeBatchReview
                    batchResults={batchResults}
                    workplaces={workplaces}
                    onAddWorkplace={async (company) => {
                        // Avoid duplicates
                        if (!workplaces.find(w => w.name === company.name)) {
                            const newWorkplaces = [...workplaces, company];
                            setWorkplaces(newWorkplaces);
                            if (userId) {
                                try {
                                    await updateDoc(doc(db, 'users', userId), {
                                        'profile.workplaces': newWorkplaces
                                    });
                                } catch (e) {
                                    console.error('Failed to update workplaces in DB', e);
                                }
                            }
                        }
                    }}
                    onUpdateRow={(idx, updates) => {
                        setBatchResults(prev => {
                            const newRes = [...prev];
                            newRes[idx] = {
                                ...newRes[idx],
                                data: { ...newRes[idx].data, ...updates }
                            };
                            return newRes;
                        });
                    }}
                    onRowClick={(idx) => {
                        setSelectedResultIndex(idx);
                        setExtractedData(batchResults[idx].data);
                        if (batchResults[idx].data?.pay_month) {
                            setReportMonth(batchResults[idx].data.pay_month);
                        }
                        setShowOneTimeForm(true);
                    }}
                    onComplete={() => {
                        setFiles([]);
                        setStep(3); // Show success screen
                    }}
                    onDeleteRow={(idx) => {
                        setBatchResults(prev => {
                            const newRes = prev.filter((_, i) => i !== idx);
                            if (newRes.length === 0) {
                                setFiles([]);
                                setStep(1); // Go back to start
                            }
                            return newRes;
                        });
                    }}
                />
            )}

            {/* Manual Entry Type Selector Modal */}
            {showManualSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">{t('income.typeSelector.title')}</h2>
                            <button onClick={() => setShowManualSelector(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {/* LEFT: One-Time Income */}
                            <button
                                onClick={() => {
                                    setShowManualSelector(false);
                                    setShowOneTimeForm(true);
                                }}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📅</div>
                                <div className="font-bold text-lg text-slate-800 mb-2">
                                    {t('income.typeSelector.oneTime')}
                                </div>
                                <div className="text-sm text-slate-600">
                                    {t('income.typeSelector.oneTimeDescNoFile')}
                                </div>
                            </button>

                            {/* RIGHT: Recurring Income */}
                            <button
                                onClick={() => {
                                    setShowManualSelector(false);
                                    setShowRecurringForm(true);
                                }}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50 transition-all text-left group"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🔄</div>
                                <div className="font-bold text-lg text-slate-800 mb-2">
                                    {t('income.typeSelector.recurring')}
                                </div>
                                <div className="text-sm text-slate-600">
                                    {t('income.typeSelector.recurringDescNoFile')}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recurring Form Modal */}
            {showRecurringForm && (
                <RecurringIncomeForm
                    userId={userId}
                    workplaces={workplaces}
                    currency={currency}
                    extractedData={extractedData}
                    onSave={() => {
                        setShowRecurringForm(false);
                        setExtractedData(null);
                        setFiles([]);
                        fetchRecurringIncome();
                    }}
                    onCancel={() => { setShowRecurringForm(false); setExtractedData(null); }}
                />
            )}

            {/* One-Time Income Form Modal */}
            {showOneTimeForm && (
                <OneTimeIncomeForm
                    userId={userId}
                    workplaces={workplaces}
                    currency={currency}
                    reportMonth={reportMonth}
                    extractedData={extractedData}
                    existingId={selectedResultIndex !== null ? batchResults[selectedResultIndex].savedData?.id : undefined}
                    savedData={selectedResultIndex !== null ? batchResults[selectedResultIndex].savedData : undefined}
                    onSave={(savedId, savedIncomeData) => {
                        setShowOneTimeForm(false);
                        setExtractedData(null);
                        if (step === 4 && selectedResultIndex !== null) {
                            setBatchResults(prev => {
                                const newRes = [...prev];
                                newRes[selectedResultIndex] = {
                                    ...newRes[selectedResultIndex],
                                    status: 'saved',
                                    savedData: savedIncomeData
                                };
                                return newRes;
                            });
                        } else {
                            setFiles([]);
                            setStep(3); // Go to success screen
                        }
                    }}
                    onCancel={() => {
                        setShowOneTimeForm(false);
                        setExtractedData(null);
                        setSelectedResultIndex(null);
                    }}
                />
            )}
        </div>
    );
};
