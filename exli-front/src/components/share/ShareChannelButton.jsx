import React from 'react';
import { Check } from 'lucide-react';

export const ShareChannelButton = ({
  name,
  icon: IconComponent,
  iconBg,
  hoverBorder,
  isCopied = false,
  copiedText = 'Copied!',
  onClick
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 p-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 ${hoverBorder} transition-all duration-200 text-start group shadow-xs hover:shadow-sm`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${iconBg} group-hover:scale-105 transition-transform`}
      >
        {isCopied ? <Check className="w-4 h-4 text-white" /> : <IconComponent className="w-4 h-4" />}
      </div>
      <span className={`text-xs font-bold truncate ${isCopied ? 'text-emerald-700' : 'text-slate-700 group-hover:text-slate-900'}`}>
        {isCopied ? copiedText : name}
      </span>
    </button>
  );
};
