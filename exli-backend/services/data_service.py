import io
import pandas as pd
import re
import json
from config import logger
from services.ai_service import analyze_multiple_files_structure, convert_pdf_to_data
from services.currency_codes import normalize_currency

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