import pandas as pd
import pytest

from services.data_service import detect_report_months, parse_date_to_iso


@pytest.mark.parametrize("raw,expected", [
    ("2026-09-01 00:00:00", "2026-09-01T00:00:00Z"),  # str(datetime) from Excel
    ("2026-09-11 00:00:00", "2026-09-11T00:00:00Z"),
    ("2026-09-30 00:00:00", "2026-09-30T00:00:00Z"),
    ("2026-09-01 00:00:00.000", "2026-09-01T00:00:00Z"),
    ("2026-09-01", "2026-09-01T00:00:00Z"),
    ("01/09/2026", "2026-09-01T00:00:00Z"),  # Israeli day-first still works
    ("11.09.26", "2026-09-11T00:00:00Z"),
])
def test_parse_date_keeps_day_and_month(raw, expected):
    assert parse_date_to_iso(raw) == expected


def test_excel_datetime_cells_stay_in_one_month():
    txs = [{"date": str(pd.Timestamp(2026, 9, d))} for d in range(1, 31)]
    out = detect_report_months(txs)
    assert {t["reportMonth"] for t in out} == {"2026-09"}


from services.data_service import prefer_transaction_date_column

DISCOUNT_HEADERS = ["תאריך עסקה", "שם בית העסק", "קטגוריה", "4 ספרות אחרונות של כרטיס האשראי",
                    "סוג עסקה", "סכום חיוב", "מטבע חיוב", "סכום עסקה מקורי", "מטבע עסקה מקורי", "תאריך חיוב"]


def test_billing_date_mapping_is_switched_to_transaction_date():
    m = prefer_transaction_date_column(DISCOUNT_HEADERS, {"date": 9, "description": 1, "amount": 5})
    assert m["date"] == 0


def test_transaction_date_mapping_is_untouched():
    m = {"date": 0, "description": 1, "amount": 5}
    assert prefer_transaction_date_column(DISCOUNT_HEADERS, m) == m


def test_billing_date_kept_when_no_transaction_date_column():
    cols = ["שם בית עסק", "סכום חיוב", "תאריך חיוב"]
    m = {"date": 2, "description": 0, "amount": 1}
    assert prefer_transaction_date_column(cols, m) == m


from services.data_service import apply_installment_months, parse_installment


def _tx(date, notes="", amount=10):
    return {"date": f"{date}T00:00:00Z", "reportMonth": date[:7], "notes": notes, "amount": amount}


def test_parse_installment():
    assert parse_installment("תשלום 2 מתוך 12") == (2, 12)
    assert parse_installment("Payment 3 of 5") == (3, 5)
    assert parse_installment("אינטרנט") is None
    assert parse_installment("תשלום 1 מתוך 1") is None


def test_later_installment_moves_into_statement_month():
    txs = [_tx("2026-09-03"), _tx("2026-09-10"), _tx("2026-09-25"),
           _tx("2026-08-18", "תשלום 2 מתוך 12", 164.75),
           _tx("2026-09-03", "תשלום 1 מתוך 3", 244)]
    out = apply_installment_months(txs)
    libra = out[3]
    assert libra["reportMonth"] == "2026-09"
    assert libra["date"] == "2026-09-18T00:00:00Z"
    assert libra["originalDate"] == "2026-08-18T00:00:00Z"
    assert libra["installment"] == {"current": 2, "total": 12}
    assert out[4]["reportMonth"] == "2026-09" and "originalDate" not in out[4]


def test_day_is_clamped_to_month_length():
    txs = [_tx("2026-02-03"), _tx("2026-02-04"), _tx("2026-01-31", "תשלום 2 מתוך 3")]
    assert apply_installment_months(txs)[2]["date"] == "2026-02-28T00:00:00Z"


def test_no_move_when_statement_has_no_dominant_month():
    txs = [_tx("2026-05-03"), _tx("2026-06-03"), _tx("2026-07-03"), _tx("2026-04-18", "תשלום 2 מתוך 12")]
    assert apply_installment_months(txs)[3]["reportMonth"] == "2026-04"


def test_no_move_without_regular_rows():
    txs = [_tx("2026-08-18", "תשלום 2 מתוך 12")]
    assert apply_installment_months(txs)[0]["reportMonth"] == "2026-08"
