# Phase 43.4 — Tighter `enoughHistory` Gate (Money Story Hero)

> **Status:** 🟡 **SHIPPING IN THIS PR** (`claude/phase-43-4-enough-history-gate-MG8mr`).
> **Scope:** Replaces the cheap `monthlyExpenses > 0` gate on the Money Story Hero's day-count display with a two-mode honest check. **Closes the four follow-ons promised in `PHASE_43_MONEY_STORY.md` §8.**
> **Estimated effort:** ~half day end-to-end (delivered).
> **Last updated:** 2026-05-09 — Reza + Claude.
> **Predecessor:** Phase 43.3 (Margin Trend Lens) — PR [#740](https://github.com/resadegh/monitrax/pull/740), merged 2026-05-09.

---

## 1. Why this exists

Phase 43 (Money Story Hero, PR [#737](https://github.com/resadegh/monitrax/pull/737)) shipped the *"47 days of life"* runway display with a deliberately crude false-precision guardrail: hide the day count when `monthlyExpenses === 0`. The Phase 43 architect-mode synthesis flagged this as a known limitation:

> *"False precision risk. 'Free today · 47 days of life' is a powerful number — and a wrong one if monthlyExpenses is undercounted (e.g. annual bills that haven't hit yet). Mitigation: require ≥90 days of transaction history before showing the day count; otherwise show months."*

The crude gate lets *"47 days of life"* render for a user with three weeks of bank data who hasn't yet seen their annual home-insurance bill — `monthlyExpenses` undercounts, and the day claim overstates runway. Phase 43.4 closes that gap.

---

## 2. Two-mode gate

The Phase 43 synthesis named *"≥90 days of transaction history"* via `linkageHealthService`. Investigation in this phase confirmed `linkageHealthService` does NOT expose history-depth as a signal (it's about cross-module linkage completeness, not transaction-data span). So Phase 43.4 introduces a fresh helper at `lib/dashboard/expenseDataMaturity.ts` that handles **both** monitrax usage modes:

| Mode | Signal | Why it satisfies |
|---|---|---|
| **Bank-imported users** | Oldest UnifiedTransaction ≥ 90 days ago | One full quarterly cycle; annual bills should have appeared at least once. |
| **Manual-entry users** | ≥ 3 recurring `Expense` rows AND ≥ 1 flagged `isEssential` | The user has done meaningful classification of their recurring spending. |

A user with *both* satisfies via either path. A user with *neither* — e.g. brand new sign-up with one bank just connected — gets the fallback display *"Truly liquid right now"* (the dollar amount, no day claim).

This recognises a Monitrax architecture reality that the original synthesis missed: **`monthlyExpenses` in `getMasterFinancialSnapshot()` comes from the `Expense` model (frequency-based, manually defined), not directly from `UnifiedTransaction`**. So a transaction-history-only gate would unnecessarily hide the day count from manual-entry users whose data is by-definition stable.

---

## 3. Architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-43.4-1** | **New helper at `lib/dashboard/expenseDataMaturity.ts`**, not inline in the route. | Reusable. Future surfaces (mobile widget, adviser drill-in) needing the same maturity check import the helper. Pure read-query, two parallel Prisma calls + one conditional follow-up. |
| **D-43.4-2** | **Lives in `lib/dashboard/`, not `lib/calculations/`.** | This is a *presentation-layer guard* (does the user have enough data to back a UI claim?) not a canonical financial calculation. CLAUDE.md §6.2 mapping: belongs near the surface it serves. |
| **D-43.4-3** | **Two-mode gate, not single-mode.** | Recognises that monitrax has both bank-imported and manual-entry users. A transaction-only gate (the original Phase 43 spec) would unfairly hide the runway display from users with well-classified manual entries. |
| **D-43.4-4** | **No new field on `quickMetrics`.** | Same SSOT discipline as 43.1 / 43.2 / 43.3 — promote-on-second-use. Maturity is consumed by exactly one surface (the moneyStory block on `/api/dashboard/insights`); promote later if a second consumer appears. |
| **D-43.4-5** | **No client-side change required.** | The `MoneyStoryHero` component already reads `enoughHistory` from props and gates the day display on it. Only the SOURCE of the boolean changes; the consumer contract is untouched. |
| **D-43.4-6** | **`reason: 'bank_history' | 'manual_classification' | 'none'`** returned alongside the boolean. | Doc/debug-only field. Currently not surfaced to the client; available for future admin tooling or on-page hints if the user signal demands. |

---

## 4. Implementation

```ts
// lib/dashboard/expenseDataMaturity.ts (new file, ~80 LOC)
export async function getExpenseDataMaturity(userId): Promise<{
  isMature: boolean;
  reason: 'bank_history' | 'manual_classification' | 'none';
}>
```

```ts
// app/api/dashboard/insights/route.ts (modified)
const expenseMaturity = await getExpenseDataMaturity(userId);
// ...
moneyStory: {
  // ...
  enoughHistory: expenseMaturity.isMature,  // was: snapshot.quickMetrics.monthlyExpenses > 0
}
```

That's the entire ship. `MoneyStoryHero.tsx` is unchanged; the boolean it consumes is now honest.

---

## 5. Acceptance criteria

- [x] New helper at `lib/dashboard/expenseDataMaturity.ts` with full JSDoc citing CLAUDE.md §6.1 + §12.2 SSOT.
- [x] Helper uses parallel Prisma reads (`Promise.all`) for the two independent signals to keep latency low.
- [x] `/api/dashboard/insights` route imports + calls the helper before building the moneyStory block.
- [x] No change to `MoneyStoryHero.tsx` — the consumer reads the same boolean from the same place.
- [x] No change to `quickMetrics` — D-43.4-4.
- [x] `npx tsc --noEmit` clean.

---

## 6. Behavioural impact (the user-visible change)

| Before Phase 43.4 | After Phase 43.4 |
|---|---|
| New user with $0 expenses defined → day count hidden ✅ | Same |
| User with $4,000/mo manually defined (3 recurring + 1 essential) → "47 days of life" shown ✅ | Same — manual_classification path satisfies |
| User with 3 weeks of BASIQ data, no manual classification → "47 days of life" shown ⚠️ (potentially wrong — annual bills not yet captured) | "Truly liquid right now" shown — no day claim |
| User with 4 months of BASIQ data → "47 days of life" shown ✅ | Same — bank_history path satisfies |
| User who linked BASIQ today + has 2 manual recurring expenses (none essential) → "47 days" shown ⚠️ | "Truly liquid right now" — neither mode satisfies |

The guarded case is small but real: the user with thin bank data and no manual classification was the one most likely to make a wrong decision off the day count, and is now protected.

---

## 7. References

- `docs/blueprint/PHASE_43_MONEY_STORY.md` §8 — original synthesis named the ≥90-day gate as a deferred follow-on.
- `lib/dashboard/expenseDataMaturity.ts` — the helper.
- `app/api/dashboard/insights/route.ts` — the consumer.
- CLAUDE.md §6.1 + §12.2 (SSOT), §16 (Doc-sync protocol).
