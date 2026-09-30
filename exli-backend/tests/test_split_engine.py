"""
Runs services/split_engine.py against the shared fixtures in
docs/groups/split-test-vectors.json — the same file exli-front/scripts/
verify-split-vectors.mjs runs against the JS mirror. See that JSON file's
"_comment" and docs/groups/02-phase2-ui-and-splits-plan.md Debate K.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.split_engine import compute_shares, SplitError

VECTORS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "groups", "split-test-vectors.json"
)


def _load_vectors():
    with open(VECTORS_PATH, encoding="utf-8") as f:
        return json.load(f)


_data = _load_vectors()


@pytest.mark.parametrize("vector", _data["vectors"], ids=[v["description"] for v in _data["vectors"]])
def test_vector(vector):
    result = compute_shares(
        vector["amountMinor"], vector["kind"], vector["participants"], vector["payerId"], vector["params"]
    )
    assert result == vector["expectedShares"]
    assert sum(result.values()) == vector["amountMinor"], "shares must always sum exactly to the amount"


@pytest.mark.parametrize("vector", _data["errorVectors"], ids=[v["description"] for v in _data["errorVectors"]])
def test_error_vector(vector):
    with pytest.raises(SplitError):
        compute_shares(vector["amountMinor"], vector["kind"], vector["participants"], vector["payerId"], vector["params"])


def test_vectors_file_is_not_empty():
    # Guards against a future refactor accidentally pointing VECTORS_PATH at nothing.
    assert len(_data["vectors"]) >= 10
    assert len(_data["errorVectors"]) >= 5
