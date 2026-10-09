# Foreign Exchange (FX) across Exli: Plan

Status: **Phases 0-3, 4, and 5 implemented, Phase 6 designed but explicitly not yet implemented** (`groups` merged into `main` 2026-09-30, `fx` has since merged `main` in to pick up that code). See §8 for the phase-by-phase breakdown and §11 for Phase 6's design. All decisions below are final except Decision H (§11.4, open).

Goal: any money amount in Exli (expense, income, wishlist item, group expense, investment) can be in any currency. Each user has a **default currency**. When an amount is in a different currency, Exli **offers to convert it** at the **real historical rate on the day of the transaction**, or it can be kept in its original currency. In Groups, the group decides: keep every currency separate, or merge everything into one. Rates come from TwelveData. For example, $100 spent on 2025-08-20 converts at that day's rate of about 3.40, so it becomes about ₪340.

## ✅ Decided (2026-09-26)

| # | Question | Decision |
|---|---|---|
| **A** | Where do rates come from? | **TwelveData only.** It's the single point of contact for all market data (§2) |
| **B** | Convert when displayed, or save the rate on each record? | Unconverted records are converted when displayed (historical rates never change, so the result is stable). A record the user **chose to convert** keeps the rate it was converted at. Group expenses always lock their rate. A card statement's real charged amount always wins |
| **B2** | Groups | Groups choose between **keep original** (a separate balance per currency: "I owe you $20, you owe me €50") and **merge**, which converts everything to one group currency such as ₪ (§6) |
| **Rate date** | Which day's rate? | The **expense date's rate**. The **monthly average** is used when a record only has a month, no exact date |
| **D** | Income in a foreign currency | If income is in a currency other than the user's default, **offer to convert it at the pay date's rate** |
| **G** | The general rule | Every user has a **default currency** in Settings. Anywhere in the platform, when an amount is in a different currency, **Exli offers to convert it** to the default. Groups are the exception: there it's the group's setting, not the user's (§4) |

| **C** | A group switches keep original → merge after it already has expenses | New expenses only. A **"Merge history"** button converts the old balances at the **average of the rates on the expenses' dates**, with the explanation shown before confirming ([§6](#decision-c-switching-group-mode-after-expenses-exist)) |
| **E** | Branching | The nightly-job fix gets its own branch and PR off `main`. FX goes on an `fx` branch, and the groups part comes after `groups` merges ([§8](#decision-e-branching)) |
| **F** | Default behavior on a foreign amount | **Ask every time**: "$100 ≈ ₪340 on that date. Convert to ₪ or keep in $?", with a "remember my choice" checkbox that switches to always-convert or always-keep. Changeable in Settings ([§4.1](#41-what-the-offer-looks-like)) |

All open questions are now decided. Implementation starts with Phase 0 (§8).

---

## 0. Why the nightly ingestion is failing (diagnosis, 2026-09-26)

I checked the live Cloud Scheduler job, the Cloud Run logs and `_system/marketDataMeta`. There are **two separate problems**. One is new and one is old.

### 0.1 New (since 2026-09-24): stocks stop after about 67 seconds, every night

The logs from today's prod run (`exli-market-ingest-daily-prod`, 05:00 UTC):

```
Fetching K   ... 404 Not Found  -> No data for K
Fetching WBA ... 404 Not Found  -> No data for WBA
Fetching PXD ... 404 Not Found
Fetching HES ... 404 Not Found
Rate limit pause (65s)
Fetching CTRA ... 404, Fetching PEAK ... 404
6 consecutive failures, assuming provider is rate-limited. Stopping for today.
```

Result: `stocksSuccess: 0, currenciesSuccess: 0, rateLimited: true, durationSeconds: 67`. The same thing happened on 09-24, 09-25 and 09-26.

**Root cause.** Two changes landed together in PR #38 "Stocks" (e9bd471, 2026-09-23):
1. **Smart rotation** sorts symbols that have *never* been ingested to the very front (`"0000-00-00"`).
2. A **circuit breaker** stops the whole run after 6 consecutive "no data" results.

`symbol_lists.py` still includes six tickers TwelveData permanently 404s on. Confirmed live against the real API on 2026-09-26 (not just guessed from the ticker names): **WBA**, **PXD**, **HES** are genuinely invalid symbols now (WBA went private, PXD merged into XOM, HES merged into CVX), while **K**, **CTRA**, **PEAK** are actually still valid, ordinary tickers - TwelveData just gates them behind a higher-tier plan than this API key has ("This symbol is available starting with the Grow/Pro/Venture plan"). Either way the 404 is permanent for that symbol under our current plan, so they never get a Firestore doc. That means they are *always* "never ingested", so they are *always* first in line, and 6 of them in a row trip the breaker before any real symbol runs. It is a permanent jam, not a rate limit.

Fix (Phase 0):
- A 404 or "symbol not found" means a dead symbol, not rate limiting. Write a tombstone (`_system/deadSymbols` or `marketData/{sym}.status = "delisted"`), sort it last or skip it, and **don't count it toward the breaker**. Only real rate-limit signals should count: HTTP 429, or TwelveData's `"You have run out of API credits"` message. Today `_make_request` swallows those as `None`, so the provider needs to raise or return a typed error.
- Prune the delisted tickers from `symbol_lists.py`.

### 0.2 Old (since 2026-01-31): currencies have not updated in about 8 months

`currencyRates/USD_ILS` was last updated on **2026-01-31**, and its history ends on 2026-01-29 (`currentRate 3.109`). The ingestion runs **stocks first, then currencies**, with a 25-minute time budget. 407 symbols at 4 per 65 seconds takes about 110 minutes, so the budget always ran out before the currency loop started. FX got starved even before the new bug.

Fix: FX gets **its own job** (§2). It still uses TwelveData, but it runs **before** the stocks and never shares a loop or a time budget with them again.

### 0.3 Smaller problems found along the way

| Issue | Impact | Fix |
|---|---|---|
| Dev job `exli-market-ingest-daily` and prod job both fire at **05:00 UTC** against the **same Firestore DB and the same TwelveData key** | Both runs compete for the 8 calls/min quota and write the same docs | Disable the dev job or move it to a different hour with `?limit=` |
| `requests` exceptions print the full URL, **including `apikey=`**, into Cloud Run logs | The API key leaks into logs | Redact it in `_make_request` (log `e.response.status_code` plus the symbol, not `str(e)`) |
| Each symbol costs 2 credits (`time_series` + `quote`) | 407 × 2 = 814 is more than the free tier's 800 per day | Take the last close from `time_series` and drop `quote` on daily runs |
| Frontend falls back to hard-coded `{USD: 3.65, EUR: 4.05}` (`InvestmentNode.jsx:466`) | Silently wrong values | Replaced by the FX layer (§5) |

**Status: implemented** on the `fix-market-ingest` branch (2026-09-26) - typed provider errors, dead-symbol tombstoning in `_system/deadSymbols`, a breaker that only counts real rate-limit signals, API-key redaction, the six confirmed-dead tickers pruned from `symbol_lists.py`, and 25 unit tests. Still open (infra, not code): pausing the `exli-market-ingest-daily` (dev) Cloud Scheduler job, which needs an operator with scheduler-admin access.

---

## 1. What exists today (and why it isn't good enough)

- `config/constants.js`: `CURRENCIES = ["ILS","USD","EUR","GBP"]`. This is a 4-option `<select>` in ExpenseManualForm, ExpenseAutoReviewRow and WishlistModal.
- Every doc stores `amount` plus `currency` (default `'ILS'`). Nothing ever converts them.
- **Analytics sums mixed currencies as if they were one.** `AnalyticsNode.jsx:11` picks a "dominant currency" (whichever appears most often) and labels the naive sum with it. So $100 plus ₪100 shows as "₪200". This is a real correctness bug today.
- Wishlist shows a separate total per currency (`WishlistSummaryBar`). That is honest, but there's no single total.
- Income stores `currency` from `users/{uid}.preferredCurrency`. The Settings default is `'ILS'`, and nothing else reads that field.
- Groups store `group.currency` ("Phase 1: single currency per group"). All balances are in minor units of that currency.
- Investments use `/market/currencies` → `currentRate`, which is 8 months stale (§0.2).
- `currencyRates` is not readable from the client (only the Firestore catch-all rule applies), so everything goes through the backend.

---

## 2. FX data: TwelveData only, stored as year buckets

**Decision A: TwelveData is the only source**, so it stays the single point of contact for all market data. It's the same key and provider we already use. Other free sources (Bank of Israel, ECB/Frankfurter) were considered and rejected to keep one integration.

### 2.1 How we use TwelveData for FX

- **Everything is stored against USD.** For each supported currency X we fetch the one pair `USD/X` (USD/ILS, USD/EUR, USD/JPY, ...), and any pair is a cross through USD: `EUR→ILS = usd[ILS] / usd[EUR]`. Supporting N currencies costs N pairs, not N².
  - A few currencies are quoted the other way round on TwelveData (EUR/USD, GBP/USD, AUD/USD, NZD/USD). The provider tries `USD/X` first, falls back to `X/USD` and inverts it, and remembers which direction worked, in `_system/fxPairs`.
- **Rate used = the daily close.** That's the market mid at the end of the day. It's not the Bank of Israel's official rate, but it's usually within about 0.3%. Card statements beat it anyway (§3).
- **Credits:** about 45 currencies = **about 45 credits per day** (one `time_series` call per pair, no extra `quote` call, since the latest close *is* the current rate). That's roughly 6% of the free 800 per day.
  - The FX job runs **first each day**, so the stocks can't starve it again (§0.2).
  - At the 8 calls/min limit, 45 pairs take about 6 minutes.
- **Backfill:** `time_series` with `outputsize=5000` returns about 20 years of daily closes in **one call per pair**. A full backfill is about 45 credits and about 6 minutes.
- **Supported currencies:** the ones TwelveData actually returns data for. The backfill script checks each candidate from `currency_codes.py`, and the ones that work become the supported set, stored in `_system/fxPairs` and used by the currency picker (§5). The current 50-pair `CURRENCY_PAIRS` list is the starting candidate list.

TwelveData's history for USD/ILS hasn't been compared with a reference rate yet, so that comparison is part of the Phase 1 acceptance check (§9). For reference, the ECB puts 2025-08-20 at 3.4013 and the Bank of Israel at 3.400.

### 2.2 Storage: `fxRates/{YYYY}` year buckets

```
fxRates/2025 {
  year: 2025,
  days: {
    "2025-08-20": { ILS: 3.4013, EUR: 0.8583, JPY: 147.6, AED: 3.6725, ... },  // 1 USD = n X (daily close)
    ...
  },
  monthlyAvg: { "2025-08": { ILS: 3.41, EUR: 0.857, ... }, ... },   // precomputed, for month-only records
  updatedAt, source: "TwelveData"
}
fxRates/latest { date, rates: { ILS: ..., EUR: ... } }
```

Why year buckets:
- **1 read = a whole year** of rates. Converting a year of analytics costs one or two doc reads, not one per expense.
- Size is about 260 business days × about 45 numbers × 2 maps, roughly 25–40k values, well under the 1 MB doc limit.
- Past years never change, so the client can cache them forever (IndexedDB/localStorage with try/catch). Only the current year and `latest` need refreshing.

Firestore rules: `match /fxRates/{doc} { allow read: if request.auth != null; allow write: if false; }`. The client reads directly, and only the backend service account writes. Not added yet: `exli-front/firestore.rules` only exists on the still-unmerged `groups` branch, so this rule is queued for Phase 2 (when the client actually needs to read `fxRates`) rather than risking a rules file that drifts between two branches in the meantime. The backend ingestion job writes via the service account either way, unaffected by this.

The old `currencyRates/*` collection stays read-only until the investments code moves over, then it gets deleted.

### 2.3 Ingestion job: `POST /system/ingest-fx`

- A new scheduler job `exli-fx-ingest-daily` runs **at 04:30 UTC**, 30 minutes **before** the stocks job, so it always gets its credits first. Forex trades Sunday to Friday, so there's nothing new on Saturdays.
- Each run fetches the last 7 days for every pair (overlap makes missed days self-heal), merges them into `fxRates/{year}.days`, updates `monthlyAvg` for the months it touched, and updates `latest`. The job is idempotent, so reruns are harmless.
- The breaker only counts real rate-limit signals (429, "run out of API credits"), same as the §0.1 fix.
- **Backfill script** `scripts/backfill_fx.py --from 2015-01-01`: one `outputsize=5000` call per pair, writing one year doc at a time.
- An email report goes out through the existing `send_ingestion_report` pattern (its own `send_fx_ingestion_report`, same visual style). A **staleness alarm** fires if `latest.date` is more than 4 business days old. That would have caught §0.2 in February.
- Also production-only, same guard as `/system/ingest-market-data`: a request against the dev host is refused before touching Firestore or TwelveData.

**Status: implemented** on the `fx` branch (2026-09-26) - `services/fx_ingest_service.py` (direction detection cached in `_system/fxPairs`, year-bucket merge, monthly average, staleness check), the `POST /system/ingest-fx` route, `send_fx_ingestion_report`, `scripts/backfill_fx.py`, and 28 new unit tests (all against a fake Firestore client + a fake provider, no live credentials needed). The `deploy-backend.yml` prod workflow now also syncs this job's auth header on every deploy, matching the stock job's pattern.

**One manual step left**: the Cloud Scheduler job itself. `gcloud scheduler jobs create` needs an operator with `roles/cloudscheduler.admin` (blocked here by sandbox permissions on shared cloud infra, same as pausing the dev stock job in the prior PR) - run once:

```bash
SERVICE_URL=$(gcloud run services describe exli-processor \
  --region europe-central2 --project exli-24 --format 'value(status.url)')

gcloud scheduler jobs create http exli-fx-ingest-daily \
  --project exli-24 \
  --location europe-central2 \
  --schedule "30 4 * * *" \
  --time-zone "Etc/UTC" \
  --uri "${SERVICE_URL}/system/ingest-fx" \
  --http-method POST \
  --headers "X-System-Key=${SYSTEM_API_KEY},Content-Type=application/json" \
  --attempt-deadline 1800s \
  --max-retry-attempts 3
```

(`SYSTEM_API_KEY` here is the same value already used for the stock job - pull it from wherever that's kept, e.g. the GitHub Actions secret; never commit it.) After this exists, `deploy-backend.yml`'s new "Sync FX ingestion scheduler auth header" step keeps its header current on every future deploy, same as the stock job's.

Also still open from Phase 0: pausing the redundant `exli-market-ingest-daily` dev scheduler job is now optional (the code refuses dev outright either way) - do it if you want to stop it wasting a Cloud Run cold-start every night.

---

## 3. The conversion engine (one function, two languages)

Following the split-engine pattern from Groups: `services/fx_engine.py` and `src/lib/fx/fxEngine.js` are checked against shared `docs/fx/fx-test-vectors.json` (`npm run verify:fx-vectors`).

```
convert({ amount, from, to, date | month }, table) ->
  { value, rate, rateDate, basis: "day" | "monthlyAvg" | "latest", approximate: bool, reason? }
```

Rules:
1. `from == to` gives rate 1.
2. **Rate date (decided)**: use the rate on the record's **exact date**. If there's no rate that day (Saturday or a holiday), use the **previous available day, up to 7 days back**, and set `approximate: true`. A Saturday purchase gets Friday's close.
3. A record with **only a month** (for example, monthly income without a pay date) uses that month's **average rate** (`monthlyAvg`).
4. A future date, or today before the nightly job has run, uses `latest`.
5. Every pair is a cross through USD: `value = amount / usd[from] * usd[to]`.
6. No rate at all gives `{ value: null, reason: "unsupported" }`. The UI shows the original amount with a ⚠️, and the item is **excluded from totals with a visible count** ("2 items in XYZ not included"). It never gets silently summed.
7. Never round inside the engine. Round only at display, or when a record or group ledger commits the amount (§4, §6).
8. Minor units come from ISO 4217 (JPY 0, ILS 2, KWD 3...). A shared `currencyMeta` table covers minor units, symbol, flag and name in `en`/`he`, reusing `currency_codes.py`.

### Decision B: When the rate gets applied

Historical rates never change, so converting on display is fully deterministic. The same expense always converts to the same number.

- **Records kept in their original currency** (the user declined the conversion offer, §4) are converted **on display** with the rate from their date. Nothing extra is stored.
- **Records the user converted** are stored in the default currency and keep where they came from, so the conversion is traceable and reversible:
  `amount, currency` (now the default currency) + `original: { amount, currency }` + `fx: { rate, rateDate, basis, convertedAt }`.
  An "undo conversion" action restores the original.
- **Group expenses** always lock their rate (§6).
- **The card statement's real charged amount wins.** Credit card statements for foreign purchases often show *both* the original amount and the ILS actually billed, including card FX fees. When we have both, the doc stores `fx.source = "statement"` with the charged amount, and it **wins over the market rate**. It's the closest possible number to reality (Phase 5).

---

## 4. User settings and the "offer to convert" rule

**Decision G:** every user has a **default currency**. Anywhere in the platform (expenses, income, wishlist, recurring, imports), when an amount is in a different currency, **Exli offers to convert it** to the default. Groups are the exception: there the group's own setting decides (§6).

`users/{uid}.currencyPrefs`:

```
{
  defaultCurrency: "ILS",                            // migrates from existing preferredCurrency
  onForeignAmount: "ask" | "convert" | "keep",      // decision F: defaults to "ask"
  favoriteCurrencies: ["USD","EUR"]                  // top of the currency picker
}
```

### 4.1 What the offer looks like

It is **one reusable component**, `<ConvertOffer>`, used on every form and import screen. When the chosen currency ≠ the default:

```
+-----------------------------------------------------------+
| $100.00 on 20 Aug 2025 ≈ ₪340.13   (rate 3.4013)          |
| [ Convert to ₪ ]   [ Keep in $ ]   [ ] Remember my choice |
+-----------------------------------------------------------+
```

- **Convert** stores it in ₪ with `original` and `fx` kept (§3).
- **Keep** stores it in $. It is still converted on display for totals.
- **Remember my choice** sets `onForeignAmount` to `convert` or `keep`, so the offer stops appearing. It can be changed in Settings.
- **Bulk version for imports** (a statement with 30 USD rows): one banner, "30 transactions are in USD, convert all to ₪?", with the same three choices. It's not 30 prompts.
- **Existing foreign records** (already saved before this feature): the Settings currency section shows "You have 42 records in other currencies — review" and opens the same bulk offer.

### 4.2 Income (Decision D)

When income is in a currency other than the default, the offer uses the **pay date's rate**. If the income doc has no pay date, the offer asks for one ("When was this paid?", defaulting to the last business day of the month), and only if the user skips it does it fall back to the **monthly average**.

### 4.3 How amounts display

- Totals, charts and KPIs are **always in the default currency** (you can't sum $ + ₪). Records kept in foreign currency are converted for totals.
- Each foreign record shows its own amount, with a muted converted value next to it: `$100 · ≈ ₪340`.
- A converted record shows the default amount with a small ↔ icon.
- A tooltip or tap on any converted amount explains it: **"$100.00 on 20 Aug 2025 × 3.4013 = ₪340.13"**, plus "rate from Fri 19 Aug" when `approximate`, or "monthly average rate for Aug 2025".

Settings UI: a new "Currency" section in `SettingsNode` with the default-currency picker, the `onForeignAmount` choice, favorites, and the "review foreign records" entry point.

---

## 5. Reusable frontend building blocks

Everything lives in `src/lib/fx/`, so features only ever import these:

| Piece | What it does |
|---|---|
| `fxEngine.js` | The pure `convert()` (§3) |
| `fxRatesStore.js` | Loads and caches `fxRates/{year}` and `latest` on demand, deduping concurrent loads |
| `useCurrencyPrefs()` | Reads `users/{uid}.currencyPrefs` live |
| `CurrencyContext` | Provides `{ defaultCurrency, onForeignAmount }`, or the group's settings. **GroupPage wraps its subtree with the group's settings**, so every component below it (Money, ConvertOffer, pickers) follows the group without extra props |
| `useFx()` | `toDefault(money)`, `sum(moneys) -> { value, excluded[] }`, `convertRecord(record)`, `format(money)`. Loads the needed years automatically from the dates it sees |
| `<Money amount currency date [original] [fx] />` | **The single component that renders any amount**, including the tooltip. It replaces the scattered `{currency} {x.toLocaleString()}` |
| `<ConvertOffer>` / `<BulkConvertOffer>` | The offer from §4.1. In a group context it doesn't appear: the group setting decides instead |
| `<CurrencyPicker>` | Replaces the 4-item `<select>`. Searchable (code, name, Hebrew name, symbol), favorites and recent first, flags, and only currencies we have rates for |
| `CURRENCIES` constant | Replaced by `currencyMeta` from the supported set (§2.1) |

Backend mirror: `fx_service.convert(...)`, used by `income_ratio_service`, `group_expenses_service`, the AI import (bulk offer data) and email reports.

---

## 6. Groups

**Decision B2:** each group chooses how it handles currencies. This is a **group setting**, and members' personal default currencies don't apply inside the group.

`group.currencySettings` (replaces `group.currency`):

```
{ mode: "keep_original" | "merge", mergeCurrency: "ILS" }
```

Existing groups migrate to `{ mode: "merge", mergeCurrency: group.currency }`, which is exactly today's behavior. Admins edit it in GroupSettings. It's also offered as a step in CreateGroupModal (Trip groups default to `keep_original`, others to `merge`).

- **`keep_original`: every currency is its own balance.** Example: "I owe you $20, you owe me €50", and it stays that way.
  - The ledger is kept **per currency**: `balances[uid][currency]` in that currency's minor units.
  - The split engine runs unchanged, once per expense, in the expense's own currency.
  - `simplifyDebts` runs per currency. The balance view shows one line per currency.
  - A display-only "≈ ₪ total at today's rate" hint helps people see the overall picture without changing anything.
- **`merge`: everything is converted into the group currency** (for example ₪).
  - Expenses can be entered in any currency. On create, the backend converts at the **expense date's rate** and **locks** it on the expense: `original: { amountMinor, currency }, fx: { rate, rateDate }, amountMinor` (in `mergeCurrency`).
  - The split engine and balances run in group-currency minor units exactly as today.
- **Editing** an expense's date or currency recomputes the locked rate. Editing anything else keeps it.
- **Moving a personal expense into a group** (Phase 3 flow): in a `merge` group it's converted at its own date. In a `keep_original` group it keeps its currency. The personal expense's reduced `amount` stays in its own currency either way.
- **Split by Income** (`income_ratio`): each member's `neto` is converted to one currency (the merge currency, or the expense's currency in `keep_original`) before computing ratios, using that month's rate. Otherwise a USD earner and an ILS earner get compared as raw numbers.

### Decision C: Switching group mode after expenses exist

- The switch **applies to new expenses only**.
- Switching `merge → keep_original` just means new expenses keep their own currency. Existing ₪ balances stay as ₪ balances.
- Switching `keep_original → merge` offers a one-time **"Merge history"** button. It converts the outstanding balances of each currency into the merge currency **using average exchange rates, not today's rate**:
  - For each currency, the rate is the **amount-weighted average of the rates on the dates of the expenses in that currency** since the group last merged (or since it started). Bigger expenses count more.
  - This gives the same result as if each expense had been converted on its own date, so nobody gains or loses from when the button happens to be pressed.
  - The merge is recorded as a visible system entry in the group's history, so nobody's balance changes silently.
- **The explanation is shown before confirming, and kept in the history entry**, per currency. For example:

  > **Merging $ balances into ₪**
  > Your $ balances came from 6 expenses between 3 Aug and 20 Aug 2025 (total $540).
  > Average rate, weighted by amount: **1 $ = ₪3.41**. The daily rates in that period ranged from 3.38 to 3.44.
  > Dana: you owe $70 → **₪238.70**
  > Omri: owed $70 → **₪238.70**
  > [ Merge ] [ Cancel ]

- A currency with no rate data for some of those dates uses the nearest previous rate (§3 rule 2). The explanation notes "some rates are approximate".

---

## 7. Feature-by-feature rollout

| Feature | Rate date | Change |
|---|---|---|
| Expenses (manual form, AI import, auto-review) | transaction `date` | CurrencyPicker, `<ConvertOffer>` / bulk offer on import, `<Money>`, fix the `dominantCurrency` totals bug → `useFx().sum` |
| Analytics (Year dashboard, reports, trends) | each record's date (or stored conversion) | All KPIs and charts in the default currency. "N items excluded" chip when needed |
| Recurring expenses/income | each occurrence's date | Offer when the template is created in a foreign currency |
| Income (monthly docs) | **pay date**, else monthly average (§4.2) | Offer on save, asks for the pay date if missing |
| Wishlist | **latest** rate (it's a future purchase) | Offer on add. Summary bar: one total in the default currency plus the per-currency breakdown |
| Groups | expense date, locked (merge) / none (keep original) | §6 |
| Investments | latest for current value. Historical FX for "value in ₪ over time" charts (stretch) | Swap `/market/currencies` and the hard-coded fallback for `useFx`. Holdings stay in their trading currency (no offer, since a USD stock *is* in USD) |

---

## 8. Phases

| # | Scope | Branch |
|---|---|---|
| **0** | Fix ingestion (§0): dead-symbol tombstones, a breaker that counts only real rate limits, API-key redaction, dev-job schedule, drop the extra `quote` call. Tests with a fake provider | `fix-market-ingest` off `main` (ships fast, unrelated to groups) |
| **1** | ✅ **Implemented.** FX data layer on TwelveData: USD-pivot pairs + direction detection, `fxRates/{year}` + `monthlyAvg`, `/system/ingest-fx`, backfill script, staleness alarm. Firestore rule and the actual `gcloud scheduler jobs create` are the only pieces left (manual, see §2.3) | `fx` |
| **2** | ✅ **Implemented** (2026-09-26): engine (py + js + vectors), `currencyMeta` (py + js), `src/lib/fx` hooks (fxRatesStore, useCurrencyPrefs, CurrencyContext, useFx), `<Money>`, `<CurrencyPicker>`, `currencyPrefs` Settings tab, `<ConvertOffer>`/`<BulkConvertOffer>` | `fx` |
| **3** | ✅ **Implemented** (2026-09-26). The lifetime-stats AND yearly-report mixed-currency summing bugs (AnalyticsNode/StatsOverview/YearDashboard/AnalyticsReportsView - AnalyticsTrendsView needed no changes, audited); `<ConvertOffer>`/`<BulkConvertOffer>` wired into expenses (manual entry, AI import bulk offer, auto-review row), quick income entry (monthly average fallback, §4.2), recurring expense templates (today's rate), wishlist (latest rate, §7), investments (display + rate source swap, no offer needed - a stock's currency is its own, not foreign); "review foreign records" entry point in Settings. Also fixed along the way: OneTimeIncomeForm/RecurringIncomeForm's currency field was purely decorative - Israeli tax brackets ran on the raw entered number regardless of currency - now converts to the tax bracket's own currency BEFORE the marginal-tax math runs (user decision, 2026-09-26) | `fx` |
| **4** | ✅ **Implemented** (2026-10-04). `group.currencySettings` (`keep_original` / `merge`, with a lazy fallback to `{mode: "merge", mergeCurrency: group.currency}` for groups that predate this field — no Firestore migration write needed); `services/fx_service.py` (backend Firestore-reading mirror of the frontend's fxRatesStore + useFx); a `merge` group's foreign-currency expense converts and LOCKS its rate on create, reusing the locked rate on an edit that doesn't change currency/date (Decision B) and re-fetching when it does; a `keep_original` group never converts and keeps a separate ledger per currency in the new `balancesByCurrency` field (`BalancesList`/`MemberBucketsView` render one simplified-debt/buckets section per currency); `transfer_personal_expense` reads the personal expense's own `currency`; `income_ratio_service` converts each member's `neto` onto the expense's canonical currency before computing ratios; CreateGroupModal's wizard gained a currency-mode step (trip groups default to `keep_original`, everything else to `merge`) and GroupSettings can change it later (merge→keep_original always allowed; changing an active merge group's currency converts existing balances at today's rate; keep_original→merge is deliberately rejected with `MERGE_HISTORY_REQUIRED` until the §6 Decision-C "Merge history" flow below is built). 59 new/updated backend tests (fx_service, merge-mode locking, keep_original ledger, settings-patch, income-ratio currency normalization), all 320 backend tests pass, frontend builds and lints clean. **Not built in this pass**: the "Merge history" weighted-average flow itself (§6 Decision C) — switching a `keep_original` group back to one currency needs it; the groups-list `GroupCard`'s one-line balance preview still only reflects the flat (merge) balance, not a `keep_original` group's per-currency ones | `fx` |
| **5** (stretch) | ✅ **Implemented** (2026-09-26, user decision - built despite being optional): AI import (both the PDF line-item extractor and the CSV/Excel column mapper) now extracts a statement's own original + charged amounts when a row genuinely shows both; the charged figure wins over the market rate (`fx.source = "statement"`) and skips the bulk market-rate offer entirely for that row | `fx` |
| **6** | 📝 **Planned, not started** (user feedback 2026-09-30, see §11 for the full design - not to be implemented until reviewed): safer bulk-convert (confirm + visible progress) in Review Records; clearer copy under the ask/convert/keep setting; Analytics *and* `keep_original` Groups show a badge on kept-foreign records with an individual convert action and a bulk-convert action, reusing the same confirm+progress pattern | `fx` |

### Decision E: Branching

`groups` was not merged into `main` when this plan started, and Phase 4 touches groups code. So:
- Phase 0 (the ingestion fix) went on its own `fix-market-ingest` branch off `main` with its own PR.
- `fx` branched off `main` for Phases 1–3 and picked up Phase 4 once `groups` merged: `groups` merged into `main` 2026-09-30, and `fx` then merged `main` in (bringing the Groups feature onto `fx`) to unblock it.

---

## 9. Testing

- Backend pytest: the TwelveData FX provider (recorded fixture responses, including an inverted pair like EUR/USD), ingest merge/idempotency + `monthlyAvg`, `fx_engine` against vectors (weekend fallback, holiday, month-only, unsupported, JPY minor units, cross rates), convert/undo on records, group locked rates and the per-currency ledger (reuse `tests/fake_firestore.py`).
- Frontend: `verify:fx-vectors`, `<Money>` for converted/kept/group records, `<ConvertOffer>` remember-choice.
- Acceptance: TwelveData's USD/ILS history lines up with a reference (e.g. 2025-08-20 ≈ 3.40), and **$100 on 2025-08-20 shows ≈ ₪340** in expenses, analytics, a merge group (locked) and a keep-original group ($ line).

## 10. Decisions log

| # | Question | Decision |
|---|---|---|
| A | Rate sources | **TwelveData only**, a single point of contact (2026-09-26) |
| B | Compute vs lock | Kept-foreign records are converted on display. Converted records store `original` + `fx`. Group expenses lock the rate. The statement's charged amount wins (2026-09-26) |
| B2 | Group currency handling | Group setting: `keep_original` (per-currency balances) or `merge` into one currency (2026-09-26) |
| Rate date | Which rate | The expense date. The monthly average only for month-only records (2026-09-26) |
| D | Foreign-currency income | Offer to convert at the pay date's rate (2026-09-26) |
| G | Platform-wide rule | A default currency in Settings, and an offer to convert anything different. Groups follow the group setting (2026-09-26) |
| C | Group mode switch | New expenses only. "Merge history" converts per-currency balances at the **amount-weighted average of the expense-date rates**, with the explanation shown before confirming and kept in history (2026-09-26) |
| E | Branching | Phase 0 on its own branch/PR off main. `fx` off main, with the groups part after `groups` merges (2026-09-26) |
| F | Offer default | **Ask** every time, with a "remember my choice" option (2026-09-26) |
| F | Offer default | _open_ (recommend: `ask`, with "remember my choice") |
| H | What a `keep_original` group's expense is compared against to flag it "foreign" (§11.4) | _open_ (recommend: a group-level reference currency set once for display/flagging only - not a mode switch, doesn't touch `currencySettings`) |

---

## 11. Phase 6 (planned, not yet implemented): safer bulk-convert, clearer settings copy, after-the-fact conversion

**Status: SUPERSEDED (2026-10-09). The Phase 6 design below was replaced by a simpler model, implemented on `fx`:**
- Records always stay in the currency they were made in. The "when something is in a different currency" setting (ask / always convert / keep) and the "Review records in other currencies" tool are removed.
- One shared component, `components/ForeignCurrencyAlert.jsx`, marks any record not in the default currency (via `<Money>`: Analytics expenses and income, Wishlist, Recurring expenses, and keep_original group expenses). Clicking it opens a popup that explains the mismatch, shows the converted value and rate, and offers "Convert to X" or "Keep in Y".
- **Whose currency wins in a group:** the group's own setting, for everything shared (balances, splits, settlements). The personal default only drives personal screens, plus two conveniences inside groups: an "approximately X in my currency" hint under each group expense and the "All, in my currency" view on Other stats. In a `keep_original` group the alert marks only expenses that differ from the group's main currency (the one most expenses are in) and converts to that, creator or admin only; `merge` groups never show it.
- **Merge history (Decision C) is built, and merges the EXPENSES, not the balances** (2026-10-09): every expense and recorded payment not in the merge currency is converted in place (an expense at its own date's rate, a payment at the amount-weighted average rate of that currency's expenses, so debts already paid in the foreign currency stay paid), keeping `original` + `fx`; the group's balances are then re-derived from all the expenses and payments. `GET /groups/<id>/merge-preview` returns what will change (per-currency totals and rates, each expense before/after, resulting balances vs the stored ones) for the confirmation panel in Group settings; the switch `keep_original -> merge` sends `confirmMerge: true` after the admin confirms, and `POST /groups/<id>/consolidate-currency` does the same for a group already in merge mode that still holds foreign documents. Logged as `HISTORY_MERGED`.
- Personal records convert in place (`lib/fx/useConvertInPlace.js`, `convertRecordsInPlace.js`); group expenses convert through `POST /groups/<id>/expenses/<eid>/convert` (keep_original groups only; re-splits and moves the balance between currency ledgers).
- Changing the default currency in Settings opens `SwitchDefaultCurrencyModal`: it names the currency most records are in and offers to convert all, behind a second confirmation.
- Not built from the old design: chunked progress bar, blue row tint, bulk "convert selected" button. The month-scoped bulk convert already in Analytics remains.

Original design (kept for history):

Motivating feedback: running "Convert all to X" in Review Records left no way to tell whether it had finished - no confirmation before it ran, no progress while it ran, and only a small one-line result after. The three-way `onForeignAmount` setting works but doesn't explain itself. And neither Analytics nor a group's own expense list lets you look at an already-saved foreign-currency record and decide right there to convert it - today that's reachable only through the separate Settings tool.

### 11.1 Bulk-convert safety (Review Foreign Records)

Today: clicking "Convert all to {{currency}}" immediately fires one `writeBatch` covering every matching record in that currency, with no confirmation and no progress feedback beyond the button's own small spinner. For more than a handful of records there's no way to tell it's working versus stuck, and nothing to check if you navigate away and come back.

- **Confirm step.** Clicking "Convert all" no longer converts immediately - it shows a confirmation screen first: how many records, from which currency to which, using each record's own historical rate, with Confirm/Cancel.
- **Visible progress.** Replace the single atomic `writeBatch` with **small sequential chunks** (e.g. 10 records per batch) so a progress bar/counter can update as each chunk lands: "Converting 23 of 61...". A single all-or-nothing batch can't show partial progress; chunking trades strict atomicity (fine here - a currency's records are otherwise-unrelated line items, not one logical transaction) for the visibility the feedback is asking for.
- **Resumable for free.** Because each record's `fx` field marks it done, a chunked run that's interrupted (tab closed, network drop) leaves already-converted records converted and the rest untouched - reopening "Review records" picks up exactly where it left off, with no extra resume logic needed (this already falls out of the existing per-record `data.fx` check in `scan()`).
- **Explicit completion state.** A final screen states plainly "Converted 61 of 61" or "Converted 58 of 61 - 3 couldn't be converted (no rate available)", replacing the current one-line toast that's easy to miss once you've started moving on.
- **Guard against leaving mid-run.** While a chunked conversion is in flight, the modal's close button is disabled (or confirms first) instead of a silent walk-away that reintroduces the exact "did it work?" uncertainty this is meant to fix.

### 11.2 Clearer "when something is in a different currency" settings

Today the three-way toggle (Ask every time / Always convert / Always keep the original) has no explanation beyond its own label. Add one line under each option, phrased as what actually happens the next time something is saved:

- **Ask me every time**: "You'll be asked to convert or keep each time you save something in another currency."
- **Always convert**: "New records in another currency are converted automatically, using that day's real rate. No prompt."
- **Always keep the original**: "New records stay in their own currency. They're still shown converted everywhere, just never changed in storage."
- One shared closing note under all three: "This only affects new records - existing ones are never touched automatically. Use 'Review records in other currencies' below to convert what's already saved."

Copy-only change - `onForeignAmount`'s own behavior doesn't change.

### 11.3 Analytics: flag kept-foreign records and offer to convert them from the report itself

Today a kept-foreign expense displays via `<Money>` (converted for display, a hover explains the rate) but looks identical to a same-currency row - no color, no indicator, and the only way to actually convert it is the separate Settings tool. This mirrors the exact pattern already shipped for group-shared expenses (an orange row + a clickable badge that opens an actions popup - see `GroupedExpenseActionsModal`):

- **New visual state**, `isForeignKept = record.currency !== defaultCurrency && !record.fx` - exactly `ReviewForeignRecords`'s own filter, factored out into one shared helper so the two can't drift apart. Gets its own row tint/left-border color, distinct from suspect (red) / recurring (purple) / group-shared (orange) - blue is free.
- **Per-row badge**, "🌐 {{currency}}", clickable like the group-shared one - opens a small popup with two choices: "Convert to {{defaultCurrency}}" (that one record, at its own date - the same effect as accepting a `<ConvertOffer>` late) or "Keep in {{currency}}" (just closes - not a decision that needs recording anywhere).
- **Bulk action.** The multi-select bottom bar gets a new "Convert to {{defaultCurrency}}" button (parallel to the existing "Move to group"), enabled whenever any selected rows are `isForeignKept`, reusing the confirm+progress pattern from §11.1 rather than a second bespoke implementation.
- Applies the same way to the personal income table (it already has its own `currency` field and `<Money>` rendering).

### 11.4 Groups (folded into Phase 4's scope): the same, for `keep_original` groups

Applies only to **`keep_original`** groups - a `merge` group converts and locks every expense at entry, so there is never a "kept foreign" line to flag there.

- **Per-row badge** in a group's expense list (`GroupPage.jsx`/`ExpenseListItem.jsx`), same visual pattern as §11.3, for any group expense whose currency differs from [**Decision H, open** - see the log above].
- **Individual convert action** from that badge's popup: converts that one expense to the target currency at its own date's rate, re-splitting it in the new currency using the *same* split rule/shares it already has (the split ratios don't change - only the currency and the amounts they're computed against).
- **Bulk convert action**: select several of a `keep_original` group's expenses and convert them to one target currency, same chunked-with-progress approach as §11.1/§11.3.
- This is **narrower** than the existing "Merge history" button (Decision C, §6): "Merge history" changes the group's *mode* to `merge` and converts outstanding *balances* at a weighted-average rate. This new action converts individual *expenses* at each one's own date, without touching the group's mode. Both can coexist: this is the `keep_original` equivalent of what §11.3 does for personal Analytics, while "Merge history" stays the all-at-once mode-switch option for someone who wants to leave `keep_original` behind entirely.

### What's needed before implementation starts

1. Decision H (above): what a `keep_original` group's expense is compared against to be flagged foreign.
2. Confirm the chunk size for progress reporting (10 records suggested - large enough to be fast, small enough to feel responsive).
3. Confirm blue is an acceptable/available row-tint color in the current design system (checked against suspect/recurring/group-shared, not checked against anything else that might already use it elsewhere in Analytics).
