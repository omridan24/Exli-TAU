import os
import sys
import logging
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Setup Logging
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger("exli-backend")

class Config:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    # NEW: Document AI Configs
    GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    GCP_LOCATION = os.environ.get("GCP_LOCATION", "eu") # 'us' or 'eu'
    DOCAI_PROCESSOR_ID = os.environ.get("DOCAI_PROCESSOR_ID")
    
    @staticmethod
    def validate():
        if not Config.GEMINI_API_KEY:
            logger.error("CRITICAL: GEMINI_API_KEY is missing.")
        if not Config.DOCAI_PROCESSOR_ID:
            logger.warning("WARNING: DOCAI_PROCESSOR_ID is missing. PDF parsing will fail.")
        
        # Clean key
        if Config.GEMINI_API_KEY:
            Config.GEMINI_API_KEY = Config.GEMINI_API_KEY.replace("(", "").replace(")", "").strip()

# Run validation on import
Config.validate()