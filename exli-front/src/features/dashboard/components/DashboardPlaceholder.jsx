import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Plus } from 'lucide-react';

/**
 * DashboardPlaceholder
 * Reusable placeholder / canvas component for the large dashboard square,
 * ready to host future elements, widgets, and quick summaries.
 */
export const DashboardPlaceholder = ({
  title,
  subtitle,
  icon: Icon = LayoutGrid,
  className = '',
  compact = false,
  children,
}) => {
  const { t } = useTranslation();

  const displayTitle = title !== undefined ? title : t('dashboard.mainDashboard.placeholderTitle', 'Dashboard Canvas');

  if (compact) {
    return (
      <div
        className={`w-full h-full min-h-[85px] rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 hover:bg-emerald-50/20 hover:border-emerald-200/70 transition-all duration-300 flex flex-col items-center justify-center p-3 text-center group/ph ${className}`}
      >
        {children || (
          <div className="flex flex-col items-center justify-center gap-1.5 max-w-full">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-white shadow-2xs border border-slate-100 flex items-center justify-center text-slate-400 group-hover/ph:text-emerald-600 group-hover/ph:scale-105 transition-all">
                <Icon className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="font-semibold text-xs text-slate-600 group-hover/ph:text-slate-800 transition-colors truncate max-w-full px-1">
              {displayTitle}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full min-h-[110px] rounded-2xl border-2 border-dashed border-slate-200/80 bg-slate-50/50 hover:bg-emerald-50/20 hover:border-emerald-200/80 transition-all duration-300 flex items-center justify-center p-5 sm:p-6 text-center group ${className}`}
    >
      {children || (
        <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-3xl gap-4 text-center sm:text-start px-2">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 group-hover:shadow-sm transition-all duration-300">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-700 group-hover:text-slate-800 transition-colors">
                {displayTitle}
              </h3>
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200/70 text-slate-500 shadow-2xs shrink-0">
            <Plus className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('dashboard.mainDashboard.customizable', 'Customizable space')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPlaceholder;
