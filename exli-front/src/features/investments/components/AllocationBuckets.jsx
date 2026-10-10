import React, { useState, useCallback, useRef } from 'react';
import { Timer, Anchor, Shield, Lock, Unlock, Sparkles, TrendingUp, Scale, ShieldCheck, Target, Info, ChevronDown, ChevronUp, Rocket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import { ConsequenceModal } from './ConsequenceModal';

/**
 * AllocationBuckets Component - UPDATED for Time-Based Strategy
 * 
 * Three buckets based on time horizon:
 * - Long Range (10+ years) - Maximum growth, high volatility
 * - Mid Range (3-10 years) - Balanced growth
 * - Short Term (0-3 years) - Capital preservation
 */
export const AllocationBuckets = ({
    initialAllocations = { long: 50, mid: 30, short: 20 },
    initialLocks = { long: false, mid: false, short: false },
    onAllocationsChange,
    userId,
    userCurrency = 'ILS',
    showEducation = true
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);
    const [allocations, setAllocations] = useState(initialAllocations);
    const [locks, setLocks] = useState(initialLocks);
    const [activeBucket, setActiveBucket] = useState(null);
    const [activePreset, setActivePreset] = useState(null);
    const [showLesson, setShowLesson] = useState(true);
    const [showConsequenceModal, setShowConsequenceModal] = useState(false);
    const [pendingAllocations, setPendingAllocations] = useState(null);
    const dragRef = useRef({ startY: 0, startValue: 0, bucket: null });
    const previousLongRef = useRef(initialAllocations.long);

    // Predefined allocation plans with time-based buckets
    const presets = [
        {
            id: 'aggressive',
            name: t('investments.buckets.presets.aggressive', 'The Rocket 🚀'),
            description: t('investments.buckets.presets.aggressiveDesc', 'Maximum growth potential, for long-term investors'),
            allocations: { long: 80, mid: 15, short: 5 },
            icon: Rocket,
            color: 'emerald'
        },
        {
            id: 'balanced',
            name: t('investments.buckets.presets.balanced', 'Smart Investor 🎯'),
            description: t('investments.buckets.presets.balancedDesc', 'Balanced approach with steady growth'),
            allocations: { long: 50, mid: 35, short: 15 },
            icon: TrendingUp,
            color: 'blue'
        },
        {
            id: 'moderate',
            name: t('investments.buckets.presets.moderate', 'The Steady Ship ⚓'),
            description: t('investments.buckets.presets.moderateDesc', 'Lower risk with reliable returns'),
            allocations: { long: 40, mid: 40, short: 20 },
            icon: Scale,
            color: 'purple'
        },
        {
            id: 'conservative',
            name: t('investments.buckets.presets.conservative', 'Safety First 🛡️'),
            description: t('investments.buckets.presets.conservativeDesc', 'Capital preservation with some growth'),
            allocations: { long: 25, mid: 35, short: 40 },
            icon: ShieldCheck,
            color: 'amber'
        }
    ];

    // NEW: Time-based bucket configuration
    const bucketConfig = {
        long: {
            icon: Rocket,
            name: t('investments.buckets.long.name', 'Long Range'),
            shortName: t('investments.buckets.long.shortName', 'Long'),
            timeRange: t('investments.buckets.long.timeRange', '10+ years'),
            description: t('investments.buckets.long.description', 'Maximum growth potential • High volatility, highest returns'),
            color: 'emerald',
            emoji: '🚀',
            volatility: 'High',
            typicalReturn: '8-12%'
        },
        mid: {
            icon: Anchor,
            name: t('investments.buckets.mid.name', 'Mid Range'),
            shortName: t('investments.buckets.mid.shortName', 'Mid'),
            timeRange: t('investments.buckets.mid.timeRange', '3-10 years'),
            description: t('investments.buckets.mid.description', 'Balanced growth • Moderate risk for medium-term goals'),
            color: 'blue',
            emoji: '⚓',
            volatility: 'Medium',
            typicalReturn: '5-7%'
        },
        short: {
            icon: Shield,
            name: t('investments.buckets.short.name', 'Short Term'),
            shortName: t('investments.buckets.short.shortName', 'Short'),
            timeRange: t('investments.buckets.short.timeRange', '0-3 years'),
            description: t('investments.buckets.short.description', 'Capital preservation • Low risk, always available'),
            color: 'amber',
            emoji: '🛡️',
            volatility: 'Low',
            typicalReturn: '2-4%'
        }
    };

    // Apply a preset - also unlock all buckets
    const applyPreset = useCallback((preset) => {
        setAllocations(preset.allocations);
        setActivePreset(preset.id);
        setLocks({ long: false, mid: false, short: false });
        if (onAllocationsChange) {
            onAllocationsChange(preset.allocations);
        }
    }, [onAllocationsChange]);

    // Toggle lock on a bucket
    const toggleLock = useCallback((bucket) => {
        setLocks(prev => ({
            ...prev,
            [bucket]: !prev[bucket]
        }));
    }, []);

    // Handle bucket value change (from drag or direct input)
    const updateBucketValue = useCallback((bucket, newValue) => {
        const clampedValue = Math.max(0, Math.min(100, Math.round(newValue)));
        const oldValue = allocations[bucket];
        const diff = clampedValue - oldValue;

        if (diff === 0) return;

        const otherBuckets = ['long', 'mid', 'short'].filter(b => b !== bucket);
        const unlockedBuckets = otherBuckets.filter(b => !locks[b]);

        if (unlockedBuckets.length === 0) return;

        const totalUnlocked = unlockedBuckets.reduce((sum, b) => sum + allocations[b], 0);

        if (diff > 0 && totalUnlocked < diff) return;

        const newAllocations = { ...allocations, [bucket]: clampedValue };

        if (totalUnlocked === 0) {
            if (diff < 0) {
                const perBucket = -diff / unlockedBuckets.length;
                unlockedBuckets.forEach(b => {
                    newAllocations[b] = Math.max(0, Math.round(allocations[b] + perBucket));
                });
            }
        } else {
            unlockedBuckets.forEach(b => {
                const proportion = allocations[b] / totalUnlocked;
                const adjustment = -diff * proportion;
                newAllocations[b] = Math.max(0, Math.round(allocations[b] + adjustment));
            });
        }

        let sum = Object.values(newAllocations).reduce((a, b) => a + b, 0);

        if (sum !== 100 && unlockedBuckets.length > 0) {
            const correction = 100 - sum;
            for (const b of unlockedBuckets) {
                if (newAllocations[b] + correction >= 0) {
                    newAllocations[b] += correction;
                    break;
                }
            }
        }

        for (const key of Object.keys(newAllocations)) {
            if (newAllocations[key] < 0) newAllocations[key] = 0;
        }

        setAllocations(newAllocations);
        setActivePreset(null);

        // Check if user is significantly reducing long-range (risk reduction)
        const longReduction = previousLongRef.current - newAllocations.long;
        if (longReduction >= 10) {
            // Show consequence modal
            setPendingAllocations(newAllocations);
            setShowConsequenceModal(true);
            // Don't notify parent yet - wait for confirmation
            return;
        }

        previousLongRef.current = newAllocations.long;
        if (onAllocationsChange) {
            onAllocationsChange(newAllocations);
        }
    }, [allocations, locks, onAllocationsChange]);

    // Handle consequence modal confirmation
    const handleConfirmRiskChange = useCallback(() => {
        if (pendingAllocations) {
            previousLongRef.current = pendingAllocations.long;
            if (onAllocationsChange) {
                onAllocationsChange(pendingAllocations);
            }
        }
        setPendingAllocations(null);
        setShowConsequenceModal(false);
    }, [pendingAllocations, onAllocationsChange]);

    // Handle consequence modal cancel - revert allocations
    const handleCancelRiskChange = useCallback(() => {
        // Revert to previous allocations
        setAllocations(initialAllocations);
        setPendingAllocations(null);
        setShowConsequenceModal(false);
    }, [initialAllocations]);

    // Mouse/touch drag handlers
    const handleDragStart = useCallback((e, bucket) => {
        if (locks[bucket]) return;

        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragRef.current = {
            startY: clientY,
            startValue: allocations[bucket],
            bucket
        };
        setActiveBucket(bucket);

        const handleMove = (moveEvent) => {
            const moveY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
            const deltaY = dragRef.current.startY - moveY;
            const deltaPercent = Math.round(deltaY / 2);
            const newValue = dragRef.current.startValue + deltaPercent;
            updateBucketValue(dragRef.current.bucket, newValue);
        };

        const handleEnd = () => {
            setActiveBucket(null);
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
    }, [allocations, locks, updateBucketValue]);

    // Color classes
    const colorMap = {
        emerald: {
            bg: 'bg-emerald-500',
            bgLight: 'bg-emerald-100',
            bgGradient: 'bg-gradient-to-t from-emerald-600 to-emerald-400',
            border: 'border-emerald-300',
            text: 'text-emerald-700',
            ring: 'ring-emerald-300'
        },
        blue: {
            bg: 'bg-blue-500',
            bgLight: 'bg-blue-100',
            bgGradient: 'bg-gradient-to-t from-blue-600 to-blue-400',
            border: 'border-blue-300',
            text: 'text-blue-700',
            ring: 'ring-blue-300'
        },
        amber: {
            bg: 'bg-amber-500',
            bgLight: 'bg-amber-100',
            bgGradient: 'bg-gradient-to-t from-amber-600 to-amber-400',
            border: 'border-amber-300',
            text: 'text-amber-700',
            ring: 'ring-amber-300'
        },
        purple: {
            bg: 'bg-purple-500',
            bgLight: 'bg-purple-100',
            bgGradient: 'bg-gradient-to-t from-purple-600 to-purple-400',
            border: 'border-purple-300',
            text: 'text-purple-700',
            ring: 'ring-purple-300'
        }
    };

    // Bucket component with draggable bar
    const Bucket = ({ type }) => {
        const config = bucketConfig[type];
        const allocation = allocations[type];
        const isLocked = locks[type];
        const colors = colorMap[config.color];
        const isActive = activeBucket === type;

        return (
            <div className="flex flex-col items-center flex-1">
                {/* Bucket header - FIXED HEIGHT for alignment */}
                <div className="text-center mb-3 h-20 flex flex-col justify-end">
                    <span className="text-2xl">{config.emoji}</span>
                    <h4 className={`font-semibold text-sm mt-1 ${colors.text}`}>
                        {config.name}
                    </h4>
                    {/* Time horizon badge */}
                    <span className={`inline-block px-2 py-0.5 mt-1 text-xs rounded-full ${colors.bgLight} ${colors.text}`}>
                        {config.timeRange}
                    </span>
                </div>

                {/* Draggable Bucket visual */}
                <div
                    className={`relative w-20 h-44 rounded-xl border-2 ${colors.border} ${colors.bgLight} overflow-hidden transition-all cursor-ns-resize select-none
                               ${isActive ? `ring-4 ${colors.ring} scale-105` : 'hover:scale-102'}
                               ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                    onMouseDown={(e) => handleDragStart(e, type)}
                    onTouchStart={(e) => handleDragStart(e, type)}
                >
                    {/* Fill level with gradient */}
                    <div
                        className={`absolute bottom-0 start-0 end-0 ${colors.bgGradient} transition-all duration-150 ease-out`}
                        style={{ height: `${allocation}%` }}
                    >
                        <div className="absolute top-0 start-0 end-0 h-2 bg-white/20 rounded-t-full" />
                    </div>

                    {/* Percentage label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className={`text-2xl font-bold ${allocation > 50 ? 'text-white' : colors.text} drop-shadow-sm`}>
                            {allocation}%
                        </span>
                    </div>

                    {/* Lock indicator */}
                    {isLocked && (
                        <div className="absolute top-2 end-2 w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center">
                            <Lock className="w-3 h-3 text-white" />
                        </div>
                    )}

                    {/* Drag hint */}
                    {!isLocked && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/60 text-xs pointer-events-none">
                            ↕
                        </div>
                    )}
                </div>

                {/* Lock button */}
                <button
                    onClick={() => toggleLock(type)}
                    className={`mt-3 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                               ${isLocked
                            ? 'bg-slate-700 text-white'
                            : `${colors.bgLight} ${colors.text} hover:bg-opacity-80`}`}
                >
                    {isLocked ? (
                        <>
                            <Lock className="w-3 h-3" />
                            {t('investments.buckets.locked', 'Locked')}
                        </>
                    ) : (
                        <>
                            <Unlock className="w-3 h-3" />
                            {t('investments.buckets.unlock', 'Lock')}
                        </>
                    )}
                </button>
            </div>
        );
    };

    const totalAllocation = Object.values(allocations).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Educational Banner - Collapsible */}
            {showEducation && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowLesson(!showLesson)}
                        className="w-full flex items-center justify-between p-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                                <Timer className="w-5 h-5" />
                            </div>
                            <div className="text-start">
                                <h3 className="font-bold text-indigo-700">
                                    {t('investments.lessons.timeHorizon.title', 'The Magic of Time Horizon')}
                                </h3>
                                <p className="text-sm text-indigo-600">
                                    {t('investments.buckets.educationTeaser', 'Why your money needs different homes')}
                                </p>
                            </div>
                        </div>
                        <div className="bg-indigo-100 p-2 rounded-full">
                            {showLesson ? (
                                <ChevronUp className="w-4 h-4 text-indigo-600" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-indigo-600" />
                            )}
                        </div>
                    </button>

                    {showLesson && (
                        <div className="px-4 pb-4 space-y-3 border-t border-indigo-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                                <div className="bg-white/80 rounded-xl p-3 border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">🚀</span>
                                        <span className="font-medium text-emerald-700">{t('investments.buckets.long.name', 'Long Range')}</span>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        {t('investments.tooltips.longBucket', 'Your retirement fund, 10+ years away. We can ride out any storm for maximum growth.')}
                                    </p>
                                </div>
                                <div className="bg-white/80 rounded-xl p-3 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">⚓</span>
                                        <span className="font-medium text-blue-700">{t('investments.buckets.mid.name', 'Mid Range')}</span>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        {t('investments.tooltips.midBucket', 'Goals 3-10 years away. There\'s time to recover from dips, but we still play it smart.')}
                                    </p>
                                </div>
                                <div className="bg-white/80 rounded-xl p-3 border border-amber-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">🛡️</span>
                                        <span className="font-medium text-amber-700">{t('investments.buckets.short.name', 'Short Term')}</span>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        {t('investments.tooltips.shortBucket', 'Money you\'ll need soon. We keep it safe so a market crash won\'t ruin your plans.')}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-indigo-100/70 rounded-xl p-3 text-center">
                                <p className="text-sm font-medium text-indigo-700">
                                    {t('investments.lessons.timeHorizon.takeaway', '💡 Takeaway: Time is your superpower. The longer you can wait, the more risk (and reward) you can handle.')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800">
                    {t('investments.buckets.title', 'Allocation Buckets')}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    {t('investments.buckets.subtitle', 'Your goals automatically fill these buckets by time horizon')}
                </p>
            </div>

            {/* Preset Plans - REMOVED per user request */}


            {/* Buckets container - Updated order: Long, Mid, Short */}
            <div className="flex justify-center gap-4 md:gap-8 p-4">
                <Bucket type="long" />
                <Bucket type="mid" />
                <Bucket type="short" />
            </div>

            {/* Total check */}
            <div className="text-center">
                <span className={`text-sm font-medium ${totalAllocation === 100
                    ? 'text-emerald-600'
                    : 'text-red-600'
                    }`}>
                    {t('investments.buckets.total', 'Total')}: {totalAllocation}%
                    {totalAllocation === 100 && ' ✓'}
                </span>
            </div>

            {/* Help text */}
            <div className="text-center text-xs text-slate-500 px-4">
                <Sparkles className="w-3 h-3 inline me-1" />
                {t('investments.buckets.dragHint', 'Goals are automatically assigned based on deadline')}
            </div>

            {/* Consequence Modal - Shown when user significantly reduces risk */}
            <ConsequenceModal
                isOpen={showConsequenceModal}
                onClose={handleCancelRiskChange}
                onConfirm={handleConfirmRiskChange}
                onCancel={handleCancelRiskChange}
                currentPlan={{
                    riskLevel: previousLongRef.current >= 60 ? 'High' : previousLongRef.current >= 40 ? 'Medium' : 'Low',
                    monthlyGrowth: `${Math.round(previousLongRef.current * 0.1)}%`
                }}
                newPlan={{
                    riskLevel: pendingAllocations?.long >= 60 ? 'High' : pendingAllocations?.long >= 40 ? 'Medium' : 'Low',
                    monthlyGrowth: `${Math.round((pendingAllocations?.long || 0) * 0.1)}%`
                }}
                delayYears={Math.ceil((previousLongRef.current - (pendingAllocations?.long || 0)) / 10)}
            />
        </div>
    );
};

export default AllocationBuckets;
