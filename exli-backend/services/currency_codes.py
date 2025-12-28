"""
Currency validation and normalization using ISO 4217 codes.
Handles symbol mapping and provides graceful fallback to ILS.
"""
import re
from config import logger

# ISO 4217 Currency Codes (Major + Regional currencies)
VALID_CURRENCY_CODES = {
    'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
    'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
    'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
    'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
    'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
    'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS',
    'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR',
    'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD',
    'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU',
    'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK',
    'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
    'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK',
    'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB',
    'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX',
    'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF',
    'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL'
}

# Symbol to ISO Code Mapping
SYMBOL_TO_CODE = {
    '₪': 'ILS',
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    'C$': 'CAD',
    'A$': 'AUD',
    'R$': 'BRL',
    'kr': 'SEK',
    'Fr': 'CHF',
    '₺': 'TRY',
    '₽': 'RUB',
    'zł': 'PLN',
    'Kč': 'CZK',
    'Ft': 'HUF'
}

def normalize_currency(raw_value, default='ILS'):
    """
    Validates and normalizes currency to ISO 4217 code.
    
    Args:
        raw_value: Raw currency value from data (str, symbol, or code)
        default: Default currency code if validation fails (default: 'ILS')
    
    Returns:
        str: Valid ISO 4217 currency code
    
    Examples:
        >>> normalize_currency('USD')
        'USD'
        >>> normalize_currency('$')
        'USD'
        >>> normalize_currency('₪')
        'ILS'
        >>> normalize_currency('שונות')  # Hebrew garbage
        'ILS'
    """
    if not raw_value or raw_value is None:
        return default
    
    # Convert to string and clean
    val_str = str(raw_value).strip()
    val_upper = val_str.upper()
    
    # 1. Check if already a valid ISO code
    if val_upper in VALID_CURRENCY_CODES:
        return val_upper
    
    # 2. Check symbol mapping (exact match first)
    if val_str in SYMBOL_TO_CODE:
        return SYMBOL_TO_CODE[val_str]
    
    # 3. Check if symbol is contained in the value
    for symbol, code in SYMBOL_TO_CODE.items():
        if symbol in val_str:
            return code
    
    # 4. Detect Hebrew characters (common issue in Israeli bank exports)
    if re.search(r'[\u0590-\u05FF]', val_str):
        logger.warning(f"Currency contains Hebrew characters '{val_str}' - defaulting to {default}")
        return default
    
    # 5. Check if it's garbage (too long for a currency code)
    if len(val_str) > 4:
        logger.warning(f"Currency string too long '{val_str}' ({len(val_str)} chars) - defaulting to {default}")
        return default
    
    # 6. Unknown currency - log and return default
    logger.warning(f"Unknown currency '{val_str}' - defaulting to {default}")
    return default
