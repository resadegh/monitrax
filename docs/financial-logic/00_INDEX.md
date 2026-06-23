# Monitrax — Financial Logic Index (Master Reference)

> **Purpose.** A live, verified map of every calculation engine, formula, and
> financial function in Monitrax — what it produces, the exact inputs (units +
> types), the formula and its authority (ATO section / standard formula), who
> consumes it, and how its correctness was verified. This is the document an
> engineer (human or AI) reads **before touching any number**, and the reference
> used during a correctness audit, so the system can be understood and validated
> **without guessing or assuming** (CLAUDE.md §10, §19.2).
>
> **Why it exists.** Calculation drift (e.g. the 2026-06-23 `/cashflow` hero
> showing a declared +$10,505 surplus while the same page's waterfall showed an
> actual deficit) happens when a surface is added or changed without tracing it
> back to the canonical source. SSOT was *documented* in CLAUDE.md but never
> *anchored* in a single engine map. This index is that anchor.

---

## Operating rules for this document (READ FIRST)

1. **Documentation only.** This index records what the code does **today**. It
   never changes logic, law, formulas, or thresholds. If research surfaces a
   suspected bug, it is flagged here (`⚠️ SUSPECTED ISSUE`) and raised with the
   owner — **never silently fixed** (CLAUDE.md §19: no logic change without
   explicit confirmation).
2. **Research-first, never guess.** Every entry is written only after reading
   the **full** source file, its phase/architecture doc, tracing the input
   units/types from the schema + writer, and tracing the callers. Anything not
   independently verifiable is marked `⚠️ UNVERIFIED` with the reason.
3. **Every entry must carry:** Produces · Canonical accessor · Inputs (unit +
   type + convention) · Formula / rule (+ authority) · Key behaviours/gotchas ·
   Consumers · Verified-by · Status.
4. **Kept in sync per change.** Any PR that adds or changes a financial engine
   updates its entry here in the same PR (mirrors the §16 doc-sync rule). The
   `Last verified` date on each entry is the contract.
5. **Hub + spokes** (per §15.5 size discipline). This file is the hub: the
   master registry table + the rules. Detail lives in the per-domain spokes.

---

## Status legend

| Mark | Meaning |
|---|---|
| ✅ **DOCUMENTED** | Full entry written from a complete read of the source + verification evidence. |
| 🔶 **PENDING** | Listed in the registry; entry not yet researched/written. Do NOT trust an undocumented engine — read the source. |
| ⚠️ **SUSPECTED ISSUE** | Research surfaced a possible correctness problem; raised with owner, not yet resolved. |
| ⚠️ **UNVERIFIED** | Behaviour could not be independently confirmed (reason stated in the entry). |

---

## Spokes (per-domain detail)

| Spoke | Domain | Engines | Status |
|---|---|---|---|
| [`01_CORE_CALCULATIONS.md`](01_CORE_CALCULATIONS.md) | Net worth, cashflow (declared + actual + canonical), aggregators | 4 of ~10 documented | 🟡 in progress |
| `02_TAX_ENGINE.md` | Income tax, PAYG, Medicare, CGT, divisions, super, GST, land/stamp duty | not started | 🔶 |
| `03_HEALTH_ENGINE.md` | 7-category metric → score → risk | not started | 🔶 |
| `04_CFO_AND_SCENARIOS.md` | CFO score/action engines, decision support, what-if scenarios | not started | 🔶 |
| `05_INTELLIGENCE_AND_REPORTS.md` | Insights engine, cashflow intelligence, report generators | not started | 🔶 |
| `06_SERVICES_AND_ORCHESTRATION.md` | `masterFinancialService`, portfolio snapshot, emergency fund | not started | 🔶 |

> Spokes are created as each domain is researched. A domain with no spoke yet is
> **not** documented — read the source files directly and treat with the §19.2
> four-step discipline.

---

## How to use this index (for any financial change or audit)

1. Find the number you're touching in the registry → open its spoke entry.
2. Confirm the **inputs** (units/types) and the **formula/authority** match what
   you intend. If your change would alter the formula, **stop** — that needs
   explicit owner confirmation (§19).
3. Confirm you're consuming the **canonical accessor**, not re-deriving.
4. After the change, update the entry's Formula/Behaviour + `Last verified`
   date + Verified-by evidence in the same PR.

---

## Coverage tracker

| Domain | Files (approx) | Documented | % |
|---|---|---|---|
| Core calculations | ~10 | 4 | 40% |
| Tax engine | ~36 | 0 | 0% |
| Health engine | ~6 | 0 | 0% |
| CFO + scenarios | ~34 | 0 | 0% |
| Intelligence + reports | ~20 | 0 | 0% |
| Services / orchestration | ~3 | 0 | 0% |
| **Total** | **~109** | **4** | **~4%** |

> This is the honest starting point. The index grows domain-by-domain, each
> entry research-verified. Highest-risk domains first (per the 2026-06-23
> doc-coverage audit): **tax divisions** and **CFO scenarios** after core.

---

*Created 2026-06-23. Hub for the Financial Logic Index workstream
(`0·FIN-LOGIC-INDEX` in `docs/implementation/01_ACTIVE_WORKSTREAMS.md`).*
