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

print("--- EXLI BACKEND v5.0 (GEMINI 2.5/3.0 READY) ---", flush=True)

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("CRITICAL WARNING: GEMINI_API_KEY is missing!", flush=True)
else:
    # Clean the key of any accidental formatting
    clean_key = GEMINI_API_KEY.replace("(", "").replace(")", "").strip()
    genai.configure(api_key=clean_key)

def get_best_available_model():
    """
    Picks the best model from the user's specific available list.
    """
    try:
        # Get list of all models available to this API key
        # The API returns names like 'models/gemini-2.5-flash'
        all_models = [m.name for m in genai.list_models()]
        print(f"DEBUG: Found {len(all_models)} available models.", flush=True)
        
        # Priority Queue (The "Quick & Latest" you requested)
        # We strip 'models/' prefix when instantiating, but match against the full list
        priorities = [
            'gemini-2.5-flash',           # Newest Fast Model
            'gemini-2.0-flash',           # Stable Fast Model
            'gemini-flash-latest',        # Generic Alias
            'gemini-3-pro-preview',       # The "3.0" you saw (Backup, might be slower)
            'gemini-pro'                  # Old faithful
        ]
        
        for p in priorities:
            # Check if this priority exists in the allowed list
            for m in all_models:
                if p in m:
                    print(f"Selected Optimized Model: {p}", flush=True)
                    return p
                    
        # Fallback
        return 'gemini-2.5-flash'
        
    except Exception as e:
        print(f"Model selection error: {e}. Defaulting to 2.5-flash", flush=True)
        return 'gemini-2.5-flash'

def get_file_structure_from_ai(text_sample):
    model_name = get_best_available_model()

    print(f"Analyzing sample with: {model_name}...", flush=True)

    prompt = f"""
    You are a financial data parsing assistant.
    RAW DATA SAMPLE:
    '''
    {text_sample}
    '''
    
    TASK: Return a JSON object with:
    1. 'delimiter': The single character used to separate columns (e.g. "," or ";" or "|").
    2. 'mapping': Map the standard keys below to the EXACT headers found in the file row.
       Keys: "date", "description", "amount", "category", "currency".
    
    If a field is not found in the headers, set it to null.
    
    Response MIME type: application/json
    """

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        
        # Clean response (sometimes models add markdown formatting)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
        
    except Exception as e:
        print(f"AI Generation Failed ({model_name}): {e}", flush=True)
        return None

@app.route('/', methods=['GET'])
def health_check():
    return "Exli Backend v5.0 (Gemini 2.5) is Online", 200

@app.route('/test-ai', methods=['GET'])
def test_ai():
    """Debug route to verify the specific model works"""
    model_name = get_best_available_model()
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Reply with 'Success'")
        return jsonify({
            "status": "success", 
            "model_used": model_name,
            "reply": response.text
        })
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
        
        # Robust decoding
        try:
            text_sample = raw_bytes[:4000].decode('utf-8')
        except:
            text_sample = raw_bytes[:4000].decode('latin1')

        # --- AI ANALYSIS ---
        ai_config = get_file_structure_from_ai(text_sample)
        
        if not ai_config:
            return jsonify({"error": "AI analysis failed. Check logs."}), 500

        delimiter = ai_config.get('delimiter', ',')
        mapping = ai_config.get('mapping', {})
        
        print(f"AI Configured: Delimiter='{delimiter}' Mapping={mapping}", flush=True)

        # --- PANDAS LOAD ---
        # Use the AI-detected delimiter to read the CSV
        df = pd.read_csv(
            io.BytesIO(raw_bytes), 
            sep=delimiter, 
            engine='python', 
            on_bad_lines='skip'
        )

        # Clean up
        df.columns = df.columns.astype(str).str.strip()
        df_clean = df.astype(object).where(pd.notnull(df), None)
        
        return jsonify({
            "message": "File analyzed by AI",
            "columns": df.columns.tolist(),
            "suggested_mapping": mapping,
            "preview_data": df_clean.head(5).values.tolist(),
            "detected_delimiter": delimiter
        })

    except Exception as e:
        print(f"CRITICAL ERROR: {e}", flush=True)
        return jsonify({"error": f"Processing Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))