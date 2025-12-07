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
        priorities = [
            'gemini-3-pro-preview',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-pro',
            'gemini-flash-latest',
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

def convert_pdf_to_csv(file_bytes):
    """Extracts transaction data from a PDF and converts it to a CSV string."""
    if not Config.GEMINI_API_KEY:
        return None

    model_name = get_best_available_model()
    logger.info(f"AI Service (PDF Extraction): Using model {model_name}")

    prompt = """
    You are a bank statement data extractor. 
    Task: Extract all financial transaction rows from the provided PDF document pages.
    
    OUTPUT FORMAT:
    - Strictly CSV format.
    - Headers: Date, Description, Amount, Category (if explicitly present, else leave empty), Currency (if explicitly present, else ILS/USD).
    - No markdown formatting (no ```csv ... ```). Just the raw CSV text.
    
    RULES:
    1. Extract transactions from ALL pages.
    2. Ignore "Opening Balance", "Closing Balance", "Total", or "Forwarded" rows. We only want individual spending/income transactions.
    3. Ensure the Amount is a single number (e.g., 150.50). If Credit/Debit are separate columns, merge them into one Amount column (negative for expenses if possible, or just raw numbers).
    4. If the description spans multiple lines, merge it into a single line description.
    """

    try:
        model = genai.GenerativeModel(model_name)
        file_part = {"mime_type": "application/pdf", "data": file_bytes}
        response = model.generate_content([prompt, file_part])
        clean_csv = response.text.replace("```csv", "").replace("```", "").strip()
        return clean_csv
    except Exception as e:
        logger.error(f"AI PDF Extraction Failed: {e}")
        return None

def analyze_multiple_files_structure(file_samples):
    """
    Sends multiple file samples to Gemini in ONE call.
    file_samples: List of dicts [{'filename': '...', 'head': '...', 'tail': '...'}]
    Returns: List of analysis results.
    """
    if not Config.GEMINI_API_KEY:
        return None

    model_name = get_best_available_model()
    logger.info(f"AI Service (Batch Analysis): Using model {model_name} for {len(file_samples)} files")

    # Construct the combined prompt
    samples_text = ""
    for idx, f in enumerate(file_samples):
        samples_text += f"""
        --- FILE {idx+1}: {f['filename']} ---
        START (First 50 lines):
        '''
        {f['head']}
        '''
        END (Last 10 lines):
        '''
        {f['tail']}
        '''
        -------------------------------------
        """

    prompt = f"""
    You are a financial data parsing assistant processing multiple files at once.
    
    INPUT DATA:
    {samples_text}
    
    TASK:
    For EACH file, analyze the structure and return the parsing configuration.
    
    CRITICAL RULES:
    1. **Card Info**: Look at the top/bottom of the file text for hints about the card (e.g., "Visa 5096", "Amex", "Leumi Card"). Return a short string like "Visa 5096". If unknown, use the filename.
    2. **Date**: Prefer "Transaction Date" over "Billing Date".
    3. **Amount**: Ignore "Balance" columns. Prefer "Billing Amount" or "Debit".
    4. **Header Row**: Identify the 0-based index of the row containing column names.
    5. **Footer Skip**: Count lines to skip at the bottom (totals, disclaimers).
    
    OUTPUT FORMAT:
    Return a JSON Object containing a single key "results" which is a LIST of objects (one per file, in order).
    
    {{
      "results": [
        {{
          "file_index": 0,
          "card_info": "Visa Ending 1234",
          "header_row_index": <int>,
          "footer_skip_count": <int>,
          "delimiter": "<char>",
          "mapping": {{ "date": "...", "amount": "...", "currency": "...", "category": "...", "description": "..." }}
        }},
        ...
      ]
    }}
    """

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        # Handle cases where model might wrap it weirdly
        if clean_text.startswith("json"): clean_text = clean_text[4:].strip()
        return json.loads(clean_text)
    except Exception as e:
        logger.error(f"AI Batch Analysis Failed: {e}")
        return None

def analyze_income_statement(file_bytes, mime_type):
    # (Same as before)
    if not Config.GEMINI_API_KEY:
        return None
    model_name = get_best_available_model()
    prompt = """
    Analyze this Income Statement / Payslip.
    Extract: bruto, neto, taxes, pension, other_deposits.
    Return JSON { "bruto": 0, ... }
    """
    try:
        model = genai.GenerativeModel(model_name)
        file_part = {"mime_type": mime_type, "data": file_bytes}
        response = model.generate_content([prompt, file_part])
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        logger.error(f"AI Income Analysis Failed: {e}")
        return None