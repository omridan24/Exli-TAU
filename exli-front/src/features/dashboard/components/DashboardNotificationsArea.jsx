import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { DashboardArea } from './DashboardArea';
import { DashboardPlaceholder } from './DashboardPlaceholder';
import { DashboardNotificationRow } from './DashboardNotificationRow';
import { parseTimestampToTime } from '../utils/dashboardUtils';

/**
 * DashboardNotificationsArea
 * Right area of the dashboard for alerts, reminders, and notifications.
 * Features a notification count badge on the top right of the header row,
 * and renders slim generic notification row(s).
 */
export const DashboardNotificationsArea = ({
  title,
  subtitle,
  notifications,
  badge,
  badgeColor,
  onNotificationClick,
  onDismissNotification,
  children,
  className = '',
  ...rest
}) => {
  const { t } = useTranslation();

  const areaTitle = title || t('dashboard.mainDashboard.areas.notifications', 'Notifications');
  const areaSubtitle = subtitle;
  const placeholderText = t('dashboard.mainDashboard.notifications.empty', 'All caught up');

  const [localDismissedIds, setLocalDismissedIds] = useState(new Set());

  const handleDismiss = (notifId) => {
    if (onDismissNotification) {
      onDismissNotification(notifId);
    }
    setLocalDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(notifId);
      return next;
    });
  };

  const hasNotificationsList = Array.isArray(notifications);

  // Filter out any dismissed notifications
  const activeNotifications = useMemo(() => {
    if (!hasNotificationsList) return [];
    return notifications.filter((n) => {
      const id = n.id || n.key || n.text;
      return !localDismissedIds.has(id);
    });
  }, [notifications, hasNotificationsList, localDismissedIds]);

  const showPlaceholder = hasNotificationsList && activeNotifications.length === 0;

  // Badge count calculation for top-right header row
  const resolvedBadge =
    badge !== undefined
      ? badge
      : hasNotificationsList
      ? activeNotifications.length > 0
        ? activeNotifications.length
        : undefined
      : 1;

  const resolvedBadgeColor =
    badgeColor || 'bg-amber-100/90 text-amber-800 border-amber-200/90';

  // Ensure newest notifications appear at the top of the feed, with pinned items on top
  const sortedNotifications = useMemo(() => {
    return [...activeNotifications].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ta = parseTimestampToTime(a.createdAt || a.timestamp || a.date || a.addedAt || a.time);
      const tb = parseTimestampToTime(b.createdAt || b.timestamp || b.date || b.addedAt || b.time);
      return tb - ta;
    });
  }, [activeNotifications]);

  return (
    <DashboardArea
      title={areaTitle}
      subtitle={areaSubtitle}
      icon={Bell}
      iconColor="text-amber-600 bg-amber-50/90 border-amber-100"
      badge={resolvedBadge}
      badgeColor={resolvedBadgeColor}
      className={className}
      {...rest}
    >
      {children ||
        (showPlaceholder ? (
          <DashboardPlaceholder
            compact
            icon={Bell}
            title={placeholderText}
            subtitle=""
          />
        ) : (
          // The list fills whatever height the Status panel next to it sets (it adds no height of its own)
          // and scrolls when there are more notifications than fit.
          <div className="relative flex-1 min-h-[150px] w-full">
            <div className="absolute inset-0 flex flex-col gap-1 overflow-y-auto pe-0.5 scrollbar-thin">
            {hasNotificationsList ? (
              sortedNotifications.map((notif, idx) => {
                const notifId = notif.id || notif.key || notif.text || idx;
                return (
                  <DashboardNotificationRow
                    key={notifId}
                    {...notif}
                    onClick={
                      notif.onClick ||
                      (onNotificationClick ? () => onNotificationClick(notif) : undefined)
                    }
                    onDismiss={notif.onDismiss || (() => handleDismiss(notifId))}
                  />
                );
              })
            ) : (
              <DashboardNotificationRow
                text={t('dashboard.mainDashboard.notifications.placeholder', 'Notification message')}
                time={t('dashboard.mainDashboard.notifications.today', 'Today')}
              />
            )}
            </div>
          </div>
        ))}
    </DashboardArea>
  );
};

export default DashboardNotificationsArea;
