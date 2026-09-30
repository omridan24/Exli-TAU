import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { InvitePanel } from './InvitePanel';

/** Standalone "Add people" entry point on the main group page (plan: inviting
 * moved out of GroupSettings so it doesn't require opening Settings first). */
export const InviteModal = ({ groupId, groupName, onClose }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">{t('groups.page.addPeople')}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          <InvitePanel groupId={groupId} groupName={groupName} />
        </div>
      </div>
    </div>
  );
};
