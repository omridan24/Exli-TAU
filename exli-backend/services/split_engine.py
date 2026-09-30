"""
Pure split math for group expenses. No Firestore, no Flask — see
docs/groups/02-phase2-ui-and-splits-plan.md §3.4 (rounding) and §3.7 (income_ratio).

This is mirrored (by hand, on purpose — see the plan's Debate K) in
exli-front/src/features/groups/utils/splitEngine.js for the client-side live
preview. Both implementations are checked against the same fixtures in
docs/groups/split-test-vectors.json so they can't silently drift. The SERVER
result from this module is always the one actually saved; the client's copy is
preview-only.
"""

SPLIT_KINDS = {"equal", "payer_covers", "others_cover", "shares", "percent", "income_ratio", "custom"}

# Kinds whose weights are tied to specific people, and so need the Debate H
# join/leave maintenance (weight=0 for new members, drop + needsReview on removal).
MEMBER_SPECIFIC_KINDS = {"shares", "percent"}


class SplitError(Exception):
    """Invalid split input — bad kind, bad weights, amounts that don't add up, etc."""


def _distribute_weighted(amount_minor, weights, remainder_receiver_uid):
    """
    Every uid in `weights` (int weights, all > 0) gets floor(amount * weight / total),
    computed with integer division (exact, no float rounding error). Whatever's left
    over (0, 1, or a few minor units) goes ENTIRELY to `remainder_receiver_uid` if
    they're one of the weighted uids, or otherwise to the smallest uid (stable,
    deterministic) — see the plan's "the payer absorbs the rounding" rule.
    """
    total_weight = sum(weights.values())
    if total_weight <= 0:
        raise SplitError("Split weights must sum to more than zero.")

    shares = {uid: (amount_minor * weight) // total_weight for uid, weight in weights.items()}
    remainder = amount_minor - sum(shares.values())

    if remainder:
        receiver = remainder_receiver_uid if remainder_receiver_uid in shares else min(shares.keys())
        shares[receiver] += remainder

    return shares


def compute_shares(amount_minor, kind, participants, payer_id, params=None):
    """
    amount_minor: int > 0, total to split, in minor currency units (agorot).
    kind: one of SPLIT_KINDS.
    participants: list[uid] — everyone this expense is being split among.
    payer_id: uid who paid — always the rounding-remainder receiver where relevant.
    params: kind-specific:
      - equal / payer_covers / others_cover: none needed.
      - shares / percent / income_ratio: {"weights": {uid: positive int}}
      - custom: {"amounts": {uid: int}}, must sum to amount_minor exactly.

    Returns {uid: int}, summing EXACTLY to amount_minor.
    """
    if not isinstance(amount_minor, int) or amount_minor <= 0:
        raise SplitError("Amount must be a positive integer number of minor units.")

    participants = list(dict.fromkeys(participants))  # de-dupe, keep order
    if not participants:
        raise SplitError("At least one participant is required.")

    params = params or {}

    if kind == "equal":
        weights = {uid: 1 for uid in participants}
        return _distribute_weighted(amount_minor, weights, payer_id)

    if kind == "payer_covers":
        # The payer's own share IS the full amount, so their net balance change is
        # zero (they paid `amount`, they owe `amount`) and nobody else owes anything.
        return {payer_id: amount_minor}

    if kind == "others_cover":
        others = [uid for uid in participants if uid != payer_id]
        if not others:
            raise SplitError("This split needs at least one other participant.")
        shares = _distribute_weighted(amount_minor, {uid: 1 for uid in others}, min(others))
        shares[payer_id] = 0
        return shares

    if kind in ("shares", "percent", "income_ratio"):
        weights = {
            uid: w for uid, w in (params.get("weights") or {}).items()
            if uid in participants and w and w > 0
        }
        if not weights:
            raise SplitError("At least one participant needs a positive weight.")
        return _distribute_weighted(amount_minor, weights, payer_id)

    if kind == "custom":
        amounts = params.get("amounts") or {}
        missing = [uid for uid in participants if uid not in amounts]
        if missing:
            raise SplitError("Every participant needs an amount in a custom split.")
        shares = {uid: int(amounts[uid]) for uid in participants}
        if any(v < 0 for v in shares.values()):
            raise SplitError("Custom amounts can't be negative.")
        total = sum(shares.values())
        if total != amount_minor:
            raise SplitError(f"Custom amounts must sum to {amount_minor}, got {total}.")
        return shares

    raise SplitError(f"Unknown split kind: {kind}")
