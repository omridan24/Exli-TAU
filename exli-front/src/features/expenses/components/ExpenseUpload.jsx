import React from 'react';
import { Upload, Trash2, FileText, XCircle, Clock, ArrowRight, Sparkles, PenTool } from 'lucide-react';
import { Button } from '../../../components/UI';

export const ExpenseUpload = ({
    files,
    onFileChange,
    onRemoveFile,
    onManualConfig,
    error,
    onBack,
    processingTimeEstimate,
    onAnalyze,
    isLoading
}) => {
    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative flex flex-col items-center justify-center min-h-[200px]">
                    <input type="file" accept=".csv, .xls, .xlsx, .pdf" multiple onChange={onFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className="w-12 h-12 text-slate-300 mb-4" />
                    <div className="font-bold text-lg text-slate-600">Drop files here or Click</div>
                    <p className="text-sm text-slate-400 mt-1">Up to 4 files (PDF, Excel, CSV)</p>
                </div>
                <div onClick={onManualConfig} className="w-1/3 border-2 border-slate-100 rounded-2xl p-8 text-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group">
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
                            <button onClick={() => onRemoveFile(i)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start gap-3 text-sm animate-fade-in text-left">
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-bold">Analysis Failed</div>
                        <div>{error}</div>
                        <div className="text-xs text-red-400 mt-1">Please try again or use manual entry.</div>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center">
                <Button variant="secondary" onClick={onBack}>Back</Button>
                <div className="flex items-center gap-4">
                    {processingTimeEstimate && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 animate-fade-in">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Est. {processingTimeEstimate}</span>
                        </div>
                    )}
                    <Button onClick={onAnalyze} disabled={files.length === 0 || isLoading}>
                        {isLoading ? <><Sparkles className="w-4 h-4 animate-spin text-yellow-400" /> Analyzing {files.length} files...</> : <>Analyze Files <ArrowRight className="w-4 h-4" /></>}
                    </Button>
                </div>
            </div>
        </div>
    );
};
