import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Loader2 } from 'lucide-react';
import { groupsApi } from '../../../config/groupsApi';
import { ShareChannelButton } from '../../../components/share/ShareChannelButton';
import { WhatsAppIcon, XIcon } from '../../../components/share/ShareIcons';

/** Invite link management, shown inside InviteModal (main group page, admin only).
 * Shows how long the current link is valid for and lets the admin change that,
 * plus one-tap sharing to WhatsApp/X (same share pattern as the wishlist's
 * WishlistShareModal — see components/share). */
export const InvitePanel = ({ groupId, groupName }) => {
  const { t } = useTranslation();
  const [invite, setInvite] = useState(null);
  const [duration, setDuration] = useState('7');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Default to the max allowed (7 days) - links never go out without an expiry.
    groupsApi.createInvite(groupId, 7).then(setInvite).catch(() => {}).finally(() => setLoading(false));
  }, [groupId]);

  const handleChangeDuration = () => {
    setLoading(true);
    groupsApi.rotateInvite(groupId, Number(duration)).then(setInvite).finally(() => setLoading(false));
  };

  const inviteUrl = invite ? `${window.location.origin}/join/${invite.token}` : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expiryText = () => {
    if (!invite || !invite.expiresAt) return '';
    const days = Math.max(0, Math.ceil((new Date(invite.expiresAt) - new Date()) / 86400000));
    return t('groups.settings.invite.expiresIn', { count: days });
  };

  const shareMessage = () => t('groups.settings.invite.shareMessage', { groupName, link: inviteUrl });

  const handleWhatsAppShare = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage())}`, '_blank', 'noopener,noreferrer');
  };

  const handleXShare = () => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareMessage())}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 text-sm mb-2">{t('groups.page.inviteLink')}</h3>
      {loading && !invite ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      ) : invite && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <input readOnly value={inviteUrl} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600" />
            <button onClick={handleCopy} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">{expiryText()}</p>
          <div className="flex items-center gap-2">
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm">
              <option value="1">{t('groups.settings.invite.days', { count: 1 })}</option>
              <option value="7">{t('groups.settings.invite.days', { count: 7 })}</option>
            </select>
            <button onClick={handleChangeDuration} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold whitespace-nowrap">
              {t('groups.settings.invite.update')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <ShareChannelButton
              name={t('wishlist.whatsapp', 'WhatsApp')}
              icon={WhatsAppIcon}
              iconBg="bg-[#25D366] text-white"
              hoverBorder="hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800"
              onClick={handleWhatsAppShare}
            />
            <ShareChannelButton
              name={t('wishlist.x', 'X')}
              icon={XIcon}
              iconBg="bg-slate-900 text-white"
              hoverBorder="hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900"
              onClick={handleXShare}
            />
          </div>
        </>
      )}
    </div>
  );
};
