import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatsOverview } from './components/StatsOverview';
import { YearDashboard } from './components/YearDashboard';
import { useFx } from '../../lib/fx/useFx';

// target (optional): a dashboard shortcut, { view: 'reports' | 'trends', category?: string }. It opens the
// year that holds the data (the latest one, or the latest one with that category) on the right tab.
export const AnalyticsNode = ({ data, income, categories, userId, target }) => {
    const { t } = useTranslation();
    const [selectedYear, setSelectedYear] = useState(() => {
        if (!target) return null;
        const matching = target.category ? data.filter(d => d.assignedCategory === target.category) : data;
        const targetYears = matching.map(d => d.reportMonth?.split('-')[0]).filter(Boolean).sort();
        return targetYears[targetYears.length - 1] || null;
    });
    const { sum, defaultCurrency, dataVersion } = useFx();

    const years = useMemo(() => {
        const allYears = new Set([...data.map(d => d.reportMonth?.split('-')[0]), ...income.map(d => d.month?.split('-')[0])].filter(Boolean));
        return Array.from(allYears).sort().reverse();
    }, [data, income]);

    useEffect(() => {
        if (years.length === 1) setSelectedYear(years[0]);
    }, [years]);

    // Sums each expense/income line in its OWN currency, converted to the
    // user's default before adding up - a naive `+= curr.amount` here would
    // silently add dollars to shekels (docs/fx/01-fx-plan.md §1's flagged
    // bug: "$100 plus ₪100 shows as ₪200"). Anything that can't be
    // converted (no rate available) is excluded and counted, never dropped
    // in silently - see excludedCount below.
    const lifetimeTotals = useMemo(() => {
        const expenseMoneys = data
            .filter(curr => !curr.isForecast && !curr.isRefund)
            .map(curr => ({ amount: Number(curr.amount), currency: curr.currency || 'ILS', date: curr.date, month: curr.reportMonth }));
        const incomeMoneys = income.map(curr => ({ amount: Number(curr.neto) || 0, currency: curr.currency || 'ILS', month: curr.month }));
        const pensionMoneys = income.map(curr => ({ amount: Number(curr.pension) || 0, currency: curr.currency || 'ILS', month: curr.month }));

        const { value: exp, excluded: expExcluded } = sum(expenseMoneys);
        const { value: incNet, excluded: incExcluded } = sum(incomeMoneys);
        const { value: pension, excluded: pensionExcluded } = sum(pensionMoneys);
        const wealth = (incNet - exp) + pension;
        const excludedCount = expExcluded.length + incExcluded.length + pensionExcluded.length;
        return { exp, incNet, wealth, excludedCount };
        // dataVersion: sum()'s underlying fx data can finish loading AFTER
        // this memo first runs (see useFx.js) - without it in the deps, a
        // background-loaded rate would never trigger a recompute. Not read
        // inside the callback, so exhaustive-deps calls it "unnecessary" -
        // it isn't.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, income, sum, dataVersion]);

    // Check if a year is fully forecasted
    const getYearStatus = (year) => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentYear = currentMonth.split('-')[0];

        if (year > currentYear) {
            return 'forecasted';
        } else if (year === currentYear) {
            const yearExpenses = data.filter(d => d.reportMonth?.startsWith(year));
            const hasRealExpenses = yearExpenses.some(exp => !exp.isForecast && exp.source !== 'recurring_auto');
            return hasRealExpenses ? 'partial' : 'forecasted';
        }
        return 'real';
    };

    if (selectedYear) return <YearDashboard year={selectedYear} data={data} income={income} categories={categories} userId={userId} initialViewMode={target?.view === 'trends' ? 'category' : undefined} initialCategory={target?.category} onBack={() => setSelectedYear(null)} />;

    return (
        <div className="p-6 max-w-5xl mx-auto animate-fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">{t('analytics.lifetimeOverview')}</h3>
            <StatsOverview totals={lifetimeTotals} currency={defaultCurrency} />
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Calendar className="w-5 h-5 text-slate-500" /> {t('analytics.selectFiscalYear')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {years.map(year => {
                    const status = getYearStatus(year);
                    const isForecast = status === 'forecasted';
                    return (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`bg-white p-10 rounded-3xl border shadow-sm hover:shadow-xl transition-all text-left group relative overflow-hidden ${isForecast ? 'border-purple-300 hover:border-purple-400' : 'border-slate-100 hover:border-emerald-200'
                                }`}
                            title={isForecast ? t('analytics.forecastedTooltip') : ''}
                        >
                            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
                                <Calendar className={`w-24 h-24 ${isForecast ? 'text-purple-600' : 'text-emerald-600'}`} />
                            </div>
                            {isForecast && (
                                <div className="absolute top-4 left-4 bg-purple-100 border-2 border-purple-300 text-purple-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    <span>🔮</span> {t('analytics.forecasted')}
                                </div>
                            )}
                            <div className={`text-4xl font-black transition-colors ${isForecast ? 'text-purple-700 group-hover:text-purple-800' : 'text-slate-800 group-hover:text-emerald-700'
                                }`}>{year}</div>
                            <div className="mt-4 text-slate-400 font-bold flex items-center gap-2">
                                {t('analytics.fullReport')} <ArrowRight className={`w-4 h-4 ${isForecast ? 'text-purple-400' : 'text-emerald-400'}`} />
                            </div>
                        </button>
                    );
                })}
                {years.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        {t('analytics.noData')}
                    </div>
                )}
            </div>
        </div>
    );
};
