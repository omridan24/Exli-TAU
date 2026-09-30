"""
Group expenses: create, edit, and (soft) delete, with the group's `balances` map
updated in the SAME transaction as the expense write, so balances can never drift
from the expenses that produced them. See
docs/groups/02-phase2-ui-and-splits-plan.md §5 and §12 decision #4 (soft delete).

Split rules are only ever RESOLVED and RE-VALIDATED here on the server — a client
never gets to send its own `shares`. See plan 02 Debate K and (for income_ratio)
Debate Q.
"""
from datetime import datetime

from google.cloud import firestore
from config import logger

from services.groups_service import (
    get_group_or_404,
    active_role,
    log_activity,
    GroupServiceError,
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)
import services.income_ratio_service as income_ratio_service
from services.split_engine import compute_shares, SplitError

MAX_DESCRIPTION_LEN = 140
MAX_NOTE_LEN = 500
MAX_BATCH_TRANSFER = 100


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError("date must be in YYYY-MM-DD format.")


def _personal_date_to_date_str(raw):
    """Personal expenses (users/{uid}/expenses) store `date` as either a plain
    'YYYY-MM-DD' string or a full ISO datetime string — either way, the first
    10 characters are the date part."""
    if not raw:
        return datetime.utcnow().strftime("%Y-%m-%d")
    return str(raw)[:10]


def _active_member_uids(group):
    return [uid for uid, m in (group.get("members") or {}).items() if m.get("status") == "active"]


def _find_split_rule(group, split_rule_id):
    for rule in group.get("splitRules") or []:
        if rule.get("id") == split_rule_id:
            return rule
    return None


def _ensure_can_edit_expense(group, uid, expense):
    """Plan §5: the expense's creator, or any admin, can edit/delete it."""
    if expense.get("createdBy") == uid:
        return
    if active_role(group, uid) != "admin":
        raise ForbiddenError("Only the person who added this expense, or an admin, can change it.")


def _get_active_expense_or_404(group_ref, expense_id):
    expense_ref = group_ref.collection("expenses").document(expense_id)
    snap = expense_ref.get()
    if not snap.exists or snap.to_dict().get("deleted"):
        raise NotFoundError("Expense not found.")
    return expense_ref, snap.to_dict()


# ---------------------------------------------------------------------------
# Split resolution — always server-side, never trusts a client-sent share.
# ---------------------------------------------------------------------------

def _resolve_split(db, group, expense_date, split_input, participants):
    """
    split_input, from the request:
      {"splitRuleId": "<id>"}                            -> use one of the group's saved rules
      {"kind": "custom", "params": {"amounts": {...}}}   -> Pour It Yourself (never a stored rule, plan §3.1)

    Returns (split_rule_id_or_None, kind, params, resolved_ratios_or_None).
    """
    split_rule_id = split_input.get("splitRuleId")

    if split_rule_id:
        rule = _find_split_rule(group, split_rule_id)
        if not rule:
            raise ValidationError("This group has no split rule with that id.")
        if rule.get("hidden"):
            raise ValidationError("This split rule is hidden and can't be used.")

        kind = rule["kind"]
        params = dict(rule.get("params") or {})
        resolved_ratios = None

        # "Your Treat" only makes sense pointed at ONE specific person ("your" is
        # singular) — with 3+ participants it'd silently become "split among
        # everyone else", which isn't what the name promises. Couples/pairs only.
        if rule.get("builtIn") == "your_treat" and len(participants) != 2:
            raise ValidationError(
                "Your Treat only works for an expense split between exactly two people.",
                code="NEEDS_TWO_PEOPLE",
            )

        if kind == "income_ratio":
            # Re-derived fresh every time (plan §3.7) — never trust a cached ratio.
            ratio_result = income_ratio_service.get_income_ratios(db, group, expense_date)
            if not ratio_result["ready"]:
                members = group.get("members") or {}
                missing_names = ", ".join(
                    members.get(m_uid, {}).get("displayName", m_uid) for m_uid in ratio_result["missing"]
                )
                raise ConflictError(
                    f"Split by Income isn't ready yet — waiting on {missing_names}'s "
                    f"{ratio_result['month']} income.",
                    code="INCOME_NOT_READY",
                )
            params = {"weights": ratio_result["ratios"]}
            resolved_ratios = ratio_result["ratios"]  # snapshot the RATIO only, never raw income (Debate Q)

        return split_rule_id, kind, params, resolved_ratios

    kind = split_input.get("kind")
    if kind != "custom":
        raise ValidationError("A split must reference a splitRuleId, or use kind='custom' for Pour It Yourself.")
    return None, "custom", (split_input.get("params") or {}), None


def _validate_and_resolve(db, group, *, description, amount_minor, date_str, category=None,
                           payer_id=None, participants=None, split_input=None, note=None):
    description = (description or "").strip()
    if not description:
        raise ValidationError("A description is required.")
    if len(description) > MAX_DESCRIPTION_LEN:
        raise ValidationError(f"Description must be at most {MAX_DESCRIPTION_LEN} characters.")

    if not isinstance(amount_minor, int) or amount_minor <= 0:
        raise ValidationError("Amount must be a positive whole number of minor currency units.")

    if not payer_id:
        raise ValidationError("payerId is required.")

    expense_date = _parse_date(date_str)

    active_uids = set(_active_member_uids(group))
    if payer_id not in active_uids:
        raise ValidationError("The payer must be an active member of this group.")

    participants = list(participants) if participants else sorted(active_uids)
    invalid = [p for p in participants if p not in active_uids]
    if invalid:
        raise ValidationError("All participants must be active members of this group.")

    split_rule_id, kind, params, resolved_ratios = _resolve_split(
        db, group, expense_date, split_input or {"splitRuleId": group.get("defaultSplitRuleId")}, participants
    )

    try:
        shares = compute_shares(amount_minor, kind, participants, payer_id, params)
    except SplitError as e:
        raise ValidationError(str(e))

    note = (note or "").strip() or None
    if note and len(note) > MAX_NOTE_LEN:
        raise ValidationError(f"Note must be at most {MAX_NOTE_LEN} characters.")

    fields = {
        "description": description,
        "category": category,
        "date": date_str,
        "amountMinor": amount_minor,
        "currency": group.get("currency", "ILS"),
        "paidBy": payer_id,
        "participants": participants,
        "split": {
            "splitRuleId": split_rule_id,
            "kind": kind,
            "params": params,
            "resolvedRatios": resolved_ratios,
        },
        "note": note,
    }
    return fields, shares


# ---------------------------------------------------------------------------
# Balances: kept as plain deltas so create/edit/delete can share the same math.
# Every delta dict here always sums to exactly zero (plan 01 Debate E's
# zero-sum invariant) — the payer is credited the full amount, participants
# are debited their share, and Σshares == amount by construction.
# ---------------------------------------------------------------------------

def _balance_deltas(payer_id, amount_minor, shares):
    deltas = {payer_id: amount_minor}
    for uid, share in shares.items():
        deltas[uid] = deltas.get(uid, 0) - share
    return deltas


def _negate(deltas):
    return {uid: -delta for uid, delta in deltas.items()}


def _combine_deltas(*delta_dicts):
    combined = {}
    for deltas in delta_dicts:
        for uid, delta in deltas.items():
            combined[uid] = combined.get(uid, 0) + delta
    return combined


def _apply_deltas(balances, deltas):
    updated = dict(balances)
    for uid, delta in deltas.items():
        updated[uid] = updated.get(uid, 0) + delta
    return updated


@firestore.transactional
def _write_expense_and_balances_txn(transaction, group_ref, expense_ref, expense_fields, deltas, is_new):
    """
    Re-reads the group's balances FRESH inside the transaction (never the
    balances snapshot the caller resolved the split against), so concurrent
    expense writes on the same group serialize correctly through Firestore's
    normal transaction-abort-and-retry behavior. (Known narrow gap: this does
    NOT re-validate that participants/rules are unchanged since the caller's
    initial read — an edit racing a membership change is not re-checked here.
    Acceptable for this pass; flagged rather than silently ignored.)
    """
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    group = group_snap.to_dict()

    balances = _apply_deltas(group.get("balances") or {}, deltas)

    if is_new:
        transaction.set(expense_ref, expense_fields)
    else:
        transaction.update(expense_ref, expense_fields)

    transaction.update(group_ref, {"balances": balances, "updatedAt": firestore.SERVER_TIMESTAMP})


@firestore.transactional
def _delete_expense_txn(transaction, group_ref, expense_ref, reverse_deltas, deleter_uid):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    group = group_snap.to_dict()

    balances = _apply_deltas(group.get("balances") or {}, reverse_deltas)

    transaction.update(expense_ref, {
        "deleted": True,
        "deletedBy": deleter_uid,
        "deletedAt": firestore.SERVER_TIMESTAMP,
    })
    transaction.update(group_ref, {"balances": balances, "updatedAt": firestore.SERVER_TIMESTAMP})


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_expense(db, uid, group_id, **kwargs):
    """Any active member can add an expense (plan §5: expense.create: {admin, member})."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    if active_role(group, uid) is None:
        raise ForbiddenError("You are not a member of this group.")

    kwargs.setdefault("payer_id", uid)
    fields, shares = _validate_and_resolve(db, group, **kwargs)
    deltas = _balance_deltas(fields["paidBy"], fields["amountMinor"], shares)

    expense_ref = snap.reference.collection("expenses").document()
    expense_doc = {
        **fields,
        "shares": shares,
        "source": "manual",
        "sourcePersonalExpenseId": None,
        "deleted": False,
        "deletedBy": None,
        "deletedAt": None,
        "createdBy": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "updatedBy": uid,
    }

    transaction = db.transaction()
    _write_expense_and_balances_txn(transaction, snap.reference, expense_ref, expense_doc, deltas, is_new=True)

    log_activity(db, group_id, "EXPENSE_ADDED", uid, metadata={
        "expenseId": expense_ref.id, "amountMinor": fields["amountMinor"],
    })
    logger.info(f"Expense {expense_ref.id} added to group {group_id} by {uid}")
    return expense_ref.id


def edit_expense(db, uid, group_id, expense_id, **kwargs):
    """Full replace, not a partial patch — the caller resends every field (simpler and
    harder to get subtly wrong than merging a partial patch onto stored state)."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()

    expense_ref, existing = _get_active_expense_or_404(snap.reference, expense_id)
    _ensure_can_edit_expense(group, uid, existing)

    fields, new_shares = _validate_and_resolve(db, group, **kwargs)

    old_deltas = _negate(_balance_deltas(existing["paidBy"], existing["amountMinor"], existing["shares"]))
    new_deltas = _balance_deltas(fields["paidBy"], fields["amountMinor"], new_shares)
    combined_deltas = _combine_deltas(old_deltas, new_deltas)

    update_fields = {**fields, "shares": new_shares, "updatedAt": firestore.SERVER_TIMESTAMP, "updatedBy": uid}

    transaction = db.transaction()
    _write_expense_and_balances_txn(transaction, snap.reference, expense_ref, update_fields, combined_deltas, is_new=False)

    log_activity(db, group_id, "EXPENSE_EDITED", uid, target_id=expense_id)
    return True


def delete_expense(db, uid, group_id, expense_id):
    """Soft delete (plan §12 decision #4): reverses the expense's balance impact,
    marks it deleted, and keeps it around for the activity trail / dispute history."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()

    expense_ref, existing = _get_active_expense_or_404(snap.reference, expense_id)
    _ensure_can_edit_expense(group, uid, existing)

    reverse_deltas = _negate(_balance_deltas(existing["paidBy"], existing["amountMinor"], existing["shares"]))

    transaction = db.transaction()
    _delete_expense_txn(transaction, snap.reference, expense_ref, reverse_deltas, uid)

    log_activity(db, group_id, "EXPENSE_DELETED", uid, target_id=expense_id)
    return True


# ---------------------------------------------------------------------------
# Transfer a personal expense into a group (Phase 3, plan 01 §8)
# ---------------------------------------------------------------------------

@firestore.transactional
def _transfer_expense_txn(transaction, group_ref, expense_ref, expense_fields, deltas, personal_ref, my_share_major, group_id, group_name):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    personal_snap = personal_ref.get(transaction=transaction)
    if not personal_snap.exists:
        raise NotFoundError("Expense not found.")
    personal = personal_snap.to_dict()
    if personal.get("groupRef"):
        raise ConflictError("This expense has already been shared to a group.")

    group = group_snap.to_dict()
    balances = _apply_deltas(group.get("balances") or {}, deltas)

    transaction.set(expense_ref, expense_fields)
    transaction.update(group_ref, {"balances": balances, "updatedAt": firestore.SERVER_TIMESTAMP})
    transaction.update(personal_ref, {
        "amount": my_share_major,
        "originalAmount": personal.get("amount"),
        "groupRef": {"groupId": group_id, "groupExpenseId": expense_ref.id, "groupName": group_name},
    })


def transfer_personal_expense(db, uid, group_id, personal_expense_id, split_input):
    """
    Moves one of the caller's own personal expenses (users/{uid}/expenses/{id})
    into a group as a new group expense. The transferring user is always the
    payer — they're the one who paid on their own card, which is exactly why it
    was in their personal expenses. The personal expense isn't deleted: its
    `amount` is reduced to just the caller's own share (what they actually still
    owe/are owed), and it's tagged with `groupRef` so the UI can show it's shared
    and so it can't be transferred a second time.
    """
    if not personal_expense_id:
        raise ValidationError("personalExpenseId is required.")

    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    if active_role(group, uid) is None:
        raise ForbiddenError("You are not a member of this group.")

    personal_ref = db.collection("users").document(uid).collection("expenses").document(personal_expense_id)
    personal_snap = personal_ref.get()
    if not personal_snap.exists:
        raise NotFoundError("Expense not found.")
    personal = personal_snap.to_dict()
    if personal.get("groupRef"):
        raise ConflictError("This expense has already been shared to a group.")

    amount_minor = round(abs(float(personal.get("amount") or 0)) * 100)
    if amount_minor <= 0:
        raise ValidationError("This expense has no amount to share.")

    fields, shares = _validate_and_resolve(
        db, group,
        description=(personal.get("description") or "").strip() or "Expense",
        amount_minor=amount_minor,
        date_str=_personal_date_to_date_str(personal.get("date")),
        category=personal.get("assignedCategory"),
        payer_id=uid,
        participants=None,  # defaults to every active member (plan §12: no separate "split among" step)
        split_input=split_input,
    )
    my_share_minor = shares.get(uid, 0)
    deltas = _balance_deltas(uid, amount_minor, shares)

    expense_ref = snap.reference.collection("expenses").document()
    expense_doc = {
        **fields,
        "shares": shares,
        "source": "personal_transfer",
        "sourcePersonalExpenseId": personal_expense_id,
        "deleted": False,
        "deletedBy": None,
        "deletedAt": None,
        "createdBy": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "updatedBy": uid,
    }

    transaction = db.transaction()
    _transfer_expense_txn(
        transaction, snap.reference, expense_ref, expense_doc, deltas,
        personal_ref, my_share_minor / 100, group_id, group.get("name"),
    )

    log_activity(db, group_id, "EXPENSE_ADDED", uid, metadata={
        "expenseId": expense_ref.id, "amountMinor": amount_minor, "source": "personal_transfer",
    })
    logger.info(f"Personal expense {personal_expense_id} transferred to group {group_id} by {uid}")
    return {"expenseId": expense_ref.id, "myShareMinor": my_share_minor}


def transfer_personal_expenses_batch(db, uid, group_id, personal_expense_ids, split_rule_id):
    """
    Bulk 'move to group' from the Expenses report's multi-select bar: applies ONE
    chosen split rule across several personal expenses at once, so a
    split_rule_id is required - a single custom split can't scale across
    expenses with different totals. Pour It Yourself is still reachable for a
    bulk selection, just not through this endpoint: the frontend walks the
    selection one expense at a time and calls transfer_personal_expense (below)
    directly for each, since that one already accepts any split_input.

    Each expense is transferred independently (its own transaction, via
    transfer_personal_expense) so one failure — already shared, or Split by
    Income not ready for THAT expense's month — doesn't block the rest.
    """
    if not personal_expense_ids:
        raise ValidationError("personalExpenseIds is required.")
    if not split_rule_id:
        raise ValidationError("splitRuleId is required for a bulk move.")
    if len(personal_expense_ids) > MAX_BATCH_TRANSFER:
        raise ValidationError(f"You can move at most {MAX_BATCH_TRANSFER} expenses at once.")

    results = []
    for personal_expense_id in personal_expense_ids:
        try:
            result = transfer_personal_expense(db, uid, group_id, personal_expense_id, {"splitRuleId": split_rule_id})
            results.append({"personalExpenseId": personal_expense_id, "status": "ok", **result})
        except GroupServiceError as e:
            results.append({"personalExpenseId": personal_expense_id, "status": "error", "error": e.message, "code": e.code})

    return {"results": results}


@firestore.transactional
def _untransfer_expense_txn(transaction, group_ref, expense_ref, reverse_deltas, personal_ref):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    personal_snap = personal_ref.get(transaction=transaction)
    if not personal_snap.exists:
        raise NotFoundError("Expense not found.")
    personal = personal_snap.to_dict()

    group = group_snap.to_dict()
    balances = _apply_deltas(group.get("balances") or {}, reverse_deltas)

    transaction.update(expense_ref, {"deleted": True, "deletedBy": None, "deletedAt": firestore.SERVER_TIMESTAMP})
    transaction.update(group_ref, {"balances": balances, "updatedAt": firestore.SERVER_TIMESTAMP})
    transaction.update(personal_ref, {
        "amount": personal.get("originalAmount", personal.get("amount")),
        "originalAmount": firestore.DELETE_FIELD,
        "groupRef": firestore.DELETE_FIELD,
    })


def remove_personal_expense_from_group(db, uid, group_id, personal_expense_id):
    """
    Undo transfer_personal_expense: soft-deletes the group expense (reversing
    its balance impact, exactly like delete_expense) and restores the personal
    expense to its pre-transfer `amount` (saved as `originalAmount` at transfer
    time), clearing groupRef/originalAmount so it's a plain personal expense
    again - free to be transferred (to this group or another) a second time.

    Only the member who transferred it can undo it here: `uid` is always that
    expense's own personal-expense owner (it lives at
    users/{uid}/expenses/{personal_expense_id}), which is also who
    transfer_personal_expense always records as the group expense's
    createdBy - so _ensure_can_edit_expense's "creator or admin" check always
    passes for exactly this caller, same as it always did going the other way.
    """
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()

    personal_ref = db.collection("users").document(uid).collection("expenses").document(personal_expense_id)
    personal_snap = personal_ref.get()
    if not personal_snap.exists:
        raise NotFoundError("Expense not found.")
    personal = personal_snap.to_dict()

    group_ref_info = personal.get("groupRef")
    if not group_ref_info or group_ref_info.get("groupId") != group_id:
        raise ValidationError("This expense isn't shared to this group.")

    expense_ref, existing = _get_active_expense_or_404(snap.reference, group_ref_info["groupExpenseId"])
    _ensure_can_edit_expense(group, uid, existing)

    reverse_deltas = _negate(_balance_deltas(existing["paidBy"], existing["amountMinor"], existing["shares"]))

    transaction = db.transaction()
    _untransfer_expense_txn(transaction, snap.reference, expense_ref, reverse_deltas, personal_ref)

    log_activity(db, group_id, "EXPENSE_DELETED", uid, target_id=group_ref_info["groupExpenseId"])
    return True
