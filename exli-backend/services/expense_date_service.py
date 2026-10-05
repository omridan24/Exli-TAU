"""
Changing an expense's DATE / month in Analytics (users/{uid}/expenses/{id}).

Analytics buckets an expense by the stored `reportMonth` ("YYYY-MM"), NOT by its
`date` field. The two used to be able to disagree (the old "move month" action only
rewrote reportMonth, imports with installments/forecasts, bad Excel dates...). The
invariant enforced here for every write: the month of `date` == `reportMonth`.

Expenses shared into a group (`groupRef`) are a snapshot in that group (amount, date
and split live in groups/{gid}/expenses). Changing the date only on the personal copy
would silently desync it, so date/month changes on shared expenses are BLOCKED; the
user must "Remove from group" first and re-share afterwards.
"""
import calendar
import re
from datetime import date, datetime

from services.groups_service import ValidationError

MAX_BULK = 400  # Firestore batch limit is 500 writes
_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
_DATE_PREFIX_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def parse_day(value):
    """'YYYY-MM-DD' (optionally followed by a time part) -> date. ValidationError if not a real date."""
    m = _DATE_PREFIX_RE.match(value) if isinstance(value, str) else None
    if not m:
        raise ValidationError("date must be YYYY-MM-DD.", code="INVALID_DATE")
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        raise ValidationError("That date does not exist.", code="INVALID_DATE")


def validate_month(month):
    if not isinstance(month, str) or not _MONTH_RE.match(month):
        raise ValidationError("month must be YYYY-MM.", code="INVALID_MONTH")
    return month


def month_of(value):
    d = parse_day(value)
    return f"{d.year}-{d.month:02d}"


def stored_date(day, like=None):
    """Formats a date the way the existing expense stores it (imports use 'YYYY-MM-DDT00:00:00Z')."""
    if isinstance(like, str) and "T" in like:
        return f"{day.isoformat()}T00:00:00Z"
    return day.isoformat() if like else f"{day.isoformat()}T00:00:00Z"


def date_into_month(old_value, target_month):
    """Keeps the day-of-month of `old_value` where possible, clamped to the target month's last day."""
    validate_month(target_month)
    year, month = int(target_month[:4]), int(target_month[5:7])
    try:
        day_of_month = parse_day(old_value).day
    except ValidationError:
        day_of_month = 1  # unparseable/missing date: first of the month
    return date(year, month, min(day_of_month, calendar.monthrange(year, month)[1]))


def month_mismatch(expense):
    """Returns (date_month, report_month) when they disagree, else None. Unparseable dates are not flagged."""
    report_month = expense.get("reportMonth")
    try:
        date_month = month_of(expense.get("date"))
    except ValidationError:
        return None
    if report_month and date_month != report_month:
        return date_month, report_month
    return None


def assert_consistent(expense):
    """Data-level guard: raise instead of ever writing an expense whose date month != reportMonth."""
    mismatch = month_mismatch(expense)
    if mismatch:
        raise ValidationError(
            f"Date is in {mismatch[0]} but the expense is in {mismatch[1]}.", code="MONTH_MISMATCH"
        )


def _is_shared(expense):
    return bool(expense.get("groupRef"))


def _plan(expense, new_day, now):
    """Update dict for one expense: new date + matching reportMonth. Returns (updates, moved_month)."""
    new_month = f"{new_day.year}-{new_day.month:02d}"
    updates = {"date": stored_date(new_day, expense.get("date")), "reportMonth": new_month}
    moved = new_month != expense.get("reportMonth")
    if moved:
        updates["movedAt"] = now
        updates["movedFrom"] = expense.get("reportMonth")
    merged = {**expense, **updates}
    assert_consistent(merged)
    return updates, moved


def _apply(db, uid, ids, planner):
    ids = list(dict.fromkeys(ids or []))
    if not ids or not all(isinstance(i, str) and i for i in ids):
        raise ValidationError("ids must be a non-empty list of expense ids.", code="INVALID_IDS")
    if len(ids) > MAX_BULK:
        raise ValidationError(f"At most {MAX_BULK} expenses at a time.", code="TOO_MANY")

    now = datetime.utcnow()
    result = {"updated": [], "movedMonth": 0, "sameMonth": 0, "blockedShared": [], "notFound": []}
    batch = db.batch()
    writes = 0
    for expense_id in ids:
        ref = db.collection("users").document(uid).collection("expenses").document(expense_id)
        snap = ref.get()
        if not snap.exists:
            result["notFound"].append(expense_id)
            continue
        expense = snap.to_dict() or {}
        if _is_shared(expense):
            result["blockedShared"].append(expense_id)
            continue
        updates, moved = _plan(expense, planner(expense), now)
        batch.update(ref, updates)
        writes += 1
        result["updated"].append(expense_id)
        result["movedMonth" if moved else "sameMonth"] += 1
    if writes:
        batch.commit()
    return result


def change_dates(db, uid, ids, new_date):
    """Sets one exact date on every expense; each expense moves to that date's month if needed."""
    new_day = parse_day(new_date)
    return _apply(db, uid, ids, lambda expense: new_day)


def move_month(db, uid, ids, target_month):
    """Moves expenses to `target_month`, keeping each expense's day-of-month (clamped)."""
    validate_month(target_month)
    return _apply(db, uid, ids, lambda expense: date_into_month(expense.get("date"), target_month))


def fix_mismatch(db, uid, ids):
    """One-click fix for a date/month mismatch: move each expense to the month its date is in."""
    ids = list(dict.fromkeys(ids or []))
    if not ids:
        raise ValidationError("ids must be a non-empty list of expense ids.", code="INVALID_IDS")
    return _apply(db, uid, ids, lambda expense: parse_day(expense.get("date")))
