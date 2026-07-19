# INTAKE-INTEGRITY GUARDRAIL — the wall (root cause → controls → defaults → ratchets)

> **Owner:** The Matrix (spec) · builds in Code (Fable 5, architectural) · **Principle:** prevention, not number-fixing.
> The goal is that the NEXT user's first import is classified safely — the whole bug class cannot recur, proven by a build gate, not by discipline. Reza's healed numbers are the test fixture, not the deliverable.

## 0. Root cause (systemic — one cause behind many issues)
Every recurring class originates in the **intake/import layer**, because there is **no shared classifier**:
- **MON-001** — weekly/fortnightly rent stored as `MONTHLY` (~54%+ off). *(Verified: `lib/utils/frequencies.ts` `toAnnual` is CORRECT — WEEKLY×52, FORTNIGHTLY×26; the defect is that intake STORES `MONTHLY`.)*
- **MON-023 → 037 → 053** — one-off deposit stored `isRecurring=true / MONTHLY` → ×12 phantom. Fixed symptom-by-symptom, kept respawning.
- **MON-076 / 037** — each imported payment/link mints a NEW row instead of reusing the stream → duplicate/fragmented rows.
Cadence detection exists (`transactionPattern.detectedFrequency`, MON-025) but is wired **only** at `TransactionLinkDialog` — the other producers default blindly.

## 1. Intake surfaces (every producer that writes Income/Expense — re-verify live)
P1 `app/api/income/route.ts:240` (+ `[id]` PUT) · P2 `app/api/transactions/[id]/link/route.ts:417` · P3 `app/api/documents/analyze/confirm/route.ts:459` · P4 `app/api/onboarding/complete/route.ts:230` · P5 `lib/db/tenant.ts:168` · the expense equivalents · Gate UI `components/transactions/TransactionLinkDialog.tsx`.

## 2. The control — ONE canonical classifier every producer MUST call
Create `lib/intake/classifyIntake.ts`: `classifyIntake(signal) -> { frequency, isRecurring, streamMatch }`. **No producer may write `frequency`/`isRecurring` or create a row except through it.** Three controls:
- **C1 — Cadence (kills MON-001):** derive frequency from evidence. ≥2 same-source txns → detected cadence from date deltas (promote the existing `transactionPattern` logic here); manual → the user's explicit choice; **never a silent `MONTHLY`.** Weekly/fortnightly are **stored as `WEEKLY`/`FORTNIGHTLY`**, never coerced to monthly.
- **C2 — Recurrence (kills MON-023/037/053; source-aware, Reza-decided):** manual/declared → `isRecurring=true`; single-transaction import → `isRecurring=false` (one-off); never silent recurring-monthly. *(Partly shipped #1421.)*
- **C3 — Stream reuse / near-duplicate (kills MON-076/037):** before minting, match against existing rows for the same owner/property + payee/category; canonical match → **reuse/update, don't create a sibling**; near-duplicate → surface for **user-reviewed** merge (never auto-merge — some same-name rows are genuinely separate).

## 3. Safe defaults (the default table)
| Field | Old unsafe default | New safe default |
|---|---|---|
| `frequency` | `MONTHLY` (silent) | from evidence; single-txn → one-off; else explicit; **weekly/fortnightly preserved** |
| `isRecurring` | `true` (silent) | manual = `true`; single-import = `false` |
| row creation | always mint new | reuse canonical match; near-dup → user-review; else create |

## 4. Ratchets (the wall stays up — regression fails CI, not review)
- **R1 — Build-gate intake source-lock (Ring-1) [the keystone]:** assert **every** Income/Expense `create` in the producer set routes through `classifyIntake` — a raw `prisma.income/expense.create` carrying a literal `'MONTHLY'` or bypassing the classifier **fails the build.** Extends MON-053's annualisation source-lock to the intake sites. Makes bypass impossible.
- **R2 — Standing NeoAudit "intake-integrity" suite (Part 23) — 3 live-data detectors:**
  - **D1** recurring row backed by a single `$0`-actuals txn → **MON-075**.
  - **D2** stored `frequency` ≠ cadence implied by the row's transactions → **MON-001 detector**.
  - **D3** near-duplicate rows for one stream → **MON-076 detector**.
  Each flags in NeoAudit + an optional UI nudge.
- **R3 — Golden-household fixtures (Ring-0/2):** add a weekly rent, a single ATO deposit, and a fragmented stream to the Golden Household; assert `classifyIntake` handles each; Float/Decimal parity.

## 5. The bricks — issues mapped to the wall
| Brick | Issue | Status |
|---|---|---|
| Source-aware recurrence default + one-off gate (C2) | MON-053 | ✅ shipped #1421 |
| Ring-1 annualisation source-lock | MON-053 | ✅ shipped #1421 |
| Stream-reuse for expenses (battery) (C3, expense) | MON-037 RC-B | ✅ mechanism shipped #1427 |
| One-off standing detector (D1) | MON-075 | build |
| Frequency control (C1) + preserve weekly/fortnightly + D2 + freq source-lock | MON-001 | build — **critical, biggest live impact** |
| Stream-reuse+near-dup for income (C3) + D3 + user-review merge | MON-076 | ✅ mechanism shipped 2026-07-19 (Mechanism-A keystone: `source-signature` policy + scope-compatibility rule; existing-duplicate merge = Part 2, Reza-gated per group) |
| **Canonical `classifyIntake()` + intake source-lock (R1)** | **raise MON-078** | build — **the keystone** |

## 6. Build sequence (Code session · one PR per brick · handback to Matrix for the validating Ring-3)
1. **Raise MON-078** (the keystone: canonical classifier + intake source-lock).
2. **Build `classifyIntake()`** + route ALL producers (P1–P5 + expense) through it + **R1 source-lock**. Behaviour-preserving where already correct; the per-brick controls then plug into it. *(Fable 5 — architectural.)*
3. **MON-001** cadence control (C1) + D2 detector — critical.
4. **MON-075** one-off detector (D1).
5. **MON-076** stream-reuse (C3) + D3 + user-reviewed merge (Reza's fix-shape) — feed the census (Thornland Lot 1 rent ×4, Ingeus salary ×3, Broadbeach rent ×2).
6. **R3** Golden-household fixtures.
Each PR ships **the control + its ratchet together**; hand back to the Matrix for the Ring-3 that **validates the guardrail on live data** — not the number.

## 7. Definition of done (the whole wall)
Every intake producer routes through `classifyIntake` (source-lock enforced in CI) · no silent `MONTHLY`, no silent recurring, no blind mint-new-row · the 3 detectors run in NeoAudit · the Golden Household reproduces + guards each trap. **Then the class cannot recur for any future user — proven by the build gate, not by discipline.**
