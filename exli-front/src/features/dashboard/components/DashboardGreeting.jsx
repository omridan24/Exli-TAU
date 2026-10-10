import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDashboardDate } from '../utils/dashboardUtils';

/**
 * DashboardGreeting
 * Reusable greeting component displaying "welcome {first name}, today is {todays date}."
 * Fully localized and RTL/LTR compliant using logical alignment.
 */
export const DashboardGreeting = ({
  firstName = '',
  date = new Date(),
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const formattedDate = formatDashboardDate(date, i18n.language);
  const hasName = Boolean(firstName && firstName.trim().length > 0);

  const greetingText = hasName
    ? t('dashboard.mainDashboard.greeting', {
        name: firstName,
        date: formattedDate,
        defaultValue: `Welcome ${firstName}, today is ${formattedDate}.`,
      })
    : t('dashboard.mainDashboard.greetingFallback', {
        date: formattedDate,
        defaultValue: `Welcome, today is ${formattedDate}.`,
      });

  return (
    <div className={`flex flex-col items-start text-start ${className}`}>
      <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-snug">
        {greetingText}
      </h2>
    </div>
  );
};

export default DashboardGreeting;
