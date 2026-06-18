import React from 'react';
import { Sparkles, PenTool, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const AutoManualModal = ({ onSelectAuto, onSelectManual, onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 end-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Title */}
                <h3 className="font-black text-2xl text-slate-800 mb-2 text-center">
                    {t('expenses.auto.modalTitle')}
                </h3>
                <p className="text-sm text-slate-500 text-center mb-8">
                    {t('expenses.uploadAndMerge')}
                </p>

                {/* Two Cards */}
                <div className="grid grid-cols-2 gap-5">
                    {/* Automatic */}
                    <button
                        onClick={onSelectAuto}
                        className="relative p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-gradient-to-b hover:from-emerald-50 hover:to-white transition-all flex flex-col items-center text-center group overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm relative z-10">
                            <Sparkles className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div className="font-black text-lg text-slate-800 mb-1 relative z-10">
                            {t('expenses.auto.modalAutoTitle')}
                        </div>
                        <div className="text-xs text-slate-500 leading-relaxed relative z-10">
                            {t('expenses.auto.modalAutoDesc')}
                        </div>
                        {/* Recommended badge */}
                        <div className="mt-3 text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider relative z-10">
                            ⚡ Recommended
                        </div>
                    </button>

                    {/* Manual */}
                    <button
                        onClick={onSelectManual}
                        className="relative p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-gradient-to-b hover:from-blue-50 hover:to-white transition-all flex flex-col items-center text-center group overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm relative z-10">
                            <PenTool className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="font-black text-lg text-slate-800 mb-1 relative z-10">
                            {t('expenses.auto.modalManualTitle')}
                        </div>
                        <div className="text-xs text-slate-500 leading-relaxed relative z-10">
                            {t('expenses.auto.modalManualDesc')}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
