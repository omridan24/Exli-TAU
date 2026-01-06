import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ProgressBar = ({ progress, processingTimeEstimate }) => {
    const { t } = useTranslation();

    if (!progress) return null;

    const {
        progress_percent = 0,
        current_step = t('common.loading'),
        estimated_seconds_remaining = 0,
        completed_files = 0,
        total_files = 1
    } = progress;

    const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-200 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span className="font-semibold text-slate-800">{t('expenses.progress.processingFiles')}</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">{progress_percent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 mb-3 overflow-hidden">
                <div
                    style={{ width: `${progress_percent}%` }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500 ease-out"
                />
            </div>

            {/* Status Message */}
            <p className="text-sm text-slate-700 font-medium mb-2">
                {current_step}
            </p>

            {/* File Counter */}
            <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                    {t('expenses.progress.files', { completed: completed_files, total: total_files })}
                </span>
                {estimated_seconds_remaining > 0 && (
                    <span>
                        {t('expenses.progress.timeRemaining', { time: formatTime(estimated_seconds_remaining) })}
                    </span>
                )}
                {!estimated_seconds_remaining && processingTimeEstimate && (
                    <span>
                        {t('expenses.progress.totalTime', { time: processingTimeEstimate })}
                    </span>
                )}
            </div>

            {/* Animated Dots */}
            <div className="flex justify-center gap-1 mt-4">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
        </div>
    );
};
