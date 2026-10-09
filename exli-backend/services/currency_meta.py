"""
Currency display metadata for the FX feature - docs/fx/01-fx-plan.md §3 rule 8
and §5 (`currencyMeta` replaces the old 4-item `CURRENCIES` constant).

Covers the currencies FX actually supports (the CURRENCY_PAIRS candidate set
from symbol_lists.py, see fx_ingest_service.usd_pivot_currencies) - not the
full ~150-code VALID_CURRENCY_CODES set in currency_codes.py, since a
currency with no rate data shouldn't be offered in the picker anyway.

Mirrored in exli-front/src/lib/fx/currencyMeta.js - keep both in sync if a
currency is added or a minor-unit count is corrected.
"""
from typing import Optional

# minorUnits follows ISO 4217 (ISO 4217 decimal places), used to round a
# converted or entered amount to the currency's actual smallest unit - e.g.
# JPY/KRW/VND/CLP have none (¥100, not ¥100.00), while BHD/JOD/KWD/OMR have
# three (fils/dinar are quoted to 3 decimals).
CURRENCY_META = {
    'AED': {'symbol': 'AED', 'minorUnits': 2, 'nameEn': 'UAE Dirham', 'nameHe': 'דירהם איחוד האמירויות', 'flag': '🇦🇪'},
    'ARS': {'symbol': 'ARS', 'minorUnits': 2, 'nameEn': 'Argentine Peso', 'nameHe': 'פסו ארגנטינאי', 'flag': '🇦🇷'},
    'AUD': {'symbol': 'A$', 'minorUnits': 2, 'nameEn': 'Australian Dollar', 'nameHe': 'דולר אוסטרלי', 'flag': '🇦🇺'},
    'BDT': {'symbol': 'BDT', 'minorUnits': 2, 'nameEn': 'Bangladeshi Taka', 'nameHe': 'טאקה בנגלדשי', 'flag': '🇧🇩'},
    'BGN': {'symbol': 'BGN', 'minorUnits': 2, 'nameEn': 'Bulgarian Lev', 'nameHe': 'לב בולגרי', 'flag': '🇧🇬'},
    'BHD': {'symbol': 'BHD', 'minorUnits': 3, 'nameEn': 'Bahraini Dinar', 'nameHe': 'דינר בחרייני', 'flag': '🇧🇭'},
    'BRL': {'symbol': 'R$', 'minorUnits': 2, 'nameEn': 'Brazilian Real', 'nameHe': 'ריאל ברזילאי', 'flag': '🇧🇷'},
    'CAD': {'symbol': 'C$', 'minorUnits': 2, 'nameEn': 'Canadian Dollar', 'nameHe': 'דולר קנדי', 'flag': '🇨🇦'},
    'CHF': {'symbol': 'Fr', 'minorUnits': 2, 'nameEn': 'Swiss Franc', 'nameHe': 'פרנק שוויצרי', 'flag': '🇨🇭'},
    'CLP': {'symbol': 'CLP', 'minorUnits': 0, 'nameEn': 'Chilean Peso', 'nameHe': "פסו צ'יליאני", 'flag': '🇨🇱'},
    'CNY': {'symbol': 'CNY', 'minorUnits': 2, 'nameEn': 'Chinese Yuan', 'nameHe': 'יואן סיני', 'flag': '🇨🇳'},
    'COP': {'symbol': 'COP', 'minorUnits': 2, 'nameEn': 'Colombian Peso', 'nameHe': 'פסו קולומביאני', 'flag': '🇨🇴'},
    'CZK': {'symbol': 'Kč', 'minorUnits': 2, 'nameEn': 'Czech Koruna', 'nameHe': "קורונה צ'כית", 'flag': '🇨🇿'},
    'DKK': {'symbol': 'kr', 'minorUnits': 2, 'nameEn': 'Danish Krone', 'nameHe': 'כתר דני', 'flag': '🇩🇰'},
    'EGP': {'symbol': 'E£', 'minorUnits': 2, 'nameEn': 'Egyptian Pound', 'nameHe': 'לירה מצרית', 'flag': '🇪🇬'},
    'EUR': {'symbol': '€', 'minorUnits': 2, 'nameEn': 'Euro', 'nameHe': 'אירו', 'flag': '🇪🇺'},
    'GBP': {'symbol': '£', 'minorUnits': 2, 'nameEn': 'British Pound', 'nameHe': 'לירה שטרלינג', 'flag': '🇬🇧'},
    'HKD': {'symbol': 'HKD', 'minorUnits': 2, 'nameEn': 'Hong Kong Dollar', 'nameHe': 'דולר הונג קונגי', 'flag': '🇭🇰'},
    'HRK': {'symbol': 'HRK', 'minorUnits': 2, 'nameEn': 'Croatian Kuna', 'nameHe': 'קונה קרואטית', 'flag': '🇭🇷'},
    'HUF': {'symbol': 'Ft', 'minorUnits': 2, 'nameEn': 'Hungarian Forint', 'nameHe': 'פורינט הונגרי', 'flag': '🇭🇺'},
    'IDR': {'symbol': 'IDR', 'minorUnits': 2, 'nameEn': 'Indonesian Rupiah', 'nameHe': 'רופיה אינדונזית', 'flag': '🇮🇩'},
    'ILS': {'symbol': '₪', 'minorUnits': 2, 'nameEn': 'Israeli Shekel', 'nameHe': 'שקל חדש', 'flag': '🇮🇱'},
    'INR': {'symbol': '₹', 'minorUnits': 2, 'nameEn': 'Indian Rupee', 'nameHe': 'רופי הודי', 'flag': '🇮🇳'},
    'JOD': {'symbol': 'JOD', 'minorUnits': 3, 'nameEn': 'Jordanian Dinar', 'nameHe': 'דינר ירדני', 'flag': '🇯🇴'},
    'JPY': {'symbol': '¥', 'minorUnits': 0, 'nameEn': 'Japanese Yen', 'nameHe': 'ין יפני', 'flag': '🇯🇵'},
    'KES': {'symbol': 'KES', 'minorUnits': 2, 'nameEn': 'Kenyan Shilling', 'nameHe': 'שילינג קנייתי', 'flag': '🇰🇪'},
    'KRW': {'symbol': '₩', 'minorUnits': 0, 'nameEn': 'South Korean Won', 'nameHe': 'וון דרום קוריאני', 'flag': '🇰🇷'},
    'KWD': {'symbol': 'KWD', 'minorUnits': 3, 'nameEn': 'Kuwaiti Dinar', 'nameHe': 'דינר כוויתי', 'flag': '🇰🇼'},
    'MAD': {'symbol': 'MAD', 'minorUnits': 2, 'nameEn': 'Moroccan Dirham', 'nameHe': 'דירהם מרוקאי', 'flag': '🇲🇦'},
    'MXN': {'symbol': 'MXN', 'minorUnits': 2, 'nameEn': 'Mexican Peso', 'nameHe': 'פסו מקסיקני', 'flag': '🇲🇽'},
    'MYR': {'symbol': 'MYR', 'minorUnits': 2, 'nameEn': 'Malaysian Ringgit', 'nameHe': 'רינגיט מלזי', 'flag': '🇲🇾'},
    'NGN': {'symbol': '₦', 'minorUnits': 2, 'nameEn': 'Nigerian Naira', 'nameHe': 'ניירה ניגרית', 'flag': '🇳🇬'},
    'NOK': {'symbol': 'kr', 'minorUnits': 2, 'nameEn': 'Norwegian Krone', 'nameHe': 'כתר נורווגי', 'flag': '🇳🇴'},
    'NZD': {'symbol': 'NZD', 'minorUnits': 2, 'nameEn': 'New Zealand Dollar', 'nameHe': 'דולר ניו זילנד', 'flag': '🇳🇿'},
    'OMR': {'symbol': 'OMR', 'minorUnits': 3, 'nameEn': 'Omani Rial', 'nameHe': 'ריאל עומאני', 'flag': '🇴🇲'},
    'PEN': {'symbol': 'PEN', 'minorUnits': 2, 'nameEn': 'Peruvian Sol', 'nameHe': 'סול פרואני', 'flag': '🇵🇪'},
    'PHP': {'symbol': '₱', 'minorUnits': 2, 'nameEn': 'Philippine Peso', 'nameHe': 'פסו פיליפיני', 'flag': '🇵🇭'},
    'PKR': {'symbol': '₨', 'minorUnits': 2, 'nameEn': 'Pakistani Rupee', 'nameHe': 'רופי פקיסטני', 'flag': '🇵🇰'},
    'PLN': {'symbol': 'zł', 'minorUnits': 2, 'nameEn': 'Polish Zloty', 'nameHe': 'זלוטי פולני', 'flag': '🇵🇱'},
    'QAR': {'symbol': 'QAR', 'minorUnits': 2, 'nameEn': 'Qatari Riyal', 'nameHe': 'ריאל קטארי', 'flag': '🇶🇦'},
    'RON': {'symbol': 'RON', 'minorUnits': 2, 'nameEn': 'Romanian Leu', 'nameHe': 'ליאו רומני', 'flag': '🇷🇴'},
    'RUB': {'symbol': '₽', 'minorUnits': 2, 'nameEn': 'Russian Ruble', 'nameHe': 'רובל רוסי', 'flag': '🇷🇺'},
    'SAR': {'symbol': 'SAR', 'minorUnits': 2, 'nameEn': 'Saudi Riyal', 'nameHe': 'ריאל סעודי', 'flag': '🇸🇦'},
    'SEK': {'symbol': 'kr', 'minorUnits': 2, 'nameEn': 'Swedish Krona', 'nameHe': 'כתר שוודי', 'flag': '🇸🇪'},
    'SGD': {'symbol': 'SGD', 'minorUnits': 2, 'nameEn': 'Singapore Dollar', 'nameHe': 'דולר סינגפורי', 'flag': '🇸🇬'},
    'THB': {'symbol': '฿', 'minorUnits': 2, 'nameEn': 'Thai Baht', 'nameHe': 'באט תאילנדי', 'flag': '🇹🇭'},
    'TRY': {'symbol': '₺', 'minorUnits': 2, 'nameEn': 'Turkish Lira', 'nameHe': 'לירה טורקית', 'flag': '🇹🇷'},
    'TWD': {'symbol': 'TWD', 'minorUnits': 2, 'nameEn': 'Taiwan Dollar', 'nameHe': 'דולר טאיווני', 'flag': '🇹🇼'},
    'USD': {'symbol': '$', 'minorUnits': 2, 'nameEn': 'US Dollar', 'nameHe': 'דולר אמריקאי', 'flag': '🇺🇸'},
    'VND': {'symbol': '₫', 'minorUnits': 0, 'nameEn': 'Vietnamese Dong', 'nameHe': 'דונג וייטנמי', 'flag': '🇻🇳'},
    'ZAR': {'symbol': 'ZAR', 'minorUnits': 2, 'nameEn': 'South African Rand', 'nameHe': 'ראנד דרום אפריקאי', 'flag': '🇿🇦'},
}

DEFAULT_MINOR_UNITS = 2


def get_minor_units(currency: str) -> int:
    """Falls back to 2 (the ISO 4217 default) for a currency not in the
    table, rather than crashing - callers may still see legacy currencies
    (e.g. from old manually-typed expense rows) that FX doesn't track."""
    meta = CURRENCY_META.get(currency)
    return meta['minorUnits'] if meta else DEFAULT_MINOR_UNITS


def round_to_minor_units(amount: float, currency: str) -> float:
    """Rounds to the currency's actual smallest unit (0/2/3 decimals), not a
    hardcoded 2 - see the module docstring."""
    units = get_minor_units(currency)
    return round(amount, units)


def get_meta(currency: str) -> Optional[dict]:
    return CURRENCY_META.get(currency)


def supported_currencies() -> list:
    return sorted(CURRENCY_META.keys())
