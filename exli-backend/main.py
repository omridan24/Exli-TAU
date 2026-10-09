from flask import Flask, request, jsonify
from flask_cors import CORS
from config import logger, Config
import os
from datetime import datetime
from services.data_service import process_uploaded_files, process_uploaded_files_auto
from services.ai_service import analyze_income_statement, extract_payslip_data, extract_investment_statement_data
from services.stock_service import search_symbol, get_stock_details
from services.market_data_service import MarketDataService
from services.quota_service import check_and_increment_quota
from utils.security import validate_file_safety
from extensions import limiter
from routes.groups import groups_bp
from routes.expenses import expenses_bp
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

# --- Rate Limit Init ---
# `limiter` is created in extensions.py (no app yet) so routes/groups.py can also
# apply @limiter.limit(...) to its blueprint routes without a circular import.
app.config["RATELIMIT_DEFAULT"] = Config.RATE_LIMIT_GLOBAL
limiter.init_app(app)

# --- Groups Blueprint ---
app.register_blueprint(groups_bp)
app.register_blueprint(expenses_bp)

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
@limiter.limit(Config.RATE_LIMIT_AI)
def analyze_file():
    # Check for multiple files (the key is usually 'files')
    # If the frontend sends 'file', we handle that too for backward compat,
    # but the new frontend will send 'files'.
    
    uploaded_files = request.files.getlist('files')
    
    # Fallback if single 'file' was sent
    if not uploaded_files and 'file' in request.files:
        uploaded_files = [request.files['file']]

    if not uploaded_files or uploaded_files[0].filename == '':
        logger.warning("Analyze file: No files uploaded")
        return jsonify({"error": "No files uploaded"}), 400
    
    # Validate file sizes BEFORE processing
    try:
        validate_uploaded_files(uploaded_files)
    except ValueError as e:
        logger.warning(f"File size validation failed: {e}")
        return jsonify({"error": str(e)}), 413  # 413 Payload Too Large

    # --- Security & Quota Checks ---
    user_id = request.form.get('userId')
    if not user_id:
        logger.warning("Analyze file: Missing userId")
        return jsonify({"error": "Missing userId"}), 400

    # 1. Check Quota
    check_and_increment_quota(user_id)

    # 2. Check Security (Magic Numbers)
    for f in uploaded_files:
        validate_file_safety(f)

    # Process all files synchronously
    result = process_uploaded_files(uploaded_files)
    
    if result["status"] == "error":
        return jsonify({"error": result["message"]}), 500
    
    return jsonify(result)

# --- Auto-Categorized Expense Processing ---
@app.route('/analyze-file-auto', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT_AI)
def analyze_file_auto():
    """
    Processes uploaded expense files with AUTO-CATEGORIZATION.
    Same file upload as /analyze-file but returns auto-categorized transactions
    with month detection and category matching via dictionary.
    """
    uploaded_files = request.files.getlist('files')
    
    # Fallback if single 'file' was sent
    if not uploaded_files and 'file' in request.files:
        uploaded_files = [request.files['file']]

    if not uploaded_files or uploaded_files[0].filename == '':
        logger.warning("Analyze file auto: No files uploaded")
        return jsonify({"error": "No files uploaded"}), 400
    
    # Validate file sizes
    try:
        validate_uploaded_files(uploaded_files)
    except ValueError as e:
        logger.warning(f"File size validation failed: {e}")
        return jsonify({"error": str(e)}), 413

    # --- Security & Quota Checks ---
    user_id = request.form.get('userId')
    if not user_id:
        logger.warning("Analyze file auto: Missing userId")
        return jsonify({"error": "Missing userId"}), 400

    # 1. Check Quota
    check_and_increment_quota(user_id)

    # 2. Check Security (Magic Numbers)
    for f in uploaded_files:
        validate_file_safety(f)

    # Process with auto-categorization
    result = process_uploaded_files_auto(uploaded_files)
    
    if result["status"] == "error":
        return jsonify({"error": result["message"]}), 500
    
    return jsonify(result)

# --- Income Processing ---
@app.route('/analyze-income', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT_AI)
def analyze_income():
    if 'file' not in request.files:
        logger.warning("Analyze income: No 'file' key in request.files")
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Analyze income: filename is empty")
        return jsonify({"error": "No selected file"}), 400
    


    # --- Security & Quota Checks ---
    user_id = request.form.get('userId')
    if not user_id:
        logger.warning("Analyze income: Missing userId")
        return jsonify({"error": "Missing userId"}), 400

    check_and_increment_quota(user_id)
    validate_file_safety(file)

    mime_type = file.content_type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    
    if mime_type not in allowed_types:
        if file.filename.lower().endswith('.pdf'): mime_type = 'application/pdf'
        elif file.filename.lower().endswith(('.jpg', '.jpeg')): mime_type = 'image/jpeg'
        elif file.filename.lower().endswith('.png'): mime_type = 'image/png'
        else:
            logger.warning(f"Analyze income: Unsupported file type: {file.filename}")
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

@app.route('/analyze-payslip', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT_AI)
def analyze_payslip():
    if 'file' not in request.files:
        logger.warning("Analyze payslip: No 'file' key in request.files")
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Analyze payslip: filename is empty")
        return jsonify({"error": "No selected file"}), 400
    


    # --- Security & Quota Checks ---
    user_id = request.form.get('userId')
    if not user_id:
        logger.warning("Analyze payslip: Missing userId")
        return jsonify({"error": "Missing userId"}), 400

    check_and_increment_quota(user_id)
    validate_file_safety(file)

    mime_type = file.content_type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    
    if mime_type not in allowed_types:
        if file.filename.lower().endswith('.pdf'): mime_type = 'application/pdf'
        elif file.filename.lower().endswith(('.jpg', '.jpeg')): mime_type = 'image/jpeg'
        elif file.filename.lower().endswith('.png'): mime_type = 'image/png'
        else:
            logger.warning(f"Analyze payslip: Unsupported file type: {file.filename}")
            return jsonify({"error": "Unsupported file type."}), 400

    try:
        file_bytes = file.read()
        result = extract_payslip_data(file_bytes, mime_type)
        if result:
            return jsonify({"status": "success", "data": result})
        else:
            return jsonify({"error": "AI could not extract payslip data."}), 500
    except Exception as e:
        logger.error(f"Payslip API Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-payslips-batch', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT_AI)
def analyze_payslips_batch():
    if 'files' not in request.files:
        logger.warning("Analyze payslips batch: No 'files' key in request.files")
        return jsonify({"error": "No files part"}), 400
    
    uploaded_files = request.files.getlist('files')
    if not uploaded_files or all(f.filename == '' for f in uploaded_files):
        logger.warning("Analyze payslips batch: No selected files")
        return jsonify({"error": "No selected files"}), 400
        
    user_id = request.form.get('userId')
    if not user_id:
        logger.warning("Analyze payslips batch: Missing userId")
        return jsonify({"error": "Missing userId"}), 400

    check_and_increment_quota(user_id)
    
    results = []
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    
    for file in uploaded_files:
        if file.filename == '': continue
        validate_file_safety(file)
        
        mime_type = file.content_type
        if mime_type not in allowed_types:
            if file.filename.lower().endswith('.pdf'): mime_type = 'application/pdf'
            elif file.filename.lower().endswith(('.jpg', '.jpeg')): mime_type = 'image/jpeg'
            elif file.filename.lower().endswith('.png'): mime_type = 'image/png'
            else:
                results.append({"filename": file.filename, "error": "Unsupported file type"})
                continue
                
        try:
            file_bytes = file.read()
            # This calls the Gemini endpoint which could take time, maybe process concurrently?
            # For simplicity and rate limits, we'll process them sequentially here.
            extracted = extract_payslip_data(file_bytes, mime_type)
            if extracted:
                results.append({"filename": file.filename, "data": extracted, "status": "success"})
            else:
                results.append({"filename": file.filename, "error": "AI could not extract data", "status": "error"})
        except Exception as e:
            logger.error(f"Batch payslip error for {file.filename}: {e}", exc_info=True)
            results.append({"filename": file.filename, "error": str(e), "status": "error"})
            
    return jsonify({"status": "success", "results": results})

# --- Investment Endpoints ---
# Initialize market data service
market_service = MarketDataService()

def match_or_create_symbol(holding, db):
    """
    Try to match an extracted holding to an existing symbol.

    1. Exact symbol match against our database - cheap, and correct almost
       always since the AI extraction prompt asks for standard tickers.
    2. Otherwise, search (local DB + live TwelveData fallback) for candidates.
       An exact symbol match among candidates is auto-selected. Anything less
       certain (multiple candidates, or only a fuzzy name match) is flagged
       with needsReview + candidates so the frontend can ask the user which
       one they meant, instead of silently guessing or creating a duplicate.
    3. If nothing matches at all, fall back to creating a bare-bones entry
       from the statement's own numbers (previous behavior), marked
       unverified so it's visually distinct from a confirmed match.

    Different companies tracking the same index (e.g., VOO vs SPY) are kept separate.
    Each symbol+name combination is treated as distinct.
    """
    from datetime import datetime
    import re

    symbol = (holding.get('symbol') or '').upper().strip()
    name = (holding.get('name') or '').strip()
    local_id = (holding.get('localSecurityId') or '').strip()
    local_key = f"LOCAL_{local_id}" if local_id else None

    if not symbol and not name:
        # Nothing to go on at all - can't process this holding
        holding['inDatabase'] = False
        holding['newToDatabase'] = False
        return holding

    try:
        # 1. Exact match against our database - by ticker, or (for a security with no
        # real ticker) by the same local-exchange security number we may have created
        # an entry under on an earlier statement upload.
        for key in filter(None, [symbol, local_key]):
            doc = db.collection('marketData').document(key).get()
            if doc.exists:
                existing_data = doc.to_dict()
                holding['symbol'] = key
                holding['inDatabase'] = True
                holding['newToDatabase'] = False
                if not holding.get('currentPrice') and existing_data.get('currentPrice'):
                    holding['currentPrice'] = existing_data['currentPrice']
                return holding

        # 2. Search for candidates (local DB + live TwelveData fallback)
        search_query = symbol or name
        candidates = market_service.search_symbols(search_query, limit=5) if search_query else []

        exact_matches = [c for c in candidates if c['symbol'].upper() == symbol or c['symbol'] == local_key]

        if len(exact_matches) == 1:
            # Confident match - fetch (and cache) its full data, use it. A LOCAL_
            # entry is our own synthetic key, not a real market symbol, so there's
            # nothing to live-fetch for it - just use what's already cached.
            match = exact_matches[0]
            holding['symbol'] = match['symbol']
            holding['inDatabase'] = True
            holding['newToDatabase'] = not match.get('inDatabase', False)
            if not holding.get('currentPrice'):
                if match['symbol'].startswith('LOCAL_'):
                    holding['currentPrice'] = match.get('currentPrice')
                else:
                    full_data = market_service.get_symbol_data(match['symbol'])
                    if full_data:
                        holding['currentPrice'] = full_data.get('currentPrice')
            return holding

        if candidates:
            # One or more plausible-but-not-certain matches - let the user decide
            holding['inDatabase'] = False
            holding['newToDatabase'] = False
            holding['needsReview'] = True
            holding['candidates'] = candidates[:5]
            return holding

        # 3. No match anywhere - last resort, create from statement data if we can.
        # A holding can genuinely have no real ticker (e.g. a TASE-only mutual fund -
        # see the prompt in ai_service.py), so don't require `symbol` here: fall back
        # to the statement's own local security number, or a name-derived key.
        quantity = holding.get('quantity')
        market_value = holding.get('marketValue')
        price_per_unit = holding.get('pricePerUnit')

        if not price_per_unit and quantity and market_value and quantity > 0:
            price_per_unit = market_value / quantity
            holding['pricePerUnit'] = round(price_per_unit, 4)

        doc_key = symbol or local_key
        if not doc_key and name:
            slug = re.sub(r'[^A-Za-z0-9]+', '_', name).strip('_').upper()[:40]
            if slug:
                doc_key = f"LOCAL_{slug}"

        if doc_key and (price_per_unit or market_value):
            new_entry = {
                'symbol': doc_key,
                'name': name or doc_key,
                'type': holding.get('assetType', 'stock'),
                'currentPrice': price_per_unit,
                'previousClose': price_per_unit,
                'changePercent': 0,
                'currency': holding.get('currency', 'USD'),
                'aliases': [],
                'lastUpdated': datetime.utcnow().isoformat(),
                'source': 'user_statement',
                'userAdded': True
            }
            if local_id:
                new_entry['localSecurityId'] = local_id

            db.collection('marketData').document(doc_key).set(new_entry)
            logger.info(f"Added new symbol to database: {doc_key} ({name})")

            holding['symbol'] = doc_key
            holding['inDatabase'] = True
            holding['newToDatabase'] = True
            holding['unverified'] = True  # No independent source confirmed this is a real ticker
            holding['currentPrice'] = price_per_unit

            return holding

        # Not enough data to create, just mark as not in database
        holding['inDatabase'] = False
        holding['newToDatabase'] = False
        return holding

    except Exception as e:
        logger.error(f"Error matching/creating symbol {symbol}: {e}")
        holding['inDatabase'] = False
        holding['newToDatabase'] = False
        return holding

def send_new_symbols_email(new_symbols):
    """Send email notification about newly added symbols."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    NOTIFICATION_EMAIL = os.environ.get("NOTIFICATION_EMAIL", "admin@example.com")
    
    if not SMTP_USER or not SMTP_PASSWORD or not new_symbols:
        return False
    
    try:
        symbols_list = "\n".join([f"- {s['symbol']}: {s['name']} ({s['type']}) - ${s.get('price', 'N/A')}" for s in new_symbols])
        
        subject = f"Exli: {len(new_symbols)} New Symbol(s) Added from User Statement"
        body = f"""
New securities were added to the Exli database from a user's brokerage statement.

SYMBOLS ADDED:
{symbols_list}

Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC

These symbols are now searchable by all users.
        """
        
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = NOTIFICATION_EMAIL
        msg.attach(MIMEText(body, "plain"))
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, NOTIFICATION_EMAIL, msg.as_string())
        
        logger.info(f"New symbols email sent: {len(new_symbols)} symbols")
        return True
    except Exception as e:
        logger.error(f"Failed to send new symbols email: {e}")
        return False

@app.route('/analyze-investment-statement', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT_AI)
def analyze_investment_statement():
    """
    Extracts holdings from brokerage statements using Document AI + Gemini.
    Matches symbols against database, creates new entries for unknown symbols.
    Returns structured data for user to review and edit before saving.
    """
    from datetime import datetime
    from google.cloud import firestore
    
    if 'file' not in request.files:
        logger.warning("Analyze investment statement: No 'file' key in request.files")
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Analyze investment statement: filename is empty")
        return jsonify({"error": "No selected file"}), 400

    # --- Security & Quota Checks ---
    user_id = request.form.get('userId')
    if not user_id:
        logger.warning("Analyze investment statement: Missing userId")
        return jsonify({"error": "Missing userId"}), 400

    check_and_increment_quota(user_id)
    validate_file_safety(file)

    mime_type = file.content_type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    
    if mime_type not in allowed_types:
        if file.filename.lower().endswith('.pdf'): mime_type = 'application/pdf'
        elif file.filename.lower().endswith(('.jpg', '.jpeg')): mime_type = 'image/jpeg'
        elif file.filename.lower().endswith('.png'): mime_type = 'image/png'
        else:
            logger.warning(f"Analyze investment statement: Unsupported file type: {file.filename}")
            return jsonify({"error": "Unsupported file type. Please upload PDF or image."}), 400

    try:
        file_bytes = file.read()
        extraction = extract_investment_statement_data(file_bytes, mime_type)
        holdings = extraction.get("holdings", []) if extraction is not None else None
        as_of_date = extraction.get("asOfDate") if extraction is not None else None

        if holdings is not None and len(holdings) > 0:
            # Initialize Firestore
            db = firestore.Client()

            # Match/create symbols in database
            new_symbols = []
            processed_holdings = []
            seen_keys = set()

            for holding in holdings:
                # Create unique key to prevent duplicates
                key = f"{holding.get('symbol', '')}-{holding.get('name', '')}"
                if key in seen_keys:
                    continue
                seen_keys.add(key)

                # Match or create in database
                processed = match_or_create_symbol(holding, db)
                processed_holdings.append(processed)

                # Track new symbols for email notification
                if processed.get('newToDatabase'):
                    new_symbols.append({
                        'symbol': processed.get('symbol'),
                        'name': processed.get('name'),
                        'type': processed.get('assetType', 'stock'),
                        'price': processed.get('currentPrice')
                    })

            # Send email notification for new symbols (don't block response)
            if new_symbols:
                try:
                    send_new_symbols_email(new_symbols)
                except Exception as e:
                    logger.warning(f"Email notification failed (non-blocking): {e}")

            return jsonify({
                "status": "success",
                "holdings": processed_holdings,
                "asOfDate": as_of_date,
                "newSymbolsAdded": len(new_symbols),
                "message": "Please review and edit the extracted data before saving."
            })
        else:
            return jsonify({"error": "AI could not extract holdings from this statement."}), 500
    except Exception as e:
        logger.error(f"Investment Statement API Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/market/search', methods=['GET'])
def market_search():
    """Search stocks/ETFs/currencies by name or symbol (with alias matching)"""
    query = request.args.get('q', '')
    limit = request.args.get('limit', 20, type=int)
    if not query:
        return jsonify([])
    results = market_service.search_symbols(query, limit)
    return jsonify(results)

@app.route('/market/symbol/<symbol>', methods=['GET'])
def market_symbol_details(symbol):
    """Get price history and current quote for a symbol"""
    data = market_service.get_symbol_data(symbol)
    if data:
        return jsonify(data)
    return jsonify({"error": "Symbol not found"}), 404

@app.route('/market/currencies', methods=['GET'])
def market_currencies():
    """Get all tracked currency pairs with latest rates"""
    currencies = market_service.get_all_cached_currencies()
    return jsonify(currencies)

@app.route('/market/currency/<path:pair>', methods=['GET'])
def market_currency_details(pair):
    """Get currency pair details (e.g., /market/currency/USD/ILS)"""
    parts = pair.split('/')
    if len(parts) != 2:
        return jsonify({"error": "Invalid pair format. Use BASE/QUOTE"}), 400
    base, quote = parts
    data = market_service.get_currency_rate(base, quote)
    if data:
        return jsonify(data)
    return jsonify({"error": "Currency pair not found"}), 404
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


# --- Goal-Based Robo-Advisor Endpoints ---

def calculate_bucket_from_deadline(deadline_date):
    """
    Auto-assign a goal to a bucket based on time horizon.
    - Short Term: 0-3 years (safe, low volatility)
    - Mid Range: 3-10 years (balanced)
    - Long Range: 10+ years (aggressive, high growth)
    """
    from datetime import datetime
    
    if isinstance(deadline_date, str):
        deadline = datetime.fromisoformat(deadline_date.replace('Z', '+00:00'))
    else:
        deadline = deadline_date
    
    now = datetime.now(deadline.tzinfo) if deadline.tzinfo else datetime.now()
    months_to_deadline = (deadline.year - now.year) * 12 + (deadline.month - now.month)
    years_to_deadline = months_to_deadline / 12
    
    if years_to_deadline <= 3:
        return "short", months_to_deadline
    elif years_to_deadline <= 10:
        return "mid", months_to_deadline
    else:
        return "long", months_to_deadline


def recalculate_target_allocation(goals):
    """
    Calculate target allocation percentages based on goals.
    Goals are weighted by their target amount.
    """
    if not goals:
        return {"short": 0.2, "mid": 0.3, "long": 0.5}  # Default balanced
    
    bucket_totals = {"short": 0, "mid": 0, "long": 0}
    total_amount = 0
    
    for goal in goals:
        bucket = goal.get("bucketCategory", "mid")
        amount = goal.get("targetAmount", 0)
        bucket_totals[bucket] += amount
        total_amount += amount
    
    if total_amount == 0:
        return {"short": 0.2, "mid": 0.3, "long": 0.5}
    
    return {
        "short": round(bucket_totals["short"] / total_amount, 2),
        "mid": round(bucket_totals["mid"] / total_amount, 2),
        "long": round(bucket_totals["long"] / total_amount, 2)
    }


@app.route('/investments/goals', methods=['POST'])
def save_investment_goal():
    """
    Add or update a financial goal.
    Auto-calculates bucket category based on deadline.
    """
    from google.cloud import firestore
    from datetime import datetime
    import uuid
    
    data = request.get_json()
    user_id = data.get('userId')
    
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    goal_data = data.get('goal', {})
    if not goal_data.get('name') or not goal_data.get('targetAmount') or not goal_data.get('deadlineDate'):
        return jsonify({"error": "Missing required fields: name, targetAmount, deadlineDate"}), 400
    
    try:
        db = firestore.Client()
        
        # Auto-calculate bucket and months to deadline
        bucket_category, months_to_deadline = calculate_bucket_from_deadline(goal_data['deadlineDate'])
        
        # Calculate required monthly saving
        required_monthly = goal_data['targetAmount'] / max(months_to_deadline, 1)
        
        goal_id = goal_data.get('id') or str(uuid.uuid4())
        
        goal_doc = {
            "id": goal_id,
            "name": goal_data['name'],
            "targetAmount": goal_data['targetAmount'],
            "currency": goal_data.get('currency', 'ILS'),
            "deadlineDate": goal_data['deadlineDate'],
            "presetType": goal_data.get('presetType'),  # wedding, house, baby, etc.
            "bucketCategory": bucket_category,
            "monthsToDeadline": months_to_deadline,
            "requiredMonthlySaving": round(required_monthly, 2),
            "createdAt": goal_data.get('createdAt') or datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat()
        }
        
        # Save goal
        db.collection('users').document(user_id).collection('goals').document(goal_id).set(goal_doc)
        logger.info(f"Saved goal '{goal_data['name']}' for user {user_id} -> {bucket_category} bucket")
        
        # Trigger allocation recalculation
        goals_ref = db.collection('users').document(user_id).collection('goals')
        all_goals = [doc.to_dict() for doc in goals_ref.stream()]
        new_allocation = recalculate_target_allocation(all_goals)
        
        # Update investment profile with new allocation
        profile_ref = db.collection('users').document(user_id).collection('investmentProfile').document('main')
        profile_ref.set({
            "targetAllocation": new_allocation,
            "totalGoals": len(all_goals),
            "totalTargetAmount": sum(g.get('targetAmount', 0) for g in all_goals),
            "totalMonthlyRequired": sum(g.get('requiredMonthlySaving', 0) for g in all_goals),
            "lastUpdated": datetime.utcnow().isoformat()
        }, merge=True)
        
        return jsonify({
            "status": "success",
            "goal": goal_doc,
            "bucketCategory": bucket_category,
            "newAllocation": new_allocation,
            "message": f"Goal added to {bucket_category.upper()} bucket (0-3y safe zone)" if bucket_category == "short" else f"Goal added to {bucket_category.upper()} bucket"
        })
        
    except Exception as e:
        logger.error(f"Save goal failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/investments/goals/<user_id>', methods=['GET'])
def get_investment_goals(user_id):
    """Get all goals for a user."""
    from google.cloud import firestore
    
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    try:
        db = firestore.Client()
        goals_ref = db.collection('users').document(user_id).collection('goals')
        goals = [doc.to_dict() for doc in goals_ref.stream()]
        
        # Group by bucket
        grouped = {"short": [], "mid": [], "long": []}
        for goal in goals:
            bucket = goal.get("bucketCategory", "mid")
            grouped[bucket].append(goal)
        
        return jsonify({
            "status": "success",
            "goals": goals,
            "groupedByBucket": grouped,
            "totalGoals": len(goals)
        })
        
    except Exception as e:
        logger.error(f"Get goals failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/investments/goals/<user_id>/<goal_id>', methods=['DELETE'])
def delete_investment_goal(user_id, goal_id):
    """Delete a goal and recalculate allocation."""
    from google.cloud import firestore
    from datetime import datetime
    
    try:
        db = firestore.Client()
        
        # Delete the goal
        db.collection('users').document(user_id).collection('goals').document(goal_id).delete()
        logger.info(f"Deleted goal {goal_id} for user {user_id}")
        
        # Recalculate allocation
        goals_ref = db.collection('users').document(user_id).collection('goals')
        remaining_goals = [doc.to_dict() for doc in goals_ref.stream()]
        new_allocation = recalculate_target_allocation(remaining_goals)
        
        # Update profile
        profile_ref = db.collection('users').document(user_id).collection('investmentProfile').document('main')
        profile_ref.set({
            "targetAllocation": new_allocation,
            "totalGoals": len(remaining_goals),
            "totalTargetAmount": sum(g.get('targetAmount', 0) for g in remaining_goals),
            "totalMonthlyRequired": sum(g.get('requiredMonthlySaving', 0) for g in remaining_goals),
            "lastUpdated": datetime.utcnow().isoformat()
        }, merge=True)
        
        return jsonify({
            "status": "success",
            "message": "Goal deleted",
            "newAllocation": new_allocation,
            "remainingGoals": len(remaining_goals)
        })
        
    except Exception as e:
        logger.error(f"Delete goal failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/investments/profile', methods=['POST'])
def save_investment_profile():
    """
    Save user's risk profile from stress test.
    """
    from google.cloud import firestore
    from datetime import datetime
    
    data = request.get_json()
    user_id = data.get('userId')
    
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    try:
        db = firestore.Client()
        
        profile_data = {
            "onboardingComplete": data.get('onboardingComplete', False),
            "riskToleranceScore": data.get('riskToleranceScore', 0.5),
            "lastStressTestDate": datetime.utcnow().isoformat(),
            "stressTestResponses": data.get('stressTestResponses', {}),
            "lastUpdated": datetime.utcnow().isoformat()
        }
        
        # If target allocation is provided, merge it
        if data.get('targetAllocation'):
            profile_data["targetAllocation"] = data['targetAllocation']
        
        profile_ref = db.collection('users').document(user_id).collection('investmentProfile').document('main')
        profile_ref.set(profile_data, merge=True)
        
        logger.info(f"Saved investment profile for user {user_id} (risk: {data.get('riskToleranceScore')})")
        
        return jsonify({
            "status": "success",
            "profile": profile_data
        })
        
    except Exception as e:
        logger.error(f"Save profile failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/investments/profile/<user_id>', methods=['GET'])
def get_investment_profile(user_id):
    """Get user's investment profile including goals and allocation."""
    from google.cloud import firestore
    
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    try:
        db = firestore.Client()
        
        # Get profile
        profile_ref = db.collection('users').document(user_id).collection('investmentProfile').document('main')
        profile_doc = profile_ref.get()
        
        profile = profile_doc.to_dict() if profile_doc.exists else None
        
        # Get goals count for onboarding check
        goals_ref = db.collection('users').document(user_id).collection('goals')
        goals = [doc.to_dict() for doc in goals_ref.stream()]
        
        return jsonify({
            "status": "success",
            "profile": profile,
            "hasProfile": profile is not None,
            "onboardingComplete": profile.get('onboardingComplete', False) if profile else False,
            "totalGoals": len(goals),
            "goals": goals
        })
        
    except Exception as e:
        logger.error(f"Get profile failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/investments/recalculate/<user_id>', methods=['POST'])
def recalculate_allocation(user_id):
    """
    Manually trigger allocation recalculation.
    Useful after bulk changes or data corrections.
    """
    from google.cloud import firestore
    from datetime import datetime
    
    try:
        db = firestore.Client()
        
        # Get all goals
        goals_ref = db.collection('users').document(user_id).collection('goals')
        goals = []
        
        for doc in goals_ref.stream():
            goal = doc.to_dict()
            # Recalculate bucket in case deadline changed
            bucket, months = calculate_bucket_from_deadline(goal['deadlineDate'])
            goal['bucketCategory'] = bucket
            goal['monthsToDeadline'] = months
            goal['requiredMonthlySaving'] = round(goal['targetAmount'] / max(months, 1), 2)
            
            # Update goal doc
            doc.reference.update({
                "bucketCategory": bucket,
                "monthsToDeadline": months,
                "requiredMonthlySaving": goal['requiredMonthlySaving']
            })
            goals.append(goal)
        
        # Recalculate allocation
        new_allocation = recalculate_target_allocation(goals)
        
        # Update profile
        profile_ref = db.collection('users').document(user_id).collection('investmentProfile').document('main')
        profile_ref.set({
            "targetAllocation": new_allocation,
            "totalGoals": len(goals),
            "totalTargetAmount": sum(g.get('targetAmount', 0) for g in goals),
            "totalMonthlyRequired": sum(g.get('requiredMonthlySaving', 0) for g in goals),
            "lastUpdated": datetime.utcnow().isoformat()
        }, merge=True)
        
        logger.info(f"Recalculated allocation for user {user_id}: {new_allocation}")
        
        return jsonify({
            "status": "success",
            "newAllocation": new_allocation,
            "goals": goals,
            "message": "Allocation recalculated based on current goals and deadlines"
        })
        
    except Exception as e:
        logger.error(f"Recalculate allocation failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/system/reset-quotas', methods=['POST'])
def reset_quotas():
    auth_header = request.headers.get("X-System-Key")
    if not auth_header or auth_header != Config.SYSTEM_API_KEY:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Since quotas are stored by month-key (e.g. 2024-05), they auto-reset each month.
    # This endpoint can be used for monitoring or explicit cleanups if needed.
    return jsonify({"status": "success", "message": "Quotas reuse monthly keys. No manual reset needed."})


@app.route('/system/ingest-market-data', methods=['POST'])
def ingest_market_data():
    """
    Trigger market data ingestion. Only runs once per day, and only against
    production (a request whose Host contains "dev" is refused immediately,
    before any Firestore or TwelveData call). Protected by system API key.

    Query params:
    - force: Skip the daily check and run anyway
    - limit: Limit number of symbols (for testing, against production)
    """
    from datetime import datetime, date, timedelta
    from dataclasses import asdict
    from google.cloud import firestore
    from services.email_service import send_ingestion_report
    import time as time_module
    import time
    
    start_time = time_module.time()  # Track duration
    
    # Auth check
    auth_header = request.headers.get("X-System-Key")
    if not auth_header or auth_header != Config.SYSTEM_API_KEY:
        return jsonify({"error": "Unauthorized"}), 401
    
    force = request.args.get('force', 'false').lower() == 'true'
    limit = request.args.get('limit', type=int, default=0)

    # Ingestion is production-only. exli-processor-dev has its own Cloud
    # Scheduler job that used to fire at the same time as prod against the
    # same Firestore DB and TwelveData key, wasting credits and doubling
    # every report email - refusing here means that job (or any manual call
    # against the dev host) is a free, instant no-op regardless of whether
    # it's still enabled on the GCP side.
    if "dev" in request.host.lower():
        return jsonify({
            "status": "skipped",
            "message": "Ingestion only runs against production. This is the dev environment."
        })

    # Detect environment
    environment = "development" if limit > 0 else "production"

    try:
        db = firestore.Client()
        today = date.today().isoformat()
        
        # Check if already ingested today
        meta_ref = db.collection("_system").document("marketDataMeta")
        meta_doc = meta_ref.get()
        
        if meta_doc.exists and not force:
            meta = meta_doc.to_dict()
            last_ingestion = meta.get("lastIngestionDate", "")
            if last_ingestion == today:
                return jsonify({
                    "status": "skipped",
                    "message": f"Already ingested today ({today}). Use force=true to override.",
                    "lastIngestion": last_ingestion
                })
        
        # Check TwelveData API key
        if not Config.TWELVEDATA_API_KEY:
            return jsonify({"error": "TWELVEDATA_API_KEY not configured"}), 500
        
        # Import and run ingestion
        from services.providers.twelvedata_provider import TwelveDataProvider
        from services.providers.market_data_provider import ProviderNotFoundError, ProviderRateLimitError
        from services.symbol_lists import get_all_symbols, CURRENCY_PAIRS, SYMBOL_ALIASES, CURRENCY_ALIASES, ETFS
        from services import ingest_helpers
        import pytz

        provider = TwelveDataProvider(Config.TWELVEDATA_API_KEY)
        
        # Check if US market is currently open (Mon-Fri, 9:30 AM - 4:00 PM ET)
        eastern = pytz.timezone('US/Eastern')
        now_et = datetime.utcnow().replace(tzinfo=pytz.utc).astimezone(eastern)
        is_weekday = now_et.weekday() < 5  # Mon=0, Fri=4
        market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
        is_market_hours = market_open <= now_et <= market_close
        market_is_open = is_weekday and is_market_hours
        
        # Calculate last market day (for fetching historical data)
        def get_last_market_day(from_date):
            """Get the last weekday (market day) from a given date"""
            d = from_date
            # Go back if it's Saturday (5) or Sunday (6)
            while d.weekday() >= 5:
                d = d - timedelta(days=1)
            return d
        
        end_date = date.today()
        last_market_day = get_last_market_day(end_date)
        
        # If market is closed, skip ALL API calls for existing symbols
        # Only fetch new symbols (going back to last market day)
        if not market_is_open:
            logger.info(f"US Market is CLOSED (now: {now_et.strftime('%A %H:%M ET')}). Allowing historical backfills.")
        else:
            logger.info(f"US Market is OPEN (now: {now_et.strftime('%A %H:%M ET')}). Full ingestion.")
        
        # --- DEAD-SYMBOL TOMBSTONES ---
        # Symbols that are permanently unavailable (delisted/invalid, or gated
        # behind a higher TwelveData plan tier than this key has) are recorded
        # here so they're skipped forever instead of being retried every night -
        # see docs/fx/01-fx-plan.md §0.1. Without this, smart rotation below
        # always puts a never-ingested (because permanently 404ing) symbol
        # first, and enough of those in a row used to trip the breaker before
        # any real symbol got a chance.
        dead_symbols_ref = db.collection("_system").document("deadSymbols")
        try:
            dead_symbols_doc = dead_symbols_ref.get()
            dead_symbols = set(dead_symbols_doc.to_dict().keys()) if dead_symbols_doc.exists else set()
        except Exception as e:
            logger.warning(f"Failed to load dead-symbol tombstones: {e}")
            dead_symbols = set()

        # --- SMART ROTATION LOGIC ---
        all_config_symbols = get_all_symbols()
        config_symbols = [s for s in all_config_symbols if s not in dead_symbols]
        tombstoned_here = [s for s in all_config_symbols if s in dead_symbols]
        if tombstoned_here:
            logger.info(f"Skipping {len(tombstoned_here)} tombstoned symbol(s): {tombstoned_here}")
        if limit:
            config_symbols = config_symbols[:limit]

        symbol_map = {s: {"lastUpdated": "1970-01-01T00:00:00", "exists": False} for s in config_symbols}
        
        try:
            docs = db.collection("marketData").select(["lastUpdated"]).stream()
            for doc in docs:
                if doc.id in symbol_map:
                    data = doc.to_dict()
                    symbol_map[doc.id]["exists"] = True
                    symbol_map[doc.id]["lastUpdated"] = data.get("lastUpdated", "1970-01-01T00:00:00")
        except Exception as e:
            logger.warning(f"Failed to fetch metadata for smart rotation: {e}. Falling back to default order.")
            
        def sort_key(s):
            meta = symbol_map[s]
            if not meta["exists"]:
                return "0000-00-00"  # Top priority
            return meta["lastUpdated"]
            
        all_symbols = sorted(config_symbols, key=sort_key)
        
        currency_pairs = [
            (b, q) for (b, q) in CURRENCY_PAIRS if f"{b}_{q}" not in dead_symbols
        ]
        tombstoned_pairs_here = [f"{b}_{q}" for (b, q) in CURRENCY_PAIRS if f"{b}_{q}" in dead_symbols]
        currency_pairs = currency_pairs[:10] if limit else currency_pairs
        
        logger.info(f"Starting market data ingestion (Smart Rotation): {len(all_symbols)} symbols, {len(currency_pairs)} currencies")
        
        success_stocks = 0
        failed_stocks = 0
        success_currencies = 0
        failed_currencies = 0
        skipped_stocks = 0
        rate_limited = False
        consecutive_rate_limit_errors = 0
        time_budget_exceeded = False
        newly_tombstoned = 0

        BATCH_SIZE = 4
        BATCH_DELAY_SECONDS = 65
        # Cloud Scheduler's HTTP target attempt-deadline tops out at 30 minutes, and Cloud
        # Run's request timeout is 3600s (see deploy workflow) - stop well inside both so
        # the scheduler sees a clean success response instead of reporting a false failure
        # while we're still quietly finishing server-side. Whatever we don't get to today,
        # smart rotation (oldest lastUpdated first) picks up first on tomorrow's run.
        MAX_RUNTIME_SECONDS = 25 * 60

        # Process stocks/ETFs with incremental updates
        for i, symbol in enumerate(all_symbols):
            if rate_limited:
                break
            if time_module.time() - start_time > MAX_RUNTIME_SECONDS:
                logger.info(f"Time budget ({MAX_RUNTIME_SECONDS}s) reached after {i} stocks, stopping for today.")
                time_budget_exceeded = True
                break

            try:
                existing_doc = db.collection("marketData").document(symbol).get()
                
                if existing_doc.exists:
                    existing_data = existing_doc.to_dict()
                    price_history = existing_data.get("priceHistory", [])
                    
                    if price_history:
                        last_data_date = price_history[-1].get("date", "")[:10] if price_history[-1].get("date") else ""
                        
                        if last_data_date >= last_market_day.isoformat():
                            skipped_stocks += 1
                            logger.info(f"Skip {symbol} already has data up to {last_data_date}")
                            continue
                        
                        last_date = datetime.fromisoformat(last_data_date).date() if last_data_date else last_market_day - timedelta(days=365)
                        start_date = last_date + timedelta(days=1)
                        
                        if start_date > last_market_day:
                            skipped_stocks += 1
                            logger.info(f"Skip {symbol} already has latest data")
                            continue
                        
                        days_since_last = (last_market_day - last_date).days
                        is_recent = days_since_last <= 3
                    else:
                        start_date = last_market_day - timedelta(days=365)
                        is_recent = False
                else:
                    start_date = last_market_day - timedelta(days=365)
                    existing_data = None
                    price_history = []
                    is_recent = False
                
                logger.info(f"Fetching {symbol} from {start_date} to {last_market_day}")
                data = provider.get_time_series(symbol, start_date, last_market_day)

                if data:
                    # A quote costs a second credit, so it's only worth spending on a
                    # symbol we've never seen before (to capture name/exchange/currency
                    # metadata once) - a daily refresh of a known symbol reuses that
                    # metadata and takes its current price from the history itself.
                    quote = provider.get_quote(symbol) if existing_data is None else None

                    if existing_data and price_history:
                        new_history = price_history + [asdict(p) for p in data]
                    else:
                        new_history = [asdict(p) for p in data]

                    doc_data = {
                        "symbol": symbol,
                        "name": quote.name if quote else (existing_data.get("name") if existing_data else symbol),
                        "type": "etf" if symbol in ETFS else "stock",
                        "currency": quote.currency if quote else (existing_data.get("currency") if existing_data else "USD"),
                        "currentPrice": quote.price if quote else (data[-1].close if data else 0),
                        "change": quote.change if quote else 0,
                        "changePercent": quote.change_percent if quote else 0,
                        "priceHistory": new_history,
                        "aliases": SYMBOL_ALIASES.get(symbol, []),
                        "lastUpdated": datetime.utcnow().isoformat()
                    }
                    db.collection("marketData").document(symbol).set(doc_data)
                    success_stocks += 1
                    consecutive_rate_limit_errors = 0
                    logger.info(f"Ingested {symbol} ({i+1}/{len(all_symbols)}, +{len(data)} points)")
                else:
                    # The provider call succeeded but returned nothing - a benign gap
                    # (e.g. a market holiday) if we already have recent data, otherwise
                    # a soft miss that nudges the breaker (a real failure raises instead,
                    # see the except clauses below).
                    outcome = ingest_helpers.classify_empty_result(is_recent)
                    if outcome.breaker_delta == 0:
                        skipped_stocks += 1
                        logger.info(f"Skip {symbol} no new data, but has recent data")
                    else:
                        failed_stocks += 1
                        consecutive_rate_limit_errors += outcome.breaker_delta
                        logger.warning(f"No data for {symbol}")
            except ProviderNotFoundError as e:
                # Permanent for this symbol - tombstone it and move on. This must
                # never count toward the rate-limit breaker (see comment above).
                logger.warning(f"{symbol} is permanently unavailable ({e}), tombstoning")
                dead_symbols_ref.set({symbol: {"reason": str(e), "date": today}}, merge=True)
                skipped_stocks += 1
                newly_tombstoned += 1
            except ProviderRateLimitError as e:
                logger.warning(f"TwelveData rate limit hit fetching {symbol}: {e}")
                failed_stocks += 1
                consecutive_rate_limit_errors += ingest_helpers.RATE_LIMIT_BREAKER_WEIGHT
            except Exception as e:
                logger.warning(f"Failed to ingest {symbol}: {e}")
                failed_stocks += 1
                consecutive_rate_limit_errors += ingest_helpers.GENERIC_MISS_BREAKER_WEIGHT

            if ingest_helpers.breaker_tripped(consecutive_rate_limit_errors):
                logger.warning(f"{consecutive_rate_limit_errors} consecutive failures, assuming provider is rate-limited. Stopping for today.")
                rate_limited = True

            if (i + 1) % BATCH_SIZE == 0 and (i + 1) < len(all_symbols):
                logger.info(f"Rate limit pause ({BATCH_DELAY_SECONDS}s) after {i+1} symbols...")
                time.sleep(BATCH_DELAY_SECONDS)

        # Process currencies with incremental updates
        skipped_currencies = 0
        ingested_currencies = []  # for the report email - which rates actually moved today
        for i, (base, quote_curr) in enumerate(currency_pairs):
            if rate_limited:
                break
            if time_module.time() - start_time > MAX_RUNTIME_SECONDS:
                logger.info(f"Time budget ({MAX_RUNTIME_SECONDS}s) reached after {i} currencies, stopping for today.")
                time_budget_exceeded = True
                break

            try:
                doc_id = f"{base}_{quote_curr}"
                
                existing_doc = db.collection("currencyRates").document(doc_id).get()
                
                if existing_doc.exists:
                    existing_data = existing_doc.to_dict()
                    rate_history = existing_data.get("rateHistory", [])
                    
                    if rate_history:
                        last_data_date = rate_history[-1].get("date", "")[:10] if rate_history[-1].get("date") else ""
                        
                        if last_data_date >= last_market_day.isoformat():
                            skipped_currencies += 1
                            logger.info(f"Skip {base}/{quote_curr} already has data up to {last_data_date}")
                            continue
                        
                        last_date = datetime.fromisoformat(last_data_date).date() if last_data_date else last_market_day - timedelta(days=365)
                        start_date = last_date + timedelta(days=1)
                        
                        if start_date > last_market_day:
                            skipped_currencies += 1
                            continue
                        
                        days_since_last = (last_market_day - last_date).days
                        is_recent = days_since_last <= 3
                    else:
                        start_date = last_market_day - timedelta(days=365)
                        is_recent = False
                else:
                    start_date = last_market_day - timedelta(days=365)
                    existing_data = None
                    rate_history = []
                    is_recent = False
                
                data = provider.get_forex_rates(base, quote_curr, start_date, last_market_day)

                if data:
                    # Same reasoning as the stocks loop above: only spend a second
                    # credit on a fresh quote for a pair we've never ingested before.
                    current_rate = provider.get_forex_quote(base, quote_curr) if existing_data is None else None

                    if existing_data and rate_history:
                        new_history = rate_history + [asdict(r) for r in data]
                    else:
                        new_history = [asdict(r) for r in data]

                    doc_data = {
                        "symbol": f"{base}/{quote_curr}",
                        "baseCurrency": base,
                        "quoteCurrency": quote_curr,
                        "type": "forex",
                        "currentRate": current_rate or (data[-1].close if data else 0),
                        "rateHistory": new_history,
                        "aliases": CURRENCY_ALIASES.get(base, []),
                        "lastUpdated": datetime.utcnow().isoformat()
                    }
                    db.collection("currencyRates").document(doc_id).set(doc_data)
                    ingested_currencies.append({
                        "pair": f"{base}/{quote_curr}",
                        "rate": doc_data["currentRate"],
                        "newPoints": len(data)
                    })
                    success_currencies += 1
                    consecutive_rate_limit_errors = 0
                    logger.info(f"Ingested {base}/{quote_curr} ({success_currencies}/{len(currency_pairs)}, total: {len(new_history)})")
                else:
                    outcome = ingest_helpers.classify_empty_result(is_recent)
                    if outcome.breaker_delta == 0:
                        skipped_currencies += 1
                        logger.info(f"Skip {base}/{quote_curr} no new data (market closed?), but has recent data")
                    else:
                        failed_currencies += 1
                        consecutive_rate_limit_errors += outcome.breaker_delta
                        logger.warning(f"No data for {base}/{quote_curr}")
            except ProviderNotFoundError as e:
                logger.warning(f"{base}/{quote_curr} is permanently unavailable ({e}), tombstoning")
                dead_symbols_ref.set({doc_id: {"reason": str(e), "date": today}}, merge=True)
                skipped_currencies += 1
                newly_tombstoned += 1
            except ProviderRateLimitError as e:
                logger.warning(f"TwelveData rate limit hit fetching {base}/{quote_curr}: {e}")
                failed_currencies += 1
                consecutive_rate_limit_errors += ingest_helpers.RATE_LIMIT_BREAKER_WEIGHT
            except Exception as e:
                logger.warning(f"Failed to ingest {base}/{quote_curr}: {e}")
                failed_currencies += 1
                consecutive_rate_limit_errors += ingest_helpers.GENERIC_MISS_BREAKER_WEIGHT

            if ingest_helpers.breaker_tripped(consecutive_rate_limit_errors):
                logger.warning(f"{consecutive_rate_limit_errors} consecutive failures, assuming provider is rate-limited. Stopping for today.")
                rate_limited = True

            if (i + 1) % BATCH_SIZE == 0 and (i + 1) < len(currency_pairs):
                logger.info(f"Rate limit pause ({BATCH_DELAY_SECONDS}s) after {i+1} currencies...")
                time.sleep(BATCH_DELAY_SECONDS)
        
        # Calculate duration
        duration_seconds = time_module.time() - start_time
        
        market_status_str = f"{'OPEN' if market_is_open else 'CLOSED'} ({now_et.strftime('%A %H:%M ET')})"
        total_tombstoned = len(tombstoned_here) + len(tombstoned_pairs_here) + newly_tombstoned

        # Update metadata
        meta_ref.set({
            "lastIngestionDate": today,
            "lastIngestionTime": datetime.utcnow().isoformat(),
            "stocksSuccess": success_stocks,
            "stocksFailed": failed_stocks,
            "stocksSkipped": skipped_stocks,
            "currenciesSuccess": success_currencies,
            "currenciesFailed": failed_currencies,
            "currenciesSkipped": skipped_currencies,
            "rateLimited": rate_limited,
            "timeBudgetExceeded": time_budget_exceeded,
            "durationSeconds": round(duration_seconds),
            "tombstonedSymbols": total_tombstoned,
            "newlyTombstonedSymbols": newly_tombstoned,
            "currenciesIngested": ingested_currencies
        })

        # Send email notification
        send_ingestion_report(
            date=today,
            environment=environment,
            stocks_success=success_stocks,
            stocks_failed=failed_stocks,
            stocks_skipped=skipped_stocks,
            currencies_success=success_currencies,
            currencies_failed=failed_currencies,
            currencies_skipped=skipped_currencies,
            market_status=market_status_str,
            duration_seconds=duration_seconds,
            time_budget_exceeded=time_budget_exceeded,
            rate_limited=rate_limited,
            tombstoned=newly_tombstoned,
            currencies_ingested=ingested_currencies
        )

        return jsonify({
            "status": "success",
            "date": today,
            "stocks": {"success": success_stocks, "failed": failed_stocks, "skipped": skipped_stocks},
            "currencies": {"success": success_currencies, "failed": failed_currencies, "skipped": skipped_currencies},
            "rateLimited": rate_limited,
            "timeBudgetExceeded": time_budget_exceeded,
            "durationSeconds": round(duration_seconds),
            "tombstonedSymbols": total_tombstoned,
            "newlyTombstonedSymbols": newly_tombstoned,
            "currenciesIngested": ingested_currencies
        })
        
    except Exception as e:
        logger.error(f"Market data ingestion failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/system/ingest-fx', methods=['POST'])
def ingest_fx():
    """
    Trigger the daily FX (exchange rate) ingestion - Phase 1 of
    docs/fx/01-fx-plan.md. Production-only, same as /system/ingest-market-data
    (a request whose Host contains "dev" is refused immediately). Runs
    independently of the stock ingestion job so currencies never share its
    time budget again (see plan §0.2) - this is meant to be scheduled to run
    BEFORE it, not folded into it.

    Query params:
    - force: skip the daily check and run anyway
    - lookback: override the default lookback window in days (for testing)
    """
    from datetime import date, datetime
    from google.cloud import firestore
    import time as time_module

    start_time = time_module.time()

    auth_header = request.headers.get("X-System-Key")
    if not auth_header or auth_header != Config.SYSTEM_API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    # Production-only, same reasoning as /system/ingest-market-data: refuse
    # before touching Firestore or TwelveData at all.
    if "dev" in request.host.lower():
        return jsonify({
            "status": "skipped",
            "message": "FX ingestion only runs against production. This is the dev environment."
        })

    force = request.args.get('force', 'false').lower() == 'true'
    lookback = request.args.get('lookback', type=int, default=None)

    if not Config.TWELVEDATA_API_KEY:
        return jsonify({"error": "TWELVEDATA_API_KEY not configured"}), 500

    try:
        db = firestore.Client()
        today = date.today().isoformat()

        meta_ref = db.collection("_system").document("fxIngestMeta")
        meta_doc = meta_ref.get()
        if meta_doc.exists and not force:
            last_ingestion = meta_doc.to_dict().get("lastIngestionDate", "")
            if last_ingestion == today:
                return jsonify({
                    "status": "skipped",
                    "message": f"Already ingested today ({today}). Use force=true to override.",
                    "lastIngestion": last_ingestion
                })

        from services.providers.twelvedata_provider import TwelveDataProvider
        from services.symbol_lists import CURRENCY_PAIRS
        from services.fx_ingest_service import (
            run_fx_ingestion,
            usd_pivot_currencies,
            check_staleness,
            DEFAULT_LOOKBACK_DAYS,
        )
        from services.email_service import send_fx_ingestion_report

        provider = TwelveDataProvider(Config.TWELVEDATA_API_KEY)
        currencies = usd_pivot_currencies(CURRENCY_PAIRS)

        outcome = run_fx_ingestion(
            db, provider, currencies,
            lookback_days=lookback if lookback is not None else DEFAULT_LOOKBACK_DAYS
        )
        staleness_warning = check_staleness(db)
        duration_seconds = time_module.time() - start_time

        meta_ref.set({
            "lastIngestionDate": today,
            "lastIngestionTime": datetime.utcnow().isoformat(),
            "successCount": len(outcome["success"]),
            "unsupportedCount": len(outcome["unsupported"]),
            "failedCount": len(outcome["failed"]),
            "rateLimited": outcome["rateLimited"],
            "durationSeconds": round(duration_seconds)
        })

        send_fx_ingestion_report(
            date=today,
            success=outcome["success"],
            unsupported=outcome["unsupported"],
            failed=outcome["failed"],
            rate_limited=outcome["rateLimited"],
            newly_classified=outcome["newlyClassified"],
            staleness_warning=staleness_warning,
            duration_seconds=duration_seconds
        )

        return jsonify({
            "status": "success",
            "date": today,
            "successCount": len(outcome["success"]),
            "unsupportedCount": len(outcome["unsupported"]),
            "failedCount": len(outcome["failed"]),
            "failed": outcome["failed"],
            "rateLimited": outcome["rateLimited"],
            "newlyClassified": outcome["newlyClassified"],
            "stalenessWarning": staleness_warning,
            "durationSeconds": round(duration_seconds)
        })

    except Exception as e:
        logger.error(f"FX ingestion failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))