import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, RefreshCw, X, Calendar, Rocket, Target, Briefcase, Sparkles, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';
import { CLOUD_RUN_URL, db } from '../../config/firebase.js';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { getInvestmentProfile, completeOnboarding } from '../../config/investmentProfileService';
import { Money } from '../../components/Money';
import { useFx } from '../../lib/fx/useFx';

// Import strategy components
import { StrategyPlayground } from './components/StrategyPlayground';
import { AllocationBuckets } from './components/AllocationBuckets';
import { PortfolioMapper } from './components/PortfolioMapper';
import { MonthlyMission } from './components/MonthlyMission';

// Import new goal-based components
import { GoalStudio } from './components/GoalStudio';
import { MarketTimeMachine } from './components/MarketTimeMachine';
import { OnboardingWelcome } from './components/OnboardingWelcome';
import { LessonBanner } from './components/LessonCard';

// Enhanced sparkline with high/low markers
const Sparkline = ({ data, color = '#10b981', height = 40, t }) => {
    if (!data || data.length < 2) return null;

    const values = data.map(d => d.close || d.price || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Find indices of min and max
    const maxIdx = values.indexOf(max);
    const minIdx = values.indexOf(min);

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    // Calculate marker positions
    const maxX = (maxIdx / (values.length - 1)) * 100;
    const maxY = height - ((max - min) / range) * height;
    const minX = (minIdx / (values.length - 1)) * 100;
    const minY = height - ((min - min) / range) * height;

    return (
        <svg viewBox={`0 0 100 ${height}`} className="w-full h-full" preserveAspectRatio="none">
            {/* Main line */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
            {/* High marker */}
            <circle cx={maxX} cy={maxY + 2} r="3" fill="#10b981" className="cursor-pointer">
                <title>{t ? t('investments.high', 'High') : 'High'}: ${max.toFixed(2)}</title>
            </circle>
            {/* Low marker */}
            <circle cx={minX} cy={minY - 2} r="3" fill="#ef4444" className="cursor-pointer">
                <title>{t ? t('investments.low', 'Low') : 'Low'}: ${min.toFixed(2)}</title>
            </circle>
        </svg>
    );
};

// Stock/ETF Card Component
const StockCard = ({ data, periodKey, onRemove, t }) => {
    const priceHistory = data.priceHistory || [];

    // Filter data based on selected period
    const filteredHistory = useMemo(() => {
        if (!priceHistory.length) return [];

        const now = new Date();
        let cutoffDate;

        if (periodKey === '30D') {
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (periodKey === 'YTD') {
            cutoffDate = new Date(now.getFullYear(), 0, 1);
        } else {
            cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        }

        return priceHistory.filter(p => {
            const pDate = new Date(p.date || p.datetime);
            return pDate >= cutoffDate;
        });
    }, [priceHistory, periodKey]);

    // Calculate change for the selected period
    const periodStart = filteredHistory.length > 0 ? filteredHistory[0].close : null;
    const periodEnd = data.currentPrice || (filteredHistory.length > 0 ? filteredHistory[filteredHistory.length - 1].close : null);

    let changePercent = 0;
    if (periodStart && periodEnd && periodStart !== 0) {
        changePercent = ((periodEnd - periodStart) / periodStart) * 100;
    }

    const isPositive = changePercent >= 0;
    const changeColor = isPositive ? 'text-emerald-600' : 'text-red-500';
    const bgColor = isPositive ? 'bg-emerald-50' : 'bg-red-50';

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
            {/* Remove button */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove?.(data.symbol); }}
                className="absolute top-2 end-2 w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
                <X className="w-3 h-3 text-slate-500 hover:text-red-500" />
            </button>

            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-lg text-slate-800">
                        {data.symbol}
                    </h3>
                    <p className="text-xs text-slate-500 truncate max-w-[120px]">{data.name}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${data.type === 'etf' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {data.type?.toUpperCase() || 'STOCK'}
                </span>
            </div>

            {/* Sparkline chart with proper containment */}
            <div className="h-14 mb-2 overflow-hidden rounded-lg bg-slate-50 px-2 py-1">
                {filteredHistory.length > 1 ? (
                    <Sparkline
                        data={filteredHistory}
                        color={isPositive ? '#10b981' : '#ef4444'}
                        height={48}
                        t={t}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        {t('investments.noData', 'No data')}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-end">
                <div className="text-xl font-bold text-slate-900">
                    {data.currentPrice != null
                        ? <Money amount={data.currentPrice} currency={data.currency || 'USD'} />
                        : '—'}
                </div>
                <div className={`flex items-center gap-1 ${changeColor} ${bgColor} px-2 py-1 rounded-lg text-sm font-medium`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {changePercent.toFixed(2)}%
                </div>
            </div>
        </div>
    );
};

// Search Results Dropdown
const SearchResults = ({ results, onSelect, isLoading, t }) => {
    if (isLoading) {
        return (
            <div className="absolute top-full start-0 end-0 bg-white rounded-xl shadow-lg border border-slate-200 mt-2 p-4 z-50">
                <div className="flex items-center gap-2 text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('investments.searching', 'Searching...')}
                </div>
            </div>
        );
    }

    if (!results || results.length === 0) return null;

    // Only show stocks and ETFs
    const stockResults = results.filter(item => item.type !== 'forex');
    if (stockResults.length === 0) return null;

    return (
        <div className="absolute top-full start-0 end-0 bg-white rounded-xl shadow-lg border border-slate-200 mt-2 max-h-80 overflow-y-auto z-50">
            {stockResults.map((item, idx) => (
                <button
                    key={idx}
                    onClick={() => onSelect(item)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 border-b border-slate-100 last:border-0 text-start"
                >
                    <div>
                        <span className="font-bold text-slate-800">{item.symbol}</span>
                        <span className="text-slate-500 ms-2 text-sm">{item.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${item.type === 'etf' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.type?.toUpperCase() || 'STOCK'}
                    </span>
                </button>
            ))}
        </div>
    );
};

// Watch Tab Content (original functionality)
const WatchTab = ({ userId, t, isRTL }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedSymbols, setSelectedSymbols] = useState([]);
    const [symbolData, setSymbolData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [timePeriod, setTimePeriod] = useState('30D');

    const TIME_PERIODS = [
        { key: '30D', label: t('investments.period30D', '30 Days') },
        { key: 'YTD', label: t('investments.periodYTD', 'YTD') },
        { key: '1Y', label: t('investments.period1Y', '1 Year') },
    ];

    // Load user's saved symbols on mount
    useEffect(() => {
        const loadUserSymbols = async () => {
            if (!userId) {
                setIsLoading(false);
                return;
            }

            try {
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const savedSymbols = userData.watchedSymbols || [];
                    setSelectedSymbols(savedSymbols);

                    // Fetch data for each saved symbol from backend API
                    for (const symbol of savedSymbols) {
                        try {
                            const res = await fetch(`${CLOUD_RUN_URL}/market/symbol/${symbol}`);
                            const data = await res.json();
                            if (data && !data.error) {
                                setSymbolData(prev => ({ ...prev, [symbol]: data }));
                            }
                        } catch (err) {
                            console.error(`Failed to load ${symbol}:`, err);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load user symbols:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserSymbols();
    }, [userId]);

    // Debounced search via backend API
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`${CLOUD_RUN_URL}/market/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
                const data = await res.json();
                setSearchResults(data);
            } catch (err) {
                console.error('Search failed:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Save symbol to user's Firebase
    const saveSymbolToUser = async (symbol) => {
        if (!userId) return;

        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                watchedSymbols: arrayUnion(symbol)
            });
        } catch (err) {
            console.error('Failed to save symbol:', err);
        }
    };

    // Remove symbol from user's Firebase
    const removeSymbolFromUser = async (symbol) => {
        if (!userId) return;

        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                watchedSymbols: arrayRemove(symbol)
            });
        } catch (err) {
            console.error('Failed to remove symbol:', err);
        }
    };

    // Handle symbol selection
    const handleSelectSymbol = useCallback(async (item) => {
        setSearchQuery('');
        setSearchResults([]);

        if (item.type === 'forex') return;

        if (!selectedSymbols.includes(item.symbol)) {
            setSelectedSymbols(prev => [...prev, item.symbol]);
            await saveSymbolToUser(item.symbol);

            // Use data from search result or fetch from API
            if (item.priceHistory) {
                setSymbolData(prev => ({ ...prev, [item.symbol]: item }));
            } else {
                try {
                    const res = await fetch(`${CLOUD_RUN_URL}/market/symbol/${item.symbol}`);
                    const data = await res.json();
                    if (data && !data.error) {
                        setSymbolData(prev => ({ ...prev, [item.symbol]: data }));
                    }
                } catch (err) {
                    console.error('Failed to load symbol data:', err);
                }
            }
        }
    }, [selectedSymbols, userId]);

    // Handle symbol removal
    const handleRemoveSymbol = useCallback(async (symbol) => {
        setSelectedSymbols(prev => prev.filter(s => s !== symbol));
        setSymbolData(prev => {
            const newData = { ...prev };
            delete newData[symbol];
            return newData;
        });

        await removeSymbolFromUser(symbol);
    }, [userId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    const currentPeriodLabel = TIME_PERIODS.find(p => p.key === timePeriod)?.label || t('investments.period30D', '30 Days');

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <div className="relative">
                    <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5`} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('investments.searchPlaceholder', 'Search stocks or ETFs...')}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-lg`}
                    />
                </div>
                <SearchResults
                    results={searchResults}
                    onSelect={handleSelectSymbol}
                    isLoading={isSearching}
                    t={t}
                />
            </div>

            {/* Time Period Selector & Info Bar */}
            {selectedSymbols.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4" />
                        <span>{t('investments.showingData', 'Showing data for')}: <strong>{currentPeriodLabel}</strong></span>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs text-slate-400">{t('investments.pricesUpdated', 'Prices updated daily')}</span>
                    </div>
                    <div className="flex gap-1">
                        {TIME_PERIODS.map(period => (
                            <button
                                key={period.key}
                                onClick={() => setTimePeriod(period.key)}
                                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${timePeriod === period.key
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Stocks Content */}
            <div>
                {selectedSymbols.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl">
                        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">{t('investments.noStocks', 'Search and add stocks or ETFs to track')}</p>
                        <p className="text-xs text-slate-400 mt-2">{t('investments.onlyDbStocks', 'Only stocks available in our database can be tracked')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedSymbols.map(symbol => (
                            <StockCard
                                key={symbol}
                                data={symbolData[symbol] || { symbol, name: t('common.loading', 'Loading...') }}
                                periodKey={timePeriod}
                                onRemove={handleRemoveSymbol}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Main Investment Node Component
export const InvestmentNode = ({ userId, onComplete }) => {
    const { t } = useTranslation();
    const { isRTL } = useLanguage(userId);

    // Active tab state - goals is default now
    const [activeTab, setActiveTab] = useState('goals');
    const [isLoading, setIsLoading] = useState(true);

    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState('welcome'); // welcome, investmentStatus, goals, stressTest, complete
    const [hasExistingInvestments, setHasExistingInvestments] = useState(null);
    const [investmentProfile, setInvestmentProfile] = useState(null);
    const [riskScore, setRiskScore] = useState(0.5);

    // Strategy state (now uses time-based buckets)
    const [investmentStrategy, setInvestmentStrategy] = useState({
        targetSavingsRate: 0.15,
        bucketAllocations: { long: 50, mid: 30, short: 20 },
        bucketLocks: { long: false, mid: false, short: false }
    });

    // Retake Risk Simulator state (Strategy tab)
    const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);
    const [isRetakingSimulation, setIsRetakingSimulation] = useState(false);
    // Bumped whenever a retake completes, forcing AllocationBuckets to remount
    // with the freshly-saved allocations instead of holding onto its stale initial state
    const [retakeVersion, setRetakeVersion] = useState(0);

    // Holdings state
    const [holdings, setHoldings] = useState([]);

    // Currency rates (for conversion display) - live from fxRates via useFx,
    // replacing the old hardcoded {USD:3.65, EUR:4.05} fallback and the
    // separate (long-stale, see docs/fx/01-fx-plan.md §0.2) /market/currencies
    // fetch. Holdings stay in their own trading currency (a USD stock IS in
    // USD) - this is purely for the ILS-equivalent display, so no
    // ConvertOffer applies here.
    const { defaultCurrency, convertTo, dataVersion } = useFx();

    // {currency: rate} where rate is "1 unit of that currency in defaultCurrency"
    // - recomputed live from fxRates as they load (dataVersion is what makes
    // that recomputation actually happen once a background load finishes,
    // see useFx.js), for whichever currencies the actual holdings use.
    const currencyRates = useMemo(() => {
        const rates = {};
        const currencies = new Set((holdings || []).map(h => h.currency).filter(Boolean));
        currencies.add('USD'); // a sensible default even before holdings have loaded
        currencies.forEach(cur => {
            if (cur === defaultCurrency) { rates[cur] = 1; return; }
            const result = convertTo({ amount: 1, currency: cur }, defaultCurrency);
            if (result.value != null) rates[cur] = result.value;
        });
        return rates;
        // dataVersion is intentionally listed to force a recompute once a
        // background fx load finishes (see useFx.js) even though it isn't
        // read inside this callback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [holdings, convertTo, defaultCurrency, dataVersion]);

    // Mission plans - one per month, keyed 'YYYY-MM': { moneyToInvest, completedTaskIds }
    const [missionPlans, setMissionPlans] = useState({});

    // Tab definitions - Goals first (new!), then Strategy, Portfolio, Mission
    const tabs = [
        { key: 'goals', label: t('investments.tabs.goals', 'Goals'), icon: Sparkles },
        { key: 'strategy', label: t('investments.tabs.strategy', 'Strategy'), icon: Target },
        { key: 'portfolio', label: t('investments.tabs.portfolio', 'Portfolio'), icon: Briefcase },
        { key: 'mission', label: t('investments.tabs.mission', 'Mission'), icon: Rocket }
    ];

    // Load user's investment data on mount
    useEffect(() => {
        const loadUserInvestmentData = async () => {
            if (!userId) {
                setIsLoading(false);
                return;
            }

            try {
                // Check investment profile for onboarding status
                try {
                    const profileData = await getInvestmentProfile(userId);
                    setInvestmentProfile(profileData.profile);

                    // Show onboarding if profile doesn't exist or is incomplete
                    if (!profileData.hasProfile || !profileData.onboardingComplete) {
                        setShowOnboarding(true);
                    }

                    // Update target allocation from profile if available
                    if (profileData.profile?.targetAllocation) {
                        setInvestmentStrategy(prev => ({
                            ...prev,
                            bucketAllocations: {
                                long: Math.round((profileData.profile.targetAllocation.long || 0.5) * 100),
                                mid: Math.round((profileData.profile.targetAllocation.mid || 0.3) * 100),
                                short: Math.round((profileData.profile.targetAllocation.short || 0.2) * 100)
                            }
                        }));
                    }
                } catch (err) {
                    console.error('Failed to load investment profile:', err);
                    // Still show onboarding if we can't check profile
                    setShowOnboarding(true);
                }

                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Load strategy
                    if (userData.investmentStrategy) {
                        setInvestmentStrategy(userData.investmentStrategy);
                    }

                    // Load holdings
                    if (userData.holdings) {
                        setHoldings(userData.holdings);
                    }

                    // Load mission plans
                    if (userData.missionPlans) {
                        setMissionPlans(userData.missionPlans);
                    }
                }

            } catch (err) {
                console.error('Failed to load investment data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserInvestmentData();
    }, [userId]);

    // Save strategy to Firebase
    const saveStrategy = useCallback(async (newStrategy) => {
        if (!userId) return;

        setInvestmentStrategy(newStrategy);

        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                investmentStrategy: newStrategy
            });
        } catch (err) {
            console.error('Failed to save strategy:', err);
        }
    }, [userId]);

    // Save holdings to Firebase
    const saveHoldings = useCallback(async (newHoldings) => {
        if (!userId) return;

        setHoldings(newHoldings);

        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                holdings: newHoldings
            });
        } catch (err) {
            console.error('Failed to save holdings:', err);
        }
    }, [userId]);

    // Handle savings rate change
    const handleSavingsRateChange = useCallback((newRate) => {
        const updated = { ...investmentStrategy, targetSavingsRate: newRate };
        saveStrategy(updated);
    }, [investmentStrategy, saveStrategy]);

    // Handle bucket allocation change
    const handleAllocationsChange = useCallback((newAllocations) => {
        const updated = { ...investmentStrategy, bucketAllocations: newAllocations };
        saveStrategy(updated);
    }, [investmentStrategy, saveStrategy]);

    // Save a single month's mission plan (money to invest / completed tasks)
    const saveMissionPlan = useCallback(async (monthKey, plan) => {
        if (!userId) return;

        const newMissionPlans = { ...missionPlans, [monthKey]: plan };
        setMissionPlans(newMissionPlans);

        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                [`missionPlans.${monthKey}`]: plan
            });
        } catch (err) {
            console.error('Failed to save mission plan:', err);
        }
    }, [userId, missionPlans]);

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Onboarding Flow - Keeps within page (preserves top nav) */}
            {showOnboarding && (
                <div className="min-h-[80vh] bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div className="max-w-2xl mx-auto py-8 px-4">
                        {onboardingStep === 'welcome' && (
                            <OnboardingWelcome
                                userId={userId}
                                onStart={() => setOnboardingStep('investmentStatus')}
                            />
                        )}

                        {/* Investment Status Selection - New step */}
                        {onboardingStep === 'investmentStatus' && (
                            <div className="space-y-6 animate-in fade-in-50 duration-300">
                                <div className="text-center mb-8">
                                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                                        <Briefcase className="w-10 h-10 text-purple-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                                        {t('investments.onboarding.investmentStatus.title', 'Do you have any investments yet?')}
                                    </h2>
                                    <p className="text-slate-500">
                                        {t('investments.onboarding.investmentStatus.subtitle', 'This helps us personalize your experience')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* New Investor Card */}
                                    <button
                                        onClick={() => {
                                            setHasExistingInvestments(false);
                                            setOnboardingStep('goals');
                                        }}
                                        className={`p-6 rounded-2xl border-2 transition-all text-center hover:scale-[1.02] hover:shadow-lg
                                            ${hasExistingInvestments === false
                                                ? 'border-purple-500 bg-purple-50'
                                                : 'border-slate-200 hover:border-purple-300 bg-white'}`}
                                    >
                                        <div className="text-5xl mb-4">🌱</div>
                                        <h3 className="font-bold text-lg text-slate-800 mb-2">
                                            {t('investments.onboarding.investmentStatus.newInvestor', "I'm Just Starting")}
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            {t('investments.onboarding.investmentStatus.newDesc', "Fresh start! Let's build your first portfolio together.")}
                                        </p>
                                    </button>

                                    {/* Existing Investor Card */}
                                    <button
                                        onClick={() => {
                                            setHasExistingInvestments(true);
                                            setOnboardingStep('goals');
                                        }}
                                        className={`p-6 rounded-2xl border-2 transition-all text-center hover:scale-[1.02] hover:shadow-lg
                                            ${hasExistingInvestments === true
                                                ? 'border-purple-500 bg-purple-50'
                                                : 'border-slate-200 hover:border-purple-300 bg-white'}`}
                                    >
                                        <div className="text-5xl mb-4">📊</div>
                                        <h3 className="font-bold text-lg text-slate-800 mb-2">
                                            {t('investments.onboarding.investmentStatus.hasInvestments', 'I Have Investments')}
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            {t('investments.onboarding.investmentStatus.hasDesc', "Great! We'll help you organize and optimize.")}
                                        </p>
                                    </button>
                                </div>
                            </div>
                        )}
                        {onboardingStep === 'goals' && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-3">
                                        {t('investments.onboarding.step', 'Step {{step}} of 3', { step: 1 })}
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800">
                                        {t('investments.goals.title', 'My Goals')}
                                    </h2>
                                    <p className="text-slate-500 mt-1">
                                        {t('investments.onboarding.welcome.step1Desc', 'What are you saving for?')}
                                    </p>
                                </div>

                                <GoalStudio
                                    userId={userId}
                                    embedded={true}
                                    onGoalsChanged={() => { }}
                                />

                                <div className="flex justify-end pt-4">
                                    <button
                                        onClick={() => setOnboardingStep('stressTest')}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white 
                                            rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
                                    >
                                        {t('common.continue', 'Continue')}
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Onboarding Step: Market Time Machine */}
                        {onboardingStep === 'stressTest' && (
                            <div className="space-y-6">
                                <MarketTimeMachine
                                    userId={userId}
                                    initialAllocation={investmentStrategy.bucketAllocations}
                                    onAllocationChange={(newAllocation) => {
                                        setInvestmentStrategy(prev => ({
                                            ...prev,
                                            bucketAllocations: newAllocation
                                        }));
                                    }}
                                    onComplete={async () => {
                                        // Complete onboarding
                                        try {
                                            await completeOnboarding(userId, riskScore);
                                            setShowOnboarding(false);
                                            setOnboardingStep('complete');
                                        } catch (err) {
                                            console.error('Failed to complete onboarding:', err);
                                            setShowOnboarding(false);
                                        }
                                    }}
                                />

                                <button
                                    onClick={() => setOnboardingStep('goals')}
                                    className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
                                >
                                    ← {t('common.back', 'Back')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Retake Risk Simulator - Full-page flow, mirrors first-time onboarding
                (not nested inside the Strategy tab) so retaking feels like starting fresh */}
            {!showOnboarding && (showRetakeConfirm || isRetakingSimulation) && (
                <div className="min-h-[80vh] bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div className="max-w-2xl mx-auto py-8 px-4">
                        {showRetakeConfirm ? (
                            <div className="bg-white rounded-xl p-6 border border-slate-200 text-center shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">{t('investments.retake.title', 'Are you sure?')}</h3>
                                <p className="text-slate-600 mb-6">
                                    {t('investments.retake.text', 'Retaking the simulation will reset your strategy based on your new choices. Do you want to proceed?')}
                                </p>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setShowRetakeConfirm(false)}
                                        className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowRetakeConfirm(false);
                                            setIsRetakingSimulation(true);
                                        }}
                                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                                    >
                                        {t('investments.retake.confirm', 'Yes, Retake Simulator')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <MarketTimeMachine
                                    key={retakeVersion}
                                    userId={userId}
                                    initialAllocation={investmentStrategy.bucketAllocations}
                                    onAllocationChange={(newAllocation) => {
                                        // Persist the retaken strategy (not just local state) since this
                                        // replaces the user's saved allocation
                                        saveStrategy({
                                            ...investmentStrategy,
                                            bucketAllocations: newAllocation
                                        });
                                    }}
                                    onComplete={async () => {
                                        try {
                                            await completeOnboarding(userId, riskScore);
                                        } catch (err) {
                                            console.error('Failed to complete onboarding:', err);
                                        }
                                        setIsRetakingSimulation(false);
                                        // Force AllocationBuckets to re-sync with the new saved allocations
                                        setRetakeVersion(v => v + 1);
                                    }}
                                />
                                <button
                                    onClick={() => setIsRetakingSimulation(false)}
                                    className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
                                >
                                    {t('investments.retake.cancelSimulation', '← Cancel Simulation')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header and Tabs - Only shown AFTER onboarding, and not while retaking the simulator */}
            {!showOnboarding && !showRetakeConfirm && !isRetakingSimulation && (
                <>
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                            {t('investments.title', 'Investments')}
                        </h1>
                        <p className="text-slate-500 mt-1">{t('investments.subtitle', 'Build towards your financial goals')}</p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === tab.key
                                        ? 'bg-white text-purple-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Tab Content - Only shown AFTER onboarding, and not while retaking the simulator */}
            {!showOnboarding && !showRetakeConfirm && !isRetakingSimulation && (
                <div className="min-h-[400px]">
                    {activeTab === 'goals' && (
                        <div className="space-y-6">
                            {/* Educational Banner */}
                            <LessonBanner
                                lessonKey="goalBased"
                                userId={userId}
                                onLearnMore={() => setActiveTab('strategy')}
                            />

                            <GoalStudio
                                userId={userId}
                                onGoalsChanged={() => {
                                    // Reload profile to get updated allocation
                                    getInvestmentProfile(userId).then(profileData => {
                                        if (profileData.profile?.targetAllocation) {
                                            setInvestmentStrategy(prev => ({
                                                ...prev,
                                                bucketAllocations: {
                                                    long: Math.round((profileData.profile.targetAllocation.long || 0.5) * 100),
                                                    mid: Math.round((profileData.profile.targetAllocation.mid || 0.3) * 100),
                                                    short: Math.round((profileData.profile.targetAllocation.short || 0.2) * 100)
                                                }
                                            }));
                                        }
                                    });
                                }}
                            />
                        </div>
                    )}

                    {activeTab === 'strategy' && (
                        <div className="space-y-8">
                            {/* Removed StrategyPlayground (old income/investment sliders) per user request */}
                            <AllocationBuckets
                                key={retakeVersion}
                                initialAllocations={investmentStrategy.bucketAllocations}
                                initialLocks={investmentStrategy.bucketLocks}
                                onAllocationsChange={handleAllocationsChange}
                                userId={userId}
                                userCurrency={defaultCurrency}
                            />
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={() => setShowRetakeConfirm(true)}
                                    className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-lg transition-colors"
                                >
                                    <History className="w-4 h-4" />
                                    {t('investments.retake.button', 'Retake Risk Simulator')}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'portfolio' && (
                        <PortfolioMapper
                            userId={userId}
                            holdings={holdings}
                            onHoldingsChange={saveHoldings}
                            targetAllocations={investmentStrategy.bucketAllocations}
                            userCurrency={defaultCurrency}
                            currencyRates={currencyRates}
                        />
                    )}

                    {activeTab === 'mission' && (
                        <MonthlyMission
                            holdings={holdings}
                            targetAllocations={investmentStrategy.bucketAllocations}
                            missionPlans={missionPlans}
                            onSavePlan={saveMissionPlan}
                            userCurrency={defaultCurrency}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default InvestmentNode;

