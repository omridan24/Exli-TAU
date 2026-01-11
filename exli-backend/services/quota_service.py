from google.cloud import firestore
from datetime import datetime
from flask import abort
from config import Config, logger
import werkzeug.exceptions

# Initialize Firestore Client
# Note: In production this should probably be a singleton provided by data_service or similar,
# but for now we initialize here as per existing patterns in main.py
try:
    db = firestore.Client()
except Exception:
    logger.warning("Could not initialize Firestore in quota_service. Local dev without creds?")
    db = None

@firestore.transactional
def limit_check_transaction(transaction, user_ref, quota_ref):
    """
    Transactional function to check and update quota.
    Returns (is_allowed, limit, current_usage)
    """
    user_snapshot = user_ref.get(transaction=transaction)
    quota_snapshot = quota_ref.get(transaction=transaction)

    # Determine Tier
    tier = "free"
    if user_snapshot.exists:
        # Check 'tier' field
        data = user_snapshot.to_dict()
        if data and 'tier' in data:
            tier = data['tier']

    limit = Config.QUOTA_FREE_TIER_MONTHLY
    if tier == "pro":
        limit = Config.QUOTA_PRO_TIER_MONTHLY

    current_usage = 0
    if quota_snapshot.exists:
        q_data = quota_snapshot.to_dict()
        if q_data and 'usage_count' in q_data:
            current_usage = q_data['usage_count']

    if current_usage >= limit:
        return False, limit, current_usage

    # Increment
    new_usage = current_usage + 1
    if not quota_snapshot.exists:
        transaction.set(quota_ref, {
            "usage_count": new_usage, 
            "last_updated": firestore.SERVER_TIMESTAMP
        })
    else:
        # We merge just in case other fields exist, though set with merge=True is safer
        transaction.set(quota_ref, {
            "usage_count": new_usage, 
            "last_updated": firestore.SERVER_TIMESTAMP
        }, merge=True)

    return True, limit, new_usage

def check_and_increment_quota(user_id):
    """
    Checks if user has quota remaining for the current month.
    If yes, increments usage.
    If no, aborts with 403.
    """
    if not db:
        logger.warning("Firestore not available, skipping quota check (Fail Open for Dev)")
        return

    if not user_id:
        # If the endpoint requires authentication, main.py should have caught this.
        # But if we get here without user_id, it's an error.
        logger.warning("check_and_increment_quota called without user_id")
        return # Or abort(400)

    now = datetime.now()
    month_key = now.strftime("%Y-%m")
    
    user_ref = db.collection("users").document(user_id)
    quota_ref = user_ref.collection("quotas").document(month_key)
    
    transaction = db.transaction()
    
    try:
        is_allowed, limit, usage = limit_check_transaction(transaction, user_ref, quota_ref)
        
        if not is_allowed:
            logger.info(f"User {user_id} exceeded quota: {usage}/{limit}")
            abort(403, description=Config.QUOTA_EXCEEDED_MESSAGE)
            
        logger.info(f"User {user_id} quota check passed: {usage}/{limit}")
        return True
        
    except werkzeug.exceptions.HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Quota check transaction failed: {e}")
        # IMPORTANT: If DB fails, do we block the user?
        # For a startup, maybe Fail Open is better to avoid downtime blocking?
        # But user requested "Security and Quota System", preventing abuse is key.
        # I will Fail Closed (abort 500) to ensure system integrity as per request.
        abort(500, description="System error verifying quota.")
