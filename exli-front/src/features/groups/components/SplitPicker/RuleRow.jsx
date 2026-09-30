import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { splitRuleName, splitRuleEmoji, splitRuleDescription } from '../../utils/splitCatalog';
import { formatMinorAmount } from '../../utils/money';

export const RuleRow = ({ rule, shares, members, currency, isSelected, isDisabled, disabledReason, onSelect }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onSelect(rule.id)}
      disabled={isDisabled}
      className={`w-full text-start p-3 rounded-xl border-2 transition-all ${
        isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
          <span>{splitRuleEmoji(rule)}</span> {splitRuleName(rule, t)}
        </span>
        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
      </div>
      <p className="text-xs text-slate-400 mt-0.5">{splitRuleDescription(rule, t)}</p>
      {isDisabled ? (
        <p className="text-xs text-amber-600 mt-1">{disabledReason}</p>
      ) : shares ? (
        <p className="text-xs text-slate-500 mt-1 truncate">
          {Object.entries(shares).map(([uid, amount], i) => (
            <span key={uid}>{i > 0 && ' · '}{members?.[uid] || uid} {formatMinorAmount(amount, currency)}</span>
          ))}
        </p>
      ) : null}
    </button>
  );
};
