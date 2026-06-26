/**
 * Neomatrix NI-4-final — census hard gate. PURE NODE.
 *
 * Fails the build if any financial-calc candidate is UNCOVERED (neither proven
 * by a calc-audit fixture nor modelled by a semantic node) and not on the
 * reviewed §22.2 allowlist. This makes "every calculation is in the Neomatrix"
 * a BUILD OUTPUT, not a claim: a new un-inventoried calc cannot merge silently.
 */
import { calcCensus } from './calc-census.mjs';

const r = calcCensus();
console.log(`Neomatrix census gate: ${r.byStatus.PROVEN} proven · ${r.byStatus.MODELLED} modelled · ${r.byStatus.UNCOVERED} uncovered · ${r.excluded} excluded (allowlist)`);
if (r.byStatus.UNCOVERED > 0) {
  const unc = r.candidates.filter((c) => c.status === 'UNCOVERED');
  const byFile = {};
  for (const c of unc) (byFile[c.file] ??= []).push(c.label);
  console.error('\n✗ Census gate FAILED — UNCOVERED financial calc(s) found:');
  for (const [f, labels] of Object.entries(byFile)) console.error(`   ${f}  (${labels.join(', ')})`);
  console.error('\nFix each: model it (semantic node) / prove it (calc-audit fixture), OR if genuinely');
  console.error('non-financial add it to NOT_A_FINANCIAL_CALC in calc-census.mjs with a verified reason.');
  process.exit(1);
}
console.log('✓ Census gate: 0 uncovered — every financial calc is proven or modelled.');
