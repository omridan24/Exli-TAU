import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, ChevronLeft } from 'lucide-react';
import { summarizeDateChange, monthOfDate } from '../utils/expenseDates';

const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (year, month) => new Date(year, month, 0).getDate(); // month is 1-12; handles leap years

/**
 * "Change date" for one or many expenses: year cards -> month cards -> day grid with a
 * live confirm summary. Same look as MonthYearPickerModal, one extra step for the day.
 * Expenses shared into a group are skipped by the backend; the summary says so up front.
 */
export const ChangeDateModal = ({ expenses, formatMonth, onClose, onConfirm, onKeepDay }) => {
  const { t, i18n } = useTranslation();
  const first = monthOfDate(expenses[0]?.date) || expenses[0]?.reportMonth || new Date().toISOString().slice(0, 7);
  const firstDay = parseInt((expenses[0]?.date || '').slice(8, 10), 10) || 1;
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 11 }, (_, i) => thisYear + 1 - i), [thisYear]);

  const [step, setStep] = useState('year');
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null); // 1-12
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const monthKey = year && month ? `${year}-${pad(month)}` : null;
  const dateStr = monthKey && day ? `${monthKey}-${pad(day)}` : null;
  const summary = dateStr ? summarizeDateChange(expenses, dateStr) : null;
  const changeable = summary ? summary.moves + summary.stays : 0;
  const sharedCount = expenses.filter((e) => e.groupRef).length;

  const pickYear = (y) => { setYear(y); setStep('month'); };
  const pickMonth = (m) => {
    setMonth(m);
    // Preselect the first expense's current day, clamped to the month's last day.
    setDay(Math.min(firstDay, daysIn(year, m)));
    setStep('day');
  };

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const monthNames = MONTH_KEYS.map((k) => t(`datePicker.months.${k}`));
  const weekdayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
  // 2023-01-01 was a Sunday: week starts Sunday (also the Hebrew week start).
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(2023, 0, 1 + i)));

  const cardBase = 'p-4 border-2 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all font-bold text-slate-700';
  const titleKey = step === 'year' ? 'datePicker.year' : step === 'month' ? 'datePicker.month' : 'datePicker.day';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label={t('analytics.changeDate.title', { count: expenses.length })} className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center gap-2 min-w-0">
            {step !== 'year' && (
              <button
                onClick={() => setStep(step === 'day' ? 'month' : 'year')}
                aria-label={t('analytics.changeDate.back')}
                className="p-2 border rounded-full hover:bg-slate-50 transition-colors rtl:rotate-180"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-bold uppercase tracking-tight text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {t(titleKey)}
              </h3>
              <nav aria-label={t('analytics.changeDate.breadcrumb')} className="text-xs text-slate-400 flex gap-1">
                <span>{t('analytics.changeDate.title', { count: expenses.length })}</span>
                {year && (<><span aria-hidden>/</span><button className="underline" onClick={() => setStep('year')}>{year}</button></>)}
                {month && (<><span aria-hidden>/</span><button className="underline" onClick={() => setStep('month')}>{monthNames[month - 1]}</button></>)}
              </nav>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('analytics.changeDate.close')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'year' && (
            <div className="grid grid-cols-3 gap-3">
              {years.map((y, i) => (
                <button key={y} autoFocus={i === 0} onClick={() => pickYear(y)} className={`${cardBase} ${String(y) === first.slice(0, 4) ? 'bg-emerald-50 border-emerald-400' : 'border-slate-200'}`}>{y}</button>
              ))}
            </div>
          )}

          {step === 'month' && (
            <div className="grid grid-cols-2 gap-3">
              {monthNames.map((m, i) => (
                <button key={m} autoFocus={i === 0} onClick={() => pickMonth(i + 1)} className={`${cardBase} ${`${year}-${pad(i + 1)}` === first ? 'bg-emerald-50 border-emerald-400' : 'border-slate-200'}`}>{m}</button>
              ))}
            </div>
          )}

          {step === 'day' && (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400" aria-hidden>
                {weekdays.map((w, i) => <div key={i}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1" role="group" aria-label={`${monthNames[month - 1]} ${year}`}>
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => <div key={`pad${i}`} />)}
                {Array.from({ length: daysIn(year, month) }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    autoFocus={d === day}
                    aria-pressed={d === day}
                    onClick={() => setDay(d)}
                    className={`aspect-square rounded-lg border-2 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all ${d === day ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {summary && (
                <div className="text-sm text-slate-600 space-y-1" aria-live="polite">
                  {summary.moves > 0 && <p>{t('analytics.changeDate.willMove', { count: summary.moves, month: formatMonth(summary.targetMonth) })}</p>}
                  {summary.stays > 0 && <p>{t('analytics.changeDate.willStay', { count: summary.stays, month: formatMonth(summary.targetMonth) })}</p>}
                </div>
              )}
              {sharedCount > 0 && <p className="text-sm text-amber-600">{t('analytics.changeDate.sharedBlocked', { count: sharedCount })}</p>}

              <div className="flex flex-wrap justify-between gap-2 pt-2">
                {expenses.length > 1 && onKeepDay ? (
                  <button
                    onClick={() => run(() => onKeepDay(monthKey))}
                    disabled={busy || sharedCount === expenses.length}
                    className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg disabled:opacity-50"
                  >
                    {t('analytics.changeDate.keepDay')}
                  </button>
                ) : <span />}
                <button
                  onClick={() => run(() => onConfirm(dateStr))}
                  disabled={!dateStr || busy || changeable === 0}
                  className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  {t('analytics.changeDate.confirm')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
