import os
import logging
import json
import io
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure logging to STDOUT explicitly for Cloud Run
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

print("--- EXLI BACKEND v6.4 (SMART ROW DETECTION) ---", flush=True)

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("CRITICAL WARNING: GEMINI_API_KEY is missing!", flush=True)
else:
    clean_key = GEMINI_API_KEY.replace("(", "").replace(")", "").strip()
    genai.configure(api_key=clean_key)

def get_file_structure_from_ai(text_sample):
    # STRICTLY use Gemini 2.5 Flash as requested
    model_name = 'gemini-2.5-flash'
    print(f"Analyzing structure with {model_name}...", flush=True)

    # --- DEBUG: LOG INPUT ---
    print(f"--- [DEBUG] AI INPUT SAMPLE (First 500 chars) ---\n{text_sample[:500]}\n---------------------------------------------------", flush=True)

    # PROMPT: Updated to ask for header_row_index
    prompt = f"""
    You are a financial data parsing assistant.
    
    RAW DATA SAMPLE (First 20-30 lines of file):
    '''
    {text_sample}
    '''
    
    TASK:
    1. Identify the 0-based ROW INDEX where the actual column headers are located. 
       - If the file has garbage text at the top, count how many lines to skip.
       - Example: If line 1 is "Bank Export" and line 2 is "Date,Amount", then index is 1.
       - If headers are on the very first line, index is 0.
    2. Identify the DELIMITER character (e.g. "," or ";" or "|").
    3. Map the headers found in that specific row to these standard concepts:
       - "date" (Look for: Date, Transaction Date, תאריך)
       - "amount" (Look for: Total Cost, Amount, Debit, Price, סכום, חיוב)
       - "currency" (Look for: Currency, Coin, מטבע)
       - "category" (Look for: Category, Type, Kind, קטגוריה)
       - "description" (Look for: Description, Details, Payee, Name, תיאור, בית עסק)
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "header_row_index": <integer>,
      "delimiter": "<char>",
      "mapping": {{
        "date": "<Header Name>",
        "amount": "<Header Name>",
        "currency": "<Header Name>",
        "category": "<Header Name>",
        "description": "<Header Name>"
      }}
    }}
    """

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        
        # --- DEBUG: LOG RAW RESPONSE ---
        print(f"--- [DEBUG] AI RAW RESPONSE ---\n{response.text}\n-------------------------------", flush=True)

        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"AI Failed: {e}", flush=True)
        return None

@app.route('/', methods=['GET'])
def health_check():
    return "Exli Backend v6.4 (Smart Row Detection) is Online", 200

@app.route('/test-ai', methods=['GET'])
def test_ai():
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content("Ping")
        return jsonify({"status": "success", "reply": response.text})
    except Exception as e:
        return jsonify({"status": "error", "details": str(e)}), 500

@app.route('/analyze-file', methods=['POST'])
def analyze_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        print(f"Processing file: {file.filename}", flush=True)
        raw_bytes = file.read()
        
        df = None
        delimiter = None
        mapping = {}
        header_index = 0

        # --- PATH A: EXCEL FILE (.xlsx, .xls) ---
        if file.filename.endswith(('.xls', '.xlsx')):
            print("Detected Excel File. Loading raw to find headers...", flush=True)
            # Load raw (header=None) so we can see the garbage rows at top if any
            df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
            
            # Convert first 20 rows to CSV string so AI can see the layout
            text_sample = df_raw.head(20).to_csv(index=False, header=False)
            
            ai_config = get_file_structure_from_ai(text_sample)
            if ai_config:
                mapping = ai_config.get('mapping', {})
                header_index = ai_config.get('header_row_index', 0)
                delimiter = "Excel (n/a)"
                print(f"AI Decision -> Header Index: {header_index}", flush=True)
                
                # Reload Excel using the correct header row
                # Note: Pandas read_excel header=N means row N is header, data starts at N+1
                df = pd.read_excel(io.BytesIO(raw_bytes), header=header_index)

        # --- PATH B: CSV/TEXT FILE ---
        else:
            print("Detected Text/CSV File.", flush=True)
            # Robust Text Decoding
            try:
                text_sample = raw_bytes[:4000].decode('utf-8')
            except:
                text_sample = raw_bytes[:4000].decode('latin1')

            ai_config = get_file_structure_from_ai(text_sample)
            
            if not ai_config:
                return jsonify({"error": "AI analysis failed. Check logs."}), 500

            delimiter = ai_config.get('delimiter', ',')
            header_index = ai_config.get('header_row_index', 0)
            mapping = ai_config.get('mapping', {})
            
            print(f"AI Decision -> Delimiter: '{delimiter}' | Header Index: {header_index} | Mapping: {mapping}", flush=True)

            # 2. LOAD DATA
            df = pd.read_csv(
                io.BytesIO(raw_bytes), 
                sep=delimiter, 
                header=header_index, # <-- Magic happens here (skips garbage rows)
                engine='python', 
                encoding='utf-8-sig', 
                on_bad_lines='skip'
            )

        # --- FINAL CLEANUP & RESPONSE ---
        if df is not None:
            # Cleanup column names (strip whitespace)
            df.columns = df.columns.astype(str).str.strip()
            
            found_cols = [k for k, v in mapping.items() if v in df.columns]
            print(f"Mapped {len(found_cols)} columns successfully.", flush=True)

            # Prepare preview data (replace NaN with null for JSON)
            df_clean = df.astype(object).where(pd.notnull(df), None)
            
            return jsonify({
                "message": "File analyzed successfully",
                "columns": df.columns.tolist(),
                "suggested_mapping": mapping,
                "preview_data": df_clean.head(5).values.tolist(),
                "detected_delimiter": delimiter,
                "detected_header_row": header_index
            })
        else:
             return jsonify({"error": "Failed to load dataframe"}), 500

    except Exception as e:
        print(f"CRITICAL ERROR: {e}", flush=True)
        return jsonify({"error": f"Processing Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))