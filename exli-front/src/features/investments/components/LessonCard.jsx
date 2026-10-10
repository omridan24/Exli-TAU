import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import {
    BookOpen, Lightbulb, TrendingUp, Shield, Clock,
    Target, ArrowRight, Sparkles, ChevronDown, ChevronUp,
    CheckCircle2, Info
} from 'lucide-react';

// Lesson content configuration
export const LESSON_CONTENT = {
    goalBased: {
        icon: Target,
        color: 'purple',
        illustration: '🎯',
        titleKey: 'investments.lessons.goalBased.title',
        titleFallback: 'Why Goal-Based Investing?',
        points: [
            { key: 'investments.lessons.goalBased.point1', fallback: 'Traditional investing asks: "How much risk can you handle?" We ask: "What are you dreaming of?"' },
            { key: 'investments.lessons.goalBased.point2', fallback: 'Each goal gets its own timeline and strategy. Your wedding fund shouldn\'t ride the same rollercoaster as your retirement.' },
            { key: 'investments.lessons.goalBased.point3', fallback: 'When markets crash, you\'ll know exactly which goals are safe and which have time to recover.' }
        ],
        takeawayKey: 'investments.lessons.goalBased.takeaway',
        takeawayFallback: '💡 Takeaway: Goals first, investments second. Your money serves your dreams—not the other way around.'
    },
    timeHorizon: {
        icon: Clock,
        color: 'blue',
        illustration: '⏳',
        titleKey: 'investments.lessons.timeHorizon.title',
        titleFallback: 'The Magic of Time Horizon',
        points: [
            { key: 'investments.lessons.timeHorizon.point1', fallback: 'Short-term money (0-3 years): Keep it safe. A 30% crash right before your wedding? No thanks.' },
            { key: 'investments.lessons.timeHorizon.point2', fallback: 'Mid-term money (3-10 years): Some risk is OK. You have time to recover from dips.' },
            { key: 'investments.lessons.timeHorizon.point3', fallback: 'Long-term money (10+ years): Go for growth! History shows markets always recover over decades.' }
        ],
        takeawayKey: 'investments.lessons.timeHorizon.takeaway',
        takeawayFallback: '💡 Takeaway: Time is your superpower. The longer you can wait, the more risk (and reward) you can handle.'
    },
    diversification: {
        icon: Shield,
        color: 'emerald',
        illustration: '🛡️',
        titleKey: 'investments.lessons.diversification.title',
        titleFallback: 'Diversification: Your Safety Net',
        points: [
            { key: 'investments.lessons.diversification.point1', fallback: 'Don\'t put all your eggs in one basket. When tech stocks crash, bonds might shine.' },
            { key: 'investments.lessons.diversification.point2', fallback: 'Our bucket system is diversification on steroids. Short-term = safe, Long-term = growth.' },
            { key: 'investments.lessons.diversification.point3', fallback: 'Even in 2008\'s worst crash, diversified portfolios recovered faster than all-stock portfolios.' }
        ],
        takeawayKey: 'investments.lessons.diversification.takeaway',
        takeawayFallback: '💡 Takeaway: Diversification can\'t prevent losses, but it can prevent catastrophe.'
    },
    compoundGrowth: {
        icon: TrendingUp,
        color: 'amber',
        illustration: '📈',
        titleKey: 'investments.lessons.compoundGrowth.title',
        titleFallback: 'Compound Growth: The 8th Wonder',
        points: [
            { key: 'investments.lessons.compoundGrowth.point1', fallback: '₪1,000/month at 8% for 30 years = ₪1.5 million. You only put in ₪360,000!' },
            { key: 'investments.lessons.compoundGrowth.point2', fallback: 'The secret: your money makes money, which makes MORE money. Snowball effect.' },
            { key: 'investments.lessons.compoundGrowth.point3', fallback: 'Starting 10 years earlier can mean DOUBLE the final amount. Time beats everything.' }
        ],
        takeawayKey: 'investments.lessons.compoundGrowth.takeaway',
        takeawayFallback: '💡 Takeaway: Start today. The best time to invest was yesterday. The second best time is now.'
    },
    stayingCourse: {
        icon: Sparkles,
        color: 'indigo',
        illustration: '🧘',
        titleKey: 'investments.lessons.stayingCourse.title',
        titleFallback: 'The Hardest Part: Staying the Course',
        points: [
            { key: 'investments.lessons.stayingCourse.point1', fallback: 'In 2008, those who sold at the bottom locked in 50% losses forever.' },
            { key: 'investments.lessons.stayingCourse.point2', fallback: 'Those who held? Fully recovered in 18 months and went on to new highs.' },
            { key: 'investments.lessons.stayingCourse.point3', fallback: 'Our bucket system helps: when markets crash, your Short-term bucket is safe. Sleep easy.' }
        ],
        takeawayKey: 'investments.lessons.stayingCourse.takeaway',
        takeawayFallback: '💡 Takeaway: The market will test you. Your plan is designed to handle it. Trust the process.'
    }
};

// Color mappings
const colorClasses = {
    purple: {
        bg: 'bg-gradient-to-br from-purple-50 to-violet-50',
        border: 'border-purple-200',
        accent: 'bg-purple-600',
        text: 'text-purple-700',
        light: 'bg-purple-100',
        check: 'text-purple-500'
    },
    blue: {
        bg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
        border: 'border-blue-200',
        accent: 'bg-blue-600',
        text: 'text-blue-700',
        light: 'bg-blue-100',
        check: 'text-blue-500'
    },
    emerald: {
        bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
        border: 'border-emerald-200',
        accent: 'bg-emerald-600',
        text: 'text-emerald-700',
        light: 'bg-emerald-100',
        check: 'text-emerald-500'
    },
    amber: {
        bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
        border: 'border-amber-200',
        accent: 'bg-amber-600',
        text: 'text-amber-700',
        light: 'bg-amber-100',
        check: 'text-amber-500'
    },
    indigo: {
        bg: 'bg-gradient-to-br from-indigo-50 to-purple-50',
        border: 'border-indigo-200',
        accent: 'bg-indigo-600',
        text: 'text-indigo-700',
        light: 'bg-indigo-100',
        check: 'text-indigo-500'
    }
};

// Main Lesson Card Component
export const LessonCard = ({
    lessonKey,
    userId,
    defaultExpanded = true,
    compact = false,
    onDismiss
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const lesson = LESSON_CONTENT[lessonKey];
    if (!lesson) return null;

    const colors = colorClasses[lesson.color] || colorClasses.purple;
    const Icon = lesson.icon;

    if (compact) {
        return (
            <div className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-4 transition-all duration-300`}
                dir={isRTL ? 'rtl' : 'ltr'}>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center gap-3"
                >
                    <div className={`w-10 h-10 ${colors.accent} rounded-xl flex items-center justify-center text-white shadow-md`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-start">
                        <h3 className={`font-bold ${colors.text}`}>
                            {t(lesson.titleKey, lesson.titleFallback)}
                        </h3>
                    </div>
                    <div className={`${colors.light} p-2 rounded-full`}>
                        {isExpanded ? (
                            <ChevronUp className={`w-4 h-4 ${colors.text}`} />
                        ) : (
                            <ChevronDown className={`w-4 h-4 ${colors.text}`} />
                        )}
                    </div>
                </button>

                {isExpanded && (
                    <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        {lesson.points.map((point, idx) => (
                            <div key={idx} className="flex gap-2">
                                <CheckCircle2 className={`w-5 h-5 ${colors.check} flex-shrink-0 mt-0.5`} />
                                <p className="text-slate-600 text-sm">
                                    {t(point.key, point.fallback)}
                                </p>
                            </div>
                        ))}
                        <div className={`mt-4 p-3 ${colors.light} rounded-xl`}>
                            <p className={`text-sm font-medium ${colors.text}`}>
                                {t(lesson.takeawayKey, lesson.takeawayFallback)}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Full-size lesson card
    return (
        <div className={`${colors.bg} ${colors.border} border-2 rounded-3xl p-6 transition-all duration-300 relative overflow-hidden`}
            dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Decorative background */}
            <div className="absolute top-0 end-0 text-8xl opacity-10 select-none pointer-events-none">
                {lesson.illustration}
            </div>

            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 ${colors.accent} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                    <Icon className="w-7 h-7" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen className={`w-4 h-4 ${colors.text}`} />
                        <span className={`text-xs font-medium ${colors.text} uppercase tracking-wide`}>
                            {t('investments.lessons.label', 'Lesson')}
                        </span>
                    </div>
                    <h2 className={`text-xl font-bold ${colors.text}`}>
                        {t(lesson.titleKey, lesson.titleFallback)}
                    </h2>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <span className="sr-only">{t('investments.misc.dismiss', 'Dismiss')}</span>
                        ×
                    </button>
                )}
            </div>

            {/* Points */}
            <div className="space-y-4 mb-6 relative z-10">
                {lesson.points.map((point, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                        <div className={`w-6 h-6 ${colors.light} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <span className={`text-xs font-bold ${colors.text}`}>{idx + 1}</span>
                        </div>
                        <p className="text-slate-700">
                            {t(point.key, point.fallback)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Takeaway */}
            <div className={`${colors.light} rounded-2xl p-4 border-2 border-dashed ${colors.border}`}>
                <p className={`font-medium ${colors.text}`}>
                    {t(lesson.takeawayKey, lesson.takeawayFallback)}
                </p>
            </div>
        </div>
    );
};

// Info Pill - Small inline educational hint
export const InfoPill = ({ textKey, fallback, userId }) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);

    return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full"
            dir={isRTL ? 'rtl' : 'ltr'}>
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-blue-700">
                {t(textKey, fallback)}
            </span>
        </div>
    );
};

// Lesson Banner - Prominent horizontal lesson display
export const LessonBanner = ({
    lessonKey,
    userId,
    onLearnMore
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);

    const lesson = LESSON_CONTENT[lessonKey];
    if (!lesson) return null;

    const colors = colorClasses[lesson.color] || colorClasses.purple;
    const Icon = lesson.icon;

    return (
        <div className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-5 flex items-center gap-4`}
            dir={isRTL ? 'rtl' : 'ltr'}>
            <div className={`w-12 h-12 ${colors.accent} rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className={`font-bold ${colors.text} mb-1`}>
                    {t(lesson.titleKey, lesson.titleFallback)}
                </h3>
                <p className="text-slate-600 text-sm line-clamp-2">
                    {t(lesson.points[0].key, lesson.points[0].fallback)}
                </p>
            </div>
            {onLearnMore && (
                <button
                    onClick={onLearnMore}
                    className={`px-4 py-2 ${colors.accent} text-white rounded-xl font-medium text-sm 
                        hover:shadow-lg transition-all flex items-center gap-2 flex-shrink-0`}
                >
                    {t('common.learnMore', 'Learn More')}
                    <ArrowRight className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default LessonCard;
