import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, Settings, UserPlus } from 'lucide-react';
import { GroupSettings } from './GroupSettings';
import { InviteModal } from './InviteModal';
import { useLanguage } from '../../../hooks/useLanguage';
import { useGroup } from '../hooks/useGroup';
import { getGroupType, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';
import { formatMinorAmount } from '../utils/money';
import { groupsApi } from '../../../config/groupsApi';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseListItem } from './ExpenseListItem';
import { BalancesList } from './BalancesList';
import { MemberBucketsView } from './MemberBucketsView';

/**
 * A group page: header, balance summary, members, and expenses (under the
 * "Overview" tab), plus a "Who Paid What" tab with the per-member paid-vs-owed
 * buckets. Adding people (InviteModal) is a button right here on the Members
 * section; group editing and managing existing members (role/remove) live in
 * GroupSettings (gear icon, admin only).
 */
export const GroupPage = ({ groupId, userId, onBack }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage(userId);
  const { group, expenses, joinRequests, loading, notFound } = useGroup(groupId);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'buckets'

  const isAdmin = group?.members?.[userId]?.role === 'admin';

  const handleApprove = (targetUid) => groupsApi.approveRequest(groupId, targetUid).catch(console.error);
  const handleReject = (targetUid) => groupsApi.rejectRequest(groupId, targetUid).catch(console.error);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 animate-pulse">{t('app.verifying')}</div>;
  }

  if (notFound || !group) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500 mb-4">{t('groups.page.notFound')}</p>
        <button onClick={onBack} className="text-indigo-600 font-bold">{t('groups.page.backToGroups')}</button>
      </div>
    );
  }

  const groupType = getGroupType(group.type);
  const colors = GROUP_TYPE_COLOR_CLASSES[groupType.color];
  const Icon = groupType.icon;
  const myBalance = (group.balances || {})[userId] || 0;
  const activeMembers = Object.entries(group.members || {}).filter(([, m]) => m.status === 'active');

  return (
    <div className="p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium text-sm">
          <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} /> {t('groups.page.backToGroups')}
        </button>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
          {group.imageUrl ? (
            <img src={group.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${colors.bgLight} ${colors.text}`}>
              <Icon className="w-7 h-7" />
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{group.name}</h1>
          {group.description && <p className="text-slate-500 text-sm mt-0.5">{group.description}</p>}
        </div>
      </div>

      {/* Pending join requests (admin only) */}
      {isAdmin && joinRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          {joinRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {req.photoURL && <img src={req.photoURL} alt="" className="w-8 h-8 rounded-full" />}
                <span className="font-medium text-slate-700">{req.displayName}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApprove(req.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                  {t('common.approve')}
                </button>
                <button onClick={() => handleReject(req.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300">
                  {t('common.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex bg-slate-100 rounded-full p-1">
        {['overview', 'buckets'].map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
              activeTab === tabId ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
            }`}
          >
            {t(`groups.page.${tabId}Tab`)}
          </button>
        ))}
      </div>

      {activeTab === 'buckets' ? (
        <MemberBucketsView group={group} expenses={expenses} />
      ) : (
        <>
          {/* Balance summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
            {myBalance === 0 ? (
              <p className="text-lg font-bold text-slate-400">{t('groups.page.allSettled')}</p>
            ) : myBalance > 0 ? (
              <p className="text-lg font-bold text-emerald-600">
                {t('groups.page.youAreOwed', { amount: formatMinorAmount(myBalance, group.currency) })}
              </p>
            ) : (
              <p className="text-lg font-bold text-rose-500">
                {t('groups.page.youOwe', { amount: formatMinorAmount(-myBalance, group.currency) })}
              </p>
            )}
          </div>

          {/* Balances (who owes whom, simplified) */}
          {activeMembers.length > 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="font-bold text-slate-800 mb-3">{t('groups.page.balancesTab')}</h2>
              <BalancesList group={group} />
            </div>
          )}

          {/* Members */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">{t('groups.page.membersTab')}</h2>
              {isAdmin && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  <UserPlus className="w-4 h-4" /> {t('groups.page.addPeople')}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {activeMembers.map(([uid, member]) => (
                <div key={uid} className="flex items-center gap-3">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                      {member.displayName?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-slate-700">{member.displayName}</span>
                  {uid === group.ownerId ? (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{t('groups.page.owner')}</span>
                  ) : member.role === 'admin' ? (
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{t('groups.page.adminBadge')}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">{t('groups.page.expensesTab')}</h2>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="w-4 h-4" /> {t('groups.expense.add')}
              </button>
            </div>
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('groups.page.noExpenses')}</p>
            ) : (
              expenses.map((expense) => (
                <ExpenseListItem key={expense.id} expense={expense} group={group} onClick={() => setEditingExpense(expense)} />
              ))
            )}
          </div>
        </>
      )}

      {(showExpenseForm || editingExpense) && (
        <ExpenseForm
          group={group} userId={userId} expense={editingExpense}
          onClose={() => { setShowExpenseForm(false); setEditingExpense(null); }}
          onSaved={() => { setShowExpenseForm(false); setEditingExpense(null); }}
        />
      )}

      {showSettings && (
        <GroupSettings group={group} userId={userId} onClose={() => setShowSettings(false)} onDeleted={onBack} />
      )}

      {showInvite && (
        <InviteModal groupId={group.id} groupName={group.name} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
};
