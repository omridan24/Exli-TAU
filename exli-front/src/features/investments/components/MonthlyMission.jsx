import React, { useState, useMemo, useCallback } from 'react';
import { Check, Rocket, Target, PartyPopper, AlertCircle, ChevronLeft, ChevronRight, Calculator, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BUCKET_KEYS = ['long', 'mid', 'short'];

// An allocation that would buy less than one full share is folded into
// another holding in the same bucket that can actually reach a whole share,
// so the mission doesn't ask for fractional purchases when an alternative
// exists - it'll get corrected next month instead. Holdings with an unknown
// price can't be evaluated this way and are left untouched.
function foldFractionalShares(allocations) {
    let working = allocations.map(a => ({ ...a }));
    let changed = true;

    while (changed && working.length > 1) {
        changed = false;
        const dropIdx = working.findIndex(a =>
            a.holding.currentPrice > 0 && (a.amount / a.holding.currentPrice) < 1
        );
        if (dropIdx === -1) break;

        const [dropped] = working.splice(dropIdx, 1);
        const keepers = working.filter(a =>
            a.holding.currentPrice > 0 && (a.amount / a.holding.currentPrice) >= 1
        );
        const target = (keepers.length > 0 ? keepers : working)
            .reduce((a, b) => (a.amount > b.amount ? a : b));

        target.amount += dropped.amount;
        changed = true;
    }

    return working;
}

const TaskCard = ({ rec, isDone, actual, onConfirm, onUndo, formatCurrency, currencySymbol, t }) => {
    const hasPrice = rec.price > 0;
    const [isEditing, setIsEditing] = useState(!isDone);
    const [shares, setShares] = useState(
        actual?.shares != null ? String(actual.shares) : (rec.estShares != null ? rec.estShares.toFixed(3) : '')
    );
    const [amountPaid, setAmountPaid] = useState(
        actual?.amountPaid != null ? String(actual.amountPaid) : String(Math.round(rec.amount))
    );

    const handleSharesChange = (val) => {
        setShares(val);
        if (hasPrice && val !== '' && !isNaN(Number(val))) {
            setAmountPaid((Number(val) * rec.price).toFixed(2));
        }
    };

    const handleAmountChange = (val) => {
        setAmountPaid(val);
        if (hasPrice && val !== '' && !isNaN(Number(val))) {
            setShares((Number(val) / rec.price).toFixed(3));
        }
    };

    const handleConfirm = () => {
        onConfirm(rec.id, {
            shares: shares === '' || isNaN(Number(shares)) ? null : Number(shares),
            amountPaid: amountPaid === '' || isNaN(Number(amountPaid)) ? null : Number(amountPaid)
        });
        setIsEditing(false);
    };

    const showInputs = isEditing || !isDone;

    return (
        <div className={`bg-white rounded-xl p-4 border transition-all ${isDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:border-purple-300 hover:shadow-md'
            }`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {isDone ? <Check className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold ${isDone ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>
                            {t('investments.mission.buy', 'Buy')} {rec.symbol}
                        </h4>
                        <p className="text-sm text-slate-500">{rec.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {t(`investments.buckets.${rec.bucket}.name`)}
                            </span>
                            <span className="text-xs text-slate-400">
                                {t('investments.mission.suggested', 'Suggested')}: ≈ {formatCurrency(rec.amount)}
                                {rec.estShares ? ` (${rec.estShares.toFixed(2)} ${t('investments.mission.shares', 'shares')})` : ''}
                            </span>
                        </div>

                        {showInputs ? (
                            <div className="mt-2 flex items-end gap-3 flex-wrap">
                                <div>
                                    <label className="text-[11px] text-slate-500 block mb-0.5">
                                        {t('investments.misc.sharesLabel', 'Shares')}
                                    </label>
                                    <input
                                        type="number"
                                        value={shares}
                                        onChange={(e) => handleSharesChange(e.target.value)}
                                        className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                                        step="0.001"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-slate-500 block mb-0.5">
                                        {t('investments.mission.paid', 'Paid')}
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-500 text-sm">{currencySymbol}</span>
                                        <input
                                            type="number"
                                            value={amountPaid}
                                            onChange={(e) => handleAmountChange(e.target.value)}
                                            className="w-24 px-2 py-1 border border-slate-200 rounded text-sm"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                {!hasPrice && (
                                    <span className="text-[11px] text-slate-400 max-w-[140px]">
                                        {t('investments.mission.noPriceHint', "Price unknown - enter both")}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                                <span className="text-emerald-700 font-medium">
                                    {actual?.shares != null
                                        ? t('investments.mission.bought', 'Bought {{shares}} shares for {{amount}}', {
                                            shares: actual.shares,
                                            amount: formatCurrency(actual.amountPaid || 0)
                                        })
                                        : t('investments.mission.boughtNoShares', 'Paid {{amount}}', { amount: formatCurrency(actual?.amountPaid || 0) })
                                    }
                                </span>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-slate-400 hover:text-slate-600"
                                    title={t('common.edit', 'Edit')}
                                >
                                    ✏️
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                    {showInputs ? (
                        <button
                            onClick={handleConfirm}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Check className="w-3 h-3" /> {isDone ? t('common.save', 'Save') : t('investments.mission.markDone', 'Mark done')}
                        </button>
                    ) : (
                        <button
                            onClick={onUndo}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-colors"
                        >
                            {t('investments.mission.undo', 'Undo')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * MonthlyMission Component
 * The Execution - Gamified rebalancing checklist
 *
 * Each month has a persisted plan (missionPlans[monthKey]): a user-entered
 * "money to invest" figure (destined to be fed automatically from the
 * dashboard later) and, for each recommended buy the user has confirmed,
 * what was actually bought (shares / amount paid).
 */
export const MonthlyMission = ({
    holdings = [],
    targetAllocations = { long: 60, mid: 30, short: 10 },
    missionPlans = {}, // { 'YYYY-MM': { moneyToInvest, completedTasks: { [taskId]: { shares, amountPaid, completedAt } } } }
    onSavePlan,
    userCurrency = 'ILS'
}) => {
    const { t, i18n } = useTranslation();

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiPieces, setConfettiPieces] = useState([]);
    const [isEditingAmount, setIsEditingAmount] = useState(false);
    const [editValue, setEditValue] = useState('');

    // Month navigation state
    const [selectedDate, setSelectedDate] = useState(new Date());

    const monthKey = useMemo(() => selectedDate.toISOString().slice(0, 7), [selectedDate]);

    const plan = useMemo(() => (
        missionPlans[monthKey] || { moneyToInvest: null, completedTasks: {} }
    ), [missionPlans, monthKey]);

    const moneyToInvest = plan.moneyToInvest || 0;
    const completedTasks = useMemo(() => plan.completedTasks || {}, [plan]);

    const formattedMonth = useMemo(() => (
        selectedDate.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
    ), [selectedDate, i18n.language]);

    const changeMonth = (delta) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
        setIsEditingAmount(false);
        setEditValue('');
    };

    // Current value held in each bucket today
    const currentByBucket = useMemo(() => {
        const sums = { long: 0, mid: 0, short: 0 };
        holdings.forEach(h => {
            if (h.bucket && sums[h.bucket] !== undefined) {
                const value = h.currentPrice ? h.currentPrice * (h.quantity || 0) : (h.marketValue || 0);
                sums[h.bucket] += value;
            }
        });
        return { ...sums, total: sums.long + sums.mid + sums.short };
    }, [holdings]);

    // Alignment with the Strategy tab's target split (same formula as the Portfolio tab's health bar)
    const portfolioHealth = useMemo(() => {
        if (currentByBucket.total === 0) return 0;
        const totalDeviation = BUCKET_KEYS.reduce((sum, b) => {
            const currentPct = (currentByBucket[b] / currentByBucket.total) * 100;
            return sum + Math.abs(currentPct - (targetAllocations[b] || 0));
        }, 0);
        return Math.max(0, Math.round(100 - (totalDeviation / 2)));
    }, [currentByBucket, targetAllocations]);

    const startEditAmount = useCallback(() => {
        setEditValue(plan.moneyToInvest != null ? String(plan.moneyToInvest) : '');
        setIsEditingAmount(true);
    }, [plan.moneyToInvest]);

    const confirmEditAmount = useCallback(() => {
        const parsed = editValue === '' || isNaN(Number(editValue)) ? null : Math.max(0, Number(editValue));
        onSavePlan?.(monthKey, { ...plan, moneyToInvest: parsed });
        setIsEditingAmount(false);
    }, [editValue, onSavePlan, monthKey, plan]);

    const cancelEditAmount = useCallback(() => {
        setIsEditingAmount(false);
        setEditValue('');
    }, []);

    // Generate this month's buy recommendations: new money is directed at
    // whichever buckets are currently under their Strategy-tab target (never
    // moved out of an overweight bucket), then split across each bucket's
    // existing holdings proportional to their current weight in it - folding
    // any sub-one-share allocation into another holding in the bucket. A
    // bucket that needs money but has no holding assigned yet gets an
    // "assign" task instead - that money isn't redistributed elsewhere.
    const recommendations = useMemo(() => {
        if (moneyToInvest <= 0) return [];

        const projectedTotal = currentByBucket.total + moneyToInvest;

        const gaps = {};
        let totalGap = 0;
        BUCKET_KEYS.forEach(b => {
            const targetAmount = ((targetAllocations[b] || 0) / 100) * projectedTotal;
            const gap = Math.max(0, targetAmount - currentByBucket[b]);
            gaps[b] = gap;
            totalGap += gap;
        });

        const bucketAmounts = {};
        BUCKET_KEYS.forEach(b => {
            bucketAmounts[b] = totalGap > 0
                ? moneyToInvest * (gaps[b] / totalGap)
                : moneyToInvest * ((targetAllocations[b] || 0) / 100);
        });

        const tasks = [];
        BUCKET_KEYS.forEach(b => {
            const amount = bucketAmounts[b];
            if (amount <= 1) return;

            const bucketHoldings = holdings.filter(h => h.bucket === b && h.symbol);

            if (bucketHoldings.length === 0) {
                if ((targetAllocations[b] || 0) > 0) {
                    tasks.push({ id: `assign-${b}`, type: 'assign', bucket: b, amount });
                }
                return;
            }

            const bucketValue = bucketHoldings.reduce((sum, h) =>
                sum + (h.currentPrice ? h.currentPrice * (h.quantity || 0) : (h.marketValue || 0)), 0);

            const initialAllocations = bucketHoldings.map(h => {
                const holdingValue = h.currentPrice ? h.currentPrice * (h.quantity || 0) : (h.marketValue || 0);
                const weight = bucketValue > 0 ? holdingValue / bucketValue : 1 / bucketHoldings.length;
                return { holding: h, amount: amount * weight };
            });

            foldFractionalShares(initialAllocations).forEach(({ holding: h, amount: share }) => {
                if (share <= 1) return;
                tasks.push({
                    id: h.symbol,
                    type: 'buy',
                    bucket: b,
                    symbol: h.symbol,
                    name: h.name,
                    amount: share,
                    price: h.currentPrice || null,
                    estShares: h.currentPrice > 0 ? share / h.currentPrice : null
                });
            });
        });

        return tasks.sort((a, b) => b.amount - a.amount);
    }, [moneyToInvest, currentByBucket, targetAllocations, holdings]);

    const currencySymbol = userCurrency === 'ILS' ? '₪' : '$';
    const formatCurrency = (amount) => (
        `${currencySymbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    );

    const isTaskDone = useCallback((id) => Object.prototype.hasOwnProperty.call(completedTasks, id), [completedTasks]);

    const fireConfetti = () => {
        setConfettiPieces([...Array(50)].map(() => ({
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 5)],
            size: `${Math.random() * 10 + 5}px`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0'
        })));
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
    };

    const confirmTask = useCallback((id, data) => {
        const next = { ...completedTasks, [id]: { ...data, completedAt: new Date().toISOString() } };
        onSavePlan?.(monthKey, { ...plan, completedTasks: next });
        fireConfetti();
    }, [completedTasks, onSavePlan, monthKey, plan]);

    const undoTask = useCallback((id) => {
        const next = { ...completedTasks };
        delete next[id];
        onSavePlan?.(monthKey, { ...plan, completedTasks: next });
    }, [completedTasks, onSavePlan, monthKey, plan]);

    const allComplete = recommendations.length > 0 && recommendations.every(r => isTaskDone(r.id));

    return (
        <div className="space-y-6 relative">
            {/* Confetti effect */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                    {confettiPieces.map((piece, i) => (
                        <div
                            key={i}
                            className="absolute animate-confetti"
                            style={{
                                left: piece.left,
                                top: '-10%',
                                animationDelay: piece.animationDelay,
                                backgroundColor: piece.backgroundColor,
                                width: piece.size,
                                height: piece.size,
                                borderRadius: piece.borderRadius
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Header with Month Navigation */}
            <div className="text-center">
                <div className="flex items-center justify-center gap-4 mb-2">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <h2 className="text-xl font-bold text-slate-800 min-w-[200px] flex items-center justify-center gap-2">
                        🏗️ {formattedMonth}
                        {allComplete && (
                            <span
                                className="inline-flex text-emerald-500"
                                title={t('investments.mission.monthComplete', "This month's mission is complete")}
                            >
                                <CheckCircle2 className="w-5 h-5" />
                            </span>
                        )}
                    </h2>

                    <button
                        onClick={() => changeMonth(1)}
                        className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100 shadow-sm">
                {/* Money to Invest */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-purple-100/50">
                    <div className="text-start">
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                            {t('investments.mission.moneyToInvest', 'Money to Invest')}
                        </span>
                        <span className="text-xs text-slate-400 max-w-[220px] block">
                            {t('investments.mission.moneyToInvestHint', "We'll pull this from your dashboard automatically soon - for now, enter it yourself.")}
                        </span>
                    </div>

                    <div className="text-end flex-shrink-0">
                        {isEditingAmount ? (
                            <div className="flex items-center justify-end gap-1">
                                <span className="text-purple-600 font-bold">{currencySymbol}</span>
                                <input
                                    type="number"
                                    className="w-24 px-2 py-1 text-end border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmEditAmount();
                                        if (e.key === 'Escape') cancelEditAmount();
                                    }}
                                    autoFocus
                                />
                                <button
                                    onClick={confirmEditAmount}
                                    className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                    title={t('common.confirm', 'Confirm')}
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={startEditAmount}
                                className="text-purple-600 font-bold text-lg hover:text-purple-800 transition-colors inline-flex items-center gap-1.5"
                                title={t('investments.mission.editAmount', 'Edit amount to invest')}
                            >
                                {formatCurrency(moneyToInvest)}
                                <span className="text-sm">✏️</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Alignment summary - how close current holdings are to the Strategy tab's targets */}
                <div className="mb-4 pb-4 border-b border-purple-100/50">
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        {BUCKET_KEYS.map(b => {
                            const currentPct = currentByBucket.total > 0
                                ? Math.round((currentByBucket[b] / currentByBucket.total) * 100)
                                : 0;
                            const targetPct = targetAllocations[b] || 0;
                            return (
                                <div key={b} className="p-2 bg-white/60 rounded-lg">
                                    <div className="font-semibold text-slate-600">
                                        {t(`investments.buckets.${b}.short`, b)}
                                    </div>
                                    <div className="mt-1">
                                        <span className={currentPct < targetPct - 5 ? 'text-red-600' : 'text-slate-700'}>
                                            {currentPct}%
                                        </span>
                                        <span className="text-slate-400 mx-1">/</span>
                                        <span className="text-slate-800 font-medium">{targetPct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                        <span>{t('investments.mission.alignment', 'Alignment with strategy')}</span>
                        <span className="font-semibold text-slate-700">{portfolioHealth}%</span>
                    </div>
                </div>

                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-purple-600" />
                    {t('investments.mission.checklist', "This Month's Tasks")}
                </h3>

                {moneyToInvest <= 0 ? (
                    <div className="text-center py-6 text-slate-500">
                        <Calculator className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p>{t('investments.mission.setMoneyToInvest', 'Enter an amount above to get this month\'s mission.')}</p>
                    </div>
                ) : recommendations.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                        <PartyPopper className="w-10 h-10 mx-auto mb-2 text-purple-400" />
                        <p>{t('investments.mission.allBalanced', 'Your portfolio is perfectly balanced!')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recommendations.map((rec) => {
                            if (rec.type === 'assign') {
                                return (
                                    <div
                                        key={rec.id}
                                        className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3"
                                    >
                                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-semibold text-amber-800">
                                                {t('investments.mission.assignBucket', 'Add a stock to your {{bucket}} bucket', { bucket: t(`investments.buckets.${rec.bucket}.name`) })}
                                            </h4>
                                            <p className="text-sm text-amber-700 mt-1">
                                                {t('investments.mission.assignBucketDesc', '{{amount}} is waiting to be invested here, but no stock is assigned to this bucket yet. Add one from the Portfolio tab.', { amount: formatCurrency(rec.amount) })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <TaskCard
                                    key={`${monthKey}-${rec.id}`}
                                    rec={rec}
                                    isDone={isTaskDone(rec.id)}
                                    actual={completedTasks[rec.id]}
                                    onConfirm={confirmTask}
                                    onUndo={() => undoTask(rec.id)}
                                    formatCurrency={formatCurrency}
                                    currencySymbol={currencySymbol}
                                    t={t}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* All Complete Message */}
            {allComplete && (
                <div className="text-center p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
                    <PartyPopper className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                    <h3 className="text-lg font-bold text-emerald-700">
                        {t('investments.mission.complete', 'Mission Complete!')}
                    </h3>
                    <p className="text-emerald-600 text-sm mt-1">
                        {t('investments.mission.completeDesc', 'Great job! Your portfolio is now better aligned with your strategy.')}
                    </p>
                </div>
            )}

            {/* CSS for confetti animation */}
            <style>{`
                @keyframes confetti {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
                .animate-confetti {
                    animation: confetti 3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default MonthlyMission;
