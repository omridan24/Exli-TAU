import React from 'react';
import { Card } from '../../../components/UI';

/**
 * DashboardArea
 * Reusable panel component for main dashboard zones (e.g. Status, Utils, Notifications).
 * Wraps the base UI Card with consistent dashboard styling, header, and flexible content slot.
 */
export const DashboardArea = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-emerald-600 bg-emerald-50/80 border-emerald-100',
  badge,
  badgeColor,
  action,
  children,
  className = '',
  contentClassName = '',
  ...rest
}) => {
  return (
    <Card
      className={`p-3 sm:p-3.5 flex flex-col justify-between h-full bg-white/90 hover:bg-white border border-emerald-100/80 hover:border-emerald-200/90 shadow-2xs hover:shadow-xs transition-all duration-200 rounded-2xl group/area backdrop-blur-xs ${className}`}
      {...rest}
    >
      {/* Area Header (squeezed for maximum content space) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center border shrink-0 transition-transform group-hover/area:scale-105 ${iconColor}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-sm text-slate-800 tracking-tight leading-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badge !== undefined && badge !== null && badge !== false && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border shadow-2xs ${
                badgeColor || 'bg-white text-slate-600 border-slate-200/70'
              }`}
            >
              {badge}
            </span>
          )}
          {action}
        </div>
      </div>

      {/* Area Content / Body */}
      <div className={`flex-1 flex flex-col min-h-0 ${contentClassName}`}>
        {children}
      </div>
    </Card>
  );
};

export default DashboardArea;
