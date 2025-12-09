import json
import google.generativeai as genai
from config import Config, logger

# Configure Gemini once
if Config.GEMINI_API_KEY:
    genai.configure(api_key=Config.GEMINI_API_KEY)

def get_model_by_tier(tier="flash"):
    """
    Finds the best model based on the requested tier.
    tier="pro": Prioritizes Gemini 3 Pro / 1.5 Pro (High intelligence/Vision for PDFs)
    tier="flash": Prioritizes Gemini 2.5 Flash / 2.0 Flash (Speed/Cost for CSVs)
    """
    try:
        all_models = [m.name for m in genai.list_models()]
        
        if tier == "pro":
            priorities = [
                'gemini-3-pro-preview', # User requested specific model
                'gemini-2.0-pro', 
                'gemini-1.5-pro',
                'gemini-pro'
            ]
        else: # flash
            priorities = [
                'gemini-2.5-flash', # User requested specific model
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-flash'
            ]

        # Find the first available model from the priority list
        for p in priorities:
            for m in all_models:
                if p in m:
                    return m
        
        # Fallback to a safe default if nothing matches
        return 'gemini-1.5-flash'
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        return 'gemini-1.5-flash'

def convert_pdf_to_csv(file_bytes):
    """
    Extracts the main transaction table from a PDF into a raw CSV string.
    Uses a High-Intelligence Model (Pro tier) for better vision/layout understanding.
    """
    if not Config.GEMINI_API_KEY:
        return None

    # Use the Pro tier model for complex PDF vision tasks
    model_name = get_model_by_tier("pro")
    logger.info(f"AI Service (PDF Extraction): Using model {model_name}")

    # REVISED PROMPT: Strict column separation and noise removal
    prompt = """
    You are a specialized "Bank Statement to CSV" converter. 
    Your goal is to extract the **Main Transaction Table** with pixel-perfect precision.

    ### 🔍 SCANNING & FILTERING RULES (WHAT TO KEEP VS IGNORE):
    1. **Identify the Main Table**: Find the list of chronological transactions (Date, Description, Amount).
    2. **REMOVE PAGE HEADERS/FOOTERS**: 
       - **Top of Page**: Ignore bank logos, addresses, dates, and "Account Summary" boxes.
       - **Bottom of Page**: Ignore page numbers, legal disclaimers, or "Continued on next page".
    3. **REMOVE SUMMARY TABLES**: 
       - Ignore tables labeled "Total by Category", "Foreign Currency Summary", "Concentration of Data", or "Payment Plan Details". 
       - ONLY extract the detailed transaction rows.
    4. **IGNORE "INFORMATION ONLY"**: 
       - Skip sections labeled "Pending", "Transactions for Knowledge" (עסקאות לידיעה), or "Future Charges".

    ### 📐 COLUMN ALIGNMENT & ACCURACY (CRITICAL):
    1. **Card Number vs Amount**: 
       - Many statements show the "Card Number" (4 digits like 2728, 5096) near the Amount column.
       - **NEVER** put the Card Number in the Amount column.
       - **NEVER** put the Amount in the Card Number column.
       - Amount must be a monetary value (e.g., 150.00). Card number is just an ID (e.g., 2728).
    2. **One Row Per Transaction**:
       - Process the table strictly line-by-line.
       - If a description wraps to a second line, merge it into the description column of the SAME row. Do not create a new row with an empty date/amount.

    ### 🔨 VISUAL FIDELITY:
    - Output the **EXACT** headers found in the document (e.g., "תאריך עסקה", "שם בית עסק"). Do not translate them yet.
    - Do not reformat dates (keep "15/10/2023" as is).
    - Keep the exact numeric string for amounts (e.g., "1,200.50").

    ### 📝 OUTPUT FORMAT:
    - Return ONLY the raw CSV text.
    - No markdown formatting (no ```csv).
    - No conversational text.
    """

    try:
        model = genai.GenerativeModel(model_name)
        file_part = {"mime_type": "application/pdf", "data": file_bytes}
        
        # Use low temperature for deterministic data extraction
        generation_config = genai.types.GenerationConfig(
            candidate_count=1,
            max_output_tokens=8192, 
            temperature=0.0 
        )

        response = model.generate_content(
            [prompt, file_part],
            generation_config=generation_config
        )
        
        clean_csv = response.text.replace("```csv", "").replace("```", "").strip()
        return clean_csv
    except Exception as e:
        logger.error(f"AI PDF Extraction Failed: {e}")
        return None

def analyze_multiple_files_structure(file_samples):
    """
    Analyzes CSV/Excel structure to map headers and clean data.
    Uses a Fast/Cost-Effective Model (Flash tier).
    """
    if not Config.GEMINI_API_KEY:
        return None

    # Use the Flash tier model for text analysis
    model_name = get_model_by_tier("flash")
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
    """
    Analyzes payslips/income statements.
    """
    if not Config.GEMINI_API_KEY:
        return None
        
    # Payslips often have complex layouts, so we default to Pro for better accuracy
    model_name = get_model_by_tier("pro")
    
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