import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import {
    Sparkles, Target, Zap, PieChart,
    ChevronRight, ArrowRight, Star
} from 'lucide-react';

// Animated step indicator
const StepIndicator = ({ step, currentStep, text, icon: Icon }) => {
    const isActive = step === currentStep;
    const isComplete = step < currentStep;

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300
            ${isActive ? 'bg-purple-100 scale-[1.02]' : isComplete ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                    : isComplete
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                }`}>
                {isComplete ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <Icon className="w-5 h-5" />
                )}
            </div>
            <span className={`font-medium ${isActive ? 'text-purple-700' : isComplete ? 'text-emerald-700' : 'text-slate-500'}`}>
                {text}
            </span>
        </div>
    );
};

// Main OnboardingWelcome Component
export const OnboardingWelcome = ({ userId, onStart }) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);
    const [isHovering, setIsHovering] = useState(false);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
            {/* Animated Logo/Icon */}
            <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-600 
                    flex items-center justify-center shadow-xl shadow-purple-200 animate-pulse">
                    <Sparkles className="w-12 h-12 text-white" />
                </div>
                {/* Orbiting dots */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-400 rounded-full shadow-lg" />
                </div>
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-lg" />
                </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-slate-800 mb-3">
                {t('investments.onboarding.welcome.title', 'Welcome to Exli Investments')}
            </h1>

            {/* Tagline */}
            <p className="text-lg text-slate-600 max-w-md mb-8">
                {t('investments.onboarding.welcome.subtitle',
                    "Great investing isn't about picking hot stocks. It's about building towards your dreams."
                )}
            </p>

            {/* 3-Step Preview */}
            <div className="w-full max-w-sm space-y-3 mb-8">
                <p className="text-sm text-slate-500 mb-4">
                    {t('investments.onboarding.welcome.description',
                        "We'll help you create a personalized plan in 3 simple steps:"
                    )}
                </p>

                <StepIndicator
                    step={1}
                    currentStep={0}
                    text={t('investments.onboarding.welcome.step1', 'Define your life goals')}
                    icon={Target}
                />
                <StepIndicator
                    step={2}
                    currentStep={0}
                    text={t('investments.onboarding.welcome.step2', 'Test your risk comfort')}
                    icon={Zap}
                />
                <StepIndicator
                    step={3}
                    currentStep={0}
                    text={t('investments.onboarding.welcome.step3', 'Get your custom allocation')}
                    icon={PieChart}
                />
            </div>

            {/* CTA Button */}
            <button
                onClick={onStart}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 
                    text-white rounded-2xl font-medium text-lg shadow-lg shadow-purple-200 
                    hover:shadow-xl hover:shadow-purple-300 transition-all duration-300 hover:scale-[1.02]
                    flex items-center gap-3"
            >
                <span>{t('investments.onboarding.welcome.cta', "Let's Build My Strategy")}</span>
                <div className={`transition-transform duration-300 ${isHovering ? 'translate-x-1' : ''}`}>
                    <ArrowRight className="w-5 h-5" />
                </div>

                {/* Shine effect */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent 
                        group-hover:left-full transition-all duration-700" />
                </div>
            </button>

            {/* Trust badge */}
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
                <Star className="w-4 h-4 text-amber-400" />
                <span>{t('investments.onboarding.welcome.trustBadge', 'No stock picking. No market timing. Just smart goals.')}</span>
            </div>
        </div>
    );
};

export default OnboardingWelcome;
