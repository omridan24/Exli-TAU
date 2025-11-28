import json
import google.generativeai as genai
from config import Config, logger

# Configure Gemini once
if Config.GEMINI_API_KEY:
    genai.configure(api_key=Config.GEMINI_API_KEY)

def get_best_available_model():
    """Finds the best available Gemini model for the current API key."""
    try:
        all_models = [m.name for m in genai.list_models()]
        
        # Priority list (Fastest & Newest first)
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

    prompt = f"""
    You are a financial data parsing assistant.
    
    FILE START (First 15 lines):
    '''
    {text_head}
    '''
    
    FILE END (Last 5 lines):
    '''
    {text_tail}
    '''
    
    TASK:
    1. Identify HEADER ROW INDEX (0-based).
    2. Identify FOOTER SKIP COUNT (lines to ignore at bottom).
    3. Identify DELIMITER character.
    4. Map headers to: "date", "amount", "currency", "category", "description".
    
    RULES:
    - Use EXACT header strings from the file.
    - If concept not found, return null.
    
    OUTPUT JSON:
    {{
      "header_row_index": <int>,
      "footer_skip_count": <int>,
      "delimiter": "<char>",
      "mapping": {{ "date": "...", "amount": "...", "currency": "...", "category": "...", "description": "..." }}
    }}
    """

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        logger.error(f"AI Analysis Failed: {e}")
        return None