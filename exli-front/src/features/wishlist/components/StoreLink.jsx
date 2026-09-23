import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
export const formatStoreUrl = (url) => {
  if (!url) return '';
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
};

export const StoreLink = ({
  url,
  label,
  className = '',
  iconSize = 'w-3.5 h-3.5',
  textSize = 'text-xs',
  onClick
}) => {
  const { t } = useTranslation();
  if (!url) return null;

  const formattedUrl = formatStoreUrl(url);
  const displayLabel = label || t('wishlist.visitStore', 'Visit online store');

  return (
    <a
      href={formattedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 font-semibold text-pink-600 hover:text-pink-700 hover:underline transition-colors ${textSize} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(e);
      }}
    >
      <ExternalLink className={`${iconSize} shrink-0`} />
      <span className="truncate">{displayLabel}</span>
    </a>
  );
};
