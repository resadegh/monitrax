#!/usr/bin/env node
/**
 * MATRIX REGISTRY RECONCILIATION — 2026-07-29
 *
 * The Matrix's working registry reached 123 issues; the repo's is at 113. The gap
 * is MON-127…133 (raised in the Matrix session and never pushed, because a sandbox
 * clone was clobbered by a `git checkout origin/main -- .`) plus the VR-041
 * verdicts on MON-125/126.
 *
 * This script is DATA-DRIVEN and IDEMPOTENT. It never invents an issue: every
 * definition comes from `.audit/matrix-registry-delta-2026-07-29.json`, written
 * by the Matrix. Running it twice is a no-op.
 *
 * MON-115…124 are NOT restored here. They were destroyed in the same clobber and
 * seven of the ten were demoted to observations under the holistic-verification
 * law (an untraced cross-surface difference is not a finding). They survive in
 * docs/verification/runs/VR-040.md and are re-filed only after re-tracing.
 *
 * RUN:  node scripts/matrix/registry-reconcile.mjs
 *       npm run issues:generate && npm run issues:check
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY = resolve(ROOT, 'docs/issues/ISSUES.json');
const DELTA = resolve(ROOT, '.audit/matrix-registry-delta-2026-07-29.json');

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const delta = JSON.parse(readFileSync(DELTA, 'utf8'));
const byId = new Map(registry.issues.map((i) => [i.id, i]));

let added = 0;
let skipped = 0;
for (const issue of delta) {
  if (byId.has(issue.id)) {
    skipped++;
    console.log(`  = ${issue.id} already present — left untouched`);
    continue;
  }
  registry.issues.push(issue);
  byId.set(issue.id, issue);
  added++;
  console.log(`  + ${issue.id} ${issue.severity.padEnd(8)} ${issue.title.slice(0, 78)}`);
}

// ── VR-041 verdicts (docs/verification/runs/VR-041.md) ──────────────────────
// Ring-3 on PR #1523 landed on the predicted figures exactly:
// committed $14,261 · loans $12,779 · one-offs $0 · recurring essentials $1,482.
const VR041 = {
  'MON-125':
    'VR-041 Ring-3 PASS. The budget generator now consumes the canonical producers: ' +
    'the one-off gate holds (one-off contribution $0), loans resolve actuals-first ' +
    '($12,779/mo against the canonical aggregate), recurring essentials $1,482/mo, ' +
    'committed $14,261/mo — every figure landed on the pre-declared prediction.',
  'MON-126':
    'VR-041 Ring-3 PASS. aggregateExpensesByCategory now applies the isRecurring gate, ' +
    'so the Pareto breakdown equals the recurring run-rate rather than total spend.',
};

let promoted = 0;
for (const [id, note] of Object.entries(VR041)) {
  const issue = byId.get(id);
  if (!issue) {
    console.error(`  ! ${id} not in registry — cannot record its verdict`);
    process.exitCode = 1;
    continue;
  }
  if (issue.status === 'VERIFIED' || issue.status === 'CLOSED') {
    console.log(`  = ${id} already ${issue.status}`);
    continue;
  }
  issue.status = 'VERIFIED';
  issue.verified = '2026-07-29';
  issue.tracker = 'neoaudit-run:VR-041';
  issue.notes = issue.notes ? `${issue.notes} | ${note}` : note;
  promoted++;
  console.log(`  ^ ${id} → VERIFIED`);
}

writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`);
console.log(
  `\nregistry-reconcile: +${added} added, ${skipped} already present, ` +
    `${promoted} promoted → ${registry.issues.length} issues total.`,
);
console.log('next: npm run issues:generate && npm run issues:check');
