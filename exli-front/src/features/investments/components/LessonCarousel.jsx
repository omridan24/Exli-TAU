import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../hooks/useLanguage';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { LessonCard, LESSON_CONTENT } from './LessonCard';

// Lesson Carousel - Display multiple lessons in a carousel
export const LessonCarousel = ({
    lessonKeys = ['goalBased', 'timeHorizon', 'diversification'],
    userId,
    autoPlay = false,
    showDots = true
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);
    const [currentIndex, setCurrentIndex] = useState(0);

    const validLessons = lessonKeys.filter(key => LESSON_CONTENT[key]);

    if (validLessons.length === 0) return null;

    const goNext = () => {
        setCurrentIndex((prev) => (prev + 1) % validLessons.length);
    };

    const goPrev = () => {
        setCurrentIndex((prev) => (prev - 1 + validLessons.length) % validLessons.length);
    };

    return (
        <div className="relative" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Main lesson display */}
            <div className="overflow-hidden">
                <div
                    className="transition-transform duration-500 ease-out"
                    style={{
                        transform: `translateX(${isRTL ? currentIndex * 100 : -currentIndex * 100}%)`,
                        display: 'flex'
                    }}
                >
                    {validLessons.map((lessonKey, idx) => (
                        <div
                            key={lessonKey}
                            className="w-full flex-shrink-0 px-1"
                        >
                            <LessonCard
                                lessonKey={lessonKey}
                                userId={userId}
                                defaultExpanded={true}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation arrows */}
            {validLessons.length > 1 && (
                <>
                    <button
                        onClick={isRTL ? goNext : goPrev}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 
                            w-10 h-10 bg-white rounded-full shadow-lg border border-slate-200
                            flex items-center justify-center text-slate-600 hover:text-slate-800 
                            hover:shadow-xl transition-all z-10"
                        disabled={currentIndex === 0 && !isRTL}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={isRTL ? goPrev : goNext}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 
                            w-10 h-10 bg-white rounded-full shadow-lg border border-slate-200
                            flex items-center justify-center text-slate-600 hover:text-slate-800 
                            hover:shadow-xl transition-all z-10"
                        disabled={currentIndex === validLessons.length - 1 && !isRTL}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </>
            )}

            {/* Dots indicator */}
            {showDots && validLessons.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    {validLessons.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300
                                ${idx === currentIndex
                                    ? 'bg-purple-600 w-6'
                                    : 'bg-slate-300 hover:bg-slate-400'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Learning Hub - A section with multiple expandable lessons
export const LearningHub = ({ userId, lessons = ['goalBased', 'timeHorizon', 'diversification', 'compoundGrowth', 'stayingCourse'] }) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);
    const [expandedIndex, setExpandedIndex] = useState(0);

    return (
        <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">
                    {t('investments.lessons.hubTitle', '📚 Investment Academy')}
                </h2>
                <p className="text-slate-500 mt-1">
                    {t('investments.lessons.hubSubtitle', 'Master the fundamentals of smart investing')}
                </p>
            </div>

            <div className="space-y-3">
                {lessons.map((lessonKey, idx) => (
                    <LessonCard
                        key={lessonKey}
                        lessonKey={lessonKey}
                        userId={userId}
                        compact={true}
                        defaultExpanded={idx === expandedIndex}
                    />
                ))}
            </div>
        </div>
    );
};

export default LessonCarousel;
