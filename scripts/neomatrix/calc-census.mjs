/**
 * Neomatrix NI-4 — FULL calc census. PURE NODE.
 *
 * Reza directive 2026-06-26: *"every calculation … finding any unproven calc
 * from the list is simple … I want a FULL coverage of Monitrax on Neomatrix."*
 *
 * The 84 "proven" engines (calc-audit registry) are NOT the ceiling — they're
 * only what's already fixtured. This census enumerates EVERY calculation-shaped
 * function in the financial code (from the Layer-0 structural graph) and flags
 * each: PROVEN (calc-audit fixture) · MODELLED (semantic node) · or neither
 * (the review queue). It turns "is everything covered?" into a full, scannable
 * list with status — so an unproven/unmodelled calc is trivial to find.
 *
 * v1 denominator = structural symbols in the financial dirs whose name starts
 * with a calc verb (calculate/compute/aggregate/resolve/project/derive/estimate/
 * build/generate). HONEST SCOPE: this is a heuristic starting denominator
 * (dir + name), refined toward function-level precision as semantic nodes carry
 * exact file:line. It is deliberately INCLUSIVE — better to over-list and prune
 * than to silently miss (the failure mode this whole workstream exists to kill).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const L0 = resolve(ROOT, 'docs/financial-logic/graph/structural/structural-graph.json');
const SEM = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');
const REG_DIR = resolve(ROOT, 'lib/calc-audit/engines');

/** Distinct proven engines (name + sourcePath, .shadow-deduped) across both
 *  calc-audit registries. Self-contained (no cross-branch import). */
function provenEngineSourcePaths() {
  const sps = new Set();
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        const re = /name:\s*'([a-z][a-zA-Z0-9_.]+)'/g;
        let m;
        while ((m = re.exec(src))) {
          const tail = src.slice(m.index, m.index + 700);
          const sp = /sourcePath:\s*'([^']+)'/.exec(tail);
          if (sp) sps.add(sp[1]);
        }
      }
    }
  };
  walk(REG_DIR);
  return sps;
}

const FIN_DIRS = [
  'lib/calculations/', 'lib/tax-engine/', 'lib/cfo/', 'lib/health/', 'lib/services/',
  'lib/cashflow/', 'lib/intelligence/', 'lib/reports/', 'lib/loan/', 'lib/super/', 'lib/utils/',
];
const CALC_VERBS = ['calculate', 'compute', 'aggregate', 'resolve', 'project', 'derive', 'estimate', 'assess', 'build', 'generate', 'get'];
const isCalcName = (label) => CALC_VERBS.some((v) => label.toLowerCase().startsWith(v));
const inFin = (f) => f && FIN_DIRS.some((d) => f.startsWith(d));

// NI-4 reviewed exclusion allowlist (§22.2 — visible, reasoned, shrinking; never
// a silent drop). The denominator is a HEURISTIC (dir + calc-verb incl. `get`/
// `build`), so it over-counts type defs, date helpers, and CRUD/integration
// service plumbing that are NOT financial-position calculations. Each file here
// was READ in source (§19.2) and confirmed non-financial. Symbol-level entries
// (`file::label`) exclude one symbol; file entries exclude the whole file.
// Remove an entry the moment a real calc lands in that file.
const NOT_A_FINANCIAL_CALC = {
  'lib/cashflow/types.ts': 'type defs + getNextOccurrence (recurrence date helper, not money)',
  'lib/health/types.ts': 'type/interface definitions (AggregatedMetrics)',
  'lib/reports/types.ts': 'type/interface definitions (GeneratedReport)',
  'lib/tax-engine/types.ts': 'type defs + getCurrentFinancialYear (date helper, not money)',
  'lib/utils/errors.ts': 'error utility (getStatusFromErrorCode — HTTP status mapping)',
  'lib/services/stripeBillingService.ts': 'Stripe billing SDK plumbing (customers/subscriptions), not a financial-position calc',
  'lib/services/conversationService.ts': 'messaging CRUD (Phase 32C)',
  'lib/services/marketplaceService.ts': 'professional-marketplace CRUD (Phase 32C)',
  'lib/services/askAProfessionalService.ts': 'professional-request resolver CRUD (Phase 32C)',
  'lib/services/professionalRequestService.ts': 'professional-request lifecycle CRUD (Phase 32C)',
  'lib/services/feedbackService.ts': 'adviser-feedback CRUD (Phase 33g)',
  'lib/services/setupStateService.ts': 'onboarding/setup progress state (module completion counts, not money)',
  'lib/services/legalEntityService.ts': 'legal-entity CRUD (Phase 41a)',
  'lib/services/entityRelationshipService.ts': 'entity-relationship SSOT writer/CRUD (Phase 44)',
  'lib/services/cdrDataLifecycle.ts': 'CDR data lifecycle management (consent/retention), not a calc',
  'lib/services/householdCategoryService.ts': 'household category record management (codes/templates), not a financial calc',
  'lib/services/ownershipSelectionService.ts': 'ownership selection/resolution plumbing (the canonical ownership calc is lib/utils/ownership.ts)',
  'lib/services/trustDeedRulesService.ts': 'trust-deed rule fetch/getters (CRUD), not a calc',
  'lib/cfo/trailStage.ts': 'TRAIL stage → display-info mapping (getTrailStageInfo), not a money calc',
  'lib/reports/exporters/index.ts': 'report serialization/export (PDF/xlsx), not a financial-position calc',
  'lib/utils/ownership.ts': 'ownership VALIDATION guard (verifyOwnership) — auth check, not a money calc; ownership shares are computed in masterFinancialService',
};
const isExcluded = (f) => Object.prototype.hasOwnProperty.call(NOT_A_FINANCIAL_CALC, f);

export function calcCensus() {
  const l0 = JSON.parse(readFileSync(L0, 'utf8'));
  const sem = JSON.parse(readFileSync(SEM, 'utf8'));

  // modelled files (a semantic engine/orchestrator/number node lives there)
  const modelledFiles = new Set(sem.nodes.filter((n) => ['engine', 'orchestrator', 'number'].includes(n.kind) && n.file).map((n) => n.file));
  // proven files (calc-audit registry sourcePath)
  const provenFiles = provenEngineSourcePaths();

  // candidate calc functions = calc-named structural symbols in financial dirs
  const seen = new Set();
  const candidates = [];
  let excluded = 0;
  for (const [, label, file] of l0.nodes) {
    if (!inFin(file) || !label || !isCalcName(label)) continue;
    const key = `${file}::${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // reviewed non-financial-calc exclusion (file-level or file::label)
    if (isExcluded(file) || isExcluded(key)) { excluded++; continue; }
    candidates.push({ file, label });
  }
  candidates.sort((a, b) => (a.file + a.label).localeCompare(b.file + b.label));

  for (const c of candidates) {
    c.proven = provenFiles.has(c.file);
    c.modelled = modelledFiles.has(c.file);
    c.status = c.proven ? 'PROVEN' : c.modelled ? 'MODELLED' : 'UNCOVERED';
  }

  const byStatus = { PROVEN: 0, MODELLED: 0, UNCOVERED: 0 };
  for (const c of candidates) byStatus[c.status]++;
  return { total: candidates.length, byStatus, candidates, excluded };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = calcCensus();
  console.log('Neomatrix FULL calc census (NI-4, v1 heuristic denominator):');
  console.log(`  candidate calculations (financial dirs, calc-named): ${r.total}`);
  console.log(`  PROVEN (file has a calc-audit fixture):  ${r.byStatus.PROVEN}`);
  console.log(`  MODELLED (file has a semantic node):     ${r.byStatus.MODELLED}`);
  console.log(`  UNCOVERED (neither — review queue):      ${r.byStatus.UNCOVERED}`);
  console.log(`  EXCLUDED (reviewed non-financial-calc):  ${r.excluded}  (§22.2 allowlist — see NOT_A_FINANCIAL_CALC)`);
  console.log(`  full coverage: ${Math.round(((r.total - r.byStatus.UNCOVERED) / r.total) * 100)}% (proven or modelled, of the financial-calc denominator)`);
}
