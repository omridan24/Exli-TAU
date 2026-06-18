"""
Category Dictionary for Auto-Categorization.

Maps credit-card company category names (Hebrew & English) to Exli category IDs.
Deterministic — no AI, no network calls. Pure dictionary lookup with fuzzy fallback.

Exli Categories (from constants.js):
  food, groceries, transport, shopping, housing, bills,
  travel, health, education, pets, gifts, entertainment, other
"""

from config import logger

# ---------------------------------------------------------------------------
# Master dictionary: lowercased credit-card category term → Exli category ID
# ---------------------------------------------------------------------------
# Each key is a term that may appear in a credit-card expense report.
# Values are the Exli category IDs matching DEFAULT_CATEGORIES in constants.js.

CATEGORY_MAP = {
    # ---- Food & Dining → "food" ----
    "מזון": "food",
    "מסעדות": "food",
    "בתי קפה": "food",
    "בית קפה": "food",
    "מזון ומסעדות": "food",
    "מזון ושתייה": "food",
    "אוכל": "food",
    "מסעדה": "food",
    "קפה": "food",
    "מזון מהיר": "food",
    "פיצה": "food",
    "food": "food",
    "restaurants": "food",
    "dining": "food",
    "cafe": "food",
    "coffee": "food",
    "fast food": "food",
    "food & dining": "food",
    "food and dining": "food",
    "food & beverage": "food",
    "food and beverage": "food",
    "eating out": "food",
    "takeout": "food",
    "delivery": "food",

    # ---- Groceries → "groceries" ----
    "סופרמרקט": "groceries",
    "מכולת": "groceries",
    "סופר": "groceries",
    "שוק": "groceries",
    "קניות מזון": "groceries",
    "מרכול": "groceries",
    "רשת מזון": "groceries",
    "שופרסל": "groceries",
    "רמי לוי": "groceries",
    "יוחננוף": "groceries",
    "ויקטורי": "groceries",
    "חצי חינם": "groceries",
    "מחסני השוק": "groceries",
    "טיב טעם": "groceries",
    "קשת טעמים": "groceries",
    "אמפמ": "groceries",
    "am:pm": "groceries",
    "am pm": "groceries",
    "supermarket": "groceries",
    "grocery": "groceries",
    "groceries": "groceries",
    "market": "groceries",
    "convenience store": "groceries",

    # ---- Transport → "transport" ----
    "דלק": "transport",
    "תחבורה": "transport",
    "חניה": "transport",
    "חנייה": "transport",
    "תחבורה ודלק": "transport",
    "רכב": "transport",
    "תדלוק": "transport",
    "אגרת כביש": "transport",
    "כביש אגרה": "transport",
    "מוניות": "transport",
    "מונית": "transport",
    "אוטובוס": "transport",
    "רכבת": "transport",
    "fuel": "transport",
    "gas": "transport",
    "gas station": "transport",
    "parking": "transport",
    "transportation": "transport",
    "transport": "transport",
    "taxi": "transport",
    "uber": "transport",
    "ride": "transport",
    "toll": "transport",
    "auto": "transport",
    "car": "transport",
    "vehicle": "transport",
    "automotive": "transport",
    "תחנת דלק": "transport",
    "פז": "transport",
    "סונול": "transport",
    "דור אלון": "transport",
    "מיקה": "transport",
    "דלק מנטה": "transport",

    # ---- Shopping → "shopping" ----
    "ביגוד": "shopping",
    "הלבשה": "shopping",
    "קניות": "shopping",
    "אופנה": "shopping",
    "הנעלה": "shopping",
    "ביגוד והנעלה": "shopping",
    "חנויות": "shopping",
    "חנות": "shopping",
    "אלקטרוניקה": "shopping",
    "מוצרי חשמל": "shopping",
    "ריהוט": "shopping",
    "clothing": "shopping",
    "apparel": "shopping",
    "shopping": "shopping",
    "fashion": "shopping",
    "retail": "shopping",
    "electronics": "shopping",
    "department store": "shopping",
    "online shopping": "shopping",
    "amazon": "shopping",
    "aliexpress": "shopping",

    # ---- Housing → "housing" ----
    "דיור": "housing",
    "בית": "housing",
    "ארנונה": "housing",
    "שכירות": "housing",
    "שכ\"ד": "housing",
    "שכר דירה": "housing",
    "ועד בית": "housing",
    "משכנתא": "housing",
    "דירה": "housing",
    "housing": "housing",
    "home": "housing",
    "home expenses": "housing",
    "rent": "housing",
    "mortgage": "housing",
    "property tax": "housing",
    "home maintenance": "housing",
    "household": "housing",

    # ---- Bills & Utilities → "bills" ----
    "חשבונות": "bills",
    "חשמל": "bills",
    "מים": "bills",
    "גז": "bills",
    "אינטרנט": "bills",
    "סלולר": "bills",
    "תקשורת": "bills",
    "טלפון": "bills",
    "כבלים": "bills",
    "טלוויזיה": "bills",
    "ביטוח": "bills",
    "חשבון חשמל": "bills",
    "חשבון מים": "bills",
    "חשבון גז": "bills",
    "פזגז": "bills",
    "אמישראגז": "bills",
    "סופרגז": "bills",
    "חשבון טלפון": "bills",
    "שירותים": "bills",
    "utilities": "bills",
    "bills": "bills",
    "electricity": "bills",
    "water": "bills",
    "phone": "bills",
    "internet": "bills",
    "cable": "bills",
    "mobile": "bills",
    "cell phone": "bills",
    "insurance": "bills",
    "subscription": "bills",
    "subscriptions": "bills",
    "bills & utilities": "bills",
    "bills and utilities": "bills",
    "utility": "bills",

    # ---- Travel → "travel" ----
    "נסיעות": "travel",
    "תיירות": "travel",
    "מלונות": "travel",
    "טיסות": "travel",
    "חופשה": "travel",
    "חו\"ל": "travel",
    "מלון": "travel",
    "טיסה": "travel",
    "נסיעות לחו\"ל": "travel",
    "הזמנת מלון": "travel",
    "travel": "travel",
    "hotel": "travel",
    "hotels": "travel",
    "flights": "travel",
    "flight": "travel",
    "vacation": "travel",
    "airbnb": "travel",
    "booking": "travel",
    "airline": "travel",
    "airlines": "travel",
    "tourism": "travel",
    "trip": "travel",

    # ---- Health → "health" ----
    "בריאות": "health",
    "רפואה": "health",
    "בית מרקחת": "health",
    "רופא": "health",
    "מרפאה": "health",
    "תרופות": "health",
    "רופא שיניים": "health",
    "אופטיקה": "health",
    "כושר": "health",
    "חדר כושר": "health",
    "ספורט": "health",
    "health": "health",
    "medical": "health",
    "pharmacy": "health",
    "doctor": "health",
    "dentist": "health",
    "dental": "health",
    "fitness": "health",
    "gym": "health",
    "healthcare": "health",
    "wellness": "health",
    "optical": "health",

    # ---- Education → "education" ----
    "חינוך": "education",
    "לימודים": "education",
    "קורסים": "education",
    "קורס": "education",
    "אוניברסיטה": "education",
    "מכללה": "education",
    "ספרים": "education",
    "הדרכה": "education",
    "השתלמות": "education",
    "education": "education",
    "courses": "education",
    "school": "education",
    "tuition": "education",
    "university": "education",
    "college": "education",
    "books": "education",
    "training": "education",
    "learning": "education",
    "workshop": "education",
    "seminar": "education",

    # ---- Pets → "pets" ----
    "חיות מחמד": "pets",
    "וטרינר": "pets",
    "חיות": "pets",
    "כלב": "pets",
    "חתול": "pets",
    "מזון לחיות": "pets",
    "pets": "pets",
    "pet": "pets",
    "vet": "pets",
    "veterinary": "pets",
    "pet store": "pets",
    "pet food": "pets",

    # ---- Gifts → "gifts" ----
    "מתנות": "gifts",
    "תרומות": "gifts",
    "תרומה": "gifts",
    "מתנה": "gifts",
    "gifts": "gifts",
    "gift": "gifts",
    "donations": "gifts",
    "donation": "gifts",
    "charity": "gifts",

    # ---- Entertainment → "entertainment" ----
    "בידור": "entertainment",
    "פנאי": "entertainment",
    "סרטים": "entertainment",
    "הופעות": "entertainment",
    "תרבות": "entertainment",
    "מוזיקה": "entertainment",
    "תיאטרון": "entertainment",
    "קולנוע": "entertainment",
    "משחקים": "entertainment",
    "בילויים": "entertainment",
    "אטרקציות": "entertainment",
    "entertainment": "entertainment",
    "movies": "entertainment",
    "shows": "entertainment",
    "leisure": "entertainment",
    "cinema": "entertainment",
    "theater": "entertainment",
    "theatre": "entertainment",
    "music": "entertainment",
    "gaming": "entertainment",
    "games": "entertainment",
    "streaming": "entertainment",
    "recreation": "entertainment",
    "amusement": "entertainment",
    "nightlife": "entertainment",

    # ---- Other / General → "other" ----
    "שונות": "other",
    "כללי": "other",
    "אחר": "other",
    "העברות": "other",
    "העברה": "other",
    "עמלות": "other",
    "עמלה": "other",
    "ממשלה": "other",
    "general": "other",
    "other": "other",
    "miscellaneous": "other",
    "misc": "other",
    "uncategorized": "other",
    "transfer": "other",
    "fee": "other",
    "fees": "other",
    "government": "other",
    "atm": "other",
}


def auto_categorize(original_category: str) -> str | None:
    """
    Maps a credit-card expense category to an Exli category ID.

    Matching strategy (in order):
      1. Exact match (lowercased, stripped)
      2. Substring match — if any dictionary key appears inside the input
      3. Return None if no match found (frontend forces user to select)

    Args:
        original_category: The category string from the credit card report.

    Returns:
        Exli category ID (str) or None if no match found.
    """
    if not original_category or not isinstance(original_category, str):
        return None

    cleaned = original_category.strip().lower()

    if not cleaned:
        return None

    # 1. Exact match
    if cleaned in CATEGORY_MAP:
        logger.info(f"Category '{original_category}' → exact match → '{CATEGORY_MAP[cleaned]}'")
        return CATEGORY_MAP[cleaned]

    # 2. Substring match — check if any dictionary key is contained in the input
    #    Sort by key length descending to prefer longer (more specific) matches
    for key in sorted(CATEGORY_MAP.keys(), key=len, reverse=True):
        if len(key) >= 3 and key in cleaned:
            logger.info(f"Category '{original_category}' → substring match ('{key}') → '{CATEGORY_MAP[key]}'")
            return CATEGORY_MAP[key]

    # 3. Reverse substring — check if the input is contained in any dictionary key
    for key in sorted(CATEGORY_MAP.keys(), key=len, reverse=True):
        if len(cleaned) >= 3 and cleaned in key:
            logger.info(f"Category '{original_category}' → reverse substring match ('{key}') → '{CATEGORY_MAP[key]}'")
            return CATEGORY_MAP[key]

    logger.warning(f"Category '{original_category}' → NO MATCH found")
    return None


def auto_categorize_transactions(transactions: list[dict]) -> list[dict]:
    """
    Applies auto_categorize to a list of transactions.

    Each transaction dict should have an 'originalCategory' or 'category' field.
    Adds 'assignedCategory' and 'matched' fields to each transaction.

    Args:
        transactions: List of transaction dicts.

    Returns:
        The same list with 'assignedCategory' and 'matched' fields added.
    """
    matched_count = 0
    unmatched_count = 0

    for tx in transactions:
        original = tx.get("originalCategory") or tx.get("category") or ""
        result = auto_categorize(original)

        tx["assignedCategory"] = result
        tx["matched"] = result is not None

        if result is not None:
            matched_count += 1
        else:
            unmatched_count += 1

    logger.info(
        f"Auto-categorization complete: {matched_count} matched, "
        f"{unmatched_count} unmatched out of {len(transactions)} total"
    )
    return transactions
