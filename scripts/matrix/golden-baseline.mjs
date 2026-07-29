/**
 * MON-131 Tranche −1 — GOLDEN BASELINE CLI (REFERENCE_NUMBERS_DESIGN.md §10).
 *
 * THIN WRAPPER over `lib/matrix/goldenBaseline.ts` — the ONE capture/diff
 * implementation, shared with the admin Matrix-relay routes
 * (`/api/admin/matrix/*`, Tranche −1b). All capture keys, serialization, and
 * the three-outcome diff live in that module; this file only does argv, file
 * I/O, and exit codes. Never re-implement capture logic here.
 *
 * RUN (requires DATABASE_URL — the Matrix/Reza side; the cloud sandbox has none):
 *   npx tsx scripts/matrix/golden-baseline.mjs                 # capture
 *   npx tsx scripts/matrix/golden-baseline.mjs --user <id>     # if >1 user
 *   npx tsx scripts/matrix/golden-baseline.mjs --diff .audit/golden-baseline-<oldsha>.json \
 *       [--expected .audit/expected-moves-trancheN.json]       # post-tranche diff
 *
 * Three outcomes, only three (brief §11.2): unchanged · EXPECTED (pre-declared
 * in the --expected file) · MOVED-UNDECLARED → exit 1, STOP.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const DIFF = flag('diff');
const EXPECTED = flag('expected');
const USER = flag('user');
const OUT = flag('out');

const sha = () => execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const latestBaselinePath = () => `.audit/golden-baseline-${sha()}.json`;

// ── diff mode (pure file work — no DB needed) ───────────────────────────────
if (DIFF) {
  const { diffBaselines } = await import('../../lib/matrix/goldenBaseline.ts');
  const oldDoc = JSON.parse(readFileSync(resolve(ROOT, DIFF), 'utf8'));
  const newDoc = JSON.parse(readFileSync(resolve(ROOT, OUT || latestBaselinePath()), 'utf8'));
  const expected = EXPECTED ? JSON.parse(readFileSync(resolve(ROOT, EXPECTED), 'utf8')) : [];

  const d = diffBaselines(oldDoc.captures, newDoc.captures, expected);
  console.log(`golden-baseline diff: verdict ${d.verdict}`);
  console.log(`  unchanged: ${d.unchanged}`);
  for (const c of d.declared) console.log(`  EXPECTED  ${c.path}: ${c.old} → ${c.new}`);
  for (const p of d.added) console.log(`  ADDED     ${p} (new leaf — verify it is a new capture, not a renamed one)`);
  for (const p of d.removed) console.log(`  REMOVED   ${p} (verify: deleted producer or renamed leaf?)`);
  for (const c of d.unexpected) console.log(`  ✗ MOVED-UNDECLARED ${c.path}: ${c.old} → ${c.new}`);
  if (d.verdict === 'STOP') {
    console.error(`\n✗ ${d.unexpected.length} figure(s) moved with NO expectedMoves entry — STOP (brief §11.2). A defect until proven otherwise.`);
    process.exit(1);
  }
  console.log('\n✓ every movement pre-declared (or none). Proceed.');
  process.exit(0);
}

// ── capture mode ────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL && !process.env.USE_CLOUD_SQL_CONNECTOR) {
  console.error('golden-baseline: DATABASE_URL is not set. This capture must run where the real');
  console.error('database is reachable (Reza local / the Matrix relay) — the cloud sandbox cannot.');
  process.exit(2);
}

const { captureGoldenBaseline, resolveSoleUserId, numericLeaves, RENDERED_PART_C } =
  await import('../../lib/matrix/goldenBaseline.ts');

let userId = USER;
if (!userId) {
  let r;
  try {
    r = await resolveSoleUserId();
  } catch (e) {
    console.error('golden-baseline: cannot reach the database — ' + String(e && e.message || e).split('\n').pop());
    process.exit(2);
  }
  if ('candidates' in r) {
    console.error(`golden-baseline: ${r.candidates.length} users found — pass --user <id>. Candidates:`);
    for (const u of r.candidates) console.error(`  ${u.id}  ${u.email}`);
    process.exit(2);
  }
  userId = r.userId;
}

const captures = await captureGoldenBaseline(userId);
for (const [key, val] of Object.entries(captures)) {
  const failed = val && typeof val === 'object' && '__captureError' in val;
  console.log(failed ? `  ✗ ${key} — ${String(val.__captureError).slice(0, 120)}` : `  ✓ ${key}`);
}

const outPath = OUT || latestBaselinePath();
mkdirSync(resolve(ROOT, '.audit'), { recursive: true });
writeFileSync(resolve(ROOT, outPath), JSON.stringify({
  meta: {
    sha: sha(),
    capturedAt: new Date().toISOString(),
    userId,
    coverage: 'canonical orchestrator trees (lib/matrix/goldenBaseline.ts header) — NOT all ~336 leaf producers individually',
  },
  renderedPartC: RENDERED_PART_C,
  captures,
}, null, 2) + '\n');

const m = new Map();
numericLeaves(captures, '', m);
console.log(`\ngolden-baseline: wrote ${outPath} — ${Object.keys(captures).length} capture(s), ${m.size} numeric leaves. COMMIT IT.`);

const { default: prisma } = await import('../../lib/db.ts');
await prisma.$disconnect?.();
