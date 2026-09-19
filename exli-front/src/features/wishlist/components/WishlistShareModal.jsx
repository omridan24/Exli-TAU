import React, { useState } from 'react';
import { X, Share2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { getCurrencySymbol, formatStoreUrl } from './WishlistCard';
import { WishlistMiniPreview } from './WishlistMiniPreview';
import { ShareLinkBar } from './ShareLinkBar';
import { ShareChannelButton } from './ShareChannelButton';

// WhatsApp brand SVG icon
const WhatsAppIcon = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.05 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// X (formerly Twitter) brand SVG icon
const XIcon = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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

  const handleWhatsAppShare = () => {
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
    lines.push(t('wishlist.whatsappShareDisclosure', '✨ An item from my wishlist on Exli'));

    const message = lines.filter(Boolean).join('\n\n');
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleChannelClick = (channelId) => {
    if (channelId === 'whatsapp') {
      handleWhatsAppShare();
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
