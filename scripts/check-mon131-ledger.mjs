#!/usr/bin/env node
/**
 * check-mon131-ledger.mjs — MON-131 ledger freshness gate.
 *
 * Reza directive 2026-07-31: "I need you to document all changes for MON-131
 * and keep it updated."
 *
 * WHY A GATE AND NOT A RULE. The rule already existed — MON-131_TRANCHE_LEDGER
 * §1 says no cell is filled without evidence, and §6 says every MON-131 PR adds
 * a row. Rules that depend on remembering are the failure mode CLAUDE.md §20.6
 * diagnosed in itself: "the failure was never missing rules — it was NOT
 * CHECKING them before shipping." This makes the check mechanical.
 *
 * WHAT IT ENFORCES. If the diff against the merge-base touches a MON-131
 * surface, docs/implementation/MON-131_TRANCHE_LEDGER.md must be in the same
 * diff. That is all.
 *
 * WHAT IT DOES NOT DO — stated precisely (§22.2.4). It does NOT judge whether
 * the ledger row is truthful, evidenced, or even related to the change. A
 * machine cannot distinguish a real evidence row from a placeholder; that is
 * §1's job and the reviewer's. This closes the failure mode that actually
 * recurs (the ledger silently falling behind the programme), not the one it
 * cannot see. It is also diff-scoped: a MON-131 change with no file overlap at
 * all is invisible to it.
 *
 * Usage:
 *   node scripts/check-mon131-ledger.mjs              # warn, exit 0
 *   node scripts/check-mon131-ledger.mjs --strict     # fail, exit 1
 *   node scripts/check-mon131-ledger.mjs --base=<ref> # override the base ref
 */
import { execSync } from 'node:child_process';

const LEDGER = 'docs/implementation/MON-131_TRANCHE_LEDGER.md';

/** Paths whose change is, by definition, a MON-131 programme change. */
const SURFACES = [
  /^lib\/income\/banked\//,
  /^lib\/matrix\//,
  /^app\/api\/admin\/matrix\//,
  /^scripts\/matrix\//,
  /^scripts\/census\//,
  /^\.audit\/expected-moves-t1\.json$/,
  /^\.audit\/producer-census\.json$/,
  /^docs\/architecture\/MON-131_BUILD_SPECIFICATION\.md$/,
  /^docs\/architecture\/NUMBER_INVENTORY(_SPEC)?\.md$/,
  /^docs\/architecture\/REFERENCE_NUMBERS(_DESIGN|_DECISIONS)?\.md$/,
  /^docs\/architecture\/contracts\//,
  /^docs\/issues\/handoffs\/CODE_BRIEF_MON-131/,
  /^docs\/verification\/runs\//,
  /^docs\/verification\/briefs\//,
];

/**
 * MON ids whose registry movement is a MON-131 programme change.
 *
 * RANGE, not a list. The first version hard-coded 127…141 and was stale within
 * the hour: MON-142 (the stale stored-rate defect) was raised out of T2's §2.1
 * investigation and the gate did not fire on it. A hand-maintained id list goes
 * stale by construction — the same defect class this gate exists to catch.
 * MON-127 is where the programme's numbering starts; everything at or above it
 * is in scope unless explicitly excluded.
 */
const FAMILY_MIN = 127;
/** Ids at/above FAMILY_MIN that are NOT MON-131 work (extend with a reason). */
const FAMILY_EXCLUDE = new Set([]);
const isFamilyId = (n) => n >= FAMILY_MIN && !FAMILY_EXCLUDE.has(n);

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const baseArg = args.find((a) => a.startsWith('--base='));

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function resolveBase() {
  if (baseArg) return baseArg.slice('--base='.length);
  for (const ref of ['origin/main', 'main']) {
    const mb = sh(`git merge-base HEAD ${ref}`);
    if (mb) return mb;
  }
  return '';
}

const base = resolveBase();
if (!base) {
  console.log('[mon131-ledger] no base ref resolvable — skipping (not a failure)');
  process.exit(0);
}

const changed = sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean);
if (!changed.length) {
  console.log('[mon131-ledger] empty diff — nothing to check');
  process.exit(0);
}

const touchedSurfaces = changed.filter((f) => SURFACES.some((re) => re.test(f)));

// A registry edit only counts when a MON-131-family issue actually moved.
//
// This compares the PARSED registry either side of the diff, per issue id.
// The first version grepped the textual diff for `"MON-nnn"`, which only ever
// matched when the *id line itself* changed — i.e. on ADD. A status move
// (MON-142 OPEN → DIAGNOSED) edits `status`/`semanticKeys`/`plain` and leaves
// the id line untouched, so the gate stayed silent on exactly the lifecycle
// transitions it exists to catch. Structural comparison has no such blind spot.
let registryReason = '';
if (changed.includes('docs/issues/ISSUES.json')) {
  const parse = (text) => {
    try {
      const issues = JSON.parse(text)?.issues ?? [];
      return new Map(issues.map((i) => [i.id, JSON.stringify(i)]));
    } catch {
      return null; // unparseable either side → fall through to the safe default
    }
  };
  const before = parse(sh(`git show ${base}:docs/issues/ISSUES.json`));
  const after = parse(sh(`git show HEAD:docs/issues/ISSUES.json`));

  if (before && after) {
    const moved = [];
    for (const [id, json] of after) {
      const n = Number(String(id).slice(4));
      if (!Number.isFinite(n) || !isFamilyId(n)) continue;
      if (before.get(id) !== json) moved.push(id);
    }
    for (const [id] of before) {
      const n = Number(String(id).slice(4));
      if (Number.isFinite(n) && isFamilyId(n) && !after.has(id)) moved.push(`${id} (removed)`);
    }
    if (moved.length) registryReason = `registry movement on ${moved.sort().join(', ')}`;
  } else {
    // Could not parse one side — assume in scope rather than silently pass.
    registryReason = 'registry changed (ISSUES.json unparseable on one side — assuming in scope)';
  }
}

const reasons = [
  ...touchedSurfaces.map((f) => `touched ${f}`),
  ...(registryReason ? [registryReason] : []),
];

if (!reasons.length) {
  console.log('[mon131-ledger] OK — no MON-131 surface in this diff');
  process.exit(0);
}

if (changed.includes(LEDGER)) {
  console.log(`[mon131-ledger] OK — ledger updated alongside ${reasons.length} MON-131 change(s)`);
  process.exit(0);
}

const msg =
  `MON-131 change with no ledger update. This diff ${reasons.slice(0, 6).join('; ')}` +
  `${reasons.length > 6 ? `; +${reasons.length - 6} more` : ''}, but ${LEDGER} is unchanged. ` +
  `Add the row to §6 (with its SHA) and update the §3 gate cell it affects — same PR, per ledger §1/§6.`;

if (strict) {
  console.error(`::error::${msg}`);
  process.exit(1);
}
console.log(`::warning::${msg}`);
process.exit(0);
