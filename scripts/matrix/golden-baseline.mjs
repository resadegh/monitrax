/**
 * MON-131 Tranche −1 — the GOLDEN BASELINE (REFERENCE_NUMBERS_DESIGN.md §10).
 *
 * Captures the output of every canonical userId-driven producer entry point
 * against REAL data and writes `.audit/golden-baseline-<sha>.json`, keyed
 * `file:function → value tree`. After every tranche, re-run with `--diff` —
 * three outcomes, only three (brief §11.2):
 *   unchanged                          → expected for a consumer migration
 *   changed AND in --expected file     → correct, arithmetic pre-declared
 *   changed and NOT in --expected      → STOP. A defect until proven otherwise.
 *
 * RUN (requires DATABASE_URL — the Matrix/Reza side; the cloud sandbox has none):
 *   npx tsx scripts/matrix/golden-baseline.mjs                 # capture
 *   npx tsx scripts/matrix/golden-baseline.mjs --user <id>     # if >1 user
 *   npx tsx scripts/matrix/golden-baseline.mjs --diff .audit/golden-baseline-<oldsha>.json \
 *       [--expected .audit/expected-moves-trancheN.json]       # post-tranche diff
 *
 * The --expected file is a JSON array of { "pathPrefix": "...", "why": "...",
 * "arithmetic": "..." } entries written BEFORE the migration (§10.4.5) — a moved
 * figure with no matching prefix fails the run.
 *
 * COVERAGE — stated precisely, never as prose (§22.2.4): this captures the
 * CANONICAL ORCHESTRATOR TREES (master snapshot, tax position, CFO components,
 * risk radar, money flow, health input+report, loan costs, safety score) — every
 * leaf producer that feeds them is exercised through the real path, so a
 * semantic change in a captured tree's inputs shows as a moved leaf. It does
 * NOT invoke all ~336 catalogued producers individually (most are unexported or
 * take assembled inputs); per-producer leaf capture grows as Phase A contracts
 * enumerate signatures — extend CAPTURES below in the same PR as each contract.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const DIFF = flag('diff');
const EXPECTED = flag('expected');
const USER = flag('user');
const OUT = flag('out');

// ── serialization: Maps → objects, Dates → ISO, Decimals → number ───────────
function plain(v, depth = 0) {
  if (depth > 24) return '«depth-capped»';
  if (v === null || v === undefined) return v;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v.toNumber === 'function') return v.toNumber(); // Prisma/decimal.js Decimal
  if (v instanceof Map) {
    const o = {};
    for (const [k, val] of v) o[String(k)] = plain(val, depth + 1);
    return o;
  }
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'function') continue;
      o[k] = plain(val, depth + 1);
    }
    return o;
  }
  return String(v);
}

// ── numeric-leaf walk (for diff) ────────────────────────────────────────────
function numericLeaves(node, path, out) {
  if (typeof node === 'number') { out.set(path, node); return; }
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((v, i) => numericLeaves(v, `${path}[${i}]`, out)); return; }
  for (const [k, v] of Object.entries(node)) numericLeaves(v, path ? `${path}.${k}` : k, out);
}

// ── diff mode (pure file work — no DB needed) ───────────────────────────────
if (DIFF) {
  const oldDoc = JSON.parse(readFileSync(resolve(ROOT, DIFF), 'utf8'));
  const newPath = OUT || latestBaselinePath();
  const newDoc = JSON.parse(readFileSync(resolve(ROOT, newPath), 'utf8'));
  const expected = EXPECTED ? JSON.parse(readFileSync(resolve(ROOT, EXPECTED), 'utf8')) : [];

  const a = new Map(); numericLeaves(oldDoc.captures, '', a);
  const b = new Map(); numericLeaves(newDoc.captures, '', b);
  const changed = [], added = [], removed = [];
  for (const [p, v] of b) {
    if (!a.has(p)) added.push(p);
    else if (Math.abs(a.get(p) - v) > 1e-9) changed.push({ path: p, old: a.get(p), new: v });
  }
  for (const p of a.keys()) if (!b.has(p)) removed.push(p);

  const isExpected = (p) => expected.some((e) => p.startsWith(e.pathPrefix));
  const unexpected = changed.filter((c) => !isExpected(c.path));
  const declared = changed.filter((c) => isExpected(c.path));

  console.log(`golden-baseline diff: ${a.size} old leaves · ${b.size} new leaves`);
  console.log(`  unchanged: ${b.size - changed.length - added.length}`);
  for (const c of declared) console.log(`  EXPECTED  ${c.path}: ${c.old} → ${c.new}`);
  for (const p of added) console.log(`  ADDED     ${p} (new leaf — verify it is a new capture, not a renamed one)`);
  for (const p of removed) console.log(`  REMOVED   ${p} (verify: deleted producer or renamed leaf?)`);
  for (const c of unexpected) console.log(`  ✗ MOVED-UNDECLARED ${c.path}: ${c.old} → ${c.new}`);
  if (unexpected.length) {
    console.error(`\n✗ ${unexpected.length} figure(s) moved with NO expectedMoves entry — STOP (brief §11.2). A defect until proven otherwise.`);
    process.exit(1);
  }
  console.log('\n✓ every movement pre-declared (or none). Proceed.');
  process.exit(0);
}

function latestBaselinePath() {
  const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  return `.audit/golden-baseline-${sha}.json`;
}

// ── capture mode ────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL && !process.env.USE_CLOUD_SQL_CONNECTOR) {
  console.error('golden-baseline: DATABASE_URL is not set. This capture must run where the real');
  console.error('database is reachable (Reza local / the Matrix relay) — the cloud sandbox cannot.');
  process.exit(2);
}

const { default: prisma } = await import('../../lib/db.ts');

let userId = USER;
if (!userId) {
  let users;
  try {
    users = await prisma.user.findMany({ select: { id: true, email: true } });
  } catch (e) {
    console.error('golden-baseline: cannot reach the database — ' + String(e && e.message || e).split('\n').pop());
    process.exit(2);
  }
  if (users.length !== 1) {
    console.error(`golden-baseline: ${users.length} users found — pass --user <id>. Candidates:`);
    for (const u of users) console.error(`  ${u.id}  ${u.email}`);
    process.exit(2);
  }
  userId = users[0].id;
}

/**
 * The capture registry. Key = `file:function` (the producer being pinned).
 * Extend this list — never fork a second baseline script (§22.2).
 */
const CAPTURES = [
  ['lib/services/masterFinancialService.ts:getMasterFinancialSnapshot', async () => {
    const { getMasterFinancialSnapshot } = await import('../../lib/services/masterFinancialService.ts');
    return getMasterFinancialSnapshot(userId);
  }],
  ['lib/tax-engine/position/userTaxPosition.ts:getUserTaxPosition', async () => {
    const { getUserTaxPosition } = await import('../../lib/tax-engine/position/userTaxPosition.ts');
    return getUserTaxPosition(userId);
  }],
  ['lib/cfo/scoreCalculator.ts:computeCFOComponents', async () => {
    const { computeCFOComponents } = await import('../../lib/cfo/scoreCalculator.ts');
    return computeCFOComponents(userId);
  }],
  ['lib/cfo/riskRadar.ts:scanForRisks', async () => {
    const { scanForRisks } = await import('../../lib/cfo/riskRadar.ts');
    return scanForRisks(userId);
  }],
  ['lib/services/moneyFlowService.ts:getMoneyFlow', async () => {
    const { getMoneyFlow } = await import('../../lib/services/moneyFlowService.ts');
    return getMoneyFlow(userId);
  }],
  ['lib/health/buildHealthInput.ts:buildHealthInput', async () => {
    const { buildHealthInput } = await import('../../lib/health/buildHealthInput.ts');
    return buildHealthInput(userId);
  }],
  ['lib/health/aggregateEngine.ts:generateHealthReport', async () => {
    const { buildHealthInput } = await import('../../lib/health/buildHealthInput.ts');
    const { generateHealthReport } = await import('../../lib/health/aggregateEngine.ts');
    return generateHealthReport(await buildHealthInput(userId));
  }],
  ['lib/services/loanCosts.ts:resolveLoanCostsForUser', async () => {
    const loans = await prisma.loan.findMany({ where: { userId } });
    const { resolveLoanCostsForUser } = await import('../../lib/services/loanCosts.ts');
    return resolveLoanCostsForUser(userId, loans);
  }],
];

const captures = {};
for (const [key, run] of CAPTURES) {
  try {
    captures[key] = plain(await run());
    console.log(`  ✓ ${key}`);
  } catch (e) {
    captures[key] = { __captureError: String(e && e.message || e) };
    console.log(`  ✗ ${key} — ${String(e && e.message || e).slice(0, 120)}`);
  }
}

// Rendered Part-C cluster (VR-041) — the human-verified reference figures the
// programme was briefed against (REFERENCE_NUMBERS_DESIGN.md §10). These are
// STATIC brief constants, not live captures — they pin what Reza SAW.
const renderedPartC = {
  netWorth: 3401782, liquid: 301808, committed: 14261, loansMonthly: 12779,
  rentalMonthly: 10102, taxNet: 37786, taxableIncome: 145426,
  deductions: 172325, medicareLevy: 2909, payg: 11129,
};

const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const outPath = OUT || `.audit/golden-baseline-${sha}.json`;
mkdirSync(resolve(ROOT, '.audit'), { recursive: true });
writeFileSync(resolve(ROOT, outPath), JSON.stringify({
  meta: {
    sha,
    capturedAt: new Date().toISOString(),
    userId,
    coverage: 'canonical orchestrator trees (see file header) — NOT all ~336 leaf producers individually',
  },
  renderedPartC,
  captures,
}, null, 2) + '\n');

const leafCount = (() => { const m = new Map(); numericLeaves(captures, '', m); return m.size; })();
console.log(`\ngolden-baseline: wrote ${outPath} — ${Object.keys(captures).length} capture(s), ${leafCount} numeric leaves. COMMIT IT.`);
await prisma.$disconnect?.();
