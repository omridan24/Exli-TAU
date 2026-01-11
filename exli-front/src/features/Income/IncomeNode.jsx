import React, { useState, useEffect } from 'react';
import { Wallet, Receipt, Repeat, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { CURRENCIES } from '../../config/constants.js';

import { IncomeMonthSelector } from './components/IncomeMonthSelector';
import { IncomeUpload } from './components/IncomeUpload';
import { IncomeForm } from './components/IncomeForm';
import { IncomeSuccess } from './components/IncomeSuccess';
import { RecurringIncomeCard } from './components/RecurringIncomeCard';
import { RecurringIncomeForm } from './components/RecurringIncomeForm';
import { OneTimeIncomeForm } from './components/OneTimeIncomeForm';

export const IncomeNode = ({ userId, onComplete }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [file, setFile] = useState(null);
    const [currency, setCurrency] = useState('USD');
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
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setShowManualSelector(true);
        }
    };

    const handleInputChange = (field, val) => setIncomeData(prev => ({ ...prev, [field]: val }));

    const handleAnalyzeIncome = async (uploadedFile, type = 'one-time') => {
        const f = uploadedFile || file;
        if (!f) return;

        setIsLoading(true);
        setError(null);
        setUploadProgress(null);

        // Start progress estimation
        const estimatedSeconds = 25;
        let elapsed = 0;
        const progressInterval = setInterval(() => {
            elapsed += 1;
            const percent = Math.min(95, Math.floor((elapsed / estimatedSeconds) * 100));
            setUploadProgress({
                progress_percent: percent,
                current_step: t('income.upload.analyzingPayslip'),
                estimated_seconds_remaining: Math.max(0, estimatedSeconds - elapsed)
            });
        }, 1000);

        setPollingInterval(progressInterval);

        const formData = new FormData();
        formData.append('file', f);
        formData.append('userId', userId);

        try {
            if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) {
                throw new Error("Backend URL not configured.");
            }

            // Using the new analyze-payslip endpoint for detailed extraction
            const response = await fetch(`${CLOUD_RUN_URL}/analyze-payslip`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);

            const res = await response.json();

            // Stop progress
            clearInterval(progressInterval);
            setPollingInterval(null);
            setUploadProgress({ progress_percent: 100, current_step: "Analysis Complete!" });

            await new Promise(resolve => setTimeout(resolve, 800));

            if (res.status === 'success' && res.data) {
                setExtractedData(res.data);
                setUploadProgress(null);

                // Open the correct form based on selection
                if (type === 'recurring') {
                    setShowRecurringForm(true);
                } else {
                    setShowOneTimeForm(true);
                }
            } else {
                throw new Error("AI could not extract detailed data from this payslip.");
            }
        } catch (err) {
            clearInterval(progressInterval);
            setPollingInterval(null);
            setUploadProgress(null);
            setError(err.message || "Failed to analyze payslip.");
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
            await addDoc(collection(db, 'users', userId, 'income'), {
                ...incomeData,
                bruto: Number(incomeData.bruto), neto: Number(incomeData.neto), taxes: Number(incomeData.taxes),
                pension: Number(incomeData.pension), other_deposits: Number(incomeData.other_deposits),
                month: reportMonth, currency: currency, createdAt: serverTimestamp(), source: file ? 'ai_scan' : 'manual'
            });
            setStep(3);
        } catch (err) { setError("Failed to save income data."); } finally { setIsLoading(false); }
    };

    const resetForAnother = () => {
        setIncomeData({ source_name: '', bruto: '', neto: '', taxes: '', pension: '', other_deposits: '' });
        setFile(null);
        setStep(1);
    };

    return (
        <div className="p-6 animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-emerald-600" /> {t('income.title')}
                    </h2>
                    <p className="text-slate-500 mt-1">{t('income.trackMonthlyEarnings')}</p>
                </div>

            </div>

            {step === 0 && (
                <IncomeMonthSelector
                    reportMonth={reportMonth}
                    setReportMonth={setReportMonth}
                    onContinue={() => setStep(1)}
                />
            )}

            {step === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Upload & Manual Entry */}
                    <div className="lg:col-span-2">
                        <IncomeUpload
                            file={file}
                            onFileChange={handleFileChange}
                            onRemoveFile={() => { setFile(null); setExtractedData(null); }}
                            onManualConfig={() => setShowManualSelector(true)}
                            isLoading={isLoading}
                            uploadProgress={uploadProgress}
                            onAnalyze={() => setShowManualSelector(true)}
                            error={error}
                            onBack={() => setStep(0)}
                        />
                    </div>

                    {/* Right: Recurring Income Dashboard */}
                    <div className="lg:col-span-1">
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
                                    if (file) {
                                        handleAnalyzeIncome(file, 'one-time');
                                    } else {
                                        setShowOneTimeForm(true);
                                    }
                                }}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📅</div>
                                <div className="font-bold text-lg text-slate-800 mb-2">
                                    {t('income.typeSelector.oneTime')}
                                </div>
                                <div className="text-sm text-slate-600">
                                    {file ? t('income.typeSelector.oneTimeDescWithFile') : t('income.typeSelector.oneTimeDescNoFile')}
                                </div>
                            </button>

                            {/* RIGHT: Recurring Income */}
                            <button
                                onClick={() => {
                                    setShowManualSelector(false);
                                    if (file) {
                                        handleAnalyzeIncome(file, 'recurring');
                                    } else {
                                        setShowRecurringForm(true);
                                    }
                                }}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50 transition-all text-left group"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🔄</div>
                                <div className="font-bold text-lg text-slate-800 mb-2">
                                    {t('income.typeSelector.recurring')}
                                </div>
                                <div className="text-sm text-slate-600">
                                    {file ? t('income.typeSelector.recurringDescWithFile') : t('income.typeSelector.recurringDescNoFile')}
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
                        setFile(null);
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
                    onSave={() => {
                        setShowOneTimeForm(false);
                        setExtractedData(null);
                        setFile(null);
                        setStep(3); // Go to success screen
                    }}
                    onCancel={() => { setShowOneTimeForm(false); setExtractedData(null); }}
                />
            )}
        </div>
    );
};
