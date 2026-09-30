import React, { useState } from 'react';
import { X, Share2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { getCurrencySymbol, formatStoreUrl } from './WishlistCard';
import { WishlistMiniPreview } from './WishlistMiniPreview';
import { ShareLinkBar } from '../../../components/share/ShareLinkBar';
import { ShareChannelButton } from '../../../components/share/ShareChannelButton';
import { WhatsAppIcon, XIcon } from '../../../components/share/ShareIcons';

export const WishlistShareModal = ({
  isOpen,
  onClose,
  item,
  categories = DEFAULT_CATEGORIES
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');

  if (!isOpen || !item) return null;

  const hasStoreUrl = Boolean(item.storeUrl && item.storeUrl.trim());
  const itemLink = hasStoreUrl
    ? formatStoreUrl(item.storeUrl.trim())
    : t('wishlist.noStoreUrlProvided', 'No store link was provided');

  const handleCopyLink = async (e) => {
    if (e) e.preventDefault();
    if (!hasStoreUrl) return;
    try {
      await navigator.clipboard.writeText(itemLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const buildShareMessage = (disclosureKey = 'wishlist.whatsappShareDisclosure') => {
    const lines = [];

    // Optional user note
    if (note.trim()) {
      lines.push(note.trim());
    }

    // Formatted item line
    const priceFormatted = `${getCurrencySymbol(item.currency)}${Number(item.price || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;

    lines.push(`🎁 *${item.name}* - ${priceFormatted}`);

    // Optional description
    if (item.description && item.description.trim()) {
      lines.push(item.description.trim());
    }

    // Store link if present
    if (hasStoreUrl) {
      lines.push(formatStoreUrl(item.storeUrl.trim()));
    }

    // Exli wishlist personal disclosure
    lines.push(t(disclosureKey, t('wishlist.whatsappShareDisclosure', 'An item from my wishlist on #Exli')));

    return lines.filter(Boolean).join('\n\n');
  };

  const handleWhatsAppShare = () => {
    const message = buildShareMessage('wishlist.whatsappShareDisclosure');
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleXShare = () => {
    const message = buildShareMessage('wishlist.xShareDisclosure');
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    const message = buildShareMessage('wishlist.emailShareDisclosure');
    const subject = t('wishlist.emailShareSubject', '{{name}} - Wishlist item on Exli', { name: item.name });
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    // eslint-disable-next-line react-hooks/immutability -- ordinary browser navigation, not component state
    window.location.href = mailtoUrl;
  };

  const handleChannelClick = (channelId) => {
    if (channelId === 'whatsapp') {
      handleWhatsAppShare();
    } else if (channelId === 'x') {
      handleXShare();
    } else if (channelId === 'email') {
      handleEmailShare();
    }
    // Other channels remain no-op per specification
  };

  const shareChannels = [
    {
      id: 'whatsapp',
      name: t('wishlist.whatsapp', 'WhatsApp'),
      icon: WhatsAppIcon,
      iconBg: 'bg-[#25D366] text-white',
      hoverBorder: 'hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800'
    },
    {
      id: 'email',
      name: t('wishlist.email', 'Email'),
      icon: Mail,
      iconBg: 'bg-blue-500 text-white',
      hoverBorder: 'hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800'
    },
    {
      id: 'x',
      name: t('wishlist.x', 'X'),
      icon: XIcon,
      iconBg: 'bg-slate-900 text-white',
      hoverBorder: 'hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900'
    }
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 text-start space-y-5 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 shadow-xs shrink-0">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {t('wishlist.shareTitle', 'Share item')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('wishlist.shareSubtitle', "Share this item with friends or family so they know what you'd love")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            title={t('common.close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item mini-preview using reusable WishlistMiniPreview */}
        <WishlistMiniPreview item={item} categories={categories} />

        {/* Form Body */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Shareable Link Bar using reusable ShareLinkBar */}
          <ShareLinkBar
            link={itemLink}
            hasLink={hasStoreUrl}
            copied={copied}
            onCopy={handleCopyLink}
          />

          {/* Optional Note / Message */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('wishlist.shareMessage', 'Add a note (optional)')}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('wishlist.shareMessagePlaceholder', "Take a look at this item I'm planning to get on Exli!")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-pink-500 focus:bg-white transition-all"
            />
          </div>

          {/* Sharing Channels Grid using reusable ShareChannelButton */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('wishlist.shareVia', 'Share via')}
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {shareChannels.map((channel) => (
                <ShareChannelButton
                  key={channel.id}
                  name={channel.name}
                  icon={channel.icon}
                  iconBg={channel.iconBg}
                  hoverBorder={channel.hoverBorder}
                  onClick={() => handleChannelClick(channel.id)}
                />
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer / Close Button using existing Button component */}
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="w-full justify-center py-2.5 text-xs text-slate-600 hover:text-slate-800"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};
