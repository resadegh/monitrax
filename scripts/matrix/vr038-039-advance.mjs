/**
 * VR-038 / VR-039 registry + cursor advance.
 *
 * WHY THIS EXISTS: the Matrix's Cowork sandbox has no git push credentials, and
 * the GitHub connector cannot carry docs/issues/ISSUES.json (~400 KB),
 * docs/issues/ISSUES.md (~396 KB) or docs/implementation/04_RECENTLY_COMPLETED.md
 * (~406 KB) in one call - the same size constraint CLAUDE.md 15.5 already records
 * for the plan spokes. So the two run records are committed directly and every
 * other edit they require is applied here, deterministically and idempotently.
 *
 * SSOT: the evidence lives ONCE, in docs/verification/runs/VR-038.md and VR-039.md.
 * Registry notes cross-reference those sections; they do not restate them.
 *
 * RUN (from repo root, on this branch):
 *   node scripts/matrix/vr038-039-advance.mjs
 *   npm run issues:generate && npm run issues:check   # expect: 114 issue(s) valid
 * Then commit. Re-running is a no-op.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const wr = (p, s) => writeFileSync(resolve(ROOT, p), s);
let changed = 0;
const note = (m) => { console.log('  ' + m); changed++; };

// 1. Registry -----------------------------------------------------------------
const REG = 'docs/issues/ISSUES.json';
const reg = JSON.parse(rd(REG));
const byId = (id) => reg.issues.find((i) => i.id === id);
const addNote = (it, t) => { if (!(it.notes || '').includes(t.slice(0, 50))) it.notes = (it.notes ? it.notes + ' | ' : '') + t; };

const VERIFIED_BY_038 = {
  'MON-104': 'VR-038 A3 - FY round-trip verified live at ab9f65e (save -> other FY empty, no bleed -> back -> hard reload rehydrates same FY + values). COVERAGE BOUNDARY, stated not implied: the unconfigured-FY 400-reject at the write boundary is NOT reachable from the UI at this HEAD (FY_OPTIONS is a subset of TAX_YEAR_CONFIGS) and was NOT asserted; it stays Ring-0/1 ratchet-only. Cause raised as MON-113.',
  'MON-105': 'VR-038 A2 - verified in BOTH directions at ab9f65e: canvas-individual entity gets the Div 152 card and correctly no PSI card; company entity gets both. The other-company label is canvas vocabulary from classifyEntity, not the gated entityType.',
  'MON-107': 'VR-038 A1 - PSB-determination fixture rendered s87-60 with s86-15 absent from the page, $0 attributed. VR-037 finding 5 closed.',
  'MON-108': 'VR-038 A4 - ladder row renders the clean label with the citation carried exactly once as the sole carrier (s152-205).',
  'MON-109': 'VR-038 A4 - card copy renders the engine-exported constants live ($6,000,000 s152-15, $2,000,000 s152-20, $500,000 cap). The cap CITATION is wrong - separate finding MON-112; the value is engine-sourced and correct.',
  'MON-110': 'VR-038 A5 - verified on the DISCRIMINATING case: with every election off, steps[] is empty and the deleted steps[0].runningGain + reduction reconstruction could not have rendered a figure; the card still stated gainBeforeConcessions.',
};
for (const [id, ev] of Object.entries(VERIFIED_BY_038)) {
  const it = byId(id);
  if (it && it.status !== 'VERIFIED') {
    it.status = 'VERIFIED'; it.verified = '2026-07-29'; it.tracker = 'neoaudit-run:VR-038';
    addNote(it, ev); note(id + ' FIXING -> VERIFIED (VR-038)');
  }
}

const m106 = byId('MON-106');
if (m106 && m106.status !== 'VERIFIED') {
  m106.status = 'VERIFIED'; m106.verified = '2026-07-29'; m106.tracker = 'neoaudit-run:VR-039';
  addNote(m106, 'VR-039 - Ring-3 PASS at 2f4ac8cc. The movement was asserted against an INDEPENDENT Ring-0 bracket walk recomputed from the rendered table (see VR-039 A): all three base amounts re-derive, tax on the live $145,426 taxable = $34,877.62 -> $34,878 vs FY25-26 $35,145.62 -> $35,146, exactly $268.00 = 26,800 x 1%. Exactly three figures moved, all by -$268; every input figure held (VR-039 B). Header = table = footnote = CFO tile all FY26-27, closing VR-037 finding 3 (VR-039 C).');
  note('MON-106 FIXING -> VERIFIED (VR-039)');
}

const NEW = [
  { id: 'MON-112', severity: 'medium', tracker: 'neoaudit-run:VR-038',
    title: 'Retirement-exemption $500,000 lifetime cap cited to the wrong provision in two places (engine s152-310, card s152-305) - the limit is s152-320',
    rootCause: ['lib/tax-engine/divisions/div152SmallBusinessConcessions.ts:149',
                'lib/tax-engine/divisions/div152SmallBusinessConcessions.ts:289',
                'lib/tax-engine/divisions/div152SmallBusinessConcessions.ts:493',
                'components/tax/Div152AssessmentCard.tsx:353'],
    semanticKeys: ['engine.tax.div152.applyDiv152'],
    issue: 'The $500,000 lifetime limit on the small-business retirement exemption is labelled with the wrong section of the tax act - two different wrong ones, in the engine and on the card. The dollar figure is right; the legal reference beside it is not.',
    notes: 'Raised by VR-038 C. s152-320 is "Meaning of CGT retirement exemption limit" and sets the $500,000; s152-310 is "Consequences of choice"; s152-305 is "Choosing the exemption". s152-305 stays CORRECT where the card cites the concession itself (the ladder row) - the defect is specifically the CAP attribution. Producer-level: the engine own AuthorityCitation carries s152-310. Same class as MON-107/108. Fix shape under SSOT: one cited constant stated by the engine, read by the card (the MON-107/109 pattern).' },
  { id: 'MON-113', severity: 'high', tracker: 'neoaudit-run:VR-039',
    title: 'FY_OPTIONS hardcoded on the entity tax page duplicates TAX_YEAR_CONFIGS - the current FY is configured but unselectable',
    rootCause: ['app/dashboard/entities/[id]/tax/page.tsx:107'],
    semanticKeys: ['engine.taxYearConfig.getCurrentTaxYearConfig'],
    issue: 'The financial-year dropdown on an entity tax page has its own fixed list of years typed into the page. FY2026-27 rates are now live, but you still cannot pick FY2026-27 there - so you cannot record this year PSI or small-business CGT answers for any entity.',
    notes: 'Raised by VR-038 C, CONFIRMED LIVE by VR-039 D on the deployed 2f4ac8cc build. FY_OPTIONS is a second, hand-maintained answer to "which financial years exist" while the canonical producer is TAX_YEAR_CONFIGS / isTaxYearConfigured (taxYearConfig.ts:350, :380). MON-104 built that resolver precisely so there would be one; this surface still does not read it. #1520 added TAX_YEAR_2026_27 and did not touch this file. Also the reason MON-104 write-boundary 400-reject is unreachable from the UI.' },
  { id: 'MON-114', severity: 'high', tracker: 'neoaudit-run:VR-038',
    title: '"Clear" on the PSI and Div 152 capture cards resets the form only - the saved assessment survives and silently returns on reload',
    rootCause: ['components/tax/Div152AssessmentCard.tsx:440', 'components/tax/PsiAssessmentCard.tsx:284'],
    semanticKeys: ['engine.services.entityTaxFactsAssembler.buildDiv152Input'],
    issue: 'Pressing Clear on a tax questionnaire empties the boxes on screen but does not delete what was saved. Walk away and come back and the old answers are still there, still feeding the estimate. To actually remove them you have to empty every box and press Save.',
    notes: 'Raised by VR-038 C and D. Verified live on BOTH cards: cleared each, hard-reloaded, both assessments returned in full with their rendered outcomes. A user who clears a mistaken assessment and navigates away still has it saved and still feeding the engine, with no indication anything remains. Either Clear persists the cleared state, or it is relabelled as a form reset; the current affordance reads as removal and is not.' },
];
for (const n of NEW) {
  if (byId(n.id)) continue;
  reg.issues.push({
    id: n.id, title: n.title, status: 'OPEN', severity: n.severity,
    changesNumbers: false, opened: '2026-07-29', area: 'tax',
    plain: { issue: n.issue }, rootCause: n.rootCause, semanticKeys: n.semanticKeys,
    downstreamConsumers: [], fixPRs: [], test: null, tracker: n.tracker, notes: n.notes,
  });
  note(n.id + ' raised (OPEN)');
}
reg.issues.sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]));
wr(REG, JSON.stringify(reg, null, 2) + '\n');

// 2. STATE.md cursor ----------------------------------------------------------
const PIN = '**Last verified against HEAD:** merge of #1520 (`2f4ac8cc`) · **on:** 2026-07-29 · **by:** The Matrix (Cowork HQ) — **VR-038 + VR-039: BOTH VR-037 PRs ARE NOW RING-3 VERIFIED. MON-104/105/106/107/108/109/110 FIXING → VERIFIED. THE VR-037 PAIR IS CLOSED OUT.** VR-038 (PR-A #1519, at `ab9f65e`, changes no number): the PSB-determination fixture renders `s87-60` with `s86-15` absent; MON-105 verified in BOTH directions — a canvas-`individual` entity gets the Div 152 card and correctly no PSI card, a company gets both (the `other-company` label is canvas vocabulary from `classifyEntity`, NOT the gated `entityType` — the handover open question is settled); the FY round-trip holds through a hard reload; the ladder carries `(s152-205)` exactly once and renders the engine-exported $6M/$2M/$500k constants; MON-110 verified on the DISCRIMINATING all-elections-off case where `steps[]` is empty and the deleted reconstruction could not have rendered. Household cluster BYTE-IDENTICAL before AND after the fixture run, convergent across all three tax surfaces — PR-A moved nothing, as promised. **Coverage boundary stated, not implied: MON-104 unconfigured-FY 400-reject is unreachable from the UI and was NOT asserted** (Ring-0/1 ratchet only). VR-039 (PR-B #1520, merged by Reza mid-session, at `2f4ac8cc`): the ≈−$268 verified against an **independent Ring-0 bracket walk recomputed from the rendered table** — all three base amounts re-derive and tax on the live $145,426 taxable = $34,877.62 → **$34,878** vs FY25-26 $35,145.62 → $35,146, **exactly $268.00 = 26,800 × 1%**. **Exactly three figures moved, all by −$268** (tax on income · gross/net tax · tax owing); income, deductions, taxable income, PAYG, Medicare and the marginal rate all HELD; effective 26.2%→26.0% is a consequence of the same arithmetic, not a fourth change. Header ≡ table ≡ footnote ≡ CFO tile all FY26-27 — **VR-037 finding 3 closed**, stale-FY banner correctly absent. **THREE NEW FINDINGS: MON-112** (the $500,000 retirement-exemption lifetime cap is cited to the wrong provision twice, differently — engine `s152-310`, card `s152-305`; the limit is **s152-320** — a PRODUCER defect, same class as MON-107/108); **MON-113** (`FY_OPTIONS` duplicates `TAX_YEAR_CONFIGS` — **CONFIRMED LIVE post-merge**: FY2026-27 is configured but unselectable, so no entity can capture PSI or Div 152 facts for the current FY); **MON-114** (**"Clear" on both capture cards resets the form but does not withdraw the saved assessment** — verified live: cleared both, reloaded, both came back in full and still feed the engine). Fixtures entered and withdrawn; prod restored. Run records: `docs/verification/runs/VR-038.md`, `docs/verification/runs/VR-039.md`. **Next: the VERIFIED→CLOSED promotion pass, then MON-112/113/114.**';
{
  const p = 'STATE.md';
  const lines = rd(p).split('\n');
  const i = lines.findIndex((l) => l.startsWith('**Last verified against HEAD:**'));
  if (i >= 0 && !lines[i].includes('VR-039')) {
    const old = lines[i];
    lines[i] = PIN;
    lines.splice(i + 1, 0, '> _Prior pin: ' + old.replace('**Last verified against HEAD:** ', '').trimEnd() + '_');
    wr(p, lines.join('\n'));
    note('STATE.md cursor re-pinned at 2f4ac8cc');
  }
}

// 3. Plan spoke + hub ---------------------------------------------------------
{
  const p = 'docs/implementation/04_RECENTLY_COMPLETED.md';
  let s = rd(p);
  const marker = '## ✅ Recently Completed (rolling 30 days)\n\n';
  const entries = [
    '- **2026-07-29 — VR-039: Ring-3 on PR-B #1520 — PASS. MON-106 → VERIFIED; the VR-037 pair is fully closed out.** Reza merged #1520 mid-session; production at `2f4ac8cc`. The ≈−$268 was asserted against an **independent Ring-0 bracket walk recomputed from the rendered table** — all three base amounts re-derive, and the movement is exactly $268.00 = 26,800 × 1%. Exactly three figures moved, all by −$268; every input figure held; convergent across `/dashboard/tax` ≡ `/cashflow` ≡ `/dashboard/cfo`; header ≡ table ≡ footnote ≡ CFO tile all FY26-27, closing VR-037 finding 3. MON-113 confirmed live rather than predicted. Run record: `docs/verification/runs/VR-039.md`.',
    '- **2026-07-29 — VR-038: Ring-3 on PR-A #1519 — PASS. MON-104/105/107/108/109/110 → VERIFIED; MON-112/113/114 raised.** Cross-surface Ring-3 at `ab9f65e`. All four assertions PASS: `s87-60` renders and `s86-15` is absent; the Div 152 card is reachable on a canvas-`individual` entity while the PSI card correctly is not, and both render on a company; the FY round-trip holds through a hard reload; the ladder carries `(s152-205)` once and renders the engine-exported constants; and `gainBeforeConcessions` is engine-stated, verified on the DISCRIMINATING all-elections-off case. Household cluster byte-identical before AND after the fixture run — PR-A moved nothing. Three new findings: **MON-112** (the $500,000 cap cited to s152-310/s152-305; the limit is **s152-320**), **MON-113** (`FY_OPTIONS` duplicates `TAX_YEAR_CONFIGS`), **MON-114** ("Clear" does not withdraw a saved assessment). Run record: `docs/verification/runs/VR-038.md`.',
  ];
  for (const e of entries) if (!s.includes(e.slice(0, 70))) { s = s.replace(marker, marker + e + '\n', 1); note('plan spoke 04 entry added'); }
  wr(p, s);
}
{
  const p = 'docs/IMPLEMENTATION_PLAN.md';
  let h = rd(p);
  if (!h.includes('VR-039')) {
    h = h.replace('**Last updated:** 2026-07-20 (',
      '**Last updated:** 2026-07-29 (**VR-038 + VR-039 — both VR-037 PRs Ring-3 VERIFIED**: MON-104/105/106/107/108/109/110 FIXING → VERIFIED; PR-A moved nothing (household byte-identical, cross-surface) and PR-B −$268 was verified against an independent Ring-0 bracket walk at `2f4ac8cc`, exactly three figures moved by exactly −$268 with every input figure held. MON-112 (s152-320 cap citation), MON-113 (`FY_OPTIONS` duplicates `TAX_YEAR_CONFIGS` — confirmed live) and MON-114 ("Clear" does not withdraw a saved assessment) raised. See `04_RECENTLY_COMPLETED.md`. Prior: 2026-07-20 (', 1);
    wr(p, h); note('plan hub date bumped');
  }
}

console.log(changed ? '\nvr038-039-advance: ' + changed + ' change(s). Now run: npm run issues:generate && npm run issues:check' : '\nvr038-039-advance: already applied - no-op.');
