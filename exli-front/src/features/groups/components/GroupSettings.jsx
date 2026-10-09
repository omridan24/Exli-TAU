import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Camera, Loader2, Shield, UserMinus } from 'lucide-react';
import { groupsApi } from '../../../config/groupsApi';
import { DefaultSplitSettings } from './DefaultSplitSettings';
import { initialDefaultChoice, FIXED, TOTAL_BP } from '../utils/defaultSplit';
import { GROUP_TYPES, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';
import { getCurrencySettings } from '../utils/currencySettings';
import { formatMinorAmount } from '../utils/money';
import { CurrencyPicker } from '../../../components/CurrencyPicker';

/** Admin panel: edit details/picture/currency/type/default split, manage members, delete the group.
 * ONE Save button (in the always-visible header) saves everything and closes. Inviting
 * new people lives on the main group page instead (see InviteModal) — this stays
 * for editing/removing people already in the group. */
export const GroupSettings = ({ group, userId, expenseCount = 0, expenseMonths = [], foreignCount = 0, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [type, setType] = useState(group.type || 'other');
  const [imagePreview, setImagePreview] = useState(group.imageUrl || null);
  const [imageFile, setImageFile] = useState(null);
  const [defaultChoice, setDefaultChoice] = useState(() => initialDefaultChoice(group));
  const [fixedWeights, setFixedWeights] = useState(group.defaultFixedSplit?.weights || null);
  const [previewing, setPreviewing] = useState(false);
  const [mergePlan, setMergePlan] = useState(null); // keep_original -> merge with open balances: the explanation to confirm
  const [confirmingApply, setConfirmingApply] = useState(false); // after saving a changed default: convert existing expenses?
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState(null); // { uid, displayName, photoURL } | null
  const initialCurrencySettings = getCurrencySettings(group);
  const [currencyMode, setCurrencyMode] = useState(initialCurrencySettings.mode);
  const [mergeCurrency, setMergeCurrency] = useState(initialCurrencySettings.mergeCurrency || 'ILS');

  const activeMembers = Object.entries(group.members || {}).filter(([, m]) => m.status === 'active');

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const currencyChanged =
    currencyMode !== initialCurrencySettings.mode
    || (currencyMode === 'merge' && mergeCurrency !== (initialCurrencySettings.mergeCurrency || 'ILS'));

  const initialChoice = initialDefaultChoice(group);
  const fixedSum = fixedWeights ? Object.values(fixedWeights).reduce((x, y) => x + y, 0) : 0;
  const defaultChanged = !!defaultChoice && (
    defaultChoice !== initialChoice
    || (defaultChoice === FIXED && JSON.stringify(fixedWeights) !== JSON.stringify(group.defaultFixedSplit?.weights))
  );

  // The one Save: details + currency + type, then the default split (if changed), then the image.
  const handleSave = async (confirmMerge = false) => {
    if (!name.trim()) return;
    if (defaultChoice === FIXED && fixedSum !== TOTAL_BP) {
      setError(t('groups.defaultSplit.mustTotal100'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const patch = { name: name.trim(), description: description.trim() || null, type };
      if (currencyChanged) {
        patch.currencySettings = currencyMode === 'merge'
          ? { mode: 'merge', mergeCurrency, ...(confirmMerge === true ? { confirmMerge: true } : {}) }
          : { mode: 'keep_original' };
      }
      await groupsApi.updateGroup(group.id, patch);
      if (defaultChanged) {
        await groupsApi.updateGroup(
          group.id,
          defaultChoice === FIXED ? { defaultFixedSplit: { weights: fixedWeights } } : { defaultSplitRuleId: defaultChoice }
        );
      }
      if (imageFile) await groupsApi.uploadImage(group.id, imageFile);
      if (defaultChanged && expenseCount > 0) {
        setConfirmingApply(true); // close only after they choose "apply to all" or "only new"
      } else {
        onClose();
      }
    } catch (err) {
      if (err.code === 'MERGE_HISTORY_REQUIRED') {
        // Nothing was saved. Show how the open balances would be merged and let the admin confirm.
        try {
          setMergePlan({ ...(await groupsApi.getMergePreview(group.id, mergeCurrency)), kind: 'switch' });
        } catch (previewErr) {
          setError(previewErr.message);
        }
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAll = async () => {
    setApplying(true);
    setError('');
    try {
      setApplyResult(await groupsApi.applyDefaultSplit(group.id));
    } catch (err) {
      setError(err.status === 405 ? t('groups.defaultSplit.applyUnavailable') : err.message);
    } finally {
      setApplying(false);
    }
  };

  // A group already on one shared currency can still hold expenses/payments recorded in another one.
  const openLeftoverPreview = async () => {
    setPreviewing(true);
    setError('');
    try {
      setMergePlan({ ...(await groupsApi.getMergePreview(group.id, mergeCurrency)), kind: 'leftover' });
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const confirmLeftover = async () => {
    setSaving(true);
    setError('');
    try {
      await groupsApi.consolidateCurrency(group.id, mergeCurrency);
      setMergePlan(null);
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
    {createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
      {/* The card is capped at the viewport height and only its body scrolls, so the header
          (title, Save, X) can never be pushed off-screen. Before this, a tall card inside a
          centered, scrollable overlay overflowed upward past the top edge, where it
          can't be scrolled to - that is why the X wasn't visible. */}
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          <h2 className="font-bold text-slate-800 text-lg ps-2">{t('groups.settings.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave()} disabled={saving || confirmingApply || !!mergePlan || !name.trim()}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
            </button>
            <button onClick={onClose} aria-label={t('common.close')} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          {mergePlan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800">{t('groups.settings.merge.title', { currency: mergeCurrency })}</p>
              <p className="text-xs text-slate-500">{t('groups.settings.merge.explain')}</p>
              {mergePlan.details.map((d) => (
                <div key={d.currency} className="bg-white rounded-lg p-3 space-y-1 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">{t('groups.settings.merge.currencyTitle', { from: d.currency, to: mergeCurrency })}</p>
                  {d.expenseCount > 0 && (
                    <p>{t('groups.settings.merge.expensesLine', {
                      count: d.expenseCount, from: d.currency, total: formatMinorAmount(d.totalMinor, d.currency),
                      newTotal: formatMinorAmount(d.newTotalMinor, mergeCurrency), first: d.firstDate, last: d.lastDate,
                      to: mergeCurrency, rate: Number(d.rate).toFixed(4), min: Number(d.minRate).toFixed(4), max: Number(d.maxRate).toFixed(4),
                    })}</p>
                  )}
                  {d.settlementsMinor > 0 && (
                    <p>{t('groups.settings.merge.paymentsLine', { from: d.currency, amount: formatMinorAmount(d.settlementsMinor, d.currency) })}</p>
                  )}
                </div>
              ))}
              {mergePlan.expenses.length > 0 && (
                <div className="bg-white rounded-lg p-3 text-xs text-slate-600 space-y-0.5 max-h-40 overflow-y-auto">
                  {mergePlan.expenses.map((e) => (
                    <p key={e.id} className="flex justify-between gap-3">
                      <span className="truncate">{e.date} {e.description}</span>
                      <span className="font-bold text-slate-800 whitespace-nowrap">
                        {formatMinorAmount(e.amountMinor, e.currency)} {'\u2192'} {formatMinorAmount(e.newAmountMinor, mergeCurrency)}
                      </span>
                    </p>
                  ))}
                </div>
              )}
              <div className="bg-white rounded-lg p-3 space-y-1 text-xs text-slate-600">
                <p className="font-bold text-slate-800">{t('groups.settings.merge.balancesTitle')}</p>
                {Object.keys(mergePlan.balances).map((uid) => {
                  const after = mergePlan.balances[uid] || 0;
                  const before = mergePlan.storedBalances[uid] || 0;
                  const label = (v) => (v === 0 ? t('groups.settings.merge.even')
                    : t(v < 0 ? 'groups.settings.merge.owes' : 'groups.settings.merge.isOwed', { amount: formatMinorAmount(Math.abs(v), mergeCurrency) }));
                  return (
                    <p key={uid} className="font-medium">
                      {group.members?.[uid]?.displayName || uid}: <span className="font-bold text-slate-800">{label(after)}</span>
                      {after !== before && <span className="text-slate-400"> ({t('groups.settings.merge.was', { value: label(before) })})</span>}
                    </p>
                  );
                })}
                <p className="text-slate-400 pt-1">{t('groups.settings.merge.derivedNote')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMergePlan(null)} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm">
                  {t('groups.create.cancel')}
                </button>
                <button type="button" disabled={saving}
                  onClick={async () => {
                    if (mergePlan.kind === 'leftover') { await confirmLeftover(); return; }
                    await handleSave(true);
                    setMergePlan(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('groups.settings.merge.confirm')}
                </button>
              </div>
            </div>
          )}

          {confirmingApply && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
              {applyResult ? (
                <>
                  <p className="text-sm text-emerald-700 font-medium">
                    {t('groups.defaultSplit.applyDone', { count: applyResult.converted })}
                    {applyResult.skipped.length > 0 && ` ${t('groups.defaultSplit.applySkipped', { count: applyResult.skipped.length })}`}
                  </p>
                  <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm">{t('common.close')}</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-700 font-medium">{t('groups.defaultSplit.applyQuestion', { count: expenseCount })}</p>
                  <p className="text-xs text-slate-500">{t('groups.defaultSplit.applyWarning')}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} disabled={applying}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm">
                      {t('groups.defaultSplit.onlyNew')}
                    </button>
                    <button type="button" onClick={handleApplyAll} disabled={applying}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2">
                      {applying && <Loader2 className="w-4 h-4 animate-spin" />} {t('groups.defaultSplit.applyAll', { count: expenseCount })}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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

          {/* Currency settings — docs/fx/01-fx-plan.md §6 */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              {t('groups.create.currencyModeTitle')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['keep_original', 'merge'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCurrencyMode(mode)}
                  className={`text-start p-3 rounded-xl border-2 transition-all ${
                    currencyMode === mode ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700 block">{t(`groups.create.currencyMode.${mode}.name`)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{t(`groups.create.currencyMode.${mode}.description`)}</span>
                </button>
              ))}
            </div>
            {currencyMode === 'merge' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">{t('groups.create.mergeCurrencyLabel')}</span>
                <CurrencyPicker value={mergeCurrency} onChange={setMergeCurrency} />
              </div>
            )}
          </div>


          {currencyMode === 'merge' && !currencyChanged && foreignCount > 0 && !mergePlan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-700 font-medium">{t('groups.settings.merge.leftover', { count: foreignCount, currency: mergeCurrency })}</p>
              <button type="button" onClick={openLeftoverPreview} disabled={previewing}
                className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5">
                {previewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t('groups.settings.merge.review')}
              </button>
            </div>
          )}

          <DefaultSplitSettings
            group={{ ...group, currency: currencyMode === 'merge' ? mergeCurrency : group.currency }} choice={defaultChoice} weights={fixedWeights}
            onChoice={setDefaultChoice} onWeights={setFixedWeights} expenseMonths={expenseMonths}
          />

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
    </div>,
    document.body
    )}

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
