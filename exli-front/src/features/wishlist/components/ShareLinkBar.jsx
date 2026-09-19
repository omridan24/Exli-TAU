import React from 'react';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ShareLinkBar = ({
  link,
  hasLink,
  copied,
  onCopy,
  label,
  emptyMessage,
  className = ''
}) => {
  const { t } = useTranslation();

  const displayLabel = label || t('wishlist.shareLink', 'Item link');
  const displayEmpty = emptyMessage || t('wishlist.noStoreUrlProvided', 'No store link was provided');
  const copyText = copied ? t('wishlist.copied', 'Copied!') : t('wishlist.copyLink', 'Copy link');

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {displayLabel}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            readOnly
            value={hasLink ? link : displayEmpty}
            className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none truncate transition-colors ${
              hasLink
                ? 'text-slate-600 font-mono select-all focus:border-pink-300'
                : 'text-slate-400 italic cursor-default'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!hasLink}
          className={`px-3.5 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-xs ${
            hasLink
              ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
              : 'border-slate-200/60 bg-slate-100 text-slate-400 cursor-not-allowed opacity-75'
          }`}
          title={hasLink ? copyText : displayEmpty}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span className={copied ? 'text-emerald-700 font-bold' : ''}>
            {copyText}
          </span>
        </button>
      </div>
    </div>
  );
};
