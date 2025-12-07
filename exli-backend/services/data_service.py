import io
import pandas as pd
import re
from config import logger
from services.ai_service import analyze_file_structure, convert_pdf_to_csv

def process_uploaded_file(file):
    """Orchestrates the reading, AI analysis, and cleaning of a file."""
    filename = file.filename
    logger.info(f"Data Service: Processing {filename}")
    
    raw_bytes = file.read()
    
    df = None
    delimiter = None
    mapping = {}
    header_index = 0
    
    try:
        # --- PRE-PROCESS: PDF TO CSV ---
        if filename.lower().endswith('.pdf'):
            logger.info("Detected PDF format. Initiating AI extraction...")
            csv_string = convert_pdf_to_csv(raw_bytes)
            
            if not csv_string:
                raise ValueError("AI could not extract data from this PDF.")
                
            # Replace raw_bytes with the generated CSV data so the rest of the logic handles it as a CSV
            raw_bytes = csv_string.encode('utf-8')
            logger.info("PDF converted to CSV successfully. Proceeding to analysis.")

        # --- STRATEGY 1: EXCEL ---
        # Note: We check extension again. If it was a PDF, it falls through to Strategy 2.
        if filename.endswith(('.xls', '.xlsx')) and not filename.lower().endswith('.pdf'):
            logger.info("Detected Excel format.")
            # Read raw (header=None) to see the full layout including garbage at top
            df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
            
            # IMPROVED: Send more context (50 lines) so AI can skip large headers
            text_head = df_raw.head(50).to_csv(index=False, header=False)
            text_tail = df_raw.tail(10).to_csv(index=False, header=False)
            
            # Ask AI
            ai_config = analyze_file_structure(text_head, text_tail)
            
            if ai_config:
                header_index = ai_config.get('header_row_index', 0)
                footer_count = ai_config.get('footer_skip_count', 0)
                mapping = ai_config.get('mapping', {})
                delimiter = "Excel"
                
                # Reload with correct settings
                df = pd.read_excel(io.BytesIO(raw_bytes), header=header_index)
                if footer_count > 0:
                    df = df.iloc[:-footer_count]

        # --- STRATEGY 2: CSV/TEXT (Handles original CSVs and Converted PDFs) ---
        else:
            logger.info("Detected CSV/Text format (or Converted PDF).")
            # Decode text safely
            try:
                full_text = raw_bytes.decode('utf-8', errors='ignore')
            except:
                full_text = raw_bytes.decode('latin1', errors='ignore')
            
            lines = full_text.splitlines()
            # IMPROVED: Send 50 lines of context
            text_head = "\n".join(lines[:50])
            text_tail = "\n".join(lines[-10:]) if len(lines) > 50 else ""
            
            # Ask AI (Call 2 for PDFs, Call 1 for CSVs)
            ai_config = analyze_file_structure(text_head, text_tail)
            
            if not ai_config:
                raise ValueError("AI could not determine file structure")

            delimiter = ai_config.get('delimiter', ',')
            header_index = ai_config.get('header_row_index', 0)
            footer_count = ai_config.get('footer_skip_count', 0)
            mapping = ai_config.get('mapping', {})
            
            # Load Data
            df = pd.read_csv(
                io.BytesIO(raw_bytes), 
                sep=delimiter, 
                header=header_index, 
                skipfooter=footer_count,
                engine='python', 
                encoding='utf-8-sig', 
                on_bad_lines='skip'
            )

        # --- FINAL CLEANUP ---
        if df is not None:
            # Helper to normalize headers (remove newlines, collapse spaces)
            def clean_header_name(h):
                if not isinstance(h, str): return str(h)
                # Replace newlines/tabs with space
                h = h.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
                # Collapse multiple spaces to one and strip
                return re.sub(r'\s+', ' ', h).strip()

            # 1. Clean DataFrame Columns
            df.columns = [clean_header_name(c) for c in df.columns]
            
            # 2. Clean Mapping Values (to match the DataFrame)
            cleaned_mapping = {}
            for k, v in mapping.items():
                if v:
                    cleaned_mapping[k] = clean_header_name(v)
                else:
                    cleaned_mapping[k] = None
            mapping = cleaned_mapping

            # 3. Prune columns (Keep only mapped ones)
            valid_headers = []
            for name in mapping.values():
                if name and name in df.columns:
                    valid_headers.append(name)
            
            # Safety: Only prune if we actually matched enough columns
            if len(valid_headers) >= 2:
                logger.info(f"Pruning columns. Keeping: {valid_headers}")
                df = df[valid_headers]
            else:
                logger.warning(f"Only matched {len(valid_headers)} columns. Skipping pruning to prevent data loss.")
            
            # Clean NaNs for JSON
            df_clean = df.astype(object).where(pd.notnull(df), None)
            
            return {
                "status": "success",
                "columns": df.columns.tolist(),
                "suggested_mapping": mapping,
                "preview_data": df_clean.head(5).values.tolist(),
                "all_data": df_clean.values.tolist(),
                "detected_delimiter": delimiter
            }
            
        return {"status": "error", "message": "Failed to load DataFrame"}

    except Exception as e:
        logger.error(f"Processing Error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}