#!/usr/bin/env node
/**
 * REFERENCE-NUMBERS SCOREBOARD — one table, generated, never hand-maintained.
 *
 * Reza asked (2026-08-02): "do you have a table of the reference numbers and
 * calc engines across the app, and before and after reconciliations of the
 * duplicate calculators and engines?"
 *
 * The data existed in four places and no one view: the producer census
 * (`.audit/producer-census.json` — per-quantity producer counts with dated
 * history), the Neomatrix (engines + lineage + file:line), the quantity
 * contracts (`docs/architecture/contracts/`), and the Number Inventory.
 * This renders the join.
 *
 * WHY GENERATED, NOT WRITTEN (CLAUDE.md §22.2.4): coverage is a build output,
 * never a human claim. A hand-typed table drifts the moment a tranche lands,
 * and a stale scoreboard is worse than none — it reads as progress that did
 * not happen.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it never guesses a canonical producer.
 * A quantity is joined to a Neomatrix semanticKey or a contract file ONLY on
 * an exact key match. Everything else is reported as unmapped, which measures
 * the vocabulary gap between the census and the Neomatrix instead of hiding
 * it behind a fuzzy match (§19.2 — never guess; an unknown is a finding).
 *
 * Usage:
 *   node scripts/reference-numbers/scoreboard.mjs          # write the file
 *   node scripts/reference-numbers/scoreboard.mjs --check  # fail if stale
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const CENSUS = resolve(ROOT, '.audit/producer-census.json');
const GRAPH = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');
const CONTRACTS_DIR = resolve(ROOT, 'docs/architecture/contracts');
const OUT = resolve(ROOT, 'docs/architecture/REFERENCE_NUMBERS_SCOREBOARD.md');

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function build() {
  const census = JSON.parse(readFileSync(CENSUS, 'utf8'));
  const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));

  const counts = census.counts ?? {};
  // History snapshots, oldest first, de-duplicated by (date, index) so two
  // snapshots taken on one day both survive — several days carry two.
  const history = (census.history ?? []).map((h, i) => ({
    label: `${h.date}${(census.history ?? []).filter((x) => x.date === h.date).length > 1 ? `#${i + 1}` : ''}`,
    counts: h.counts ?? {},
  }));
  const seed = history[0]?.counts ?? {};

  const semanticKeys = new Map();
  for (const n of graph.nodes ?? []) {
    if (!n.semanticKey) continue;
    if (!semanticKeys.has(n.semanticKey)) semanticKeys.set(n.semanticKey, []);
    semanticKeys.get(n.semanticKey).push(n);
  }

  const contracts = existsSync(CONTRACTS_DIR)
    ? new Set(readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')))
    : new Set();

  const quantities = Object.keys(counts).sort();
  const rows = quantities.map((key) => {
    const now = counts[key];
    const seedCount = seed[key];
    const nodes = semanticKeys.get(key) ?? [];
    const engines = nodes.filter((n) => n.kind === 'engine' || n.kind === 'orchestrator');
    const contract = contracts.has(kebab(key)) ? `${kebab(key)}.md` : null;
    return {
      key,
      now,
      seedCount,
      delta: seedCount === undefined ? null : now - seedCount,
      modelled: nodes.length > 0,
      engine: engines[0]?.verifiedBy ?? engines[0]?.file ?? null,
      contract,
      perSnapshot: history.map((h) => h.counts[key]),
    };
  });

  const tracked = rows.filter((r) => r.seedCount !== undefined);
  const totalNow = rows.reduce((s, r) => s + r.now, 0);
  const modelledCount = rows.filter((r) => r.modelled).length;
  const contractCount = rows.filter((r) => r.contract).length;
  const movers = tracked.filter((r) => r.delta !== 0).sort((a, b) => a.delta - b.delta);

  const L = [];
  L.push('# Reference-Numbers Scoreboard — producers per quantity, before and after');
  L.push('');
  L.push('> **GENERATED — do not edit by hand.** `npm run refnums:scoreboard` rewrites this file;');
  L.push('> `npm run refnums:check` fails if it is stale. A hand-maintained version of this table');
  L.push('> would drift the moment a tranche landed, and a stale scoreboard reads as progress that');
  L.push('> did not happen (CLAUDE.md §22.2.4 — coverage is a build output, never a claim).');
  L.push('');
  L.push(`**Sources joined:** \`.audit/producer-census.json\` (counts + dated history) · \`docs/financial-logic/graph/financial-graph.json\` (Neomatrix) · \`docs/architecture/contracts/\``);
  L.push('');
  L.push('## How to read the Δ column — the part that matters');
  L.push('');
  L.push('**A negative Δ is NOT the same as deleted duplication.** Two different things move this number:');
  L.push('');
  L.push('1. **Real reconciliation** — a duplicate producer was deleted and its surface repointed at the');
  L.push('   canonical engine. T1 deleted five legacy income producers this way.');
  L.push('2. **Measurement correction** — the count itself was wrong and got fixed. The compare relays');
  L.push('   under `app/api/admin/matrix/**` were being counted as producers; excluding them dropped');
  L.push('   `expenseRunRate` 81→79, `incomeRunRate` 128→126, `payg` 56→54, `grossIncome` 38→36,');
  L.push('   `netIncome` 34→33, `emergencyMonths` 15→14 and `deductions` 106→105 **without deleting a');
  L.push('   single duplicate**. Recorded in `docs/implementation/MON-131_TRANCHE_LEDGER.md` §3 (T2).');
  L.push('');
  L.push('This table cannot separate the two mechanically — the census records counts, not causes. The');
  L.push('ledger is where the cause of each movement is written down, and it is the honest reading.');
  L.push('');
  L.push('## The headline');
  L.push('');
  L.push(`- **${quantities.length} quantities** tracked · **${totalNow} producing sites** across \`lib/\`, \`app/api/\`, \`app/dashboard/\`, \`components/\``);
  L.push(`- **${modelledCount}/${quantities.length}** join to a Neomatrix \`semanticKey\`; **${quantities.length - modelledCount} do not**`);
  L.push(`- **${contractCount}/${quantities.length}** have a same-named quantity contract`);
  L.push(`- **\`loanCost\` is at ${counts.loanCost ?? '?'}** — T2 is the tranche that takes it to one. That single number is the fairest test of the programme so far.`);
  L.push('');
  L.push('> **The mapping gap is a real finding, not a rendering artefact.** The census names 40');
  L.push('> quantities; the Neomatrix models 16 `semanticKey`s. They are two vocabularies for the same');
  L.push('> architecture and they do not reconcile — which is exactly the NI-1→NI-4 reconciliation');
  L.push('> Part 22 exists to close. This generator joins only on an EXACT key match and reports the');
  L.push('> rest as unmapped, rather than fuzzy-matching names and inventing a coverage figure.');
  L.push('');
  L.push('## Movement since the census was seeded');
  L.push('');
  if (movers.length === 0) {
    L.push('_No tracked quantity has moved since the seed._');
  } else {
    L.push('| Quantity | Seed | Now | Δ |');
    L.push('|---|---:|---:|---:|');
    for (const r of movers) L.push(`| \`${r.key}\` | ${r.seedCount} | ${r.now} | ${r.delta > 0 ? '+' : ''}${r.delta} |`);
  }
  L.push('');
  L.push('Quantities tracked from the seed that have not moved: ');
  L.push(tracked.filter((r) => r.delta === 0).map((r) => `\`${r.key}\` (${r.now})`).join(' · ') || '_none_');
  L.push('');
  L.push('## Every quantity');
  L.push('');
  L.push(`| Quantity | Producers now | Seed | Δ | Neomatrix | Contract |`);
  L.push('|---|---:|---:|---:|---|---|');
  for (const r of rows) {
    const seedCell = r.seedCount === undefined ? '—' : String(r.seedCount);
    const deltaCell = r.delta === null ? '—' : r.delta === 0 ? '0' : `${r.delta > 0 ? '+' : ''}${r.delta}`;
    const neo = r.modelled ? (r.engine ? `\`${r.engine}\`` : 'modelled') : '**not modelled**';
    const con = r.contract ? `\`${r.contract}\`` : '—';
    L.push(`| \`${r.key}\` | ${r.now} | ${seedCell} | ${deltaCell} | ${neo} | ${con} |`);
  }
  L.push('');
  L.push('_Seed `—` means the quantity was added to the census after the seed snapshot, so it has no');
  L.push('before-value. It is not a zero and must not be read as one._');
  L.push('');
  L.push('## Census snapshots');
  L.push('');
  L.push(`| Quantity | ${history.map((h) => h.label).join(' | ')} | now |`);
  L.push(`|---|${history.map(() => '---:').join('|')}|---:|`);
  for (const r of rows) {
    L.push(`| \`${r.key}\` | ${r.perSnapshot.map((v) => (v === undefined ? '—' : v)).join(' | ')} | ${r.now} |`);
  }
  L.push('');
  L.push('## What this scoreboard does NOT tell you');
  L.push('');
  L.push('- **It does not say a quantity is correct.** A count of 1 means one producer, not a right answer.');
  L.push('  Correctness lives in the quantity contracts, the calc-audit fixtures and the Ring-3 runs.');
  L.push('- **It does not attribute a Δ to a cause.** See the reading note above; the ledger holds causes.');
  L.push('- **It does not cover quantities the census does not detect.** The census counts deriving');
  L.push('  functions by pattern; a producer written in a shape no pattern matches is invisible to it.');
  L.push('  That is a known limit of the instrument, not a claim of completeness.');
  L.push('');
  return L.join('\n') + '\n';
}

const out = build();
const check = process.argv.includes('--check');

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== out) {
    console.error('[refnums-scoreboard] STALE — docs/architecture/REFERENCE_NUMBERS_SCOREBOARD.md does not match its sources.');
    console.error('  Run: npm run refnums:scoreboard');
    process.exit(1);
  }
  console.log('[refnums-scoreboard] OK — scoreboard matches the census + graph + contracts.');
} else {
  writeFileSync(OUT, out);
  console.log(`[refnums-scoreboard] wrote ${OUT}`);
}
