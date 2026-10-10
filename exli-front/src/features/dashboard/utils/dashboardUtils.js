import { DEFAULT_CATEGORIES } from '../../../config/constants';
import React, { createElement } from 'react';
import { Wallet, Upload, PieChart, Settings, Gift, TrendingUp, Users } from 'lucide-react';

/**
 * Shared registry of feature icons, logos, and color palettes matching the main Exli app modules.
 */
export const FEATURE_STYLES = {
  welcome: {
    id: 'welcome',
    name: 'welcome',
    symbol: ({ className = 'w-3.5 h-3.5' } = {}) =>
      createElement('img', {
        src: '/logo.svg',
        alt: 'Exli',
        className: `${className} object-contain`,
      }),
    symbolColor: 'text-emerald-600 bg-emerald-50 border-emerald-200/90',
    dotColor: 'bg-emerald-500',
    unreadBg: 'border-emerald-200/60 bg-emerald-50/30',
  },
  expenses: {
    id: 'import',
    name: 'expenses',
    symbol: Upload,
    symbolColor: 'text-emerald-600 bg-emerald-100/80 border-emerald-200/90',
    dotColor: 'bg-emerald-500',
    unreadBg: 'border-emerald-200/60 bg-emerald-50/30',
  },
  income: {
    id: 'income',
    name: 'income',
    symbol: Wallet,
    symbolColor: 'text-green-600 bg-green-100/80 border-green-200/90',
    dotColor: 'bg-green-500',
    unreadBg: 'border-green-200/60 bg-green-50/30',
  },
  analytics: {
    id: 'analytics',
    name: 'analytics',
    symbol: PieChart,
    symbolColor: 'text-blue-600 bg-blue-100/80 border-blue-200/90',
    dotColor: 'bg-blue-500',
    unreadBg: 'border-blue-200/60 bg-blue-50/30',
  },
  settings: {
    id: 'settings',
    name: 'settings',
    symbol: Settings,
    symbolColor: 'text-slate-600 bg-slate-100/80 border-slate-200/90',
    dotColor: 'bg-slate-500',
    unreadBg: 'border-slate-200/60 bg-slate-50/30',
  },
  wishlist: {
    id: 'wishlist',
    name: 'wishlist',
    symbol: Gift,
    symbolColor: 'text-pink-600 bg-pink-100/80 border-pink-200/90',
    dotColor: 'bg-pink-500',
    unreadBg: 'border-pink-200/60 bg-pink-50/30',
  },
  groups: {
    id: 'groups',
    name: 'groups',
    symbol: Users,
    symbolColor: 'text-indigo-600 bg-indigo-100/80 border-indigo-200/90',
    dotColor: 'bg-indigo-500',
    unreadBg: 'border-indigo-200/60 bg-indigo-50/30',
  },
  investments: {
    id: 'investments',
    name: 'investments',
    symbol: TrendingUp,
    symbolColor: 'text-purple-600 bg-purple-100/80 border-purple-200/90',
    dotColor: 'bg-purple-500',
    unreadBg: 'border-purple-200/60 bg-purple-50/30',
  },
};

/**
 * Utility functions for Dashboard components
 */

/**
 * Extracts the user's first name from the Firebase auth user or Firestore user profile.
 * Falls back gracefully to user email username or empty string.
 *
 * @param {object|null} user - Firebase Auth user object
 * @param {object|null} userProfile - Firestore user profile object
 * @returns {string} First name formatted with initial capitalization
 */
export const extractFirstName = (user, userProfile) => {
  const candidate =
    userProfile?.name ||
    userProfile?.fullName ||
    userProfile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    '';

  const trimmed = String(candidate).trim();
  if (!trimmed) return '';

  // Get the first word
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord) return '';

  // Capitalize first character if Latin, leave as is for non-Latin (e.g., Hebrew)
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
};

/**
 * Formats a given date according to locale with weekday, day, month, and year.
 *
 * @param {Date|string|number} [date=new Date()] - Date to format
 * @param {string} [language='en'] - Language code ('en', 'he', etc.)
 * @param {boolean} [includeWeekday=true] - Whether to include full weekday name
 * @returns {string} Formatted date string
 */
export const formatDashboardDate = (date = new Date(), language = 'en', includeWeekday = true) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const locale = language?.startsWith('he') ? 'he-IL' : 'en-US';

  const options = includeWeekday
    ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric' };

  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (e) {
    console.error('Error formatting dashboard date:', e);
    return d.toLocaleDateString();
  }
};

/**
 * Formats a notification timestamp into a friendly, compact display:
 * - "now" (if added < 5 minutes ago)
 * - "today" (if added earlier today)
 * - date added (e.g. "Sep 25", without time)
 *
 * @param {Date|string|number|object} timestamp - Date, ISO string, Firestore Timestamp, or number
 * @param {object} [options]
 * @param {Function} [options.t] - Translation function
 * @param {string} [options.language='en'] - Language code ('en', 'he')
 * @param {Date} [options.now=new Date()] - Reference date
 * @returns {string} Compact formatted time/date string
 */
export const formatNotificationTime = (timestamp, { t = (k, fb) => fb, language = 'en', now = new Date() } = {}) => {
  if (!timestamp) return '';

  const refNow = now instanceof Date ? now : new Date(now);

  // If already a keyword string
  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim().toLowerCase();
    if (trimmed === 'now') {
      return t('dashboard.mainDashboard.notifications.now', 'now');
    }
    if (trimmed === 'today') {
      return t('dashboard.mainDashboard.notifications.today', 'today');
    }
  }

  // Parse to Date object
  let dateObj = null;
  if (timestamp instanceof Date) {
    dateObj = timestamp;
  } else if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
    dateObj = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    dateObj = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
    } else {
      return timestamp; // Return raw string if unparseable
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) return '';

  const diffMs = refNow.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  const isSameDay =
    dateObj.getFullYear() === refNow.getFullYear() &&
    dateObj.getMonth() === refNow.getMonth() &&
    dateObj.getDate() === refNow.getDate();

  // Within last 5 minutes -> "now"
  if (diffMs >= 0 && diffMins < 5) {
    return t('dashboard.mainDashboard.notifications.now', 'now');
  }

  // Earlier today -> "today"
  if (isSameDay) {
    return t('dashboard.mainDashboard.notifications.today', 'today');
  }

  // Other days -> date added (only date, no time)
  const locale = language?.startsWith('he') ? 'he-IL' : 'en-US';
  const isSameYear = dateObj.getFullYear() === refNow.getFullYear();

  try {
    return dateObj.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      ...(isSameYear ? {} : { year: 'numeric' }),
    });
  } catch (e) {
    return dateObj.toLocaleDateString();
  }
};

/**
 * Net wealth generated from expenses and income, matching AnalyticsNode's lifetime totals.
 * Records can be in different currencies (docs/fx/01-fx-plan.md), so when `fx` ({ sum, defaultCurrency },
 * from useFx()) is given every line is converted to the user's default currency before adding up and
 * anything that cannot be converted is excluded and counted, never added raw. Without `fx` it falls back to
 * the plain single-currency sum in the dominant currency (used by pure callers and tests).
 *
 * @param {Array} expenses - List of expense items
 * @param {Array} income - List of income items
 * @param {{ sum: Function, defaultCurrency: string }} [fx] - Currency conversion from useFx()
 * @returns {{ wealth: number, exp: number, incNet: number, pension: number, currency: string, excludedCount: number }}
 */
export const calculateNetWealth = (expenses = [], income = [], fx) => {
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const safeIncome = Array.isArray(income) ? income : [];

  if (fx && typeof fx.sum === 'function') {
    const { value: exp, excluded: expExcluded } = fx.sum(
      safeExpenses
        .filter((d) => !d.isForecast && !d.isRefund)
        .map((d) => ({ amount: Number(d.amount) || 0, currency: d.currency || 'ILS', date: d.date, month: d.reportMonth }))
    );
    const { value: incNet, excluded: incExcluded } = fx.sum(
      safeIncome.map((d) => ({ amount: Number(d.neto) || 0, currency: d.currency || 'ILS', month: d.month }))
    );
    const { value: pension, excluded: pensionExcluded } = fx.sum(
      safeIncome.map((d) => ({ amount: Number(d.pension) || 0, currency: d.currency || 'ILS', month: d.month }))
    );
    return {
      exp,
      incNet,
      pension,
      wealth: (incNet - exp) + pension,
      currency: fx.defaultCurrency || 'ILS',
      excludedCount: expExcluded.length + incExcluded.length + pensionExcluded.length,
    };
  }

  // Determine dominant currency
  let currency = 'ILS';
  if (safeExpenses.length > 0) {
    const counts = {};
    safeExpenses.forEach(d => {
      const c = d.currency || 'ILS';
      counts[c] = (counts[c] || 0) + 1;
    });
    currency = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), 'ILS');
  }

  // Calculate totals matching AnalyticsNode logic
  const exp = safeExpenses.reduce(
    (acc, curr) => acc + (curr.isForecast || curr.isRefund ? 0 : Number(curr.amount) || 0),
    0
  );
  const incNet = safeIncome.reduce((acc, curr) => acc + (Number(curr.neto) || 0), 0);
  const pension = safeIncome.reduce((acc, curr) => acc + (Number(curr.pension) || 0), 0);
  const wealth = (incNet - exp) + pension;

  return { exp, incNet, pension, wealth, currency, excludedCount: 0 };
};

/**
 * A wishlist item's price in the user's default currency, so it can be compared with the amount saved.
 * Without a converter (or for a price already in the default currency) the plain price is returned;
 * null when the item's currency cannot be converted, which callers treat as "not within budget".
 *
 * @param {object} item - Wishlist item ({ price, currency })
 * @param {Function} [toDefault] - useFx().toDefault
 * @param {string} [defaultCurrency]
 * @returns {number|null}
 */
export const wishlistPriceInDefault = (item, toDefault, defaultCurrency) => {
  const price = Number(item?.price);
  if (!(price > 0)) return 0;
  const currency = item?.currency || 'ILS';
  if (typeof toDefault !== 'function' || !defaultCurrency || currency === defaultCurrency) return price;
  const converted = toDefault({ amount: price, currency });
  return converted.value == null ? null : converted.value;
};

/**
 * Formats a currency amount with thousands separators and optional rounding.
 *
 * @param {number} amount
 * @param {string} currency
 * @param {number} [maxDecimals=0]
 * @param {string} [locale]
 * @returns {string} Formatted string, e.g. "₪12,345"
 */
export const formatCurrencyAmount = (amount = 0, currency = 'ILS', maxDecimals = 0, locale) => {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: maxDecimals }).format(num);
  } catch (e) {
    return `${currency} ${num.toLocaleString(locale, { maximumFractionDigits: maxDecimals })}`;
  }
};

/**
 * Checks whether an expense or income record belongs to a specific calendar month (format: 'YYYY-MM').
 * IMPORTANT: The check is ONLY based on the calendar month Exli identified for the record
 * (such as reportMonth, month, pay_month, or the transaction date).
 * Upload timestamps (e.g. createdAt) are strictly ignored, ensuring that an expense sheet
 * or payslip for March uploaded in August is recognized strictly as March data.
 *
 * @param {object} item - Expense or income record
 * @param {string} targetMonthKey - Target month formatted as 'YYYY-MM'
 * @returns {boolean}
 */
export const matchesCalendarMonth = (item, targetMonthKey) => {
  if (!item || item.isForecast) return false;

  // 1. Explicit calendar month identified by Exli (e.g. "2026-03")
  const identifiedMonth = item.reportMonth || item.month || item.pay_month;
  if (identifiedMonth) {
    const str = String(identifiedMonth).trim();
    if (str.startsWith(targetMonthKey)) return true;
    const match = str.match(/^(\d{4})[-/](\d{1,2})/);
    if (match) {
      const normalized = `${match[1]}-${match[2].padStart(2, '0')}`;
      if (normalized === targetMonthKey) return true;
    }
  }

  // 2. Transaction date identified within the sheet or statement
  if (item.date) {
    if (typeof item.date === 'string') {
      const str = item.date.trim();
      if (str.startsWith(targetMonthKey)) return true;
      // Handle YYYY-MM or YYYY/MM prefix
      const match = str.match(/^(\d{4})[-/](\d{1,2})/);
      if (match) {
        const normalized = `${match[1]}-${match[2].padStart(2, '0')}`;
        if (normalized === targetMonthKey) return true;
      }
      // Handle DD/MM/YYYY or DD-MM-YYYY format
      const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (dmyMatch) {
        const normalized = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}`;
        if (normalized === targetMonthKey) return true;
      }
    } else if (item.date instanceof Date && !isNaN(item.date.getTime())) {
      const year = item.date.getFullYear();
      const month = String(item.date.getMonth() + 1).padStart(2, '0');
      if (`${year}-${month}` === targetMonthKey) return true;
    }
  }

  return false;
};

/**
 * Safely parses any date/timestamp representation into a numeric timestamp in milliseconds.
 *
 * @param {Date|string|number|object} val
 * @returns {number} Timestamp in ms, or 0 if unparseable
 */
export const parseTimestampToTime = (val) => {
  if (!val) return 0;
  if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime();
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : 0;
    } catch (e) { }
  }
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return val.seconds * 1000;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'now') return Date.now();
    if (trimmed === 'today') return Date.now() - 3600000;
    const d = new Date(val);
    const t = d.getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

// Storage key and in-memory cache for tracking wealth and wishlist budget entry states
const WEALTH_TRACKER_KEY = 'exli_dashboard_wealth_tracker';
const memoryWealthState = {};

export const getWealthTracker = (userId = 'guest') => {
  try {
    if (typeof window !== 'undefined' && window?.localStorage) {
      const raw = localStorage.getItem(`${WEALTH_TRACKER_KEY}_${userId}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) { }
  return memoryWealthState[userId] || null;
};

export const saveWealthTracker = (userId = 'guest', state) => {
  try {
    if (typeof window !== 'undefined' && window?.localStorage) {
      localStorage.setItem(`${WEALTH_TRACKER_KEY}_${userId}`, JSON.stringify(state));
    }
  } catch (e) { }
  memoryWealthState[userId] = state;
};

/**
 * Checks whether the user has remaining settings information to fill in their profile section.
 * Returns true if any standard profile field (name, birthdate, family status, career, country, city)
 * has not been completed yet.
 *
 * @param {object|null} userProfile - User profile object
 * @param {object|null} user - Auth user object
 * @returns {boolean}
 */
export const getMissingProfileFields = (userProfile, user) => {
  if (!userProfile && !user) return [];

  const p = userProfile?.profile || userProfile || {};

  // If explicit completion flag exists, profile is considered complete
  if (p.hasCompletedProfile || userProfile?.hasCompletedProfile) {
    return [];
  }

  const hasName = Boolean(
    (p.name && String(p.name).trim()) ||
    (p.fullName && String(p.fullName).trim()) ||
    (p.displayName && String(p.displayName).trim()) ||
    (user?.displayName && String(user.displayName).trim())
  );
  const hasBirthdate = Boolean(p.birthdate && String(p.birthdate).trim());
  const hasStatus = Boolean(p.status && String(p.status).trim());
  const hasCareer = Boolean(
    (Array.isArray(p.occupations) && p.occupations.length > 0) ||
    (Array.isArray(p.workplaces) && p.workplaces.length > 0) ||
    (p.occupation && String(p.occupation).trim())
  );
  const hasCountry = Boolean(p.country && String(p.country).trim());
  const hasCity = Boolean(p.city && String(p.city).trim());
  const hasUniversity = !p.isStudent || Boolean(p.university && String(p.university).trim());

  return [
    !hasName && 'name',
    !hasBirthdate && 'birthdate',
    !hasStatus && 'status',
    !hasCareer && 'career',
    !hasCountry && 'country',
    !hasCity && 'city',
    !hasUniversity && 'university',
  ].filter(Boolean);
};

/** Whether any Settings profile field is still empty (see getMissingProfileFields). */
export const hasRemainingProfileSettings = (userProfile, user) =>
  getMissingProfileFields(userProfile, user).length > 0;

/**
 * Checks whether the current user is a newly created account.
 * Existing accounts return false so they will never see the welcome notification.
 *
 * @param {object|null} user - Firebase Auth user object
 * @param {object|null} userProfile - User profile object
 * @returns {boolean}
 */
export const isNewAccount = (user, userProfile) => {
  if (!user && !userProfile) return false;

  // Developer override for manual testing
  if (typeof window !== 'undefined' && window?.localStorage?.getItem('exli_force_welcome_notification') === 'true') {
    return true;
  }

  // Explicit flag in user document (set during onboarding for new accounts)
  if (userProfile?.isNewAccount === true || userProfile?.profile?.isNewAccount === true) {
    return true;
  }

  return false;
};

/**
 * Detects if the monthly payday or charge day has arrived and whether the user has
 * uploaded their payslip or expense sheet for the current monthly cycle, or if
 * remaining profile settings need to be filled.
 *
 * @param {object} params
 * @param {object|null} params.user - Firebase Auth user object
 * @param {object|null} params.userProfile - User profile containing monthlyPayday and monthlyChargeDay
 * @param {Array} params.expenses - List of expenses
 * @param {Array} params.income - List of income records
 * @param {Array} [params.wishlist] - List of wishlist items
 * @param {number} [params.amountSaved] - Precalculated net wealth / amount saved
 * @param {number} [params.previousAmountSaved] - Previous amount saved for detecting increases
 * @param {Date|string} [params.date=new Date()] - Reference date (defaults to now)
 * @param {Function} [params.t] - Translation function
 * @param {Function} [params.onNavigateIncome] - Callback to navigate to Income / Payslip manager
 * @param {Function} [params.onNavigateExpenses] - Callback to navigate to Expense / Statement manager
 * @param {Function} [params.onNavigateWishlist] - Callback to navigate to Wishlist manager
 * @param {Function} [params.onNavigateSettings] - Callback to navigate to Settings / Profile manager
 * @param {Function} [params.toDefault] - useFx().toDefault, to compare wishlist prices in the default currency
 * @param {string} [params.defaultCurrency] - The user's default currency
 * @param {Array<object>} [params.groupNotifications] - Ready-made notification items for groups
 *   (see buildGroupNotifications); they join the same feed, dismissal and ordering as everything else
 * @returns {Array<object>} List of notification items to display
 */
export const detectCycleReminders = ({
  user,
  userProfile,
  expenses = [],
  income = [],
  wishlist = [],
  amountSaved,
  previousAmountSaved,
  date = new Date(),
  t = (key, fallback) => fallback,
  onNavigateIncome,
  onNavigateExpenses,
  onNavigateWishlist,
  onNavigateSettings,
  toDefault,
  defaultCurrency,
  groupNotifications = [],
}) => {
  const notifications = [];
  const refDate = date instanceof Date ? date : new Date(date);
  if (isNaN(refDate.getTime())) return notifications;

  // 0. Welcome to Exli Notification:
  // Shows at the top of the feed when starting a new account (never for existing accounts)
  if (isNewAccount(user, userProfile)) {
    notifications.push({
      id: 'welcome_to_exli',
      feature: 'welcome',
      isPinned: true,
      symbol: FEATURE_STYLES.welcome.symbol,
      symbolColor: FEATURE_STYLES.welcome.symbolColor,
      dotColor: FEATURE_STYLES.welcome.dotColor,
      unreadBg: FEATURE_STYLES.welcome.unreadBg,
      text: getNotificationText(
        'dashboard.mainDashboard.notifications.welcomeNotification',
        'Welcome to Exli!'
      ),
      createdAt: refDate,
      unread: true,
    });
  }

  const currentDay = refDate.getDate();
  const currentYear = refDate.getFullYear();
  const currentMonthNum = refDate.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const monthlyPayday = Number(userProfile?.monthlyPayday) || 10;
  const monthlyChargeDay = Number(userProfile?.monthlyChargeDay) || 10;

  // Localized month name (e.g. "March", "מרץ")
  const monthKeys = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthKey = monthKeys[currentMonthNum - 1];

  let monthName;
  try {
    const localized = t(`datePicker.months.${monthKey}`);
    if (localized && typeof localized === 'string' && localized !== `datePicker.months.${monthKey}`) {
      monthName = localized;
    }
  } catch (e) { }

  if (!monthName) {
    try {
      monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(refDate);
    } catch (e) {
      monthName = monthKey;
    }
  }

  // A function declaration (hoisted) so the welcome notification above can use it too.
  function getNotificationText(key, defaultText, interpolation = {}) {
    try {
      const res = t(key, { ...interpolation, defaultValue: defaultText });
      if (typeof res === 'string') return res;
      if (res && typeof res === 'object' && res.defaultValue) return res.defaultValue;
    } catch (e) { }
    let str = defaultText;
    Object.entries(interpolation).forEach(([k, v]) => {
      str = str.replace(new RegExp(`{{${k}}}`, 'g'), v);
    });
    return str;
  }

  const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();
  const paydayDate = new Date(currentYear, currentMonthNum - 1, Math.min(monthlyPayday, daysInMonth));
  const chargeDate = new Date(currentYear, currentMonthNum - 1, Math.min(monthlyChargeDay, daysInMonth));

  // 1. Payday Check: Has payday arrived this month?
  if (currentDay >= monthlyPayday) {
    const hasIncomeThisMonth = (Array.isArray(income) ? income : []).some(item =>
      matchesCalendarMonth(item, currentMonthKey)
    );

    if (!hasIncomeThisMonth) {
      notifications.push({
        id: `payday_reminder_${currentMonthKey}`,
        feature: 'income',
        symbol: FEATURE_STYLES.income.symbol,
        symbolColor: FEATURE_STYLES.income.symbolColor,
        dotColor: FEATURE_STYLES.income.dotColor,
        unreadBg: FEATURE_STYLES.income.unreadBg,
        text: getNotificationText(
          'dashboard.mainDashboard.notifications.paydayReminder',
          `Income sheet for ${monthName} hasn't been uploaded yet`,
          { month: monthName }
        ),
        createdAt: paydayDate,
        unread: true,
        onClick: onNavigateIncome,
      });
    }
  }

  // 2. Charge Day Check: Has charge day arrived this month?
  if (currentDay >= monthlyChargeDay) {
    const hasExpensesThisMonth = (Array.isArray(expenses) ? expenses : []).some(item =>
      matchesCalendarMonth(item, currentMonthKey)
    );

    if (!hasExpensesThisMonth) {
      notifications.push({
        id: `charge_day_reminder_${currentMonthKey}`,
        feature: 'expenses',
        symbol: FEATURE_STYLES.expenses.symbol,
        symbolColor: FEATURE_STYLES.expenses.symbolColor,
        dotColor: FEATURE_STYLES.expenses.dotColor,
        unreadBg: FEATURE_STYLES.expenses.unreadBg,
        text: getNotificationText(
          'dashboard.mainDashboard.notifications.chargeDayReminder',
          `Expense sheet for ${monthName} hasn't been uploaded yet`,
          { month: monthName }
        ),
        createdAt: chargeDate,
        unread: true,
        onClick: onNavigateExpenses,
      });
    }
  }

  // 3. Wishlist Check:
  // - If new wishlist items are added one after another, and they are both within budget instantly:
  //   they show as separate "new {single} item within budget" notifications.
  // - If the amount saved was increased, and more than one item entered budget:
  //   it shows the plural message without specifying the exact count.
  const netWealth = typeof amountSaved === 'number'
    ? amountSaved
    : calculateNetWealth(expenses, income).wealth;

  const safeWishlist = Array.isArray(wishlist) ? wishlist : [];
  const affordableWishlistItems = safeWishlist.filter((item) => {
    const price = wishlistPriceInDefault(item, toDefault, defaultCurrency);
    return price != null && price > 0 && price <= netWealth;
  });

  const effectiveUserId = user?.uid || userProfile?.uid || userProfile?.id || 'guest';
  const tracker = getWealthTracker(effectiveUserId) || { lastAmountSaved: undefined, items: {} };
  const currentTrackerItems = { ...(tracker.items || {}) };

  // Determine previous wealth to detect real increases
  let prevWealth = typeof previousAmountSaved === 'number'
    ? previousAmountSaved
    : tracker.lastAmountSaved;

  // Real wealth increase ONLY occurs if we had a prior positive wealth level that was exceeded.
  // Transition from 0 or undefined during initial load is NOT a wealth increase event.
  const isWealthIncreased = typeof prevWealth === 'number' && prevWealth > 0 && netWealth > prevWealth;
  const increaseBatchId = isWealthIncreased ? `increase_${Date.now()}` : null;

  // Only remove items from tracker if they were actually deleted from the wishlist
  if (safeWishlist.length > 0) {
    const existingWishlistIds = new Set(safeWishlist.map((it) => String(it.id || it._id || it.name)));
    Object.keys(currentTrackerItems).forEach((id) => {
      if (!existingWishlistIds.has(id)) {
        delete currentTrackerItems[id];
      }
    });
  }

  const itemsEnteredDueToWealthIncrease = [];
  const itemsAddedWithinBudget = [];

  affordableWishlistItems.forEach((item) => {
    const itemId = String(item.id || item._id || item.name);
    let itemRecord = currentTrackerItems[itemId];

    if (!itemRecord) {
      // New item entering affordable state
      const wasUnaffordableBefore =
        isWealthIncreased && typeof prevWealth === 'number' && prevWealth > 0 &&
        wishlistPriceInDefault(item, toDefault, defaultCurrency) > prevWealth;

      if (wasUnaffordableBefore) {
        itemRecord = {
          reason: 'wealth_increase',
          batchId: increaseBatchId,
          enteredAt: refDate,
        };
      } else {
        itemRecord = {
          reason: 'added_within_budget',
          enteredAt: item.dateAdded || item.createdAt || refDate,
        };
      }
      currentTrackerItems[itemId] = itemRecord;
    }

    if (itemRecord.reason === 'wealth_increase') {
      itemsEnteredDueToWealthIncrease.push({ item, record: itemRecord });
    } else {
      itemsAddedWithinBudget.push({ item, record: itemRecord });
    }
  });

  // Save updated tracker state (only when non-empty data is available)
  if (netWealth > 0 || expenses.length > 0 || income.length > 0) {
    saveWealthTracker(effectiveUserId, {
      lastAmountSaved: netWealth,
      items: currentTrackerItems,
    });
  }

  // 1. Items that entered budget due to wealth increase:
  // If more than one entered budget at once -> plural message
  if (itemsEnteredDueToWealthIncrease.length > 1) {
    const latestTime = itemsEnteredDueToWealthIncrease.reduce((latest, { item, record }) => {
      const t = parseTimestampToTime(record.enteredAt || item.dateAdded || item.createdAt);
      return t > parseTimestampToTime(latest) ? (record.enteredAt || item.dateAdded || item.createdAt) : latest;
    }, refDate);

    notifications.push({
      id: 'wishlist_multiple_budget',
      feature: 'wishlist',
      symbol: FEATURE_STYLES.wishlist.symbol,
      symbolColor: FEATURE_STYLES.wishlist.symbolColor,
      dotColor: FEATURE_STYLES.wishlist.dotColor,
      unreadBg: FEATURE_STYLES.wishlist.unreadBg,
      text: getNotificationText(
        'dashboard.mainDashboard.notifications.wishlistMultipleItemsWithinBudget',
        'New wishlist items are within budget!'
      ),
      createdAt: latestTime,
      unread: true,
      onClick: onNavigateWishlist,
    });
  } else if (itemsEnteredDueToWealthIncrease.length === 1) {
    const { item, record } = itemsEnteredDueToWealthIncrease[0];
    notifications.push({
      id: `wishlist_single_budget_${item.id || 'item'}`,
      feature: 'wishlist',
      symbol: FEATURE_STYLES.wishlist.symbol,
      symbolColor: FEATURE_STYLES.wishlist.symbolColor,
      dotColor: FEATURE_STYLES.wishlist.dotColor,
      unreadBg: FEATURE_STYLES.wishlist.unreadBg,
      text: getNotificationText(
        'dashboard.mainDashboard.notifications.wishlistSingleItemWithinBudget',
        'A new wishlist item is within budget!'
      ),
      createdAt: record.enteredAt || item.dateAdded || item.createdAt || refDate,
      unread: true,
      onClick: onNavigateWishlist,
    });
  }

  // 2. Items added one after another within budget instantly:
  // Each displays as its own single notification
  const sortedAddedWithinBudget = [...itemsAddedWithinBudget].sort((a, b) => {
    const ta = parseTimestampToTime(a.record.enteredAt || a.item.dateAdded || a.item.createdAt);
    const tb = parseTimestampToTime(b.record.enteredAt || b.item.dateAdded || b.item.createdAt);
    return tb - ta;
  });

  sortedAddedWithinBudget.forEach(({ item, record }) => {
    notifications.push({
      id: `wishlist_single_budget_${item.id || 'item'}`,
      feature: 'wishlist',
      symbol: FEATURE_STYLES.wishlist.symbol,
      symbolColor: FEATURE_STYLES.wishlist.symbolColor,
      dotColor: FEATURE_STYLES.wishlist.dotColor,
      unreadBg: FEATURE_STYLES.wishlist.unreadBg,
      text: getNotificationText(
        'dashboard.mainDashboard.notifications.wishlistSingleItemWithinBudget',
        'A new wishlist item is within budget!'
      ),
      createdAt: record.enteredAt || item.dateAdded || item.createdAt || refDate,
      unread: true,
      onClick: onNavigateWishlist,
    });
  });

  // 4. Settings Profile Completion Check:
  // Prompts user to fill remaining settings information from the profile section if not done before
  const missingProfileFields = getMissingProfileFields(userProfile, user);
  if (missingProfileFields.length > 0) {
    const fields = missingProfileFields
      .map((field) => getNotificationText(`dashboard.mainDashboard.notifications.profileFields.${field}`, field))
      .join(', ');
    notifications.push({
      id: 'settings_profile_reminder',
      feature: 'settings',
      symbol: FEATURE_STYLES.settings.symbol,
      symbolColor: FEATURE_STYLES.settings.symbolColor,
      dotColor: FEATURE_STYLES.settings.dotColor,
      unreadBg: FEATURE_STYLES.settings.unreadBg,
      text: getNotificationText(
        'dashboard.mainDashboard.notifications.settingsProfileMissing',
        `Complete your profile in Settings: ${fields}`,
        { fields }
      ),
      createdAt: refDate,
      unread: true,
      onClick: onNavigateSettings,
    });
  }

  // 5. Group notifications (join requests, payments received, balances), built by buildGroupNotifications
  notifications.push(...(Array.isArray(groupNotifications) ? groupNotifications : []));

  // Sort notifications newest first (descending by timestamp), with pinned items always on top
  return notifications.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const ta = parseTimestampToTime(a.createdAt || a.timestamp || a.date || a.addedAt || a.time);
    const tb = parseTimestampToTime(b.createdAt || b.timestamp || b.date || b.addedAt || b.time);
    return tb - ta;
  });
};

/**
 * Display name of a stored category: the built-in categories (and "Uncategorized") are translated,
 * a user's own custom category is shown as typed.
 *
 * @param {string} name - Stored category name (assignedCategory)
 * @param {Function} t - i18next t
 */
export const getCategoryLabel = (name, t) => {
  if (name === 'Uncategorized') return t('categories.uncategorized', 'Uncategorized');
  const builtIn = DEFAULT_CATEGORIES.find((c) => c.name === name);
  return builtIn ? t(`categories.${builtIn.id}`, name) : name;
};
