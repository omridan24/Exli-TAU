import io
import pandas as pd
from config import logger
from services.ai_service import analyze_file_structure

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
        # --- STRATEGY 1: EXCEL ---
        if filename.endswith(('.xls', '.xlsx')):
            logger.info("Detected Excel format.")
            # Read raw to get context for AI
            df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
            
            # Extract samples
            text_head = df_raw.head(20).to_csv(index=False, header=False)
            text_tail = df_raw.tail(5).to_csv(index=False, header=False)
            
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

        # --- STRATEGY 2: CSV/TEXT ---
        else:
            logger.info("Detected CSV/Text format.")
            # Decode text safely
            try:
                full_text = raw_bytes.decode('utf-8', errors='ignore')
            except:
                full_text = raw_bytes.decode('latin1', errors='ignore')
            
            lines = full_text.splitlines()
            text_head = "\n".join(lines[:15])
            text_tail = "\n".join(lines[-5:]) if len(lines) > 20 else ""
            
            # Ask AI
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
            # Clean headers
            df.columns = df.columns.astype(str).str.strip()
            
            # Prune columns (Keep only mapped ones)
            valid_headers = [name for name in mapping.values() if name and name in df.columns]
            
            if valid_headers:
                df = df[valid_headers]
            
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