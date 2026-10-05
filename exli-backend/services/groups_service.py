"""
Groups business logic (Phase 1: creation, invites, join requests, membership).

This module is intentionally Flask-free: it takes a Firestore `db` client and the
already-verified `uid` of the caller as plain arguments, and raises typed
GroupServiceError subclasses instead of calling `abort()`. That keeps it usable both
from the Flask blueprint (routes/groups.py) and directly from tests, and matches the
"service layer takes db as a parameter" approach used for testing (see docs/groups).

See docs/groups/01-backend-db-plan.md for the full design and the debates behind it.
"""
import secrets
from datetime import datetime, timedelta, timezone

from google.cloud import firestore
from config import logger
import services.split_catalog as split_catalog
import services.income_ratio_service as income_ratio_service
from services.split_engine import MEMBER_SPECIFIC_KINDS
from services.currency_codes import VALID_CURRENCY_CODES

DEFAULT_CURRENCY = "ILS"

MAX_NAME_LEN = 60
MAX_DESCRIPTION_LEN = 280
SCHEMA_VERSION = 1
MAX_MEMBERS = split_catalog.MAX_MEMBERS  # re-exported: the overall cap. Per-type caps (e.g. Partner=2)
                                          # are enforced via split_catalog.effective_max_members(group_type).

# Invite links must expire, and soon - a leaked link that never dies (or lives for
# a month) is a standing way into the group. 7 days is the longest offered; 1 day
# for a link you expect to use right away (Groups feedback, 2026-09-29).
ALLOWED_INVITE_DURATIONS_DAYS = (1, 7)
DEFAULT_INVITE_DURATION_DAYS = 7

DEFAULT_SETTINGS = {
    "membersCanInvite": False,     # if True, non-admins can also view/share the invite link
    "requireApproval": True,       # always True for now; kept explicit for future self-serve join
}
# `settings.defaultSplit` from Phase 1 is replaced by the top-level `defaultSplitRuleId`
# (plan 02 §3.3) — safe to drop outright since no groups have been created yet.

VALID_ROLES = {"admin", "member"}


# ---------------------------------------------------------------------------
# Errors — the Flask layer maps these to HTTP status codes via `.http_status`.
# ---------------------------------------------------------------------------

class GroupServiceError(Exception):
    http_status = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message, code=None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class ValidationError(GroupServiceError):
    http_status = 400
    code = "VALIDATION_ERROR"


class NotFoundError(GroupServiceError):
    http_status = 404
    code = "NOT_FOUND"


class ForbiddenError(GroupServiceError):
    http_status = 403
    code = "FORBIDDEN"


class ConflictError(GroupServiceError):
    http_status = 409
    code = "CONFLICT"


class GoneError(GroupServiceError):
    http_status = 410
    code = "GONE"


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------
# A single map so a new permission or role is a one-line change instead of a
# scattered set of `if role == 'admin'` checks (see plan §4.2).
PERMISSIONS = {
    "group.update": {"admin"},
    "invite.manage": {"admin"},
    "invite.view": {"admin"},
    "request.decide": {"admin"},
    "member.role": {"admin"},
    "member.remove": {"admin"},
    "split_rules.manage": {"admin"},
}


def active_role(group, uid):
    member = (group.get("members") or {}).get(uid)
    if not member or member.get("status") != "active":
        return None
    return member.get("role")


def _active_admin_uids(group, exclude_uid=None):
    return [
        uid for uid, m in (group.get("members") or {}).items()
        if m.get("status") == "active" and m.get("role") == "admin" and uid != exclude_uid
    ]


def ensure_permission(group, uid, action):
    role = active_role(group, uid)
    if role is None:
        raise ForbiddenError("You are not a member of this group.")

    allowed = set(PERMISSIONS[action])
    if action in ("invite.manage", "invite.view") and (group.get("settings") or {}).get("membersCanInvite"):
        allowed.add("member")

    if role not in allowed:
        raise ForbiddenError("You don't have permission to do this.")


def ensure_owner(group, uid):
    if group.get("ownerId") != uid:
        raise ForbiddenError("Only the group creator can do this.")


def _ensure_not_last_admin(group, exclude_uid):
    if not _active_admin_uids(group, exclude_uid=exclude_uid):
        raise ConflictError("The group needs at least one admin. Promote someone else first.")


# ---------------------------------------------------------------------------
# Small shared helpers
# ---------------------------------------------------------------------------

def get_group_or_404(db, group_id):
    snap = db.collection("groups").document(group_id).get()
    if not snap.exists or snap.to_dict().get("status") == "deleting":
        raise NotFoundError("Group not found.")
    return snap


def log_activity(db, group_id, activity_type, actor_id, target_id=None, metadata=None):
    db.collection("groups").document(group_id).collection("activity").add({
        "type": activity_type,
        "actorId": actor_id,
        "targetId": target_id,
        "metadata": metadata or {},
        "createdAt": firestore.SERVER_TIMESTAMP,
    })


def _clean_name(name):
    name = (name or "").strip()
    if not name:
        raise ValidationError("Group name is required.")
    if len(name) > MAX_NAME_LEN:
        raise ValidationError(f"Group name must be at most {MAX_NAME_LEN} characters.")
    return name


def _clean_description(description):
    description = (description or "").strip() or None
    if description and len(description) > MAX_DESCRIPTION_LEN:
        raise ValidationError(f"Description must be at most {MAX_DESCRIPTION_LEN} characters.")
    return description


def _is_whitelisted(db, email):
    if not email:
        return False
    return db.collection("whitelist").document(email).get().exists


# ---------------------------------------------------------------------------
# Group CRUD
# ---------------------------------------------------------------------------

def create_group(db, uid, user_info, *, name, description=None, currency="ILS", emoji=None, group_type="other"):
    name = _clean_name(name)
    description = _clean_description(description)
    if not split_catalog.is_valid_type(group_type):
        raise ValidationError(f"Unknown group type: {group_type}")

    split_rules, default_split_rule_id = split_catalog.build_default_split_rules(group_type)

    group_ref = db.collection("groups").document()
    now = firestore.SERVER_TIMESTAMP

    member_entry = {
        "role": "admin",
        "status": "active",
        "displayName": user_info["displayName"],
        "photoURL": user_info.get("photoURL"),
        "email": user_info["email"],
        "joinedAt": now,
        "addedBy": uid,
    }

    group_doc = {
        "name": name,
        "description": description,
        "emoji": emoji,
        "type": group_type,
        "imageUrl": None,  # set later via POST /groups/<gid>/image (plan §7)
        "currency": currency,  # Phase 1: single currency per group (multi-currency is a later, additive change)
        "ownerId": uid,
        "memberIds": [uid],
        "members": {uid: member_entry},
        "settings": dict(DEFAULT_SETTINGS),
        "splitRules": split_rules,
        "defaultSplitRuleId": default_split_rule_id,
        "balances": {uid: 0},
        "pendingRequestCount": 0,
        "status": "active",
        "version": SCHEMA_VERSION,
        "createdAt": now,
        "updatedAt": now,
    }

    group_ref.set(group_doc)
    log_activity(db, group_ref.id, "GROUP_CREATED", uid, metadata={"name": name, "type": group_type})
    logger.info(f"Group {group_ref.id} ({group_type}) created by {uid}")
    return group_ref.id


FIXED_SPLIT_TOTAL = 10000  # basis points: weights are hundredths of a percent, so 3333/3333/3334 stays exact


def _validate_fixed_split(group, fixed):
    """
    A group's constant "buckets of percentages" default: {"weights": {uid: basis points}}
    covering exactly the active members, each >= 0, summing to 10000 (= 100%).
    """
    weights = fixed.get("weights") if isinstance(fixed, dict) else None
    if not isinstance(weights, dict) or not weights:
        raise ValidationError("defaultFixedSplit must have a weights map.")
    active = {uid for uid, m in (group.get("members") or {}).items() if m.get("status") == "active"}
    if set(weights.keys()) != active:
        raise ValidationError("defaultFixedSplit must include every active member, and only them.")
    if any(isinstance(w, bool) or not isinstance(w, int) or w < 0 for w in weights.values()):
        raise ValidationError("Fixed split weights must be whole numbers, 0 or more.")
    if sum(weights.values()) != FIXED_SPLIT_TOTAL:
        raise ValidationError("Fixed split percentages must add up to 100%.")
    return {"weights": dict(weights)}


def update_group(db, uid, group_id, patch):
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")

    updates = {}
    if "name" in patch:
        updates["name"] = _clean_name(patch["name"])
    if "description" in patch:
        updates["description"] = _clean_description(patch["description"])
    if "emoji" in patch:
        updates["emoji"] = patch["emoji"]
    if "currency" in patch:
        code = str(patch["currency"] or DEFAULT_CURRENCY).strip().upper()
        if code not in VALID_CURRENCY_CODES:
            raise ValidationError(f"Unknown currency: {patch['currency']}")
        updates["currency"] = code  # a group's one currency; changing it relabels, it doesn't convert
    if "imageUrl" in patch:
        updates["imageUrl"] = patch["imageUrl"]
    if "type" in patch:
        new_type = patch["type"]
        if not split_catalog.is_valid_type(new_type):
            raise ValidationError(f"Unknown group type: {new_type}")
        new_cap = split_catalog.effective_max_members(new_type)
        member_count = len(group.get("memberIds") or [])
        if member_count > new_cap:
            raise ConflictError(
                f"This group has {member_count} members, more than the {new_cap}-member limit for that type."
            )
        updates["type"] = new_type  # existing splitRules are untouched (plan §2)
    if "defaultSplitRuleId" in patch:
        valid_ids = {r["id"] for r in group.get("splitRules") or []}
        if patch["defaultSplitRuleId"] not in valid_ids:
            raise ValidationError("defaultSplitRuleId must reference an existing split rule.")
        updates["defaultSplitRuleId"] = patch["defaultSplitRuleId"]
        updates["defaultFixedSplit"] = None  # choosing a rule replaces any fixed-percentages default
        updates["defaultSplitConfigured"] = True
    if "defaultFixedSplit" in patch:
        if patch["defaultFixedSplit"] is None:
            updates["defaultFixedSplit"] = None
        else:
            updates["defaultFixedSplit"] = _validate_fixed_split(group, patch["defaultFixedSplit"])
            updates["defaultSplitConfigured"] = True
    if "settings" in patch and isinstance(patch["settings"], dict):
        settings = dict(group.get("settings") or DEFAULT_SETTINGS)
        for key in ("membersCanInvite",):
            if key in patch["settings"]:
                settings[key] = patch["settings"][key]
        updates["settings"] = settings

    if not updates:
        raise ValidationError("No valid fields to update.")

    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    snap.reference.update(updates)
    log_activity(db, group_id, "SETTINGS_UPDATED", uid, metadata={"fields": list(updates.keys())})
    return True


def set_split_rules(db, uid, group_id, rules, default_split_rule_id):
    """
    Replaces a group's split rules wholesale (PUT semantics — the admin's rule
    manager sends the full array back). Admin only. See plan §3 / §10.
    """
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "split_rules.manage")

    try:
        valid_ids = split_catalog.validate_split_rules(rules)
    except split_catalog.SplitRuleValidationError as e:
        raise ValidationError(str(e))

    if default_split_rule_id not in valid_ids:
        raise ValidationError("defaultSplitRuleId must be one of the submitted rules.")

    snap.reference.update({
        "splitRules": rules,
        "defaultSplitRuleId": default_split_rule_id,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    log_activity(db, group_id, "SPLIT_RULES_UPDATED", uid)
    return True


def get_income_ratio_preview(db, uid, group_id, for_date):
    """
    Any active member can check whether "Split by Income" is usable right now
    (plan §3.7) — this is what lets the SplitPicker show "waiting on Dana's
    September income" before the rule can even be selected.
    """
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    if active_role(group, uid) is None:
        raise ForbiddenError("You are not a member of this group.")

    return income_ratio_service.get_income_ratios(db, group, for_date)


MAX_INCOME_MONTHS = 24


def get_income_ratio_months(db, uid, group_id, month_keys):
    """
    Per-month "Split by Income" breakdown for the UI: for each expense month 'YYYY-MM',
    what that month's expenses resolve to (same rule as get_income_ratios: the ratio from
    that same month's income; `month` in each result says which month that was).
    """
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    if active_role(group, uid) is None:
        raise ForbiddenError("You are not a member of this group.")

    keys = list(dict.fromkeys(month_keys or []))[:MAX_INCOME_MONTHS]
    results = []
    for key in keys:
        try:
            for_date = datetime.strptime(key, "%Y-%m").date()
        except (TypeError, ValueError):
            raise ValidationError("months must be YYYY-MM values.")
        results.append({"forMonth": key, **income_ratio_service.get_income_ratios(db, group, for_date)})
    return results


def _split_rules_after_membership_change(split_rules, uid, action):
    """
    Debate H maintenance: only touches member-specific rules (shares/percent) that
    already have configured weights. `action` is "add" (new member gets weight 0,
    excluded until the admin sets it) or "remove" (drops their weight entirely).
    Either way flags the rule `needsReview` so the picker can surface it. Returns a
    NEW list, or None if nothing needed to change (so callers can skip the write).
    income_ratio is deliberately untouched — it has no stored weights to drift
    (plan §3.6).
    """
    changed = False
    updated = []

    for rule in split_rules:
        if rule.get("kind") not in MEMBER_SPECIFIC_KINDS:
            updated.append(rule)
            continue

        weights = (rule.get("params") or {}).get("weights") or {}
        if not weights:
            updated.append(rule)  # not configured yet — nothing to maintain
            continue

        new_weights = dict(weights)
        if action == "add" and uid not in new_weights:
            new_weights[uid] = 0
        elif action == "remove" and uid in new_weights:
            del new_weights[uid]
        else:
            updated.append(rule)
            continue

        changed = True
        new_rule = dict(rule)
        new_rule["params"] = {**(rule.get("params") or {}), "weights": new_weights}
        new_rule["needsReview"] = True
        updated.append(new_rule)

    return updated if changed else None


def delete_group(db, uid, group_id):
    """Hard delete. Only the creator (owner) can do this — see plan §9 decisions log."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_owner(group, uid)

    # Flip status first so any live onSnapshot listener drops the group immediately,
    # even though the recursive delete of subcollections below can take a moment.
    snap.reference.update({"status": "deleting", "updatedAt": firestore.SERVER_TIMESTAMP})

    for invite in db.collection("groupInvites").where("groupId", "==", group_id).stream():
        invite.reference.delete()

    db.recursive_delete(snap.reference)
    logger.info(f"Group {group_id} deleted by owner {uid}")
    return True


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

def _generate_token():
    return secrets.token_urlsafe(16)


def _invite_public(token, invite):
    return {
        "token": token,
        "groupId": invite["groupId"],
        "expiresAt": invite.get("expiresAt"),
        "maxUses": invite.get("maxUses"),
        "uses": invite.get("uses", 0),
    }


def _create_invite(db, uid, group_id, *, max_uses=None, expires_in_days=None):
    if expires_in_days is None:
        expires_in_days = DEFAULT_INVITE_DURATION_DAYS
    if expires_in_days not in ALLOWED_INVITE_DURATIONS_DAYS:
        raise ValidationError(f"expiresInDays must be one of {ALLOWED_INVITE_DURATIONS_DAYS}.")

    token = _generate_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    invite_doc = {
        "groupId": group_id,
        "createdBy": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "expiresAt": expires_at,
        "maxUses": max_uses,
        "uses": 0,
        "revoked": False,
    }
    db.collection("groupInvites").document(token).set(invite_doc)
    return _invite_public(token, invite_doc)


def _active_invite_query(db, group_id):
    return (
        db.collection("groupInvites")
        .where("groupId", "==", group_id)
        .where("revoked", "==", False)
    )


def get_or_create_invite(db, uid, group_id, expires_in_days=None):
    """Returns the group's current reusable invite link, creating one if none exists."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "invite.view")

    for doc in _active_invite_query(db, group_id).limit(1).stream():
        return _invite_public(doc.id, doc.to_dict())

    invite = _create_invite(db, uid, group_id, expires_in_days=expires_in_days)
    log_activity(db, group_id, "INVITE_CREATED", uid)
    return invite


def rotate_invite(db, uid, group_id, expires_in_days=None):
    """Revokes the current link and issues a new one (e.g. it leaked, or the
    admin wants to change how long it stays valid for)."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "invite.manage")

    for doc in _active_invite_query(db, group_id).stream():
        doc.reference.update({"revoked": True})

    invite = _create_invite(db, uid, group_id, expires_in_days=expires_in_days)
    log_activity(db, group_id, "INVITE_ROTATED", uid)
    return invite


def revoke_invite(db, uid, group_id):
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "invite.manage")

    revoked_any = False
    for doc in _active_invite_query(db, group_id).stream():
        doc.reference.update({"revoked": True})
        revoked_any = True

    if revoked_any:
        log_activity(db, group_id, "INVITE_REVOKED", uid)
    return True


def _check_invite_valid(invite):
    if invite.get("revoked"):
        raise GoneError("This invite link has been revoked.")

    expires_at = invite.get("expiresAt")
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise GoneError("This invite link has expired.")

    max_uses = invite.get("maxUses")
    if max_uses is not None and invite.get("uses", 0) >= max_uses:
        raise GoneError("This invite link has reached its use limit.")


def _get_invite_and_group(db, token):
    invite_snap = db.collection("groupInvites").document(token).get()
    if not invite_snap.exists:
        raise NotFoundError("This invite link is invalid.")
    invite = invite_snap.to_dict()

    group_snap = db.collection("groups").document(invite["groupId"]).get()
    if not group_snap.exists or group_snap.to_dict().get("status") != "active":
        raise NotFoundError("This group no longer exists.")

    return invite_snap, invite, group_snap, group_snap.to_dict()


def get_invite_preview(db, uid, email, token):
    """
    Public-ish preview shown on the /join/:token page, BEFORE requesting to join.
    Deliberately excludes whitelist enforcement so a non-whitelisted (but logged in)
    user still sees the group name and a clear "you need Exli access first" message
    via `isWhitelisted: false`, instead of a generic 403.
    """
    invite_snap, invite, group_snap, group = _get_invite_and_group(db, token)

    member = (group.get("members") or {}).get(uid)
    if member and member.get("status") == "active":
        viewer_status = "member"
    else:
        request_snap = group_snap.reference.collection("joinRequests").document(uid).get()
        viewer_status = request_snap.to_dict().get("status", "pending") if request_snap.exists else "none"

    # Someone with existing history (member/pending/rejected) can still load this page
    # to check their status even if the link has since been revoked/expired/exhausted.
    if viewer_status == "none":
        _check_invite_valid(invite)

    admin_name = next(
        (m["displayName"] for m in (group.get("members") or {}).values()
         if m.get("role") == "admin" and m.get("status") == "active"),
        None,
    )

    return {
        "groupId": group_snap.id,
        "groupName": group.get("name"),
        "emoji": group.get("emoji"),
        "memberCount": len(group.get("memberIds") or []),
        "adminName": admin_name,
        "viewerStatus": viewer_status,  # none | pending | member | rejected | cancelled
        "isWhitelisted": _is_whitelisted(db, email),
    }


# ---------------------------------------------------------------------------
# Join requests
# ---------------------------------------------------------------------------

@firestore.transactional
def _create_join_request_txn(transaction, group_ref, invite_ref, uid, user_info, token):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists or group_snap.to_dict().get("status") != "active":
        raise NotFoundError("This group no longer exists.")
    group = group_snap.to_dict()

    member = (group.get("members") or {}).get(uid)
    if member and member.get("status") == "active":
        raise ConflictError("You're already a member of this group.")

    cap = split_catalog.effective_max_members(group.get("type", "other"))
    if len(group.get("memberIds") or []) >= cap:
        raise ConflictError(f"This group has reached its {cap}-member limit.")

    request_ref = group_ref.collection("joinRequests").document(uid)
    request_snap = request_ref.get(transaction=transaction)
    if request_snap.exists and request_snap.to_dict().get("status") == "pending":
        raise ConflictError("You already have a pending request for this group.")

    invite_snap = invite_ref.get(transaction=transaction)
    if not invite_snap.exists:
        raise NotFoundError("This invite link is invalid.")
    # Re-check validity INSIDE the transaction (not just before it) to avoid a
    # race where two requests both pass the outer check right at the use-limit boundary.
    _check_invite_valid(invite_snap.to_dict())

    transaction.set(request_ref, {
        "uid": uid,
        "displayName": user_info["displayName"],
        "photoURL": user_info.get("photoURL"),
        "email": user_info["email"],
        "inviteToken": token,
        "status": "pending",
        "requestedAt": firestore.SERVER_TIMESTAMP,
        "decidedAt": None,
        "decidedBy": None,
    })
    transaction.update(group_ref, {
        "pendingRequestCount": firestore.Increment(1),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    transaction.update(invite_ref, {"uses": firestore.Increment(1)})


def create_join_request(db, uid, user_info, token):
    invite_ref = db.collection("groupInvites").document(token)
    invite_snap = invite_ref.get()
    if not invite_snap.exists:
        raise NotFoundError("This invite link is invalid.")
    _check_invite_valid(invite_snap.to_dict())  # fast-fail before opening a transaction

    group_id = invite_snap.to_dict()["groupId"]
    group_ref = db.collection("groups").document(group_id)

    transaction = db.transaction()
    _create_join_request_txn(transaction, group_ref, invite_ref, uid, user_info, token)
    log_activity(db, group_id, "JOIN_REQUESTED", uid)
    return {"groupId": group_id, "status": "pending"}


def cancel_join_request(db, uid, token):
    invite_snap = db.collection("groupInvites").document(token).get()
    if not invite_snap.exists:
        raise NotFoundError("This invite link is invalid.")

    group_id = invite_snap.to_dict()["groupId"]
    group_ref = db.collection("groups").document(group_id)
    request_ref = group_ref.collection("joinRequests").document(uid)

    request_snap = request_ref.get()
    if not request_snap.exists or request_snap.to_dict().get("status") != "pending":
        raise NotFoundError("No pending request to cancel.")

    request_ref.update({"status": "cancelled", "decidedAt": firestore.SERVER_TIMESTAMP})
    group_ref.update({"pendingRequestCount": firestore.Increment(-1), "updatedAt": firestore.SERVER_TIMESTAMP})
    return True


@firestore.transactional
def _approve_request_txn(transaction, group_ref, request_ref, admin_uid, target_uid):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    group = group_snap.to_dict()
    ensure_permission(group, admin_uid, "request.decide")

    request_snap = request_ref.get(transaction=transaction)
    if not request_snap.exists or request_snap.to_dict().get("status") != "pending":
        raise ConflictError("This request is no longer pending (it may already have been handled).")
    req = request_snap.to_dict()

    cap = split_catalog.effective_max_members(group.get("type", "other"))
    if len(group.get("memberIds") or []) >= cap:
        raise ConflictError(f"This group has reached its {cap}-member limit.")

    member_entry = {
        "role": "member",
        "status": "active",
        "displayName": req["displayName"],
        "photoURL": req.get("photoURL"),
        "email": req["email"],
        "joinedAt": firestore.SERVER_TIMESTAMP,
        "addedBy": admin_uid,
    }

    transaction.update(request_ref, {
        "status": "approved",
        "decidedAt": firestore.SERVER_TIMESTAMP,
        "decidedBy": admin_uid,
    })

    group_update = {
        f"members.{target_uid}": member_entry,
        "memberIds": firestore.ArrayUnion([target_uid]),
        f"balances.{target_uid}": 0,
        "pendingRequestCount": firestore.Increment(-1),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    updated_rules = _split_rules_after_membership_change(group.get("splitRules") or [], target_uid, "add")
    if updated_rules is not None:
        group_update["splitRules"] = updated_rules
    if group.get("defaultFixedSplit"):
        group_update["defaultFixedSplit"] = None  # the fixed percentages no longer cover everyone

    transaction.update(group_ref, group_update)


def approve_request(db, admin_uid, group_id, target_uid):
    group_ref = db.collection("groups").document(group_id)
    request_ref = group_ref.collection("joinRequests").document(target_uid)

    transaction = db.transaction()
    _approve_request_txn(transaction, group_ref, request_ref, admin_uid, target_uid)
    log_activity(db, group_id, "MEMBER_JOINED", admin_uid, target_id=target_uid)
    return True


@firestore.transactional
def _reject_request_txn(transaction, group_ref, request_ref, admin_uid):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    ensure_permission(group_snap.to_dict(), admin_uid, "request.decide")

    request_snap = request_ref.get(transaction=transaction)
    if not request_snap.exists or request_snap.to_dict().get("status") != "pending":
        raise ConflictError("This request is no longer pending.")

    transaction.update(request_ref, {
        "status": "rejected",
        "decidedAt": firestore.SERVER_TIMESTAMP,
        "decidedBy": admin_uid,
    })
    transaction.update(group_ref, {
        "pendingRequestCount": firestore.Increment(-1),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })


def reject_request(db, admin_uid, group_id, target_uid):
    group_ref = db.collection("groups").document(group_id)
    request_ref = group_ref.collection("joinRequests").document(target_uid)

    transaction = db.transaction()
    _reject_request_txn(transaction, group_ref, request_ref, admin_uid)
    log_activity(db, group_id, "REQUEST_REJECTED", admin_uid, target_id=target_uid)
    return True


# ---------------------------------------------------------------------------
# Membership management
# ---------------------------------------------------------------------------

@firestore.transactional
def _change_role_txn(transaction, group_ref, admin_uid, target_uid, new_role):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    group = group_snap.to_dict()
    ensure_permission(group, admin_uid, "member.role")

    target = (group.get("members") or {}).get(target_uid)
    if not target or target.get("status") != "active":
        raise NotFoundError("This person isn't an active member of this group.")

    if group.get("ownerId") == target_uid and new_role == "member":
        raise ForbiddenError("The group creator must stay an admin.")

    if target.get("role") == "admin" and new_role == "member":
        _ensure_not_last_admin(group, exclude_uid=target_uid)

    transaction.update(group_ref, {
        f"members.{target_uid}.role": new_role,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })


def change_role(db, admin_uid, group_id, target_uid, new_role):
    if new_role not in VALID_ROLES:
        raise ValidationError("Role must be 'admin' or 'member'.")

    group_ref = db.collection("groups").document(group_id)
    transaction = db.transaction()
    _change_role_txn(transaction, group_ref, admin_uid, target_uid, new_role)
    log_activity(db, group_id, "ROLE_CHANGED", admin_uid, target_id=target_uid, metadata={"role": new_role})
    return True


@firestore.transactional
def _remove_member_txn(transaction, group_ref, actor_uid, target_uid, is_self):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    group = group_snap.to_dict()

    if not is_self:
        ensure_permission(group, actor_uid, "member.remove")

    target = (group.get("members") or {}).get(target_uid)
    if not target or target.get("status") != "active":
        raise NotFoundError("This person isn't an active member of this group.")

    if group.get("ownerId") == target_uid:
        raise ForbiddenError("The group creator can't be removed or leave. Delete the group instead.")

    if target.get("role") == "admin":
        _ensure_not_last_admin(group, exclude_uid=target_uid)

    balance = (group.get("balances") or {}).get(target_uid, 0)
    if balance != 0:
        raise ConflictError("This member has an outstanding balance and can't be removed until it's settled.")

    group_update = {
        f"members.{target_uid}.status": "left" if is_self else "removed",
        "memberIds": firestore.ArrayRemove([target_uid]),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    updated_rules = _split_rules_after_membership_change(group.get("splitRules") or [], target_uid, "remove")
    if updated_rules is not None:
        group_update["splitRules"] = updated_rules
    if group.get("defaultFixedSplit"):
        group_update["defaultFixedSplit"] = None  # the fixed percentages no longer cover everyone

    transaction.update(group_ref, group_update)


def remove_member(db, actor_uid, group_id, target_uid):
    """Handles BOTH an admin removing someone and a member leaving on their own (actor == target)."""
    group_ref = db.collection("groups").document(group_id)
    is_self = actor_uid == target_uid

    transaction = db.transaction()
    _remove_member_txn(transaction, group_ref, actor_uid, target_uid, is_self)
    log_activity(db, group_id, "MEMBER_LEFT" if is_self else "MEMBER_REMOVED", actor_uid, target_id=target_uid)
    return True
