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

# Configure logging
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

print("--- EXLI BACKEND v7.1 (TOKEN OPTIMIZED) ---", flush=True)

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("CRITICAL WARNING: GEMINI_API_KEY is missing!", flush=True)
else:
    clean_key = GEMINI_API_KEY.replace("(", "").replace(")", "").strip()
    genai.configure(api_key=clean_key)

def get_file_structure_from_ai(text_head, text_tail):
    model_name = 'gemini-2.5-flash'
    print(f"Analyzing structure with {model_name}...", flush=True)

    # --- OPTIMIZATION: REDUCED CONTEXT ---
    # We rely on the fact that headers are almost always in the top 15 lines
    # and totals are in the bottom 5.
    
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
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "header_row_index": <int>,
      "footer_skip_count": <int>,
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
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"AI Failed: {e}", flush=True)
        return None

@app.route('/', methods=['GET'])
def health_check():
    return "Exli Backend v7.1 (Optimized) is Online", 200

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
        footer_count = 0

        # --- PATH A: EXCEL FILE ---
        if file.filename.endswith(('.xls', '.xlsx')):
            print("Detected Excel File.", flush=True)
            df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
            
            # OPTIMIZATION: Only send top 20 and bottom 5 rows
            text_head = df_raw.head(20).to_csv(index=False, header=False)
            text_tail = df_raw.tail(5).to_csv(index=False, header=False)
            
            ai_config = get_file_structure_from_ai(text_head, text_tail)
            
            if ai_config:
                mapping = ai_config.get('mapping', {})
                header_index = ai_config.get('header_row_index', 0)
                footer_count = ai_config.get('footer_skip_count', 0)
                delimiter = "Excel (n/a)"
                
                df = pd.read_excel(io.BytesIO(raw_bytes), header=header_index)
                if footer_count > 0:
                    df = df.iloc[:-footer_count]

        # --- PATH B: CSV/TEXT FILE ---
        else:
            print("Detected Text/CSV File.", flush=True)
            try:
                full_text = raw_bytes.decode('utf-8', errors='ignore')
            except:
                full_text = raw_bytes.decode('latin1', errors='ignore')

            lines = full_text.splitlines()
            # OPTIMIZATION: Top 15 lines, Bottom 5 lines
            text_head = "\n".join(lines[:15])
            text_tail = "\n".join(lines[-5:]) if len(lines) > 20 else ""

            ai_config = get_file_structure_from_ai(text_head, text_tail)
            
            if not ai_config:
                return jsonify({"error": "AI analysis failed."}), 500

            delimiter = ai_config.get('delimiter', ',')
            header_index = ai_config.get('header_row_index', 0)
            footer_count = ai_config.get('footer_skip_count', 0)
            mapping = ai_config.get('mapping', {})
            
            df = pd.read_csv(
                io.BytesIO(raw_bytes), 
                sep=delimiter, 
                header=header_index, 
                skipfooter=footer_count,
                engine='python', 
                encoding='utf-8-sig', 
                on_bad_lines='skip'
            )

        if df is not None:
            df.columns = df.columns.astype(str).str.strip()
            
            # Prune columns
            valid_headers = []
            for key, header_name in mapping.items():
                if header_name and header_name in df.columns:
                    valid_headers.append(header_name)
            
            if valid_headers:
                df = df[valid_headers]

            df_clean = df.astype(object).where(pd.notnull(df), None)
            
            return jsonify({
                "message": "File analyzed successfully",
                "columns": df.columns.tolist(),
                "suggested_mapping": mapping,
                "preview_data": df_clean.head(5).values.tolist(),
                "all_data": df_clean.values.tolist(),
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