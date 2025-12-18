import React, { useState, useEffect } from 'react';
import {
    Wallet, Sparkles, Upload, Shield, DollarSign,
    Activity, Tag, CheckCircle, ArrowRight, PenTool,
    Clock, Plus, Briefcase, Building2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../config/firebase.js';
import { CURRENCIES } from '../../config/constants.js';
import { Button } from '../../components/UI.jsx';

// --- SUB-COMPONENT: LOGO RENDERER ---
const LogoImage = ({ logo, domain, className = "w-6 h-6" }) => {
    const [error, setError] = useState(false);
    const logoUrl = domain && domain !== 'independent' ? `https://logo.clearbit.com/${domain}` : logo;

    if (error || !logoUrl) {
        return (
            <div className={`${className} rounded bg-slate-100 flex items-center justify-center border border-slate-200`}>
                <Building2 className="w-1/2 h-1/2 text-slate-400" />
            </div>
        );
    }

    return (
        <div className={`${className} rounded border border-slate-100 flex items-center justify-center bg-white overflow-hidden`}>
            <img src={logoUrl} alt="" className="w-full h-full object-contain p-0.5" onError={() => setError(true)} />
        </div>
    );
};

const IncomeCard = ({ label, field, color, icon: Icon, value, onChange, currency }) => (
    <div className={`p-4 rounded-xl border ${color} bg-white flex flex-col gap-2 transition-all focus-within:ring-2 ring-offset-1`}>
        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <Icon className="w-4 h-4" /> {label}
        </div>
        <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{currency}</span>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(field, e.target.value)}
                className="w-full pl-10 py-1 text-2xl font-bold text-slate-800 outline-none placeholder:text-slate-200"
                placeholder="0"
            />
        </div>
    </div>
);

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
                <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Select Income Month</h3>
                    <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none" />
                    <Button onClick={() => setStep(1)} className="w-full justify-center">Continue &rarr;</Button>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className={`flex-1 border-2 border-dashed rounded-2xl p-8 text-center transition-all relative flex flex-col items-center justify-center min-h-[220px] group ${isLoading ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                            {!isLoading && <input type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />}
                            {isLoading ? (
                                <>
                                    <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse mb-4" />
                                    <div className="font-black text-xl text-emerald-800 animate-pulse">Analyzing File...</div>
                                    <div className="flex items-center gap-2 mt-2 text-emerald-600 font-bold bg-white px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm"><Clock className="w-4 h-4" /><span>Est. 10s - 30s</span></div>
                                </>
                            ) : (
                                <><Upload className="w-12 h-12 text-slate-300 mb-4 group-hover:scale-110 transition-transform" /><div className="font-bold text-lg text-slate-600">Upload Payslip</div><p className="text-sm text-slate-400 mt-1">Auto-scan PDF or Image</p></>
                            )}
                        </div>
                        <div onClick={() => !isLoading && setStep(2)} className={`w-1/3 border-2 border-slate-100 rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-2 group ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer'}`}>
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><PenTool className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" /></div><div className="font-bold text-slate-600 group-hover:text-emerald-700">Fill Manually</div>
                        </div>
                    </div>
                    {error && <div className="text-red-500 text-center font-bold bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
                    <div className="flex justify-start"><Button variant="secondary" onClick={() => setStep(0)} disabled={isLoading}>Back</Button></div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5" /> Income Source / Name
                        </label>
                        <input
                            type="text"
                            placeholder="Type source or quick select below..."
                            value={incomeData.source_name}
                            onChange={(e) => handleInputChange('source_name', e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all mb-6"
                        />

                        {/* Unified Quick Select Section */}
                        {workplaces.length > 0 && (
                            <div className="space-y-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Quick Select Professional Identity</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {workplaces.map((w, i) => {
                                        const fullName = `${w.linkedOccupation} at ${w.name}`;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleInputChange('source_name', fullName)}
                                                className={`flex items-center gap-3 p-3 rounded-2xl text-left border transition-all hover:shadow-md ${incomeData.source_name === fullName ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-slate-100 hover:border-emerald-200'}`}
                                            >
                                                <LogoImage logo={w.logo} domain={w.domain} className="w-10 h-10 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <div className={`text-xs font-black truncate uppercase tracking-tighter ${incomeData.source_name === fullName ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                        {w.linkedOccupation}
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-700 truncate">
                                                        at {w.name}
                                                    </div>
                                                </div>
                                                {incomeData.source_name === fullName && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IncomeCard label="Bruto Income" field="bruto" value={incomeData.bruto} onChange={handleInputChange} currency={currency} color="border-emerald-200 text-emerald-600" icon={DollarSign} />
                        <IncomeCard label="Neto (Bank)" field="neto" value={incomeData.neto} onChange={handleInputChange} currency={currency} color="border-blue-200 text-blue-600" icon={Wallet} />
                        <IncomeCard label="Total Taxes" field="taxes" value={incomeData.taxes} onChange={handleInputChange} currency={currency} color="border-red-200 text-red-600" icon={Activity} />
                        <IncomeCard label="Pension" field="pension" value={incomeData.pension} onChange={handleInputChange} currency={currency} color="border-purple-200 text-purple-600" icon={Shield} />
                        <IncomeCard label="Other Deposits" field="other_deposits" value={incomeData.other_deposits} onChange={handleInputChange} currency={currency} color="border-orange-200 text-orange-600" icon={Tag} />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button onClick={() => setStep(1)} className="px-6 py-2 text-slate-400 hover:text-slate-600 font-bold transition-all">Back</button>
                        <Button onClick={handleSave} disabled={isLoading || !incomeData.source_name}>{isLoading ? 'Saving...' : 'Save Income'}</Button>
                    </div>
                    {error && <div className="text-red-500 text-center font-bold">{error}</div>}
                </div>
            )}

            {step === 3 && (
                <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Income Saved!</h3>
                    <p className="text-slate-500 mb-8">Financial data for <b>{reportMonth}</b> has been updated.</p>
                    <div className="flex justify-center gap-3">
                        <Button onClick={resetForAnother} variant="secondary" className="px-8"><Plus className="w-4 h-4" /> Add Another Income</Button>
                        <Button onClick={onComplete} className="px-8">Back to Dashboard</Button>
                    </div>
                </div>
            )}
        </div>
    );
};