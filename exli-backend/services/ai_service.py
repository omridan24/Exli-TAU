import json
import google.generativeai as genai
from config import Config, logger

if Config.GEMINI_API_KEY:
    genai.configure(api_key=Config.GEMINI_API_KEY)

def get_best_available_model():
    """Finds the best available Gemini model for the current API key."""
    try:
        all_models = [m.name for m in genai.list_models()]
        priorities = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-3-pro-preview',
            'gemini-pro'
        ]
        for p in priorities:
            for m in all_models:
                if p in m:
                    return m
        return 'gemini-1.5-flash'
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        return 'gemini-1.5-flash'

def analyze_file_structure(text_head, text_tail):
    """Sends file samples to Gemini to detect structure."""
    if not Config.GEMINI_API_KEY:
        return None

    model_name = get_best_available_model()
    logger.info(f"AI Service: Using model {model_name}")

    # CHAIN OF THOUGHT PROMPT
    # We ask the model to analyze the layout "step-by-step" inside a 'reasoning' field.
    prompt = f"""
    You are a specialized financial data parser. 
    You are looking for the MAIN TRANSACTION TABLE in a bank export file.
    
    FILE START (First 50 lines):
    '''
    {text_head}
    '''
    
    FILE END (Last 10 lines):
    '''
    {text_tail}
    '''
    
    YOUR GOAL: Find the actual list of expenses, ignoring any "Account Summary", "Balance", or "User Details" tables at the top.
    
    STEPS:
    1. Scan the lines. Look for a row that contains column headers like "Date", "Value", "Description", "Debit", "Credit".
    2. Verify that the rows IMMEDIATELY following it look like transaction data (dates, numbers).
    3. Determine the 0-based index of that header row.
    4. Determine if there are garbage lines at the very bottom (totals, disclaimers).
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "reasoning": "Explain here why you chose the specific row index. e.g. 'Row 0-4 are user details. Row 5 contains 'Date' and 'Amount', and Row 6 has data.'",
      "header_row_index": <int>,
      "footer_skip_count": <int>,
      "delimiter": "<char>",
      "mapping": {{ 
         "date": "<Exact Header String>", 
         "amount": "<Exact Header String>", 
         "currency": "<Exact Header String>", 
         "category": "<Exact Header String>", 
         "description": "<Exact Header String>" 
      }}
    }}
    """

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        
        # Log the reasoning for debugging
        logger.info(f"AI Reasoning: {data.get('reasoning', 'No reasoning provided')}")
        
        return data
    except Exception as e:
        logger.error(f"AI Analysis Failed: {e}")
        return None