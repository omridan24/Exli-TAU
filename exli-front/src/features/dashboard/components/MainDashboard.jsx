import React from 'react';
import { DashboardCard } from './DashboardCard';
import { DashboardGreeting } from './DashboardGreeting';
import { DashboardAreas } from './DashboardAreas';
import { extractFirstName } from '../utils/dashboardUtils';

/**
 * MainDashboard Component
 * A wide dashboard hero component placed above the homepage menu.
 * Contains a greeting in the top-left ("welcome {first name}, today is {todays date}.")
 * and 2 modular areas (Left: Status, Right: Notifications).
 */
export const MainDashboard = ({
  user,
  userProfile,
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
  children,
  className = '',
  date = new Date(),
  headerActions,
  statusContent,
  notificationsContent,
}) => {
  const firstName = extractFirstName(user, userProfile);

  return (
    <DashboardCard
      className={className}
      headerActions={headerActions}
      header={
        <DashboardGreeting
          firstName={firstName}
          date={date}
        />
      }
    >
      {children || (
        <DashboardAreas
          user={user}
          expenses={expenses}
          income={income}
          wishlist={wishlist}
          notifications={notifications}
          amountSaved={amountSaved}
          onNavigateAnalytics={onNavigateAnalytics}
          onNavigateWishlist={onNavigateWishlist}
          onNavigateNotifications={onNavigateNotifications}
          onNavigateIncome={onNavigateIncome}
          onNavigateExpenses={onNavigateExpenses}
          onNavigateSettings={onNavigateSettings}
          onNavigateGroup={onNavigateGroup}
          onNavigateInvestments={onNavigateInvestments}
          userProfile={userProfile}
          date={date}
          statusContent={statusContent}
          notificationsContent={notificationsContent}
        />
      )}
    </DashboardCard>
  );
};

export default MainDashboard;
