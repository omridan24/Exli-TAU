import React, { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { CURRENCIES } from '../../config/constants.js';

import { IncomeMonthSelector } from './components/IncomeMonthSelector';
import { IncomeUpload } from './components/IncomeUpload';
import { IncomeForm } from './components/IncomeForm';
import { IncomeSuccess } from './components/IncomeSuccess';

export const IncomeNode = ({ userId, onComplete }) => {
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
        }
        loadUserData();
    }, [userId]);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            handleAnalyzeIncome(e.target.files[0]);
        }
    };

    const handleInputChange = (field, val) => setIncomeData(prev => ({ ...prev, [field]: val }));

    const handleAnalyzeIncome = async (uploadedFile) => {
        const f = uploadedFile || file;
        if (!f) return;
        setIsLoading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', f);
        try {
            if (!CLOUD_RUN_URL || CLOUD_RUN_URL.includes("YOUR_CLOUD_RUN")) throw new Error("Backend URL not configured.");
            const response = await fetch(`${CLOUD_RUN_URL}/analyze-income`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);
            const res = await response.json();
            if (res.status === 'success' && res.data) {
                setIncomeData(prev => ({
                    ...prev,
                    bruto: res.data.bruto || '', neto: res.data.neto || '',
                    taxes: res.data.taxes || '', pension: res.data.pension || '',
                    other_deposits: res.data.other_deposits || ''
                }));
                setStep(2);
            } else { throw new Error("AI could not extract data."); }
        } catch (err) { setError(err.message || "Failed to analyze file."); } finally { setIsLoading(false); }
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
                        <Wallet className="w-6 h-6 text-emerald-600" /> Income Manager
                    </h2>
                    <p className="text-slate-500 mt-1">Track monthly earnings.</p>
                </div>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="p-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {step === 0 && (
                <IncomeMonthSelector
                    reportMonth={reportMonth}
                    setReportMonth={setReportMonth}
                    onContinue={() => setStep(1)}
                />
            )}

            {step === 1 && (
                <IncomeUpload
                    isLoading={isLoading}
                    handleFileChange={handleFileChange}
                    setStep={setStep}
                    error={error}
                    onBack={() => setStep(0)}
                />
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
                    onBack={() => setStep(1)}
                />
            )}

            {step === 3 && (
                <IncomeSuccess
                    reportMonth={reportMonth}
                    onReset={resetForAnother}
                    onComplete={onComplete}
                />
            )}
        </div>
    );
};
