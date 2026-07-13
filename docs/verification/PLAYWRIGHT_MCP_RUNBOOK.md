# NeoAudit R3-agent — Playwright MCP runbook

> **The R3-agent node (NEOAUDIT.md §1.2):** agent-driven *exploratory* verification of a
> **golden-seeded preview**, run by a Claude session through **Playwright MCP** (Microsoft),
> headless, on **synthetic data ONLY**. It answers exactly one question — *"does anything look
> wrong on a golden-seeded preview?"* — and it holds **no permanent assertions**: the moment a
> discovery is repeatable it is **promoted** to an R2 spec (and deleted from R3). Every finding
> becomes a MON ticket via `npm run issues:raise`.
>
> This runbook is the operating procedure. The law is CLAUDE.md Part 23 + NEOAUDIT.md §1–§7.
> When they disagree, CLAUDE.md wins.

## Where R3-agent sits (and where it must NOT stray)

| Node | Data | Assertions | This runbook? |
|---|---|---|---|
| **R2-num / R2-vis** | golden seed | **permanent**, checked-in Playwright specs | no — that's the *destination* of promotion |
| **R3-agent** | golden seed (synthetic) | **none permanent** — exploratory only | **this** |
| **R3-eyes** | Reza's **real** data, his browser | none — human judgment | no — see `VERIFICATION_PLAYBOOK.md` §3 |

Two absolute boundaries (NEOAUDIT §1.3):

1. **Synthetic data ONLY.** R3-agent NEVER touches real or CDR data — that boundary is reserved
   for R3-self (first-party code) and R3-eyes (Reza's own browser). A Playwright MCP session must
   run against a **golden-seeded preview**, never production, never a real account. If you cannot
   confirm the target is golden-seeded, **stop**.
2. **No permanent assertions live here.** R3-agent does not grow a test suite. A repeatable check
   is **promoted down** to R2 (checked-in Playwright spec) or R0 (fixture) and then **removed** from
   the R3 scope — promotion, not duplication (§1.3 rule 2/3).

## Prerequisites

- **Playwright MCP** available in the session (`mcp__playwright__*` tools). If absent, R3-agent
  cannot run this session — note it and fall back to R3-eyes (Chrome relay) / R2 specs.
- **A golden-seeded preview URL.** Options, in order of preference:
  - a preview deployment seeded with the Golden Household "Avalon" (`tests/golden/goldenHousehold.ts`)
    via a seed endpoint/script (synthetic account, known manifest — `EXPECTED` in that file);
  - a local `next dev` against a golden-seeded dev DB.
  - **Never** a preview pointed at `monitrax-db-prod` or any real account.
- **The manifest.** The expected numbers come from `tests/golden/goldenHousehold.ts` `EXPECTED`
  (net worth 472,000; assets 992,000; liabilities 520,000; monthly income 10,400 / expenses 1,700;
  property cashflow −400/mo; safety score 70; health score 72). Every "actual" you read on the
  page is compared to this — never to a guess.
- **`@playwright/test`** is NOT yet a repo dependency (the R2 checked-in tier is deferred backlog).
  R3-agent via MCP does not require it; promotion to an R2 spec does (install it in the promotion PR).

## The run

1. **Confirm the target is golden-seeded** (open the account, verify net worth reads 472,000 — the
   manifest anchor). If it doesn't match the manifest, the seed is wrong: stop and fix the seed, do
   NOT report the mismatch as an app bug.
2. **Drive the app exploratorily** through Playwright MCP — mirror the Eyes & Ears *functional* +
   *visual* briefs (VERIFICATION_PLAYBOOK.md §3.3 Parts A–E, the §4 brief library), but on the
   **synthetic** account:
   - open every entity detail page (the MON-028 class — a tile can be right while the detail is wrong);
   - walk the sidebar top-to-bottom; expand every collapsible;
   - move each what-if lever and confirm the output moves in the **sensible direction** (UI
     metamorphic check), then Cancel/reset;
   - watch for: numbers that disagree across surfaces, a value that ≠ the manifest, sentinel leaks
     ("69 years", "999", "$0 repayment" on a loan), a control that dead-ends, a broken empty/loading
     state, dark-mode/truncation/alignment breakage (§18.7.2).
3. **Safety on synthetic data:** ephemeral surfaces (sliders, previews, filters) are unrestricted.
   Do NOT perform writes that corrupt the golden seed — no Save/Delete on a seeded record unless it
   is an explicitly-labelled, re-seedable `[ACTION]` step. Anything behind a destructive confirmation
   = hard stop, report instead.
4. **For each anomaly, capture evidence** — the surface (page/route), the manifest **expected**, the
   observed **actual**, and the preview/run id.

## Every finding → the registry (never a side-channel)

File each anomaly through the ONE finding bus (§1.3 rule 1):

```
npm run issues:raise -- --node "R3-agent Playwright MCP" \
  --title "<what looks wrong>" --area <domain> --surface "<page/route>" \
  --semantic-key <graph node id if known> --expected <manifest value> \
  --actual <observed> --run <preview/run id>
```

`issues:raise` de-dups by semanticKey+surface, so re-finding the same thing across runs does not
spawn duplicates. If the number isn't yet modelled in the Neomatrix, `issues:raise` records it in
`notes` as "MODEL then attach (§21.5)" — model it, don't guess.

## The promotion ratchet (the point of R3-agent)

R3-agent is a *net*, not a *suite*. The moment a finding is **repeatable**, it stops being an R3
check and becomes a permanent lower-ring test — this is the zero-fail Ratchet (Part 23 §23.2 rule 2):

| What you found | Promote to | In the fix PR |
|---|---|---|
| a wrong **number** on a rendered page | **R2-num** — a checked-in Playwright spec asserting the manifest value on the golden seed (install `@playwright/test`) | + the MON ticket's holistic test |
| a **visual** regression (layout, dark mode, truncation) | **R2-vis** — a `toHaveScreenshot()` baseline | |
| a wrong **formula** behind the number | **R0** — a calc-audit fixture / fast-check property | |
| a wrong **advice/decision** | a **decision-table** row (§3) | |

After promotion, R3-agent **never re-checks** that item — the lower ring owns it. R3-agent's value
is finding the *next* unknown, not re-running known checks.

## What R3-agent must never do

- assert numeric correctness as a permanent suite (that's R2-num/R0 — anti-overlap, §1.3 rule 5);
- run against real/CDR data (that's R3-self / R3-eyes — §1.3 rule 4);
- report a seed mismatch as an app bug (fix the seed first);
- route a finding anywhere but the registry (§1.3 rule 1);
- leave a repeatable check living at R3 instead of promoting it (§1.3 rule 3).
