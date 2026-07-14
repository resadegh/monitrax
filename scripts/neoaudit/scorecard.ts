/**
 * NeoAudit Release Scorecard CLI (NEOAUDIT.md §6) — `npm run neoaudit:scorecard`.
 *
 * The publish-gate readout, runnable in a terminal or a release CI job. It reuses
 * the ONE producer — `summarizeScorecard` in `lib/verification/scorecard.ts` (the
 * same function the /admin/neoaudit panel renders) — so there is no second
 * producer (§12.2.1). It COMPUTES the one signal it can own (registry OPEN
 * number-issues) and NAMES the external ones it cannot self-verify (Rings 0–2 on
 * CI, R3-self invariants on live data, the latest VR run vs baseline, Stryker) —
 * per §22.2.4 the scorecard states gate OUTPUT, never a bare "safe to publish".
 *
 * Exit code: 0 when the registry half is clean; 1 when there is ≥1 OPEN
 * number-issue — so a release workflow can gate on it (as a job that `needs:` the
 * ring jobs, so it only runs once Rings 0–2 are green).
 *
 * PURE over the registry file — run via ts-node (same pattern as
 * `lint:financial-surfaces`).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeScorecard, type RegistryIssue } from '../../lib/verification/scorecard';

const ROOT = resolve(__dirname, '../..');
const REGISTRY = resolve(ROOT, 'docs/issues/ISSUES.json');
const RUNS_DIR = resolve(ROOT, 'docs/verification/runs');

function loadIssues(): RegistryIssue[] {
  if (!existsSync(REGISTRY)) throw new Error(`registry not found: ${REGISTRY}`);
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  return (reg.issues ?? []).map((i: RegistryIssue) => ({
    id: i.id, title: i.title, status: i.status, changesNumbers: i.changesNumbers,
  }));
}

/** The newest VR-NNN run file (named only — the diff-vs-baseline is a human/§3.5 step). */
function latestVrRun(): string | null {
  if (!existsSync(RUNS_DIR)) return null;
  const runs = readdirSync(RUNS_DIR).filter((f) => /^VR-\d+\.md$/.test(f)).sort();
  return runs.length ? runs[runs.length - 1] : null;
}

function main(): void {
  const summary = summarizeScorecard(loadIssues());
  const vr = latestVrRun();
  const L: string[] = [];
  L.push('=== NeoAudit Release Scorecard (NEOAUDIT.md §6) ===');
  L.push('');
  L.push('COMPUTED HERE — registry half:');
  L.push(`  OPEN number-issues: ${summary.openNumberIssueCount}  ${summary.registryClean ? '[PASS — 0 unverified user numbers]' : '[BLOCK]'}`);
  for (const i of summary.openNumberIssues) L.push(`    - ${i.id} [${i.status}] ${i.title}`);
  L.push(`  still-open (any kind): ${summary.totalOpenCount}`);
  L.push('');
  L.push('VERIFY EXTERNALLY before publish (this CLI cannot self-verify — §22.2.4):');
  L.push('  [ ] Rings 0–2 green on CI (vitest + build + neomatrix:check + lint jobs of this commit)');
  L.push('  [ ] R3-self invariants ALL PASS on live data (/admin/neoaudit panel)');
  L.push(`  [ ] Latest VR run clean vs baselines/BASELINE.md ${vr ? `(newest: ${vr})` : '(no VR run found)'}`);
  L.push('  [ ] Stryker weekly: no unreviewed surviving mutants (scoped engines)');
  L.push('');
  L.push(`VERDICT (registry half): ${summary.registryClean ? 'PASS' : 'BLOCK'}. ` +
    'Publish only when the registry half is clean AND every external signal above is confirmed. ' +
    'This is gate output, not a "safe to publish" claim.');
  // eslint-disable-next-line no-console
  console.log(L.join('\n'));
  process.exit(summary.registryClean ? 0 : 1);
}

main();
