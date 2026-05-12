import React from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts';
import { Card, CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';

export const AnalyticsTrendsView = ({
    trendType,
    setTrendType,
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedIncomeType,
    setSelectedIncomeType,
    selectedJobFilter,
    setSelectedJobFilter,
    jobOptions,
    trendOverview,
    dominantCurrency,
    activeTrendData,
    totalIncome,
    categorySpending
}) => {
    const { t } = useTranslation();

    const getCategoryName = (name) => {
        const defaultCat = DEFAULT_CATEGORIES.find(c => c.name === name);
        if (defaultCat) return t(`categories.${defaultCat.id}`);
        return name;
    };

    return (
        <div className="animate-fade-in w-full">
            <div className="flex justify-center mb-8 bg-slate-100 p-1 rounded-xl w-fit mx-auto">
                <button onClick={() => setTrendType('expense')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${trendType === 'expense' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>{t('analytics.expenseTrends')}</button>
                <button onClick={() => setTrendType('income')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${trendType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>{t('analytics.incomeTrends')}</button>
            </div>

            <div className="flex flex-col gap-6 mb-6">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t('analytics.filterCategoryMetric')}</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {trendType === 'expense' ? categories.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => setSelectedCategory(c.name)} 
                                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedCategory === c.name ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 bg-white'}`}
                            >
                                <CategoryIcon iconName={c.icon} color={c.color} className="w-6 h-6 flex-shrink-0" />
                                <span className="text-xs font-bold text-slate-700 text-center line-clamp-2">{getCategoryName(c.name)}</span>
                            </button>
                        )) : ['neto', 'bruto', 'taxes'].map(type => (
                            <button 
                                key={type} 
                                onClick={() => setSelectedIncomeType(type)} 
                                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedIncomeType === type ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 bg-white'}`}
                            >
                                <DollarSign className={`w-6 h-6 flex-shrink-0 ${selectedIncomeType === type ? 'text-emerald-600' : 'text-emerald-500'}`} />
                                <span className="text-xs font-bold text-slate-700 uppercase text-center line-clamp-2">{type === 'taxes' ? t('analytics.tax') : t(type, { defaultValue: type })}</span>
                            </button>
                        ))}
                    </div>
                </div>
                {trendType === 'income' && jobOptions.length > 2 && (
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t('analytics.filterJob')}</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {jobOptions.map(job => (
                                <button 
                                    key={job} 
                                    onClick={() => setSelectedJobFilter(job)} 
                                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedJobFilter === job ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 bg-white'}`}
                                >
                                    <CategoryIcon iconName="Briefcase" color="#10b981" className="w-6 h-6 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-700 text-center line-clamp-2">{job === 'ALL_JOBS' ? t('analytics.allJobs') : t(job, { defaultValue: job })}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Over Budget Alert - Separate responsive banner */}
            {trendType === 'expense' && totalIncome > 0 && categorySpending && categorySpending.length > 0 &&
                categorySpending.reduce((sum, c) => sum + c.percentage, 0) > 100 && (
                    <div className="mb-6 px-6 py-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-center gap-3 animate-fade-in">
                        <div className="text-3xl">⚠️</div>
                        <div className="flex-1">
                            <div className="font-bold text-red-800 text-lg">{t('analytics.spendingExceedsIncome')}</div>
                            <div className="text-sm text-red-600 mt-1">
                                {t('analytics.spendingExceedsIncomeDesc', { percent: categorySpending.reduce((sum, c) => sum + c.percentage, 0).toFixed(1) })}
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">{trendType === 'expense' ? t('analytics.totalSpent') : t('analytics.totalEarned')}</div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {trendOverview.total.toLocaleString()}</div></Card>
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">{t('analytics.monthlyAverage')}</div><div className="text-2xl font-bold text-blue-600">{dominantCurrency} {trendOverview.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">{t('analytics.highestMonth')}</div><div className="text-2xl font-bold text-orange-500">{dominantCurrency} {trendOverview.max.toLocaleString()}</div></Card>

                {/* Category % of Income Card - Shows SELECTED category only */}
                {trendType === 'expense' && totalIncome > 0 && categorySpending && categorySpending.length > 0 && (
                    <Card className="p-4 col-span-1 md:col-span-2 lg:col-span-1">
                        <div className="text-slate-400 text-xs font-bold uppercase mb-3">{t('analytics.percentOfIncome')}</div>
                        {(() => {
                            const selectedCatData = categorySpending.find(c => c.category === selectedCategory);
                            if (!selectedCatData) {
                                return <div className="text-xs text-slate-500 text-center py-4">{t('analytics.noDataFor', { category: getCategoryName(selectedCategory) })}</div>;
                            }
                            return (
                                <div>
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-slate-700">{getCategoryName(selectedCatData.category)}</span>
                                            <span className="text-3xl font-bold text-emerald-600">{selectedCatData.percentage.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-3">
                                            <div
                                                className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(selectedCatData.percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-3">
                                        {t('analytics.amountOfIncome', { amount: `${dominantCurrency} ${selectedCatData.amount.toLocaleString()}`, total: `${dominantCurrency} ${totalIncome.toLocaleString()}` })}
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                )}
            </div>

            <div className="h-72 mb-8 w-full" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={activeTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(v) => `${dominantCurrency}${v.toLocaleString()}`} />
                        <Bar dataKey="amount" fill={trendType === 'expense' ? "#3b82f6" : "#10b981"} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
