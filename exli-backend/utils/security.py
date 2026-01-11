import filetype
from flask import abort
from werkzeug.exceptions import HTTPException
import logging

logger = logging.getLogger("exli-backend")

def validate_file_safety(file_storage):
    """
    Validates that the uploaded file is a safe image, PDF, CSV or Excel file.
    Reads magic numbers using filetype library.
    Resets file pointer after check.
    Raises 400 if unsafe.
    """
    try:
        filename = file_storage.filename.lower() if file_storage.filename else ""
        
        # Read first 2KB for magic number detection
        header = file_storage.read(2048)
        file_storage.seek(0) # IMPORTANT: Reset pointer immediately
        
        kind = filetype.guess(header)
        
        # 1. Handle Known Binary Types
        if kind is not None:
            allowed_mimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
            
            if kind.mime in allowed_mimes:
                return True
            
            # Allow XLSX (often detected as zip)
            # filetype often detects xlsx as application/zip
            if kind.mime == 'application/zip':
                if filename.endswith('.xlsx'):
                    return True
                else:
                    logger.warning(f"Blocked generic zip file '{filename}' (only .xlsx zips allowed)")
                    abort(400, description="Security Alert: ZIP files are not allowed, only .xlsx files.")

            # Some detectors might be more specific, so allow excel mimes if they appear
            if 'spreadsheet' in kind.mime or 'excel' in kind.mime or 'openxmlformats' in kind.mime:
                return True

            logger.warning(f"Security Alert: Blocked upload of type '{kind.mime}' for file '{filename}'")
            abort(400, description=f"Security Alert: File type '{kind.mime}' is not allowed. Allowed: PDF, Images, XLSX, CSV.")
            
        # 2. Handle Text Files (CSV/txt) - filetype returns None for these
        else:
            if filename.endswith('.csv'):
                # Simple sanity check: CSVs should be text, not binary.
                # Check for null bytes which usually indicate binary files.
                if b'\0' in header:
                    logger.warning(f"Blocked CSV file '{filename}' as it contains binary data.")
                    abort(400, description="Security Alert: CSV file appears to be binary/corrupt.")
                return True
            
            logger.warning(f"Filetype could not guess type for '{filename}'. Header: {header.hex()} Rejecting.")
            abort(400, description="Could not determine file type. Please upload a valid PDF, Image, XLSX, or CSV.")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error checking file safety: {e}")
        # Fail closed
        abort(400, description=f"Error verifying file safety: {str(e)}")
