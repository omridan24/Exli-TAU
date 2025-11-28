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
    """Sends file samples to Gemini to detect structure (CSV/Excel)."""
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

def analyze_income_statement(file_bytes, mime_type):
    """Sends an image/PDF to Gemini to extract income details."""
    if not Config.GEMINI_API_KEY:
        return None

    model_name = get_best_available_model()
    logger.info(f"AI Service (Income): Using model {model_name} for {mime_type}")

    prompt = """
    Analyze this Income Statement / Payslip.
    Extract the following monthly totals as single numeric values.
    
    FIELDS TO EXTRACT:
    1. bruto: The total Gross Income (before deductions).
    2. neto: The final Net Income (amount paid to bank).
    3. taxes: Sum of all mandatory state taxes (Income Tax, Social Security/National Insurance, Health Tax).
    4. pension: Total Pension contributions (Employee + Employer part if visible, or just Employee).
    5. other_deposits: Any other savings/funds deducted (Study funds, stock options, etc).

    RULES:
    - Return ONLY numbers (no currency symbols).
    - If a field is 0 or not found, return 0.
    - Ignore personal IDs, Names, or Addresses.
    
    OUTPUT FORMAT (JSON):
    {
        "bruto": <number>,
        "neto": <number>,
        "taxes": <number>,
        "pension": <number>,
        "other_deposits": <number>
    }
    """

    try:
        model = genai.GenerativeModel(model_name)
        
        # Create the content part for the file
        file_part = {
            "mime_type": mime_type,
            "data": file_bytes
        }
        
        response = model.generate_content([prompt, file_part])
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        logger.error(f"AI Income Analysis Failed: {e}")
        return None