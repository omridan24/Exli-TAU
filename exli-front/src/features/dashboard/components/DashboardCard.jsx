import React from 'react';

/**
 * DashboardCard
 * Reusable wide hero container component following Exli's design philosophy.
 * Features a wide responsive layout, soft ambient accents,
 * smooth hover elevation, and flexible header/content slots.
 */
export const DashboardCard = ({
  header,
  headerActions,
  children,
  footer,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-gradient-to-br from-emerald-100/70 via-teal-50/50 to-emerald-100/80 rounded-3xl shadow-sm hover:shadow-md shadow-emerald-900/5 border border-emerald-200/70 hover:border-emerald-300/80 transition-all duration-300 relative overflow-hidden flex flex-col min-h-0 mx-auto ${className}`}
    >
      {/* Soft ambient corner glow adhering to Exli's emerald brand */}
      <div className="absolute top-0 end-0 -mt-16 -me-16 w-80 h-80 bg-gradient-to-br from-emerald-200/60 via-teal-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 start-0 -mb-16 -ms-16 w-72 h-72 bg-gradient-to-tr from-emerald-200/50 via-teal-100/30 to-transparent rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-emerald-50/30 via-transparent to-teal-50/20 pointer-events-none" />

      {/* Header Area (squeezed for maximum interior content) */}
      {(header || headerActions) && (
        <div className="p-4 sm:p-5 pb-2.5 sm:pb-3 flex items-start justify-between gap-3 relative z-10">
          <div className="flex-1 min-w-0">{header}</div>
          {headerActions && (
            <div className="flex items-center gap-2.5 shrink-0">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col min-h-0 relative z-10">
        {children}
      </div>

      {/* Optional Footer Slot */}
      {footer && (
        <div className="px-6 sm:px-8 pb-6 pt-0 relative z-10 border-t border-emerald-100/50 mt-auto">
          {footer}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
