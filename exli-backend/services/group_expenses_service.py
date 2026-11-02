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
    ensure_permission,
    log_activity,
    get_currency_settings,
    GroupServiceError,
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)
import services.income_ratio_service as income_ratio_service
import services.fx_service as fx_service
import services.currency_meta as currency_meta
from services.split_engine import compute_shares, SplitError

MAX_DESCRIPTION_LEN = 140
MAX_NOTE_LEN = 500
MAX_BATCH_TRANSFER = 100
CONVERT_CHUNK_SIZE = 200  # expenses per Firestore batch: <= 2 writes each + 1 group update, well under the 500 cap


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


def _clean_expense_currency(code):
    code = (code or "").strip().upper()
    if code not in currency_meta.supported_currencies():
        raise ValidationError(f"Unknown or unsupported currency: {code}")
    return code


# ---------------------------------------------------------------------------
# Currency resolution — docs/fx/01-fx-plan.md §6.
# ---------------------------------------------------------------------------

def _resolve_currency(db, group, currency, amount_minor, date_str, existing=None):
    """
    Determines the CANONICAL currency/amount an expense's shares are actually
    computed in:
      - `keep_original` groups: the expense stays in whatever currency was
        entered — never converted.
      - `merge` groups: a foreign-currency expense is converted to the
        group's mergeCurrency and the rate is LOCKED on the expense. Editing
        without changing the currency or date reuses the locked rate instead
        of re-fetching it (plan §3 Decision B: "editing anything else keeps it").

    Returns (canonical_currency, canonical_amount_minor, original, fx).
    `original`/`fx` are None unless this expense is a converted (locked) one.
    `existing` is the expense's current stored doc when editing, else None.
    """
    currency = _clean_expense_currency(currency)
    settings = get_currency_settings(group)

    if settings["mode"] == "keep_original":
        return currency, amount_minor, None, None

    target = settings.get("mergeCurrency") or "ILS"
    if currency == target:
        return target, amount_minor, None, None

    existing_original = (existing or {}).get("original")
    existing_fx = (existing or {}).get("fx")
    if (
        existing_original and existing_fx
        and existing_original.get("currency") == currency
        and (existing or {}).get("date") == date_str
    ):
        canonical_amount_minor = fx_service.apply_rate_minor(amount_minor, currency, target, existing_fx["rate"])
        fx = dict(existing_fx)
    else:
        result = fx_service.convert_minor(db, amount_minor, currency, target, date_str=date_str)
        if result["amountMinor"] is None:
            raise ValidationError(f"No exchange rate available to convert {currency} to {target} on {date_str}.")
        canonical_amount_minor = result["amountMinor"]
        fx = {"rate": result["rate"], "rateDate": result["rateDate"], "basis": result["basis"]}

    original = {"amountMinor": amount_minor, "currency": currency}
    return target, canonical_amount_minor, original, fx


# ---------------------------------------------------------------------------
# Split resolution — always server-side, never trusts a client-sent share.
# ---------------------------------------------------------------------------

def _resolve_split(db, group, expense_date, split_input, participants, reference_currency):
    """
    split_input, from the request:
      {"splitRuleId": "<id>"}                            -> use one of the group's saved rules
      {"kind": "custom", "params": {"amounts": {...}}}   -> Pour It Yourself (never a stored rule, plan §3.1)

    reference_currency: what currency this expense's shares are computed in
    (the canonical currency from _resolve_currency) — income_ratio needs this
    to convert each member's own-currency `neto` onto one common footing
    before computing ratios (docs/fx/01-fx-plan.md §6).

    Returns (split_rule_id_or_None, kind, params, resolved_ratios_or_None).
    """
    from_default = bool(split_input.get("useDefault"))
    if from_default:
        fixed = group.get("defaultFixedSplit")
        if fixed and fixed.get("weights"):
            # Constant percentages. Persisted like any other split: the per-expense
            # `shares` are the source of truth, `params.weights` the percentages applied.
            return None, "percent", {"weights": dict(fixed["weights"]), "fromGroupDefault": True}, None
        split_input = {"splitRuleId": group.get("defaultSplitRuleId")}

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
            ratio_result = income_ratio_service.get_income_ratios(
                db, group, expense_date, reference_currency=reference_currency
            )
            if not ratio_result["ready"] and from_default:
                # Graceful fallback for the group DEFAULT only: the expense's month has no complete
                # income data, so split equally and say so (split.params.incomeFallback).
                # Picking the income rule by hand still blocks with INCOME_NOT_READY, as before.
                return split_rule_id, "equal", {"incomeFallback": True, "incomeMonth": ratio_result["month"]}, None
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
            # incomeMonth: the month whose income produced these ratios (per expense, see
            # income_ratio_service.income_month_key) so the UI can label it.
            params = {"weights": ratio_result["ratios"], "incomeMonth": ratio_result["month"]}
            resolved_ratios = ratio_result["ratios"]  # snapshot the RATIO only, never raw income (Debate Q)

        return split_rule_id, kind, params, resolved_ratios

    kind = split_input.get("kind")
    if kind != "custom":
        raise ValidationError("A split must reference a splitRuleId, or use kind='custom' for Pour It Yourself.")
    return None, "custom", (split_input.get("params") or {}), None


def _validate_and_resolve(db, group, *, description, amount_minor, currency, date_str, category=None,
                           payer_id=None, participants=None, split_input=None, note=None, existing=None):
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

    canonical_currency, canonical_amount_minor, original, fx = _resolve_currency(
        db, group, currency, amount_minor, date_str, existing=existing
    )

    split_rule_id, kind, params, resolved_ratios = _resolve_split(
        db, group, expense_date, split_input or {"useDefault": True}, participants,
        reference_currency=canonical_currency,
    )

    try:
        shares = compute_shares(canonical_amount_minor, kind, participants, payer_id, params)
    except SplitError as e:
        raise ValidationError(str(e))

    note = (note or "").strip() or None
    if note and len(note) > MAX_NOTE_LEN:
        raise ValidationError(f"Note must be at most {MAX_NOTE_LEN} characters.")

    fields = {
        "description": description,
        "category": category,
        "date": date_str,
        "amountMinor": canonical_amount_minor,
        "currency": canonical_currency,
        "original": original,
        "fx": fx,
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


def _apply_balance_updates(group, currency_settings, delta_entries):
    """
    delta_entries: list of (currency, deltas) pairs — an edit that changes an
    expense's own currency in a `keep_original` group produces TWO entries
    (reverse the old currency's bucket, apply the new one), since those are
    different ledgers; everything else produces exactly one.

    `merge` groups always write the single flat `balances` ledger (today's
    behavior, unchanged). `keep_original` groups write into the matching
    currency's bucket inside `balancesByCurrency` instead (plan §6: "The
    ledger is kept per currency").
    """
    if currency_settings["mode"] == "keep_original":
        by_currency = dict(group.get("balancesByCurrency") or {})
        for currency, deltas in delta_entries:
            by_currency[currency] = _apply_deltas(by_currency.get(currency) or {}, deltas)
        return {"balancesByCurrency": by_currency}

    balances = dict(group.get("balances") or {})
    for _currency, deltas in delta_entries:
        balances = _apply_deltas(balances, deltas)
    return {"balances": balances}


@firestore.transactional
def _write_expense_and_balances_txn(transaction, group_ref, expense_ref, expense_fields, delta_entries, is_new):
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
    currency_settings = get_currency_settings(group)

    balance_updates = _apply_balance_updates(group, currency_settings, delta_entries)

    if is_new:
        transaction.set(expense_ref, expense_fields)
    else:
        transaction.update(expense_ref, expense_fields)

    transaction.update(group_ref, {**balance_updates, "updatedAt": firestore.SERVER_TIMESTAMP})


@firestore.transactional
def _delete_expense_txn(transaction, group_ref, expense_ref, delta_entries, deleter_uid):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    group = group_snap.to_dict()
    currency_settings = get_currency_settings(group)

    balance_updates = _apply_balance_updates(group, currency_settings, delta_entries)

    transaction.update(expense_ref, {
        "deleted": True,
        "deletedBy": deleter_uid,
        "deletedAt": firestore.SERVER_TIMESTAMP,
    })
    transaction.update(group_ref, {**balance_updates, "updatedAt": firestore.SERVER_TIMESTAMP})


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
    _write_expense_and_balances_txn(
        transaction, snap.reference, expense_ref, expense_doc, [(fields["currency"], deltas)], is_new=True
    )

    log_activity(db, group_id, "EXPENSE_ADDED", uid, metadata={
        "expenseId": expense_ref.id, "amountMinor": fields["amountMinor"],
    })
    logger.info(f"Expense {expense_ref.id} added to group {group_id} by {uid}")
    return expense_ref.id


def edit_expense(db, uid, group_id, expense_id, extra_fields=None, **kwargs):
    """Full replace, not a partial patch — the caller resends every field (simpler and
    harder to get subtly wrong than merging a partial patch onto stored state).
    `extra_fields` are stored as-is on top (used by convert_expense to record original/fx)."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()

    expense_ref, existing = _get_active_expense_or_404(snap.reference, expense_id)
    _ensure_can_edit_expense(group, uid, existing)

    fields, new_shares = _validate_and_resolve(db, group, existing=existing, **kwargs)

    old_deltas = _negate(_balance_deltas(existing["paidBy"], existing["amountMinor"], existing["shares"]))
    new_deltas = _balance_deltas(fields["paidBy"], fields["amountMinor"], new_shares)

    old_currency = existing.get("currency")
    new_currency = fields["currency"]
    if old_currency == new_currency:
        delta_entries = [(new_currency, _combine_deltas(old_deltas, new_deltas))]
    else:
        # A keep_original expense whose currency itself changed — these are
        # two DIFFERENT ledgers (balancesByCurrency buckets), not one to combine.
        delta_entries = [(old_currency, old_deltas), (new_currency, new_deltas)]

    update_fields = {**fields, **(extra_fields or {}), "shares": new_shares,
                     "updatedAt": firestore.SERVER_TIMESTAMP, "updatedBy": uid}

    transaction = db.transaction()
    _write_expense_and_balances_txn(transaction, snap.reference, expense_ref, update_fields, delta_entries, is_new=False)

    log_activity(db, group_id, "EXPENSE_EDITED", uid, target_id=expense_id)
    return True


def _scale_shares(shares, new_total):
    """Scales each person's share by new_total / old_total, rounding so the result sums to new_total
    exactly (largest remainder)."""
    old_total = sum(shares.values())
    if old_total <= 0:
        raise ValidationError("This expense has no shares to convert.")
    raw = {uid: v * new_total / old_total for uid, v in shares.items()}
    scaled = {uid: int(r) for uid, r in raw.items()}
    leftover = new_total - sum(scaled.values())
    for uid in sorted(raw, key=lambda u: raw[u] - scaled[u], reverse=True)[:max(leftover, 0)]:
        scaled[uid] += 1
    return scaled


def convert_expense(db, uid, group_id, expense_id, to_currency):
    """
    Converts ONE keep_original expense into `to_currency` at the rate of its own date
    (docs/fx/01-fx-plan.md §6, the "foreign record" alert). The split keeps its rule (or its
    proportions, for custom/percent splits); balances move from the old currency's ledger to the
    new one's; `original` + `fx` are recorded on the expense so the conversion is traceable.
    """
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    if get_currency_settings(group)["mode"] != "keep_original":
        raise ConflictError("Expenses in this group are already converted to one currency when they are added.")

    _, existing = _get_active_expense_or_404(snap.reference, expense_id)
    target = _clean_expense_currency(to_currency)
    source = existing.get("currency") or group.get("currency") or "ILS"
    if source == target:
        raise ValidationError("This expense is already in that currency.")

    result = fx_service.convert_minor(db, existing["amountMinor"], source, target, date_str=existing["date"])
    if result["amountMinor"] is None or result["amountMinor"] <= 0:
        raise ValidationError(f"No exchange rate available to convert {source} to {target} on {existing['date']}.")
    new_amount = result["amountMinor"]

    split = existing.get("split") or {}
    if split.get("splitRuleId"):
        split_input = {"splitRuleId": split["splitRuleId"]}
    else:
        split_input = {"kind": "custom", "params": {"amounts": _scale_shares(existing["shares"], new_amount)}}

    extra = {
        "original": {"amountMinor": existing["amountMinor"], "currency": source},
        "fx": {"rate": result["rate"], "rateDate": result["rateDate"], "basis": result["basis"]},
    }
    return edit_expense(
        db, uid, group_id, expense_id, extra_fields=extra,
        description=existing.get("description"), amount_minor=new_amount, currency=target,
        date_str=existing["date"], category=existing.get("category"), payer_id=existing["paidBy"],
        participants=existing.get("participants"), split_input=split_input, note=existing.get("note"),
    )


def delete_expense(db, uid, group_id, expense_id):
    """Soft delete (plan §12 decision #4): reverses the expense's balance impact,
    marks it deleted, and keeps it around for the activity trail / dispute history."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()

    expense_ref, existing = _get_active_expense_or_404(snap.reference, expense_id)
    _ensure_can_edit_expense(group, uid, existing)

    reverse_deltas = _negate(_balance_deltas(existing["paidBy"], existing["amountMinor"], existing["shares"]))

    transaction = db.transaction()
    _delete_expense_txn(transaction, snap.reference, expense_ref, [(existing.get("currency"), reverse_deltas)], uid)

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
    currency_settings = get_currency_settings(group)
    balance_updates = _apply_balance_updates(group, currency_settings, [(expense_fields["currency"], deltas)])

    transaction.set(expense_ref, expense_fields)
    transaction.update(group_ref, {**balance_updates, "updatedAt": firestore.SERVER_TIMESTAMP})
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

    personal_currency = _clean_expense_currency(personal.get("currency") or "ILS")
    amount_minor = round(abs(float(personal.get("amount") or 0)) * (10 ** currency_meta.get_minor_units(personal_currency)))
    if amount_minor <= 0:
        raise ValidationError("This expense has no amount to share.")

    fields, shares = _validate_and_resolve(
        db, group,
        description=(personal.get("description") or "").strip() or "Expense",
        amount_minor=amount_minor,
        currency=personal_currency,
        date_str=_personal_date_to_date_str(personal.get("date")),
        category=personal.get("assignedCategory"),
        payer_id=uid,
        participants=None,  # defaults to every active member (plan §12: no separate "split among" step)
        split_input=split_input,
    )
    deltas = _balance_deltas(uid, fields["amountMinor"], shares)

    # The caller's own remaining personal-expense amount must stay expressed
    # in ITS OWN currency (personal_currency), not the group's canonical
    # currency a merge group may have just converted into — invert the same
    # locked rate rather than re-fetching a (possibly different) one.
    my_share_canonical_minor = shares.get(uid, 0)
    if fields["currency"] != personal_currency:
        my_share_minor = fx_service.apply_rate_minor(
            my_share_canonical_minor, fields["currency"], personal_currency, 1 / fields["fx"]["rate"]
        )
    else:
        my_share_minor = my_share_canonical_minor
    my_share_major = my_share_minor / (10 ** currency_meta.get_minor_units(personal_currency))

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
        personal_ref, my_share_major, group_id, group.get("name"),
    )

    log_activity(db, group_id, "EXPENSE_ADDED", uid, metadata={
        "expenseId": expense_ref.id, "amountMinor": amount_minor, "source": "personal_transfer",
    })
    logger.info(f"Personal expense {personal_expense_id} transferred to group {group_id} by {uid}")
    return {"expenseId": expense_ref.id, "myShareMinor": my_share_minor}


def transfer_personal_expenses_batch(db, uid, group_id, personal_expense_ids, split_rule_id, use_default=False):
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
    if not split_rule_id and not use_default:
        raise ValidationError("splitRuleId is required for a bulk move.")
    if len(personal_expense_ids) > MAX_BATCH_TRANSFER:
        raise ValidationError(f"You can move at most {MAX_BATCH_TRANSFER} expenses at once.")

    results = []
    for personal_expense_id in personal_expense_ids:
        try:
            split_input = {"useDefault": True} if use_default else {"splitRuleId": split_rule_id}
            result = transfer_personal_expense(db, uid, group_id, personal_expense_id, split_input)
            results.append({"personalExpenseId": personal_expense_id, "status": "ok", **result})
        except GroupServiceError as e:
            results.append({"personalExpenseId": personal_expense_id, "status": "error", "error": e.message, "code": e.code})

    return {"results": results}


def _commit_resplit(db, uid, group, group_ref, planned):
    """Writes planned re-splits [(doc, expense_dict, new_split, new_shares)] in chunks,
    correcting group balances by the per-member share delta in the same batch."""
    keep_original = get_currency_settings(group)["mode"] == "keep_original"
    for start in range(0, len(planned), CONVERT_CHUNK_SIZE):
        chunk = planned[start:start + CONVERT_CHUNK_SIZE]
        batch = db.batch()
        chunk_deltas = {}  # balance field path -> delta; per-currency ledgers in keep_original groups
        for doc, e, new_split, new_shares in chunk:
            delta = _combine_deltas(
                _negate(_balance_deltas(e["paidBy"], e["amountMinor"], e.get("shares") or {})),
                _balance_deltas(e["paidBy"], e["amountMinor"], new_shares),
            )
            prefix = f"balancesByCurrency.{e.get('currency')}." if keep_original else "balances."
            chunk_deltas = _combine_deltas(chunk_deltas, {f"{prefix}{m_uid}": d for m_uid, d in delta.items()})
            batch.update(doc.reference, {
                "split": new_split, "shares": new_shares,
                "updatedAt": firestore.SERVER_TIMESTAMP, "updatedBy": uid,
            })
            if e.get("source") == "personal_transfer" and e.get("sourcePersonalExpenseId") and e.get("createdBy"):
                personal_ref = db.collection("users").document(e["createdBy"]).collection("expenses").document(
                    e["sourcePersonalExpenseId"])
                personal_snap = personal_ref.get()
                if personal_snap.exists and (personal_snap.to_dict() or {}).get("groupRef"):
                    batch.update(personal_ref, {"amount": new_shares.get(e["paidBy"], 0) / 100})

        group_update = {path: firestore.Increment(d) for path, d in chunk_deltas.items() if d}
        group_update["updatedAt"] = firestore.SERVER_TIMESTAMP
        batch.update(group_ref, group_update)
        batch.commit()


def _income_fix_plan(db, group, group_ref):
    """Expenses that fell back to an equal split because a member's income for the expense's
    month wasn't uploaded yet (split.params.incomeFallback) and whose month is now complete.
    Returns [(doc, expense_dict, new_split, new_shares)]; still-incomplete months are left alone."""
    planned = []
    for doc in group_ref.collection("expenses").stream():
        e = doc.to_dict() or {}
        split = e.get("split") or {}
        if e.get("deleted") or not (split.get("params") or {}).get("incomeFallback") or not split.get("splitRuleId"):
            continue
        try:
            participants = list(e.get("participants") or [])
            split_rule_id, kind, params, resolved = _resolve_split(
                db, group, _parse_date(e.get("date")), {"splitRuleId": split["splitRuleId"]}, participants,
                reference_currency=e.get("currency") or group.get("currency") or "ILS",
            )
            new_shares = compute_shares(e["amountMinor"], kind, participants, e["paidBy"], params)
        except (GroupServiceError, SplitError):
            continue  # income still missing for that month (or the rule is gone) - not fixable yet
        new_split = {"splitRuleId": split_rule_id, "kind": kind, "params": params, "resolvedRatios": resolved}
        planned.append((doc, e, new_split, new_shares))
    return planned


def get_income_fixes(db, uid, group_id):
    """Admin preview for the 'income was uploaded later' notification: which expenses would be
    re-split by income, with each member's share before and after."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")

    fixes = [
        {
            "expenseId": doc.id, "description": e.get("description"), "date": e.get("date"),
            "amountMinor": e["amountMinor"], "currency": e.get("currency"),
            "oldShares": e.get("shares") or {}, "newShares": new_shares,
            "ratios": new_split["resolvedRatios"],
        }
        for doc, e, new_split, new_shares in _income_fix_plan(db, group, snap.reference)
    ]
    fixes.sort(key=lambda f: (f["date"] or "", f["expenseId"]))
    return {"fixes": fixes}


def apply_income_fixes(db, uid, group_id):
    """Admin approval of get_income_fixes: re-splits those expenses by income and corrects balances."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")

    planned = _income_fix_plan(db, group, snap.reference)
    _commit_resplit(db, uid, group, snap.reference, planned)
    log_activity(db, group_id, "EXPENSES_RESPLIT", uid, metadata={
        "converted": len(planned), "unchanged": 0, "skipped": 0, "reason": "income_uploaded",
    })
    return {"converted": len(planned)}


def apply_default_split_to_existing(db, uid, group_id):
    """
    Admin bulk operation: re-split EVERY existing (non-deleted) expense with the group's
    current default split. Income-based defaults resolve per expense, from that expense's
    own date, exactly like a newly added one. Balances are corrected by the per-member
    delta (new shares - old shares), so the zero-sum invariant holds. Personal expenses
    that were moved into the group get their reduced `amount` (the payer's share)
    refreshed too.

    Writes are chunked (CONVERT_CHUNK_SIZE expenses per Firestore batch); each chunk
    adjusts balances with atomic Increments, so a chunk is all-or-nothing and a retry
    only re-converts what's still different. Expenses that can't be re-split (e.g. Your
    Treat with more than two people) are skipped and reported, not failed.
    """
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")
    if not group.get("defaultSplitConfigured"):
        raise ValidationError("This group has no default split set.")

    group_ref = snap.reference
    expenses = [d for d in group_ref.collection("expenses").stream() if not (d.to_dict() or {}).get("deleted")]

    planned = []
    unchanged = 0
    skipped = []
    for doc in expenses:
        e = doc.to_dict()
        try:
            participants = list(e.get("participants") or [])
            split_rule_id, kind, params, resolved = _resolve_split(
                db, group, _parse_date(e.get("date")), {"useDefault": True}, participants,
                reference_currency=e.get("currency") or group.get("currency") or "ILS",
            )
            new_shares = compute_shares(e["amountMinor"], kind, participants, e["paidBy"], params)
        except (GroupServiceError, SplitError) as err:
            skipped.append({"expenseId": doc.id, "error": getattr(err, "message", str(err))})
            continue

        new_split = {"splitRuleId": split_rule_id, "kind": kind, "params": params, "resolvedRatios": resolved}
        if new_shares == e.get("shares") and new_split == e.get("split"):
            unchanged += 1
            continue
        planned.append((doc, e, new_split, new_shares))

    _commit_resplit(db, uid, group, group_ref, planned)

    log_activity(db, group_id, "EXPENSES_RESPLIT", uid, metadata={
        "converted": len(planned), "unchanged": unchanged, "skipped": len(skipped),
    })
    return {"total": len(expenses), "converted": len(planned), "unchanged": unchanged, "skipped": skipped}


@firestore.transactional
def _untransfer_expense_txn(transaction, group_ref, expense_ref, delta_entries, personal_ref):
    group_snap = group_ref.get(transaction=transaction)
    if not group_snap.exists:
        raise NotFoundError("Group not found.")
    personal_snap = personal_ref.get(transaction=transaction)
    if not personal_snap.exists:
        raise NotFoundError("Expense not found.")
    personal = personal_snap.to_dict()

    group = group_snap.to_dict()
    currency_settings = get_currency_settings(group)
    balance_updates = _apply_balance_updates(group, currency_settings, delta_entries)

    transaction.update(expense_ref, {"deleted": True, "deletedBy": None, "deletedAt": firestore.SERVER_TIMESTAMP})
    transaction.update(group_ref, {**balance_updates, "updatedAt": firestore.SERVER_TIMESTAMP})
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
    _untransfer_expense_txn(
        transaction, snap.reference, expense_ref, [(existing.get("currency"), reverse_deltas)], personal_ref
    )

    log_activity(db, group_id, "EXPENSE_DELETED", uid, target_id=group_ref_info["groupExpenseId"])
    return True
