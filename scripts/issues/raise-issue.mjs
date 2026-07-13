/**
 * issues:raise — auto-file a gate/verification finding as a de-duped MON ticket.
 *
 * NEOAUDIT.md §3.1 (the ONE finding bus): every node's FAIL becomes a MON-### in
 * `docs/issues/ISSUES.json` with evidence (surface, expected, actual, run/job id).
 * This is the pre-fill: it scaffolds a gate-VALID OPEN entry and DE-DUPES by
 * semanticKey+surface so a recurring failure doesn't spawn duplicates.
 *
 * PURE NODE (no deps). Run:
 *   npm run issues:raise -- --title "…" --area cashflow --surface app/dashboard/x.tsx \
 *     --semantic-key number.cashflow --expected -400 --actual 10505 --run <jobId>
 * Flags: --title* --area* --surface* [--semantic-key (repeatable)] [--expected]
 *   [--actual] [--run] [--severity high] [--no-changes-numbers] [--node <ring/node>]
 *   [--root-cause path:line (repeatable)] [--plain-issue "…"] [--tracker <ref>]
 *   [--append] (on a dup, append this evidence to the existing entry's notes)
 *   [--dry-run] (print the entry, write nothing) [--json '<obj>'] (provide any of
 *   the above as a JSON object — for programmatic gate integration).
 *
 * On a new entry: writes ISSUES.json (status OPEN), regenerates ISSUES.md, runs
 * the gate, prints the new MON id. On a dup: prints "duplicate of MON-XXX",
 * optionally appends evidence, exits 0 (no new id). Rejects unknown semanticKeys
 * (not a Neomatrix node) rather than emit a gate-invalid entry — an unmodelled
 * surface is recorded in notes instead (§21.5: a gap is modelled, never guessed).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateIssuesMd } from './generate-issues-md.mjs';
import { checkIssues } from './check-issues.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const REGISTRY = resolve(ROOT, 'docs/issues/ISSUES.json');
const GRAPH = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');
const TERMINAL = new Set(['CLOSED', 'WONTFIX', 'RETRACTED']); // a dup only matters vs a LIVE issue

// ── arg parsing (supports repeatable flags + --json) ────────────────────────
export function parseArgs(argv) {
  const out = { semanticKey: [], rootCause: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'no-changes-numbers') { out.changesNumbers = false; continue; }
    if (key === 'append' || key === 'dry-run') { out[camel] = true; continue; }
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    if (camel === 'semanticKey') out.semanticKey.push(val);
    else if (camel === 'rootCause') out.rootCause.push(val);
    else out[camel] = val;
  }
  if (out.json) {
    const obj = JSON.parse(out.json);
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'semanticKey' || k === 'semanticKeys') out.semanticKey = [].concat(v);
      else if (k === 'rootCause') out.rootCause = [].concat(v);
      else out[k] = v;
    }
  }
  return out;
}

export function nextId(issues) {
  const max = issues.reduce((m, it) => {
    const n = parseInt(String(it.id).replace(/^MON-/, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `MON-${String(max + 1).padStart(3, '0')}`;
}

function graphNodeIds() {
  if (!existsSync(GRAPH)) return new Set();
  try { return new Set(JSON.parse(readFileSync(GRAPH, 'utf8')).nodes.map((n) => n.id)); }
  catch { return new Set(); }
}

// A dup = a LIVE issue that shares >=1 semanticKey AND references the surface.
export function findDuplicate(issues, keys, surface) {
  const keySet = new Set(keys);
  return issues.find((it) => {
    if (TERMINAL.has(it.status)) return false;
    const shareKey = (it.semanticKeys ?? []).some((k) => keySet.has(k));
    if (!shareKey) return false;
    const hay = [...(it.downstreamConsumers ?? []), it.title ?? '', it.notes ?? ''].join('\n');
    return surface && hay.includes(surface);
  });
}

/**
 * Build the gate-VALID OPEN scaffold entry. PURE (no I/O) so it is unit-testable
 * against the real gate. `resolving`/`unmodelled` are the caller's split of the
 * provided semanticKeys (only resolving keys are emitted — §21.5). `today` is
 * injected for determinism.
 */
export function buildEntry(args, resolving, unmodelled, id, today) {
  const evidence = [
    args.node ? `Node: ${args.node}.` : '',
    `Surface: ${args.surface}.`,
    args.expected !== undefined ? `Expected: ${args.expected}.` : '',
    args.actual !== undefined ? `Actual: ${args.actual}.` : '',
    args.run ? `Evidence/run: ${args.run}.` : '',
    unmodelled.length ? `Unmodelled semanticKey(s) — MODEL then attach (§21.5): ${unmodelled.join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  return {
    id,
    title: args.title,
    status: 'OPEN',
    severity: args.severity || 'high',
    changesNumbers: args.changesNumbers !== false,
    opened: today,
    area: args.area,
    plain: {
      issue: args.plainIssue ||
        `A verification check found a mismatch on ${args.surface}` +
        (args.expected !== undefined && args.actual !== undefined ? ` (expected ${args.expected}, got ${args.actual})` : '') + '.',
    },
    rootCause: args.rootCause ?? [], // [] until diagnosed — the gate only validates entries that ARE present
    semanticKeys: resolving,          // only resolving keys — never a gate-invalid id
    downstreamConsumers: [],
    fixPRs: [],
    test: null,
    tracker: args.tracker || (args.run ? `neoaudit-run:${args.run}` : 'docs/blueprint/NEOAUDIT.md#5-the-ratchet-zero-fail-mechanism'),
    notes: `Auto-raised by issues:raise (NeoAudit finding bus, §3.1). ${evidence}`.trim(),
  };
}

/** Split provided keys into resolving (in the graph) vs unmodelled. */
export function splitKeys(keys, nodes) {
  const resolving = [], unmodelled = [];
  for (const k of keys) (nodes.size === 0 || nodes.has(k) ? resolving : unmodelled).push(k);
  return { resolving, unmodelled };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const errors = [];
  if (!args.title) errors.push('--title is required');
  if (!args.area) errors.push('--area is required');
  if (!args.surface) errors.push('--surface is required (the failing tile/page/route/file)');
  if (errors.length) { console.error('issues:raise — ' + errors.join('; ')); process.exit(2); }

  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const { resolving, unmodelled } = splitKeys(args.semanticKey, graphNodeIds());

  const dup = findDuplicate(reg.issues, resolving, args.surface);
  if (dup) {
    console.log(`issues:raise — duplicate of ${dup.id} (shares a semanticKey + surface "${args.surface}"). No new ticket.`);
    if (args.append && !args.dryRun) {
      const stamp = `[re-raised ${new Date().toISOString().slice(0, 10)}] ${args.surface}: expected ${args.expected ?? '?'}, actual ${args.actual ?? '?'}${args.run ? ` (run ${args.run})` : ''}.`;
      dup.notes = (dup.notes ? dup.notes + ' ' : '') + stamp;
      writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
      generateIssuesMd();
      console.log(`   evidence appended to ${dup.id}.`);
    }
    process.exit(0);
  }

  const id = nextId(reg.issues);
  const today = new Date().toISOString().slice(0, 10);
  const entry = buildEntry(args, resolving, unmodelled, id, today);

  if (args.dryRun) {
    console.log(JSON.stringify(entry, null, 2));
    console.log('\nissues:raise — --dry-run: nothing written.');
    process.exit(0);
  }

  reg.issues.push(entry);
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
  generateIssuesMd();

  const { errors: gateErrors } = checkIssues({ today });
  const mine = gateErrors.filter((e) => e.includes(`[${id}]`));
  if (mine.length) {
    console.error(`issues:raise — scaffolded ${id} but the gate rejected it (fix the inputs):`);
    for (const e of mine) console.error('   - ' + e);
    process.exit(1);
  }
  console.log(`issues:raise — filed ${id} (OPEN). Diagnose it (rootCause + semanticKeys), then advance the lifecycle.`);
}

// CLI entry — guarded so importing the module (for tests) does not execute it.
if (import.meta.url === `file://${process.argv[1]}`) main();
