import React from 'react';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { Button } from '../../../components/UI';

export const ExpenseStepVerify = ({
    currentFileIndex,
    totalFiles,
    fileData,
    onPrevFile,
    onNextFile,
    onUpdateMapping,
    onBack,
    onStartCategorizing
}) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <button disabled={currentFileIndex === 0} onClick={onPrevFile} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
                <div className="text-center">
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Verifying File {currentFileIndex + 1} of {totalFiles}</div>
                    <div className="font-bold text-slate-800 flex items-center justify-center gap-2"><CreditCard className="w-4 h-4 text-emerald-500" /> {fileData.card_info}</div>
                    <div className="text-xs text-slate-400 truncate max-w-[200px] mx-auto">{fileData.filename}</div>
                </div>
                <button disabled={currentFileIndex === totalFiles - 1} onClick={onNextFile} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-6 h-6 text-slate-600" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['Date', 'Description', 'Amount', 'Category', 'Currency'].map((field) => (
                    <div key={field}>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</label>
                        <select className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm" onChange={(e) => onUpdateMapping(field.toLowerCase(), e.target.value)} value={fileData.columnMapping[field.toLowerCase()] ?? ""}><option value="">Select Column...</option>{fileData.columns.map((header, idx) => (<option key={idx} value={idx}>{header}</option>))}</select>
                    </div>
                ))}
            </div>

            <div className="mt-6 border rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-50 p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">Preview: {fileData.card_info} — Showing {Math.min(10, fileData.preview_data.length)} of {fileData.preview_data.length} rows</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 font-bold text-xs border-b border-slate-100">
                            <tr>{fileData.columns.map((h, i) => { const isSelected = Object.values(fileData.columnMapping).includes(i); const mappedField = Object.keys(fileData.columnMapping).find(key => fileData.columnMapping[key] === i); return (<th key={i} className={`p-3 whitespace-nowrap border-r border-slate-50 last:border-0 ${isSelected ? 'bg-blue-50 text-blue-700' : ''}`}>{h}{mappedField && <div className="mt-1 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full inline-block">{mappedField}</div>}</th>); })}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {fileData.preview_data.slice(0, 10).map((row, rIdx) => (<tr key={rIdx} className="hover:bg-slate-50/50">{fileData.columns.map((_, cIdx) => { const isSelected = Object.values(fileData.columnMapping).includes(cIdx); return (<td key={cIdx} className={`p-3 whitespace-nowrap text-slate-700 border-r border-slate-50 last:border-0 ${isSelected ? 'bg-blue-50/30 font-medium text-blue-900' : ''}`}>{row[cIdx]}</td>) })}</tr>))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex justify-between"><Button variant="secondary" onClick={onBack}>Back</Button><Button onClick={onStartCategorizing}>Start Categorizing ({totalFiles} files) &rarr;</Button></div>
        </div>
    );
};
