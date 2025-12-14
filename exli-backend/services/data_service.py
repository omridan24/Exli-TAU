import io
import pandas as pd
import re
import json
from config import logger
from services.ai_service import analyze_multiple_files_structure, convert_pdf_to_data

def sanitize_dataframe(df):
    """
    Cleans up common AI mistakes in the DataFrame before sending to frontend.
    Specifically targets the 'Currency' column.
    """
    # 1. Normalize headers (lowercase)
    df.columns = [str(c).lower().strip() for c in df.columns]
    
    # 2. Fix Currency
    if 'currency' in df.columns:
        def clean_currency_value(val):
            val_str = str(val).strip()
            # If it contains Hebrew letters (range \u0590-\u05FF), it's likely a category error
            if re.search(r'[\u0590-\u05FF]', val_str):
                return 'ILS'
            # If it's too long to be a code (e.g. "Miscellaneous"), default to ILS
            if len(val_str) > 4: 
                return 'ILS'
            return val_str.upper()
            
        df['currency'] = df['currency'].apply(clean_currency_value)
    
    return df

def process_uploaded_files(files):
    logger.info(f"Data Service: Processing {len(files)} files")
    
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
                logger.info(f"[{idx}] Converting PDF to Structured Data: {filename}")
                json_data = convert_pdf_to_data(raw_bytes)
                
                if not json_data or not isinstance(json_data, list):
                    raise ValueError(f"Failed to extract structured data from {filename}")
                
                df_pdf = pd.DataFrame(json_data)
                
                # SANITIZE HERE immediately for PDFs
                df_pdf = sanitize_dataframe(df_pdf)

                csv_string = df_pdf.to_csv(index=False)
                raw_bytes = csv_string.encode('utf-8') 
                text_head = df_pdf.head(20).to_csv(index=False)
                text_tail = "" 
            
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
        logger.info("Sending batch to AI for structure analysis...")
        ai_response = analyze_multiple_files_structure(samples_for_ai)
        
        if not ai_response or "results" not in ai_response:
            logger.warning("AI Batch failed, using default mapping.")
            ai_results = [{"file_index": i, "header_row_index": 0} for i in range(len(files))]
        else:
            ai_results = ai_response["results"]

        final_output = []

        # --- PHASE 3: PARSE DATA FRAMES ---
        for idx, file_data in enumerate(prepped_files):
            config = next((r for r in ai_results if r.get('file_index') == idx), {})
            
            delimiter = config.get('delimiter', ',')
            header_index = config.get('header_row_index', 0)
            footer_count = config.get('footer_skip_count', 0)
            mapping = config.get('mapping', {})
            card_info = config.get('card_info', file_data['filename'])

            df = None
            
            if file_data['is_excel']:
                logger.info(f"[{idx}] Parsing Excel Engine: {file_data['filename']}")
                df = pd.read_excel(io.BytesIO(file_data['bytes']), header=header_index)
                if footer_count > 0:
                    df = df.iloc[:-footer_count]
            else:
                logger.info(f"[{idx}] Parsing CSV Engine: {file_data['filename']}")
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
                    except UnicodeDecodeError:
                        continue
                    except Exception as e:
                        logger.warning(f"CSV Parse failed with {enc}: {e}")
                        
                if df is None:
                    raise ValueError(f"Could not decode file {file_data['filename']}")

            # Cleanup Headers & Columns
            if df is not None:
                def clean_header(h):
                    h = str(h).replace('\n', ' ').replace('\r', ' ')
                    return re.sub(r'\s+', ' ', h).strip()

                df.columns = [clean_header(c) for c in df.columns]
                cleaned_mapping = {k: clean_header(v) if v else None for k, v in mapping.items()}
                
                if file_data['filename'].lower().endswith('.pdf'):
                    for standard_col in ['date', 'description', 'amount', 'category', 'currency']:
                        if standard_col in df.columns and (standard_col not in cleaned_mapping.values()):
                            cleaned_mapping[standard_col] = standard_col

                valid_headers = [name for name in cleaned_mapping.values() if name and name in df.columns]
                if len(valid_headers) >= 2:
                    df = df[valid_headers]
                
                # SANITIZE AGAIN (For Excel/CSV files that skipped the PDF logic)
                df = sanitize_dataframe(df)

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