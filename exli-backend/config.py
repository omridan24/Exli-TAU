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
    
    @staticmethod
    def validate():
        if not Config.GEMINI_API_KEY:
            logger.error("CRITICAL: GEMINI_API_KEY is missing from environment.")
        else:
            # Clean key (remove accidental spaces/parens)
            Config.GEMINI_API_KEY = Config.GEMINI_API_KEY.replace("(", "").replace(")", "").strip()

# Run validation on import
Config.validate()