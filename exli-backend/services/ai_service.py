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
        
        # Priority list (Updated to prefer gemini-3-pro-preview)
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
        
        # Create the content part for the file
        file_part = {
            "mime_type": "application/pdf",
            "data": file_bytes
        }
        
        response = model.generate_content([prompt, file_part])
        # Clean response (sometimes it adds markdown tags despite instructions)
        clean_csv = response.text.replace("```csv", "").replace("```", "").strip()
        return clean_csv
    except Exception as e:
        logger.error(f"AI PDF Extraction Failed: {e}")
        return None

def analyze_file_structure(text_head, text_tail):
    """Sends file samples to Gemini to detect structure (CSV/Excel)."""
    if not Config.GEMINI_API_KEY:
        return None

    model_name = get_best_available_model()
    logger.info(f"AI Service: Using model {model_name}")

    prompt = f"""
    You are a financial data parsing assistant.
    
    FILE START (First 50 lines):
    '''
    {text_head}
    '''
    
    FILE END (Last 10 lines):
    '''
    {text_tail}
    '''
    
    TASK:
    1. Identify HEADER ROW INDEX (0-based).
    2. Identify FOOTER SKIP COUNT (lines to ignore at bottom).
    3. Identify DELIMITER character.
    4. Map headers to: "date", "amount", "currency", "category", "description".
    
    CRITICAL MAPPING RULES & PITFALLS:
    - **Date**: Look for "Transaction Date" or "Date of Purchase". PREFER this over "Billing Date", "Posting Date", or "Debit Date". We need when the money was spent, not when it was banked.
    - **Amount**: Identify the transaction value. 
        - IGNORE "Balance", "Cumulative", or "Total" columns.
        - If "Debit" and "Credit" exist, choose "Debit" or the column representing the charge amount.
        - If "Original Amount" and "Billing Amount" exist, prefer "Billing Amount" (the final currency charged).
    - **Description**: Look for "Payee", "Merchant", "Name", or "Description".
        - DO NOT map "Card Number", "Reference ID", "Index", or "Voucher" to description.
    - **Header Selection**: If headers seem split across rows, pick the row containing the primary labels (Date, Amount, etc.).
    
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