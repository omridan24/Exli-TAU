import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Camera, Loader2, Shield, UserMinus } from 'lucide-react';
import { groupsApi } from '../../../config/groupsApi';
import { GROUP_TYPES, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';

/** Admin panel: edit details/picture/type, manage members, delete the group. Inviting
 * new people lives on the main group page instead (see InviteModal) — this stays
 * for editing/removing people already in the group. */
export const GroupSettings = ({ group, userId, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [type, setType] = useState(group.type || 'other');
  const [imagePreview, setImagePreview] = useState(group.imageUrl || null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState(null); // { uid, displayName, photoURL } | null

  const activeMembers = Object.entries(group.members || {}).filter(([, m]) => m.status === 'active');

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSaveDetails = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await groupsApi.updateGroup(group.id, { name: name.trim(), description: description.trim() || null, type });
      if (imageFile) await groupsApi.uploadImage(group.id, imageFile);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = (uid, currentRole) => {
    groupsApi.updateMemberRole(group.id, uid, currentRole === 'admin' ? 'member' : 'admin').catch((err) => setError(err.message));
  };

  const handleConfirmRemoveMember = () => {
    groupsApi.removeMember(group.id, removingMember.uid).catch((err) => setError(err.message)).finally(() => setRemovingMember(null));
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await groupsApi.deleteGroup(group.id);
      onDeleted();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">{t('groups.settings.title')}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Details */}
          <div className="flex items-center gap-4">
            <label className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:border-indigo-300">
              {imagePreview ? <img src={imagePreview} alt="" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-slate-400" />}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="hidden" />
            </label>
            <span className="text-xs text-slate-500 font-medium">{t('groups.create.changePicture')}</span>
          </div>

          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:border-indigo-500"
          />
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={280}
            placeholder={t('groups.create.descriptionPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:border-indigo-500 resize-none"
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">{t('groups.create.typeStepTitle')}</label>
            <div className="grid grid-cols-3 gap-2">
              {GROUP_TYPES.map((groupType) => {
                const colors = GROUP_TYPE_COLOR_CLASSES[groupType.color];
                const Icon = groupType.icon;
                const isActive = type === groupType.id;
                return (
                  <button
                    key={groupType.id}
                    type="button"
                    onClick={() => setType(groupType.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                      isActive ? `${colors.bgLight} border-current ${colors.text}` : 'border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-bold">{t(`groups.types.${groupType.id}.name`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
          <button onClick={handleSaveDetails} disabled={saving} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
          </button>

          {/* Members */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="font-bold text-slate-800 text-sm mb-3">{t('groups.page.membersTab')}</h3>
            <div className="space-y-2">
              {activeMembers.map(([uid, member]) => {
                const isOwner = uid === group.ownerId;
                return (
                  <div key={uid} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{member.displayName}</span>
                    {!isOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRoleToggle(uid, member.role)}
                          title={t('groups.settings.toggleAdmin')}
                          className={`p-1.5 rounded-lg ${member.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRemovingMember({ uid, displayName: member.displayName, photoURL: member.photoURL })}
                          title={t('groups.settings.removeMember')}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {isOwner && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{t('groups.page.owner')}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danger zone */}
          {group.ownerId === userId && (
            <div className="border-t border-slate-100 pt-4">
              {confirmingDelete ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-slate-600">{t('groups.settings.deleteConfirm')}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setConfirmingDelete(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold">
                      {t('groups.create.cancel')}
                    </button>
                    <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold">
                      {deleting ? t('groups.settings.deleting') : t('groups.settings.deleteGroup')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmingDelete(true)} className="w-full py-3 rounded-xl border-2 border-rose-100 text-rose-500 font-bold hover:bg-rose-50">
                  {t('groups.settings.deleteGroup')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {removingMember && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {removingMember.photoURL ? (
              <img src={removingMember.photoURL} alt="" className="w-16 h-16 rounded-full mx-auto object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-xl font-bold text-slate-500">
                {removingMember.displayName?.[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-slate-700">{t('groups.settings.removeConfirm', { name: removingMember.displayName })}</p>
            <div className="flex gap-3">
              <button onClick={() => setRemovingMember(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold">
                {t('groups.create.cancel')}
              </button>
              <button onClick={handleConfirmRemoveMember} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold">
                {t('groups.settings.removeMember')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
