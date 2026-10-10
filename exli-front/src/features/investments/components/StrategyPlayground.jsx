import React, { useState, useMemo } from 'react';
import { TrendingUp, Calculator, Info, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * StrategyPlayground Component
 * The "Why" - Motivation Engine for investment planning
 * 
 * Features:
 * - Pay-Yourself-First Slider (0-100%)
 * - Toggle between average income (from user data) and manual income
 * - Freedom Scale gauge with playful icons
 * - Melting vs. Growing X-Y projection chart with 10/20/30 year breakdown
 * - Selectable annual return rate (5%, 7%, 10%, 15%)
 * - Legal disclaimer
 */
export const StrategyPlayground = ({
    averageIncome = 0,
    averageExpenses = 0,
    targetSavingsRate = 0.15,
    onSavingsRateChange,
    userCurrency = 'ILS'
}) => {
    const { t } = useTranslation();
    const [savingsRate, setSavingsRate] = useState(targetSavingsRate * 100);
    const [useManualIncome, setUseManualIncome] = useState(false);
    const [manualIncome, setManualIncome] = useState(averageIncome || 15000);
    const [annualReturn, setAnnualReturn] = useState(0.07); // Default 7%

    // Return rate options
    const returnOptions = [
        { rate: 0.05, label: '5%', description: t('investments.strategy.returnLow', 'Conservative') },
        { rate: 0.07, label: '7%', description: t('investments.strategy.returnModerate', 'Moderate') },
        { rate: 0.10, label: '10%', description: t('investments.strategy.returnHigh', 'Aggressive') },
        { rate: 0.15, label: '15%', description: t('investments.strategy.returnVeryHigh', 'Very High') }
    ];

    // Active income value
    const activeIncome = useManualIncome ? manualIncome : (averageIncome || 15000);

    // Calculate monthly investment amount based on slider
    const monthlyInvestment = useMemo(() => {
        return activeIncome * (savingsRate / 100);
    }, [activeIncome, savingsRate]);

    // Inflation rate constant
    const INFLATION_RATE = 0.025; // 2.5% inflation

    // Projection calculation
    // FIXED: Both scenarios now use the SAME monthly amount (monthlyInvestment from slider)
    // This is a fair comparison: "If I save X per month, invest vs cash?"
    const projectionData = useMemo(() => {
        const years = [10, 20, 30];
        const monthlyReturn = annualReturn / 12;

        return years.map(year => {
            const months = year * 12;

            // 1. INVESTED BAR (Rocket)
            // FV formula on monthlyInvestment: PMT * ((1 + r)^n - 1) / r
            const rocketValue = months === 0 ? 0 :
                monthlyInvestment * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

            // 2. CASH BAR - FIXED!
            // Now uses the SAME monthlyInvestment (not surplus)
            // Cash just accumulates nominally, then we show real purchasing power
            const nominalCash = monthlyInvestment * months;
            const iceCubeValue = nominalCash / Math.pow(1 + INFLATION_RATE, year);

            return {
                year,
                rocket: rocketValue,
                iceCube: iceCubeValue,
                multiplier: iceCubeValue > 0 ? (rocketValue / iceCubeValue).toFixed(1) : '∞'
            };
        });
    }, [monthlyInvestment, annualReturn]);

    // Handle slider change
    const handleSliderChange = (e) => {
        const newRate = parseInt(e.target.value, 10);
        setSavingsRate(newRate);
        if (onSavingsRateChange) {
            onSavingsRateChange(newRate / 100);
        }
    };

    // Format currency
    const formatCurrency = (value) => {
        const absVal = Math.abs(value);
        const formatted = userCurrency === 'ILS'
            ? `₪${absVal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
            : `$${absVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        return value < 0 ? `-${formatted}` : formatted;
    };

    // Life Scenes configuration - animated scenes based on savings rate
    const lifeScene = useMemo(() => {
        // Scene definitions with emojis, messages, and retirement age estimates
        if (savingsRate >= 50) {
            return {
                id: 'fire',
                emoji: '🏖️',
                character: '👨‍👩‍👧‍👦',
                mood: '🎉',
                title: t('investments.strategy.scenes.fire.title', 'FIRE Mode! 🔥'),
                message: t('investments.strategy.scenes.fire.message', 'Early retirement unlocked! Beach life with the family!'),
                retireAge: t('investments.strategy.scenes.fire.age', '45-50'),
                floatingEmojis: ['💰', '🌴', '✈️', '❤️', '🌟', '🎊'],
                bgGradient: 'from-emerald-100 via-teal-50 to-cyan-100',
                borderColor: 'border-emerald-300',
                textColor: 'text-emerald-700',
                accentColor: 'bg-emerald-500'
            };
        }
        if (savingsRate >= 30) {
            return {
                id: 'cruising',
                emoji: '🚴',
                character: '👨',
                mood: '😎',
                title: t('investments.strategy.scenes.cruising.title', 'Cruising Mode'),
                message: t('investments.strategy.scenes.cruising.message', 'On track for comfortable retirement! Hobbies await!'),
                retireAge: t('investments.strategy.scenes.cruising.age', '55-60'),
                floatingEmojis: ['💵', '🎯', '🏃', '☕', '📚'],
                bgGradient: 'from-blue-100 via-indigo-50 to-purple-100',
                borderColor: 'border-blue-300',
                textColor: 'text-blue-700',
                accentColor: 'bg-blue-500'
            };
        }
        if (savingsRate >= 10) {
            return {
                id: 'tortoise',
                emoji: '🐢',
                character: '🧑',
                mood: '🙂',
                title: t('investments.strategy.scenes.tortoise.title', 'Tortoise Mode'),
                message: t('investments.strategy.scenes.tortoise.message', 'Slow and steady wins the race. Keep building!'),
                retireAge: t('investments.strategy.scenes.tortoise.age', '65-67'),
                floatingEmojis: ['💪', '📈', '🌱', '⏰'],
                bgGradient: 'from-amber-100 via-yellow-50 to-orange-100',
                borderColor: 'border-amber-300',
                textColor: 'text-amber-700',
                accentColor: 'bg-amber-500'
            };
        }
        return {
            id: 'struggle',
            emoji: '😰',
            character: '👴',
            mood: '💼',
            title: t('investments.strategy.scenes.struggle.title', 'Struggle Mode'),
            message: t('investments.strategy.scenes.struggle.message', 'Still working at 75... Start saving now!'),
            retireAge: t('investments.strategy.scenes.struggle.age', '75+'),
            floatingEmojis: ['⏰', '📉', '😓'],
            bgGradient: 'from-red-100 via-orange-50 to-amber-100',
            borderColor: 'border-red-300',
            textColor: 'text-red-600',
            accentColor: 'bg-red-500'
        };
    }, [savingsRate, t]);

    // Calculate next milestone for encouragement
    const nextMilestone = useMemo(() => {
        if (savingsRate >= 50) return null;
        if (savingsRate >= 30) return { target: 50, label: t('investments.strategy.milestones.fire', 'FIRE Mode 🔥'), remaining: 50 - savingsRate };
        if (savingsRate >= 10) return { target: 30, label: t('investments.strategy.milestones.cruising', 'Cruising 🚴'), remaining: 30 - savingsRate };
        return { target: 10, label: t('investments.strategy.milestones.tortoise', 'Tortoise 🐢'), remaining: 10 - savingsRate };
    }, [savingsRate, t]);

    // Fixed max scale logic based on 15% return (highest) + 30 years + current active Income * 50% savings?
    // We need a stable scale so bars don't jump wildly when slider moves. But slider DOES move Invested bar.
    // Let's base max scale on: Max possible investment (e.g. 50% of income) @ 15% return
    const maxScaleValue = useMemo(() => {
        const maxRate = 0.5; // Assume 50% savings is a reasonable "max" for visual scaling
        const maxReturn = 0.15;
        const months = 30 * 12;
        const monthlyInv = activeIncome * maxRate;
        const mRet = maxReturn / 12;
        const fv = monthlyInv * ((Math.pow(1 + mRet, months) - 1) / mRet);
        return Math.max(fv, 1) * 1.1; // +10% padding
    }, [activeIncome]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    {t('investments.strategy.title', 'Strategy Playground')}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    {t('investments.strategy.subtitle', 'Set your investment goals and see the magic of compound growth')}
                </p>
            </div>

            {/* Average Income Display - PROMINENT AT TOP */}
            {averageIncome > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-full">
                                <DollarSign className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-purple-600 font-medium">
                                    {t('investments.strategy.yourAverageIncome', 'Your Average Income (from Analytics)')}
                                </p>
                                <p className="text-2xl font-bold text-purple-700">
                                    {formatCurrency(averageIncome)}
                                </p>
                            </div>
                        </div>
                        <div className="text-xs text-purple-500 bg-white/60 px-3 py-1 rounded-full">
                            {useManualIncome
                                ? t('investments.strategy.usingCustom', '⚙️ Using custom value below')
                                : t('investments.strategy.usingAverage', '✓ Using this value')
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Income Input - ALWAYS VISIBLE as requested */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-full text-purple-600">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-sm font-medium text-slate-700 block">
                            {t('investments.strategy.monthlyIncome', 'Monthly Income')}
                        </span>
                        <span className="text-xs text-slate-500">
                            {t('investments.strategy.usedForCalc', 'Used for projections')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                            {userCurrency === 'ILS' ? '₪' : '$'}
                        </span>
                        <input
                            type="number"
                            value={useManualIncome ? manualIncome : (averageIncome || '')}
                            onChange={(e) => {
                                setUseManualIncome(true);
                                setManualIncome(Math.max(0, parseInt(e.target.value) || 0));
                            }}
                            placeholder={averageIncome || 0}
                            className="w-32 ps-8 pe-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                        />
                    </div>

                    {/* Reset Button (only if manual) */}
                    {useManualIncome && averageIncome > 0 && (
                        <button
                            onClick={() => { setUseManualIncome(false); setManualIncome(averageIncome); }}
                            className="text-xs text-slate-500 hover:text-purple-600 underline"
                        >
                            {t('common.reset', 'Reset')}
                        </button>
                    )}
                </div>
            </div>

            {/* Pay-Yourself-First Slider */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100">
                <label className="block text-center mb-6">
                    <span className="text-lg font-medium text-slate-700 block mb-1">
                        {t('investments.strategy.sliderLabel', 'I want to invest')}
                        <span className="text-3xl font-bold text-purple-600 mx-2">{savingsRate}%</span>
                    </span>
                    {/* Added Currency Value Display */}
                    <span className="inline-block bg-white/80 px-3 py-1 rounded-full text-sm font-semibold text-purple-700 shadow-sm border border-purple-100">
                        {formatCurrency(monthlyInvestment)} / {t('common.month', 'month')}
                    </span>
                </label>

                <div className="relative mb-8">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={savingsRate}
                        onChange={handleSliderChange}
                        className="w-full h-3 bg-gradient-to-r from-orange-300 via-blue-400 to-emerald-500 rounded-full appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
                                   [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-purple-500 
                                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-2 px-1">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                    </div>
                </div>

                {/* Life Scenes - Animated Visualization */}
                <div className={`relative rounded-2xl p-6 bg-gradient-to-br ${lifeScene.bgGradient} border-2 ${lifeScene.borderColor} overflow-hidden transition-all duration-500`}>

                    {/* Floating Background Emojis */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {lifeScene.floatingEmojis.map((emoji, i) => (
                            <span
                                key={`${lifeScene.id}-${i}`}
                                className="absolute text-2xl opacity-40 animate-pulse"
                                style={{
                                    left: `${10 + (i * 15) % 80}%`,
                                    top: `${10 + (i * 20) % 70}%`,
                                    animationDelay: `${i * 0.3}s`,
                                    animationDuration: `${2 + i * 0.5}s`
                                }}
                            >
                                {emoji}
                            </span>
                        ))}
                    </div>

                    {/* Main Scene Content */}
                    <div className="relative z-10">
                        {/* Character Display */}
                        <div className="text-center mb-4">
                            <div className="inline-flex items-center justify-center gap-2 text-5xl mb-2 transition-all duration-300">
                                <span className="animate-bounce" style={{ animationDuration: '2s' }}>
                                    {lifeScene.character}
                                </span>
                                <span className="animate-pulse">
                                    {lifeScene.mood}
                                </span>
                                <span style={{ animationDuration: '2.5s' }} className="animate-bounce">
                                    {lifeScene.emoji}
                                </span>
                            </div>
                        </div>

                        {/* Title & Message */}
                        <div className="text-center">
                            <h3 className={`text-xl font-bold ${lifeScene.textColor} mb-1`}>
                                {lifeScene.title}
                            </h3>
                            <p className="text-sm text-slate-600 mb-3">
                                {lifeScene.message}
                            </p>
                        </div>

                        {/* Retirement Age Badge */}
                        <div className="flex justify-center mb-3">
                            <div className="bg-white/70 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-white/50">
                                <span className="text-sm text-slate-600">
                                    {t('investments.strategy.scenes.retireAge', 'Estimated retirement age:')}
                                </span>
                                <span className={`text-lg font-bold ${lifeScene.textColor} ms-2`}>
                                    {lifeScene.retireAge}
                                </span>
                            </div>
                        </div>

                        {/* Next Milestone Encouragement */}
                        {nextMilestone && (
                            <div className="text-center">
                                <div className={`inline-block ${lifeScene.accentColor} text-white text-xs font-medium px-3 py-1.5 rounded-full animate-pulse`}>
                                    🎯 {t('investments.strategy.scenes.justMore', 'Just {{remaining}}% more to unlock', { remaining: nextMilestone.remaining })} {nextMilestone.label}!
                                </div>
                            </div>
                        )}

                        {/* Progress Dots */}
                        <div className="flex justify-center gap-2 mt-4">
                            {['struggle', 'tortoise', 'cruising', 'fire'].map((stage, i) => (
                                <div
                                    key={stage}
                                    className={`w-3 h-3 rounded-full transition-all duration-300 ${stage === lifeScene.id
                                        ? `${lifeScene.accentColor} scale-125 ring-2 ring-white shadow-lg`
                                        : 'bg-white/50'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Projection Chart - Melting vs Growing */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        📈 {t('investments.strategy.projection.title', 'Melting vs. Growing')}
                    </h3>

                    {/* Return Rate Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {returnOptions.map((option) => (
                            <button
                                key={option.rate}
                                onClick={() => setAnnualReturn(option.rate)}
                                className={`px-2 py-1 text-xs rounded-md font-medium transition-all ${annualReturn === option.rate
                                    ? 'bg-white text-purple-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Calculation Explanation */}
                <div className="bg-slate-50 rounded-lg p-3 mb-5 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-slate-700 mb-1">
                                {t('investments.strategy.projection.howItWorks', 'How this comparison works:')}
                            </p>
                            <ul className="space-y-1">
                                <li>🚀 <strong>{t('investments.strategy.projection.investedLabel', 'Invested')}</strong>: {t('investments.strategy.projection.investedExplain', 'Your {{amount}}/mo compounding at {{rate}}% annually', { amount: formatCurrency(monthlyInvestment), rate: (annualReturn * 100).toFixed(0) })}</li>
                                <li>🧊 <strong>{t('investments.strategy.projection.cashOnly', 'Cash Only')}</strong>: {t('investments.strategy.projection.cashExplain', 'Same {{amount}}/mo in cash, losing purchasing power to 2.5% inflation', { amount: formatCurrency(monthlyInvestment) })}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bars */}
                <div className="space-y-8">
                    {projectionData.map((proj) => {
                        // Calculations for bar widths
                        const investedPercent = Math.min(100, (proj.rocket / maxScaleValue) * 100);

                        // Cash logic can be negative
                        const isCashNegative = proj.iceCube < 0;
                        const cashAbs = Math.abs(proj.iceCube);
                        const cashPercent = Math.min(100, (cashAbs / maxScaleValue) * 100);

                        return (
                            <div key={proj.year} className="relative">
                                <div className="flex justify-between text-sm font-medium text-slate-600 mb-1">
                                    <span>{t('investments.strategy.projection.inYears', { years: proj.year })}</span>
                                    {proj.iceCube > 0 && (
                                        <span className="text-emerald-600 bg-emerald-50 px-2 rounded-full text-xs py-0.5">
                                            {t('investments.strategy.projection.moreMultiplier', { count: proj.multiplier })}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1 relative">
                                    {/* Invested Bar */}
                                    <div className="h-8 bg-slate-100 rounded-e-lg overflow-hidden relative w-full">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 absolute start-0 top-0 transition-all duration-500 flex items-center justify-between px-3"
                                            style={{ width: `${Math.max(investedPercent, 0.5)}%` }} // Ensure visible
                                        >
                                            <span className="text-white font-bold text-xs whitespace-nowrap">{t('investments.strategy.projection.investedLabel', '🚀 Invested')}</span>
                                        </div>
                                        {/* Value Label (outside if too small?) - keeping inside for now or right aligned */}
                                        <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">
                                            {formatCurrency(proj.rocket)}
                                        </span>
                                    </div>

                                    {/* Cash Bar (Status Quo) */}
                                    <div className="h-6 bg-slate-50 rounded-e-lg overflow-hidden relative w-full flex items-center">
                                        {/* Bar */}
                                        <div
                                            className={`h-full absolute start-0 top-0 transition-all duration-500 ${isCashNegative
                                                ? 'bg-red-400/80 pattern-diagonal-lines' // Negative
                                                : 'bg-slate-300' // Positive
                                                }`}
                                            style={{ width: `${Math.max(cashPercent, 0.5)}%` }}
                                        />

                                        {/* Label */}
                                        <div className="relative z-10 w-full flex justify-between px-3">
                                            <span className={`text-xs font-medium whitespace-nowrap ${isCashNegative ? 'text-red-700' : 'text-slate-600'}`}>
                                                {isCashNegative ? t('investments.strategy.projection.debtSpiral', '⚠️ Debt Spiral') : t('investments.strategy.projection.cashOnly', '🧊 Cash Only')}
                                            </span>
                                            <span className={`text-xs font-medium ${isCashNegative ? 'text-red-600' : 'text-slate-500'}`}>
                                                {formatCurrency(proj.iceCube)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 text-xs text-center text-slate-400">
                    {t('investments.strategy.projection.noteDisclaimer', '* Past performance does not guarantee future results. Inflation assumed at 2.5%/year.')}
                </div>
            </div>
        </div >
    );
};

export default StrategyPlayground;
