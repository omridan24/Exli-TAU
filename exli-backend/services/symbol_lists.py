"""
Symbol lists for market data ingestion.
Contains S&P 500 stocks, major ETFs, and currency pairs with aliases.
"""

# S&P 500 Stocks (Core 500 - these will be updated with full list)
SP500_SYMBOLS = [
    # Technology
    "AAPL", "MSFT", "GOOGL", "GOOG", "META", "NVDA", "AVGO", "ORCL", "CRM", "ADBE",
    "CSCO", "ACN", "IBM", "INTC", "AMD", "TXN", "QCOM", "NOW", "AMAT", "MU",
    "LRCX", "KLAC", "SNPS", "CDNS", "PANW", "FTNT", "CRWD",
    # Financials
    "BRK.B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "C",
    "BLK", "SCHW", "CB", "MMC", "PGR", "AON", "CME", "ICE", "SPGI", "MCO",
    "USB", "PNC", "TFC", "COF", "BK", "MET", "AIG", "PRU", "ALL", "AFL",
    # Healthcare
    "UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY",
    "AMGN", "MDT", "ELV", "ISRG", "GILD", "VRTX", "REGN", "SYK", "BSX", "ZTS",
    "BDX", "CVS", "CI", "HUM", "MCK", "CAH", "BIIB", "MRNA", "DXCM", "IQV",
    # Consumer Discretionary
    "AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG", "CMG",
    "ORLY", "AZO", "ROST", "MAR", "HLT", "YUM", "DG", "DLTR", "EBAY", "ETSY",
    "GM", "F", "DHI", "LEN", "PHM", "NVR", "GRMN", "POOL", "BBY", "ULTA",
    # Consumer Staples
    "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "KMB",
    "GIS", "K", "HSY", "SJM", "CAG", "CPB", "MKC", "HRL", "CHD", "CLX",
    "EL", "KR", "SYY", "WBA", "TGT", "STZ", "TAP", "ADM", "BG", "TSN",
    # Energy
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "PXD", "OXY",
    "HES", "DVN", "KMI", "WMB", "OKE", "HAL", "BKR", "FANG", "CTRA", "APA",
    # Industrials
    "CAT", "RTX", "HON", "UPS", "BA", "DE", "LMT", "GE", "UNP", "ADP",
    "MMM", "CSX", "NSC", "ITW", "EMR", "ETN", "PH", "ROK", "JCI", "GD",
    "FDX", "WM", "RSG", "PCAR", "FAST", "ODFL", "PWR", "URI", "AME", "CARR",
    # Materials
    "LIN", "APD", "SHW", "ECL", "DD", "PPG", "NEM", "FCX", "NUE", "VMC",
    "MLM", "DOW", "CTVA", "ALB", "IFF", "FMC", "CE", "CF", "MOS", "LYB",
    # Real Estate
    "PLD", "AMT", "EQIX", "CCI", "SPG", "PSA", "O", "WELL", "DLR", "AVB",
    "EQR", "VICI", "VTR", "SBAC", "ARE", "MAA", "UDR", "ESS", "PEAK", "KIM",
    # Utilities
    "NEE", "SO", "DUK", "D", "SRE", "AEP", "EXC", "XEL", "ED", "WEC",
    "PCG", "AWK", "ES", "EIX", "DTE", "AEE", "FE", "PPL", "CMS", "CNP",
    # Communication Services
    "NFLX", "DIS", "CMCSA", "VZ", "T", "CHTR", "TMUS", "WBD", "EA", "TTWO",
    "OMC", "IPG", "PARA", "FOX", "FOXA", "NWS", "NWSA", "LYV", "MTCH", "ZG",
]

# Major ETFs (US and Global)
ETFS = [
    # US Broad Market
    "SPY", "VOO", "IVV", "VTI", "QQQ", "DIA", "IWM", "IWF", "IWD", "VUG",
    "VTV", "MGK", "MDY", "IJH", "VB", "VO", "SCHD", "VIG", "DVY", "SDY",
    # Sector ETFs
    "XLK", "XLF", "XLV", "XLE", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE",
    "VGT", "VFH", "VHT", "VDE", "VIS", "VCR", "VDC", "VPU", "VAW", "VNQ",
    # International - Developed Markets
    "EFA", "VEA", "IEFA", "EWJ", "EWG", "EWU", "EWC", "EWA", "EWH", "EWS",
    "EWY", "EWT", "EWZ", "EWW", "EWI", "EWP", "EWQ", "EWL", "EWN", "EWD",
    # International - Emerging Markets
    "VWO", "EEM", "IEMG", "EWZ", "FXI", "INDA", "EWY", "EWT", "THD", "VNM",
    "KWT", "MCHI", "KWEB", "GXG", "TUR", "EZA", "ERUS", "ECH", "AFK", "FM",
    # European ETFs
    "VGK", "FEZ", "EZU", "HEDJ", "EWG", "EWU", "EWQ", "EWI", "EWP", "EWL",
    # Bond ETFs
    "BND", "AGG", "TLT", "IEF", "SHY", "LQD", "HYG", "JNK", "TIP", "MUB",
    # Commodity ETFs
    "GLD", "SLV", "IAU", "GDX", "USO", "UNG", "DBA", "DBC", "PDBC", "GLTR",
    # Thematic / Factor ETFs
    "ARKK", "ARKG", "ARKW", "ARKQ", "ARKF", "XBI", "IBB", "SOXX", "SMH", "HACK",
    "MTUM", "QUAL", "VLUE", "SIZE", "USMV", "EFAV", "EEMV", "SPHD", "HDV", "NOBL",
]

# Currency pairs with ILS as quote currency
# This gives you "how many ILS for 1 unit of base currency"
CURRENCY_PAIRS = [
    # Major currencies vs ILS
    ("USD", "ILS"),  # US Dollar
    ("EUR", "ILS"),  # Euro
    ("GBP", "ILS"),  # British Pound
    ("JPY", "ILS"),  # Japanese Yen (often quoted per 100)
    ("CHF", "ILS"),  # Swiss Franc
    ("CAD", "ILS"),  # Canadian Dollar
    ("AUD", "ILS"),  # Australian Dollar
    ("NZD", "ILS"),  # New Zealand Dollar
    ("CNY", "ILS"),  # Chinese Yuan
    ("HKD", "ILS"),  # Hong Kong Dollar
    ("SGD", "ILS"),  # Singapore Dollar
    ("SEK", "ILS"),  # Swedish Krona
    ("NOK", "ILS"),  # Norwegian Krone
    ("DKK", "ILS"),  # Danish Krone
    ("INR", "ILS"),  # Indian Rupee
    ("KRW", "ILS"),  # South Korean Won
    ("RUB", "ILS"),  # Russian Ruble
    ("BRL", "ILS"),  # Brazilian Real
    ("MXN", "ILS"),  # Mexican Peso
    ("ZAR", "ILS"),  # South African Rand
    ("TRY", "ILS"),  # Turkish Lira
    ("PLN", "ILS"),  # Polish Zloty
    ("THB", "ILS"),  # Thai Baht
    ("MYR", "ILS"),  # Malaysian Ringgit
    ("IDR", "ILS"),  # Indonesian Rupiah
    ("PHP", "ILS"),  # Philippine Peso
    ("CZK", "ILS"),  # Czech Koruna
    ("HUF", "ILS"),  # Hungarian Forint
    ("AED", "ILS"),  # UAE Dirham
    ("SAR", "ILS"),  # Saudi Riyal
    ("EGP", "ILS"),  # Egyptian Pound
    ("CLP", "ILS"),  # Chilean Peso
    ("COP", "ILS"),  # Colombian Peso
    ("PEN", "ILS"),  # Peruvian Sol
    ("ARS", "ILS"),  # Argentine Peso
    ("VND", "ILS"),  # Vietnamese Dong
    ("TWD", "ILS"),  # Taiwan Dollar
    ("RON", "ILS"),  # Romanian Leu
    ("BGN", "ILS"),  # Bulgarian Lev
    ("HRK", "ILS"),  # Croatian Kuna
    ("JOD", "ILS"),  # Jordanian Dinar
    ("KWD", "ILS"),  # Kuwaiti Dinar
    ("BHD", "ILS"),  # Bahraini Dinar
    ("OMR", "ILS"),  # Omani Rial
    ("QAR", "ILS"),  # Qatari Riyal
    ("MAD", "ILS"),  # Moroccan Dirham
    ("NGN", "ILS"),  # Nigerian Naira
    ("KES", "ILS"),  # Kenyan Shilling
    ("PKR", "ILS"),  # Pakistani Rupee
    ("BDT", "ILS"),  # Bangladeshi Taka
]

# Symbol aliases mapping (English and Hebrew)
# Key: Official symbol, Value: List of aliases for fuzzy matching
SYMBOL_ALIASES = {
    # Big Tech
    "AAPL": ["apple", "apple inc", "אפל", "אפל אינק"],
    "MSFT": ["microsoft", "מיקרוסופט", "מייקרוסופט"],
    "GOOGL": ["google", "alphabet", "גוגל", "אלפבית"],
    "GOOG": ["google class c", "גוגל סי"],
    "META": ["meta", "facebook", "fb", "מטא", "פייסבוק"],
    "AMZN": ["amazon", "אמזון"],
    "NVDA": ["nvidia", "אנבידיה", "נבידיה"],
    "TSLA": ["tesla", "טסלה"],
    "NFLX": ["netflix", "נטפליקס"],
    # Finance
    "JPM": ["jp morgan", "jpmorgan", "chase", "ג'יי פי מורגן"],
    "V": ["visa", "ויזה"],
    "MA": ["mastercard", "מאסטרקארד"],
    "BAC": ["bank of america", "בנק אוף אמריקה"],
    "GS": ["goldman sachs", "גולדמן סאקס"],
    "MS": ["morgan stanley", "מורגן סטנלי"],
    "BRK.B": ["berkshire hathaway", "berkshire", "ברקשייר", "ברקשייר האת'ווי"],
    # Healthcare & Pharma
    "JNJ": ["johnson johnson", "j&j", "ג'ונסון"],
    "PFE": ["pfizer", "פייזר"],
    "UNH": ["unitedhealth", "united health", "יונייטד הלת'"],
    "MRK": ["merck", "מרק"],
    "ABBV": ["abbvie", "אבווי"],
    "LLY": ["eli lilly", "lilly", "אלי לילי"],
    # Consumer
    "KO": ["coca cola", "coke", "קוקה קולה"],
    "PEP": ["pepsi", "pepsico", "פפסי"],
    "WMT": ["walmart", "וולמארט"],
    "COST": ["costco", "קוסטקו"],
    "HD": ["home depot", "הום דיפו"],
    "MCD": ["mcdonalds", "מקדונלדס"],
    "SBUX": ["starbucks", "סטארבקס"],
    "NKE": ["nike", "נייקי"],
    "DIS": ["disney", "walt disney", "דיסני"],
    # Energy
    "XOM": ["exxon", "exxon mobil", "אקסון"],
    "CVX": ["chevron", "שברון"],
    # Industrial
    "BA": ["boeing", "בואינג"],
    "CAT": ["caterpillar", "קטרפילר"],
    "GE": ["general electric", "ge", "ג'נרל אלקטריק"],
    "HON": ["honeywell", "האניוול"],
    # ETFs
    "SPY": ["s&p 500", "s&p", "sp500", "אס אנד פי"],
    "VOO": ["vanguard s&p 500", "ואנגארד"],
    "QQQ": ["nasdaq 100", "qqq", "נאסדק 100"],
    "VTI": ["total stock market", "vti"],
    "IVV": ["ishares s&p 500", "איישרס"],
    "DIA": ["dow jones", "diamonds", "דאו ג'ונס"],
    "IWM": ["russell 2000", "ראסל"],
    "EFA": ["developed markets", "שווקים מפותחים"],
    "VWO": ["emerging markets", "שווקים מתעוררים"],
    "GLD": ["gold etf", "spdr gold", "זהב"],
    "SLV": ["silver etf", "כסף"],
    "VNQ": ["real estate etf", "נדלן"],
}

# Currency aliases (English and Hebrew)
CURRENCY_ALIASES = {
    "USD": ["dollar", "usd", "דולר", "דולר אמריקאי"],
    "EUR": ["euro", "eur", "אירו", "יורו"],
    "GBP": ["pound", "sterling", "gbp", "לירה שטרלינג", "פאונד"],
    "JPY": ["yen", "jpy", "ין", "ין יפני"],
    "CHF": ["swiss franc", "chf", "פרנק שוויצרי"],
    "CAD": ["canadian dollar", "cad", "דולר קנדי"],
    "AUD": ["australian dollar", "aud", "דולר אוסטרלי"],
    "CNY": ["yuan", "renminbi", "cny", "יואן", "רנמינבי", "יואן סיני"],
    "INR": ["rupee", "inr", "רופי", "רופי הודי"],
    "KRW": ["won", "krw", "וון", "וון קוריאני"],
    "BRL": ["real", "brl", "ריאל", "ריאל ברזילאי"],
    "RUB": ["ruble", "rub", "רובל", "רובל רוסי"],
    "TRY": ["lira", "try", "לירה", "לירה טורקית"],
    "AED": ["dirham", "aed", "דירהם", "דירהם איחוד האמירויות"],
    "SAR": ["riyal", "sar", "ריאל", "ריאל סעודי"],
    "ILS": ["shekel", "ils", "שקל", "שח", "שקל חדש"],
    "EGP": ["egyptian pound", "egp", "לירה מצרית"],
    "JOD": ["jordanian dinar", "jod", "דינר ירדני"],
}

def get_all_symbols():
    """Get combined list of all stocks and ETFs"""
    return SP500_SYMBOLS + ETFS

def get_symbol_count():
    """Get total symbol count"""
    return len(SP500_SYMBOLS) + len(ETFS)
