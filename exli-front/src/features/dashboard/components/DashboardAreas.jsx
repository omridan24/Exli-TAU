import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardStatusPanel } from './DashboardStatusPanel';
import { DashboardNotificationsArea } from './DashboardNotificationsArea';
import { calculateNetWealth, detectCycleReminders } from '../utils/dashboardUtils';
import { buildGroupNotifications } from '../utils/groupNotifications';
import { useGroupNotificationData } from '../hooks/useGroupNotificationData';
import { useFx } from '../../../lib/fx/useFx';

/**
 * DashboardAreas
 * Organizes the dashboard into a responsive 2-column layout:
 * - Left: Status (amount saved + live facts about spending, savings, investments, wishlist) (2.2fr)
 * - Right: Notifications (reminders, group balances, wishlist updates) (1fr)
 */
export const DashboardAreas = ({
  user,
  expenses = [],
  income = [],
  wishlist = [],
  notifications,
  amountSaved,
  onNavigateAnalytics,
  onNavigateWishlist,
  onNavigateNotifications,
  onNavigateIncome,
  onNavigateExpenses,
  onNavigateSettings,
  onNavigateGroup,
  onNavigateInvestments,
  userProfile,
  date,
  statusContent,
  notificationsContent,
  statusProps = {},
  notificationsProps = {},
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  // Amounts can be in different currencies: everything is converted to the user's default currency
  // before adding up (docs/fx/01-fx-plan.md), exactly like AnalyticsNode's lifetime totals.
  const { sum, toDefault, defaultCurrency, dataVersion } = useFx();
  const fx = useMemo(() => ({ sum, defaultCurrency }), [sum, defaultCurrency]);
  // dataVersion: fx rates can finish loading after the first render (see useFx.js)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const calculated = useMemo(() => calculateNetWealth(expenses, income, fx), [expenses, income, fx, dataVersion]);
  const { groups, payments } = useGroupNotificationData(user?.uid);
  const currentAmountSaved = typeof amountSaved === 'number' ? amountSaved : calculated.wealth;

  // Track if financial data has finished initial load
  const isDataLoaded = typeof amountSaved === 'number' || expenses.length > 0 || income.length > 0;
  const prevAmountSavedRef = useRef();

  const groupNotifications = useMemo(
    () => buildGroupNotifications({
      groups,
      payments,
      userId: user?.uid,
      t,
      language: i18n.language,
      toDefault,
      defaultCurrency,
      onNavigateGroup,
    }),
    // dataVersion: the approximate default-currency totals depend on rates that load in the background
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, payments, user?.uid, t, i18n.language, toDefault, defaultCurrency, onNavigateGroup, dataVersion]
  );

  // Auto-detect payday / charge day cycle reminders, wishlist notifications, and profile settings reminders if notifications not explicitly passed
  const resolvedNotifications = useMemo(() => {
    if (notifications !== undefined) return notifications;
    // Only pass previous wealth if we have a valid previous loaded state
    const prevWealth = isDataLoaded ? prevAmountSavedRef.current : undefined;
    return detectCycleReminders({
      user,
      userProfile,
      expenses,
      income,
      wishlist,
      amountSaved: currentAmountSaved,
      previousAmountSaved: prevWealth,
      date,
      t,
      onNavigateIncome,
      onNavigateExpenses,
      onNavigateWishlist,
      onNavigateSettings,
      toDefault,
      defaultCurrency,
      groupNotifications,
    });
  }, [
    notifications,
    user,
    userProfile,
    expenses,
    income,
    wishlist,
    currentAmountSaved,
    isDataLoaded,
    date,
    t,
    onNavigateIncome,
    onNavigateExpenses,
    onNavigateWishlist,
    onNavigateSettings,
    toDefault,
    defaultCurrency,
    groupNotifications,
  ]);

  useEffect(() => {
    if (isDataLoaded) {
      prevAmountSavedRef.current = currentAmountSaved;
    }
  }, [currentAmountSaved, isDataLoaded]);

  // Persist dismissed notifications per user in localStorage
  const effectiveUserId = user?.uid || userProfile?.uid || userProfile?.id || 'guest';
  const dismissedStorageKey = `exli_dismissed_notifications_${effectiveUserId}`;

  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window?.localStorage) {
        const saved = localStorage.getItem(dismissedStorageKey);
        if (saved) return new Set(JSON.parse(saved));
      }
    } catch (e) {}
    return new Set();
  });

  const handleDismissNotification = (notifId) => {
    setDismissedNotificationIds((prev) => {
      const next = new Set(prev);
      next.add(notifId);
      try {
        if (typeof window !== 'undefined' && window?.localStorage) {
          localStorage.setItem(dismissedStorageKey, JSON.stringify([...next]));
        }
      } catch (e) {}
      return next;
    });
  };

  const activeNotifications = useMemo(() => {
    if (!resolvedNotifications) return resolvedNotifications;
    return resolvedNotifications.filter((n) => {
      const id = n.id || n.key || n.text;
      return !dismissedNotificationIds.has(id);
    });
  }, [resolvedNotifications, dismissedNotificationIds]);

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[2.2fr_1fr] gap-4 w-full items-stretch ${className}`}
    >
      {/* Left: Status */}
      <DashboardStatusPanel
        className="h-full"
        userId={user?.uid}
        expenses={expenses}
        income={income}
        wishlist={wishlist}
        amount={currentAmountSaved}
        currency={defaultCurrency}
        date={date}
        subtitle={calculated.excludedCount > 0
          ? t('dashboard.mainDashboard.amountSavedExcluded', { count: calculated.excludedCount, defaultValue: '{{count}} items without an exchange rate are not included' })
          : undefined}
        onNavigateAnalytics={onNavigateAnalytics}
        onNavigateWishlist={onNavigateWishlist}
        onNavigateInvestments={onNavigateInvestments}
        {...statusProps}
      >
        {statusContent}
      </DashboardStatusPanel>

      {/* Right: Notifications */}
      <DashboardNotificationsArea
        className="h-full"
        notifications={activeNotifications}
        onNotificationClick={onNavigateNotifications}
        onDismissNotification={handleDismissNotification}
        {...notificationsProps}
      >
        {notificationsContent}
      </DashboardNotificationsArea>
    </div>
  );
};

export default DashboardAreas;
