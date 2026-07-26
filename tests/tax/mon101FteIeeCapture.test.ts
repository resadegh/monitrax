/**
 * MON-101 (capture Stage 1) — FTE/IEE beneficiary facts are CAPTURED and
 * flow through the ONE producer into the live overlay, with the
 * all-or-nothing safe default (Reza GO 2026-07-26).
 *
 * The load-bearing rule under test: a null `hasQuotedTfn` can NEVER
 * fabricate a classification. null→false would invent a 47% Pt VA
 * withholding; null→true would suppress a real one — so the assembler
 * builds `FteIeeInput` ONLY when the trust's election is on AND every
 * allocated beneficiary has `relationship` + `hasQuotedTfn` explicitly
 * set. Anything less = overlay inert = today's numbers byte-unchanged.
 *
 * §19.2 worked example (locked end-to-end): election ON, Reza
 * TEST_INDIVIDUAL/TFN-yes 60%, outside-family company (no IEE) 40% of
 * $100,000 → FTDT = 0.47 × $40,000 = **$18,800** trustee-payable,
 * surfaced via the orchestrator with s271-15 cited.
 *
 * Coverage (precise): verifies the pure gate + mapping and the
 * orchestrator flow from a built input. Does NOT verify the Prisma read
 * path (assembleFteIeeInput's DB query — exercised in CI route harnesses
 * and by Ring-3 on a seeded trust) and does NOT verify the dialog UX.
 */
import { describe, it, expect } from 'vitest';
import { buildFteIeeInput } from '../../lib/services/entityTaxFactsAssembler';
import type { DistributionResolutionSummary } from '../../lib/services/distributionResolutionService';
import {
  buildMasterTaxPosition,
  buildMasterTaxPositionDecimal,
  type MasterTaxPositionInput,
} from '../../lib/tax-engine/orchestrator/masterTaxPosition';

const FY = { financialYear: '2025-26' } as MasterTaxPositionInput['fy'];

const alloc = (
  id: string,
  share: number,
  relationship: DistributionResolutionSummary['allocations'][number]['relationship'],
  hasQuotedTfn: boolean | null,
  coveredByIee: boolean | null = null,
): DistributionResolutionSummary['allocations'][number] => ({
  id: `a-${id}`,
  beneficiaryEntityId: id,
  presentlyEntitledShare: share,
  streamedFrankedDividends: null,
  streamedCapitalGains: null,
  relationship,
  hasQuotedTfn,
  coveredByIee,
});

const resolution = (
  over: Partial<DistributionResolutionSummary> = {},
): DistributionResolutionSummary => ({
  id: 'r1',
  trustEntityId: 'trust-1',
  financialYear: '2025-26',
  trustNetIncome: 100_000,
  distributableIncome: null,
  resolutionDate: new Date('2026-06-15'),
  frankedDividendPool: null,
  capitalGainPool: null,
  hasFamilyTrustElection: true,
  status: 'CONFIRMED' as DistributionResolutionSummary['status'],
  accountantVerified: false,
  allocations: [
    alloc('reza', 0.6, 'TEST_INDIVIDUAL', true),
    alloc('opal-co', 0.4, 'OUTSIDE_FAMILY', true, false),
  ],
  ...over,
});

const names = new Map([
  ['reza', 'Reza Sadegh'],
  ['opal-co', 'Opal Investments Pty Ltd'],
]);

describe('MON-101 · the all-or-nothing safe-default gate (buildFteIeeInput)', () => {
  it('election OFF → null (overlay inert), even with complete facts', () => {
    expect(buildFteIeeInput(resolution({ hasFamilyTrustElection: false }), names)).toBeNull();
  });

  it('ANY beneficiary missing relationship → null (never-asked is never classified)', () => {
    const r = resolution({
      allocations: [alloc('reza', 0.6, 'TEST_INDIVIDUAL', true), alloc('opal-co', 0.4, null, true)],
    });
    expect(buildFteIeeInput(r, names)).toBeNull();
  });

  it('ANY beneficiary with hasQuotedTfn null ("Not sure") → null — a null NEVER fabricates a 47% withholding', () => {
    const r = resolution({
      allocations: [alloc('reza', 0.6, 'TEST_INDIVIDUAL', true), alloc('newsha', 0.4, 'FAMILY_MEMBER', null)],
    });
    expect(buildFteIeeInput(r, names)).toBeNull();
  });

  it('complete facts → FteIeeInput with distributionAmount = share × trustNetIncome (the ONE s95 base)', () => {
    const input = buildFteIeeInput(resolution(), names);
    expect(input).not.toBeNull();
    expect(input!.hasFamilyTrustElection).toBe(true);
    expect(input!.beneficiaries).toHaveLength(2);
    expect(input!.beneficiaries[0]).toMatchObject({
      beneficiaryId: 'reza',
      beneficiaryName: 'Reza Sadegh',
      distributionAmount: 60_000,
      relationship: 'TEST_INDIVIDUAL',
      hasQuotedTfn: true,
    });
    expect(input!.beneficiaries[1]).toMatchObject({
      beneficiaryId: 'opal-co',
      distributionAmount: 40_000,
      relationship: 'OUTSIDE_FAMILY',
      coveredByIee: false,
    });
  });
});

describe('MON-101 · captured facts fire the live overlay end-to-end (§19.2 worked example)', () => {
  it('outside-family 40% of $100,000 without IEE → FTDT $18,800 trustee-payable, s271-15 cited (both twins)', () => {
    const fteInput = buildFteIeeInput(resolution(), names)!;
    for (const build of [buildMasterTaxPosition, buildMasterTaxPositionDecimal]) {
      const r = build({ userId: 'u1', fy: FY, entities: [], fteIeeByEntity: { 'trust-1': fteInput } });
      const fte = r.crossCutting?.fteIeeByEntity?.['trust-1'];
      expect(fte?.totalFtdtPayable).toBe(18_800); // 0.47 × 40,000
      expect(fte?.classifications.find((c) => c.beneficiaryId === 'opal-co')?.outcome).toBe('OUTSIDE_FAMILY_FTDT');
      expect(fte?.classifications.find((c) => c.beneficiaryId === 'reza')?.outcome).toBe('INSIDE_FAMILY');
      expect(r.authoritySources.some((c) => c.reference === 's271-15 (FTDT)')).toBe(true);
      expect(r.uncomputed.some((u) => u.id === 'UC-FTDT-OUTSIDE-FAMILY')).toBe(true);
    }
  });

  it('the same trust with the gate CLOSED (one "Not sure") → no overlay input → byte-identical position', () => {
    const gated = buildFteIeeInput(
      resolution({
        allocations: [alloc('reza', 0.6, 'TEST_INDIVIDUAL', true), alloc('opal-co', 0.4, 'OUTSIDE_FAMILY', null)],
      }),
      names,
    );
    expect(gated).toBeNull();
    const withOut = buildMasterTaxPositionDecimal({ userId: 'u1', fy: FY, entities: [] });
    expect(withOut.crossCutting?.fteIeeByEntity).toBeUndefined();
    expect(withOut.modulesInvoked).not.toContain('fteIeeClassifier');
  });
});
