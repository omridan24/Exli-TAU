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

    # Security & Quota Configs
    QUOTA_FREE_TIER_MONTHLY = 100
    QUOTA_PRO_TIER_MONTHLY = 100
    RATE_LIMIT_GLOBAL = "1000 per day"
    RATE_LIMIT_AI = "20 per minute"
    
    SYSTEM_API_KEY = os.environ.get("SYSTEM_API_KEY")
    
    QUOTA_EXCEEDED_MESSAGE = (
        "You've reached your free limit for this month! We love that you're using Exli. "
        "To continue analyzing more files and unlock premium features, please consider upgrading to Pro."
    )
    
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