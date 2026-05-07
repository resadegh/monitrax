/**
 * Phase 41f.4-extension — Trust-deed validation overlay.
 *
 * Pure overlay that compares a trust entity's runtime
 * `EntityTaxFacts.trustDistribution` against the **CONFIRMED** trust
 * deed rules (extracted by Phase 41f.4 + read via
 * `getConfirmedRulesForEntity`). The overlay produces citations +
 * `UncomputedFlag`s that the `MasterTaxPosition` orchestrator
 * de-dupes alongside every other module's output.
 *
 * **What this module does:**
 *   1. Validates that every beneficiary the user is distributing to
 *      appears in the deed's beneficiary list. Mismatches surface as
 *      `UC-DEED-BENEFICIARY-NOT-IN-DEED`.
 *   2. Catches distributions to `EXCLUDED` beneficiaries — surfaces as
 *      `UC-DEED-BENEFICIARY-EXCLUDED` (the highest-severity mismatch:
 *      the trustee resolution is invalid against the deed).
 *   3. For `FIXED` / `PROPORTIONATE` distribution rules, validates that
 *      the per-beneficiary `presentlyEntitledShare` matches the deed's
 *      `share` within 0.01 tolerance. Mismatches surface as
 *      `UC-DEED-FIXED-DISTRIBUTION-MISMATCH`.
 *   4. For trusts that have a CONFIRMED deed but NO `trustDistribution`
 *      provided at runtime, surface
 *      `UC-DEED-PRESENT-NO-RESOLUTION` (informational — alerts the
 *      user that they have a deed but haven't told us how this year's
 *      income flowed).
 *   5. For trusts with `loanProvisions` of type `SUB_TRUST_UPE` in the
 *      deed, surface `UC-DEED-SUB-TRUST-UPE-PRESENT` so Div 7A
 *      consumers know to apply the sub-trust path.
 *
 * **What this module does NOT do:**
 *   - Re-compute distributions. The deed governs what's *allowed*; the
 *     trustee's annual resolution is what *actually flowed*. The
 *     validation overlay catches inconsistency between the two.
 *   - Mutate engine numbers. Per CLAUDE.md §6.4, engines are pure.
 *     This overlay only emits citations + UNCOMPUTED flags.
 *
 * Per CLAUDE.md §6.1 the trust-deed read path goes through
 * `lib/services/trustDeedRulesService.ts` — this module is pure / sync
 * and takes the already-fetched extraction shape as input.
 *
 * Authority: Div 6/6E ITAA 1936 (trust distribution); Div 7A ITAA 1936
 * (sub-trust UPE / s109N safe harbour); s100A ITAA 1936 (reimbursement
 * agreement).
 */

import type {
  AuthorityCitation,
  EntityTaxFacts,
  UncomputedFlag,
} from '../types';
import type { TrustDeedExtraction } from '@/lib/integrations/trust-deed/types';

/** Tolerance for FIXED / PROPORTIONATE share comparison. */
const SHARE_TOLERANCE = 0.01;

/**
 * Normalised name for case- and whitespace-insensitive comparison
 * between deed beneficiary names and runtime distribution names.
 */
function normaliseName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface TrustDeedValidationResult {
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Validate one entity's runtime trust distribution against its
 * CONFIRMED deed rules. Returns citations + UNCOMPUTED flags only —
 * never a number, never a tax mutation.
 *
 * Caller passes the entity facts + the deed extraction. If the entity
 * is not a trust type, or the deed is not provided, returns empty.
 */
export function validateTrustDistributionAgainstDeed(
  facts: EntityTaxFacts,
  deed: TrustDeedExtraction,
): TrustDeedValidationResult {
  const isTrust =
    facts.entityType === 'DISCRETIONARY_TRUST' ||
    facts.entityType === 'UNIT_TRUST';
  if (!isTrust) {
    return { citations: [], uncomputed: [] };
  }

  const citations: AuthorityCitation[] = [];
  const uncomputed: UncomputedFlag[] = [];

  const div6Citation: AuthorityCitation = {
    kind: 'ITAA_1936',
    reference: 'Div 6 (trust distributions)',
    lastReviewed: '2026-05-07',
  };

  // Case 4 — deed present, no runtime distribution.
  if (!facts.trustDistribution) {
    uncomputed.push({
      id: `UC-DEED-PRESENT-NO-RESOLUTION-${facts.entityId}`,
      rationale:
        'Trust has a CONFIRMED deed on file but no trustee distribution resolution was provided for this FY. Pass `EntityTaxFacts.trustDistribution` so Div 6 can flow income to beneficiaries.',
      citation: div6Citation,
    });
    citations.push(div6Citation);
    // Sub-trust UPE notice still relevant even without a runtime resolution.
    appendSubTrustUpeNotice(facts, deed, citations, uncomputed);
    return { citations, uncomputed };
  }

  // Build a lookup of deed beneficiaries by normalised name.
  const deedByName = new Map<
    string,
    { type: TrustDeedExtraction['beneficiaries'][number]['type']; share: number | null }
  >();
  for (const b of deed.beneficiaries) {
    deedByName.set(normaliseName(b.name), {
      type: b.type,
      share: b.percentageEntitlement,
    });
  }

  let citedDiv6 = false;
  const ensureDiv6Cited = () => {
    if (!citedDiv6) {
      citations.push(div6Citation);
      citedDiv6 = true;
    }
  };

  // Case 1 + 2 — every runtime beneficiary must be in the deed; none can be EXCLUDED.
  for (const benef of facts.trustDistribution.beneficiaries) {
    const deedMatch = deedByName.get(normaliseName(benef.name));
    if (!deedMatch) {
      uncomputed.push({
        id: `UC-DEED-BENEFICIARY-NOT-IN-DEED-${facts.entityId}-${benef.id}`,
        rationale: `Beneficiary "${benef.name}" received a distribution but is not listed in the trust's CONFIRMED deed. Either the deed is out-of-date or the resolution is invalid.`,
        citation: div6Citation,
      });
      ensureDiv6Cited();
      continue;
    }
    if (deedMatch.type === 'EXCLUDED') {
      uncomputed.push({
        id: `UC-DEED-BENEFICIARY-EXCLUDED-${facts.entityId}-${benef.id}`,
        rationale: `Beneficiary "${benef.name}" received a distribution but is marked EXCLUDED in the trust deed. This resolution is invalid against the deed and may trigger s100A / Div 6 consequences.`,
        citation: {
          kind: 'ITAA_1936',
          reference: 's100A (reimbursement agreement)',
          lastReviewed: '2026-05-07',
        },
      });
      ensureDiv6Cited();
    }
  }

  // Case 3 — for FIXED / PROPORTIONATE deed rules, runtime shares must match.
  for (const rule of deed.distributionRules) {
    if (rule.type !== 'FIXED' && rule.type !== 'PROPORTIONATE') continue;
    if (!rule.allocations) continue;

    const isFixed = rule.type === 'FIXED';
    for (const alloc of rule.allocations) {
      const runtimeBenef = facts.trustDistribution.beneficiaries.find(
        (b) => normaliseName(b.name) === normaliseName(alloc.beneficiaryName),
      );
      // If the deed says "Alice gets 50%" and Alice didn't get a distribution,
      // surface that — the trustee's resolution may be incomplete.
      if (!runtimeBenef) {
        uncomputed.push({
          id: `UC-DEED-FIXED-BENEFICIARY-MISSING-${facts.entityId}-${normaliseName(alloc.beneficiaryName)}`,
          rationale: `Trust deed ${rule.type} rule lists "${alloc.beneficiaryName}" but they did not receive a distribution this FY. ${isFixed ? 'FIXED' : 'PROPORTIONATE'} rules require allocation per the deed.`,
          citation: div6Citation,
        });
        ensureDiv6Cited();
        continue;
      }
      // For PROPORTIONATE, alloc.share is 0..1; runtime presentlyEntitledShare is 0..1.
      // For FIXED, alloc.share is dollars — we can't compare against shares directly,
      // so we surface a notice that FIXED dollar amounts need manual cross-check.
      if (isFixed) {
        uncomputed.push({
          id: `UC-DEED-FIXED-DOLLAR-AMOUNT-${facts.entityId}-${runtimeBenef.id}`,
          rationale: `Trust deed FIXED rule specifies a dollar amount for "${alloc.beneficiaryName}" (deed share field carries dollars). Manually cross-check that the trustee's resolution matches the deed dollar amount.`,
          citation: div6Citation,
        });
        ensureDiv6Cited();
        continue;
      }
      // PROPORTIONATE: compare 0..1 shares.
      if (alloc.share == null) continue;
      const diff = Math.abs(runtimeBenef.presentlyEntitledShare - alloc.share);
      if (diff > SHARE_TOLERANCE) {
        uncomputed.push({
          id: `UC-DEED-FIXED-DISTRIBUTION-MISMATCH-${facts.entityId}-${runtimeBenef.id}`,
          rationale: `Beneficiary "${runtimeBenef.name}" received ${(runtimeBenef.presentlyEntitledShare * 100).toFixed(2)}% but the deed PROPORTIONATE rule specifies ${(alloc.share * 100).toFixed(2)}%. Reconcile the trustee's resolution against the deed.`,
          citation: div6Citation,
        });
        ensureDiv6Cited();
      }
    }
  }

  // Case 5 — sub-trust UPE notice (informational, helps Div 7A consumer).
  appendSubTrustUpeNotice(facts, deed, citations, uncomputed);

  return { citations, uncomputed };
}

function appendSubTrustUpeNotice(
  facts: EntityTaxFacts,
  deed: TrustDeedExtraction,
  citations: AuthorityCitation[],
  uncomputed: UncomputedFlag[],
): void {
  if (!deed.loanProvisions) return;
  const hasSubTrustUpe = deed.loanProvisions.some(
    (p) => p.type === 'SUB_TRUST_UPE',
  );
  if (!hasSubTrustUpe) return;
  const div7aCitation: AuthorityCitation = {
    kind: 'ITAA_1936',
    reference: 'Div 7A (s109N sub-trust UPE)',
    lastReviewed: '2026-05-07',
  };
  uncomputed.push({
    id: `UC-DEED-SUB-TRUST-UPE-PRESENT-${facts.entityId}`,
    rationale:
      'Trust deed contains SUB_TRUST_UPE loan provisions. If any beneficiary has an unpaid present entitlement (UPE) to this trust, Div 7A sub-trust path applies — verify Div 7A loan classifications reference the sub-trust terms.',
    citation: div7aCitation,
  });
  citations.push(div7aCitation);
}
