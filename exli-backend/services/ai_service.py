import json
import google.generativeai as genai
from google.cloud import documentai
from google.api_core.client_options import ClientOptions
from config import Config, logger

# Configure Gemini once
if Config.GEMINI_API_KEY:
    genai.configure(api_key=Config.GEMINI_API_KEY)

def get_model_by_tier(tier="flash"):
    try:
        all_models = [m.name for m in genai.list_models()]
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
    2. **Anchor**: Find the Date first.
    3. **Positive Only**: Return absolute values.
    4. **Installments**: If "Payment X of Y", use the monthly charged amount.
    5. **CURRENCY VALIDATION (CRITICAL)**: 
       - "Currency" MUST be a standard code (ILS, USD, EUR, GBP) or symbol (₪, $, €, £).
       - NEVER use Hebrew words (like "שונות", "רגילה", "חובה") as the currency. If unsure, default to "ILS".
    
    ### OUTPUT:
    JSON Array of {{ "date", "description", "amount", "currency", "category" }}
    """

    try:
        model = genai.GenerativeModel(
            model_name,
            generation_config={"response_mime_type": "application/json", "temperature": 0.0}
        )
        
        response = model.generate_content(prompt)
        return json.loads(response.text)
        
    except Exception as e:
        logger.error(f"AI Cleaning Failed: {e}")
        return None

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
       - "date": Index of Date column
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
        model = genai.GenerativeModel(model_name, generation_config={"response_mime_type": "application/json"})
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"AI Batch Analysis Failed: {e}", exc_info=True)
        return {"results": []}

def analyze_income_statement(file_bytes, mime_type):
    if not Config.GEMINI_API_KEY: return None
    model_name = get_model_by_tier("pro")
    prompt = "Analyze this Payslip. Return JSON { \"bruto\": 0, \"neto\": 0, \"taxes\": 0, \"pension\": 0, \"other_deposits\": 0 }"
    try:
        model = genai.GenerativeModel(model_name, generation_config={"response_mime_type": "application/json"})
        file_part = {"mime_type": mime_type, "data": file_bytes}
        response = model.generate_content([prompt, file_part])
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"AI Income Analysis Failed: {e}", exc_info=True)
        return None