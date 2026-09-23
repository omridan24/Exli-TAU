/**
 * Investment Profile Service
 * 
 * Handles all API calls for the Goal-Based Robo-Advisor:
 * - Goals CRUD
 * - Risk Profile
 * - Allocation Recalculation
 */

import { CLOUD_RUN_URL } from './firebase';

const API_BASE = CLOUD_RUN_URL;

// ============================================
// GOALS API
// ============================================

/**
 * Save a financial goal
 * Auto-assigns to bucket based on deadline (Short: 0-3y, Mid: 3-10y, Long: 10+y)
 */
export const saveGoal = async (userId, goal) => {
    const response = await fetch(`${API_BASE}/investments/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goal })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save goal');
    }

    return response.json();
};

/**
 * Get all goals for a user, grouped by bucket
 */
export const getGoals = async (userId) => {
    const response = await fetch(`${API_BASE}/investments/goals/${userId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch goals');
    }

    return response.json();
};

/**
 * Delete a goal and recalculate allocation
 */
export const deleteGoal = async (userId, goalId) => {
    const response = await fetch(`${API_BASE}/investments/goals/${userId}/${goalId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete goal');
    }

    return response.json();
};

// ============================================
// INVESTMENT PROFILE API
// ============================================

/**
 * Save user's investment profile (risk tolerance, stress test results)
 */
export const saveInvestmentProfile = async (userId, profileData) => {
    const response = await fetch(`${API_BASE}/investments/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...profileData })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save profile');
    }

    return response.json();
};

/**
 * Get user's investment profile including goals and allocation
 */
export const getInvestmentProfile = async (userId) => {
    const response = await fetch(`${API_BASE}/investments/profile/${userId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch profile');
    }

    return response.json();
};

/**
 * Mark onboarding as complete
 */
export const completeOnboarding = async (userId) => {
    return saveInvestmentProfile(userId, { onboardingComplete: true });
};

// ============================================
// ALLOCATION API
// ============================================

/**
 * Manually trigger allocation recalculation
 */
export const recalculateAllocation = async (userId) => {
    const response = await fetch(`${API_BASE}/investments/recalculate/${userId}`, {
        method: 'POST'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to recalculate allocation');
    }

    return response.json();
};

// ============================================
// GOAL PRESETS
// ============================================

/**
 * Preset goal configurations for quick selection
 */
export const GOAL_PRESETS = {
    wedding: {
        name: 'Wedding',
        icon: '💍',
        estimateRanges: {
            budget: { amount: 80000, label: 'Budget' },
            standard: { amount: 120000, label: 'Standard' },
            luxe: { amount: 180000, label: 'Luxe' }
        },
        defaultYears: 2
    },
    house: {
        name: 'House Down Payment',
        icon: '🏠',
        estimateRanges: {
            budget: { amount: 200000, label: 'Starter Home' },
            standard: { amount: 400000, label: 'Family Home' },
            luxe: { amount: 800000, label: 'Dream Home' }
        },
        defaultYears: 5
    },
    baby: {
        name: 'Baby Fund',
        icon: '👶',
        estimateRanges: {
            budget: { amount: 30000, label: 'Essentials' },
            standard: { amount: 50000, label: 'Comfortable' },
            luxe: { amount: 80000, label: 'All Covered' }
        },
        defaultYears: 2
    },
    education: {
        name: 'Education',
        icon: '🎓',
        estimateRanges: {
            budget: { amount: 50000, label: 'Local' },
            standard: { amount: 150000, label: 'Private' },
            luxe: { amount: 300000, label: 'International' }
        },
        defaultYears: 8
    },
    retirement: {
        name: 'Early Retirement',
        icon: '🏖️',
        estimateRanges: {
            budget: { amount: 1000000, label: 'Modest' },
            standard: { amount: 2500000, label: 'Comfortable' },
            luxe: { amount: 5000000, label: 'Luxurious' }
        },
        defaultYears: 15
    },
    car: {
        name: 'New Car',
        icon: '🚗',
        estimateRanges: {
            budget: { amount: 80000, label: 'Reliable' },
            standard: { amount: 150000, label: 'Comfort' },
            luxe: { amount: 300000, label: 'Luxury' }
        },
        defaultYears: 3
    },
    travel: {
        name: 'Dream Vacation',
        icon: '✈️',
        estimateRanges: {
            budget: { amount: 15000, label: 'Adventure' },
            standard: { amount: 30000, label: 'Explorer' },
            luxe: { amount: 60000, label: 'Luxury' }
        },
        defaultYears: 1
    },
    emergency: {
        name: 'Emergency Fund',
        icon: '🛡️',
        estimateRanges: {
            budget: { amount: 30000, label: '3 Months' },
            standard: { amount: 60000, label: '6 Months' },
            luxe: { amount: 120000, label: '12 Months' }
        },
        defaultYears: 1
    }
};

/**
 * Bucket information with human-friendly descriptions
 */
export const BUCKET_INFO = {
    short: {
        name: 'Short Term',
        timeRange: '0-3 years',
        description: "Can't risk a crash before you need it",
        riskLevel: 'Low',
        color: 'emerald',
        icon: '🛡️'
    },
    mid: {
        name: 'Mid Range',
        timeRange: '3-10 years',
        description: 'Balanced mix of growth and stability',
        riskLevel: 'Medium',
        color: 'blue',
        icon: '⚓'
    },
    long: {
        name: 'Long Range',
        timeRange: '10+ years',
        description: 'Maximum growth potential over time',
        riskLevel: 'High',
        color: 'purple',
        icon: '🚀'
    }
};
