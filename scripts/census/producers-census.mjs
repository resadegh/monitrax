/**
 * MON-131 Tranche 0 — PRODUCER-MULTIPLICITY CENSUS (`npm run census:producers`).
 *
 * Counts DERIVING FUNCTIONS per canonical quantity across `lib/`, `app/api/`,
 * `app/dashboard/`, `components/` (REFERENCE_NUMBERS_DESIGN.md §1, brief §4 T0).
 * The count going down is the deliverable; the ratchet makes going up a CI fail.
 *
 * METHOD — stated precisely, never as prose (§22.2.4): v1 counts FORMULA-SHAPE
 * SITES — a function whose body matches a quantity's derivation signature
 * (raw frequency arithmetic, `assets − liabilities`, raw `minRepayment` cost,
 * hardcoded legislated constants, …) is counted as a producer of that quantity.
 * This is a deterministic PROXY for the Matrix's three-agent-pass census (~336
 * across 23 quantities at f13368ef): it does NOT claim parity with those
 * absolute numbers — it claims STABILITY, so relative movement is meaningful
 * and machine-gated. Pass-throughs/DTO mapping don't match (no derivation
 * arithmetic → no signature hit). A quantity whose signature is not yet
 * expressible as a stable pattern is listed in UNMEASURED below — visible,
 * never silently dropped. Signatures grow as Phase A contracts land; growing
 * one re-seeds in the same PR with the reason in the seed's `history`.
 *
 * RATCHET (mirrors `.audit/source-lock-exceptions.json` semantics, RATCHET-
 * DOWN-ONLY): `--check` fails if any quantity's count RISES vs the seed
 * (`.audit/producer-census.json`), AND fails on a stale seed when a count FELL
 * (decrement the seed in the same PR — the drop is the deliverable; record it).
 *
 *   node scripts/census/producers-census.mjs            # report
 *   node scripts/census/producers-census.mjs --seed     # (re)write the seed
 *   node scripts/census/producers-census.mjs --check    # CI gate
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const SEED = resolve(ROOT, '.audit/producer-census.json');

const SCAN_ROOTS = ['lib', 'app/api', 'app/dashboard', 'components'];
// Tests and type-only files are not producers.
//
// NEITHER ARE THE MATRIX COMPARE RELAYS (added 2026-07-31). `app/api/admin/matrix/**`
// exists to MEASURE producers: each relay deliberately reads the OLD path and the
// NEW canonical one side by side so a tranche's `expectedMoves` can be COMPUTED on
// live data instead of predicted. Counting an instrument as a producer is a category
// error with a real cost — it inflates the very metric the tranche is driving down,
// and it makes every future tranche's relay look like fresh duplication. The T2 relay
// scored as +1 on five separate quantities (loanCost 31→32, incomeRunRate 128→129,
// expenseRunRate 81→82, savingsRate 30→31, emergencyMonths 15→16) while deleting
// nothing and producing nothing any user sees.
//
// The narrow scope matters: this is admin-only (HR-3), read-only, and renders no
// user-facing number. It is NOT a general "admin is exempt" rule — anything under
// app/api/admin that actually derives a user-facing figure would still be a producer
// and belongs in the count.
const SKIP =
  /\.(test|spec)\.[tj]sx?$|\.d\.ts$|__mocks__|node_modules|^app\/api\/admin\/matrix\//;

// ── quantity signatures ─────────────────────────────────────────────────────
// Each: { key, patterns: [RegExp], context?: RegExp } — a function body is a
// producer of `key` when ANY pattern matches (AND `context` matches, if set).
// Patterns target the DERIVATION (arithmetic/branching), not consumption of a
// canonical producer's output.
const FREQ_ARITH = /(\*\s*12\b|\/\s*12\b|\*\s*52\b|\/\s*52\b|\*\s*26\b|\/\s*26\b|\*\s*4\.33|case\s*['"](?:WEEKLY|FORTNIGHTLY|MONTHLY|QUARTERLY|ANNUAL(?:LY)?|weekly|fortnightly|monthly|quarterly|annual(?:ly)?)['"])/;
// Arithmetic reach: plain operators OR the Decimal-twin methods — twins count
// as producers too (they migrate together, brief §6.4).
const ARITH = String.raw`(?:[*/+\-]|\.(?:times|plus|minus|div|mul|sub|add)\s*\()`;
/** identifier-near-arithmetic: the quantity's name participates in a derivation
 *  EXPRESSION (within 60 chars of an operator), not merely appears in the body. */
const nearArith = (idents) => new RegExp(
  String.raw`\b\w*(?:${idents})\w*[^;\n]{0,60}${ARITH}|${ARITH}[^;\n]{0,60}\w*(?:${idents})\w*`, 'i');

const QUANTITIES = [
  { key: 'expenseRunRate', context: /expense|spend|outgoing/i, patterns: [FREQ_ARITH, /\btoMonthly\s*\(|\btoAnnual\s*\(/] },
  { key: 'incomeRunRate', context: /income|salary|wage|rent/i, patterns: [FREQ_ARITH, /\btoMonthly\s*\(|\btoAnnual\s*\(/] },
  { key: 'loanCost', patterns: [/minRepayment\s*(\*|\+|-|\/|\|\||\?\?|>\s*0|<=?\s*0)|(\+|\*|reduce)[^;\n]{0,60}minRepayment/] },
  { key: 'netWorth', patterns: [/(total)?[aA]ssets\s*(\.\w+\s*)?-\s*(total)?[lL]iabilities/] },
  { key: 'savingsRate', patterns: [/(net|surplus|savings?)\w*\s*\/\s*\w*(income|gross)\w*\s*\*\s*100|\/\s*\w*[iI]ncome\w*\)\s*\*\s*100/] },
  { key: 'emergencyMonths', context: /month|runway|buffer|emergency/i, patterns: [/(liquid|cash|fund|balance|savings?)\w*\s*\/\s*\w*(monthly|essential|expense)\w*/i] },
  { key: 'medicareLevy', context: /medicare/i, patterns: [nearArith('medicare'), /0\.02\b/] },
  { key: 'superCap', patterns: [/\b(30[_,]?000|27[_,]?500|CONCESSIONAL_CAP)\b/] },
  { key: 'depreciation', context: /depreciat|diminishing|primeCost|capitalWorks/i, patterns: [/\*\s*\(?\s*\w*[rR]ate\b|\*\s*0\.025\b|\*\s*2\.5\b/] },
  { key: 'payg', patterns: [nearArith('payg|withholding|withheld'), /\*\s*0\.3\b/] },
  { key: 'incomeTax', context: /\btax\b|bracket|marginal/i, patterns: [/(bracket|marginal|threshold)[\s\S]{0,80}[*\-]|\*\s*0\.(19|30|32|325|37|45)\b/] },
  { key: 'propertyEquity', patterns: [/([cC]urrent)?[vV]alue\w*\s*-\s*\w*([lL]oan|[dD]ebt|[mM]ortgage|[bB]alance)/] },
  { key: 'cashflow', patterns: [/\w*([iI]ncome|[iI]nflow)s?\w*\s*-\s*\w*([eE]xpense|[oO]utflow|[oO]utgoing|[sS]pend)\w*/] },

  // ── Phase A0 (MON-131 PHASE A brief §2.1) — the 11 previously-UNMEASURED
  // MON-131 quantities, now under the ratchet. Same v1 method + honest scope.
  { key: 'taxableIncome', patterns: [nearArith('taxableIncome|assessableIncome')] },
  { key: 'netIncome', patterns: [nearArith('netIncome|afterTax|takeHome|netMonthly|netAnnual')] },
  { key: 'grossIncome', patterns: [nearArith('grossIncome|grossAnnual|grossMonthly|grossSalary|grossAmount')] },
  { key: 'assetsLiabilitiesBreakdown', patterns: [nearArith('totalAssets|totalLiabilities|assetTotal|liabilityTotal')] },
  { key: 'forecastFlows', context: /forecast|projection|projected/i, patterns: [nearArith('projected|forecast'), FREQ_ARITH] },
  { key: 'propertyCashflowYield', patterns: [/\byield\w*\s*[=:][^;\n]{0,80}\/|\w*([aA]nnual)?[rR]ent\w*\s*\/\s*\w*([vV]alue|[pP]rice)\w*/] },
  { key: 'liquidCash', patterns: [nearArith('liquid')] },
  { key: 'deductions', patterns: [nearArith('deduction|deductible')] },
  { key: 'healthScore', context: /health|safety|score/i, patterns: [nearArith('healthScore|safetyScore|overallScore|aggregateScore|categoryScore')] },
  { key: 'landTax', context: /landTax|land[ _-]tax/i, patterns: [nearArith('landTax')] },
  { key: 'negativeGearing', patterns: [nearArith('negativeGear|gearingLoss|rentalLoss|negGear')] },

  // ── Phase A0 (brief §2.2) — the sixteen blind-spot families, each censused
  // as its own candidate quantity (fold onto an existing key only on an
  // IDENTICAL semantic — a near-match stays separate). Zero hits for a family
  // is a FINDING (documented capability never built), not an empty result.
  { key: 'stampDuty', patterns: [nearArith('stampDuty|transferDuty')] },
  { key: 'gst', context: /\bgst\b/i, patterns: [nearArith('gst'), /\*\s*0\.1\b|\/\s*11\b/] },
  { key: 'cgt', context: /cgt|capital[ _-]?gain/i, patterns: [nearArith('capitalGain|cgt|costBase'), /\*\s*0\.5\b/] },
  { key: 'psiAttribution', context: /\bpsi\b|personalServices/i, patterns: [nearArith('psi|attributed|personalServices')] },
  { key: 'div293', patterns: [nearArith('div293')] },
  { key: 'taxOffsetsFranking', patterns: [nearArith('franking|taxOffset|rebateAmount|imputation')] },
  { key: 'fteIeeElections', context: /familyTrustElection|interposedEntity|\bFTE\b|\bIEE\b/, patterns: [nearArith('fte|iee|election')] },
  { key: 'loanAmortisation', context: /loan|repay|amort|mortgage/i, patterns: [/Math\.pow\s*\(\s*1\s*\+|\(\s*1\s*\+\s*\w*[rR]ate\w*\s*\)\s*\*\*|toPower\s*\(/] },
  { key: 'investmentReturns', patterns: [nearArith('totalReturn|annualReturn|ytdReturn|capitalGrowth|returnPercent|gainPercent')] },
  { key: 'superProjection', context: /super/i, patterns: [/Math\.pow|compound|\*\*\s*\w*year/i] },
  { key: 'propertyValuationGrowth', context: /propert|valuation/i, patterns: [nearArith('growthRate|appreciation|capitalGrowth')] },
  { key: 'insuranceAdequacy', context: /insurance|cover/i, patterns: [nearArith('coverage|adequacy|coverGap|sumInsured')] },
  { key: 'budgetVariance', context: /budget/i, patterns: [nearArith('variance|overspend|underspend|overBudget')] },
  { key: 'lvrGearing', patterns: [/\b(lvr|loanToValue|gearingRatio|debtToAsset)\b[^;\n]{0,60}[=:*/+\-]|\w*([lL]oan|[dD]ebt)\w*\s*\/\s*\w*([vV]alue|[aA]sset)\w*/] },
  { key: 'freedomHorizon', context: /freedom|retire/i, patterns: [nearArith('freedomAge|freedomHorizon|yearsToFreedom|yearsToRetire|retirementAge')] },
  { key: 'moneyStoryMargin', context: /moneyStory|money[ _-]story/i, patterns: [nearArith('margin')] },
];

// Phase A0 §2.1 complete: every previously-unmeasured MON-131 quantity now
// carries a v1 signature above. The list stays as the honest record of WHAT
// was unmeasured before this extension; it must remain EMPTY going forward —
// a new quantity ships with its signature or it does not ship (§22.2.4).
const UNMEASURED = [];

// ── Phase A0 §2.3 — the unattributed-money sweep ────────────────────────────
// A function that performs arithmetic on money-shaped identifiers but matches
// NO quantity signature above is a candidate UNNAMED quantity. Counted (and
// listable via --list) so the Phase A sweep can classify every one: each maps
// to a named quantity or becomes a new one. This is what makes "nothing is
// out of scope" true rather than aspirational (brief §2.3).
const MONEY_ARITH = new RegExp(
  String.raw`\b\w*(?:amount|balance|total|cost|price|income|expense|rent|tax|fee|repayment|value|salary|wage|contribution|dividend|premium|surplus|deficit)\w*[^;\n]{0,60}${ARITH}[^;\n]{0,60}\d|\b\w*(?:amount|balance|total|cost|price|income|expense|rent|repayment)\w*\s*${ARITH}\s*\w*(?:amount|balance|total|cost|price|income|expense|rent|repayment)\w*`,
  'i');

// ── function splitting (self-contained; no parser dep) ──────────────────────
const FN_START = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)|^\s*(?:export\s+)?const\s+(\w+)\s*(?::[^=]{0,120})?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]{0,120})?=>|^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function\b|^\s{2,6}(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::[^{;]{0,120})?\{\s*$/;

function functionUnits(src) {
  const lines = src.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = FN_START.exec(lines[i]);
    if (m) {
      const name = m[1] || m[2] || m[3] || m[4];
      if (name && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) starts.push({ name, line: i });
    }
  }
  const units = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    units.push({ name: starts[i].name, line: starts[i].line + 1, body: lines.slice(starts[i].line, end).join('\n') });
  }
  return units;
}

function* walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== 'node_modules') yield* walk(p); }
    else if (/\.[tj]sx?$/.test(ent.name) && !SKIP.test(p)) yield p;
  }
}

export function censusProducers() {
  const perQuantity = {}; // key -> Map(file:function -> line)
  for (const q of QUANTITIES) perQuantity[q.key] = new Map();
  const unattributed = new Map(); // file:function -> line (money arith, no signature)

  for (const root of SCAN_ROOTS) {
    const abs = resolve(ROOT, root);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const rel = relative(ROOT, file);
      if (SKIP.test(rel)) continue;
      const src = readFileSync(file, 'utf8');
      const units = functionUnits(src);
      for (const u of units) {
        let matchedAny = false;
        for (const q of QUANTITIES) {
          if (q.context && !q.context.test(u.body)) continue;
          if (q.patterns.some((p) => p.test(u.body))) {
            perQuantity[q.key].set(`${rel}:${u.name}`, u.line);
            matchedAny = true;
          }
        }
        // Phase A0 §2.3: money-shaped arithmetic attributable to NO quantity.
        if (!matchedAny && MONEY_ARITH.test(u.body)) unattributed.set(`${rel}:${u.name}`, u.line);
      }
    }
  }

  const counts = {};
  for (const q of QUANTITIES) counts[q.key] = perQuantity[q.key].size;
  return { counts, sites: perQuantity, unmeasured: UNMEASURED, unattributed };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const mode = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  const { counts, sites, unmeasured, unattributed } = censusProducers();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log('producer census (formula-shape sites, v1 method — see file header):');
  for (const [k, n] of Object.entries(counts)) console.log(`  ${k.padEnd(26)} ${n}`);
  console.log(`  ${'TOTAL'.padEnd(26)} ${total}`);
  console.log(`  ${'UNATTRIBUTED (sweep §2.3)'.padEnd(26)} ${unattributed.size}`);
  console.log(`  unmeasured (no v1 signature yet): ${unmeasured.length ? unmeasured.join(', ') : 'NONE — every catalogued quantity carries a signature'}`);

  if (mode === '--list') {
    for (const [k, m] of Object.entries(sites)) {
      console.log(`\n## ${k}`);
      for (const [site, line] of [...m.entries()].sort()) console.log(`  ${site} (line ${line})`);
    }
    console.log('\n## UNATTRIBUTED (money arithmetic matching no quantity signature — Phase A0 §2.3)');
    for (const [site, line] of [...unattributed.entries()].sort()) console.log(`  ${site} (line ${line})`);
  }

  if (mode === '--seed') {
    const prev = existsSync(SEED) ? JSON.parse(readFileSync(SEED, 'utf8')) : { history: [] };
    writeFileSync(SEED, JSON.stringify({
      _comment: 'MON-131 producer-census ratchet seed — RATCHET-DOWN-ONLY. A rising count fails CI; a falling count requires re-seeding in the same PR (the drop is the deliverable — record it in history). Method: scripts/census/producers-census.mjs header.',
      seededAt: new Date().toISOString().slice(0, 10),
      counts,
      history: [...(prev.history || []), { date: new Date().toISOString().slice(0, 10), counts }].slice(-50),
    }, null, 2) + '\n');
    console.log(`\nseeded ${relative(ROOT, SEED)}`);
  }

  if (mode === '--check') {
    if (!existsSync(SEED)) { console.error('\n✗ census:check — no seed. Run with --seed and commit .audit/producer-census.json.'); process.exit(1); }
    const seed = JSON.parse(readFileSync(SEED, 'utf8'));
    const errors = [];
    for (const [k, n] of Object.entries(counts)) {
      const s = seed.counts[k];
      if (s === undefined) errors.push(`${k}: not in seed (count ${n}) — re-seed in this PR (new signature must seed its own baseline)`);
      else if (n > s) errors.push(`${k}: ${s} → ${n} — a NEW producer of this quantity was added. Do not add a producer; delete producers (brief §6.3).`);
      else if (n < s) errors.push(`${k}: ${s} → ${n} — count FELL (good) but the seed is stale. Re-run --seed in this PR so the ratchet locks the win.`);
    }
    for (const k of Object.keys(seed.counts)) if (!(k in counts)) errors.push(`${k}: in seed but no longer measured — remove from seed with the reason in history`);
    if (errors.length) {
      console.error('\n✗ producer-census ratchet FAILED:');
      for (const e of errors) console.error('   - ' + e);
      process.exit(1);
    }
    console.log('\n✓ producer-census ratchet: all counts at or matching seed.');
  }
}
