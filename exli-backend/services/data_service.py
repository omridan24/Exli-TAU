import io
import pandas as pd
import re
import calendar
import json
from datetime import datetime
from config import logger
from services.ai_service import analyze_multiple_files_structure, convert_pdf_to_data
from services.currency_codes import normalize_currency
from services.category_dictionary import auto_categorize_transactions

def sanitize_dataframe(df):
    """
    Cleans up common AI mistakes in the DataFrame before sending to frontend.
    """
    # 1. Normalize headers (lowercase)
    df.columns = [str(c).lower().strip() for c in df.columns]
    
    # 2. Validate and normalize currency using ISO 4217 whitelist
    if 'currency' in df.columns:
        df['currency'] = df['currency'].apply(lambda x: normalize_currency(x, default='ILS'))
    
    return df

def process_uploaded_files(files):
    logger.info(f"Data Service: Started processing {len(files)} files")
    
    prepped_files = [] 
    samples_for_ai = []

    try:
        # --- PHASE 1: PREPARE SAMPLES ---
        for idx, file in enumerate(files):
            filename = file.filename
            raw_bytes = file.read()
            text_head = ""
            text_tail = ""
            is_excel = False
            
            logger.info(f"[{idx}] Reading File: {filename} ({len(raw_bytes)} bytes)")

            # PDF Handling
            if filename.lower().endswith('.pdf'):
                try:
                    json_data = convert_pdf_to_data(raw_bytes)
                    if not json_data:
                        raise ValueError("AI could not extract text from this PDF. It might be an image scan or empty.")
                    if not isinstance(json_data, list):
                        raise ValueError("AI returned invalid data format for PDF.")
                    
                    df_pdf = pd.DataFrame(json_data)
                    df_pdf = sanitize_dataframe(df_pdf)
                    
                    if df_pdf.empty:
                         raise ValueError("PDF analysis resulted in 0 transactions found.")

                    csv_string = df_pdf.to_csv(index=False)
                    raw_bytes = csv_string.encode('utf-8') 
                    text_head = df_pdf.head(20).to_csv(index=False)
                except Exception as e:
                     logger.error(f"PDF Error for {filename}: {e}", exc_info=True)
                     # Re-raise with user friendly message
                     raise ValueError(f"Failed to analyze PDF '{filename}'. {str(e)}")
            
            # Excel Handling
            elif filename.lower().endswith(('.xls', '.xlsx')):
                is_excel = True
                try:
                    # Check if valid excel
                    df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
                    text_head = df_raw.head(50).to_csv(index=False, header=False)
                except Exception as e:
                    logger.error(f"Excel Error for {filename}: {e}", exc_info=True)
                    raise ValueError(f"Could not open '{filename}'. It might be password protected or corrupted.")
            
            # CSV Handling
            else:
                try:
                    full_text = raw_bytes.decode('utf-8', errors='ignore')
                    if not full_text: raise ValueError("File is empty")
                    lines = full_text.splitlines()
                    text_head = "\n".join(lines[:50])
                except Exception as e:
                     logger.error(f"CSV Error for {filename}: {e}", exc_info=True)
                     raise ValueError(f"Could not read text from '{filename}'. Check encoding.")

            prepped_files.append({
                "filename": filename,
                "bytes": raw_bytes,
                "is_excel": is_excel
            })
            samples_for_ai.append({ "filename": filename, "head": text_head })

        # --- PHASE 2: ONE AI CALL ---
        logger.info("Sending batch to AI for structure analysis...")
        ai_response = analyze_multiple_files_structure(samples_for_ai)
        
        if not ai_response or "results" not in ai_response:
            logger.warning("AI Batch failed to return results structure.")
            ai_results = [{"file_index": i, "header_row_index": 0} for i in range(len(files))]
        else:
            ai_results = ai_response["results"]

        final_output = []

        # --- PHASE 3: PARSE DATA FRAMES ---
        for idx, file_data in enumerate(prepped_files):
            config = next((r for r in ai_results if r.get('file_index') == idx), {})
            
            delimiter = config.get('delimiter', ',')
            header_index = config.get('header_row_index', 0)
            
            # --- FIX: Prevent Negative Header Index ---
            if not isinstance(header_index, int) or header_index < 0:
                logger.warning(f"[{idx}] AI returned invalid header index: {header_index} for {file_data['filename']}. Defaulting to 0.")
                header_index = 0

            footer_count = config.get('footer_skip_count', 0)
            mapping_indices = config.get('mapping_indices', {})
            mapping_names = config.get('mapping', {})
            card_info = config.get('card_info', file_data['filename'])

            df = None
            
            try:
                if file_data['is_excel']:
                    df = pd.read_excel(io.BytesIO(file_data['bytes']), header=header_index)
                    if footer_count > 0: df = df.iloc[:-footer_count]
                else:
                    # CSV Try/Catch Loop
                    encodings = ['utf-8', 'utf-8-sig', 'cp1255', 'latin1']
                    for enc in encodings:
                        try:
                            df = pd.read_csv(
                                io.BytesIO(file_data['bytes']),
                                sep=delimiter if delimiter else ',',
                                header=header_index,
                                skipfooter=footer_count,
                                engine='python',
                                encoding=enc,
                                on_bad_lines='skip'
                            )
                            break
                        except UnicodeDecodeError: continue
                    
                    if df is None:
                        raise ValueError(f"Could not decode CSV '{file_data['filename']}' with standard encodings.")

                # Filter Columns
                final_cols = {}
                if mapping_indices and len(mapping_indices) >= 2:
                    mapping_indices = prefer_transaction_date_column(df.columns, mapping_indices)
                    for field, col_idx in mapping_indices.items():
                        if isinstance(col_idx, int) and 0 <= col_idx < len(df.columns):
                            final_cols[field] = df.iloc[:, col_idx].values
                elif mapping_names:
                    df.columns = [str(c).strip() for c in df.columns] 
                    for field, header_name in mapping_names.items():
                        if header_name in df.columns:
                            final_cols[field] = df[header_name].values
                
                if final_cols:
                    df = pd.DataFrame(final_cols)
                
                df = sanitize_dataframe(df)
                df_clean = df.astype(object).where(pd.notnull(df), None)
                frontend_mapping = {col: col for col in df.columns}

                final_output.append({
                    "filename": file_data['filename'],
                    "card_info": card_info,
                    "columns": df.columns.tolist(),
                    "suggested_mapping": frontend_mapping,
                    "preview_data": df_clean.head(5).values.tolist(),
                    "all_data": df_clean.values.tolist()
                })
                
            except Exception as e:
                # Capture parse errors per file
                logger.error(f"Parse Error for {file_data['filename']}: {e}", exc_info=True)
                raise ValueError(f"Error parsing '{file_data['filename']}': {str(e)}")

        return {"status": "success", "files": final_output}

    except Exception as e:
        # Top level catch
        logger.error(f"Batch Processing Fatal Error: {e}", exc_info=True)
        # Return the actual error message to the user
        return {"status": "error", "message": str(e)}


def prefer_transaction_date_column(columns, mapping_indices):
    """
    The AI is told to prefer the transaction date, but it sometimes picks the
    billing-date column ("תאריך חיוב"), which collapses every row of a monthly
    statement onto the single charge day. If the mapped date column is a
    billing date and the file also has a transaction/purchase date column,
    point the mapping at the latter. Returns the (possibly updated) mapping.
    """
    date_idx = (mapping_indices or {}).get("date")
    if not isinstance(date_idx, int) or not (0 <= date_idx < len(columns)):
        return mapping_indices

    def header(i):
        return " ".join(str(columns[i]).split())

    def is_date_header(i):
        h = header(i)
        return "תאריך" in h or "מועד" in h or "date" in h.lower()

    billing_words = ("חיוב", "billing", "charge")
    tx_words = ("עסקה", "רכישה", "קניה", "קנייה", "transaction", "purchase")

    current = header(date_idx).lower()
    if not any(w in current for w in billing_words):
        return mapping_indices

    for i in range(len(columns)):
        h = header(i).lower()
        if i != date_idx and is_date_header(i) and any(w in h for w in tx_words)                 and not any(w in h for w in billing_words):
            logger.info(f"Date column switched from billing date '{header(date_idx)}' to transaction date '{header(i)}'")
            return {**mapping_indices, "date": i}
    return mapping_indices


def parse_date_to_iso(date_str):
    """
    Parses a date string into ISO format (YYYY-MM-DDTHH:MM:SSZ).
    Handles multiple formats commonly found in Israeli bank/credit card exports.
    
    Returns ISO string or None if parsing fails.
    """
    if not date_str:
        return None
    
    date_str = str(date_str).strip()
    
    # Handle Excel serial dates (numeric)
    try:
        num = float(date_str)
        if 30000 < num < 60000:  # Reasonable Excel date range
            d = datetime(1899, 12, 30) + pd.Timedelta(days=int(num))
            return d.isoformat() + "Z"
    except (ValueError, TypeError):
        pass

    # Try common date formats
    formats = [
        "%Y-%m-%d",           # 2026-05-14
        "%Y-%m-%dT%H:%M:%S", # 2026-05-14T00:00:00
        "%Y-%m-%dT%H:%M:%SZ",# 2026-05-14T00:00:00Z
        "%Y-%m-%d %H:%M:%S", # 2026-05-14 00:00:00 (str() of an Excel datetime cell)
        "%Y-%m-%d %H:%M",    # 2026-05-14 00:00
        "%d/%m/%Y",           # 14/05/2026
        "%d-%m-%Y",           # 14-05-2026
        "%d.%m.%Y",           # 14.05.2026
        "%d/%m/%y",           # 14/05/26
        "%d-%m-%y",           # 14-05-26
        "%d.%m.%y",           # 14.05.26
        "%m/%d/%Y",           # 05/14/2026 (US format)
        "%Y/%m/%d",           # 2026/05/14
    ]
    
    for fmt in formats:
        try:
            d = datetime.strptime(date_str, fmt)
            return d.isoformat() + "Z"
        except ValueError:
            continue
    
    # Last resort: let pandas try. Year-first strings are ISO-like and must
    # never be read day-first, or pandas swaps month/day when day <= 12
    # (2026-09-01 -> 2026-01-09).
    try:
        year_first = bool(re.match(r"^\d{4}[-/.]", date_str))
        d = pd.to_datetime(date_str, dayfirst=not year_first)
        return d.isoformat() + "Z"
    except Exception:
        pass
    
    logger.warning(f"Could not parse date: '{date_str}'")
    return None


INSTALLMENT_RE = re.compile(r"(?:תשלום\s*(\d+)\s*מתוך\s*(\d+))|(?:payment\s*(\d+)\s*of\s*(\d+))", re.IGNORECASE)
NOTES_HEADERS = ("הערות", "הערה", "notes", "note", "remarks")
INSTALLMENT_MIN_MONTH_SHARE = 0.6


def find_notes_values(raw_df):
    """Returns the values of the first column whose header looks like a notes column, else None."""
    for i, col in enumerate(raw_df.columns):
        h = " ".join(str(col).split()).lower()
        if any(h == w or h.startswith(w) for w in NOTES_HEADERS):
            return raw_df.iloc[:, i].values
    return None


def parse_installment(notes):
    """'תשלום 2 מתוך 12' -> (2, 12); None if the text isn't an installment note."""
    m = INSTALLMENT_RE.search(str(notes or ""))
    if not m:
        return None
    cur, total = (m.group(1), m.group(2)) if m.group(1) else (m.group(3), m.group(4))
    cur, total = int(cur), int(total)
    if total < 2 or not (1 <= cur <= total):
        return None
    return cur, total


def apply_installment_months(transactions):
    """
    A purchase split into N payments shows up on every statement with its
    ORIGINAL purchase date (e.g. bought 18 Aug, payment 2 of 12 charged in the
    September statement). The charged amount belongs to the month it is paid,
    not to the purchase month, otherwise it is booked in a month it never
    touched. Works on the transactions of ONE file/statement:

      * the statement month is the dominant month of its regular (non-
        installment, or first-payment) transactions;
      * every later installment (payment k>1) whose purchase month is earlier
        is moved into that month (same day-of-month, clamped), keeping
        originalDate / installment info for traceability.

    If the statement has no clear single month (regular rows spread across
    months, below INSTALLMENT_MIN_MONTH_SHARE) nothing is moved.
    """
    for tx in transactions:
        inst = parse_installment(tx.get("notes"))
        if inst:
            tx["installment"] = {"current": inst[0], "total": inst[1]}

    regular_months = [
        tx["reportMonth"] for tx in transactions
        if tx.get("reportMonth") and (not tx.get("installment") or tx["installment"]["current"] == 1)
    ]
    if not regular_months:
        return transactions

    counts = {}
    for m in regular_months:
        counts[m] = counts.get(m, 0) + 1
    statement_month, top = max(counts.items(), key=lambda kv: kv[1])
    if top / len(regular_months) < INSTALLMENT_MIN_MONTH_SHARE:
        return transactions

    year, month = int(statement_month[:4]), int(statement_month[5:7])
    for tx in transactions:
        inst = tx.get("installment")
        if not inst or inst["current"] <= 1 or tx.get("reportMonth", "") >= statement_month:
            continue
        old_iso = tx["date"]
        day = min(int(old_iso[8:10]), calendar.monthrange(year, month)[1])
        tx["originalDate"] = old_iso
        tx["date"] = f"{statement_month}-{day:02d}T00:00:00Z"
        tx["reportMonth"] = statement_month
    return transactions


def detect_report_months(transactions):
    """
    Detects the report month (YYYY-MM) for each transaction from its date field.
    Injects 'reportMonth' into each transaction dict.
    
    Args:
        transactions: List of transaction dicts, each with a 'date' field.
    
    Returns:
        The same list with 'reportMonth' field added to each transaction.
    """
    fallback_month = datetime.now().strftime("%Y-%m")
    months_found = set()
    
    for tx in transactions:
        date_str = tx.get("date", "")
        iso_date = parse_date_to_iso(date_str)
        
        if iso_date:
            # Update the date to a clean ISO format
            tx["date"] = iso_date
            # Extract YYYY-MM
            month_key = iso_date[:7]  # "2026-05"
            tx["reportMonth"] = month_key
            months_found.add(month_key)
        else:
            tx["reportMonth"] = fallback_month
            months_found.add(fallback_month)
    
    logger.info(f"Month detection: found {len(months_found)} month(s): {sorted(months_found)}")
    return transactions


def process_uploaded_files_auto(files):
    """
    Processes uploaded files with AUTO-CATEGORIZATION.
    
    Reuses the same file preparation and AI structure analysis as process_uploaded_files(),
    but then:
      1. Extracts all transactions from all files
      2. Parses dates and detects report months
      3. Auto-categorizes using the category dictionary
      4. Returns a flat list of categorized transactions + summary stats
    """
    logger.info(f"Data Service (AUTO): Started processing {len(files)} files")
    
    prepped_files = []
    samples_for_ai = []

    try:
        # --- PHASE 1: PREPARE SAMPLES (same as process_uploaded_files) ---
        for idx, file in enumerate(files):
            filename = file.filename
            raw_bytes = file.read()
            text_head = ""
            is_excel = False
            
            logger.info(f"[AUTO][{idx}] Reading File: {filename} ({len(raw_bytes)} bytes)")

            # PDF Handling
            if filename.lower().endswith('.pdf'):
                try:
                    json_data = convert_pdf_to_data(raw_bytes)
                    if not json_data:
                        raise ValueError("AI could not extract text from this PDF.")
                    if not isinstance(json_data, list):
                        raise ValueError("AI returned invalid data format for PDF.")
                    
                    # Filter out empty/null entries from Gemini before building DataFrame
                    json_data = [item for item in json_data if item.get("description") or item.get("date") or item.get("amount")]
                    
                    df_pdf = pd.DataFrame(json_data)
                    df_pdf = sanitize_dataframe(df_pdf)
                    
                    if df_pdf.empty:
                        raise ValueError("PDF analysis resulted in 0 transactions found.")

                    csv_string = df_pdf.to_csv(index=False)
                    raw_bytes = csv_string.encode('utf-8')
                    text_head = df_pdf.head(20).to_csv(index=False)
                except Exception as e:
                    logger.error(f"PDF Error for {filename}: {e}", exc_info=True)
                    raise ValueError(f"Failed to analyze PDF '{filename}'. {str(e)}")
            
            # Excel Handling
            elif filename.lower().endswith(('.xls', '.xlsx')):
                is_excel = True
                try:
                    df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
                    text_head = df_raw.head(50).to_csv(index=False, header=False)
                except Exception as e:
                    logger.error(f"Excel Error for {filename}: {e}", exc_info=True)
                    raise ValueError(f"Could not open '{filename}'. It might be password protected or corrupted.")
            
            # CSV Handling
            else:
                try:
                    full_text = raw_bytes.decode('utf-8', errors='ignore')
                    if not full_text: raise ValueError("File is empty")
                    lines = full_text.splitlines()
                    text_head = "\n".join(lines[:50])
                except Exception as e:
                    logger.error(f"CSV Error for {filename}: {e}", exc_info=True)
                    raise ValueError(f"Could not read text from '{filename}'. Check encoding.")

            prepped_files.append({
                "filename": filename,
                "bytes": raw_bytes,
                "is_excel": is_excel
            })
            samples_for_ai.append({"filename": filename, "head": text_head})

        # --- PHASE 2: ONE AI CALL (same as process_uploaded_files) ---
        logger.info("[AUTO] Sending batch to AI for structure analysis...")
        ai_response = analyze_multiple_files_structure(samples_for_ai)
        
        if not ai_response or "results" not in ai_response:
            logger.warning("[AUTO] AI Batch failed to return results structure.")
            ai_results = [{"file_index": i, "header_row_index": 0} for i in range(len(files))]
        else:
            ai_results = ai_response["results"]

        # --- PHASE 3: PARSE & EXTRACT TRANSACTIONS ---
        all_transactions = []

        for idx, file_data in enumerate(prepped_files):
            config = next((r for r in ai_results if r.get('file_index') == idx), {})
            
            delimiter = config.get('delimiter', ',')
            header_index = config.get('header_row_index', 0)
            
            if not isinstance(header_index, int) or header_index < 0:
                logger.warning(f"[AUTO][{idx}] Invalid header index: {header_index}. Defaulting to 0.")
                header_index = 0

            footer_count = config.get('footer_skip_count', 0)
            mapping_indices = config.get('mapping_indices', {})
            mapping_names = config.get('mapping', {})
            card_info = config.get('card_info', file_data['filename'])

            df = None
            
            try:
                if file_data['is_excel']:
                    df = pd.read_excel(io.BytesIO(file_data['bytes']), header=header_index)
                    if footer_count > 0: df = df.iloc[:-footer_count]
                else:
                    encodings = ['utf-8', 'utf-8-sig', 'cp1255', 'latin1']
                    for enc in encodings:
                        try:
                            df = pd.read_csv(
                                io.BytesIO(file_data['bytes']),
                                sep=delimiter if delimiter else ',',
                                header=header_index,
                                skipfooter=footer_count,
                                engine='python',
                                encoding=enc,
                                on_bad_lines='skip'
                            )
                            break
                        except UnicodeDecodeError: continue
                    
                    if df is None:
                        raise ValueError(f"Could not decode CSV '{file_data['filename']}' with standard encodings.")

                # Filter Columns using AI mapping
                final_cols = {}
                if mapping_indices and len(mapping_indices) >= 2:
                    mapping_indices = prefer_transaction_date_column(df.columns, mapping_indices)
                    for field, col_idx in mapping_indices.items():
                        if isinstance(col_idx, int) and 0 <= col_idx < len(df.columns):
                            final_cols[field] = df.iloc[:, col_idx].values
                elif mapping_names:
                    df.columns = [str(c).strip() for c in df.columns]
                    for field, header_name in mapping_names.items():
                        if header_name in df.columns:
                            final_cols[field] = df[header_name].values
                
                if final_cols and "notes" not in final_cols:
                    notes_values = find_notes_values(df)
                    if notes_values is not None:
                        final_cols["notes"] = notes_values

                if final_cols:
                    df = pd.DataFrame(final_cols)
                
                df = sanitize_dataframe(df)
                df_clean = df.astype(object).where(pd.notnull(df), None)
                file_transactions = []

                # Convert rows to transaction dicts
                for row in df_clean.values.tolist():
                    col_list = df.columns.tolist()
                    tx = {}
                    for i, col_name in enumerate(col_list):
                        tx[col_name] = row[i]
                    
                    # Skip empty rows (trailing blank rows in Excel/CSV files)
                    if tx.get("date") is None and tx.get("description") is None and tx.get("amount") is None:
                        continue
                    
                    # Build standardized transaction object
                    raw_amount = tx.get("amount", 0)
                    try:
                        amount = abs(float(str(raw_amount).replace(',', '').replace('₪', '').replace('$', '').replace('€', '').replace('£', '')))
                    except (ValueError, TypeError):
                        amount = 0
                    
                    # Footer/summary lines ("סך הכל", "9071.55₪") have no real date
                    # and no amount; they must not become transactions.
                    if amount == 0 and parse_date_to_iso(tx.get("date")) is None:
                        continue

                    transaction = {
                        "date": str(tx.get("date") or ""),
                        "description": str(tx.get("description") or "Unknown"),
                        "amount": amount,
                        "currency": tx.get("currency", "ILS"),
                        "originalCategory": str(tx.get("category", "") or ""),
                        "sourceCard": card_info,
                        "notes": str(tx.get("notes") or ""),
                    }
                    file_transactions.append(transaction)

                # Installments are placed in the statement month they were paid in
                file_transactions = detect_report_months(file_transactions)
                all_transactions.extend(apply_installment_months(file_transactions))
                
            except Exception as e:
                logger.error(f"[AUTO] Parse Error for {file_data['filename']}: {e}", exc_info=True)
                raise ValueError(f"Error parsing '{file_data['filename']}': {str(e)}")

        if not all_transactions:
            return {"status": "error", "message": "No valid transactions found in the uploaded files."}

        # --- PHASE 4: AUTO-CATEGORIZE ---
        logger.info(f"[AUTO] Auto-categorizing {len(all_transactions)} transactions...")
        all_transactions = auto_categorize_transactions(all_transactions)

        # --- PHASE 5: DETECT MONTHS ---
        logger.info("[AUTO] Detecting report months...")
        all_transactions = detect_report_months(all_transactions)

        # --- PHASE 6: BUILD SUMMARY ---
        matched_count = sum(1 for tx in all_transactions if tx.get("matched"))
        unmatched_count = len(all_transactions) - matched_count
        months = sorted(set(tx.get("reportMonth", "") for tx in all_transactions))
        total_amount = sum(tx.get("amount", 0) for tx in all_transactions)

        # Category breakdown
        by_category = {}
        for tx in all_transactions:
            cat = tx.get("assignedCategory") or "uncategorized"
            if cat not in by_category:
                by_category[cat] = {"count": 0, "total": 0}
            by_category[cat]["count"] += 1
            by_category[cat]["total"] = round(by_category[cat]["total"] + tx.get("amount", 0), 2)

        summary = {
            "total_transactions": len(all_transactions),
            "matched_count": matched_count,
            "unmatched_count": unmatched_count,
            "months": months,
            "total_amount": round(total_amount, 2),
            "by_category": by_category,
        }

        logger.info(
            f"[AUTO] Complete: {len(all_transactions)} transactions, "
            f"{matched_count} matched, {unmatched_count} unmatched, "
            f"months: {months}"
        )

        return {
            "status": "success",
            "auto_categorized": all_transactions,
            "summary": summary,
        }

    except Exception as e:
        logger.error(f"[AUTO] Batch Processing Fatal Error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}