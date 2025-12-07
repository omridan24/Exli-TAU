from flask import Flask, request, jsonify
from flask_cors import CORS
from config import logger, Config
import os
from services.data_service import process_uploaded_files
from services.ai_service import analyze_income_statement
from services.stock_service import search_symbol, get_stock_details

print("--- EXLI BACKEND v12.0 (MULTI-FILE) ---", flush=True)

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def health_check():
    return "Exli Backend v12.0 is Online", 200

# --- Expense Processing ---
@app.route('/analyze-file', methods=['POST'])
def analyze_file():
    # Check for multiple files (the key is usually 'files')
    # If the frontend sends 'file', we handle that too for backward compat,
    # but the new frontend will send 'files'.
    
    uploaded_files = request.files.getlist('files')
    
    # Fallback if single 'file' was sent
    if not uploaded_files and 'file' in request.files:
        uploaded_files = [request.files['file']]

    if not uploaded_files or uploaded_files[0].filename == '':
        return jsonify({"error": "No files uploaded"}), 400

    result = process_uploaded_files(uploaded_files)
    
    if result["status"] == "error":
        return jsonify({"error": result["message"]}), 500
    
    return jsonify(result)

# --- Income Processing ---
@app.route('/analyze-income', methods=['POST'])
def analyze_income():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    mime_type = file.content_type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    
    if mime_type not in allowed_types:
        if file.filename.lower().endswith('.pdf'): mime_type = 'application/pdf'
        elif file.filename.lower().endswith(('.jpg', '.jpeg')): mime_type = 'image/jpeg'
        elif file.filename.lower().endswith('.png'): mime_type = 'image/png'
        else:
            return jsonify({"error": "Unsupported file type."}), 400

    try:
        file_bytes = file.read()
        result = analyze_income_statement(file_bytes, mime_type)
        if result:
            return jsonify({"status": "success", "data": result})
        else:
            return jsonify({"error": "AI could not extract data."}), 500
    except Exception as e:
        logger.error(f"Income API Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- Investment Endpoints ---
@app.route('/stock/search', methods=['GET'])
def stock_search():
    query = request.args.get('q')
    if not query: return jsonify([])
    results = search_symbol(query)
    return jsonify(results)

@app.route('/stock/details', methods=['GET'])
def stock_details():
    symbol = request.args.get('symbol')
    if not symbol: return jsonify({"error": "No symbol"}), 400
    data = get_stock_details(symbol)
    if data:
        return jsonify(data)
    return jsonify({"error": "Stock not found"}), 404

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))