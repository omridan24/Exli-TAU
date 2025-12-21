import React from 'react';
import { Sparkles, Clock, Upload, PenTool } from 'lucide-react';
import { Button } from '../../../components/UI.jsx';

export const IncomeUpload = ({ isLoading, handleFileChange, setStep, error, onBack }) => {
    return (
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
            <div className="flex justify-start"><Button variant="secondary" onClick={onBack} disabled={isLoading}>Back</Button></div>
        </div>
    );
};
