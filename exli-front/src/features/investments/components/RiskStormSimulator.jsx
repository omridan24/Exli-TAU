import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import {
    AlertTriangle, TrendingDown, Shield, ChevronRight,
    Info, X, Check, BookOpen, History
} from 'lucide-react';
import { BUCKET_INFO, saveInvestmentProfile } from '../../../config/investmentProfileService';

// Historical crash data - removed Inflation, keeps COVID, 2008, and added Dotcom
const HISTORICAL_CRASHES = [
    {
        key: 'dotcom',
        drop: -45,
        year: '2000',
        label: 'Dotcom Bubble',
        description: 'The dot-com bubble burst after internet stocks became wildly overvalued.',
        recovery: '6 years to recover'
    },
    {
        key: 'crisis2008',
        drop: -50,
        year: '2008',
        label: '2008 Financial Crisis',
        description: 'Global financial crisis triggered by subprime mortgage collapse.',
        recovery: '18 months to recover'
    },
    {
        key: 'covid',
        drop: -34,
        year: '2020',
        label: 'COVID Crash',
        description: 'Fastest bear market in history due to global pandemic fears.',
        recovery: '5 months to recover'
    }
];

// Display texts of a historical crash, translated (the crash data above stays language-neutral)
const localizeCrash = (crash, t) => ({
    ...crash,
    label: t(`investments.riskStorm.crashes.${crash.key}.label`, crash.label),
    description: t(`investments.riskStorm.crashes.${crash.key}.description`, crash.description),
    recovery: t(`investments.riskStorm.crashes.${crash.key}.recovery`, crash.recovery)
});

// Bucket volatility multipliers (how much each bucket drops during crashes)
const BUCKET_VOLATILITY = {
    short: 0.05,   // Cash/bonds barely move
    mid: 0.60,     // Balanced portfolio
    long: 1.0      // Fully exposed to market
};

// Educational overlay messages keyed by threshold
const EDUCATIONAL_THRESHOLDS = [
    { threshold: -10, key: 'mild', icon: '📉' },
    { threshold: -20, key: 'diversification', icon: '🛡️' },
    { threshold: -35, key: 'recovery', icon: '📈' },
    { threshold: -50, key: 'sellWarning', icon: '⚠️' }
];

// Portfolio Bucket Display
const BucketImpact = ({ bucket, allocation, baseValue, crashPercent, t }) => {
    // Ensure allocation is a number, default to 0
    const safeAllocation = Number(allocation) || 0;
    const bucketValue = baseValue * (safeAllocation / 100);
    const volatility = BUCKET_VOLATILITY[bucket];
    const bucketDrop = crashPercent * volatility;
    const newValue = bucketValue * (1 + bucketDrop / 100);

    const bucketInfo = BUCKET_INFO[bucket];

    const statusColor = useMemo(() => {
        if (bucketDrop > -5) return 'text-emerald-600 bg-emerald-50';
        if (bucketDrop > -20) return 'text-amber-600 bg-amber-50';
        return 'text-red-600 bg-red-50';
    }, [bucketDrop]);

    const statusIcon = useMemo(() => {
        if (bucketDrop > -5) return '✅';
        if (bucketDrop > -20) return '⚠️';
        return '🔴';
    }, [bucketDrop]);

    return (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
                <span className="text-xl">{bucketInfo.icon}</span>
                <div>
                    <div className="font-medium text-slate-800">
                        {t(`investments.buckets.${bucket}.name`, bucketInfo.name)}
                    </div>
                    <div className="text-xs text-slate-500">
                        {allocation}% • {t(`investments.buckets.${bucket}.timeRange`, bucketInfo.timeRange)}
                    </div>
                </div>
            </div>
            <div className="text-end">
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-sm line-through">
                        ${bucketValue.toLocaleString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${statusColor}`}>
                        {statusIcon} ${Math.round(newValue).toLocaleString()}
                    </span>
                </div>
                <div className="text-xs text-slate-500">
                    {bucketDrop.toFixed(1)}%
                </div>
            </div>
        </div>
    );
};

// Educational Overlay Component
const EducationalOverlay = ({ messageKey, onDismiss, t }) => {
    const messages = {
        mild: {
            title: t('investments.onboarding.stressTest.educationalOverlay.mild', 'Normal market fluctuation'),
            description: t('investments.tooltips.volatility', 'This is normal! Markets move up and down daily.'),
            color: 'bg-blue-50 border-blue-200'
        },
        diversification: {
            title: t('investments.onboarding.stressTest.educationalOverlay.diversification', 'Diversification at work!'),
            description: t('investments.tooltips.shortBucket', "Notice your Short Term bucket stayed safe? That's diversification protecting your near-term goals."),
            color: 'bg-emerald-50 border-emerald-200'
        },
        recovery: {
            title: t('investments.onboarding.stressTest.educationalOverlay.recovery', 'History shows recovery'),
            description: t('investments.riskStorm.overlay.recoveryDesc', 'Markets recovered from 2008 in about 18 months. The S&P 500 went on to 5x from the bottom. Patience pays.'),
            color: 'bg-amber-50 border-amber-200'
        },
        sellWarning: {
            title: t('investments.onboarding.stressTest.educationalOverlay.sellWarning', 'The danger zone'),
            description: t('investments.riskStorm.overlay.sellWarningDesc', 'In 2008, many sold here and locked in permanent losses. Those who waited recovered fully—and then some.'),
            color: 'bg-red-50 border-red-200'
        }
    };

    const message = messages[messageKey];
    if (!message) return null;

    return (
        <div className={`mt-4 p-4 rounded-xl border ${message.color} animate-in fade-in-50 duration-300`}>
            <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="font-medium text-slate-800 mb-1">{message.title}</h4>
                    <p className="text-sm text-slate-600">{message.description}</p>
                </div>
                <button onClick={onDismiss} className="p-1 hover:bg-white/50 rounded-full">
                    <X className="w-4 h-4 text-slate-400" />
                </button>
            </div>
        </div>
    );
};

// "I Want to Sell" Modal
const SellModal = ({ portfolioLoss, onClose, onConfirmStay, t }) => {
    const [showRecoveryData, setShowRecoveryData] = useState(false);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {t('investments.onboarding.stressTest.sellModal.title', 'Wait! Before You Sell...')}
                    </h3>
                    <p className="text-slate-600">
                        {t('investments.onboarding.stressTest.sellModal.subtitle',
                            'Selling now would lock in a {{loss}} loss. Let\'s look at what history tells us.',
                            { loss: portfolioLoss }
                        )}
                    </p>
                </div>

                {!showRecoveryData ? (
                    <button
                        onClick={() => setShowRecoveryData(true)}
                        className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 
                            font-medium transition-all flex items-center justify-center gap-2 mb-4"
                    >
                        <History className="w-5 h-5" />
                        {t('investments.onboarding.stressTest.sellModal.showHistory', 'Show Me The History')}
                    </button>
                ) : (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl mb-4 animate-in fade-in-50">
                        <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            {t('investments.onboarding.stressTest.sellModal.historyTitle', 'Market Recovery History')}
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">{t('investments.riskStorm.history.crisis2008', '2008 Crisis (-50%)')}</span>
                                <span className="text-emerald-600 font-medium">{t('investments.riskStorm.history.crisis2008Result', 'Recovered in 18 months')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">{t('investments.riskStorm.history.covid', 'COVID Crash (-34%)')}</span>
                                <span className="text-emerald-600 font-medium">{t('investments.riskStorm.history.covidResult', 'Recovered in 5 months')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">{t('investments.riskStorm.history.inflation2022', '2022 Inflation (-19%)')}</span>
                                <span className="text-emerald-600 font-medium">{t('investments.riskStorm.history.inflation2022Result', 'Recovered in 14 months')}</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-3 italic">
                            {t('investments.riskStorm.history.note', '* Those who sold at the bottom permanently lost money. Those who waited recovered fully.')}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="py-3 px-4 border-2 border-red-200 text-red-600 rounded-xl 
                            font-medium hover:bg-red-50 transition-all"
                    >
                        {t('investments.onboarding.stressTest.sellModal.sellAnyway', 'Sell Anyway')}
                    </button>
                    <button
                        onClick={onConfirmStay}
                        className="py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white 
                            rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <Shield className="w-4 h-4" />
                        {t('investments.onboarding.stressTest.sellModal.stayInvested', 'Stay Invested')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main RiskStormSimulator Component
export const RiskStormSimulator = ({
    userId,
    allocation = { short: 20, mid: 30, long: 50 },
    onComplete,
    onRiskScoreChange,
    embedded = false
}) => {
    const { t } = useTranslation();
    const crashes = HISTORICAL_CRASHES.map(crash => localizeCrash(crash, t));
    const { isRTL } = useLanguage(userId);

    const [crashPercent, setCrashPercent] = useState(0);
    const [showSellModal, setShowSellModal] = useState(false);
    const [dismissedOverlays, setDismissedOverlays] = useState([]);
    const [hasClickedSell, setHasClickedSell] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const basePortfolioValue = 100000; // Hypothetical $100k

    // Calculate total portfolio impact
    const portfolioImpact = useMemo(() => {
        let totalNewValue = 0;

        Object.entries(allocation).forEach(([bucket, alloc]) => {
            const bucketValue = basePortfolioValue * (alloc / 100);
            const volatility = BUCKET_VOLATILITY[bucket];
            const bucketDrop = crashPercent * volatility;
            totalNewValue += bucketValue * (1 + bucketDrop / 100);
        });

        const totalLoss = basePortfolioValue - totalNewValue;
        const totalLossPercent = (totalLoss / basePortfolioValue) * 100;

        return { totalNewValue, totalLoss, totalLossPercent };
    }, [crashPercent, allocation]);

    // Determine current educational overlay
    const currentOverlay = useMemo(() => {
        const threshold = EDUCATIONAL_THRESHOLDS.slice().reverse().find(t => crashPercent <= t.threshold);
        if (threshold && !dismissedOverlays.includes(threshold.key)) {
            return threshold.key;
        }
        return null;
    }, [crashPercent, dismissedOverlays]);

    // Calculate risk score based on when user clicks sell (or doesn't)
    const calculateRiskScore = useCallback(() => {
        // If user clicked sell at a certain crash level, their tolerance is lower
        // If they never clicked sell (even at -50%), they have high tolerance
        if (!hasClickedSell) {
            return 0.85; // High risk tolerance
        }

        // Risk score inversely related to where they panicked
        // -10% panic = 0.3 score, -50% panic = 0.7 score
        const normalizedPanic = Math.abs(crashPercent) / 50;
        return Math.max(0.3, Math.min(0.8, normalizedPanic));
    }, [crashPercent, hasClickedSell]);

    // Handle sell button click
    const handleSellClick = () => {
        setHasClickedSell(true);
        setShowSellModal(true);
    };

    // Handle completing the simulator
    const handleComplete = async () => {
        const riskScore = calculateRiskScore();

        if (userId) {
            setIsSaving(true);
            try {
                await saveInvestmentProfile(userId, {
                    riskToleranceScore: riskScore,
                    stressTestResponses: {
                        maxCrashViewed: crashPercent,
                        clickedSell: hasClickedSell,
                        sellCrashLevel: hasClickedSell ? crashPercent : null
                    }
                });
            } catch (err) {
                console.error('Failed to save risk profile:', err);
            } finally {
                setIsSaving(false);
            }
        }

        onRiskScoreChange?.(riskScore);
        onComplete?.();
    };

    return (
        <div className={`space-y-6 ${embedded ? '' : 'bg-white rounded-2xl p-6 shadow-sm'}`}>
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    {t('investments.onboarding.stressTest.title', 'Risk Storm Simulator')}
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                    {t('investments.onboarding.stressTest.subtitle', "Let's see how you handle market turbulence")}
                </h2>
                <p className="text-slate-500 mt-1">
                    {t('investments.onboarding.stressTest.hypothetical', 'Imagine you have $100,000 invested...')}
                </p>
            </div>

            {/* Portfolio Visualization */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4">
                <div className="text-sm text-slate-500 mb-3 uppercase tracking-wide font-medium">
                    {t('investments.riskStorm.yourPortfolio', 'Your Portfolio')}
                </div>

                <div className="space-y-2">
                    {['short', 'mid', 'long'].map(bucket => (
                        <BucketImpact
                            key={bucket}
                            bucket={bucket}
                            allocation={allocation[bucket]}
                            baseValue={basePortfolioValue}
                            crashPercent={crashPercent}
                            t={t}
                        />
                    ))}
                </div>

                {/* Total */}
                <div className="mt-4 p-3 bg-white rounded-xl border-2 border-slate-200">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{t('investments.misc.totalPortfolio', 'Total Portfolio')}</span>
                        <div className="text-end">
                            <div className={`text-xl font-bold ${crashPercent < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                ${Math.round(portfolioImpact.totalNewValue).toLocaleString()}
                            </div>
                            <div className="text-sm text-slate-500">
                                {crashPercent < 0 && (
                                    <span className="text-red-500">
                                        -{portfolioImpact.totalLossPercent.toFixed(1)}% (${Math.round(portfolioImpact.totalLoss).toLocaleString()})
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Crash Slider with Inline Event Markers */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                        {t('investments.onboarding.stressTest.dragSlider', 'Drag to simulate a market crash')}
                    </span>
                    <span className={`font-bold text-lg ${crashPercent < -30 ? 'text-red-600' : crashPercent < -15 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {crashPercent}%
                    </span>
                </div>

                <div className="relative pt-8 pb-4">
                    {/* Event Markers ON the slider */}
                    {crashes.map(crash => {
                        // Position: -50 is left (0%), 0 is right (100%)
                        const position = ((crash.drop + 50) / 50) * 100;
                        const isActive = crashPercent === crash.drop;

                        return (
                            <button
                                key={crash.key}
                                onClick={() => setCrashPercent(crash.drop)}
                                className="absolute transform -translate-x-1/2 -translate-y-full z-10"
                                style={{ left: `${position}%`, top: '8px' }}
                            >
                                <div className={`flex flex-col items-center transition-all ${isActive ? 'scale-110' : ''}`}>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap
                                        ${isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                        {crash.year}
                                    </span>
                                    <div className={`w-0.5 h-3 ${isActive ? 'bg-slate-800' : 'bg-slate-300'}`} />
                                </div>
                            </button>
                        );
                    })}

                    <input
                        type="range"
                        min="-50"
                        max="0"
                        value={crashPercent}
                        onChange={(e) => setCrashPercent(Number(e.target.value))}
                        className="w-full h-3 bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 rounded-full appearance-none cursor-pointer relative z-0
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
                            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-300
                            [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20"
                    />

                    {/* End labels */}
                    <div className="absolute -bottom-2 start-0 end-0 flex justify-between text-xs text-slate-400">
                        <span>-50%</span>
                        <span>0%</span>
                    </div>
                </div>

                {/* Event Details - Show when an event is selected */}
                {crashes.find(c => c.drop === crashPercent) && (() => {
                    const event = crashes.find(c => c.drop === crashPercent);
                    return (
                        <div className="mt-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 animate-in fade-in-50 duration-200">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                    {event.year}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 mb-1">{event.label}</h4>
                                    <p className="text-sm text-slate-600 mb-2">{event.description}</p>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                            📈 {event.recovery}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Educational Overlay */}
            {currentOverlay && (
                <EducationalOverlay
                    messageKey={currentOverlay}
                    onDismiss={() => setDismissedOverlays(prev => [...prev, currentOverlay])}
                    t={t}
                />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleSellClick}
                    disabled={crashPercent >= 0}
                    className="flex-1 py-3 px-4 border-2 border-red-200 text-red-600 rounded-xl font-medium 
                        hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2"
                >
                    <TrendingDown className="w-5 h-5" />
                    {t('investments.onboarding.stressTest.sellButton', "😨 STOP! I Want to Sell!")}
                </button>

                <button
                    onClick={handleComplete}
                    disabled={isSaving}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white 
                        rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50
                        flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <Check className="w-5 h-5" />
                            {t('investments.onboarding.stressTest.complete', "I'm Ready")}
                        </>
                    )}
                </button>
            </div>

            {/* Sell Modal */}
            {showSellModal && (
                <SellModal
                    portfolioLoss={`$${Math.round(portfolioImpact.totalLoss).toLocaleString()}`}
                    onClose={() => setShowSellModal(false)}
                    onConfirmStay={() => {
                        setShowSellModal(false);
                        setHasClickedSell(false); // They learned, reset sell state
                    }}
                    t={t}
                />
            )}
        </div>
    );
};

export default RiskStormSimulator;
