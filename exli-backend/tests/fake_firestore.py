"""
Minimal in-memory fake of the google-cloud-firestore client — just enough surface
area to unit-test services/groups_service.py without a live Firestore, or the
Firestore emulator (which needs a local Java runtime that isn't available in this
dev environment; see docs/groups/01-backend-db-plan.md §6/§8 for the follow-up).

Supports: collection()/document()/add(), get/set/update/delete, `where(field, '==',
value)`, `stream()`, `recursive_delete()`, and the SERVER_TIMESTAMP / DELETE_FIELD /
Increment / ArrayUnion / ArrayRemove sentinels used by groups_service.py.

NOT a real transaction: FakeTransaction applies writes immediately instead of
batching-then-committing. That's fine here because the tests call a transactional
function's *undecorated* body directly (via `svc._some_txn.to_wrap(fake_txn, ...)`),
not `firestore.transactional`'s retry/commit machinery, which needs a live backend.
"""
import uuid
from google.cloud.firestore_v1.transforms import Increment, ArrayUnion, ArrayRemove, Sentinel, DELETE_FIELD


def _apply_value(current, value):
    if isinstance(value, Increment):
        return (current or 0) + value._value
    if isinstance(value, ArrayUnion):
        base = list(current or [])
        for v in value._values:
            if v not in base:
                base.append(v)
        return base
    if isinstance(value, ArrayRemove):
        base = list(current or [])
        return [v for v in base if v not in value._values]
    if isinstance(value, Sentinel):
        return "FAKE_SERVER_TIMESTAMP"
    return value


def _set_dotted(doc, dotted_key, value):
    # DELETE_FIELD is also a plain Sentinel (same class as SERVER_TIMESTAMP,
    # distinguished only by identity) - it must remove the key, not be
    # assigned as a value, so it's handled before _apply_value's generic
    # Sentinel case would otherwise turn it into a fake timestamp.
    parts = dotted_key.split(".")
    node = doc
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    if value is DELETE_FIELD:
        node.pop(parts[-1], None)
    else:
        node[parts[-1]] = _apply_value(node.get(parts[-1]), value)


class FakeSnapshot:
    def __init__(self, ref, data):
        self.reference = ref
        self.id = ref.id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeDocumentRef:
    def __init__(self, store, path, doc_id):
        self._store = store
        self._path = path
        self.id = doc_id

    def _key(self):
        return (self._path, self.id)

    def get(self, transaction=None):
        return FakeSnapshot(self, self._store.get(self._key()))

    def set(self, data, merge=False):
        key = self._key()
        if merge and self._store.get(key):
            merged = dict(self._store[key])
            merged.update(data)
            self._store[key] = merged
        else:
            self._store[key] = dict(data)

    def update(self, data):
        key = self._key()
        if not self._store.get(key):
            raise KeyError(f"No document to update at {key}")
        doc = self._store[key]
        for dotted_key, value in data.items():
            _set_dotted(doc, dotted_key, value)

    def delete(self):
        self._store.pop(self._key(), None)

    def collection(self, name):
        return FakeCollectionRef(self._store, f"{self._path}/{self.id}/{name}")


class FakeCollectionRef:
    """Doubles as both a collection and a query, like the real SDK."""

    def __init__(self, store, path, filters=None, limit_n=None):
        self._store = store
        self._path = path
        self._filters = filters or []
        self._limit_n = limit_n

    def document(self, doc_id=None):
        return FakeDocumentRef(self._store, self._path, doc_id or uuid.uuid4().hex)

    def add(self, data):
        ref = self.document()
        ref.set(data)
        return (None, ref)

    def where(self, field, op, value):
        assert op == "==", "FakeFirestore only supports '==' filters"
        return FakeCollectionRef(self._store, self._path, self._filters + [(field, value)], self._limit_n)

    def limit(self, n):
        return FakeCollectionRef(self._store, self._path, self._filters, n)

    def stream(self):
        results = []
        for (path, doc_id), data in list(self._store.items()):
            if path != self._path or data is None:
                continue
            if all(data.get(f) == v for f, v in self._filters):
                results.append(FakeSnapshot(FakeDocumentRef(self._store, path, doc_id), data))
        return results[: self._limit_n] if self._limit_n else results


class FakeTransaction:
    """
    Applies writes immediately rather than batching-then-committing. Also exposes the
    private attrs/methods `firestore.transactional`'s real `_Transactional.__call__`
    needs (`_read_only`, `_max_attempts`, `_id`, `_begin`/`_commit`/`_rollback`/
    `_clean_up`), as no-ops, so BOTH calling styles work in tests:
      - the decorated public function (e.g. `svc.approve_request(...)`), and
      - the undecorated body directly (`svc._approve_request_txn.to_wrap(...)`).
    """

    _read_only = False
    _max_attempts = 1
    _id = b"fake-transaction-id"

    def _clean_up(self):
        pass

    def _begin(self, retry_id=None):
        pass

    def _commit(self):
        pass

    def _rollback(self):
        pass

    def set(self, ref, data):
        ref.set(data)

    def update(self, ref, data):
        ref.update(data)


class FakeClient:
    def __init__(self):
        self._store = {}  # (collection_path, doc_id) -> dict | None

    def collection(self, name):
        return FakeCollectionRef(self._store, name)

    def transaction(self):
        return FakeTransaction()

    def recursive_delete(self, reference):
        prefix = f"{reference._path}/{reference.id}/"
        for key in [
            k for k in self._store
            if (k[0] == reference._path and k[1] == reference.id) or k[0].startswith(prefix)
        ]:
            self._store.pop(key, None)
