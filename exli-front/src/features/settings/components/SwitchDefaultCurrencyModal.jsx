import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useFx } from '../../../lib/fx/useFx';
import { commitInChunks, buildAmountConversion, buildIncomeConversion } from '../../../lib/fx/convertRecordsInPlace';

const COLLECTIONS = ['expenses', 'income', 'wishlist'];

const amountOf = (key, data) => {
    if (key === 'income') return Number(data.neto);
    if (key === 'wishlist') return Number(data.price ?? data.amount);
    return Number(data.amount ?? data.price);
};

/**
 * Shown after the user switches their default currency in Settings
 * (docs/fx/01-fx-plan.md §4.1). Records keep the currency they were made in
 * until the user explicitly agrees here: the dialog says what most of their
 * records are in, and converting needs a second, deliberate confirmation.
 *
 * Mounted AFTER the new default is saved, so useFx()'s default is already the
 * new currency. A record that was converted earlier is converted again from
 * its stored `original`, so the true original amount is never lost.
 */
export const SwitchDefaultCurrencyModal = ({ userId, onClose }) => {
    const { t } = useTranslation();
    const { defaultCurrency, convertRecord, toDefault, format } = useFx();
    const [records, setRecords] = useState(null); // [{ key, id, data }]
    const [scanError, setScanError] = useState(null);
    const [step, setStep] = useState('ask'); // 'ask' | 'confirm' | 'working' | 'done'
    const [result, setResult] = useState(null); // { written, skipped }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const all = [];
                for (const key of COLLECTIONS) {
                    const snap = await getDocs(collection(db, 'users', userId, key));
                    snap.forEach((d) => all.push({ key, id: d.id, data: d.data() }));
                }
                if (!cancelled) setRecords(all);
            } catch (err) {
                console.error('SwitchDefaultCurrencyModal scan failed:', err);
                if (!cancelled) setScanError(err.message || String(err));
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const summary = useMemo(() => {
        if (!records) return null;
        const counts = {};
        for (const { data } of records) {
            if (data.currency) counts[data.currency] = (counts[data.currency] || 0) + 1;
        }
        const toConvert = records.filter(({ data }) => data.currency && data.currency !== defaultCurrency);
        const [dominant, dominantCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
        return { toConvert, dominant, dominantCount, total: records.length };
    }, [records, defaultCurrency]);

    // Nothing to offer (no records, or all already in the new default): don't show an empty dialog.
    const nothingToDo = !!summary && summary.toConvert.length === 0;
    useEffect(() => {
        if (nothingToDo) onClose();
    }, [nothingToDo, onClose]);

    const convertAll = async () => {
        setStep('working');
        const jobs = [];
        let skipped = 0;
        for (const { key, id, data } of summary.toConvert) {
            const source = data.original?.currency ? { ...data, ...data.original } : data;
            const fields = key === 'income'
                ? buildIncomeConversion({ ...source, toDefault, defaultCurrency })
                : buildAmountConversion({
                    amount: amountOf(key, source),
                    currency: source.currency,
                    date: data.date,
                    month: data.month || data.reportMonth,
                    convertRecord,
                    amountField: key === 'wishlist' ? 'price' : 'amount',
                });
            if (!fields) { skipped += 1; continue; }
            jobs.push({ path: ['users', userId, key, id], fields });
        }
        try {
            const written = await commitInChunks(jobs);
            setResult({ written, skipped });
        } catch (err) {
            console.error('SwitchDefaultCurrencyModal convert failed:', err);
            setScanError(err.message || String(err));
        }
        setStep('done');
    };

    if (nothingToDo) return null;

    const count = summary?.toConvert.length || 0;
    const sample = summary?.toConvert[0];
    const sampleConverted = sample
        ? toDefault({
            amount: amountOf(sample.key, sample.data), currency: sample.data.currency,
            date: sample.data.date, month: sample.data.month || sample.data.reportMonth,
        })
        : null;

    const renderBody = () => {
        if (scanError) {
            return <p className="text-sm text-rose-500 font-medium">{t('settings.currency.switch.failed', { error: scanError })}</p>;
        }
        if (!summary || step === 'working') {
            return (
                <div className="flex items-center gap-2 text-slate-500 py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> {step === 'working' ? t('settings.currency.switch.working') : t('common.loading')}
                </div>
            );
        }
        if (step === 'done') {
            return (
                <p className="text-sm text-emerald-700 font-medium">
                    {t('settings.currency.switch.done', { count: result?.written || 0, currency: defaultCurrency })}
                    {result?.skipped > 0 && ` ${t('settings.currency.switch.skipped', { count: result.skipped })}`}
                </p>
            );
        }
        if (step === 'confirm') {
            return (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">
                        {t('settings.currency.switch.confirm', { count, currency: defaultCurrency })}
                    </p>
                    <p className="text-xs text-slate-500">{t('settings.currency.switch.confirmHint')}</p>
                </div>
            );
        }
        return (
            <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">
                    {summary.dominant && summary.dominant !== defaultCurrency
                        ? t('settings.currency.switch.mostIn', {
                            count: summary.dominantCount, total: summary.total, from: summary.dominant, to: defaultCurrency,
                        })
                        : t('settings.currency.switch.someIn', { count, to: defaultCurrency })}
                </p>
                <p className="text-xs text-slate-500">{t('settings.currency.switch.keepHint', { to: defaultCurrency })}</p>
                {sampleConverted?.value != null && (
                    <p className="text-xs text-slate-400 font-mono">
                        {format(amountOf(sample.key, sample.data), sample.data.currency)} {'->'} {format(sampleConverted.value, defaultCurrency)}
                    </p>
                )}
            </div>
        );
    };

    const showActions = !!summary && !scanError && step !== 'working' && step !== 'done';

    return createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">{t('settings.currency.switch.title', { to: defaultCurrency })}</h3>
                    <button onClick={onClose} aria-label={t('common.close')} className="p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                {renderBody()}
                {showActions && (
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={step === 'confirm' ? () => setStep('ask') : onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold"
                        >
                            {step === 'confirm' ? t('common.back') : t('settings.currency.switch.keep')}
                        </button>
                        <button
                            type="button"
                            onClick={step === 'confirm' ? convertAll : () => setStep('confirm')}
                            className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold"
                        >
                            {step === 'confirm'
                                ? t('settings.currency.switch.confirmYes', { count })
                                : t('settings.currency.switch.convert', { count })}
                        </button>
                    </div>
                )}
                {(step === 'done' || scanError) && (
                    <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">
                        {t('common.close')}
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
};

export default SwitchDefaultCurrencyModal;
