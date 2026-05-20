# Phase 12 Track F — Onboarding Two-Way Sync (Wizard ⇄ Real Tables)

> **Status:** 🟢 IN PROGRESS — F.0 ✅ · F.1 ✅ (#831) · F.2 ✅ (#836) · F.3 ✅ (#837) · F.4 (debts) ✅ DONE (#838) · F.5 (investments) 🟡 IN PROGRESS 2026-05-20.
> **Author:** Claude, 2026-05-20. **Owner:** Reza.
> **Driver:** Reza, 2026-05-20 — *"the wizard and the relevant sections/tables in the app should have a 2-way read/write relationship. the wizard should expose the existing data and reconfirm the user, and ask questions where there is no existing data. after all the wizard is to help user populate/update the required data to the app."*
> **Go/no-go:** Reza approved 2026-05-20 — *"for questions go with the recommendations"* — all three §8 open questions resolved with the recommended defaults (see §8).

---

## 1. Problem

The onboarding wizard does **not** share a single source of truth with the rest of the app.

Reza's reproduction (2026-05-20):
- Entered a full household in `/onboarding?mode=form` — Newsha (spouse), Self, 3 pets (Moti, Asal, Fandogh), 2 vehicles.
- Opened `/dashboard/household-profile` ("My Household") — **0% complete, no members, no pets, 0 vehicles**.

Same data. Two surfaces. Out of sync.

### 1.1 Root cause

Onboarding uses a **two-phase model**:

1. Both wizard modes (form + chat) stage everything into **one JSON blob** — `UserPreference.onboardingDraft` (a `WizardData` record).
2. The real entity tables (`HouseholdProfile`, `HouseholdMember`, `HouseholdPet`, `Property`, `Account`, `Loan`, `Investment`, `SuperAccount`, `Asset`, `Income`, `Expense`) are written **only once** — at the final `/api/onboarding/bulk-create` call when the user clicks "Looks right" / completes onboarding.

So during onboarding the wizard's data and the app's real data are **two separate representations that diverge until the very end**. Every dashboard surface (`/dashboard/household-profile`, `/dashboard/properties`, etc.) reads the real tables — which stay empty until bulk-create runs.

This is a **§12.2 SSOT violation**. There should be exactly one canonical source for each piece of data.

### 1.2 Why it matters (four-lens)

| Lens | Why this is worth fixing |
|---|---|
| **Behaviour psychologist** | "I entered my whole household and My Household shows empty" is a trust-breaking moment. The user cannot tell whether their work saved. Financial-stress users (Mani et al.) least tolerate ambiguity about whether their effort counted. |
| **Architect** | Two parallel representations of the same data is the exact smell §12.2 forbids. The draft blob is a shadow copy of data that also lives (eventually) in the real tables. |
| **Financial adviser** | Data integrity is paramount. One canonical record, no parallel copy that can drift. |
| **Product** | The wizard isn't a separate "thing" — it is a *guided front-end for populating + updating the app's real data*. It should behave like one. |

---

## 2. Principle

> **The wizard is a guided UI over the app's real data tables. Nothing more.**

It does not own a separate data representation. It **reads** the real tables to show what exists, and **writes** the real tables as the user enters or edits data. The dashboard entity pages (`/dashboard/household-profile`, `/dashboard/properties`, …) and the wizard become **two views of the same canonical tables**.

A user can edit their household via the wizard OR via the My Household page, interchangeably, and both always agree — because there is only one source.

---

## 3. Target architecture

### 3.1 The real tables become the single SSOT

Onboarding data lives **only** in the real entity tables. There is no parallel `WizardData` blob holding entity data.

### 3.2 What the wizard does

| Action | Behaviour |
|---|---|
| **Open a step** | READ the relevant real table(s). If data exists, the step shows it pre-filled and the agent/UI **reconfirms** ("You've added Newsha and 3 pets — anything to change, or shall we continue?"). If empty, ask normally. |
| **"Continue" on a step** | WRITE that step's entities to the real tables — `create` for new, `update` for edited, `delete` for removed. §12.11-safe (see §5). |
| **Re-enter the wizard later** | Same as "open a step" — it reads whatever is in the real tables, wherever the user left off. The wizard is resumable because the *data itself is the state*. |

### 3.3 What happens to the draft blob

`UserPreference.onboardingDraft` is **retired as a data store**. Optionally it is reduced to a tiny **step pointer** (`currentStep: number`) so the wizard knows where to resume — but it holds **no entity data**. (Even the step pointer is arguably derivable: "first step whose table is empty". Decide in §8 Q-F1.)

### 3.4 What happens to `bulk-create`

`/api/onboarding/bulk-create` is **retired**. There is no "create everything at the end" — entities are created incrementally, per step. "Completing onboarding" becomes a pure flag flip (`onboardingCompleted = true`), writing zero entity data.

### 3.5 Chat mode

The chat (`ConversationalSetup`) follows the identical principle — each topic reads the real tables on entry, writes them on confirm. **PR #828's per-topic mapping + acknowledgement logic (`draftHydration.ts`) is reused** — only the data *source* flips from `UserPreference.onboardingDraft` → the real tables. The acknowledgement copy ("I can see you've already added …") is unchanged; it just reads from a different place.

---

## 4. The 8 domains + their real entity surfaces

Each wizard step / chat topic maps to real tables that **already have entity APIs** (the dashboard pages already use them — this is a rewire, not new infrastructure).

| Domain | Real tables | Existing entity API(s) | Dashboard page |
|---|---|---|---|
| Household | `HouseholdProfile`, `HouseholdMember`, `HouseholdPet` | `/api/household-profile`, `/api/household-members[/[id]]`, `/api/household-pets[/[id]]` | `/dashboard/household-profile` |
| Properties | `Property` | `/api/properties` (verify in the domain PR) | `/dashboard/properties` |
| Accounts | `Account` | `/api/accounts` (verify) | `/dashboard/balances` |
| Debts / Loans | `Loan` | `/api/loans` (verify) | `/dashboard` loans surfaces |
| Investments | `Investment` (+ holdings) | `/api/investments` (verify) | `/dashboard/investments` |
| Super | `SuperAccount` (verify model name) | verify in the domain PR | `/dashboard/investments` or super surface |
| Assets | `Asset` | `/api/assets` (verify) | `/dashboard` assets surface |
| Income / Expenses | `Income`, `Expense` | `/api/income`, `/api/expenses` (verify) | `/dashboard` spending/income surfaces |

> Each domain PR begins by **verifying** the exact API + Prisma model names for its domain (CLAUDE.md §10 — research before action). The table above is the starting map, not the final contract.

---

## 5. The write contract (§12.11 — NON-NEGOTIABLE)

This re-architecture writes to the real entity tables during onboarding — the **exact risk class as the 2026-04-15 R12 incident** (a destructive `upsert` on `HouseholdProfile` clobbered a user's data; CLAUDE.md §12.11 exists because of it). Every write path in every domain PR MUST:

1. **Prefer `create` for new entities.** Never blind-`upsert`.
2. **Guard `update` / `delete`** so they only ever touch rows this user owns AND that the wizard is legitimately editing — `where: { id, userId }`, never `where: { userId }` alone.
3. **Be idempotent on re-entry.** Re-opening a step and clicking "Continue" without changes must NOT duplicate rows. Each entity needs stable identity (the row `id` once created; the wizard holds the `id` after first save).
4. **Fill in the §12.11 destructive-write checklist** in every domain PR that contains an `update` / `delete` / `upsert`.
5. **Audit every state-changing write** via `createAuditLog()` (§12.5).

The wizard's in-memory step state holds entity `id`s after first save, so the "Continue" handler knows which rows to `create` (no id), `update` (has id, changed), `delete` (id present in real table, removed from the step).

---

## 6. Migration / rollout plan

Ship **one domain per PR**, household first (it's what Reza tested + the simplest). The two-phase model and the new 2-way model can coexist during rollout — a domain is either "draft-staged" (old) or "real-table-synced" (new); the wizard handles both until all 8 are migrated.

| PR | Scope |
|---|---|
| ~~F.0~~ | ✅ **DONE 2026-05-20** — design doc + Reza go/no-go (approved, recommendations adopted). |
| ~~F.1~~ | ✅ **DONE 2026-05-20 (PR #831)** — Household domain: wizard household step + chat household topic read/write `HouseholdProfile`/`HouseholdMember`/`HouseholdPet` directly. Established the per-domain pattern — the reusable `lib/onboarding/householdSync.ts` read/diff/write layer (14 idempotency tests). |
| ~~F.2~~ | ✅ **DONE 2026-05-20 (PR #836)** — Properties domain. **Scope: the WHOLE property aggregate** — `Property` + its mortgage `Loan` + rental `Income` + property `Expense`s, synced together (see §6.1). `lib/onboarding/propertiesSync.ts` read/diff/write layer + 18 idempotency tests; 3 `PROPERTY_*` `AuditAction` values + migration. FORM step (`PropertiesStep`) full two-way sync; chat property topic deferred (§6.2). |
| ~~F.3~~ | ✅ **DONE 2026-05-20 (PR #837)** — Accounts domain. `lib/onboarding/accountsSync.ts` read/diff/write layer + 17 idempotency tests; 3 `ACCOUNT_*` `AuditAction` values + migration. FORM step (`AccountsStep`) full two-way sync for MANUAL accounts; **BASIQ / IMPORT accounts read-only — never written by the sync** (see §6.3). Offset→loan link handled server-side in `/api/accounts`. |
| ~~F.4~~ | ✅ **DONE 2026-05-20 (PR #838)** — Debts domain (standalone non-property loans — car / student / personal / business). `lib/onboarding/debtsSync.ts` read/diff/write layer + 11 idempotency tests. **No schema change** — the `/api/loans` routes already gained audit + relaxed validation in F.2. FORM step (`DebtsStep`) full two-way sync. CAR→vehicle link deferred (see §6.4). |
| **F.5** | 🟡 **IN PROGRESS 2026-05-20** — Investments domain (the `InvestmentAccount` + `InvestmentHolding` aggregate, mirroring F.2's property aggregate). `lib/onboarding/investmentsSync.ts` read/diff/write layer + 11 idempotency tests; 3 `INVESTMENT_*` `AuditAction` values + migration. FORM step (`InvestmentsStep`) full two-way sync. See §6.5. |
| **F.6 – F.8** | One PR each for super, assets, income/expenses — replicate the `*Sync.ts` pattern. |
| **F.9** | Retire `/api/onboarding/bulk-create` + drop entity data from `UserPreference.onboardingDraft` (keep or drop the step pointer per Q-F1). Final cleanup. Schema migration if a column is dropped (§12.12). |
| **F.10** | Conversational enrichment follow-ups (see §10). Queued — starts after F.9. |
| **F.11** | Receipt / document upload mid-chat (see §10). Queued — starts after F.10. |

Estimated: ~11 PRs (F.0–F.9 core ≈ 1.5–2 weeks; F.10 + F.11 the conversational-depth extension). Each PR independently shippable + testable.

### 6.1 F.2 scope — the whole property aggregate (Reza decision 2026-05-20)

The §4 table maps the Properties domain to the `Property` table alone. F.2
**widens** that: the wizard's property card captures a `Property` *together
with* its mortgage `Loan`, its rental `Income` and its property `Expense`s —
a user thinks of "a property" as one thing. F.2 syncs all four so that
re-entering the wizard reconfirms ALL of a property's data, not half of it.

Consequence — **F.4 / F.8 scope clarified:**

| Domain PR | Now covers |
|---|---|
| **F.2** | `Property` + **property-attached** `Loan` / `Income` / `Expense` |
| **F.4** | only **standalone** debts (`Loan` with no `propertyId` — car / personal / student / business) |
| **F.8** | only **general** (non-property) `Income` / `Expense` |

Why this is right, not scope-creep (Reza feedback 2026-05-20): *"if a user
talks about a mortgage on a property you'll already be updating the loan
account."* Exactly — the mortgage entered on the property step **is** the
real `Loan` row; the Debts step and the dashboard read that same row.
Capture once, appears everywhere. The property step gains a carry-forward
reminder — *"We've linked this mortgage to [property]. You can fine-tune the
rate, offset and repayments in the Debts step."* — so the Debts step is a
continuation, not a surprise re-ask.

F.2 audit actions: `PROPERTY_CREATED/UPDATED/DELETED` for the property
itself; the property-attached loan/income/expense writes use the generic
`CREATE/UPDATE/DELETE` actions with an `entityType` — F.4/F.8 own those
domains and may introduce domain-specific actions later. F.2 adds
`createAuditLog()` to the property, loan, income and expense entity routes
(they had none — a pre-existing §12.5 gap this PR closes).

### 6.2 F.2 chat property topic — deferred (F.2-chat)

F.2 migrates the **form** step (`PropertiesStep`) to full two-way sync. The
**chat** property topic is deliberately left draft-staging for now:

- The chat captures only name / type / value / `hasLoan` — it cannot build a
  complete `Property` because the required `purchaseDate` is form-mode-only
  (the form is better at date pickers + Phase 41E reform context).
- The chat hands off to form mode regardless (ConversationalSetup's topic
  chain ends in form mode). So the chat stages partial properties into the
  draft blob; **form mode drains them into the real tables**: the form
  step's read-on-open MERGES the real-table portfolio with any unsynced
  synthetic-id draft properties (chat-staged or in-session), so a
  chat-staged property is never lost — it is created on the next Continue.

This contrasts F.1, where the chat household topic could fully write the
real tables (household entities have no equivalent required field). A
follow-up **F.2-chat** migrates the chat property topic once the
purchaseDate-capture approach is decided (ask it conversationally vs. keep
the form-mode handoff). Tracked in `IMPLEMENTATION_PLAN.md` Up Next row 0.

### 6.3 F.3 scope — accounts, and the three data sources

A bank account in the wizard has one of three provenances:

| Source | How the real `Account` row is created | F.3 sync behaviour |
|---|---|---|
| **MANUAL** | the user typed the balance in the wizard | **F.3 reads + writes it** — create / update / hard-delete via `/api/accounts` |
| **BASIQ** | the Basiq Open Banking consent flow writes it directly to the DB | **read + display only** — never written by the sync |
| **IMPORT** | the Phase 18 CSV/OFX/QIF import flow writes it directly | **read + display only** — never written by the sync |

`diffAccounts()` only emits create/update/delete ops for **MANUAL**
accounts. BASIQ / IMPORT accounts are owned by their source — the wizard
displays them so the user sees their full picture, but a "remove" or an
edit on one produces no op (exactly the pre-F.3 behaviour, where
`bulk-create` skipped them). This is data-safe by construction: the wizard
can never destroy an externally-sourced account.

`Account.balanceSource` is the discriminator on read (`MANUAL` /
`USER_VERIFIED` / null → manageable; `BASIQ` / `IMPORT` → external).

**Offset → loan link.** An OFFSET account points at a mortgage; the link
lives on the loan (`Loan.offsetAccountId`). F.3 carries `linkedLoanId` on
the account record and `/api/accounts` POST/PUT set `Loan.offsetAccountId`
server-side, atomically with the account write, ownership-verified.
Property loans carry real ids after F.2, and the properties step precedes
the accounts step, so `linkedLoanId` is always a real `Loan` id by then.

Chat accounts topic: deferred alongside F.2's chat-properties (the chat
captures name/type/balance only; form mode is the write boundary).

### 6.4 F.4 scope — debts, and the CAR→vehicle link

A "debt" is a standalone, non-property `Loan` — `type` ∈ `CAR` / `STUDENT`
/ `PERSONAL` / `BUSINESS`. Property mortgages (`type` HOME / INVESTMENT,
`propertyId` set) are F.2's; `readDebts()` filters by `type` so the two
domains never collide.

**No schema change.** F.2 already added `createAuditLog()` to `/api/loans`
(generic `CREATE/UPDATE/DELETE`, `entityType: 'Loan'`) and relaxed the
numeric validation (`minRepayment` / `termMonthsRemaining` accept 0 — HECS
has a 0 minimum). F.4 reuses that route surface unchanged — no new
`AuditAction` values, no migration.

**The CAR→vehicle link is not F.4's.** A CAR debt can carry
`linkedAssetId` (a link to a vehicle `Asset`). F.4 does NOT write it: the
Assets step comes *after* Debts and is not migrated until F.7, so during
the Debts step the vehicle has no real `Asset` row — sending a synthetic
id would fail the loan API's related-ownership check. F.4 writes the
debt's core fields only. `bulk-create`'s post-Assets pass (§5a) wires the
link: it now *updates* the already-real CAR loan's `linkedAssetId` (the
loan is created by F.4; `data.debts[i].id` carries the real id) instead of
creating the loan. Once F.7 ships, the Assets step owns the link.

**Budget vs actuals (Reza, 2026-05-20).** `/api/loans` GET returns each
loan enriched with transaction-reconciled actuals (`actualFromTransactions`,
`monthlyAverageActual`, …) *alongside* the raw budget columns
(`principal`, `minRepayment`, `interestRateAnnual`). `readDebts()` reads
**only the raw budget columns** — never the actuals. The wizard owns the
budget; transaction reconciliation independently owns the actuals. This is
the invariant for every income/expense/loan domain (F.2 / F.4 / F.8): the
two-way sync touches the budget layer only, so reconciliation is never
disturbed.

**DECIDED 2026-05-20 (Reza) — the wizard never surfaces actuals.**
Onboarding captures the *initial budget data* only; it does not show
transaction-reconciled actuals in any step or on re-entry. Instead, a
**post-onboarding completion message** bridges to reconciliation: when the
user finishes the wizard, if they imported transactions during it (Basiq
connect / file import), a message reminds them about reconciliation and
links them to that page (the dashboard's budget-vs-actual surface). If no
transactions were imported the message does not apply (or becomes a
gentler "connect your bank" nudge — decided when built). This keeps the
wizard a clean "set your plan" surface and makes "see plan vs reality" a
deliberate post-onboarding next action. It is a single follow-up
(**F-reconcile-handoff**) after the F.5–F.8 domain sweep — it supersedes
the earlier "surface actuals on re-entry" idea.

### 6.5 F.5 scope — investments (the account + holdings aggregate)

The investments domain is an **aggregate** — an `InvestmentAccount` plus
its `InvestmentHolding`s — mirroring F.2's property aggregate. F.5 syncs
the whole thing: `lib/onboarding/investmentsSync.ts` reads
`/api/investments/accounts` (which `include`s holdings), diffs account
core + nested holdings, and writes via `/api/investments/accounts` +
`/api/investments/holdings`.

- **Create order:** a new account is POSTed first (the holding API
  requires a real `investmentAccountId` uuid), then its holdings.
- **Delete:** `InvestmentHolding.investmentAccount` is `onDelete: Cascade`,
  so deleting an account cascade-deletes its holdings — a delete op only
  DELETEs the account (no per-holding delete needed, unlike F.2's
  property→loan `SetNull`).
- **Quality guards:** a holding with no ticker / `units <= 0` /
  `averagePrice <= 0` is dropped (the holding API also requires positive
  units + price); an unpersisted account with no name is dropped.
- **Audit:** `INVESTMENT_*` for the account, generic `CREATE/UPDATE/DELETE`
  (`entityType: 'InvestmentHolding'`) for holdings — added to the four
  investment routes in F.5.
- **`bulk-create`:** §4 investments loop → no-op. The `firstInvestmentAccountId`
  used for INVESTMENT-income linking is now resolved from the (real,
  post-sync) `data.investments[0].id` instead of this route's own creates.

Chat investments topic deferred (alongside the other chat topics).

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **R12-class destructive write** | §5 write contract — `create`-first, `where:{id,userId}` guards, §12.11 checklist on every domain PR. Reviewer rejects any domain PR without it. |
| **Duplicate rows on wizard re-entry** | §5.3 idempotency — the wizard holds entity `id`s after first save; "Continue" diffs against the real table. F.1 must prove this with a test (enter → leave → re-enter → Continue → assert no duplicates). |
| **Partial data from abandoned onboarding** | **Not a real risk.** Partial saved data is just *the user's data, saved* — the dashboard already renders partial state (empty states everywhere). This is strictly better UX than "your data vanished". The old two-phase model's atomicity argument does not survive scrutiny. |
| **Coexistence during rollout** | A domain is flagged old/new; the wizard reads whichever applies. F.9 removes the old path once all 8 are migrated. |
| **`onboardingEstimateService` is disabled** | Out of scope — that disabled stub stays disabled; this phase does not touch it. The new write paths are fresh, §12.11-clean code, not a revival of the R12-era service. |

---

## 8. Questions — all RESOLVED 2026-05-20

Reza go/no-go directive: *"for questions go with the recommendations."* All three resolved with the recommended defaults.

| # | Question | ✅ DECISION (2026-05-20) |
|---|---|---|
| **Q-F1** | Keep a minimal `currentStep` pointer in `UserPreference`, or derive "resume at first incomplete domain" from the real tables? | **DERIVE** — no stored step pointer. The resume point is "the first domain whose real tables are empty"; the data itself is the state. Zero stored state, no draft blob at all. If F.1 finds that mid-domain resume genuinely needs a pointer (e.g. resuming halfway through a long property list), revisit then — but the default and intent is derive. |
| **Q-F2** | When a user removes an entity in the wizard that exists in the real tables, hard-delete immediately on "Continue", or soft-stage the deletion? | **HARD-DELETE on "Continue"** — consistent with the dashboard's own delete buttons (which hard-delete). The wizard's "Continue" handler diffs its step state against the real table and issues `delete` for rows the user removed. §12.11-guarded (`where:{id,userId}`). |
| **Q-F3** | Should the dashboard entity pages and the wizard steps eventually share the SAME components? | **YES long-term, NOT in this phase.** True SSOT at the component layer (one `<HouseholdEditor>` in both places) is the right end-state but out of scope for Track F. Logged as a future cleanup — Track F gets the *data layer* to one SSOT; a later pass can unify the *component layer*. |

---

## 9. Relationship to prior work

- **PR #828** (chat draft hydration) — not wasted. Its 8 per-topic mapping functions + acknowledgement copy in `draftHydration.ts` are reused; F.1–F.8 flip each one's source from the draft blob to the real tables.
- **PR #818 / #825** (mode selector) — unaffected; the selector is a routing surface, not a data surface.
- **`PHASE_12_SETUP_AND_ONBOARDING.md`** — the parent onboarding doc; gains a "Related → Track F" pointer when F.0 lands.
- **CLAUDE.md §12.11 / §12.12** — the governing rules for every domain PR's writes + any schema change.

---

## 10. F.10 + F.11 — conversational enrichment (queued extension)

> **Status:** queued. Starts after F.9 — it depends on the real-table read/write machinery F.1–F.8 establish (enrichment fields write to the real entity columns).
> **Driver:** Reza, 2026-05-20 — *"get the AI to engage with the user more and ask follow-up questions … AI asks about a property, user answers, then AI suggests 'would you like to add the council rate?' yes/no, then 'would you like to upload the receipt?' … so the AI captures the most complete data on onboarding. However the user can always skip and do them later."*

### 10.1 The idea

Today each chat topic captures a fixed **bare-minimum** field set per entity (e.g. a property captures name / type / value / hasLoan; everything else is deferred to form mode). F.10 makes the chat agent **progressively offer optional enrichment fields** as one-tap follow-ups after the core entity is captured:

```
agent:  Got it — "12 Smith St", an investment property worth $850k.
agent:  Want to add the council rate for it?            [ Yes ]  [ Skip ]
user:   Yes
agent:  Roughly how much, and how often?
user:   $2,400 a year
agent:  Added. Anything else for this property, or move on?   [ Add more ]  [ Move on ]
```

More complete data on day one → better TRAIL guidance (net worth, cashflow, tax position). The user can always skip and fill it in later via form mode or the dashboard.

### 10.2 Design constraints (four-lens — these are load-bearing)

| Lens | Constraint |
|---|---|
| **Behaviour psychologist** | The chain MUST be capped — offer the **top 1–2** enrichment fields per entity, then "anything else, or move on?". A 10-question interrogation per property is fatigue, not thoroughness. "Skip" must be **visually equal-weight** to "Yes" — never a tiny grey link. The completionist user still has form mode for every field. |
| **Financial adviser** | Enrichment fields are **prioritised by advice-impact** — ask for what materially improves the guidance (council rate = a real recurring expense + tax-deductible on an IP; valuation = equity/LVR accuracy). Never ask for vanity fields. |
| **AFSL boundary** | Follow-up copy is a **neutral data offer** — "Would you like to add the council rate?" ✅. NOT "you should add it, it'll save you tax" ❌ — that edges into advice. Extraction-only, like the rest of the chat agent. |
| **Architect** | Needs a clean **"core fields (required) vs enrichment fields (optional follow-up)"** split per topic. Each topic gets an ordered enrichment list. The state machine gains follow-up-offer states. Enrichment writes go to the same real-table columns via the same F.1 `*Sync` layer — F.10 is mechanically small *once F is done*. |

### 10.3 F.10 vs F.11 — why two PRs

- **F.10 — enrichment field follow-ups.** The lightweight part: yes/no offers for text/number/enum columns (council rate, valuation date, etc.). Capped per entity. Pure conversation + a write to an existing real-table column. Self-contained once F.1–F.8 exist.
- **F.11 — receipt / document upload mid-chat.** The heavy part: "would you like to upload the rates notice?" pulls in the whole document pipeline (`/api/documents/upload`, the Phase 25 / 38 Document Management Engine) + an upload affordance in the chat composer + the document-to-entity link. Deliberately a separate PR so F.10's value isn't blocked behind the document-pipeline wiring.

### 10.4 Open questions (for when F.10 is scoped — not blocking now)

- **Q-F10-1** — the per-topic enrichment field list + priority order. Decide per domain when each F.2–F.8 PR lands (it already touches that domain's fields).
- **Q-F10-2** — does the form-mode wizard also surface these enrichment fields, or do they stay chat-only + form-mode-full-fields? (Default: form mode already exposes all fields; F.10 is about making the *chat* reach parity progressively.)

---

*F.0 + F.1 complete (2026-05-20, PRs approved + #831). F.2 (properties domain) is next — replicate the `lib/onboarding/householdSync.ts` pattern. F.10 + F.11 (conversational enrichment) are queued after F.9. See `IMPLEMENTATION_PLAN.md` Up Next row 0.*
