# Groups — Backend & DB Implementation Plan (Phase 1: Group creation & membership)

> Scope: backend + Firestore only. No frontend in this phase.
> Goal of Phase 1: create a group, invite via link, admin approves, admin manages members/settings.
> The data model must already fit Phase 2 (shared expenses, splits, balances) so we don't migrate later.

---

## 0. What exists today (and what it means for groups)

| Today | Implication for Groups |
|---|---|
| All data lives under `users/{uid}/...` (expenses, income, wishlist, goals, history). | Groups are the **first data owned by several users**. They can't live under one user. They need their own top-level collection. |
| The frontend writes directly to Firestore (`setDoc`/`addDoc`). | Fine for private data. For shared data we need a single place that enforces who is allowed to do what. |
| Flask endpoints take `userId` from the body/URL and **don't verify it** (e.g. `POST /investments/goals`). | We can't do that for groups. Anyone could claim to be the admin. **Groups endpoints must verify the Firebase ID token.** |
| Access is gated by `whitelist/{email}`. | **Decided:** invitees must already be whitelisted. A non-whitelisted user can't request to join, same as today's app gate. This will be relaxed when Exli opens to the public. |
| Firestore security rules aren't in the repo. | We add `firestore.rules` to the repo as part of this work so group rules are versioned and reviewed. |
| `main.py` is ~1,400 lines. | Groups go in a Flask **Blueprint** + service module instead of making `main.py` bigger. |

---

## 1. Design decisions (the debates)

### Debate A: Who writes group data, the frontend or the backend?

| | **Option 1: Frontend writes directly + Security Rules** (current app pattern) | **Option 2: Backend API writes, frontend reads live** |
|---|---|---|
| How | React calls `setDoc` on `groups/...`; `firestore.rules` enforce roles. | React `onSnapshot` reads `groups/...`. All writes go through Flask endpoints that verify the ID token and use Firestore transactions. Rules deny client writes. |
| Speed | Instant, works offline. | One HTTP round trip. Cloud Run cold starts can add about 1–2s. |
| Integrity | Rules can't easily validate "splits sum to total", "balances stay at zero-sum", or "last admin can't leave". Complex rules get fragile quickly. | Business logic lives in Python, where it's testable. Multi-document changes run in one transaction. |
| Invite tokens | Hard. The client would need to read a token → group mapping, so the token has to be guessable or readable. | Natural. The token is checked server-side and never exposed through rules. |
| Future features (notifications, emails, AI split suggestions, recurring group expenses) | Would need Cloud Functions anyway. | Already where the logic lives (`email_service`, `ai_service`). |
| Consistency with codebase | Matches expenses/income. | Matches the investments/goals endpoints, but with proper auth. |

**Recommendation: Option 2 (backend writes, live frontend reads).**
Shared money data is where client-side trust breaks. Real-time reads through `onSnapshot` keep the UX live, and all mutations are validated in one place. The latency cost only hits *writes* (create group, approve, add expense), and those are fine with a spinner or optimistic UI.
*(A third option, Cloud Functions triggers, was rejected. It adds a new deploy target and runtime while Cloud Run already exists.)*

---

### Debate B: How does a user find "my groups"?

| | **Option 1: `memberIds` array on the group doc** | **Option 2: Mirror index `users/{uid}/groups/{groupId}`** |
|---|---|---|
| Query | `groups where memberIds array-contains uid`. One query, one source of truth. | Read the user's subcollection, then fetch each group. |
| Writes on join/leave | Update one doc. | Update the group **and** the user mirror, which must stay in sync. |
| Security rule | `request.auth.uid in resource.data.memberIds`. Simple and query-safe. | Must protect two places. |
| Per-user data (mute, pin, last seen, cached "my balance") | Doesn't fit here. | Fits naturally. |
| Limits | Group doc max 1 MB. Fine for Splitwise-sized groups (we cap at 100 members). | No limit. |

**Recommendation: Option 1 now.** Add a per-user `users/{uid}/groupPrefs/{groupId}` later **only** for personal preferences, never as the source of membership.

---

### Debate C: Members, embedded map or subcollection?

| | **Embedded `members` map in group doc** | **`groups/{id}/members/{uid}` subcollection** |
|---|---|---|
| Reads | Loading the group gives you all members, names, and roles (1 read). | N extra reads. |
| Rules | `resource.data.members[uid].role == 'admin'`. One lookup. | Needs `get()` calls in rules (they cost reads and are limited to 10 per request). |
| Scale | Fine up to about 100s of members. | Unlimited. |

**Recommendation: embedded map** (with a hard cap, e.g. `MAX_MEMBERS = 100`). Splitwise-style groups are small. If we ever need huge groups (communities), we migrate that feature separately.

**"Many groups" vs "big groups":** the number of groups doesn't affect this choice. Each group is its own document, and Firestore scales horizontally across documents (millions of groups cost nothing extra). What matters is:
- *Per-user group list:* one `array-contains` query, paginated. It's the same cost whether the platform has 10 or 10M groups, and it scales with how many groups *that user* is in.
- *A user in many groups* (e.g. 50): one query returns all 50 group docs, members included. With a subcollection, showing avatars on the list would cost 50 extra queries.

So the embedded map is **both easier and cheaper at many-groups scale**. The only thing it limits is members per group, and we're capping that anyway. **Decided: embedded map.**

---

### Debate D: Invite links, one reusable link per group or single-use invites?

| | **Reusable group link** (Splitwise/WhatsApp style) | **Single-use personal invite tokens** |
|---|---|---|
| UX | Admin copies one link and drops it in WhatsApp. | Admin has to generate a link per person. |
| Security | Link can leak, **but admin approval is required anyway**, so a leaked link only produces a join request. Admin can rotate/revoke. | Tighter, but approval already covers this. |
| Tracking | "Who requested" is tracked through join requests. | "Which invite was used" is tracked. |

**Recommendation: reusable link with rotation + optional expiry**, stored so that single-use tokens can be added later (`maxUses`, `uses` fields) with no schema change.

---

### Debate E: Balances (Phase 2, decided now because it shapes the schema), computed or stored?

| | **Compute on read** from all expenses | **Stored `balances` map, updated in the same transaction as each expense** |
|---|---|---|
| Correctness | Always right. | Can't drift, because it only changes inside the backend transaction. We also keep a rebuild endpoint. |
| Cost | Reads every expense each time the group opens. Grows forever. | O(1): the group doc already has it. |
| Needed for "can't remove member with open balance" | Expensive check. | Trivial check. |

**Recommendation: stored balances** (possible only because of Debate A → Option 2), plus a `POST /groups/{id}/rebuild-balances` admin/system endpoint as a safety net.

---

## 2. Firestore data model

```
groups/{groupId}
  name:            string (1–60)
  description:     string | null (≤ 280)
  emoji / imageUrl: string | null
  currency:        "ILS"                       # group default currency (ISO code, see services/currency_codes.py)
  ownerId:         uid                         # creator; can't be removed; transferable later
  memberIds:       [uid, ...]                  # ACTIVE members only, used for queries + rules
  members: {                                   # includes former members, so old expenses still show names
    "<uid>": {
      role:        "admin" | "member",
      status:      "active" | "left" | "removed",
      displayName: string,                     # snapshot from auth token at join
      photoURL:    string | null,
      email:       string,
      joinedAt:    timestamp,
      addedBy:     uid                         # who approved them
    }
  }
  settings: {
    defaultSplit:        "equal",              # Phase 2: equal | exact | percent | shares
    membersCanInvite:    false,                # can non-admins see/share the invite link?
    requireApproval:     true                  # always true for now; keeps the door open
  }
  balances:        { "<uid>": int }            # Phase 2. Minor units (agorot). Sum == 0 invariant.
  pendingRequestCount: int                     # denormalized for admin badge
  status:          "active"                    # "deleting" while a recursive delete is running
  version:         int                         # schema version for future migrations
  createdAt, updatedAt: timestamp

groups/{groupId}/joinRequests/{uid}            # doc id = requester uid → one request per user, no duplicates
  uid, displayName, photoURL, email
  inviteToken:     string                      # which link they used
  status:          "pending" | "approved" | "rejected" | "cancelled"
  requestedAt, decidedAt: timestamp
  decidedBy:       uid | null

groups/{groupId}/activity/{autoId}             # audit log / activity feed (like users/{uid}/history)
  type:            "GROUP_CREATED" | "MEMBER_JOINED" | "MEMBER_REMOVED" | "ROLE_CHANGED" | "SETTINGS_UPDATED" | "INVITE_ROTATED" | ...
  actorId:         uid
  targetId:        uid | null
  metadata:        map
  createdAt:       timestamp

groupInvites/{token}                            # TOP-LEVEL: token → group lookup is a single doc get
  groupId:         string
  createdBy:       uid
  createdAt:       timestamp
  expiresAt:       timestamp | null
  maxUses:         int | null                  # null = unlimited (reusable link)
  uses:            int
  revoked:         bool

# Phase 2 (not built now, listed to validate the model):
groups/{groupId}/expenses/{expenseId}          # expenseId is client-generated → idempotent retries
  description, category, date
  amountMinor:     int                         # never floats for money
  currency:        "ILS"
  paidBy:          { "<uid>": int }            # supports multiple payers
  splitType:       "equal" | "exact" | "percent" | "shares"
  splitInput:      map                         # what the user entered (percents/shares), for editing
  shares:          { "<uid>": int }            # server-computed owed amounts; sum == amountMinor
  createdBy, createdAt, updatedAt, deleted: bool
groups/{groupId}/settlements/{id}              # "A paid B back"
```

### Why these choices
- **Top-level `groups`** keeps shared data out of any single user's tree, so deleting or leaving a user never orphans a group.
- **Token as the doc ID** in `groupInvites`: 128-bit random `secrets.token_urlsafe(16)`. Lookup is O(1), it can't be guessed, and it's never listable by clients.
- **`joinRequests/{uid}`** as the doc ID makes "request twice" a no-op and makes "is this user already pending?" a single get.
- **Integer minor units** (`amountMinor`) avoid float rounding errors in splits. This is the #1 Splitwise-clone bug.
- **`members` keeps former members** (`status: removed`) while `memberIds` holds only active ones. Access is revoked immediately, and history still renders names.

### Indexes
- `groups`: `memberIds array-contains` + `updatedAt desc` (composite, for "my groups" sorted by recent activity).
- `joinRequests`: `status ==` + `requestedAt desc`.

---

## 3. Security rules (new `firestore.rules`, in the repo)

```
function signedIn() { return request.auth != null; }
function isMember(g) { return signedIn() && request.auth.uid in g.data.memberIds; }
function isAdmin(g)  { return isMember(g) && g.data.members[request.auth.uid].role == 'admin'; }
function group(gid)  { return get(/databases/$(database)/documents/groups/$(gid)); }

match /groups/{gid} {
  allow read: if isMember(resource);
  allow write: if false;                                   // backend only (Admin SDK bypasses rules)

  match /joinRequests/{uid} {
    allow read: if isAdmin(group(gid)) || (signedIn() && request.auth.uid == uid);
    allow write: if false;
  }
  match /{sub=**} {                                        // activity, expenses, settlements
    allow read: if isMember(group(gid));
    allow write: if false;
  }
}
match /groupInvites/{token} { allow read, write: if false; }
```

**Done:** the live console rules were fetched and merged into [`exli-front/firestore.rules`](../../exli-front/firestore.rules), with the existing rules kept as-is and the groups rules added. `firebase.json` now points to that file, so it's the source of truth. Note: `joinRequests` is deliberately excluded from the generic subcollection match, because rules are OR'd and a wildcard would otherwise let any member read requests.

---

## 4. Backend architecture

```
exli-backend/
  extensions.py                  # NEW: shared `limiter` instance (avoids a routes/groups.py ↔ main.py circular import)
  utils/auth.py                  # NEW: @require_auth / @require_whitelisted decorators (Firebase ID token → g.uid, g.email, ...)
  services/groups_service.py     # NEW: pure business logic + Firestore transactions, no Flask imports
  routes/__init__.py             # NEW
  routes/groups.py               # NEW: Flask Blueprint, thin HTTP layer: parse → call service → jsonify
  main.py                        # + app.register_blueprint(groups_bp), limiter.init_app(app)
  tests/fake_firestore.py        # NEW: in-memory Firestore stand-in (no local Java runtime here for the real emulator)
  tests/test_groups_service.py   # NEW: pytest, 55 tests against fake_firestore
  tests/test_auth.py             # NEW: pytest, 6 tests with a mocked verify_id_token
  requirements-dev.txt           # NEW: requirements.txt + pytest, for local test runs only
```

### 4.1 Auth (`utils/auth.py`)
- Add `firebase-admin` to `requirements.txt`. On Cloud Run it uses the default service account (same as `firestore.Client()` today).
- `@require_auth`: reads `Authorization: Bearer <idToken>`, runs `auth.verify_id_token()`, and sets `g.uid`, `g.email`, `g.name`, `g.picture`. Returns 401 on failure.
- `@require_whitelisted` (stacked on `@require_auth`) checks `whitelist/{email}` and returns **403 `NOT_WHITELISTED`** if missing. Results are cached in memory for a few minutes. It's used on every group endpoint *except* the invite preview, so the join page can show "you need access to Exli first" instead of a generic error.
- The frontend gets a small `authedFetch()` helper (`await auth.currentUser.getIdToken()`). This is the only frontend change, and it comes in the frontend phase.
- Bonus: we can later retrofit the unauthenticated `/investments/*` endpoints with the same decorator.

### 4.2 Service layer (`services/groups_service.py`)
Pure functions that take `db` and `actor_uid`, raise typed errors (`NotFound`, `Forbidden`, `Conflict`, `ValidationError`), and let the blueprint map them to 404/403/409/400. All multi-document changes run in `@firestore.transactional`.

Central permission helper, so new permissions later are a one-line change. As built (`services/groups_service.py`), `ensure_permission()` covers the roles stored in `members{}` (admin/member); `ensure_owner()` is a separate, explicit check for creator-only actions (delete), since "owner" isn't a `members{}` role — the owner's role there is still `admin`:
```python
PERMISSIONS = {
    "group.update":        {"admin"},
    "invite.manage":       {"admin"},
    "invite.view":         {"admin"},          # + "member" if settings.membersCanInvite
    "request.decide":      {"admin"},
    "member.remove":       {"admin"},
    "member.role":         {"admin"},
    # Phase 2 adds "expense.create" / "expense.edit_any" the same way.
}
def ensure_permission(group, uid, action): ...   # for admin/member roles
def ensure_owner(group, uid): ...                # for owner-only actions (e.g. delete)
```

### 4.3 Endpoints (Phase 1)
All require auth. Reads mostly happen on the client through `onSnapshot`. The GET endpoints below are for things rules intentionally hide.

| Method & path | Who | What |
|---|---|---|
| `POST /groups` | any user | Create group. Creator = owner + admin. Returns `groupId`. Writes an activity entry. |
| `PATCH /groups/<gid>` | admin | Update name, description, emoji, currency, settings. |
| `DELETE /groups/<gid>` | owner (creator) | **Hard delete** of the group and all subcollections (expenses, requests, activity) plus its invite tokens. Personal expenses that were transferred into the group stay in each member's personal data, with their link to the group cleared. Status is set to `deleting` first, so members see it disappear immediately, then a recursive delete runs (`db.recursive_delete`). |
| `POST /groups/<gid>/invite` | admin* | Create the invite link, or return the active one. |
| `POST /groups/<gid>/invite/rotate` | admin | Revoke the current token and issue a new one. |
| `DELETE /groups/<gid>/invite` | admin | Revoke; no active link. |
| `GET /invites/<token>` | any user | **Preview** for the join page: group name, emoji, member count, admin name, and your status (`none`/`pending`/`member`). No member list or money data. |
| `POST /invites/<token>/request` | any user | Create a join request (idempotent). 409 if already a member. |
| `DELETE /invites/<token>/request` | requester | Cancel own pending request. |
| `POST /groups/<gid>/requests/<uid>/approve` | admin | Transaction: request → approved; add to `members` + `memberIds`; `balances[uid]=0`; decrement pending count; add activity entry. |
| `POST /groups/<gid>/requests/<uid>/reject` | admin | Request → rejected. |
| `PATCH /groups/<gid>/members/<uid>` | admin | Change role (member ↔ admin). |
| `DELETE /groups/<gid>/members/<uid>` | admin, or self (= leave) | Set status to removed/left and drop from `memberIds`. **Guards:** owner can't be removed; the last admin can't leave; *(Phase 2)* balance must be 0. |

\* or a member, if `settings.membersCanInvite`.

### 4.4 Invite flow end to end
```
Admin ── POST /groups/g1/invite ──────────────► groupInvites/{token} created
Admin shares  https://exli-24.web.app/join/{token}
Invitee opens link → (login if needed) → GET /invites/{token}  → sees preview
Invitee taps "Ask to join" → POST /invites/{token}/request → groups/g1/joinRequests/{uid} = pending
Admin (live via onSnapshot on joinRequests) → POST .../requests/{uid}/approve
Invitee's "my groups" query (memberIds array-contains uid) picks up g1 automatically, live.
```
Validation on request: **user is whitelisted** (403 `NOT_WHITELISTED` otherwise), token exists, not revoked, not expired, `uses < maxUses`, group active, group not full, and user not already an active member or already pending. A previously-`removed`/`left` user can request again like anyone else — their old `members{}` entry is simply overwritten with a fresh `active` one on approval.

### 4.5 Rate limiting
Reuse `flask-limiter`: `/invites/<token>*` endpoints get a strict per-IP limit (e.g. `30/minute`) to block token brute-forcing, although 128-bit tokens already make that infeasible.

---

## 5. Implementation steps (each = one commit)

1. ✅ **Plan doc** (this file).
2. ✅ **Auth foundation:** `firebase-admin` dependency, `utils/auth.py` with `@require_auth` + `@require_whitelisted`, unit-tested with a mocked `verify_id_token` (`tests/test_auth.py`).
3. ✅ **Firestore rules:** `firestore.rules` + `firebase.json` entry (live rules merged in, published by the user).
4. ✅ **Service skeleton:** `services/groups_service.py` — errors, the permissions map, group create/update/delete.
5. ✅ **Invites:** create/rotate/revoke, preview (with `isWhitelisted`), and join request.
6. ✅ **Approvals & membership:** approve/reject, role change, remove/leave, all guards (owner protection, last-admin, non-zero balance).
7. ✅ **Blueprint:** `routes/groups.py`, registered in `main.py` (shared `extensions.py` limiter to avoid a circular import), rate limits on token endpoints.
8. ⬜ **Manual end-to-end check** against the dev Cloud Run (`deploy-backend-dev.yml`) using two real whitelisted accounts — not done yet; the Firestore emulator isn't available in this dev environment (no local Java runtime), so steps 4–7 are covered instead by `tests/test_groups_service.py` (55 tests) and `tests/test_auth.py` (6 tests) against `tests/fake_firestore.py`, an in-memory Firestore stand-in. See that file's docstring for exactly what it does and doesn't prove — it exercises the business logic (permissions, validation, transaction bodies) but not real Firestore transaction contention, so a manual check before shipping is still worthwhile.

### Running the tests
```
cd exli-backend
python -m venv venv          # if not already created
./venv/Scripts/pip install -r requirements-dev.txt
./venv/Scripts/pytest tests/ -q
```

Then: frontend phase (group list, create modal, `/join/:token` page, admin requests panel). After that: Phase 2 (expenses & splits).

---

## 6. Testing
- **As built:** `tests/test_groups_service.py` + `tests/test_auth.py` against `tests/fake_firestore.py`, an in-memory Firestore stand-in (see §5 step 8 for why: no local Java runtime here for the real emulator). The service layer takes `db` as a parameter specifically so it can run against either. 61 tests total, covering: permission checks per role, validation, invite-token validity (revoked/expired/exhausted), full CRUD + invite + join-request + approve/reject + role-change + remove/leave flows, and the guard rails (owner can't be removed, last admin can't leave/be demoted, non-zero balance blocks removal, a full group is rejected, a decided request can't be re-decided).
- **Before shipping:** swap in the real **Firestore emulator** (`firebase emulators:start --only firestore`, needs a local JRE) to additionally catch real transaction contention (e.g. two admins approving the same request at the same instant) that a non-concurrent fake can't reproduce, and optionally a rules unit test with `@firebase/rules-unit-testing` for the `joinRequests` read-scoping.

---

## 7. Scalability notes
- **Group doc size:** 100 members × ~300 bytes is about 30 KB, far below 1 MB.
- **Hot doc:** Firestore handles about 1 sustained write/sec per doc. The group doc is written on expense add (balances). Human-paced group activity is far below this.
- **Expenses** live in a subcollection with pagination, so they grow without limit.
- **`version` field** on groups allows lazy migrations.
- **Permissions map** means new roles or rights (e.g. "treasurer", "viewer") don't touch the rest of the logic.

---

## 8. Phase 2 preview (to confirm the model fits, not built now)
- Split engine in `services/split_service.py`: equal/exact/percent/shares → `shares{uid:int}`, deterministic remainder distribution (largest-remainder method, stable order by uid).
- Expense create/edit/delete runs in one transaction with the `balances` update.
- "Simplify debts" (min-cash-flow) is computed on read from `balances`, so it's never stored.
- **Two ways to create a group expense (decided):**
  1. **Directly in the group page:** `POST /groups/<gid>/expenses`.
  2. **Transfer from personal expenses** with one click (UX to be designed): `POST /groups/<gid>/expenses/from-personal` with `{personalExpenseId, splitType, ...}`. The backend reads `users/{uid}/expenses/{id}` (verifying it's the caller's) and creates the group expense with `source: "personal_transfer"`, `sourcePersonalExpenseId`, and `paidBy = caller`. It then marks the personal expense with `groupRef: {groupId, groupExpenseId}` so it can't be transferred twice and the UI can show a "shared in X" badge. Both writes happen in one transaction.
  - Schema impact now: group expenses reserve `source: "manual" | "personal_transfer"` and `sourcePersonalExpenseId`.

---

## 9. Decisions log
| Topic | Decision |
|---|---|
| Who writes group data | Backend writes, frontend reads live (Debate A). |
| Members storage | Embedded map (Debate C). Scales fine to many groups. |
| Whitelist | Invitees must already be whitelisted. Relaxed on public launch. |
| Deleting groups | Only the creator (owner) can delete a group. Hard delete. |
| Group expenses | Created directly in the group **or** transferred from personal expenses (Phase 2). |
| Firestore rules | Versioned in `exli-front/firestore.rules`, published live by the user. |
| Multiple admins | Confirmed: the owner can promote other members to admin (`PATCH /groups/<gid>/members/<uid>`). |
| Currency | Confirmed: one currency per group for Phase 1; multi-currency is an intentionally deferred, additive change. |
| Group size cap | Confirmed: `MAX_MEMBERS = 100`. |

### Still open
1. **Deleting with open balances (Phase 2):** `delete_group` currently has no balance check (Phase 1 has no expenses yet, so it's moot today). Once expenses exist: block deletion until everyone's settled, or allow it with a warning?
