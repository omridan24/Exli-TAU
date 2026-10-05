# Groups — Phase 2 Plan: Groups UI, Group Creation & Split Rules

> Planning only, nothing here is built yet.
> Builds on [01-backend-db-plan.md](01-backend-db-plan.md) (Phase 1 backend: groups, invites, membership, already implemented).

## 0. Scope & phase numbering

Plan 01 used "Phase 2" to mean "expenses & splits". The phases are now:

| Phase | What |
|---|---|
| **1** ✅ | Backend: groups, invite links, approvals, membership. |
| **2** (this doc) | The Groups UI (dashboard card → groups page → group page), creating a group (type, name, picture, description), the **split rules** system and its reusable **SplitPicker** popup, adding and viewing group expenses and balances, and the `/join/:token` page. Includes the backend pieces those need: split rules, split engine, expenses, balances, and pictures. |
| **3** | "Move this expense to *Our trip to Tokyo*" from personal expenses, reusing the same SplitPicker. |

Settle-up ("A paid B back") is listed as an optional stretch at the end of Phase 2 (§11, step 13) and is not being built in this pass.

---

## 1. Screens (UX map)

```
Dashboard
 └─ [Groups] card  (replaces the "Partnership / Coming soon" placeholder)
     └─ Groups page ─────────────────────────────────────────────
          ├─ a card per group: cover/emoji, name, type chip, member avatars,
          │    "you're owed ₪240" / "you owe ₪80" / "all settled ✓",
          │    admin badge: "2 requests waiting"
          ├─ [+ New group] card (dashed outline, like an empty slot)
          │     └─ Create Group wizard (modal, 3 steps)
          │          1. Type     (Partner / Household / Trip / Friends / Other)
          │          2. Details  (name, picture, short description, currency)
          │          3. Splits   → SplitPicker in "configure" mode
          └─ Group page ──────────────────────────────────────────
               header: cover, name, type, members, [Invite] [⚙ Settings (admin)]
               balance summary card ("You're owed ₪240")
               tabs: Expenses | Balances | Members
               [+ Add expense]  → Expense form → SplitPicker in "apply" mode
               Settings (admin): details, split rules (SplitPicker "manage"),
                                 invite link, join requests, members & roles, delete (owner)

/join/:token ──→ Join page: group preview → "Ask to join" → pending state
```

**Style:** the same design language the app already uses. That means white `rounded-2xl` cards with `shadow-sm hover:shadow-md` and a colored `w-12 h-12 rounded-xl` icon tile, as on the dashboard (`App.jsx`). It means modals in the Wishlist style, and emoji-named presets plus draggable, lockable buckets in the Investments style (`AllocationBuckets.jsx`). Groups get **indigo** as their color, which the Partnership placeholder already used (`bg-indigo-100 text-indigo-600`, `Users` icon).

---

## 2. Group types

### Debate F: Which types?

| Option | Pros | Cons |
|---|---|---|
| **4 types** (Partner, Household, Trip, Friends) | Simple and covers most cases. | No home for "wedding gift fund", "office lunch", "event". Those get forced into Friends. |
| **4 + "Other"** | Nobody gets stuck. Other has neutral defaults. | One more tile. |
| **Many types** (Event, Work, Family, Sports team…) | Feels tailored. | Choice overload. Most types would share the same defaults anyway. |

**Recommendation: 4 + Other.** The type is **not cosmetic**. It drives:

| Type | Emoji / color | Built-in split rules (§3.2) | Default rule | Later hooks |
|---|---|---|---|---|
| 💑 **Partner** | pink | Equality First · I Love You But I'm Paying This One · **Split by Income** (§3.7) | Equality First | shared monthly budget |
| 🏠 **Household** | amber | Equality First · I Love You But I'm Paying This One · **Split by Income** (§3.7) | Equality First | Recurring expenses (rent, bills), like the personal recurring feature |
| ✈️ **Trip** | sky | Equality First · Family Pack · I Love You But I'm Paying This One | Equality First | Trip dates, multi-currency (the deferred currency work lands naturally here) |
| 🍻 **Friends** | emerald | Equality First · This Round's On Me · Your Treat | Equality First | "Who owes the most" leaderboard 😄 |
| ✨ **Other** | slate | Equality First · I Love You But I'm Paying This One | Equality First | none |

The type can be changed later in settings (admin). Changing it **doesn't** touch existing split rules. It only changes the icon and color and which later hooks apply.

### Debate G: Should "Partner" be capped at 2 members?
- **Hard cap of 2 (enforced in the backend):** a "partner" group with 3 people is almost certainly a mistake, and it lets partner-only features (income-based split, shared budget) assume exactly 2 people.
- **No cap:** more flexible, but partner-only features then need "what if there are 3" handling forever.

**Recommendation: hard cap of 2.** If a couple wants to add a roommate, they switch the type to Household, which has no cap.

---

## 3. Split rules (the heart of this phase)

### 3.1 Concepts
- A **split rule** is a named, reusable way to divide an expense, e.g. *"Equality First ⚖️"*.
- Each rule has a **kind**, meaning the math it uses, and optional **params**.
- Each group has 2–3 **built-in** rules chosen by its type. The admin can **edit** them (rename, change params, hide) and **create** new ones. There's a cap of 20 per group.
- Each group has one **default rule**, pre-selected when adding an expense.
- **"Pour It Yourself 🪣"** (the fully custom, bucket-based unequal split) is **always available** when adding an expense. It isn't a stored rule and can't be hidden. It's how you do a truly one-off uneven split.

### 3.2 Built-in catalog: fixed names per kind
The names stay fixed, as you asked. Each is an i18n key, so the Hebrew name is fixed too.

| Kind | Name | Emoji | What it does | Params |
|---|---|---|---|---|
| `equal` | **Equality First** | ⚖️ | Everyone selected pays the same. | `participants`: all (default) or a subset |
| `payer_covers` | **I Love You But I'm Paying This One** | ❤️ | The payer covers everything, so nobody owes anything. The expense still shows in group spending. | none |
| `others_cover` | **Your Treat** | 🎁 | The payer only fronted the money: everyone else splits it equally and the payer's own share is 0. Example: I paid for your concert ticket. | none |
| `payer_covers` (flavor) | **This Round's On Me** | 🍻 | Same math as `payer_covers`. It's a second fixed name that the Friends type uses instead. | none |
| `shares` | **Family Pack** | 👨‍👩‍👧 | Split by headcount weights, e.g. a couple = 2, a single = 1. | `weights{uid:int}` |
| `percent` | **Fair Share** | 📐 | Fixed percentages per member, e.g. 60/40. Set once with buckets and reused. | `weights{uid:int}` summing to 100 |
| `income_ratio` | **Split by Income** | 💼 | Proportional to each participant's net income, recomputed fresh every time — see §3.7. | none stored; computed live |
| `custom` | **Pour It Yourself** | 🪣 | Per-expense uneven split with buckets (₪ or %). Always available, never stored as a rule. | per expense |

Admin-created rules pick one of `equal` / `shares` / `percent` / `payer_covers` / `others_cover` and give it their own name and emoji. For example: *"Rent: 55/45 📐"* or *"Kids eat half 🧒"* (shares).

### Debate H: How do saved uneven rules survive members joining or leaving?
A `percent` rule like 60/40 is tied to specific people.

| Option | Behavior |
|---|---|
| **Store percentages** | Breaks the moment a 3rd person joins. Where does their share come from? You'd have to silently renormalize, which changes what people agreed to. |
| **Store integer weights and flag drift** | New members get weight 0 in existing member-specific rules, so they're excluded until the admin decides. Removed members' weights are dropped, and the rule is re-normalized over the remaining people when used. Either change sets `needsReview: true`, and the rule shows a "⚠ review" badge in the picker. |

**Recommendation: weights + `needsReview` flag.** Rules that don't depend on specific people (`equal`, `payer_covers`, `others_cover`) never drift.

### Debate I: Editing a rule: does it change past expenses?
- **Retroactive:** every expense references the rule live, so editing "Fair Share" from 60/40 to 50/50 rewrites history and every balance.
- **Forward-only:** each expense stores its **computed shares** and a **snapshot** of the rule (`splitRuleId`, `kind`, `params`) at the time. Editing a rule affects future expenses only.

**Recommendation: forward-only.** Money records shouldn't change under people's feet. The balances map (plan 01, Debate E) also only stays correct if old expenses are immutable except through an explicit edit. The rule editor says so: *"Changes apply to new expenses."*

### Debate J: Who can create and edit rules?
- **Admin only:** consistent with "admin changes things, everyone adds expenses" (your Phase 1 direction).
- **Everyone:** friendlier, but rules affect everyone's money.

**Recommendation: admin only for saved rules.** Any member can still use **Pour It Yourself** on their own expense for a one-off. The permissions map gets `split_rules.manage: {admin}`, which is a one-line change later if you want members to have it.

### 3.3 Data model (on the group doc)
Embedded, following the same reasoning as Debate C: small, always needed with the group, one read.
```
groups/{groupId}
  type:              "partner" | "household" | "trip" | "friends" | "other"
  imageUrl:          string | null                 # §7
  splitRules: [                                    # ≤ 20, ordered = display order
    {
      id:          "eq" | "<random>",              # built-ins get stable ids
      builtIn:     "equality_first" | null,        # catalog key → fixed i18n name when not renamed
      name:        string | null,                  # null = use the catalog's translated name
      emoji:       "⚖️",
      kind:        "equal" | "shares" | "percent" | "payer_covers" | "others_cover",
      params:      { participants?: [uid], weights?: {uid:int} },
      hidden:      bool,                           # built-ins can be hidden, not deleted
      needsReview: bool,                           # Debate H
      updatedAt, updatedBy
    }
  ]
  defaultSplitRuleId: "eq"
  # settings.defaultSplit from plan 01 is replaced by defaultSplitRuleId.
  # Safe to change: no production groups exist yet.
```

### 3.4 How a rule turns into money (split engine)
Input: `amountMinor` (int), `payerId`, the rule (or custom input), and the active members. Output: `shares{uid:int}`, where Σ shares == amountMinor. Balances then change by `+amount` for the payer and `−share` for each participant.

| Kind | Shares |
|---|---|
| `equal` | amount ÷ n participants |
| `shares` / `percent` | amount × weightᵢ ÷ Σweights |
| `payer_covers` | {payer: amount}, net effect 0 |
| `others_cover` | equal split among everyone **except** the payer |
| `custom` (amounts) | exactly what was entered. Must sum to the amount. |
| `custom` (%) | same as `percent`, one-off |

**Rounding:** use integer agorot and the largest-remainder method. Leftover agorot go **to the payer first**, then in stable uid order. The payer absorbs the rounding, so nobody else ever owes an extra agora. The algorithm is deterministic.

### Debate K: Split math on the client, the server, or both?
- **Server only:** the picker would call an endpoint on every drag. That's too slow and fails offline.
- **Client only:** the client is trusted with money math. No.
- **Both, same algorithm:** the client computes a live **preview** as you drag. The server **recomputes authoritatively** on save and ignores any client-sent shares. Both implementations run against one shared test-vector file (`docs/groups/split-test-vectors.json`), so they can't drift.

**Recommendation: both, with shared test vectors.**

### 3.5 Where rules come from at creation: an important catch
When a group is created, **only the creator is a member**. So member-specific rules (`percent`, `shares`) **can't be configured yet** because there's nobody to give weights to. The creation step therefore:
- lets you pick **which** built-ins are on, **rename** them, and choose the **default**;
- shows member-specific rules as *"✨ Set up once members join"* cards;
- when the 2nd member is approved, the admin gets a one-time nudge: *"Set up Fair Share for Dana & you?"*

### 3.6 A note on `needsReview` and `income_ratio`
Debate H's weight-drift problem is specific to **stored** weights (`percent`/`shares`). `income_ratio` stores nothing — it reads the group's *current* active participants and *their current income* fresh every time it's used, so a member joining or leaving never needs a review flag. This is one of the reasons it's a stronger default than a manually-set percentage: it never goes stale.

### 3.7 "Split by Income 💼" — built for real, this is the Exli-only advantage over Splitwise
Exli already knows each member's income (from the Income feature); no other split-expense app can offer this. You confirmed: built-in, editable like the others, and **the ratio must re-derive every month** as incomes change — never a one-time snapshot of weights.

**How the ratio is computed:**
1. Every `users/{uid}/income` document has a `month` field (`"YYYY-MM"`) and a `neto` (net) amount (confirmed in `OneTimeIncomeForm.jsx` / `RecurringIncomeForm.jsx`). A member can have several income docs in one month (multiple jobs); their month's net income is the **sum of `neto`** across all of that month's docs.
2. **Which month?** The **same** calendar month as the expense's date (changed from the original "last month's income" rule). An expense dated 2026-10-05 uses each participant's **2026-10** net income; a January expense uses that year's January income. This is what makes it "adapt per month" automatically, with zero admin action. If the month's income isn't entered yet, the group default falls back to an equal split (flagged `incomeFallback`) until it is.
3. **Shares** = `amount × netIncome[uid] / Σ netIncome` over the expense's participants, using the same largest-remainder rounding as every other kind (§3.4).
4. **If anyone required is missing that month's income**, the rule can't be used for that expense yet. The picker shows it as *"💼 Split by Income — waiting on Dana's September income"* instead of letting it be picked, rather than silently guessing or falling back to equal.

### Debate Q: How much of each other's income does this rule expose?
The whole feature is "use income to compute a fair split" — but *how much* should members see of each other's numbers?

| Option | What members see |
|---|---|
| **Show raw net income figures** | Simple, and a couple/household using this rule already shares finances closely, so full transparency may be welcome. But it permanently surfaces exact take-home pay to every member of the group, including future members if the group's type or membership changes. |
| **Show only the resulting ratio/percentage** (e.g. "You 68% · Dana 32%"), never the raw ₪ figures | Keeps the split fully transparent and auditable (anyone can see it's fair) without either person's exact pay becoming group-readable data. |

**Recommendation: ratio only.** The backend computes with real income figures (it has to — that's the whole point), but the API response, the picker's UI, and the amount snapshotted on the expense (`split.params.resolvedRatios: {uid: percent}`) all carry **percentages only**, never `netIncome` values. This also matches how the existing Firestore rules are already locked down (`users/{userId}/**` is only ever readable by that user; this feature is the one deliberate, narrow, server-mediated exception, and it stays need-to-know even there).

**Backend pieces this needs (all new):**
- `services/income_ratio_service.py`: `get_income_ratios(db, group, for_date) -> {ready, month, missingUids, ratios}`. Reads `users/{uid}/income` for every active participant via the Admin SDK (which is allowed to read across users — this is the justification for Debate A's "backend writes" model), filtered to `month == target_month`, summed per participant, turned into percentages. Never returns raw amounts to callers outside this module.
- `GET /groups/<gid>/income-ratio?date=YYYY-MM-DD` (defaults to today): lets the SplitPicker check readiness *before* the rule is selectable, so the "waiting on Dana" state can be shown live.
- Expense creation re-derives the ratio itself from the expense's own `date` — it never trusts a ratio the client sends — and 409s with a clear message if a participant's income is still missing.
- `income_ratio` is offered as an **addable** built-in for every group type (via the rule manager's "add a built-in you don't have yet"), and is **on by default** for Partner and Household, where it fits best.

---

## 4. The SplitPicker component (one popup, three places)

### 4.1 Modes
| Mode | Where | Amount known? | Members known? | What it does |
|---|---|---|---|---|
| `configure` | Create-group wizard, step 3 | no | only you | Toggle and rename built-ins, choose the default (§3.5). |
| `manage` | Group settings → Split rules (admin) | no | yes | Full editor: create, edit, hide, reorder rules; weights through buckets; resolve ⚠ review. |
| `apply` | Add/edit expense **and Phase 3** "Move to group" | yes | yes | Pick a rule, see per-person amounts live, or open **Pour It Yourself** buckets. Returns the split. |

```jsx
<SplitPicker
  mode="apply"                    // configure | manage | apply
  group={group}                   // members, splitRules, defaultSplitRuleId, currency, type
  amountMinor={12345}             // apply only
  payerId={uid}                   // apply only
  initialSelection={...}          // when editing an existing expense
  onConfirm={(split) => ...}      // apply → { splitRuleId|null, kind, params, previewShares }
  onRulesChange={(rules) => ...}  // configure/manage
  onClose={...}
/>
```
It lives in `features/groups/components/SplitPicker/`. It depends only on props and does no Firestore reads, so Phase 3 can open it from `ExpenseNode` / `YearDashboard` by passing a group the user chose.

### 4.2 Look (apply mode)
```
┌──────────────── How do we split ₪480? ───────────────┐
│  ⚖️ Equality First      ✓  default  │ you ₪240 · Dana ₪240
│  ❤️ I Love You But I'm Paying This… │ you ₪480 · Dana ₪0
│  🎁 Your Treat                       │ you ₪0   · Dana ₪480
│  📐 Fair Share (60/40)   ⚠ review    │ ...
│  ─────────────────────────────────────────────────────
│  🪣 Pour It Yourself  →  opens the buckets
│                                     [Cancel] [Split it]
└──────────────────────────────────────────────────────┘
```
Preset rows look like the investments preset cards (emoji + bold name + subtitle). Each row shows a live per-person preview.

### 4.3 "Pour It Yourself": the buckets
It works like `AllocationBuckets.jsx`. There's one vertical bucket per participant (avatar and name on top), filled with a gradient. You drag up or down to change it, **lock** a bucket to protect its value, and the others **auto-rebalance proportionally** among the unlocked buckets. A total check at the bottom shows `₪480 / ₪480 ✓`.

Additions for money:
- a **₪ / %** toggle, so you can fill by amount or by percent;
- **tap the number to type it exactly** (dragging alone is imprecise for money);
- a **participant toggle** under each bucket to exclude someone (their bucket greys out to 0);
- values are integer agorot internally. The total always matches exactly, because the rebalance puts the remainder on the last unlocked bucket.

The same bucket UI is the weight editor for `percent` / `shares` rules in `manage` mode.

### Debate L: Buckets don't fit many people
Groups can have up to 100 members, but vertical buckets fit about 6.
- **Always buckets, scroll horizontally:** consistent, but awful with 20 people.
- **Adaptive:** **buckets for ≤ 6 participants**. Above that, a **compact list**: one row per person with a mini horizontal bucket bar, the same drag/lock/rebalance behavior, and an amount field.

**Recommendation: adaptive.** Partner, Household, and most Trip groups get the fun bucket view. Big friend groups get something usable.

### Debate M: Reuse `AllocationBuckets` or build new?
`AllocationBuckets` has 3 hardcoded buckets (long/mid/short), percent-only rounding, and investment-specific UI (education banner, consequence modal).
- **Refactor it into a generic component now and migrate investments:** one source of truth, but it risks regressions in a shipped feature during a Groups PR.
- **Extract a generic core, leave investments untouched for now:** `components/buckets/Bucket.jsx` (visual + drag + lock) and `hooks/useBucketAllocation.js` (n buckets, lock, proportional rebalance, integer-exact). Groups use it right away. Migrating investments onto it is a separate small follow-up PR.

**Recommendation: extract the core now and migrate investments later.** The look stays identical because the Bucket visual is lifted from `AllocationBuckets`.

---

## 5. Group expenses (backend, part of this phase)
This follows plan 01 §8, updated with the rule decisions above.

```
groups/{groupId}/expenses/{expenseId}      # expenseId generated by the client → safe retries
  description, category (reuses personal categories), date
  amountMinor:   int
  currency:      group currency (single currency for now)
  paidBy:        uid                       # one payer in the Phase 2 UI (the model can extend to multi later)
  split: {                                 # snapshot, Debate I
    splitRuleId: "eq" | null,              # null = Pour It Yourself
    kind, params,
    resolvedRatios: { uid: percent } | null  # income_ratio only — ratio snapshot, never raw income (Debate Q)
  }
  shares:        { uid: int }              # computed by the server; Σ == amountMinor
  source:        "manual" | "personal_transfer"   # Phase 3 uses the second
  sourcePersonalExpenseId: null
  note, createdBy, createdAt, updatedAt, updatedBy
```

| Endpoint | Who | What |
|---|---|---|
| `POST /groups/<gid>/expenses` | member | Validate → compute shares → one transaction: write the expense + apply deltas to `balances` + update `updatedAt`. |
| `PATCH /groups/<gid>/expenses/<eid>` | creator or admin | Reverse the old deltas, apply the new ones, same transaction. |
| `DELETE /groups/<gid>/expenses/<eid>` | creator or admin | Reverse the deltas and hard delete (or soft delete, see §12). |
| `PUT /groups/<gid>/split-rules` | admin | Replace the rules array (validated: kinds, weights, cap of 20, ≥1 visible rule, default exists). |
| `PATCH /groups/<gid>` | admin | + `type`, `imageUrl`, `defaultSplitRuleId`. |
| `POST /groups/<gid>/image` | admin | Picture upload (§7). |
| `GET /groups/<gid>/income-ratio` | member | §3.7 Debate Q. Optional `?date=`. Returns readiness + ratios only, never raw income. |

Reads (expense list, balances) are **live `onSnapshot`** reads, as decided in Phase 1. Rules already allow members to read `expenses`.

Membership hooks (added to the Phase 1 service):
- **Approve member** → add `weight: 0` to member-specific rules and set `needsReview` (Debate H). Enforce the Partner cap (Debate G).
- **Remove/leave** → already blocked while balance ≠ 0. On success, drop their weights and set `needsReview`.

Balances UI: "who owes whom" is **simplified on read** from `balances` with a greedy min-transactions algorithm, so it's never stored (plan 01, §8).

---

## 6. Navigation

### Debate N: Add a router?
The app has **no router**. Pages are `activeNode` state in `App.jsx`. Groups needs nested pages (list → group) and a **real deep link** (`/join/:token` from WhatsApp).

| Option | Pros | Cons |
|---|---|---|
| **Add `react-router` now** | Real URLs, back button, shareable group links. | Touches every existing page and navigation call, so it's a large, unrelated refactor inside a Groups PR. |
| **Keep `activeNode` + in-node state + a tiny deep-link check** | Zero impact on existing pages. `GroupsNode` holds `selectedGroupId`. On boot, `App.jsx` reads `window.location.pathname`; for `/join/<token>` it stores the token in `sessionStorage` (so it survives the login redirect), opens the Join page, and cleans the URL. Firebase hosting already rewrites `**` → `index.html`, so the path reaches the app. | The browser back button leaves the app (true of every page today). No shareable per-group URL. |

**Recommendation: keep `activeNode` for now,** with the deep-link check for `/join/:token` only. A router migration is worth doing as its own app-wide PR later. Groups is built so that `selectedGroupId` maps 1:1 to a future `/groups/:id` route.

---

## 7. Group picture

### Debate O: How do pictures get stored?
| Option | Notes |
|---|---|
| **A. Emoji + type color only** | Zero infra, instant. Covers most cases. |
| **B. Upload directly from the client to Firebase Storage** | Fast. Needs `storage.rules` that check group admin through a cross-service `firestore.get()`, plus a new rules file to maintain. Firebase Storage isn't used anywhere in the app yet. |
| **C. Upload through the backend** (`POST /groups/<gid>/image`) | Consistent with "backend writes". **Reuses `utils/security.validate_file_safety`** (magic-byte check, already used for uploads). The backend resizes to about 512px WebP, stores it in the default bucket at `groupImages/{gid}/{uuid}.webp`, and saves the public URL on the group. |

**Recommendation: A as the always-present fallback, with C for uploads.** Every group shows its type emoji over the type gradient until an image is uploaded. Needs: enabling the Storage bucket on `exli-24` (a one-time console click; I'll tell you exactly where) and adding `Pillow` for resizing.

---

## 8. Frontend architecture

```
exli-front/src/
  config/api.js                               # NEW authedFetch(): adds the Firebase ID token (needed by every groups endpoint)
  hooks/useBucketAllocation.js                # NEW n-bucket lock/rebalance logic (Debate M)
  components/buckets/Bucket.jsx               # NEW visual lifted from AllocationBuckets
  features/groups/
    GroupsNode.jsx                            # list page ↔ group page (selectedGroupId)
    JoinGroupPage.jsx                         # /join/:token flow
    hooks/useMyGroups.js                      # onSnapshot: memberIds array-contains uid, status == active
    hooks/useGroup.js                         # onSnapshot: group doc + expenses + (admin) joinRequests
    utils/splitEngine.js                      # client preview math (Debate K), tested with the shared vectors
    utils/groupTypes.js                       # type catalog: emoji, color, default rules
    utils/splitCatalog.js                     # built-in rule catalog: kind, emoji, i18n key
    components/
      GroupCard.jsx, NewGroupCard.jsx
      CreateGroupWizard/ (TypeStep, DetailsStep, SplitsStep)
      GroupHeader.jsx, BalanceSummary.jsx, ExpenseList.jsx, ExpenseForm.jsx,
      MembersPanel.jsx, JoinRequestsPanel.jsx, InviteLinkBar.jsx, GroupSettings.jsx
      SplitPicker/ (SplitPicker.jsx, RuleRow.jsx, PourItYourself.jsx, RuleEditor.jsx)
```
`App.jsx`: the Partnership placeholder `<div>` becomes a real `<button onClick={() => setActiveNode('groups')}>` card. It keeps the indigo `Users` tile and adds a small badge ("3 groups · 2 requests"). Then `{activeNode === 'groups' && <GroupsNode .../>}`, plus the `/join` boot check.

**Index needed:** `groups` composite index on `memberIds` (array-contains) + `updatedAt desc`. It goes in `exli-front/firestore.indexes.json`, which is referenced from `firebase.json`.

**i18n** (per `I18N_RULES.md`): every string goes in both `en` and `he`, with logical properties only (`ms-`/`me-`/`text-start`). The buckets row order flips correctly in RTL, as `AllocationBuckets` already does with `dir`.

---

## 9. Hebrew names of the fixed rules

### Debate P: Gendered Hebrew
"I love you but I'm paying this one" is gendered in Hebrew (אוהב/אוהבת, משלם/משלמת).
- **Slash forms** ("אני אוהב/ת אותך אבל את זה אני משלם/ת"): always correct, a bit clunky.
- **Gender-neutral rephrasing** ("אהבה זה אהבה, אבל את זה עליי ❤️"): reads naturally and needs no profile data.
- **Per-user gender:** would need a profile field that doesn't exist.

**Recommendation: neutral rephrasings.** Proposed Hebrew set, for you to approve:

| English | Hebrew |
|---|---|
| Equality First ⚖️ | שוויון קודם כל ⚖️ |
| I Love You But I'm Paying This One ❤️ | אהבה זה אהבה, אבל את זה עליי ❤️ |
| Your Treat 🎁 | הפעם זה עליך 🎁 |
| This Round's On Me 🍻 | הסיבוב הזה עליי 🍻 |
| Family Pack 👨‍👩‍👧 | חבילה משפחתית 👨‍👩‍👧 |
| Fair Share 📐 | חלוקה הוגנת 📐 |
| Pour It Yourself 🪣 | תמזגו בעצמכם 🪣 |
| Split by Income 💼 | לפי הכנסה 💼 |

---

## 10. Backend changes summary
- `groups_service.create_group`: + `type` (validated), `imageUrl`, seed `splitRules` + `defaultSplitRuleId` from the type template (`services/split_catalog.py`). Drop `settings.defaultSplit`.
- New `services/split_engine.py`: pure functions + tests against the shared vectors.
- New `services/income_ratio_service.py`: reads `users/{uid}/income` across the group's active participants (Admin SDK), returns ratios only (§3.7, Debate Q).
- New expense functions in `groups_service` (or `group_expenses_service.py` if the file gets big), all transactional with balance deltas; `income_ratio` expenses call `income_ratio_service` inside the same flow and 409 if not ready.
- Split-rules validation + `PUT /split-rules`. `GET /income-ratio` for picker readiness checks.
- Partner cap (2) in `create_join_request` + `approve_request`. Weights and `needsReview` maintenance on approve and remove (not needed for `income_ratio` — see §3.6).
- Image upload endpoint + `Pillow`.
- `PERMISSIONS` += `split_rules.manage: {admin}`, `expense.create: {admin, member}`, `expense.edit_any: {admin}`.

## 11. Implementation steps (one commit each)
1. ✅ `split_engine.py` + `splitEngine.js` + shared test vectors (both suites green — 21 pytest + 20 Node-script cases).
2. ✅ Split catalog + group types (backend + frontend constants) + i18n keys (en/he), including `income_ratio` (23 tests).
3. ✅ Backend: type, split rules on create, `PUT /split-rules`, Partner cap, weight maintenance on membership changes (28 tests).
4. ✅ Backend: `income_ratio_service.py` + `GET /income-ratio` + tests (12 tests).
5. ✅ Backend: expenses create/edit/delete with balance transactions + tests, incl. `income_ratio` expenses (26 tests).
   Backend total after step 5: **164 passing tests**, still against `tests/fake_firestore.py` (no real emulator in this dev environment — see plan 01 §6).
6. ✅ Backend: image upload endpoint (6 tests). Served via Firebase Storage's public download-URL format + `exli-front/storage.rules`, not GCS ACLs (that bucket has uniform bucket-level access, which breaks `make_public()`).
   Backend for Phase 2 is now **complete**: 170 passing tests.
7. ✅ Frontend foundation: `groupsApi.js` (authedFetch + every endpoint), `useMyGroups`/`useGroup`, the Firestore composite index, the dashboard Groups card (replaces the old Partnership placeholder).
8. ✅ Groups page: group cards + New Group card + a first Create Group modal (type, picture, name, description — no splits step yet) + a minimal group page (balance summary, join-request approval, members, invite link).
9. `Bucket` + `useBucketAllocation` (extracted core) + **SplitPicker** (all 3 modes, incl. the "waiting on X's income" state).
10. Create Group wizard (type → details → splits).
11. Group page: header, balance summary, expenses list, Add Expense with SplitPicker, Balances tab (simplified debts), Members tab.
12. Group settings (admin): details/picture, split rules manager, invite link, join requests, roles, delete. `/join/:token` page + deep-link boot.
13. *(Stretch)* Settle up: `settlements` subcollection + "Mark as paid".

## 12. Decisions (§12 questions resolved)
| # | Question | Decision |
|---|---|---|
| 1 | Group types & Partner cap | Confirmed: Partner / Household / Trip / Friends / Other, Partner capped at 2. |
| 2 | Rule names, incl. Hebrew | Confirmed as proposed, **plus** the new "Split by Income 💼" / "לפי הכנסה 💼" (§3.7, added per your feedback — this is the standout feature vs. Splitwise). |
| 3 | Who edits split rules | Confirmed: admin only. |
| 4 | Deleting an expense | **Soft delete**, chosen since the plan didn't lean either way: sets `deleted: true` + `deletedBy`/`deletedAt`, reverses its balance deltas, and disappears from the expense list, but the activity feed keeps a "Dana deleted an expense" line for dispute-friendliness. Simple to change to hard delete later since it's an additive field. |
| 5 | Settle up | Stays a Phase 2 **stretch** (step 13) — not built in this pass, per "don't go beyond the plan." |
| 6 | Firebase Storage for pictures | Confirmed. Enabling the bucket is a one-time step in the Firebase console (Build → Storage → Get started) — I'll point this out again when picture upload is actually implemented (step 6), since it needs your click, not mine. |
