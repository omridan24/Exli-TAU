import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMyGroups } from './hooks/useMyGroups';
import { GroupCard } from './components/GroupCard';
import { CreateGroupModal } from './components/CreateGroupModal';
import { GroupPage } from './components/GroupPage';

/**
 * Groups feature entry point. Owns the list <-> single-group navigation, the
 * same "activeNode holds a sub-selection" pattern App.jsx already uses (Debate N:
 * no router yet — selectedGroupId maps 1:1 to a future /groups/:id route).
 */
export const GroupsNode = ({ userId, initialGroupId = null }) => {
  const { t } = useTranslation();
  const { groups, loading } = useMyGroups(userId);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (selectedGroupId) {
    return <GroupPage groupId={selectedGroupId} userId={userId} onBack={() => setSelectedGroupId(null)} />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">{t('groups.list.title')}</h1>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12 animate-pulse">{t('app.verifying')}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">{t('groups.list.empty')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> {t('groups.list.newGroup')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} userId={userId} onClick={() => setSelectedGroupId(group.id)} />
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex flex-col items-center justify-center gap-2 min-h-[160px]"
          >
            <Plus className="w-6 h-6" />
            <span className="font-bold text-sm">{t('groups.list.newGroup')}</span>
          </button>
        </div>
      )}

      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(groupId) => {
          setShowCreateModal(false);
          setSelectedGroupId(groupId);
        }}
      />
    </div>
  );
};

export default GroupsNode;
