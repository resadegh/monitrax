/**
 * VERIFIED -> CLOSED promotion for the VR-038 / VR-039 set.
 *
 * RUN AFTER scripts/matrix/vr038-039-advance.mjs, from repo root:
 *   node scripts/matrix/vr038-039-promote.mjs
 *   npm run issues:generate && npm run issues:check
 *
 * Criterion (CODE_BRIEF_promotion-pass, all three): status VERIFIED, AND the
 * entry cites promotion evidence (a docs/verification/runs/VR-*.md and/or a CI
 * ratchet), AND no open reopener. A NEW follow-up issue is not a reopener.
 *
 * Idempotent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REG = resolve(ROOT, 'docs/issues/ISSUES.json');
const reg = JSON.parse(readFileSync(REG, 'utf8'));
let changed = 0;

// CLOSE — each verified first-hand this session, no reopener.
const CLOSE = {
  'MON-105': 'CLOSED per VR-038 A2 — Div 152 eligibility verified live in BOTH directions (canvas-individual entity gets the card and correctly no PSI card; company gets both). The two grammars are provably independent. No reopener.',
  'MON-106': 'CLOSED per VR-039 — FY2026-27 config verified live at 2f4ac8cc against an independent Ring-0 bracket walk; exactly three figures moved by exactly -$268, every input figure held, convergent across all three tax surfaces, header = table = footnote = CFO tile. Ratchet tests/tax/mon106Fy2026_27Config.test.ts incl. the clock-derived CI guard. No reopener.',
  'MON-107': 'CLOSED per VR-038 A1 — the PSB-determination branch renders s87-60 and s86-15 is absent from the page; ratchet tests/tax/mon107PsiCitationLine.test.ts. No reopener.',
  'MON-108': 'CLOSED per VR-038 A4 — the rendered ladder row carries the clean label with the citation exactly once as the sole carrier; ratchet tests/tax/mon108ConcessionLabels.test.ts. No reopener.',
  'MON-109': 'CLOSED per VR-038 A4 — legislated thresholds are engine-exported and read by the card for both comparison and copy ($6,000,000 s152-15, $2,000,000 s152-20, $500,000 cap), verified live; ratchet tests/tax/mon109ThresholdTrace.test.ts + the NeoAudit threshold-trace detector. MON-112 (the cap CITATION) is a different fact and a new follow-up, NOT a reopener — the VALUES this issue is about are correct and engine-sourced.',
  'MON-110': 'CLOSED per VR-038 A5 — gainBeforeConcessions is engine-stated, verified on the DISCRIMINATING all-elections-off case where steps[] is empty and the deleted reconstruction could not have rendered; ratchet tests/tax/mon110GainBeforeConcessions.test.ts. No reopener.',
};

// HOLD — stated explicitly rather than silently skipped.
const HOLD = {
  'MON-104': 'HELD at VERIFIED (not closed) by the Matrix, VR-038 A3. The FY round-trip half is verified live, but the OTHER half of this issue — an unconfigured FY being 400-rejected and never persisted, which is the orphaned-row class the issue was raised for — was NOT Ring-3 asserted: it is unreachable from the UI at this HEAD (FY_OPTIONS is a subset of TAX_YEAR_CONFIGS) and confirming it would require a prohibited API probe. It stays Ring-0/1 ratchet-only. Closing would claim a verification the run did not do. Re-evaluate once MON-113 makes the selector read the canonical configured-year list, at which point the reject path becomes reachable and can be asserted live.',
};

for (const [id, note] of Object.entries(CLOSE)) {
  const it = reg.issues.find((i) => i.id === id);
  if (it && it.status === 'VERIFIED') {
    it.status = 'CLOSED';
    it.closed = '2026-07-29';
    if (!(it.notes || '').includes(note.slice(0, 40))) it.notes = (it.notes ? it.notes + ' | ' : '') + note;
    console.log('  ' + id + ' VERIFIED -> CLOSED');
    changed++;
  }
}
for (const [id, note] of Object.entries(HOLD)) {
  const it = reg.issues.find((i) => i.id === id);
  if (it && it.status === 'VERIFIED' && !(it.notes || '').includes('HELD at VERIFIED')) {
    it.notes = (it.notes ? it.notes + ' | ' : '') + note;
    console.log('  ' + id + ' HELD at VERIFIED (reason recorded)');
    changed++;
  }
}

writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');
console.log(changed ? '\nvr038-039-promote: ' + changed + ' change(s). Now run: npm run issues:generate && npm run issues:check' : '\nvr038-039-promote: already applied - no-op.');
