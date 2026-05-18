# Data Source Hygiene — Operator & Support Runbook

> **What every account-balance surface in the app shows, when it shows, and how to debug it.**
> Covers the 5 user-facing surfaces shipped 2026-05-18 (Phase 12 PR 3c.1–3c.2d):
> chip, dashboard nudge, upgrade button, heat-map page, first-visit modal.

**Owner:** Director (Reza)
**Last reviewed:** 2026-05-18
**Source of truth:** this file. The full design spec lives in
`docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A.

---

## 1. Why this exists

User trust in Monitrax depends on **every number on every screen being accurate**. Every metric on the dashboard, the CFO advisor, the budget engine, the net-worth tile — all of it is downstream of `Account.currentBalance` rows. If a user enters a balance manually in February and never updates it, by July the dashboard is showing a 5-month-old snapshot — but until 2026-05-18 the app didn't tell them that.

The data-source-hygiene story closes that gap with **five coherent surfaces**, each tuned to a different moment in the user's workflow:

| Surface | When it fires | What it tells the user |
|---|---|---|
| `<DataSourceChip>` | Always, on every account row + every account detail dialog | Where this balance came from + how old it is |
| `<StaleBalanceNudge>` banner | When ≥1 MANUAL account is >14 days old | "N balances are getting stale — here's how to fix" |
| `<UpgradeAccountButton>` | Inside each MANUAL/USER_VERIFIED account's detail dialog | "Switch this account to live Basiq sync or file import" |
| Settings > Data Health heat-map | Whenever the user navigates there | Whole-portfolio bucketing — Fresh / Aging / Stale / Untracked |
| `<BalanceUpgradeNudgeModal>` | Once per user, on first dashboard visit after the PR landed, gated on having ≥1 MANUAL account | "We can keep your balances fresh — pick how" |

All five surfaces share **one staleness rule** and **one upgrade path** — they tell the same story.

---

## 2. The shared SSOTs (single sources of truth)

Per CLAUDE.md §12.2 — every staleness check + every Basiq/Import deep-link in the data-source-hygiene story goes through one of these:

| SSOT | Lives at | What it does |
|---|---|---|
| `BalanceSource` enum | `prisma/schema.prisma` line 85 | 4 values: `MANUAL`, `IMPORT`, `BASIQ`, `USER_VERIFIED`. Every write site must pick one. |
| `balanceWriteFields(source)` | `lib/utils/accountBalance.ts` | Returns `{ balanceSource, balanceLastUpdatedAt: new Date() }`. Spread into every `prisma.account.{create,update,upsert}` `data` payload that touches `currentBalance`. |
| `isBalanceStale(source, lastUpdatedAt)` | `components/accounts/DataSourceChip.tsx` (named export) | Pure predicate: `true` when source is `MANUAL` AND last-updated is null OR ≥14 days ago. Used by chip's amber threshold + the dashboard nudge banner + the heat-map page. |
| `MANUAL_STALE_THRESHOLD_DAYS = 14` | `components/accounts/DataSourceChip.tsx` (named export) | One place to tune the threshold. |
| `?action=connect-basiq` / `?action=import` | `app/dashboard/balances/page.tsx` `useEffect` deep-link handler | The two existing upgrade paths every CTA in the hygiene story links to. **No parallel flows.** |

**Reviewer-reject rule (CLAUDE.md §12.2):** any new `prisma.account.{create, update, upsert}` that writes `currentBalance` MUST spread `...balanceWriteFields(source)`. The helper's file-header JSDoc documents this rule in plain English; reviewers cite the file in code review.

---

## 3. Surface-by-surface reference

### 3.1 `<DataSourceChip>` — the foundational primitive

**File:** `components/accounts/DataSourceChip.tsx`

**Where it renders:**
- `/dashboard/balances` — every Cash + Credit + Debt row
- `AccountDetailDialog` Overview tab — "Data source" row inside the Account Details card
- `/dashboard/settings/data-health` heat-map — every account row (compact variant)

**Five visual states** keyed by `(balanceSource, balanceLastUpdatedAt)`:

| Source | Age | Tone | Icon | Label example |
|---|---|---|---|---|
| `BASIQ` | any | emerald | `Zap` | "Synced 2m ago" |
| `IMPORT` | any | sky | `Upload` | "Imported 3d ago" |
| `USER_VERIFIED` | any | indigo | `ShieldCheck` | "Verified 1d ago" |
| `MANUAL` | <14 days | slate | `Hand` | "Manual · 4d ago" |
| `MANUAL` | ≥14 days | amber | `AlertTriangle` | "Manual · 32d ago" |
| (no source) | — | — | — | renders nothing |

**Tone rationale (CLAUDE.md §0 behaviour-psychologist lens):**
- slate (not red) for stale-manual — this is a hygiene nudge, not an alarm
- emerald reserved for live Open-Banking sync (the strongest trust state)
- amber only kicks in when the staleness threshold is crossed

**Debug:** if a chip shows the wrong source/age, the bug is in the write path — every write of `currentBalance` should go through `balanceWriteFields()`. Audit with:
```bash
grep -rnE "prisma\.account\.(update|upsert|create)" \
  --include="*.ts" 2>/dev/null | grep -v node_modules
```
Then check each hit also spreads `balanceWriteFields()`. The 4 paths already audited in PR I (2026-05-18) are:
- `app/api/accounts/route.ts` (POST manual create)
- `app/api/accounts/[id]/route.ts` (PATCH — conditional on `balanceChanging`)
- `app/api/basiq/sync/route.ts` (POST handler's `syncAccount()` — tags as `BASIQ`)
- `app/api/accounts/[id]/import/route.ts` (placeholder create — tags as `IMPORT`)

### 3.2 `<StaleBalanceNudge>` — the dashboard banner

**File:** `components/dashboard/StaleBalanceNudge.tsx`

**Mount point:** `/dashboard/balances` (between page hero and Hidden Wealth lens)

**Fires when:** `accounts.filter(isBalanceStale).length ≥ 1`. Same staleness rule the chip uses.

**Dismissal:** **session-only** via `sessionStorage` key `monitrax:staleBalanceNudge:dismissed`. Reappears next session if the condition still holds (right cadence for a hygiene nudge, not a one-and-done modal).

**Copy** (calm + normalising — CLAUDE.md §0):
> "N accounts haven't been refreshed in over 2 weeks. Your dashboard reads from these balances — keeping them fresh keeps every number it shows you accurate."

**CTAs** (both deep-link to existing `?action=` handlers; **no parallel flows**):
- "Connect via Basiq" (emerald) — **gated on `useBasiqEnabled()`** (PR L fix 2026-05-18)
- "Upload a statement" (slate-outline) — always visible

**Debug:** if the banner shows when nothing's stale, check `accounts.balanceLastUpdatedAt` — most likely a write path missed `balanceWriteFields()` and left the column null (which `isBalanceStale` treats as stale-by-default for MANUAL accounts).

### 3.3 `<UpgradeAccountButton>` — the in-context CTA

**File:** `components/accounts/UpgradeAccountButton.tsx`

**Where it renders:**
- `AccountDetailDialog` Overview tab — below the "Data source" row when `balanceSource ∈ {MANUAL, USER_VERIFIED}`
- `/dashboard/settings/data-health` heat-map — inside each MANUAL/USER_VERIFIED account row (compact variant)

**Renders nothing for** `BASIQ` and `IMPORT` (already on a fresher tier).

**Two CTAs:**
- Connect via Basiq (emerald solid, `Zap` icon) — **gated on `useBasiqEnabled()`**
- Upload statement (slate outline, `Upload` icon) — always visible

Both `<Link>` deep-links to `/dashboard/balances?action=…` handlers (Phase 36 PR 2b/2c). **No parallel flows.**

**Optional `onBeforeNavigate` prop** lets containing dialog close itself before the navigation fires (used in `AccountDetailDialog` so the dialog isn't on top of the action handler firing).

### 3.4 Settings > Data Health page — the whole-portfolio view

**File:** `app/dashboard/settings/data-health/page.tsx`
**Route:** `/dashboard/settings/data-health`
**Discovery:** "Data Health" card on `/dashboard/settings` landing page (emerald `Activity` icon)

**Hero stat** (leads with what's working — Bandura self-efficacy):
> "**X% of your N accounts are fresh** — Y manual balances are due for a refresh"
> When `stale === 0`: "You're in great shape — every balance is up to date."

**Four buckets** (empty buckets self-hide):

| Bucket | Range | Tone |
|---|---|---|
| Fresh | <14 days | emerald |
| Aging | 14–60 days | amber |
| Stale | ≥60 days | rose |
| Untracked | `balanceLastUpdatedAt IS NULL` | slate — pre-PR-I rows; PR I's audit prevents new ones |

**Footer copy** is flag-aware (PR L polish 2026-05-18) — when `BASIQ_INTEGRATION` is OFF, the Basiq sentence drops out.

**No new endpoint** — reads `/api/accounts` directly (same fetch path `/dashboard/balances` uses).

### 3.5 `<BalanceUpgradeNudgeModal>` — the first-visit modal

**File:** `components/onboarding/BalanceUpgradeNudgeModal.tsx`

**Mount point:** `/dashboard` root (alongside other modals)

**Fires when:** parallel-fetch on dashboard mount shows BOTH:
1. `GET /api/settings/balance-upgrade-nudge → { dismissed: false }`, AND
2. `GET /api/accounts → ≥1 row with balanceSource === 'MANUAL'`

Both conditions OR-fail → modal never opens.

**Three CTAs** (every one flips the server flag forward via `POST /api/settings/balance-upgrade-nudge`; modal then never auto-shows again):
- Connect via Basiq (emerald) — **gated on `useBasiqEnabled()`**
- Upload a statement (sky)
- Keep entering balances manually (slate)

**ESC + click-outside** both treated as "Keep manual" — they also flip the flag. **No escape hatch that leaves the user re-asked next visit.** A user who closes via the X has made a choice; respect it.

**Always reachable** via Settings > Data Health for users who want to revisit.

**Persistence column:** `UserPreference.dismissedBalanceUpgradeNudge Boolean @default(false)`. Added in migration `20260518100000_phase_12_pr_3c_2b_balance_upgrade_nudge`.

---

## 4. Basiq feature-flag gating — exhaustive list

Every Basiq surface in the data-source-hygiene story is gated by `BASIQ_INTEGRATION` (admin flag, OFF in prod as of 2026-05-18):

| Component | Gating mechanism |
|---|---|
| `<DataSourceChip>` (chip itself) | **Not gated.** When source IS `BASIQ` (legacy data from when flag was ON), chip truthfully renders "Synced X ago". Describes existing state, never advertises Basiq. |
| `<StaleBalanceNudge>` Basiq button | `useBasiqEnabled()` (fix shipped PR L 2026-05-18) |
| `<UpgradeAccountButton>` Basiq button | `useBasiqEnabled()` |
| Settings > Data Health footer Basiq sentence | `useBasiqEnabled()` (polish shipped PR L 2026-05-18) |
| `<BalanceUpgradeNudgeModal>` Basiq CTA | `basiqEnabled` prop (parent passes `useBasiqEnabled()`) |

**When the flag is OFF**, every Basiq button in this story hides. The Upload-statement + Keep-manual paths remain visible everywhere. Modal renders as 2-button stack instead of 3.

**When the flag is ON**, every button appears. No deploy required to flip — the admin toggle at `/admin/feature-flags` is the single switch.

See `06_BASIQ_INTEGRATION_TOGGLE.md` for the canonical operator runbook on the flag itself.

---

## 5. Support cheat-sheet — common user questions

**Q: "Why is my dashboard balance wrong / out of date?"**
A: Open `/dashboard/settings/data-health`. If the user's manual balances are in the Aging / Stale buckets, the dashboard is reading those frozen values. Upgrade path: (a) connect via Basiq if the flag is on, (b) upload a statement, (c) edit the balance via the account detail dialog (which auto-flips to `USER_VERIFIED` + refreshes the timestamp).

**Q: "What's the difference between Basiq, Import, USER_VERIFIED, and Manual?"**
A:
- **Basiq** — Open Banking. Daily auto-sync. Strongest trust state. Requires CDR consent.
- **Import** — User uploaded a CSV / QIF / OFX statement. Refreshes whenever they re-upload.
- **USER_VERIFIED** — User edited the balance in the account detail dialog. Implicit re-affirmation that this is the current value.
- **Manual** — Initial entry, never re-verified. The freshness chip kicks into amber after 14 days.

**Q: "I keep seeing the upgrade banner / modal — how do I make it stop?"**
A:
- **Banner (dashboard staleness nudge)** — dismiss with the X. Session-only. Will reappear on next browser session if balances are still stale. Permanent fix is to refresh the balances.
- **Modal (first-visit migration nudge)** — any of the 3 buttons (including "Keep entering balances manually") permanently dismisses. Modal never auto-shows again after the first interaction.

**Q: "I want to re-trigger the modal."**
A: There's no "show again" button on purpose (avoids nag pattern). The user can re-do the upgrade journey via Settings > Data Health → click the upgrade button on any manual account.

**Q: "An account shows 'Manual' but I'm sure I connected it via Basiq."**
A: Before PR I (2026-05-18) the `app/api/basiq/sync/route.ts` route had a bug where it would update `currentBalance` from a Basiq sync but forget to tag `balanceSource: 'BASIQ'` — so synced accounts wrongly appeared as MANUAL in the chip. Fixed in PR #794. If a user's chip is still wrong, the next Basiq sync will overwrite the tag correctly (the row is updated, not just created).

---

## 6. Engineering invariants (for future PRs)

Per CLAUDE.md §12.2 SSOT — never break these:

1. **Every** `prisma.account.{create, update, upsert}` that writes `currentBalance` MUST spread `...balanceWriteFields(source)`. Audit script:
   ```bash
   grep -rnE "prisma\.account\.(update|upsert|create)" --include="*.ts" \
     | grep -v node_modules \
     | grep -v "// no balance write"
   ```
2. The **PATCH** path that conditionally edits balance MUST gate the timestamp refresh on `balanceChanging` — a rename / re-type / rate change should NOT falsely refresh the timestamp.
3. **All** Basiq CTAs in the hygiene story MUST be gated by `useBasiqEnabled()` (client) and protected by `basiqRouteGuard()` (server).
4. The **dismissal flag** for the first-visit modal (`UserPreference.dismissedBalanceUpgradeNudge`) MUST only flip forward (`false → true`); never reset. This is enforced inside `POST /api/settings/balance-upgrade-nudge` which only ever writes `true`.
5. **One staleness rule.** Any future surface that asks "is this balance stale?" MUST import `isBalanceStale()` from `components/accounts/DataSourceChip.tsx`. Don't reimplement.

---

## 7. Related docs

- `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A — full design spec
- `docs/blueprint/PHASE_13_TRANSACTIONAL_INTELLIGENCE.md` §417 — original three-tier `BalanceSource` hierarchy
- `docs/operational/runbooks/06_BASIQ_INTEGRATION_TOGGLE.md` — the master Basiq feature-flag runbook
- `docs/policy/APPROVED_DEPENDENCIES.md` — `pdfkit` approval (Tax Pack export, also shipped 2026-05-18)
- `docs/changelog/CHANGELOG_2026_05_18.md` — sessions 9 (PR F), 11 (PR H), 12 (PR I), 13 (PR J), 14 (PR K) cover the 5 surfaces in detail

---

Last updated: 2026-05-18 — initial runbook covering Phase 12 PR 3c.1–3c.2d data-source hygiene story (5 user-facing surfaces, 1 SSOT helper, 1 API endpoint, 1 schema migration).
