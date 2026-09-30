import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, Users } from 'lucide-react';
import { groupsApi } from '../../../config/groupsApi';
import { ExliLogo } from '../../../components/UI';

/** The /join/:token landing page (plan §1 / §4.4). No router yet — App.jsx detects
 * this path on boot and renders this in place of the normal dashboard. */
export const JoinGroupPage = ({ token, onDone }) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    groupsApi
      .getInvitePreview(token)
      .then(setPreview)
      .catch((err) => setError(err.message || t('groups.join.invalidLink')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAskToJoin = async () => {
    setBusy(true);
    try {
      await groupsApi.requestToJoin(token);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await groupsApi.cancelJoinRequest(token);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-8 text-center space-y-5">
        <div className="flex justify-center"><ExliLogo className="h-8" /></div>

        {loading && <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />}

        {!loading && error && (
          <>
            <p className="text-slate-600">{error}</p>
            <button onClick={onDone} className="text-indigo-600 font-bold text-sm">{t('groups.join.goToApp')}</button>
          </>
        )}

        {!loading && !error && preview && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-indigo-100 text-indigo-600 text-2xl">
              {preview.emoji || <Users className="w-7 h-7" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">{preview.groupName}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('groups.list.members', { count: preview.memberCount })}</p>
              {preview.adminName && <p className="text-xs text-slate-400 mt-0.5">{t('groups.join.invitedBy', { name: preview.adminName })}</p>}
            </div>

            {!preview.isWhitelisted ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3">{t('groups.join.notWhitelisted')}</p>
            ) : preview.viewerStatus === 'member' ? (
              <>
                <p className="text-sm text-emerald-600 flex items-center justify-center gap-1"><Check className="w-4 h-4" /> {t('groups.join.alreadyMember')}</p>
                <button onClick={onDone} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">{t('groups.join.goToApp')}</button>
              </>
            ) : preview.viewerStatus === 'pending' ? (
              <>
                <p className="text-sm text-slate-500">{t('groups.join.pendingBody')}</p>
                <button onClick={handleCancel} disabled={busy} className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold">
                  {t('groups.join.cancelRequest')}
                </button>
                <button onClick={onDone} className="text-indigo-600 font-bold text-sm">{t('groups.join.goToApp')}</button>
              </>
            ) : (
              <>
                <button onClick={handleAskToJoin} disabled={busy} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t('groups.join.askToJoin')}
                </button>
                <button onClick={onDone} disabled={busy} className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 font-bold">
                  {t('groups.join.decline')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
