#!/usr/bin/env node
/**
 * Q-SCOPE-1 — insert the Open Questions row for the Product Scope v1 recommendation.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMITTED EDIT
 * `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` is ~74 KB. The GitHub connector used by
 * Cowork sessions cannot carry a file that size without the session re-emitting content it has not
 * fully read — which risks silently corrupting the spoke. The established pattern for this class of
 * change is an idempotent script (see `scripts/matrix/vr038-039-advance.mjs` for the precedent).
 *
 * WHY scripts/dev/ AND NOT scripts/matrix/
 * `scripts/check-mon131-ledger.mjs:40` treats `^scripts/matrix/` as a MON-131 surface, so anything
 * placed there requires a same-PR row in `docs/implementation/MON-131_TRANCHE_LEDGER.md` §6. This
 * script is not MON-131 work — a row for it would pollute the programme's state of record. It lives
 * here instead. (Caught by CI on PR #1577; the gate was correct.)
 *
 * WHAT IT DOES
 * Inserts one row as the first data row of the "❓ Open Questions (strategic, not yet decided)"
 * table, recording Q-SCOPE-1 per CLAUDE.md §15.3 ("surface a new strategic question the user hasn't
 * decided → add it to ❓ Open Questions"). Changes nothing else.
 *
 * IDEMPOTENT: re-running after a successful run is a no-op (exit 0, "already present").
 * NON-DESTRUCTIVE: refuses to write if the anchor row is not found exactly once.
 *
 * USAGE
 *   node scripts/dev/q-scope-1-open-question.mjs            # apply
 *   node scripts/dev/q-scope-1-open-question.mjs --check    # report only, never writes
 *
 * Refs: docs/strategy/PRODUCT_SCOPE_V1_RECOMMENDATION.md · PR #1577
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGET = resolve(process.cwd(), 'docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md');
const CHECK_ONLY = process.argv.includes('--check');

const MARKER = '| Q-SCOPE-1 |';
const ANCHOR = '| Q-SCAN-FREQ |';

const ROW = [
  '| Q-SCOPE-1',
  ' Should Monitrax ship **one module (Property) to market first**, with every other module hidden in PROD behind an admin toggle and staged back in later — and if so, exactly what is kept in v1? ',
  " Raised by an external accountant's review (relayed by Reza, 2026-08-03): the app is too wide, too manual, and its numbers cannot be validated. The repo agrees in writing — `MON-131`'s census records **~336 producers across 23 quantities, 22 of 23 MULTIPLE**, the registry holds **63 OPEN/FIXING issues (6 critical)** at HEAD `1e2317b6`, and Basiq is dark by GTM decision so all intake is manual (`GTM_EXECUTION_PLAN.md:34-38`). Scoping to property is uniquely viable: property surfaces do **not** read the household/tax/master-snapshot layers, `computePropertyCashflow` is already the SSOT, and the document module is genuinely property-aware. **The decision matters most because it sets MON-131's denominator** — hiding UI alone does not reduce producer count; a written scope freeze does. Full four-lens analysis, keep/hide/stage list, module-gate build shape, Propsight read and risks: **`docs/strategy/PRODUCT_SCOPE_V1_RECOMMENDATION.md`**. The read-only scope filter that sizes the surviving work: **`docs/strategy/MON-131_SCOPE_FILTER.md`**. ",
  " **OPEN — raised 2026-08-03.** **SEQUENCE CONFIRMED by Reza 2026-08-03:** finish MON-131 FIRST, then module hiding, then property-only focus — chosen to protect MON-131's G7/G8/G9 baselines, which are calibrated on the current surface set and would need re-baselining if surfaces were hidden mid-programme. Still undecided: the **keep list** itself (§2.1 of the recommendation). **MERGE TRIGGER for PR #1577:** merge when Reza rules on the keep list — i.e. at MON-131's defined finish line, when the hiding phase starts. Until then the PR stays OPEN as the parked plan; the recommendation is not in force. |",
].join(' |');

function main() {
  let src;
  try {
    src = readFileSync(TARGET, 'utf8');
  } catch (err) {
    console.error(`FAIL: cannot read ${TARGET} — ${err.message}`);
    process.exit(1);
  }

  if (src.includes(MARKER)) {
    console.log('already present: Q-SCOPE-1 row exists — no change made.');
    process.exit(0);
  }

  const occurrences = src.split(ANCHOR).length - 1;
  if (occurrences !== 1) {
    console.error(
      `FAIL: expected exactly 1 anchor row starting "${ANCHOR}", found ${occurrences}. ` +
        'The spoke has changed shape — insert the row by hand (text in PR #1577) rather than guessing.'
    );
    process.exit(1);
  }

  if (CHECK_ONLY) {
    console.log('check: Q-SCOPE-1 row is MISSING and the anchor is unambiguous — safe to apply.');
    process.exit(0);
  }

  const out = src.replace(ANCHOR, `${ROW}\n${ANCHOR}`);
  writeFileSync(TARGET, out, 'utf8');
  console.log(`applied: Q-SCOPE-1 row inserted above the ${ANCHOR.trim()} row in ${TARGET}.`);
}

main();
