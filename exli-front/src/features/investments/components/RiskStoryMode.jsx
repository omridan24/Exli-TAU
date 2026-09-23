import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import {
    TrendingDown, TrendingUp, Shield, Rocket, Anchor,
    ChevronRight, Award, AlertTriangle, Sparkles, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveInvestmentProfile } from '../../../config/investmentProfileService';

// ============================================
// STORY STAGES - The 3 Acts of Market History
// ============================================
const STORY_STAGES = [
    {
        id: 'correction',
        act: 1,
        name: 'Market Event',
        year: '2022',
        dropPercent: -15,
        narrative: {
            title: "Breaking News: Global Tensions Rising",
            intro: "Inflation is rising globally, central banks are hiking rates, and uncertainty is driving markets down.",
            climax: "Your portfolio is down 15%. News anchors warn of a prolonged bear market.",
            recovery: "But history shows corrections are normal. Markets recovered within 14 months."
        },
        recoveryMonths: 14,
        badgeOnHold: { icon: '🌱', name: 'Steady Growth', desc: 'Weathered your first storm' }
    },
    {
        id: 'flashCrash',
        act: 2,
        name: 'Market Event',
        year: '2020',
        dropPercent: -34,
        narrative: {
            title: "Breaking News: Global Crisis Declared",
            intro: "A global crisis hits. The world shuts down. Markets freefall in the fastest crash in recent history.",
            climax: "Your portfolio dropped 34% in just 4 weeks. Panic is everywhere.",
            recovery: "Those who held saw recovery in just 5 months. The market hit new highs within a year."
        },
        recoveryMonths: 5,
        badgeOnHold: { icon: '💎', name: 'Diamond Hands', desc: 'Held through the panic' }
    },
    {
        id: 'greatRecession',
        act: 3,
        name: 'Market Event',
        year: '2008',
        dropPercent: -50,
        narrative: {
            title: "Breaking News: Major Institutions Collapsing",
            intro: "Banks are failing. Major financial institutions collapse. The entire global financial system is shaking.",
            climax: "Your portfolio is cut in HALF. It feels like the end of the world.",
            recovery: "Those who held saw full recovery in 18 months. The market went on to multiply its value over the next decade."
        },
        recoveryMonths: 18,
        badgeOnHold: { icon: '🏆', name: 'Iron Stomach', desc: 'Survived a historic market crash' }
    }
];

// Bucket volatility (how much each bucket drops)
const BUCKET_VOLATILITY = {
    long: 1.0,    // Full market exposure
    mid: 0.6,     // Balanced
    short: 0.1    // Mostly safe
};

// ============================================
// ANIMATED COUNTER COMPONENT
// ============================================
const AnimatedCounter = ({ value, prefix = '$', className = '' }) => {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const duration = 800;
        const steps = 30;
        const stepTime = duration / steps;
        const stepValue = (value - displayValue) / steps;

        let current = displayValue;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current += stepValue;
            setDisplayValue(Math.round(current));

            if (step >= steps) {
                clearInterval(timer);
                setDisplayValue(value);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <span className={className}>
            {prefix}{displayValue.toLocaleString()}
        </span>
    );
};

// ============================================
// BUCKET VISUALIZATION BAR
// ============================================
const BucketBar = ({ allocation, balance, isDropping }) => {
    const buckets = [
        { key: 'long', label: 'Long Range', icon: '🚀', color: 'bg-purple-500', textColor: 'text-purple-600' },
        { key: 'mid', label: 'Mid Range', icon: '⚓', color: 'bg-blue-500', textColor: 'text-blue-600' },
        { key: 'short', label: 'Short Term', icon: '🛡️', color: 'bg-emerald-500', textColor: 'text-emerald-600' }
    ];

    return (
        <div className="space-y-2">
            <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                {buckets.map(bucket => (
                    <motion.div
                        key={bucket.key}
                        className={`${bucket.color} flex items-center justify-center text-white text-xs font-medium`}
                        initial={{ width: `${allocation[bucket.key]}%` }}
                        animate={{
                            width: `${allocation[bucket.key]}%`,
                            opacity: isDropping && bucket.key === 'long' ? 0.6 : 1
                        }}
                        transition={{ duration: 0.5 }}
                    >
                        {allocation[bucket.key] > 15 && (
                            <span>{bucket.icon} {allocation[bucket.key]}%</span>
                        )}
                    </motion.div>
                ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500">
                {buckets.map(bucket => (
                    <div key={bucket.key} className="flex items-center gap-1">
                        <span>{bucket.icon}</span>
                        <span className={bucket.textColor}>
                            ${Math.round(balance * allocation[bucket.key] / 100).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// ANIMATED CHART COMPONENT (SVG-based)
// ============================================
const StoryChart = ({ dataPoints, currentIndex, isRecovering }) => {
    const width = 400;
    const height = 200;
    const padding = 40;

    // Generate path from data points
    const maxValue = Math.max(...dataPoints.map(d => d.value));
    const minValue = Math.min(...dataPoints.map(d => d.value));
    const range = maxValue - minValue || 1;

    const getX = (i) => padding + (i / (dataPoints.length - 1)) * (width - padding * 2);
    const getY = (val) => height - padding - ((val - minValue) / range) * (height - padding * 2);

    const pathPoints = dataPoints.slice(0, currentIndex + 1).map((d, i) =>
        `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`
    ).join(' ');

    // Determine color based on trend
    const currentValue = dataPoints[currentIndex]?.value || 100000;
    const startValue = dataPoints[0]?.value || 100000;
    const isUp = currentValue >= startValue;

    return (
        <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
                {/* Grid lines */}
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={isRecovering ? '#10b981' : '#6366f1'} />
                        <stop offset="100%" stopColor={isRecovering ? '#10b981' : isUp ? '#10b981' : '#ef4444'} />
                    </linearGradient>
                </defs>

                {/* Y-axis labels */}
                <text x={padding - 5} y={padding} className="text-[10px] fill-slate-400" textAnchor="end">
                    ${Math.round(maxValue / 1000)}k
                </text>
                <text x={padding - 5} y={height - padding} className="text-[10px] fill-slate-400" textAnchor="end">
                    ${Math.round(minValue / 1000)}k
                </text>

                {/* The animated line */}
                <motion.path
                    d={pathPoints}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />

                {/* Current position dot */}
                <motion.circle
                    cx={getX(currentIndex)}
                    cy={getY(currentValue)}
                    r="8"
                    fill={isRecovering ? '#10b981' : isUp ? '#10b981' : '#ef4444'}
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                />

                {/* "You are here" label */}
                <motion.g
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                >
                    <rect
                        x={getX(currentIndex) - 30}
                        y={getY(currentValue) - 30}
                        width="60"
                        height="18"
                        rx="9"
                        fill="white"
                        stroke="#e2e8f0"
                    />
                    <text
                        x={getX(currentIndex)}
                        y={getY(currentValue) - 18}
                        textAnchor="middle"
                        className="text-[9px] fill-slate-600 font-medium"
                    >
                        You're here
                    </text>
                </motion.g>
            </svg>
        </div>
    );
};

// ============================================
// CHOICE OVERLAY CARD
// ============================================
const ChoiceOverlay = ({ stage, balance, onChoice, t }) => {
    const [hoveredChoice, setHoveredChoice] = useState(null);

    return (
        <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
            >
                {/* Crisis Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {stage.narrative.title}
                    </h3>
                    <p className="text-slate-600">{stage.narrative.climax}</p>
                    <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-full font-bold">
                        <TrendingDown className="w-5 h-5" />
                        ${Math.round(balance).toLocaleString()} ({stage.dropPercent}%)
                    </div>
                </div>

                {/* The Fork in the Road */}
                <div className="space-y-3">
                    {/* HOLD Choice */}
                    <motion.button
                        onClick={() => onChoice('HOLD')}
                        onMouseEnter={() => setHoveredChoice('HOLD')}
                        onMouseLeave={() => setHoveredChoice(null)}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left
                            ${hoveredChoice === 'HOLD'
                                ? 'border-emerald-500 bg-emerald-50 shadow-lg scale-[1.02]'
                                : 'border-slate-200 hover:border-emerald-300'}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">💎</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1">
                                    {t('investments.riskStory.holdTitle', 'Stay the Course')}
                                </h4>
                                <p className="text-sm text-slate-600">
                                    {t('investments.riskStory.holdDesc',
                                        "I understand this is temporary. History shows markets recover.")}
                                </p>
                                {hoveredChoice === 'HOLD' && (
                                    <motion.div
                                        className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <Award className="w-3 h-3" />
                                        Unlock: {stage.badgeOnHold.name}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.button>

                    {/* SELL Choice */}
                    <motion.button
                        onClick={() => onChoice('SELL')}
                        onMouseEnter={() => setHoveredChoice('SELL')}
                        onMouseLeave={() => setHoveredChoice(null)}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left
                            ${hoveredChoice === 'SELL'
                                ? 'border-amber-500 bg-amber-50 shadow-lg scale-[1.02]'
                                : 'border-slate-200 hover:border-amber-300'}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">🛡️</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1">
                                    {t('investments.riskStory.sellTitle', 'Protect My Money')}
                                </h4>
                                <p className="text-sm text-slate-600">
                                    {t('investments.riskStory.sellDesc',
                                        "This is too stressful. Move some money to safer investments.")}
                                </p>
                                {hoveredChoice === 'SELL' && (
                                    <motion.div
                                        className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <Heart className="w-3 h-3" />
                                        It's okay to protect what you have
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ============================================
// RECOVERY CELEBRATION SCREEN
// ============================================
const RecoveryCelebration = ({ stage, badge, newBalance, onContinue, t }) => {
    return (
        <motion.div
            className="fixed inset-0 bg-gradient-to-br from-emerald-500/90 to-teal-600/90 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="text-center text-white max-w-md"
                initial={{ scale: 0.8, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 15 }}
            >
                {/* Badge Animation */}
                <motion.div
                    className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 10, delay: 0.3 }}
                >
                    <span className="text-5xl">{badge.icon}</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3 className="text-2xl font-bold mb-2">
                        {t('investments.riskStory.badgeUnlocked', 'Badge Unlocked!')}
                    </h3>
                    <div className="text-lg font-medium text-emerald-100 mb-1">{badge.name}</div>
                    <p className="text-emerald-200 mb-6">{badge.desc}</p>
                </motion.div>

                <motion.div
                    className="bg-white/20 rounded-xl p-4 backdrop-blur-sm mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                >
                    <div className="text-sm text-emerald-100 mb-1">Market Recovered!</div>
                    <div className="text-3xl font-bold">${Math.round(newBalance).toLocaleString()}</div>
                    <div className="text-sm text-emerald-200 flex items-center justify-center gap-1 mt-1">
                        <TrendingUp className="w-4 h-4" />
                        Recovered in {stage.recoveryMonths} months
                    </div>
                </motion.div>

                <motion.button
                    onClick={onContinue}
                    className="px-8 py-3 bg-white text-emerald-600 rounded-xl font-bold hover:shadow-lg transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                >
                    {t('common.continue', 'Continue')} →
                </motion.button>
            </motion.div>
        </motion.div>
    );
};

// ============================================
// FINAL RESULTS SCREEN
// ============================================
const ResultsScreen = ({ choices, finalAllocation, initialBalance, onComplete, t }) => {
    const holdCount = choices.filter(c => c === 'HOLD').length;
    const sellCount = choices.filter(c => c === 'SELL').length;

    // Determine risk profile
    const getProfile = () => {
        if (holdCount === 3) return { name: 'Aggressive Growth', emoji: '🚀', color: 'text-purple-600' };
        if (holdCount >= 2) return { name: 'Growth Focused', emoji: '📈', color: 'text-blue-600' };
        if (holdCount === 1) return { name: 'Balanced', emoji: '⚖️', color: 'text-emerald-600' };
        return { name: 'Conservative', emoji: '🛡️', color: 'text-amber-600' };
    };

    const profile = getProfile();

    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* Header */}
            <div className="text-center">
                <motion.div
                    className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 10 }}
                >
                    <span className="text-4xl">{profile.emoji}</span>
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    {t('investments.riskStory.yourRiskDNA', 'Your Risk DNA')}
                </h2>
                <p className={`text-xl font-medium ${profile.color}`}>{profile.name}</p>
            </div>

            {/* Journey Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    {t('investments.riskStory.yourJourney', 'Your Journey')}
                </h3>

                <div className="space-y-3">
                    {STORY_STAGES.map((stage, i) => (
                        <div key={stage.id} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
                                ${choices[i] === 'HOLD' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                {choices[i] === 'HOLD' ? '💎' : '🛡️'}
                            </div>
                            <div className="flex-1">
                                <span className="font-medium text-slate-700">{stage.name}</span>
                                <span className="text-slate-500 text-sm ml-2">({stage.year})</span>
                            </div>
                            <span className={`text-sm font-medium ${choices[i] === 'HOLD' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {choices[i] === 'HOLD' ? 'Held Strong' : 'Protected'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recommended Allocation */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">
                    {t('investments.riskStory.recommendedAllocation', 'Your Recommended Mix')}
                </h3>

                <div className="space-y-4">
                    {[
                        { key: 'long', label: 'Long Range', icon: '🚀', color: 'bg-purple-500' },
                        { key: 'mid', label: 'Mid Range', icon: '⚓', color: 'bg-blue-500' },
                        { key: 'short', label: 'Short Term', icon: '🛡️', color: 'bg-emerald-500' }
                    ].map(bucket => (
                        <div key={bucket.key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    <span>{bucket.icon}</span>
                                    <span className="font-medium text-slate-700">{bucket.label}</span>
                                </span>
                                <span className="font-bold text-slate-800">{finalAllocation[bucket.key]}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full ${bucket.color} rounded-full`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${finalAllocation[bucket.key]}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA */}
            <motion.button
                onClick={onComplete}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold 
                    hover:shadow-lg transition-all flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {t('investments.riskStory.applyStrategy', 'Apply This Strategy')}
                <ChevronRight className="w-5 h-5" />
            </motion.button>
        </motion.div>
    );
};

// ============================================
// MAIN RISK STORY MODE COMPONENT
// ============================================
export const RiskStoryMode = ({
    userId,
    initialAllocation = { long: 60, mid: 25, short: 15 },
    onComplete,
    onAllocationChange
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);

    // State Machine
    const [currentStage, setCurrentStage] = useState(0); // 0 = intro, 1-3 = acts, 4 = results
    const [phase, setPhase] = useState('intro'); // intro, dropping, choice, recovering, results
    const [simulationBalance, setSimulationBalance] = useState(100000);
    const [allocation, setAllocation] = useState(initialAllocation);
    const [choices, setChoices] = useState([]); // ['HOLD', 'SELL', ...]
    const [earnedBadges, setEarnedBadges] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Chart data points
    const [chartData, setChartData] = useState([{ value: 100000, label: 'Start' }]);
    const [chartIndex, setChartIndex] = useState(0);

    // Calculate portfolio drop based on allocation and volatility
    const calculateDrop = useCallback((dropPercent) => {
        const weightedDrop = (
            (allocation.long / 100) * dropPercent * BUCKET_VOLATILITY.long +
            (allocation.mid / 100) * dropPercent * BUCKET_VOLATILITY.mid +
            (allocation.short / 100) * dropPercent * BUCKET_VOLATILITY.short
        );
        return weightedDrop;
    }, [allocation]);

    // Start the simulation
    const startSimulation = () => {
        setPhase('dropping');
        setCurrentStage(1);

        // Animate the first drop
        setTimeout(() => {
            const stage = STORY_STAGES[0];
            const effectiveDrop = calculateDrop(stage.dropPercent);
            const newBalance = simulationBalance * (1 + effectiveDrop / 100);

            setSimulationBalance(newBalance);
            setChartData(prev => [...prev, { value: newBalance, label: stage.name }]);
            setChartIndex(1);

            setTimeout(() => setPhase('choice'), 1500);
        }, 500);
    };

    // Handle user choice
    const handleChoice = (choice) => {
        const stage = STORY_STAGES[currentStage - 1];
        setChoices(prev => [...prev, choice]);

        if (choice === 'HOLD') {
            // Earn badge and show recovery
            setEarnedBadges(prev => [...prev, stage.badgeOnHold]);
            setPhase('recovering');

            // Simulate recovery (back to previous balance or higher)
            const recoveredBalance = simulationBalance / (1 + calculateDrop(stage.dropPercent) / 100);
            const growthBonus = 1.1; // 10% above pre-crash
            const finalRecoveredBalance = recoveredBalance * growthBonus;

            setTimeout(() => {
                setSimulationBalance(finalRecoveredBalance);
                setChartData(prev => [...prev, { value: finalRecoveredBalance, label: 'Recovery' }]);
                setChartIndex(prev => prev + 1);
            }, 500);

        } else {
            // SELL - Move money from Long to Short
            const movePercent = 15; // Move 15% from long to short
            setAllocation(prev => ({
                long: Math.max(20, prev.long - movePercent),
                mid: prev.mid,
                short: Math.min(50, prev.short + movePercent)
            }));

            // Move to next stage or results
            proceedToNextStage();
        }
    };

    // Proceed after recovery celebration
    const handleRecoveryContinue = () => {
        proceedToNextStage();
    };

    // Move to next stage
    const proceedToNextStage = () => {
        const nextStage = currentStage + 1;

        if (nextStage > 3) {
            // End of simulation
            setPhase('results');
            setCurrentStage(4);
        } else {
            // Next crash
            setCurrentStage(nextStage);
            setPhase('dropping');

            setTimeout(() => {
                const stage = STORY_STAGES[nextStage - 1];
                const effectiveDrop = calculateDrop(stage.dropPercent);
                const newBalance = simulationBalance * (1 + effectiveDrop / 100);

                setSimulationBalance(newBalance);
                setChartData(prev => [...prev, { value: newBalance, label: stage.name }]);
                setChartIndex(prev => prev + 1);

                setTimeout(() => setPhase('choice'), 1500);
            }, 500);
        }
    };

    // Calculate final allocation based on choices
    const finalAllocation = useMemo(() => {
        const holdCount = choices.filter(c => c === 'HOLD').length;

        if (holdCount === 3) return { long: 70, mid: 20, short: 10 };
        if (holdCount === 2) return { long: 55, mid: 30, short: 15 };
        if (holdCount === 1) return { long: 40, mid: 35, short: 25 };
        return { long: 30, mid: 30, short: 40 };
    }, [choices]);

    // Handle completion
    const handleComplete = async () => {
        setIsSaving(true);

        try {
            // Save to database
            if (userId) {
                const holdCount = choices.filter(c => c === 'HOLD').length;
                const riskScore = holdCount / 3; // 0 to 1

                await saveInvestmentProfile(userId, {
                    riskToleranceScore: riskScore,
                    targetAllocation: {
                        long: finalAllocation.long / 100,
                        mid: finalAllocation.mid / 100,
                        short: finalAllocation.short / 100
                    },
                    stressTestResponses: {
                        completedStoryMode: true,
                        choices: choices,
                        earnedBadges: earnedBadges.map(b => b.name)
                    }
                });
            }

            onAllocationChange?.(finalAllocation);
            onComplete?.();
        } catch (err) {
            console.error('Failed to save risk profile:', err);
            onComplete?.();
        } finally {
            setIsSaving(false);
        }
    };

    // Current stage data
    const currentStageData = currentStage > 0 && currentStage <= 3 ? STORY_STAGES[currentStage - 1] : null;

    return (
        <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* INTRO PHASE */}
            {phase === 'intro' && (
                <motion.div
                    className="text-center space-y-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-10 h-10 text-amber-600" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t('investments.riskStory.title', "Let's Test Your Investor DNA")}
                        </h2>
                        <p className="text-slate-600 max-w-md mx-auto">
                            {t('investments.riskStory.introDesc',
                                "You'll travel through 3 real market crashes with $100,000. Your choices will reveal your true risk tolerance.")}
                        </p>
                    </div>

                    {/* Starting Balance */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 max-w-sm mx-auto">
                        <div className="text-sm text-purple-600 font-medium mb-1">Starting Balance</div>
                        <div className="text-4xl font-bold text-purple-700">$100,000</div>
                        <div className="mt-4">
                            <BucketBar allocation={allocation} balance={100000} />
                        </div>
                    </div>

                    <motion.button
                        onClick={startSimulation}
                        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold 
                            hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Rocket className="w-5 h-5" />
                        {t('investments.riskStory.startJourney', 'Start the Journey')}
                    </motion.button>
                </motion.div>
            )}

            {/* ACTIVE SIMULATION (dropping/choice) */}
            {(phase === 'dropping' || phase === 'choice') && currentStageData && (
                <motion.div
                    className="space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {/* Stage Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                                Act {currentStageData.act} of 3
                            </span>
                            <span className="text-slate-500">{currentStageData.year}</span>
                        </div>
                        <div className="flex gap-1">
                            {[1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full ${i <= currentStage ? 'bg-purple-500' : 'bg-slate-200'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Balance Display */}
                    <div className="text-center">
                        <div className="text-sm text-slate-500 mb-1">Your Portfolio</div>
                        <AnimatedCounter
                            value={Math.round(simulationBalance)}
                            className={`text-4xl font-bold ${simulationBalance < 100000 ? 'text-red-600' : 'text-emerald-600'}`}
                        />
                    </div>

                    {/* Bucket Visualization */}
                    <BucketBar
                        allocation={allocation}
                        balance={simulationBalance}
                        isDropping={phase === 'dropping'}
                    />

                    {/* Chart */}
                    <StoryChart
                        dataPoints={chartData}
                        currentIndex={chartIndex}
                        isRecovering={false}
                    />

                    {/* Narrative */}
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <p className="text-slate-700 font-medium">{currentStageData.narrative.intro}</p>
                    </div>
                </motion.div>
            )}

            {/* Choice Overlay */}
            <AnimatePresence>
                {phase === 'choice' && currentStageData && (
                    <ChoiceOverlay
                        stage={currentStageData}
                        balance={simulationBalance}
                        onChoice={handleChoice}
                        t={t}
                    />
                )}
            </AnimatePresence>

            {/* Recovery Celebration */}
            <AnimatePresence>
                {phase === 'recovering' && currentStageData && (
                    <RecoveryCelebration
                        stage={currentStageData}
                        badge={currentStageData.badgeOnHold}
                        newBalance={simulationBalance}
                        onContinue={handleRecoveryContinue}
                        t={t}
                    />
                )}
            </AnimatePresence>

            {/* Results Phase */}
            {phase === 'results' && (
                <ResultsScreen
                    choices={choices}
                    finalAllocation={finalAllocation}
                    initialBalance={100000}
                    onComplete={handleComplete}
                    t={t}
                />
            )}
        </div>
    );
};

export default RiskStoryMode;
