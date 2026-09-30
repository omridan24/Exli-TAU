import React, { useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';
import { GROUP_TYPES, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';
import { groupsApi } from '../../../config/groupsApi';

/**
 * Group creation — type + details, per docs/groups/02-phase2-ui-and-splits-plan.md §1.
 * The wizard's 3rd step (splits, via SplitPicker's "configure" mode) lands once
 * SplitPicker exists (plan step 9/10) — until then the backend silently seeds each
 * type's default split rules (services/split_catalog.py), which is exactly what a
 * brand-new group with only its creator in it would show anyway (plan §3.5).
 */
export const CreateGroupModal = ({ isOpen, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [type, setType] = useState('other');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('groups.create.errors.nameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const { groupId } = await groupsApi.createGroup({
        name: name.trim(),
        description: description.trim() || null,
        type,
      });

      if (imageFile) {
        try {
          await groupsApi.uploadImage(groupId, imageFile);
        } catch (imgErr) {
          // The group itself was created successfully — don't block on a failed
          // picture upload, the admin can just try again from group settings later.
          console.error('Group image upload failed:', imgErr);
        }
      }

      onCreated(groupId);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-slate-800 text-lg">{t('groups.create.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-start">
          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              {t('groups.create.typeStepTitle')}
            </label>
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

          {/* Picture */}
          <div className="flex items-center gap-4">
            <label className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:border-indigo-300 transition-colors">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-5 h-5 text-slate-400" />
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="hidden" />
            </label>
            <span className="text-xs text-slate-500 font-medium">
              {imagePreview ? t('groups.create.changePicture') : t('groups.create.pictureLabel')}
            </span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('groups.create.nameLabel')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('groups.create.namePlaceholder')}
              className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-indigo-500 transition-all ${
                error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
              }`}
              autoFocus
              maxLength={60}
            />
            {error && <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('groups.create.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('groups.create.descriptionPlaceholder')}
              rows={2}
              maxLength={280}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center" disabled={isSubmitting}>
              {t('groups.create.cancel')}
            </Button>
            <Button type="submit" className="flex-1 justify-center" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('groups.create.creating')}
                </>
              ) : (
                t('groups.create.create')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
