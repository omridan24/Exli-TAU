import json
import time
import warnings
# Suppress Google deprecation warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")
warnings.filterwarnings("ignore", category=FutureWarning, module="google.api_core")
from google import genai
from google.genai import types

from google.cloud import documentai
from google.api_core.client_options import ClientOptions
from config import Config, logger
from traceloop.sdk.decorators import workflow, task

# Configure Gemini Client
client = None
if Config.GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=Config.GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Gemini Client: {e}")

def get_model_by_tier(tier="flash"):
    try:
        # Note: Client.models.list() returns an iterator of Model objects
        if not client: return 'gemini-1.5-flash'
        all_models = [m.name for m in client.models.list()]
        if tier == "pro":
            priorities = ['gemini-3.0-pro', 'gemini-2.0-pro', 'gemini-pro']
        else: 
            priorities = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash']

        for p in priorities:
            for m in all_models:
                if p in m: return m
        return 'gemini-1.5-flash'
    except Exception as e:
        logger.error(f"Error listing models: {e}",exc_info=True)
        return 'gemini-1.5-flash'

# --- NEW HELPER: GEOMETRY SORTING ---
# Row tolerance as a fraction of page height: OCR'd lines belonging to the same
# visual table row rarely land on the exact same Y, so we cluster anything within
# this band together rather than requiring an exact match.
ROW_Y_TOLERANCE = 0.008

@task(name="geometry_sort_text")
def geometry_sort_text(document_object):
    """
    Reconstructs reading order from OCR line bounding boxes.

    A pure Y-sort (used previously) is fine for single-column documents like a
    payslip, where each field is already its own line. It falls apart on wide
    multi-column tables (e.g. a brokerage holdings table): Document AI detects
    each row as several separate line objects at nearly the same Y, and since
    sorting is stable, cells sharing a Y-value keep whatever arbitrary order
    Document AI emitted them in - not their true left-to-right position. That
    silently swaps values between adjacent columns (e.g. "last price" ending up
    where "cost basis" belongs).

    This clusters lines into visual rows by Y-proximity, then sorts each row's
    cells by X, joining them with " | " so column boundaries are explicit in the
    text the model sees. Applied uniformly to header and data rows alike, so
    column position stays aligned between them regardless of text direction
    (RTL Hebrew included - we don't need to know the direction, only that it's
    consistent).
    """
    try:
        full_text = ""
        for page in document_object.pages:
            page_lines = []
            for line in page.lines:
                try:
                    segment = line.layout.text_anchor.text_segments[0]
                    line_text = document_object.text[segment.start_index:segment.end_index]
                except:
                    continue
                vertices = line.layout.bounding_poly.normalized_vertices
                y = vertices[0].y
                x = min(v.x for v in vertices)
                text = line_text.strip()
                if text:
                    page_lines.append({"y": y, "x": x, "text": text})

            page_lines.sort(key=lambda ln: ln["y"])

            # Cluster into rows by Y-proximity. Compare against the row's first
            # (anchor) line rather than the most recently added one, so a chain
            # of near-neighbors can't let the row's Y-span drift past tolerance.
            rows = []
            for ln in page_lines:
                if rows and (ln["y"] - rows[-1][0]["y"]) <= ROW_Y_TOLERANCE:
                    rows[-1].append(ln)
                else:
                    rows.append([ln])

            for row in rows:
                row.sort(key=lambda ln: ln["x"])
                full_text += " | ".join(ln["text"] for ln in row) + "\n"
        return full_text
    except Exception as e:
        logger.error(f"Geometry Sort Failed: {e}", exc_info=True)
        return "" # Return empty string on failure so we don't crash

@task(name="extract_text_with_google_docai")
def extract_text_with_google_docai(file_bytes, mime_type="application/pdf"):
    try:
        if not Config.DOCAI_PROCESSOR_ID or not Config.GCP_PROJECT_ID:
            logger.error("Document AI Credentials missing.")
            return None

        logger.info(f"DocAI: Sending to Processor {Config.DOCAI_PROCESSOR_ID} ({Config.GCP_LOCATION})...")
        opts = ClientOptions(api_endpoint=f"{Config.GCP_LOCATION}-documentai.googleapis.com")
        client = documentai.DocumentProcessorServiceClient(client_options=opts)
        name = client.processor_path(Config.GCP_PROJECT_ID, Config.GCP_LOCATION, Config.DOCAI_PROCESSOR_ID)
        raw_document = documentai.RawDocument(content=file_bytes, mime_type=mime_type)
        request = documentai.ProcessRequest(name=name, raw_document=raw_document)
        
        # Retry loop for intermittent 500 errors
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = client.process_document(request=request)
                return result.document
            except Exception as e:
                if "500 Internal error encountered" in str(e) and attempt < max_retries - 1:
                    logger.warning(f"DocAI 500 error, retrying attempt {attempt + 1}/{max_retries} in 2 seconds...")
                    time.sleep(2)
                else:
                    raise e
    except Exception as e:
        logger.error(f"Document AI Failed: {e}",exc_info=True)
        return None

@workflow(name="convert_pdf_to_data")
def convert_pdf_to_data(file_bytes):
    if not Config.GEMINI_API_KEY: return None

    # Step 1: Get Document Object
    doc_object = extract_text_with_google_docai(file_bytes)
    
    if not doc_object:
        logger.warning("DocAI failed. Falling back.")
        return None

    # Step 2: Reconstruct Text using Geometry
    sorted_text = geometry_sort_text(doc_object)
    
    # Step 3: Send Sorted Text to Flash
    model_name = get_model_by_tier("flash") 
    logger.info(f"AI Service: Extracting structured data with {model_name}")

    prompt = f"""
    You are a financial data extractor. 
    I have pre-sorted this bank statement text line-by-line based on visual layout.
    
    ### RAW SORTED TEXT:
    '''
    {sorted_text[:50000]} 
    '''
    
    ### TASK:
    Extract valid transactions into a JSON list.
    
    ### RULES:
    1. **Context**: Because the text is sorted by Y-coordinate, the Amount will be immediately before or after the Description.
    2. **Anchor**: Find the Date first. Prefer the Charge/Billing Date ("תאריך חיוב", "מועד חיוב") over the Purchase Date ("תאריך רכישה").
    3. **Positive Only**: Return absolute values.
    4. **Installments**: If "Payment X of Y", use the monthly charged amount.
    5. **CURRENCY VALIDATION (CRITICAL)**:
       - "Currency" MUST be a standard code (ILS, USD, EUR, GBP) or symbol (₪, $, €, £).
       - NEVER use Hebrew words (like "שונות", "רגילה", "חובה") as the currency. If unsure, default to "ILS".
    6. **FOREIGN CURRENCY CHARGES (charged_amount/charged_currency, OPTIONAL)**:
       - Israeli credit card statements often show a foreign purchase with BOTH
         the original amount (e.g. "45.00 USD") AND the actual amount billed to
         the card in shekels (e.g. "₪153.20" - this already includes the bank's
         own conversion fee, look for it near the transaction, sometimes under
         a header like "חיוב בש\"ח" / "סכום חיוב" / "Amount Charged").
       - When a row genuinely has BOTH figures, set "amount"/"currency" to the
         ORIGINAL foreign figure, and ALSO set "charged_amount" (the shekel
         figure) and "charged_currency" (normally "ILS").
       - When a row has only ONE figure (the normal case), omit
         charged_amount/charged_currency entirely - do not guess or duplicate
         "amount" into them.

    ### OUTPUT:
    JSON Array of {{ "date", "description", "amount", "currency", "category", "charged_amount", "charged_currency" }}
    (charged_amount/charged_currency are optional per item - omit the keys entirely when not applicable, don't set them to null)
    """

    try:
        if not client: return None
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
        return json.loads(response.text)
        
    except Exception as e:
        logger.error(f"AI Cleaning Failed: {e}")
        return None

@task(name="analyze_multiple_files_structure")
def analyze_multiple_files_structure(file_samples):
    """
    Analyzes CSV/Excel structure to map headers by INDEX (Integer).
    """
    if not Config.GEMINI_API_KEY: return None

    model_name = get_model_by_tier("flash")
    logger.info(f"AI Service (Batch Analysis): Using model {model_name}")

    samples_text = ""
    for idx, f in enumerate(file_samples):
        samples_text += f"""
        --- FILE {idx+1}: {f['filename']} ---
        START:
        '''{f['head']}'''
        -------------------------------------
        """

    prompt = f"""
    You are a financial data parsing assistant.
    INPUT DATA:
    {samples_text}
    
    ### TASK:
    For EACH file, identify the CSV structure.
    Instead of column names, return the **0-based Column Index** (Integer).
    
    ### RULES:
    1. **Header Row**: Which row index contains the headers? (0-based)
    2. **Mapping Indices**:
       - "date": Index of the Transaction/Purchase Date column (e.g. "תאריך עסקה", "תאריך רכישה", "תאריך קניה"). Do NOT use the Charge/Billing Date ("תאריך חיוב", "מועד חיוב") when a transaction date column exists, because every row of a monthly statement shares the same billing date. Only if there is no transaction date column, fall back to the Charge/Billing Date.
       - "amount": Index of Amount/Billing/Debit column (Use the local currency billing amount)
       - "description": Index of Payee/Business Name
       - "currency": Index of Currency symbol (optional, if exists)
       - "category": Index of Category (optional)
       - "chargedAmount"/"chargedCurrency" (OPTIONAL, only if a SEPARATE column
         exists for it): some statement exports have a distinct "original
         foreign amount" column AND a distinct "amount billed in ILS" column
         (which already includes the bank's own conversion fee) - e.g. a
         "Foreign Amount" + "Original Currency" pair alongside the main
         "amount"/"currency". When that pairing genuinely exists as separate
         columns, map "amount"/"currency" to the FOREIGN pair and
         "chargedAmount"/"chargedCurrency" to the local-currency pair. Only
         include these two keys when such a second pair of columns actually
         exists - never invent them or duplicate the same column into both.
       - "notes": Index of the Notes column ("הערות"), e.g. "תשלום 2 מתוך 12" (optional)
    ### OUTPUT FORMAT:
    Return JSON Object:
    {{
      "results": [
        {{
          "file_index": 0,
          "card_info": "Visa 1234",
          "header_row_index": 3,
          "footer_skip_count": 1,
          "mapping_indices": {{
             "date": 0,
             "description": 1,
             "amount": 4,
             "currency": 5,
             "category": 2
          }}
        }}
      ]
    }}
    """

    try:
        if not client: return {"results": []}
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"AI Batch Analysis Failed: {e}", exc_info=True)
        return {"results": []}

def analyze_income_statement(file_bytes, mime_type):
    if not Config.GEMINI_API_KEY: return None
    model_name = get_model_by_tier("pro")
    prompt = "Analyze this Payslip. Return JSON { \"bruto\": 0, \"neto\": 0, \"taxes\": 0, \"pension\": 0, \"other_deposits\": 0 }"
    try:
        if not client: return None
        
        file_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        
        response = client.models.generate_content(
            model=model_name,
            contents=[prompt, file_part],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"AI Income Analysis Failed: {e}", exc_info=True)
        return None

@workflow(name="extract_payslip_data")
def extract_payslip_data(file_bytes, mime_type="application/pdf"):
    """
    Extracts detailed payslip data using Document AI and Gemini.
    """
    if not Config.GEMINI_API_KEY: return None

    # Step 1: Get Document Object
    doc_object = extract_text_with_google_docai(file_bytes, mime_type)
    
    if not doc_object:
        logger.warning("DocAI failed for payslip. Falling back.")
        return None

    # Step 2: Reconstruct Text using Geometry
    sorted_text = geometry_sort_text(doc_object)
    


    # Step 3: Send Sorted Text to Gemini
    model_name = get_model_by_tier("flash") 
    logger.info(f"AI Service: Extracting structured payslip data with {model_name}")

    prompt = f"""
    You are a financial expert specializing in Israeli payslips (Tlush Sahar).
    Extract the following fields from the provided text.
    
    ### RAW TEXT:
    '''
    {sorted_text[:50000]} 
    '''
    
    ### TASK:
    Extract these exact fields into a valid JSON object.
    
    ### FIELDS TO EXTRACT:
    - "pay_month": The month and year the payslip is for (format YYYY-MM). Usually found near the top, e.g. "תלוש שכר לחודש 04/2026".
    - "employer_name": The name of the company or employer issuing the payslip.
    - "bruto": Gross Salary for TAX purposes (Sahar Bruto / Bruto LeMas). This is the TOTAL gross including all bonuses, food, travel, etc. ONLY THE MONTHLY GROSS.
    - "bruto_pension": Gross Salary for PENSION purposes (Bruto LePensiya / Sahar Pensioney). This is typically LOWER than bruto because it excludes food/travel/bonus allowances. It is the base salary used for pension and keren hishtalmut calculations. If not found, return null.
    - "neto": Net Salary (Neto LeTashlum / Sahar Neto).
    - "pension_employee": Employee's pension deposit (Tagmulim Oved / Kupat Gemel Oved).
    - "pension_employer": Employer's pension deposit (Tagmulim Maavid / Kupat Gemel Maavid).
    - "tax_income": Income Tax (Mas Hachnasa) ONLY. Do NOT include Health or National Insurance here. If 0, return 0.
    - "tax_health": Health Insurance (Mas Briut) ONLY.
    - "tax_national": National Insurance (Bituach Leumi) ONLY.
    - "credit_points": Number of credit points (Nekudot Zichuy) - usually a number like 2.25 or 2.75.
    - "marginal_rate": Marginal tax rate (Mas Shuli) - e.g. 0.14, 0.20.
    
    ### RULES:
    1. If a value is not found, use null. **Do NOT guess or hallucinate values.** If you are uncertain, return null.
    2. All amounts should be numbers (floats).
    3. **CRITICAL**: Do NOT sum different tax types together. Keep them separate.
    4. **CRITICAL**: If multiple values are found for a field (e.g. multiple "Income Tax" lines), do NOT sum them. Choose the single most likely "Total" value.
    5. **CRITICAL**: "bruto" and "bruto_pension" are DIFFERENT numbers. "bruto" is the full taxable gross. "bruto_pension" is the pensionable salary base (often lower). Do NOT use the same value for both unless the payslip clearly shows only one gross figure.
    6. Return ONLY the JSON object.

    ### FIELD MAPPING & HEBREW EXAMPLES:
    - **pay_month**: "תלוש משכורת לחודש 05/2026" -> "2026-05"
    - **employer_name**: "שם החברה", "שם המעסיק", "מעסיק"
    - **bruto**: "סהכ תשלומים", "ברוטו למס", "שכר ברוטו", "ברוטו"
    - **bruto_pension**: "ברוטו לפנסיה", "שכר פנסיוני", "בסיס לפנסיה", "שכר לגמל", "ברוטו לגמל"
    - **neto**: "נטו לתשלום", "לפירעון", "סכום לתשלום"
    - **tax_income**: "מס הכנסה", "מ.הכנסה"
    - **tax_health**: "מס בריאות", "ביטוח בריאות", "בריאות"
    - **tax_national**: "ביטוח לאומי", "בטוח לאומי", "ב.לאומי"
    - **pension_employee**: "תגמולים", "גמל", "קופת גמל", "פנסיה", "הפרשה לפנסיה" (Note: Only extract the *Employee* deduction)
    - **pension_employer**: "תגמולי מעביד", "פיצויים" (Look in "Simulated" or "Employer Info" sections, not deductions)
    - **credit_points**: "נקודות זיכוי", "נק' זיכוי", "זיכוי תקופתי" (e.g., 2.25)
    
    ### OUTPUT:
    {{ 
      "pay_month": null,
      "employer_name": null,
      "bruto": null,
      "bruto_pension": null,
      "neto": null, 
      "pension_employee": null, 
      "pension_employer": null, 
      "tax_income": null, 
      "tax_health": null, 
      "tax_national": null, 
      "credit_points": null, 
      "marginal_rate": null 
    }}
    """

    try:
        if not client: return None

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
       
        return json.loads(response.text)
        
    except Exception as e:
        logger.error(f"Payslip Extraction Failed: {e}", exc_info=True)
        return None


@workflow(name="extract_investment_statement_data")
def extract_investment_statement_data(file_bytes, mime_type="application/pdf"):
    """
    Extracts holdings from brokerage statements (Interactive Brokers, Bank Leumi, etc.)
    Uses existing Document AI + Gemini flow.
    Returns {"asOfDate": "YYYY-MM-DD" | None, "holdings": [...]} with each holding's
    symbol, quantity, cost basis, and market value - or None if extraction failed
    outright (missing API key, DocAI failure, malformed model response).
    """
    if not Config.GEMINI_API_KEY: 
        return None

    # Step 1: Get Document Object using Document AI
    doc_object = extract_text_with_google_docai(file_bytes, mime_type)
    
    if not doc_object:
        logger.warning("DocAI failed for investment statement. Falling back.")
        return None

    # Step 2: Reconstruct Text using Geometry Sorting
    sorted_text = geometry_sort_text(doc_object)
    
    if not sorted_text:
        logger.warning("Geometry sort returned empty text for investment statement.")
        return None

    # Step 3: Send Sorted Text to Gemini for extraction
    model_name = get_model_by_tier("flash") 
    logger.info(f"AI Service: Extracting investment holdings with {model_name}")

    prompt = f"""
    You are a financial data extraction expert specializing in brokerage statements.
    Extract all investment holdings from this statement.

    ### RAW TEXT:
    '''
    {sorted_text[:50000]}
    '''

    ### IMPORTANT - READING THE TEXT:
    Each line represents one visual row from the document, with cells separated by
    " | " in their left-to-right (or right-to-left, for Hebrew/RTL tables) reading
    order. A table's header row and its data rows use the same cell order, so match
    each data row's Nth cell to the header row's Nth cell to know what it means -
    don't assume a fixed left-to-right meaning across different tables on the page.

    ### TASK:
    Extract each holding into a JSON array.

    ### FIELDS PER HOLDING:
    - "symbol": Ticker symbol (e.g., "AAPL", "VOO", "MSFT"). ONLY set this if the
      statement is showing that EXACT globally-tradable instrument. Leave null if
      you're not certain - see the Israeli/TASE rule below for the most common way
      this goes wrong.
    - "name": Full name of the security if available (e.g., "Apple Inc.", "Vanguard S&P 500 ETF")
    - "quantity": Number of shares/units owned (float). Must be a positive number.
    - "costBasis": Total cost basis in original currency (float). Use null if not found.
    - "marketValue": Current market value (float). Use null if not found.
    - "currency": Currency code of the values (e.g., "USD", "ILS", "EUR"). Default to "USD" if unclear.
    - "assetType": One of: "stock", "etf", "bond", "mutual_fund", "crypto", or "other"
    - "pricePerUnit": Price per share/unit if available (float). Use null if not found.
    - "localSecurityId": The local exchange's own security identifier if shown
      (e.g. a TASE "\u05de\u05e1\u05e4\u05e8 \u05e0\u05d9"\u05e2" security number like "1159235"). Use null if none.

    ### RULES:
    1. If uncertain about a value, use null. **Do NOT guess or hallucinate values.**
    2. Return ONLY a valid JSON array for "holdings".
    3. Skip any line items that aren't actual holdings (fees, totals, cash balances, dividends, etc.)
    4. For ETFs, common examples include: VOO, VTI, QQQ, SPY, AGG, BND, SCHD, VIG
    5. If a symbol is in ISIN format (e.g., US0378331005), try to extract the ticker if visible nearby.
    6. Quantity must be positive. If you see negative quantities, these might be short positions - include them with a note.
    7. **Every numeric field belongs to the SAME row.** Before filling in costBasis,
       marketValue, quantity, and pricePerUnit for a holding, re-check that all four
       came from that holding's own row and not a neighboring column or row.

    ### ISRAELI/TASE SECURITIES - DO NOT INVENT A TICKER:
    Israeli brokerage statements often hold local TASE-listed mutual funds or index-
    tracking certificates whose NAME resembles a well-known global index or ETF
    (e.g. a fund named "MSCIACWn" that tracks the MSCI ACWI index, or "NSDQ100n"
    tracking the Nasdaq 100) - these are DIFFERENT INSTRUMENTS from the actual global
    ETF with a similar name (e.g. the real "ACWI" ticker is iShares MSCI ACWI ETF on
    NYSE Arca; a TASE fund that merely tracks the same index is not that ETF and does
    not trade under that ticker). If a security only has a TASE security number
    ("\u05de\u05e1\u05e4\u05e8 \u05e0\u05d9"\u05e2") and no genuine global ticker printed on the statement, set "symbol"
    to null and put the TASE number in "localSecurityId" instead of guessing the
    closest-sounding US ticker - a wrong-but-real ticker is worse than no ticker,
    since it silently attaches this holding's numbers to a completely different fund.

    ### HEBREW/ISRAELI CONTEXT:
    - Common Israeli terms: "\u05de\u05e0\u05d9\u05d5\u05ea" (stocks), "\u05e7\u05e8\u05df \u05e1\u05dc" (ETF), "\u05d0\u05d2"\u05d7" (bonds)
    - "\u05db\u05de\u05d5\u05ea" or "\u05d9\u05d7\u05d9\u05d3\u05d5\u05ea" = quantity, "\u05e9\u05d5\u05d5\u05d9" = value, "\u05e2\u05dc\u05d5\u05ea" = cost

    8. **PRESERVE NAMES**:
       - Do NOT Rename the security. Keep the name exactly as found in the text.
       - Do NOT Translate Hebrew names.
       - Do NOT Simplify names (e.g. keep "Vanguard S&P 500 ETF IV" as is).

    ### OUTPUT FORMAT:
    {{
      "asOfDate": "2026-07-31",
      "holdings": [
        {{
          "symbol": "VOO",
          "name": "Vanguard S&P 500 ETF",
          "quantity": 10.0,
          "costBasis": 4200.50,
          "marketValue": 4850.00,
          "currency": "USD",
          "assetType": "etf",
          "pricePerUnit": 485.00,
          "localSecurityId": null
        }},
        ...
      ]
    }}

    "asOfDate" is the date the statement says it reflects (format YYYY-MM-DD;
    often phrased like "\u05e0\u05db\u05d5\u05df \u05dc\u05d9\u05d5\u05dd DD/MM/YYYY" / "as of" / a statement date near the
    top). Use null if you can't find one. If no holdings are found, "holdings"
    should be an empty array.
    """

    try:
        if not client: 
            return None

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
       
        parsed = json.loads(response.text)

        # Be tolerant of the model dropping back to a bare array despite the prompt
        if isinstance(parsed, list):
            holdings, as_of_date = parsed, None
        elif isinstance(parsed, dict):
            holdings = parsed.get("holdings", [])
            as_of_date = parsed.get("asOfDate")
        else:
            logger.warning(f"Investment extraction returned unexpected type: {type(parsed)}")
            return {"asOfDate": None, "holdings": []}

        if not isinstance(holdings, list):
            logger.warning(f"Investment extraction 'holdings' was not a list: {type(holdings)}")
            holdings = []

        logger.info(f"Successfully extracted {len(holdings)} holdings from investment statement (asOfDate={as_of_date})")
        return {"asOfDate": as_of_date, "holdings": holdings}

    except Exception as e:
        logger.error(f"Investment Statement Extraction Failed: {e}", exc_info=True)
        return None
