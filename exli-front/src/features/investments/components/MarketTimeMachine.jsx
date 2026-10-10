import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import {
    TrendingDown, TrendingUp, Clock, ChevronRight, Award,
    AlertTriangle, Sparkles, Zap, Target, Shield, Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveInvestmentProfile } from '../../../config/investmentProfileService';

// ============================================
// THE 5 HISTORICAL SCENARIOS
// ============================================
// Display texts of a scenario, translated (the scenario data below stays language-neutral)
const localizeScenario = (scenario, t) => ({
    ...scenario,
    name: t('investments.timeMachine.marketEvent', 'Market Event'),
    headline: t(`investments.timeMachine.scenarios.${scenario.id}.headline`, scenario.headline),
    context: t(`investments.timeMachine.scenarios.${scenario.id}.context`, scenario.context),
    lesson: t(`investments.timeMachine.scenarios.${scenario.id}.lesson`, scenario.lesson)
});

const SCENARIOS = [
    {
        id: 'dotcom',
        year: 2000,
        name: 'Market Event',
        headline: "Tech stocks hit all-time highs! Internet companies are the future.",
        context: "Valuations are sky-high. Everyone is buying. Your neighbor just made $50k on a stock tip.",
        shortTermDrop: -49,
        longTermRecovery: 85,
        lesson: "Bubbles burst. Buying at the peak hurts, but patience heals.",
        emoji: '💻',
        recoveryYears: 7
    },
    {
        id: 'financial2008',
        year: 2008,
        name: 'Market Event',
        headline: "Breaking News: Major Institutions Collapsing",
        context: "Major banks are failing. Panic is spreading. People are losing their homes.",
        shortTermDrop: -56,
        longTermRecovery: 140,
        lesson: "The world didn't end. Resilience paid off massively.",
        emoji: '🏦',
        recoveryYears: 5
    },
    {
        id: 'euro2011',
        year: 2011,
        name: 'Market Event',
        headline: "Debt Defaults Rise. Global Economic Union in Danger.",
        context: "High uncertainty in global markets. Politicians are arguing.",
        shortTermDrop: -19,
        longTermRecovery: 30,
        lesson: "Political noise often creates temporary dips, not permanent damage.",
        emoji: '🇪🇺',
        recoveryYears: 2
    },
    {
        id: 'covid2020',
        year: 2020,
        name: 'Market Event',
        headline: "Global Crisis Declared. Economies enter lockdown.",
        context: "Unprecedented global shutdown. No one knows how long this will last.",
        shortTermDrop: -34,
        longTermRecovery: 75,
        lesson: "Fastest drop in history, followed by the fastest recovery.",
        emoji: '🦠',
        recoveryYears: 1
    },
    {
        id: 'inflation2022',
        year: 2022,
        name: 'Market Event',
        headline: "Inflation hits 40-year high. Central Banks hike rates aggressively.",
        context: "Tech stocks are plummeting. Bonds are down. Nowhere to hide.",
        shortTermDrop: -25,
        longTermRecovery: 45,
        lesson: "Interest rates hurt initially, but innovation always drives growth.",
        emoji: '📈',
        recoveryYears: 2
    }
];

// ============================================
// ANIMATED COUNTER
// ============================================
const AnimatedCounter = ({ value, prefix = '$', className = '' }) => {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const duration = 600;
        const steps = 20;
        const stepTime = duration / steps;
        const startValue = displayValue;
        const diff = value - startValue;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setDisplayValue(Math.round(startValue + diff * eased));

            if (step >= steps) {
                clearInterval(timer);
                setDisplayValue(value);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [value]);

    const isNegative = displayValue < 100000;
    const changeColor = isNegative ? 'text-red-600' : 'text-emerald-600';

    return (
        <span className={`${className} ${changeColor}`}>
            {prefix}{displayValue.toLocaleString()}
        </span>
    );
};

// ============================================
// HEADER HUD - Net Worth, Split Bar, Year
// ============================================
const HeaderHUD = ({ netWorth, invested, cash, year, scenarioName }) => {
    const { t } = useTranslation();
    const total = invested + cash;
    const investedPercent = total > 0 ? (invested / total) * 100 : 50;

    return (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
            {/* Year Badge */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400 text-sm">{t('investments.misc.year', 'Year')}</span>
                    <span className="font-bold text-xl text-amber-400">{year}</span>
                </div>
                <span className="text-xs text-slate-500 max-w-[150px] truncate">{scenarioName}</span>
            </div>

            {/* Net Worth */}
            <div className="text-center mb-4">
                <div className="text-xs text-slate-400 mb-1">{t('investments.misc.yourPortfolio', 'Your Portfolio')}</div>
                <AnimatedCounter
                    value={Math.round(netWorth)}
                    className="text-3xl font-bold"
                />
            </div>

            {/* Split Bar */}
            <div className="space-y-2">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                    <motion.div
                        className="bg-gradient-to-r from-purple-500 to-purple-400 flex items-center justify-center"
                        animate={{ width: `${investedPercent}%` }}
                        transition={{ duration: 0.5 }}
                    >
                        {investedPercent > 20 && (
                            <span className="text-[10px] font-bold text-white/80">
                                {Math.round(investedPercent)}%
                            </span>
                        )}
                    </motion.div>
                    <motion.div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-center flex-1"
                        transition={{ duration: 0.5 }}
                    >
                        {(100 - investedPercent) > 20 && (
                            <span className="text-[10px] font-bold text-white/80">
                                {Math.round(100 - investedPercent)}%
                            </span>
                        )}
                    </motion.div>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-purple-400">
                        📈 Invested: ${Math.round(invested).toLocaleString()}
                    </span>
                    <span className="text-emerald-400">
                        💵 Cash: ${Math.round(cash).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CONTINUOUS CHART - Progressive SVG Drawing
// ============================================
const ContinuousChart = ({ dataPoints, currentIndex }) => {
    const { t } = useTranslation();
    const width = 400;
    const height = 150;
    const padding = { left: 40, right: 20, top: 20, bottom: 30 };

    const visiblePoints = dataPoints.slice(0, currentIndex + 1);

    if (visiblePoints.length < 2) {
        return (
            <div className="bg-slate-50 rounded-xl p-4 h-48 flex items-center justify-center">
                <span className="text-slate-400">{t('investments.timeMachine.startingSimulation', 'Starting simulation...')}</span>
            </div>
        );
    }

    const values = visiblePoints.map(d => d.value);
    const maxValue = Math.max(...values) * 1.1;
    const minValue = Math.min(...values) * 0.9;
    const range = maxValue - minValue || 1;

    const getX = (i) => padding.left + (i / (dataPoints.length - 1)) * (width - padding.left - padding.right);
    const getY = (val) => padding.top + ((maxValue - val) / range) * (height - padding.top - padding.bottom);

    // Build path
    const pathD = visiblePoints.map((d, i) =>
        `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`
    ).join(' ');

    // Determine trend
    const startVal = visiblePoints[0]?.value || 100000;
    const currentVal = visiblePoints[visiblePoints.length - 1]?.value || 100000;
    const isUp = currentVal >= startVal;

    return (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-2">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
                {/* Grid lines */}
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom}
                    stroke="#e2e8f0" strokeWidth="1" />
                <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom}
                    stroke="#e2e8f0" strokeWidth="1" />

                {/* Y-axis labels */}
                <text x={padding.left - 5} y={padding.top + 5} className="text-[9px] fill-slate-400" textAnchor="end">
                    ${Math.round(maxValue / 1000)}k
                </text>
                <text x={padding.left - 5} y={height - padding.bottom} className="text-[9px] fill-slate-400" textAnchor="end">
                    ${Math.round(minValue / 1000)}k
                </text>

                {/* The line */}
                <motion.path
                    d={pathD}
                    fill="none"
                    stroke={isUp ? '#10b981' : '#ef4444'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />

                {/* Current dot */}
                <motion.circle
                    cx={getX(visiblePoints.length - 1)}
                    cy={getY(currentVal)}
                    r="6"
                    fill={isUp ? '#10b981' : '#ef4444'}
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
                />

                {/* Event markers */}
                {visiblePoints.map((point, i) => point.isEvent && (
                    <g key={i}>
                        <circle cx={getX(i)} cy={getY(point.value)} r="4" fill="#6366f1" />
                        <text x={getX(i)} y={height - 5} className="text-[8px] fill-slate-500" textAnchor="middle">
                            {point.year}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

// ============================================
// ALLOCATION SLIDER - Sell / Hold / Buy
// ============================================
const AllocationSlider = ({
    value,
    onChange,
    maxSell,
    maxBuy,
    onConfirm,
    disabled = false
}) => {
    const { t } = useTranslation();

    // value: -100 to +100
    // negative = selling (invested -> cash)
    // positive = buying (cash -> invested)

    const sellAmount = value < 0 ? Math.abs(value / 100) * maxSell : 0;
    const buyAmount = value > 0 ? (value / 100) * maxBuy : 0;

    const getActionText = () => {
        if (Math.abs(value) < 5) return { text: "Hold - No changes", color: 'text-slate-600', emoji: '⏸️' };
        if (value < 0) return {
            text: `Selling $${Math.round(sellAmount).toLocaleString()}`,
            color: 'text-red-600',
            emoji: '📉'
        };
        return {
            text: `Investing $${Math.round(buyAmount).toLocaleString()}`,
            color: 'text-purple-600',
            emoji: '📈'
        };
    };

    const action = getActionText();

    return (
        <div className="space-y-4">
            {/* Action Preview */}
            <div className="text-center">
                <motion.div
                    className={`text-xl font-bold ${action.color}`}
                    key={action.text}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                >
                    {action.emoji} {action.text}
                </motion.div>
            </div>

            {/* The Slider */}
            <div className="relative px-2">
                {/* Track Background */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-4 rounded-full overflow-hidden flex">
                    <div className="w-1/2 bg-gradient-to-r from-red-400 to-red-200" />
                    <div className="w-1/2 bg-gradient-to-r from-purple-200 to-purple-400" />
                </div>

                {/* Center marker */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-slate-400 rounded-full z-10" />

                <input
                    type="range"
                    min="-100"
                    max="100"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    disabled={disabled}
                    className="relative w-full h-4 bg-transparent appearance-none cursor-pointer z-20
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 
                        [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-4
                        [&::-webkit-slider-thumb]:border-slate-300
                        [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                />

                {/* Labels */}
                <div className="flex justify-between text-xs mt-2 text-slate-500">
                    <span className="text-red-500">{t('investments.timeMachine.sellAll', '← Sell All')}</span>
                    <span>{t('investments.misc.hold', 'Hold')}</span>
                    <span className="text-purple-500">{t('investments.timeMachine.buyMax', 'Buy Max →')}</span>
                </div>
            </div>

            {/* Confirm Button */}
            <motion.button
                onClick={onConfirm}
                disabled={disabled}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl 
                    font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {t('common.confirm', 'Confirm Decision')}
                <ChevronRight className="w-5 h-5" />
            </motion.button>
        </div>
    );
};

// ============================================
// SCENARIO OVERLAY - Headlines & Context
// ============================================
const ScenarioOverlay = ({ scenario, phase, children }) => {
    const { t } = useTranslation();
    const isHeadline = phase === 'headline';
    const isReaction = phase === 'reaction';

    return (
        <motion.div
            className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            {/* Scenario Header */}
            <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{scenario.emoji}</span>
                <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                        {isHeadline ? t('investments.timeMachine.breakingNews', 'Breaking News') : isReaction ? t('investments.timeMachine.marketUpdate', 'Market Update') : t('investments.timeMachine.aftermath', 'The Aftermath')}
                    </div>
                    <h3 className="font-bold text-slate-800">{scenario.name}</h3>
                </div>
            </div>

            {/* Headline */}
            {isHeadline && (
                <div className="space-y-3 mb-4">
                    <div className="bg-amber-50 border-s-4 border-amber-400 p-3 rounded-e-lg">
                        <p className="font-medium text-amber-800">"{scenario.headline}"</p>
                    </div>
                    <p className="text-slate-600 text-sm">{scenario.context}</p>
                </div>
            )}

            {/* Reaction Phase */}
            {isReaction && (
                <div className="bg-red-50 border-s-4 border-red-400 p-3 rounded-e-lg mb-4">
                    <p className="font-medium text-red-800">
                        {t('investments.timeMachine.marketDropped', { drop: Math.abs(scenario.shortTermDrop), defaultValue: '📉 Market just dropped {{drop}}%!' })}
                    </p>
                    <p className="text-sm text-red-600 mt-1">{t('investments.timeMachine.adjustHint', 'How do you feel now? Adjust if needed.')}</p>
                </div>
            )}

            {children}
        </motion.div>
    );
};

// ============================================
// RESULTS SCREEN - The Big Reveal
// ============================================
const ResultsScreen = ({
    decisions,
    finalNetWorth,
    startingNetWorth,
    finalAllocation,
    onComplete,
    t
}) => {
    // Analyze decisions
    const analyzeRisk = () => {
        let soldOnNews = 0;
        let soldOnDrop = 0;
        let boughtOnDrop = 0;
        let held = 0;

        decisions.forEach(d => {
            if (Math.abs(d.value) < 10) {
                held++;
            } else if (d.value < 0) {
                if (d.phase === 'headline') soldOnNews++;
                else soldOnDrop++;
            } else {
                boughtOnDrop++;
            }
        });

        // Determine profile
        if (boughtOnDrop >= 4) return {
            id: 'aggressive',
            name: 'Aggressive Investor',
            emoji: '🚀',
            description: "You bought the dips! You understand that crashes are opportunities.",
            color: 'emerald',
            allocation: { long: 70, mid: 20, short: 10 }
        };

        if (soldOnDrop >= 3) return {
            id: 'conservative',
            name: 'Conservative Investor',
            emoji: '🛡️',
            description: "You protected your money during turbulence. Safety first!",
            color: 'amber',
            allocation: { long: 30, mid: 30, short: 40 }
        };

        if (soldOnNews >= 3) return {
            id: 'reactive',
            name: 'Reactive Investor',
            emoji: '⚡',
            description: "You react quickly to news. Consider waiting to see the full picture.",
            color: 'blue',
            allocation: { long: 40, mid: 35, short: 25 }
        };

        if (held >= 5) return {
            id: 'steady',
            name: 'Steady Hand Investor',
            emoji: '⚓',
            description: "You stayed calm through the storms. Discipline is your strength.",
            color: 'purple',
            allocation: { long: 55, mid: 30, short: 15 }
        };

        return {
            id: 'balanced',
            name: 'Balanced Investor',
            emoji: '⚖️',
            description: "You adapted your strategy based on conditions. Flexibility is key.",
            color: 'indigo',
            allocation: { long: 50, mid: 30, short: 20 }
        };
    };

    const profile = analyzeRisk();
    const returnPercent = ((finalNetWorth - startingNetWorth) / startingNetWorth * 100).toFixed(1);
    const isPositive = finalNetWorth >= startingNetWorth;

    const colorMap = {
        emerald: 'from-emerald-500 to-teal-500',
        amber: 'from-amber-500 to-orange-500',
        blue: 'from-blue-500 to-cyan-500',
        purple: 'from-purple-500 to-violet-500',
        indigo: 'from-indigo-500 to-purple-500'
    };

    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* The Reveal */}
            <div className="text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 10 }}
                    className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center"
                >
                    <span className="text-5xl">{profile.emoji}</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="text-sm text-purple-600 font-medium mb-1">
                        {t('investments.timeMachine.riskDnaRevealed', '✨ Your Risk DNA Revealed ✨')}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{t(`investments.timeMachine.profiles.${profile.id}.name`, profile.name)}</h2>
                    <p className="text-slate-600 mt-2 max-w-sm mx-auto">{t(`investments.timeMachine.profiles.${profile.id}.description`, profile.description)}</p>
                </motion.div>
            </div>

            {/* Performance Summary */}
            <motion.div
                className={`bg-gradient-to-r ${colorMap[profile.color]} rounded-2xl p-5 text-white text-center`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
            >
                <div className="text-sm text-white/80 mb-1">{t('investments.timeMachine.yearsOfHistory', '25 Years of History')}</div>
                <div className="text-3xl font-bold mb-2">
                    ${Math.round(finalNetWorth).toLocaleString()}
                </div>
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${isPositive ? 'bg-white/20' : 'bg-red-500/30'}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {t('investments.timeMachine.totalReturn', { sign: isPositive ? '+' : '', percent: returnPercent, defaultValue: '{{sign}}{{percent}}% Total Return' })}
                </div>
            </motion.div>

            {/* The Secret Reveal */}
            <motion.div
                className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
            >
                <Sparkles className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                <p className="text-sm text-indigo-700">
                    <strong>{t('investments.timeMachine.secretLabel', 'Secret:')}</strong> {t('investments.timeMachine.secretText', "This wasn't just a game! Your 10 decisions revealed how you naturally handle market stress.")}
                </p>
            </motion.div>

            {/* Recommended Allocation */}
            <motion.div
                className="bg-white rounded-2xl border border-slate-200 p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
            >
                <h3 className="font-bold text-slate-800 mb-4 text-center">
                    {t('investments.timeMachine.personalizedAllocation', '📊 Your Personalized Allocation')}
                </h3>

                <div className="space-y-3">
                    {[
                        { key: 'long', label: 'Long Range', icon: '🚀', emoji: 'Growth', color: 'bg-emerald-500' },
                        { key: 'mid', label: 'Mid Range', icon: '⚓', emoji: 'Balanced', color: 'bg-blue-500' },
                        { key: 'short', label: 'Short Term', icon: '🛡️', emoji: 'Safe', color: 'bg-amber-500' }
                    ].map((bucket, i) => (
                        <motion.div
                            key={bucket.key}
                            className="space-y-1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.2 + i * 0.1 }}
                        >
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    <span>{bucket.icon}</span>
                                    <span className="font-medium text-slate-700">{bucket.label}</span>
                                </span>
                                <span className="font-bold text-slate-800">{profile.allocation[bucket.key]}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full ${bucket.color} rounded-full`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${profile.allocation[bucket.key]}%` }}
                                    transition={{ duration: 0.8, delay: 1.3 + i * 0.1 }}
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* CTA */}
            <motion.button
                onClick={() => onComplete(profile.allocation)}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl 
                    font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
            >
                {t('investments.timeMachine.applyStrategy', 'Apply This Strategy')}
                <ChevronRight className="w-5 h-5" />
            </motion.button>
        </motion.div>
    );
};

// ============================================
// MAIN COMPONENT: MARKET TIME MACHINE
// ============================================
export const MarketTimeMachine = ({
    userId,
    initialAllocation = { long: 60, mid: 25, short: 15 },
    onComplete,
    onAllocationChange
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);

    // State Machine
    const [currentScenario, setCurrentScenario] = useState(0);
    const [phase, setPhase] = useState('intro'); // intro, headline, shortTerm, reaction, longTerm, transition, results
    const [sliderValue, setSliderValue] = useState(0);

    // Wallet State (starts 80/20 invested/cash)
    const [wallet, setWallet] = useState({
        invested: 80000,
        cash: 20000
    });

    // Decision Tracking
    const [decisions, setDecisions] = useState([]);

    // Chart Data
    const [chartData, setChartData] = useState([
        { value: 100000, year: 1999, isEvent: false }
    ]);
    const [chartIndex, setChartIndex] = useState(0);

    // Loading
    const [isSaving, setIsSaving] = useState(false);

    // Calculate net worth
    const netWorth = wallet.invested + wallet.cash;

    // Current scenario data
    const scenario = localizeScenario(SCENARIOS[currentScenario], t);

    // Apply market change to invested portion
    const applyMarketChange = useCallback((changePercent) => {
        setWallet(prev => ({
            ...prev,
            invested: prev.invested * (1 + changePercent / 100)
        }));
    }, []);

    // Execute a decision (move money between invested/cash)
    const executeDecision = useCallback((value, scenarioIdx, decisionPhase) => {
        // Track decision
        setDecisions(prev => [...prev, {
            scenario: scenarioIdx,
            phase: decisionPhase,
            value: value
        }]);

        if (Math.abs(value) < 5) {
            // Hold - no action
            return;
        }

        setWallet(prev => {
            if (value < 0) {
                // Selling: move from invested to cash
                const sellAmount = Math.abs(value / 100) * prev.invested;
                return {
                    invested: prev.invested - sellAmount,
                    cash: prev.cash + sellAmount
                };
            } else {
                // Buying: move from cash to invested
                const buyAmount = (value / 100) * prev.cash;
                return {
                    invested: prev.invested + buyAmount,
                    cash: prev.cash - buyAmount
                };
            }
        });
    }, []);

    // Add data point to chart
    const addChartPoint = useCallback((value, year, isEvent = false) => {
        setChartData(prev => [...prev, { value, year, isEvent }]);
        setChartIndex(prev => prev + 1);
    }, []);

    // Start the simulation
    const startSimulation = () => {
        setPhase('headline');
        addChartPoint(netWorth, SCENARIOS[0].year, true);
    };

    // Handle decision confirmation
    const handleConfirmDecision = () => {
        if (phase === 'headline') {
            // Record headline decision, then show drop
            executeDecision(sliderValue, currentScenario, 'headline');
            setSliderValue(0);
            setPhase('shortTerm');

            // Animate the drop
            setTimeout(() => {
                applyMarketChange(scenario.shortTermDrop);
                const newNetWorth = (wallet.invested * (1 + scenario.shortTermDrop / 100)) + wallet.cash;
                addChartPoint(newNetWorth, scenario.year, false);

                setTimeout(() => setPhase('reaction'), 800);
            }, 500);

        } else if (phase === 'reaction') {
            // Record reaction decision, then show recovery
            executeDecision(sliderValue, currentScenario, 'reaction');
            setSliderValue(0);
            setPhase('longTerm');

            // Animate the recovery
            setTimeout(() => {
                applyMarketChange(scenario.longTermRecovery);
                const newNetWorth = (wallet.invested * (1 + scenario.longTermRecovery / 100)) + wallet.cash;
                addChartPoint(newNetWorth, scenario.year + scenario.recoveryYears, true);

                setTimeout(() => setPhase('transition'), 800);
            }, 500);
        }
    };

    // Move to next scenario
    const handleNextScenario = () => {
        if (currentScenario >= SCENARIOS.length - 1) {
            // All scenarios complete
            setPhase('results');
        } else {
            setCurrentScenario(prev => prev + 1);
            setPhase('headline');
        }
    };

    // Handle final completion
    const handleComplete = async (allocation) => {
        setIsSaving(true);

        try {
            if (userId) {
                // Calculate risk score from decisions
                const buyCount = decisions.filter(d => d.value > 10).length;
                const riskScore = buyCount / decisions.length;

                await saveInvestmentProfile(userId, {
                    riskToleranceScore: riskScore,
                    targetAllocation: {
                        long: allocation.long / 100,
                        mid: allocation.mid / 100,
                        short: allocation.short / 100
                    },
                    timeMachineCompleted: true,
                    timeMachineDecisions: decisions
                });
            }

            onAllocationChange?.(allocation);
            onComplete?.();
        } catch (err) {
            console.error('Failed to save:', err);
            onComplete?.();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* INTRO SCREEN */}
            {phase === 'intro' && (
                <motion.div
                    className="text-center space-y-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                        <Clock className="w-10 h-10 text-indigo-600" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t('investments.timeMachine.title', '🕰️ Market Time Machine')}
                        </h2>
                        <p className="text-slate-600 max-w-sm mx-auto">
                            {t('investments.timeMachine.intro', 'Travel through 25 years of market history. You start with $100,000. Make decisions as events unfold.')}
                        </p>
                    </div>

                    {/* Starting Portfolio */}
                    <div className="bg-slate-50 rounded-2xl p-4 max-w-xs mx-auto">
                        <div className="text-sm text-slate-500 mb-2">{t('investments.misc.yourStartingPortfolio', 'Your Starting Portfolio')}</div>
                        <div className="text-3xl font-bold text-slate-800 mb-3">$100,000</div>
                        <div className="flex gap-2 text-sm justify-center">
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                                {t('investments.timeMachine.invested80', '📈 80% Invested')}
                            </span>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                                {t('investments.timeMachine.cash20', '💵 20% Cash')}
                            </span>
                        </div>
                    </div>

                    <motion.button
                        onClick={startSimulation}
                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl 
                            font-bold hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Zap className="w-5 h-5" />
                        {t('investments.timeMachine.enter', 'Enter the Time Machine')}
                    </motion.button>
                </motion.div>
            )}

            {/* ACTIVE SIMULATION */}
            {(phase !== 'intro' && phase !== 'results') && (
                <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {/* Header HUD */}
                    <HeaderHUD
                        netWorth={netWorth}
                        invested={wallet.invested}
                        cash={wallet.cash}
                        year={scenario.year}
                        scenarioName={scenario.name}
                    />

                    {/* Progress */}
                    <div className="flex gap-1">
                        {SCENARIOS.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${i < currentScenario ? 'bg-emerald-500' :
                                        i === currentScenario ? 'bg-indigo-500' :
                                            'bg-slate-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Chart */}
                    <ContinuousChart
                        dataPoints={chartData}
                        currentIndex={chartIndex}
                    />

                    {/* Decision UI */}
                    <AnimatePresence mode="wait">
                        {(phase === 'headline' || phase === 'reaction') && (
                            <ScenarioOverlay scenario={scenario} phase={phase}>
                                <AllocationSlider
                                    value={sliderValue}
                                    onChange={setSliderValue}
                                    maxSell={wallet.invested}
                                    maxBuy={wallet.cash}
                                    onConfirm={handleConfirmDecision}
                                />
                            </ScenarioOverlay>
                        )}

                        {phase === 'shortTerm' && (
                            <motion.div
                                className="text-center py-8"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="text-4xl mb-2">📉</div>
                                <div className="text-xl font-bold text-red-600">
                                    {t('investments.timeMachine.marketDropping', 'Market dropping...')}
                                </div>
                            </motion.div>
                        )}

                        {phase === 'longTerm' && (
                            <motion.div
                                className="text-center py-8"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="text-4xl mb-2">📈</div>
                                <div className="text-xl font-bold text-emerald-600">
                                    {t('investments.timeMachine.marketRecovering', 'Markets recovering...')}
                                </div>
                            </motion.div>
                        )}

                        {phase === 'transition' && (
                            <motion.div
                                className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 text-center"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <div className="text-2xl mb-2">✅</div>
                                <h3 className="font-bold text-emerald-800 mb-2">
                                    {scenario.recoveryYears} Years Later...
                                </h3>
                                <p className="text-sm text-emerald-700 mb-4">
                                    {scenario.lesson}
                                </p>
                                <motion.button
                                    onClick={handleNextScenario}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium 
                                        hover:bg-emerald-700 transition-colors"
                                    whileHover={{ scale: 1.05 }}
                                >
                                    {currentScenario < SCENARIOS.length - 1 ? t('investments.timeMachine.nextEvent', 'Next Event →') : t('investments.timeMachine.seeResults', 'See Results →')}
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* RESULTS */}
            {phase === 'results' && (
                <ResultsScreen
                    decisions={decisions}
                    finalNetWorth={netWorth}
                    startingNetWorth={100000}
                    finalAllocation={initialAllocation}
                    onComplete={handleComplete}
                    t={t}
                />
            )}
        </div>
    );
};

export default MarketTimeMachine;
