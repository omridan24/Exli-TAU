import json
from google.genai import types
from config import Config, logger
from .ai_service import get_model_by_tier, client

def analyze_recurring_with_ai(expenses_list):
    """
    Uses Gemini to conservatively detect recurring expenses.
    Focuses on common categories: rent, utilities, subscriptions.
    
    Args:
        expenses_list: List of dicts with {date, description, amount, category}
    
    Returns:
        List of suggested recurring expenses
    """
    if not Config.GEMINI_API_KEY or not client:
        logger.warning("No Gemini API key or Client - skipping recurring analysis")
        return []
    
    if len(expenses_list) < 10:
        logger.info("Not enough expense history for recurring analysis")
        return []
    
    # Prepare JSON for AI (limit to last 500 expenses for performance)
    recent_expenses = expenses_list[-500:] if len(expenses_list) > 500 else expenses_list
    expenses_json = json.dumps(recent_expenses, ensure_ascii=False)
    
    prompt = f"""You are a conservative financial analyst. Identify ONLY recurring expenses that are CLEARLY repeating.

FOCUS ON THESE COMMON RECURRING CATEGORIES:
- Rent/Mortgage
- Utilities (electric, water, gas, internet)
- Subscriptions (Netflix, Spotify, gym, etc.)
- Insurance
- Phone/mobile plans
- Loan payments

STRICT CRITERIA:
- Must appear consistently (same business/description)
- Amount should be similar (±5% tolerance is okay)
- MUST be in common recurring categories listed above
- Determine frequency: MONTHLY, QUARTERLY, or YEARLY
- BE CONSERVATIVE: If unsure, DON'T suggest it

EXPENSES DATA:
{expenses_json}

Return ONLY a JSON array. Format:
[
  {{
    "name": "Netflix Subscription",
    "description_pattern": "netflix",
    "amount_average": 32.0,
    "currency": "ILS",
    "frequency": "MONTHLY",
    "occurrences": 6,
    "confidence": "high",
    "suggested_category": "entertainment"
  }}
]

CRITICAL RULES:
- Only suggest items that are OBVIOUSLY recurring
- DO NOT suggest spontaneous purchases (restaurants, shopping, etc.)
- confidence: "high" if 6+ times, "medium" if 3-5 times
- Return EMPTY ARRAY if no clear patterns found
- Better to suggest NOTHING than make a mistake
"""
    
    try:
        # Use existing model tier system
        model_name = get_model_by_tier("flash")  # Flash is good for this
        logger.info(f"Using model {model_name} for recurring analysis")
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        suggestions = json.loads(response.text)
        
        # Validate suggestions - only accept high confidence
        valid_suggestions = []
        for sug in suggestions:
            if sug.get('confidence') == 'high' and sug.get('occurrences', 0) >= 5:
                valid_suggestions.append(sug)
        
        logger.info(f"AI detected {len(valid_suggestions)} high-confidence recurring patterns")
        return valid_suggestions
    
    except Exception as e:
        logger.error(f"Recurring AI analysis failed: {e}", exc_info=True)
        return []
