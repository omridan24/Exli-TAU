from flask import Flask, request, jsonify
from flask_cors import CORS
from config import logger, Config
import os
from services.data_service import process_uploaded_files
from services.ai_service import analyze_income_statement
from services.stock_service import search_symbol, get_stock_details
from traceloop.sdk import Traceloop

# --- TRACELOOP INIT ---
if os.environ.get("TRACELOOP_API_KEY"):
    try:
        Traceloop.init(
            disable_batch=False,  # Enable batching for reliability
            api_key=os.environ.get("TRACELOOP_API_KEY"),
            app_name="exli_backend",
            should_enrich_metrics=True
        )
        logger.info("✓ Traceloop initialized successfully")
    except Exception as e:
        logger.error(f"✗ Traceloop init failed: {e}", exc_info=True)

print("--- EXLI BACKEND v12.0 (MULTI-FILE) ---", flush=True)

app = Flask(__name__)
CORS(app)

# Constants
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB (Document AI limit)

def validate_uploaded_files(files):
    """
    Validates file sizes before processing.
    Raises ValueError if any file exceeds MAX_FILE_SIZE.
    """
    for file in files:
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)  # Reset to beginning
        
        if size > MAX_FILE_SIZE:
            size_mb = size / 1024 / 1024
            max_mb = MAX_FILE_SIZE / 1024 / 1024
            raise ValueError(
                f"File '{file.filename}' is {size_mb:.1f}MB. "
                f"Maximum allowed is {max_mb:.0f}MB for optimal processing."
            )
        
        logger.info(f"File '{file.filename}': {size/1024:.1f}KB - size OK")
    
    return True

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
    
    # Validate file sizes BEFORE processing
    try:
        validate_uploaded_files(uploaded_files)
    except ValueError as e:
        logger.warning(f"File size validation failed: {e}")
        return jsonify({"error": str(e)}), 413  # 413 Payload Too Large

    # Process all files synchronously
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
    
    # Validate file size BEFORE processing
    try:
        validate_uploaded_files([file])
    except ValueError as e:
        logger.warning(f"Income file size validation failed: {e}")
        return jsonify({"error": str(e)}), 413

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

@app.route('/analyze-recurring', methods=['POST'])
def analyze_recurring():
    """
    Analyzes user's expense history to detect recurring patterns.
    Fetches data from Firestore, uses Gemini for conservative detection.
    """
    data = request.get_json()
    user_id = data.get('userId')
    
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    try:
        # Import Firestore
        from google.cloud import firestore
        db = firestore.Client()
        
        # Fetch ALL user expenses from Firestore
        expenses_ref = db.collection('users').document(user_id).collection('expenses')
        expenses_docs = expenses_ref.stream()
        
        expenses = []
        for doc in expenses_docs:
            expense_data = doc.to_dict()
            expenses.append({
                'date': expense_data.get('date'),
                'description': expense_data.get('description'),
                'amount': expense_data.get('amount'),
                'currency': expense_data.get('currency', 'ILS'),
                'category': expense_data.get('assignedCategory', 'uncategorized')
            })
        
        logger.info(f"Fetched {len(expenses)} expenses for user {user_id}")
        
        # Send to LLM for analysis
        from services.recurring_service import analyze_recurring_with_ai
        suggestions = analyze_recurring_with_ai(expenses)
        
        return jsonify({
            "status": "success",
            "suggestions": suggestions
        })
    except Exception as e:
        logger.error(f"Recurring analysis failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))