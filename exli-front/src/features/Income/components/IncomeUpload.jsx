import React from 'react';
import { Sparkles, Upload, PenTool, FileText, Trash2, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/UI.jsx';
import { ProgressBar } from '../../expenses/components/ProgressBar.jsx';

export const IncomeUpload = ({
    file,
    onFileChange,
    onRemoveFile,
    onManualConfig,
    isLoading,
    uploadProgress,
    onAnalyze,
    error,
    onBack
}) => {
    return (
        <div className="space-y-6">
            {/* File drop area */}
            <div className="flex gap-4">
                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative flex flex-col items-center justify-center min-h-[200px]">
                    <input
                        type="file"
                        accept=".pdf, .jpg, .jpeg, .png, .webp"
                        onChange={onFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isLoading}
                    />
                    <Upload className="w-12 h-12 text-slate-300 mb-4" />
                    <div className="font-bold text-lg text-slate-600">Drop payslip here or Click</div>
                    <p className="text-sm text-slate-400 mt-1">PDF or Image (max 20MB)</p>
                </div>

                {/* Manual entry option */}
                <div
                    onClick={!isLoading ? onManualConfig : undefined}
                    className={`w-1/3 border-2 border-slate-100 rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-2 group ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer'
                        }`}
                >
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <PenTool className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                    </div>
                    <div className="font-bold text-slate-600 group-hover:text-emerald-700">Fill Manually</div>
                </div>
            </div>

            {/* Selected file display */}
            {file && (
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-slate-700 truncate text-sm">{file.name}</div>
                            <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</div>
                        </div>
                    </div>
                    <button
                        onClick={onRemoveFile}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Progress bar */}
            {isLoading && uploadProgress && (
                <ProgressBar progress={uploadProgress} />
            )}

            {/* Error display */}
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

            {/* Analyze button - only show when file is selected */}
            {file && (
                <div className="flex justify-end">
                    <Button
                        onClick={onAnalyze}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <><Sparkles className="w-4 h-4 animate-spin text-yellow-400" /> Analyzing...</>
                        ) : (
                            <>Analyze Payslip <ArrowRight className="w-4 h-4" /></>
                        )}
                    </Button>
                </div>
            )}

            {/* Back button always visible */}
            <div className="flex justify-start">
                <Button variant="secondary" onClick={onBack} disabled={isLoading}>Back</Button>
            </div>
        </div>
    );
};
