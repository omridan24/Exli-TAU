from flask import Flask, request, jsonify
from flask_cors import CORS
from config import logger
from services.data_service import process_uploaded_file
import os

print("--- EXLI BACKEND v8.0 (MODULAR ARCHITECTURE) ---", flush=True)

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def health_check():
    return "Exli Backend v8.0 is Online", 200

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

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))