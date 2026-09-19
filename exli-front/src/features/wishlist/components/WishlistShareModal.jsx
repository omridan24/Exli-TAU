import React, { useState } from 'react';
import { X, Share2, Copy, Mail, Check, Link2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { getCurrencySymbol } from './WishlistCard';

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

  // Find category details for preview
  const catDetails =
    categories.find((c) => c.id === item.category) ||
    DEFAULT_CATEGORIES.find((c) => c.id === item.category) || {
      id: 'other',
      name: item.category || 'Other',
      color: '#ec4899',
      icon: 'Gift'
    };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/wishlist/item/${item.id}`
    : `https://exli.app/wishlist/item/${item.id}`;

  const handleCopyLink = (e) => {
    e.preventDefault();
    // Do not include sharing functionality per specification, but optionally show subtle feedback or no-op
    // Specification: "-do not include sharing funcionability (clicking "whatsapp" should do nothing)"
  };

  const handleShareClick = (e) => {
    e.preventDefault();
    // Specification: clicking sharing options should do nothing
  };

  const shareChannels = [
    {
      id: 'whatsapp',
      name: t('wishlist.whatsapp'),
      icon: WhatsAppIcon,
      iconBg: 'bg-[#25D366] text-white',
      hoverBorder: 'hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800'
    },
    {
      id: 'copy',
      name: t('wishlist.copyLink'),
      icon: Link2,
      iconBg: 'bg-pink-500 text-white',
      hoverBorder: 'hover:border-pink-300 hover:bg-pink-50/50 hover:text-pink-800'
    },
    {
      id: 'email',
      name: t('wishlist.email'),
      icon: Mail,
      iconBg: 'bg-blue-500 text-white',
      hoverBorder: 'hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800'
    },
    {
      id: 'x',
      name: t('wishlist.x'),
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
                {t('wishlist.shareTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('wishlist.shareSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            title={t('common.close') || 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item mini-preview */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200/60"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${catDetails.color}15`, color: catDetails.color }}
              >
                <CategoryIcon iconName={catDetails.icon} className="w-6 h-6" color={catDetails.color} />
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-800 truncate">
                {item.name}
              </h4>
              <span className="text-[11px] text-slate-500 block truncate">
                {catDetails.name || item.category}
              </span>
              {item.storeUrl && (
                <a
                  href={item.storeUrl.startsWith('http') ? item.storeUrl : `https://${item.storeUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-600 hover:text-pink-700 hover:underline mt-0.5"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{t('wishlist.visitStore')}</span>
                </a>
              )}
            </div>
          </div>

          <div className="text-end shrink-0 ps-2">
            <div className="text-base font-extrabold text-slate-900 font-mono">
              <span className="text-pink-600 me-0.5">{getCurrencySymbol(item.currency)}</span>
              {Number(item.price || 0).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              })}
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              {item.currency || 'ILS'}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Shareable Link Bar */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('wishlist.shareLink')}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 select-all outline-none font-mono truncate focus:border-pink-300"
                />
              </div>
              <button
                type="button"
                onClick={handleShareClick}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t('wishlist.copyLink')}</span>
              </button>
            </div>
          </div>

          {/* Optional Note / Message */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('wishlist.shareMessage')}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('wishlist.shareMessagePlaceholder')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-pink-500 focus:bg-white transition-all"
            />
          </div>

          {/* Sharing Channels Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('wishlist.shareVia')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {shareChannels.map((channel) => {
                const IconComponent = channel.icon;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={handleShareClick}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 ${channel.hoverBorder} transition-all duration-200 text-start group shadow-xs hover:shadow-sm`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${channel.iconBg} group-hover:scale-105 transition-transform`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 truncate">
                      {channel.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Modal Footer / Close Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
