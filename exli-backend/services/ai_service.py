import json
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
@task(name="geometry_sort_text")
def geometry_sort_text(document_object):
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
                y = line.layout.bounding_poly.normalized_vertices[0].y
                page_lines.append({"y": y, "text": line_text.strip()})
            
            page_lines.sort(key=lambda x: x["y"])
            for pl in page_lines:
                full_text += pl["text"] + "\n"
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
        result = client.process_document(request=request)
        return result.document  
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
    
    ### OUTPUT:
    JSON Array of {{ "date", "description", "amount", "currency", "category" }}
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
       - "date": Index of the Charge/Billing Date column (e.g. "תאריך חיוב", "מועד חיוב"). If not available, fallback to Purchase Date ("תאריך רכישה", "תאריך קניה").
       - "amount": Index of Amount/Billing/Debit column (Use the local currency billing amount)
       - "description": Index of Payee/Business Name
       - "currency": Index of Currency symbol (optional, if exists)
       - "category": Index of Category (optional)
    
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
