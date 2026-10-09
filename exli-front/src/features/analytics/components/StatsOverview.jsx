import React from 'react';
import { Landmark, Wallet, DollarSign, Percent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';
import { Money } from '../../../components/Money';

export const StatsOverview = ({ totals, currency }) => {
    const { t } = useTranslation();

    return (
        <div className="animate-fade-in mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-5 border-l-4 border-emerald-500 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <Landmark className="w-4 h-4 text-emerald-500" /> {t('analytics.netWealthGenerated')}
                    </div>
                    <div className="text-2xl font-extrabold text-slate-800">
                        <Money amount={totals.wealth} currency={currency} />
                    </div>
                </Card>

                <Card className="p-5 border-l-4 border-blue-500 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <Wallet className="w-4 h-4 text-blue-500" /> {t('analytics.totalIncomeNet')}
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        <Money amount={totals.incNet} currency={currency} />
                    </div>
                </Card>

                <Card className="p-5 border-l-4 border-red-400 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <DollarSign className="w-4 h-4 text-red-400" /> {t('analytics.totalExpenses')}
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        <Money amount={totals.exp} currency={currency} />
                    </div>
                </Card>

                <Card className="p-5 border-l-4 border-purple-500 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <Percent className="w-4 h-4 text-purple-500" /> {t('analytics.savingsRate')}
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {totals.incNet > 0 ? ((totals.incNet - totals.exp) / totals.incNet * 100).toFixed(1) + '%' : '0%'}
                    </div>
                </Card>
            </div>
            {totals.excludedCount > 0 && (
                <div className="mt-3 text-xs text-amber-600 font-bold">
                    {t('analytics.excludedFromTotals', { count: totals.excludedCount })}
                </div>
            )}
        </div>
    );
};
