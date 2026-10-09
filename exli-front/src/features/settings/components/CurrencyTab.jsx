import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';
import { CurrencyPicker } from '../../../components/CurrencyPicker';
import { useCurrencyPrefs } from '../../../lib/fx/useCurrencyPrefs';
import { supportedCurrencies } from '../../../lib/fx/currencyMeta';
import { SwitchDefaultCurrencyModal } from './SwitchDefaultCurrencyModal';

/**
 * The "Currency" section from docs/fx/01-fx-plan.md §4: the default
 * currency, what happens when something's in a different one, and
 * favorites for the picker. userId drives its own Firestore sync via
 * useCurrencyPrefs, so it needs no save button of its own.
 */
export const CurrencyTab = ({ userId }) => {
    const { t } = useTranslation();
    const { prefs, setDefaultCurrency, setFavoriteCurrencies } = useCurrencyPrefs(userId);
    const [offerSwitchConvert, setOfferSwitchConvert] = useState(false);

    // Switching the default never rewrites records by itself: once the new default is
    // saved, a popup offers (and double-confirms) converting existing records.
    const handleDefaultChange = async (code) => {
        if (code === prefs.defaultCurrency) return;
        await setDefaultCurrency(code);
        setOfferSwitchConvert(true);
    };

    const toggleFavorite = (code) => {
        const next = prefs.favoriteCurrencies.includes(code)
            ? prefs.favoriteCurrencies.filter((c) => c !== code)
            : [...prefs.favoriteCurrencies, code];
        setFavoriteCurrencies(next);
    };

    return (
        <div className="space-y-6">
            <Card className="p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-2">
                    <Wallet className="text-emerald-500" /> {t('settings.currency.title')}
                </h2>

                <div className="space-y-8 max-w-xl">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('settings.currency.defaultCurrency')}
                        </label>
                        <CurrencyPicker value={prefs.defaultCurrency} onChange={handleDefaultChange} favorites={prefs.favoriteCurrencies} />
                        <p className="text-sm text-slate-400 mt-2">{t('settings.currency.defaultCurrencyHint')}</p>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('settings.currency.favorites')}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {supportedCurrencies().map((code) => (
                                <button
                                    key={code}
                                    onClick={() => toggleFavorite(code)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${prefs.favoriteCurrencies.includes(code) ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                >
                                    {code}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
            {offerSwitchConvert && (
                <SwitchDefaultCurrencyModal userId={userId} onClose={() => setOfferSwitchConvert(false)} />
            )}
        </div>
    );
};

export default CurrencyTab;
