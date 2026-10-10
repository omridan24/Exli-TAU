import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import {
    Target, Plus, X, Calendar, Trash2, ChevronRight,
    Home, Heart, Baby, GraduationCap, Palmtree, Car,
    Plane, Shield, Sparkles, AlertCircle, Check
} from 'lucide-react';
import { saveGoal, getGoals, deleteGoal, GOAL_PRESETS, BUCKET_INFO } from '../../../config/investmentProfileService';

// Goal Preset Card
const GoalPresetCard = ({ preset, presetKey, isSelected, onClick, t, isRTL }) => {
    const icons = {
        wedding: Heart,
        house: Home,
        baby: Baby,
        education: GraduationCap,
        retirement: Palmtree,
        car: Car,
        travel: Plane,
        emergency: Shield,
        custom: Plus
    };

    const Icon = icons[presetKey] || Target;

    const colors = {
        wedding: 'from-pink-500 to-rose-500',
        house: 'from-blue-500 to-indigo-500',
        baby: 'from-purple-500 to-pink-400',
        education: 'from-amber-500 to-orange-500',
        retirement: 'from-emerald-500 to-teal-500',
        car: 'from-slate-500 to-zinc-500',
        travel: 'from-sky-500 to-cyan-500',
        emergency: 'from-red-500 to-orange-500',
        custom: 'from-violet-500 to-purple-500'
    };

    return (
        <button
            onClick={onClick}
            className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-center group
                ${isSelected
                    ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                    : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-md'
                }`}
        >
            <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${colors[presetKey]} 
                flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700">
                {preset?.icon} {t(`investments.goals.presets.${presetKey}`, preset?.name || presetKey)}
            </span>
            {isSelected && (
                <div className="absolute top-2 end-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            )}
        </button>
    );
};

// Smart Estimator Modal - Now with slider
const SmartEstimatorModal = ({ preset, presetKey, onSelect, onClose, t, isRTL }) => {
    if (!preset?.estimateRanges) return null;

    const budgetAmount = preset.estimateRanges.budget?.amount || 0;
    const luxeAmount = preset.estimateRanges.luxe?.amount || 0;
    const avgAmount = preset.estimateRanges.standard?.amount || Math.round((budgetAmount + luxeAmount) / 2);

    const [sliderValue, setSliderValue] = useState(50); // 0=budget, 50=avg, 100=luxe

    // Calculate amount based on slider position
    const calculateAmount = (value) => {
        if (value <= 50) {
            // Budget to AVG
            const ratio = value / 50;
            return Math.round(budgetAmount + (avgAmount - budgetAmount) * ratio);
        } else {
            // AVG to Luxe
            const ratio = (value - 50) / 50;
            return Math.round(avgAmount + (luxeAmount - avgAmount) * ratio);
        }
    };

    const currentAmount = calculateAmount(sliderValue);

    // Get vibe label
    const getVibeLabel = (value) => {
        if (value < 30) return { label: t('investments.goals.estimator.budget', 'Smart Saver'), emoji: '📦' };
        if (value > 70) return { label: t('investments.goals.estimator.luxe', 'Go Big'), emoji: '💎' };
        return { label: t('investments.goals.estimator.standard', 'Just Right'), emoji: '✨' };
    };

    const vibeInfo = getVibeLabel(sliderValue);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-800">
                        {t('investments.goals.estimator.title', 'Smart Estimator')}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <p className="text-slate-600 mb-6">
                    {t('investments.goals.estimator.slideToChoose', 'Slide to find your perfect budget')}
                </p>

                {/* Current Amount Display */}
                <div className="text-center mb-6 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl">
                    <div className="text-4xl mb-2">{vibeInfo.emoji}</div>
                    <div className="text-sm text-purple-600 font-medium mb-1">{vibeInfo.label}</div>
                    <div className="text-3xl font-bold text-purple-700">
                        ₪{currentAmount.toLocaleString()}
                    </div>
                </div>

                {/* Slider */}
                <div className="mb-6 px-2">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                        className="w-full h-3 bg-gradient-to-r from-emerald-400 via-purple-400 to-indigo-500 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 
                            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-400
                            [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                    />

                    {/* Labels */}
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                        <span className="flex flex-col items-start">
                            <span className="text-base">📦</span>
                            <span>{t('investments.goals.estimator.budgetLabel', 'Smart')}</span>
                        </span>
                        <span className="flex flex-col items-center text-purple-600 font-medium">
                            <span className="text-base">✨</span>
                            <span>{t('investments.goals.estimator.avgLabel', 'AVG')}</span>
                            <span className="text-[10px]">₪{avgAmount.toLocaleString()}</span>
                        </span>
                        <span className="flex flex-col items-end">
                            <span className="text-base">💎</span>
                            <span>{t('investments.goals.estimator.luxeLabel', 'Luxe')}</span>
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => onSelect(currentAmount)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white 
                        rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    {t('common.continue', 'Continue')}
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// Goal Form Modal
const GoalFormModal = ({ preset, presetKey, initialAmount, onSave, onClose, t, isRTL, existingGoal }) => {
    const [goalName, setGoalName] = useState(existingGoal?.name || '');
    const [targetAmount, setTargetAmount] = useState(existingGoal?.targetAmount || initialAmount || 0);
    const [deadlineDate, setDeadlineDate] = useState(existingGoal?.deadlineDate || '');
    const [isSaving, setIsSaving] = useState(false);

    // Calculate bucket from deadline
    const calculatedBucket = useMemo(() => {
        if (!deadlineDate) return null;

        const now = new Date();
        const deadline = new Date(deadlineDate);
        const months = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
        const years = months / 12;

        if (years <= 3) return 'short';
        if (years <= 10) return 'mid';
        return 'long';
    }, [deadlineDate]);

    // Set default name from preset
    useEffect(() => {
        if (!existingGoal && presetKey && presetKey !== 'custom') {
            setGoalName(t(`investments.goals.presets.${presetKey}`, preset?.name || ''));
        }
    }, [presetKey, preset, existingGoal, t]);

    // Set default deadline from preset
    useEffect(() => {
        if (!existingGoal && !deadlineDate && preset?.defaultYears) {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + preset.defaultYears);
            setDeadlineDate(futureDate.toISOString().split('T')[0]);
        }
    }, [preset, existingGoal, deadlineDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!goalName || !targetAmount || !deadlineDate) return;

        setIsSaving(true);
        try {
            await onSave({
                id: existingGoal?.id,
                name: goalName,
                presetType: presetKey === 'custom' ? null : presetKey,
                targetAmount: Number(targetAmount),
                deadlineDate: deadlineDate,
                currency: 'ILS'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const bucketInfo = calculatedBucket ? BUCKET_INFO[calculatedBucket] : null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800">
                        {existingGoal
                            ? t('investments.goals.editGoal', 'Edit Goal')
                            : `${preset?.icon || '🎯'} ${t('investments.goals.addGoal', 'Add New Goal')}`
                        }
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Goal Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t('investments.goals.form.goalName', 'Goal Name')}
                        </label>
                        <input
                            type="text"
                            value={goalName}
                            onChange={(e) => setGoalName(e.target.value)}
                            placeholder={t(`investments.goals.presets.${presetKey}`, 'My Goal')}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none"
                            required
                        />
                    </div>

                    {/* Target Amount */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t('investments.goals.form.targetAmount', 'Target Amount')}
                        </label>
                        <div className="relative">
                            <span className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>₪</span>
                            <input
                                type="number"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none`}
                                min="1000"
                                required
                            />
                        </div>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {t('investments.goals.form.deadline', 'Target Date')}
                        </label>
                        <input
                            type="date"
                            value={deadlineDate}
                            onChange={(e) => setDeadlineDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none"
                            required
                        />
                    </div>

                    {/* Bucket Assignment Preview */}
                    {bucketInfo && (
                        <div className={`p-4 rounded-xl bg-gradient-to-r ${calculatedBucket === 'short' ? 'from-emerald-50 to-teal-50 border-emerald-200' :
                            calculatedBucket === 'mid' ? 'from-blue-50 to-indigo-50 border-blue-200' :
                                'from-purple-50 to-violet-50 border-purple-200'
                            } border`}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{bucketInfo.icon}</span>
                                <span className="font-medium text-slate-800">
                                    {t(`investments.buckets.${calculatedBucket}.name`, bucketInfo.name)}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 text-slate-600">
                                    {t(`investments.buckets.${calculatedBucket}.timeRange`, bucketInfo.timeRange)}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600">
                                {t(`investments.tooltips.${calculatedBucket}Bucket`, bucketInfo.description)}
                            </p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSaving || !goalName || !targetAmount || !deadlineDate}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white 
                            rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('common.saving', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                {t('investments.goals.form.save', 'Save Goal')}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

// Goal Card (displays saved goal)
const GoalCard = ({ goal, onEdit, onDelete, t, isRTL }) => {
    const bucketInfo = BUCKET_INFO[goal.bucketCategory] || BUCKET_INFO.mid;

    const bucketColors = {
        short: 'border-emerald-200 bg-emerald-50',
        mid: 'border-blue-200 bg-blue-50',
        long: 'border-purple-200 bg-purple-50'
    };

    const monthsLeft = goal.monthsToDeadline || 0;
    const monthlyNeeded = goal.requiredMonthlySaving || 0;

    return (
        <div className={`p-4 rounded-xl border-2 ${bucketColors[goal.bucketCategory]} transition-all hover:shadow-md group`}>
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{bucketInfo.icon}</span>
                    <div>
                        <h4 className="font-semibold text-slate-800">{goal.name}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-slate-600">
                            {t(`investments.buckets.${goal.bucketCategory}.shortName`, bucketInfo.name)}
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(goal)}
                        className="p-1.5 hover:bg-white/50 rounded-lg"
                        title={t('common.edit', 'Edit')}
                    >
                        <Sparkles className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                        onClick={() => onDelete(goal.id)}
                        className="p-1.5 hover:bg-red-100 rounded-lg"
                        title={t('common.delete', 'Delete')}
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="text-2xl font-bold text-slate-800">
                        ₪{goal.targetAmount?.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600">
                        {t('investments.goals.card.monthlyNeeded', '{{amount}}/mo needed', {
                            amount: `₪${Math.round(monthlyNeeded).toLocaleString()}`
                        })}
                    </div>
                </div>
                <div className="text-end">
                    <div className="text-sm font-medium text-slate-700">
                        {t('investments.goals.card.monthsLeft', '{{months}} months left', { months: monthsLeft })}
                    </div>
                    <div className="text-xs text-slate-500">
                        {new Date(goal.deadlineDate).toLocaleDateString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main GoalStudio Component
export const GoalStudio = ({ userId, onGoalsChanged, embedded = false }) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);

    const [goals, setGoals] = useState([]);
    const [groupedGoals, setGroupedGoals] = useState({ short: [], mid: [], long: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [showEstimator, setShowEstimator] = useState(false);
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [estimatedAmount, setEstimatedAmount] = useState(0);
    const [editingGoal, setEditingGoal] = useState(null);
    const [toast, setToast] = useState(null);

    // Load goals on mount
    useEffect(() => {
        loadGoals();
    }, [userId]);

    const loadGoals = async () => {
        if (!userId) return;

        setIsLoading(true);
        try {
            const response = await getGoals(userId);
            if (response.status === 'success') {
                setGoals(response.goals || []);
                setGroupedGoals(response.groupedByBucket || { short: [], mid: [], long: [] });
            }
        } catch (err) {
            console.error('Failed to load goals:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle preset selection
    const handlePresetClick = (presetKey) => {
        setSelectedPreset(presetKey);

        if (presetKey === 'custom') {
            // Go directly to form for custom goals
            setEstimatedAmount(0);
            setShowGoalForm(true);
        } else {
            // Show estimator for preset goals
            setShowEstimator(true);
        }
    };

    // Handle estimator selection
    const handleEstimatorSelect = (amount) => {
        setEstimatedAmount(amount);
        setShowEstimator(false);
        setShowGoalForm(true);
    };

    // Handle save goal
    const handleSaveGoal = async (goalData) => {
        try {
            const response = await saveGoal(userId, goalData);
            if (response.status === 'success') {
                setShowGoalForm(false);
                setSelectedPreset(null);
                setEditingGoal(null);
                loadGoals();
                onGoalsChanged?.();

                // Show success toast
                setToast({
                    message: t('investments.goals.goalAdded', 'Goal added to {{bucket}} bucket!', {
                        bucket: t(`investments.buckets.${response.goal.bucketCategory}.name`)
                    }),
                    type: 'success'
                });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (err) {
            console.error('Failed to save goal:', err);
            setToast({ message: err.message, type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    // Handle delete goal
    const handleDeleteGoal = async (goalId) => {
        try {
            const response = await deleteGoal(userId, goalId);
            if (response.status === 'success') {
                loadGoals();
                onGoalsChanged?.();
                setToast({
                    message: t('investments.goals.goalDeleted', 'Goal removed'),
                    type: 'success'
                });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (err) {
            console.error('Failed to delete goal:', err);
        }
    };

    // Handle edit goal
    const handleEditGoal = (goal) => {
        setEditingGoal(goal);
        setSelectedPreset(goal.presetType || 'custom');
        setEstimatedAmount(goal.targetAmount);
        setShowGoalForm(true);
    };

    // Calculate totals
    const totalMonthlyRequired = useMemo(() => {
        return goals.reduce((sum, g) => sum + (g.requiredMonthlySaving || 0), 0);
    }, [goals]);

    const totalTargetAmount = useMemo(() => {
        return goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    }, [goals]);

    // Preset keys for grid
    const presetKeys = ['wedding', 'house', 'baby', 'education', 'retirement', 'car', 'travel', 'emergency', 'custom'];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${embedded ? '' : 'bg-white rounded-2xl p-6 shadow-sm'}`}>
            {/* Header */}
            {!embedded && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            {t('investments.goals.title', 'My Goals')}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {t('investments.goals.subtitle', 'What are you building towards?')}
                        </p>
                    </div>

                    {goals.length > 0 && (
                        <div className="text-end">
                            <div className="text-2xl font-bold text-purple-600">
                                ₪{Math.round(totalMonthlyRequired).toLocaleString()}/mo
                            </div>
                            <div className="text-xs text-slate-500">
                                {t('investments.goals.totalMonthlyRequired', 'Total monthly savings needed')}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Goal Preset Grid */}
            <div>
                <h3 className="text-sm font-medium text-slate-600 mb-3">{t('investments.goals.addGoal', 'Add New Goal')}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {presetKeys.map(key => (
                        <GoalPresetCard
                            key={key}
                            presetKey={key}
                            preset={GOAL_PRESETS[key]}
                            isSelected={selectedPreset === key}
                            onClick={() => handlePresetClick(key)}
                            t={t}
                            isRTL={isRTL}
                        />
                    ))}
                </div>
            </div>

            {/* Existing Goals by Bucket */}
            {goals.length > 0 && (
                <div className="space-y-4">
                    {['long', 'mid', 'short'].map(bucket => {
                        const bucketGoals = groupedGoals[bucket] || [];
                        if (bucketGoals.length === 0) return null;

                        const bucketInfo = BUCKET_INFO[bucket];

                        return (
                            <div key={bucket}>
                                <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                                    <span>{bucketInfo.icon}</span>
                                    {t(`investments.buckets.${bucket}.name`, bucketInfo.name)}
                                    <span className="text-xs text-slate-400">
                                        ({t(`investments.buckets.${bucket}.timeRange`, bucketInfo.timeRange)})
                                    </span>
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {bucketGoals.map(goal => (
                                        <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            onEdit={handleEditGoal}
                                            onDelete={handleDeleteGoal}
                                            t={t}
                                            isRTL={isRTL}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {goals.length === 0 && (
                <div className="text-center py-8 bg-slate-50 rounded-2xl">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="text-slate-600 font-medium">
                        {t('investments.goals.noGoals', "No goals yet. Let's plan your future!")}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                        {t('investments.goals.subtitle', 'What are you building towards?')}
                    </p>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-4 end-4 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-bottom-4
                    ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {toast.message}
                </div>
            )}

            {/* Modals */}
            {showEstimator && selectedPreset && GOAL_PRESETS[selectedPreset] && (
                <SmartEstimatorModal
                    preset={GOAL_PRESETS[selectedPreset]}
                    presetKey={selectedPreset}
                    onSelect={handleEstimatorSelect}
                    onClose={() => { setShowEstimator(false); setSelectedPreset(null); }}
                    t={t}
                    isRTL={isRTL}
                />
            )}

            {showGoalForm && (
                <GoalFormModal
                    preset={GOAL_PRESETS[selectedPreset]}
                    presetKey={selectedPreset}
                    initialAmount={estimatedAmount}
                    existingGoal={editingGoal}
                    onSave={handleSaveGoal}
                    onClose={() => { setShowGoalForm(false); setSelectedPreset(null); setEditingGoal(null); }}
                    t={t}
                    isRTL={isRTL}
                />
            )}
        </div>
    );
};

export default GoalStudio;
