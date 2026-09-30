import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';
import { getGroupType, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';
import { formatMinorAmount } from '../utils/money';

export const GroupCard = ({ group, userId, onClick }) => {
  const { t } = useTranslation();
  const groupType = getGroupType(group.type);
  const colors = GROUP_TYPE_COLOR_CLASSES[groupType.color];
  const Icon = groupType.icon;

  const memberCount = (group.memberIds || []).length;
  const myBalance = (group.balances || {})[userId] || 0;
  const pendingCount = group.pendingRequestCount || 0;
  const isAdmin = group.members?.[userId]?.role === 'admin';

  return (
    <Card onClick={onClick} className="p-6 text-start group relative overflow-hidden">
      {pendingCount > 0 && isAdmin && (
        <div className="absolute top-3 end-3 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">
          {t('groups.list.pendingRequests', { count: pendingCount })}
        </div>
      )}

      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 overflow-hidden">
        {group.imageUrl ? (
          <img src={group.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${colors.bgLight} ${colors.text}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      <h3 className="font-bold text-lg text-slate-800 truncate">{group.name}</h3>
      <p className="text-slate-500 text-sm mt-1">{t('groups.list.members', { count: memberCount })}</p>

      <div className="mt-3 pt-3 border-t border-slate-100">
        {myBalance === 0 ? (
          <span className="text-sm font-medium text-slate-400">{t('groups.page.allSettled')}</span>
        ) : myBalance > 0 ? (
          <span className="text-sm font-bold text-emerald-600">
            {t('groups.page.youAreOwed', { amount: formatMinorAmount(myBalance, group.currency) })}
          </span>
        ) : (
          <span className="text-sm font-bold text-rose-500">
            {t('groups.page.youOwe', { amount: formatMinorAmount(-myBalance, group.currency) })}
          </span>
        )}
      </div>
    </Card>
  );
};
