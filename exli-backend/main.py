from flask import Flask, request, jsonify
from flask_cors import CORS
from config import logger
from services.data_service import process_uploaded_file
from services.ai_service import analyze_income_statement

print("--- EXLI BACKEND v10.0 (INCOME API) ---", flush=True)

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def health_check():
    return "Exli Backend v10.0 is Online", 200

# --- Expense Processing ---
@app.route('/analyze-file', methods=['POST'])
def analyze_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    result = process_uploaded_file(file)
    
    if result["status"] == "error":
        return jsonify({"error": result["message"]}), 500
    
    return jsonify(result)

# --- New: Income Processing ---
@app.route('/analyze-income', methods=['POST'])
def analyze_income():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Validate Mime Type (Gemini supports Images and PDF)
    mime_type = file.content_type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    
    if mime_type not in allowed_types:
        # Fallback based on extension if content-type is generic
        if file.filename.lower().endswith('.pdf'): mime_type = 'application/pdf'
        elif file.filename.lower().endswith(('.jpg', '.jpeg')): mime_type = 'image/jpeg'
        elif file.filename.lower().endswith('.png'): mime_type = 'image/png'
        else:
            return jsonify({"error": "Unsupported file type. Please upload PDF or Image (JPG/PNG)."}), 400

    try:
        file_bytes = file.read()
        result = analyze_income_statement(file_bytes, mime_type)
        
        if result:
            return jsonify({"status": "success", "data": result})
        else:
            return jsonify({"error": "AI could not extract data from this file."}), 500
            
    except Exception as e:
        logger.error(f"Income API Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))