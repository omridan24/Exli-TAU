/**
 * Replaces the old 4-item `<select>` (CURRENCIES constant) everywhere a
 * currency is chosen — docs/fx/01-fx-plan.md §5. Searchable by code, name
 * (English or Hebrew) or symbol; favorites and recently-used first; only
 * ever lists currencies FX actually has metadata/rates for.
 *
 * A trigger button (shows the current selection) opens a search modal,
 * matching the app's existing SelectionModal interaction pattern.
 */
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CURRENCY_META, getName, supportedCurrencies } from '../lib/fx/currencyMeta';

const RECENT_STORAGE_KEY = 'exli:currencyPicker:recent';
const MAX_RECENT = 5;

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function pushRecent(code) {
  try {
    const next = [code, ...readRecent().filter((c) => c !== code)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort only
  }
}

/**
 * @param {{
 *   value: string,
 *   onChange: (code:string) => void,
 *   favorites?: string[],
 *   className?: string,
 *   disabled?: boolean,
 * }} props
 */
export function CurrencyPicker({ value, onChange, favorites = [], className = '', disabled = false }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const language = i18n.language;
  const allCodes = useMemo(() => supportedCurrencies(), []);
  // Re-reads localStorage each time the modal opens (a pick just made should
  // show up as "recent" immediately) - `open` is a deliberate re-run trigger,
  // not a value read inside the memo, so it's fine that it's otherwise unused.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recent = useMemo(() => readRecent().filter((c) => allCodes.includes(c)), [open, allCodes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (code) => {
      if (!q) return true;
      const meta = CURRENCY_META[code];
      return (
        code.toLowerCase().includes(q) ||
        meta.nameEn.toLowerCase().includes(q) ||
        meta.nameHe.includes(search.trim()) ||
        meta.symbol.toLowerCase().includes(q)
      );
    };
    return allCodes.filter(matches);
  }, [allCodes, search]);

  const priority = [...new Set([...favorites, ...recent])].filter((c) => filtered.includes(c));
  const rest = filtered.filter((c) => !priority.includes(c));

  const select = (code) => {
    pushRecent(code);
    onChange(code);
    setOpen(false);
    setSearch('');
  };

  const currentMeta = CURRENCY_META[value];

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {currentMeta ? (
          <>
            <span aria-hidden="true">{currentMeta.flag}</span>
            <span className="font-bold">{value}</span>
          </>
        ) : (
          <span className="text-slate-400">{t('currencyPicker.select')}</span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md h-[70vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{t('currencyPicker.title')}</h3>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-100 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-7 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder={t('currencyPicker.search')}
                className="w-full p-3 pl-10 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {priority.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                    <Star className="w-3 h-3" /> {t('currencyPicker.favorites')}
                  </div>
                  {priority.map((code) => (
                    <CurrencyRow key={code} code={code} language={language} active={code === value} onClick={() => select(code)} />
                  ))}
                  <div className="border-t border-slate-100 my-2" />
                </div>
              )}
              {rest.map((code) => (
                <CurrencyRow key={code} code={code} language={language} active={code === value} onClick={() => select(code)} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-bold">{t('common.noResults')}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CurrencyRow({ code, language, active, onClick }) {
  const meta = CURRENCY_META[code];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${active ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'}`}
    >
      <span className="text-xl" aria-hidden="true">{meta.flag}</span>
      <span className="font-bold w-14">{code}</span>
      <span className="text-slate-500 flex-1 truncate">{getName(code, language)}</span>
      <span className="text-slate-400">{meta.symbol}</span>
    </button>
  );
}

export default CurrencyPicker;
