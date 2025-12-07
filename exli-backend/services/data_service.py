import io
import pandas as pd
import re
from config import logger
from services.ai_service import analyze_multiple_files_structure, convert_pdf_to_csv

def process_uploaded_files(files):
    """
    Orchestrates the reading of MULTIPLE files.
    1. Pre-process (PDF->CSV, read Excels) to get text samples.
    2. Send ALL samples to AI in one batch call.
    3. Process each file using its specific AI-determined config.
    """
    logger.info(f"Data Service: Processing {len(files)} files")
    
    # Storage for the pre-processed text/bytes to avoid re-reading
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
            
            # PDF Handling
            if filename.lower().endswith('.pdf'):
                logger.info(f"[{idx}] Converting PDF: {filename}")
                csv_string = convert_pdf_to_csv(raw_bytes)
                if not csv_string:
                    raise ValueError(f"Failed to extract PDF data from {filename}")
                raw_bytes = csv_string.encode('utf-8') # Replace with CSV data
                # Generate sample from CSV string
                lines = csv_string.splitlines()
                text_head = "\n".join(lines[:50])
                text_tail = "\n".join(lines[-10:])
            
            # Excel Handling
            elif filename.endswith(('.xls', '.xlsx')):
                logger.info(f"[{idx}] Reading Excel: {filename}")
                is_excel = True
                try:
                    df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None)
                    text_head = df_raw.head(50).to_csv(index=False, header=False)
                    text_tail = df_raw.tail(10).to_csv(index=False, header=False)
                except Exception as e:
                    logger.error(f"Failed to read Excel preview: {e}")
                    raise ValueError(f"Excel file {filename} is corrupted or password protected.")
            
            # CSV Handling
            else:
                logger.info(f"[{idx}] Reading CSV: {filename}")
                try:
                    full_text = raw_bytes.decode('utf-8', errors='ignore')
                except:
                    full_text = raw_bytes.decode('latin1', errors='ignore')
                lines = full_text.splitlines()
                text_head = "\n".join(lines[:50])
                text_tail = "\n".join(lines[-10:])

            # Store for Phase 2 & 3
            prepped_files.append({
                "filename": filename,
                "bytes": raw_bytes,
                "is_excel": is_excel
            })
            
            samples_for_ai.append({
                "filename": filename,
                "head": text_head,
                "tail": text_tail
            })

        # --- PHASE 2: ONE AI CALL ---
        logger.info("Sending batch to AI...")
        ai_response = analyze_multiple_files_structure(samples_for_ai)
        
        if not ai_response or "results" not in ai_response:
            raise ValueError("AI failed to return valid structure for batch.")

        ai_results = ai_response["results"]
        final_output = []

        # --- PHASE 3: PARSE DATA FRAMES ---
        for idx, file_data in enumerate(prepped_files):
            # Find matching AI config
            config = next((r for r in ai_results if r.get('file_index') == idx), ai_results[idx])
            
            delimiter = config.get('delimiter', ',')
            header_index = config.get('header_row_index', 0)
            footer_count = config.get('footer_skip_count', 0)
            mapping = config.get('mapping', {})
            card_info = config.get('card_info', file_data['filename'])

            # Load DF
            df = None
            
            # FIX: Check internal flag 'is_excel' instead of trusting AI delimiter for engine selection
            if file_data['is_excel']:
                logger.info(f"[{idx}] Parsing Excel Engine: {file_data['filename']}")
                df = pd.read_excel(io.BytesIO(file_data['bytes']), header=header_index)
                if footer_count > 0:
                    df = df.iloc[:-footer_count]
            else:
                logger.info(f"[{idx}] Parsing CSV Engine: {file_data['filename']}")
                # Try multiple encodings for robustness (Hebrew/Windows vs UTF-8)
                encodings = ['utf-8-sig', 'cp1255', 'latin1']
                for enc in encodings:
                    try:
                        df = pd.read_csv(
                            io.BytesIO(file_data['bytes']),
                            sep=delimiter,
                            header=header_index,
                            skipfooter=footer_count,
                            engine='python',
                            encoding=enc,
                            on_bad_lines='skip'
                        )
                        break # Stop if successful
                    except UnicodeDecodeError:
                        continue # Try next encoding
                    except Exception as e:
                        logger.warning(f"CSV Parse failed with {enc}: {e}")
                        
                if df is None:
                    raise ValueError(f"Could not decode file {file_data['filename']}. Unknown encoding.")

            # Cleanup Headers & Columns
            if df is not None:
                def clean_header(h):
                    h = str(h).replace('\n', ' ').replace('\r', ' ')
                    return re.sub(r'\s+', ' ', h).strip()

                df.columns = [clean_header(c) for c in df.columns]
                
                # Normalize Mapping
                cleaned_mapping = {k: clean_header(v) if v else None for k, v in mapping.items()}
                
                # Prune
                valid_headers = [name for name in cleaned_mapping.values() if name and name in df.columns]
                
                # Safety check: Only prune if we actually found mapped columns
                if len(valid_headers) >= 2:
                    df = df[valid_headers]
                
                # Prepare JSON result
                df_clean = df.astype(object).where(pd.notnull(df), None)
                
                final_output.append({
                    "filename": file_data['filename'],
                    "card_info": card_info,
                    "columns": df.columns.tolist(),
                    "suggested_mapping": cleaned_mapping,
                    "preview_data": df_clean.head(5).values.tolist(),
                    "all_data": df_clean.values.tolist()
                })

        return {"status": "success", "files": final_output}

    except Exception as e:
        logger.error(f"Batch Processing Error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}