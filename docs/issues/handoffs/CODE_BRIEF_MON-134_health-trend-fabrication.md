# CODE BRIEF — MON-134: the health-score trend is fabricated (blocks every MON-131 tranche diff)

**Model: Fable 5. Branch off `main`.**
**changesNumbers: YES** — a currently-random number becomes either a real one or absent.
**Priority: blocks MON-131 Tranche 1.** Nothing in the programme can proceed until this lands.

---

## §1 How it was found — and why that matters

The Matrix Relay's first `A3` self-diff, run against Reza's real production data on
`c9a464c2`: capture the canonical trees, wait, capture again, diff. **Nothing changed in the
database between the two captures.**

- **1,767 leaves identical.**
- **15 leaves moved.**

All fifteen in one subtree:

```
lib/health/aggregateEngine.ts:generateHealthReport
  .healthScore.trend.changePercent
  .healthScore.trend.history[0..6].score
  .evidence.historicalTrend[0..6].score
```

This is the golden baseline doing exactly the job it was built for, on its first run.

## §2 Root cause — traced, not inferred

`lib/health/aggregateEngine.ts:157`:

```ts
export function calculateTrend(currentScore: number): ScoreTrend {
  // In production, this would fetch historical scores from database
  // For now, return a stable trend
  const history: TrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now); date.setMonth(date.getMonth() - i);
    history.push({
      date,
      score: currentScore + (Math.random() - 0.5) * 5,   // ← invented
    });
  }
  // direction is then derived FROM the invented numbers:
  const change = avgRecent - avgOlder;
  if (change > 2) direction = 'IMPROVING';
  else if (change < -2) direction = 'DECLINING';
  else direction = 'STABLE';
  return { direction, changePercent: Math.round(change * 10) / 10, periodMonths: 6, history };
}
```

Seven months of history are generated from today's score plus random noise, and the
**IMPROVING / DECLINING / STABLE verdict and `changePercent` are computed from that noise.**
The comment is honest about it; the output is not.

Called once, at `aggregateEngine.ts:323`, inside `generateHealthReport` — the canonical health
engine. The result is passed to `generateEvidencePack` (`:348`) and surfaces as
`evidence.historicalTrend`. `generateHealthReport` is served by `app/api/financial-health/route.ts:56`
and consumed twice by `lib/cfo/intelligenceEngine.ts` (`:98`, `:329`).

**Coverage boundary, stated precisely (§22.2.4):** a grep of `app/` and `components/` for
`historicalTrend`, `trend.history`, `trend.direction` and `changePercent` in `.tsx` returned
**nothing**. So the fabricated values are emitted by a canonical engine, served by a live API and
fed into the CFO intelligence engine, but **it is NOT established that any screen renders them.**
Establish that during the build — if a surface does render them, say so in the PR; if none does,
say that too. Do not assume either way.

## §3 Why this is Tranche-blocking, not cosmetic

MON-131's entire control mechanism is the three-outcome golden-baseline diff: *unchanged* ·
*changed and pre-declared* · *changed and undeclared → STOP*. A producer whose output differs on
every call means **every tranche diff returns STOP on noise**, and the one instrument that would
catch a real regression becomes something the team learns to ignore.

## §4 Reza's decision (2026-07-29) — record it as D15

> *"let's score monthly based on a real number and formula. not invention."*

**Build the real thing. Do not delete the trend and do not seed it with a placeholder.**

### 4.1 Persist the score

A `HealthScoreSnapshot` model — one row per user per month, written once, **never read back as
the live value**. This is the audit-snapshot exception that `REFERENCE_NUMBERS_DESIGN.md` §3.2
already permits, and the pattern `netWorthHistory` already follows. Copy that model's shape,
retention and write path rather than inventing a second convention.

Store the score, its risk band, the schema version of the formula that produced it, and the
captured-at timestamp. **The formula version matters:** MON-131 will change the inputs the score is
built from, so a trend that silently spans two different formulas would be its own fabrication.
When the version changes, the chart must show the break, not smooth over it.

**Schema migration — Reza's click.** Ship the migration in its own PR, ahead of the read path.

### 4.2 Write path

Monthly, per user, from the canonical `generateHealthReport` score. Idempotent per (user, month) —
re-running must not create a second row or change an existing one.

### 4.3 Read path

`calculateTrend` takes stored snapshots, not a scalar. Signature changes from
`calculateTrend(currentScore: number)` to something that reads real rows.

- **Fewer than 2 snapshots:** return `direction: 'INSUFFICIENT_HISTORY'`, an empty `history`, and
  **no `changePercent`**. The type must make the absent case representable — do not return `0`, and
  do not fall back to `'STABLE'`. A confident-looking zero is the same defect in a new costume.
- **2 or more:** direction and `changePercent` derived from real stored scores only.
- **Spanning a formula-version change:** mark the break explicitly.

### 4.4 The permanent guard

**`generateHealthReport` must be deterministic for a fixed database state** — call it twice, get
byte-identical output. Add that as a test, and add a lint or test that fails on `Math.random()`
anywhere under `lib/` outside seeding and fixtures. This class must not be able to return.

## §5 Verification

- Relay `A3` self-diff returns **`verdict: "CLEAN"`** on Reza's real data. **That is the acceptance
  test for this brief** — not a unit test, the live self-diff.
- Determinism test: two `generateHealthReport` calls on identical input are byte-identical.
- Insufficient-history test: a user with 0 and with 1 snapshot gets `INSUFFICIENT_HISTORY`, never a
  number.
- Idempotency test: the monthly writer run twice in the same month leaves one row, unchanged.
- `census:producers:check`, `lint:source-lock`, `neomatrix:check`, `issues:check` green.

## §6 Registry

File as **MON-134**, severity **high**, area `health`, `changesNumbers: true`. Add it to
`.audit/matrix-registry-delta-2026-07-29.json` so it lands with the same reconciliation run, and
record **D15** in `REFERENCE_NUMBERS_DESIGN.md` §6:

> **D15** — The health-score trend is built from **stored monthly snapshots of the real score**,
> never generated. Where history is insufficient the UI says so rather than showing a number.
> Snapshots carry the formula version; a trend spanning a version change shows the break.
> *Reza, 29 Jul — DECIDED.*

Also still pending on that reconciliation run: `node scripts/matrix/registry-reconcile.mjs`
(merged in #1527, not yet executed — the registry still reads 113).

## §7 Neo-sync (§21.2.2)

Neomatrix re-pin for `calculateTrend`'s changed signature and the new snapshot writer; NeoAudit
gains the determinism ratchet and the `Math.random()` guard as a permanent bug-class promotion;
changelog + `0·REF` workstream entry. Nothing sandbox-only.

---
*Prepared by The Matrix, 2026-07-29, from relay self-diff `A3` at `c9a464c2` against user
`91b6d7ce` (Reza). Capture verified as real data — net worth 3,401,781.52, total assets
5,461,679.43, taxable income 145,426.40, Medicare levy 2,908.53, all matching VR-041.*
