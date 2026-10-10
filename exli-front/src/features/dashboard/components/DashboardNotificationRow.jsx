import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronRight, Check } from 'lucide-react';
import { FEATURE_STYLES, formatNotificationTime } from '../utils/dashboardUtils';

/**
 * DashboardNotificationRow
 * Generic, reusable, slim row component for displaying notifications across any feature.
 * Takes basic information: text, symbol, time, and optional subtitle/onClick/unread.
 * Supports feature-specific logo and color styling via `feature` or explicit `symbol` / `symbolColor`.
 * Displays formatted relative time (now / today / date added without time) on the right side.
 */
export const DashboardNotificationRow = ({
  id,
  text,
  title,
  message,
  symbol,
  icon,
  symbolColor,
  iconColor,
  feature,
  dotColor,
  unreadBg,
  time,
  timestamp,
  createdAt,
  addedAt,
  date,
  subtitle,
  description,
  unread = false,
  onClick,
  onDismiss,
  className = '',
  children,
}) => {
  const { t, i18n } = useTranslation();
  const featureStyle = feature && FEATURE_STYLES?.[feature] ? FEATURE_STYLES[feature] : null;

  const rawSymbol =
    icon !== undefined
      ? icon
      : symbol !== undefined
      ? symbol
      : featureStyle?.symbol || Bell;

  const resolvedIconColor =
    symbolColor ||
    iconColor ||
    featureStyle?.symbolColor ||
    'text-amber-600 bg-amber-50/90 border-amber-100';

  const resolvedDotColor = dotColor || featureStyle?.dotColor || 'bg-amber-500';
  const resolvedUnreadBg = unreadBg || featureStyle?.unreadBg || 'border-amber-200/60 bg-amber-50/20';
  const isClickable = Boolean(onClick);

  const resolvedText = text || title || message || subtitle || description;

  // Format small time display: "now" / "today" / date added (only date, no time)
  const rawTimeInput = time !== undefined ? time : (timestamp || createdAt || addedAt || date);
  const displayTime = formatNotificationTime(rawTimeInput, {
    t,
    language: i18n?.language,
  });

  const handleDismiss = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDismiss) {
      onDismiss(id || text);
    }
  };

  const renderSymbol = () => {
    if (!rawSymbol) return null;

    let content = null;
    if (React.isValidElement(rawSymbol)) {
      content = rawSymbol;
    } else if (typeof rawSymbol === 'function' || (typeof rawSymbol === 'object' && rawSymbol !== null)) {
      const SymbolComponent = rawSymbol;
      content = <SymbolComponent className="w-3 h-3" />;
    } else {
      content = <span className="text-xs font-bold leading-none select-none">{rawSymbol}</span>;
    }

    return (
      <button
        type="button"
        onClick={handleDismiss}
        title={t('dashboard.mainDashboard.notifications.dismiss', 'Dismiss')}
        aria-label={t('dashboard.mainDashboard.notifications.dismiss', 'Dismiss')}
        className={`w-5.5 h-5.5 rounded-md flex items-center justify-center border shrink-0 transition-all duration-150 cursor-pointer group/icon ${resolvedIconColor} hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 hover:scale-110 active:scale-95`}
      >
        {/* Original feature type logo: visible normally, hidden only when hovering the icon */}
        <span className="flex items-center justify-center group-hover/icon:hidden">
          {content}
        </span>
        {/* Green checkmark: hidden normally, visible only when hovering the icon directly */}
        <span className="hidden items-center justify-center group-hover/icon:flex text-emerald-600">
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      </button>
    );
  };

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`w-full py-1.5 px-2 rounded-lg border border-slate-100/90 bg-white flex items-center justify-between gap-2 transition-all duration-150 group/notif ${
        unread ? resolvedUnreadBg : ''
      } ${
        isClickable
          ? 'cursor-pointer hover:border-slate-200 hover:bg-slate-50/80 active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      {/* Left side: Symbol/Icon + Up to 2 Rows Text Message */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {renderSymbol()}

        {children || (
          <div className="min-w-0 flex-1 text-start">
            <span className="text-xs font-medium text-slate-700 line-clamp-2 break-words group-hover/notif:text-slate-900 leading-snug">
              {resolvedText}
            </span>
          </div>
        )}
      </div>

      {/* Right side: Small Time Display + Optional Chevron (pinned bottom-right for 2 rows, centered for 1 row) */}
      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center pb-0.5 sm:pb-0">
        {displayTime && (
          <span className="text-[10px] font-medium text-slate-400 tabular-nums whitespace-nowrap leading-none select-none">
            {displayTime}
          </span>
        )}
        {isClickable && (
          <ChevronRight className="w-3 h-3 text-slate-300 group-hover/notif:text-slate-500 transition-transform group-hover/notif:translate-x-0.5 rtl:rotate-180 shrink-0" />
        )}
      </div>
    </div>
  );
};

export default DashboardNotificationRow;
