import filetype
from flask import abort
import logging

logger = logging.getLogger("exli-backend")

def validate_file_safety(file_storage):
    """
    Validates that the uploaded file is a safe image or PDF.
    Reads magic numbers using filetype library.
    Resets file pointer after check.
    Raises 400 if unsafe.
    """
    try:
        # Read first 2KB for magic number detection
        header = file_storage.read(2048)
        file_storage.seek(0) # IMPORTANT: Reset pointer immediately
        
        kind = filetype.guess(header)
        
        if kind is None:
            # If we can't guess, it might be a text file or something else obscure.
            # Use strict allowlist behavior.
            # However, for PDFs sometimes filetype needs more bytes? 2KB is usually enough.
            logger.warning(f"Filetype could not guess type for '{file_storage.filename}'. Header: {header.hex()} Rejecting.")
            abort(400, description="Could not determine file type. Please upload a valid PDF or Image.")
            
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        
        if kind.mime not in allowed_types:
            logger.warning(f"Security Alert: Blocked upload of type '{kind.mime}' for file '{file_storage.filename}'")
            abort(400, description=f"Security Alert: File type '{kind.mime}' is not allowed. Only PDF, JPEG, PNG, and WebP are safe.")
            
        return True
    except Exception as e:
        logger.error(f"Error checking file safety: {e}")
        # Fail closed
        abort(400, description=f"Error verifying file safety: {str(e)}")
