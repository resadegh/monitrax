/**
 * Phase 41e.13 — Cross-state land tax aggregator.
 *
 * When the same owner holds taxable land in multiple Australian
 * states, each state assesses **independently** — there is no
 * federal aggregation. BUT within a single state, the same owner's
 * multiple parcels are aggregated against that state's threshold
 * and progressive scale (NSW Land Tax Mgmt Act 1956 Pt 4 grouping;
 * VIC Land Tax Act 2005 Pt 3 Div 4; QLD Land Tax Act 2010 Pt 5).
 *
 * This module:
 *   1. Groups properties by state.
 *   2. Sums `taxableLandValue` per state.
 *   3. Calls `calculateLandTax` for each state's aggregated value.
 *   4. Sums the per-state totals into a grand-total result.
 *
 * **What this does NOT do (UNCOMPUTED):**
 *   - Joint ownership apportionment (multiple owners on a single
 *     parcel — each is liable for their share, sometimes with
 *     thresholds applied separately, sometimes jointly per state).
 *   - Trustee aggregation across multiple trusts under common
 *     control (NSW grouping s27A, QLD related-corporation rules).
 *   - Group threshold provisions for related corporations.
 *   - Mid-year disposals / acquisitions.
 *
 * Authority:
 *   - Each state's Land Tax Act + Schedule (see per-state configs
 *     in `stateLandTax.ts`).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';
import {
  calculateLandTax,
  getLandTaxConfig,
  type AustralianState,
  type LandTaxConfig,
  type LandTaxOwnershipType,
  type LandTaxResult,
} from './stateLandTax';

export interface PortfolioProperty {
  /** Caller's stable id (e.g. the property's GRDCS id). */
  propertyId: string;
  state: AustralianState;
  /** Taxable land value at year-end for this single parcel. */
  taxableLandValue: number;
  /** `true` if residential — drives foreign surcharge in NSW/TAS/ACT. */
  isResidential: boolean;
}

export interface CrossStateLandTaxInput {
  properties: PortfolioProperty[];
  /** Owner's legal entity type — applied uniformly across all properties. */
  ownershipType: LandTaxOwnershipType;
  /** Owner's foreign-resident status — applied uniformly. */
  isForeignOwner: boolean;
  /**
   * Optional per-state config override. Defaults to the registered
   * config from `getLandTaxConfig(state)`. Useful for FY snapshots
   * or future-year projections.
   */
  configOverrides?: Partial<Record<AustralianState, LandTaxConfig>>;
}

export interface PerStateAssessment {
  state: AustralianState;
  /** Sum of taxable land values for all parcels in this state. */
  aggregatedValue: number;
  /** Number of parcels assessed. */
  parcelCount: number;
  /** Per-state result (general + trust + foreign). */
  result: LandTaxResult;
}

export interface CrossStateLandTaxResult {
  perStateAssessments: PerStateAssessment[];
  grandTotalGeneralTax: number;
  grandTotalTrustSurcharge: number;
  grandTotalForeignSurcharge: number;
  grandTotalTax: number;
  /** Number of states with at least one parcel. */
  statesAssessed: number;
  /** De-duplicated citations across all assessed states. */
  citations: AuthorityCitation[];
  /** De-duplicated UNCOMPUTED flags across all assessed states. */
  uncomputed: UncomputedFlag[];
}

/**
 * Aggregate land tax across an owner's multi-state portfolio.
 *
 * **Within a state:** parcels are summed and assessed against that
 * state's progressive scale (so two $400k VIC parcels = one $800k
 * VIC assessment, not two $400k assessments).
 *
 * **Across states:** independently. Each state runs its own threshold
 * + brackets + surcharges. Total = sum of per-state totals.
 *
 * **Determinism:** per-state assessments are returned sorted by state
 * code (alphabetical) for stable rendering.
 */
export function calculateCrossStateLandTax(
  input: CrossStateLandTaxInput,
): CrossStateLandTaxResult {
  const { properties, ownershipType, isForeignOwner, configOverrides } = input;

  // Group properties by state.
  const byState = new Map<
    AustralianState,
    { aggregatedValue: number; parcelCount: number; isResidential: boolean }
  >();
  for (const p of properties) {
    const existing = byState.get(p.state);
    if (existing) {
      existing.aggregatedValue += p.taxableLandValue;
      existing.parcelCount += 1;
      // If ANY parcel in the state is residential, treat aggregated
      // value as residential for foreign-surcharge purposes (NSW
      // Sch 1A applies parcel-level — v1 surfaces UC).
      existing.isResidential = existing.isResidential || p.isResidential;
    } else {
      byState.set(p.state, {
        aggregatedValue: p.taxableLandValue,
        parcelCount: 1,
        isResidential: p.isResidential,
      });
    }
  }

  const perStateAssessments: PerStateAssessment[] = [];
  for (const [state, agg] of byState) {
    const config = configOverrides?.[state] ?? getLandTaxConfig(state);
    const result = calculateLandTax(
      {
        taxableLandValue: agg.aggregatedValue,
        ownershipType,
        isForeignOwner,
        isResidential: agg.isResidential,
      },
      config,
    );
    perStateAssessments.push({
      state,
      aggregatedValue: agg.aggregatedValue,
      parcelCount: agg.parcelCount,
      result,
    });
  }

  // Stable order — alphabetical by state.
  perStateAssessments.sort((a, b) => a.state.localeCompare(b.state));

  // Sum totals.
  let grandTotalGeneralTax = 0;
  let grandTotalTrustSurcharge = 0;
  let grandTotalForeignSurcharge = 0;
  for (const a of perStateAssessments) {
    grandTotalGeneralTax += a.result.generalLandTax;
    grandTotalTrustSurcharge += a.result.trustSurcharge;
    grandTotalForeignSurcharge += a.result.foreignOwnerSurcharge;
  }

  // De-dupe citations + UNCOMPUTED flags.
  const citationKey = (c: AuthorityCitation) => `${c.kind}|${c.reference}`;
  const seenCit = new Set<string>();
  const citations: AuthorityCitation[] = [];
  for (const a of perStateAssessments) {
    for (const c of a.result.citations) {
      const k = citationKey(c);
      if (!seenCit.has(k)) {
        seenCit.add(k);
        citations.push(c);
      }
    }
  }

  const seenUc = new Set<string>();
  const uncomputed: UncomputedFlag[] = [];
  for (const a of perStateAssessments) {
    for (const u of a.result.uncomputed) {
      if (!seenUc.has(u.id)) {
        seenUc.add(u.id);
        uncomputed.push(u);
      }
    }
  }

  // Surface joint-ownership / grouping nuance UNCOMPUTED.
  if (perStateAssessments.length > 0) {
    uncomputed.push({
      id: 'UC-LAND-TAX-JOINT-OWNERSHIP',
      rationale:
        'Joint ownership apportionment and inter-trust grouping rules (NSW Land Tax Mgmt Act 1956 Pt 4 grouping, QLD Land Tax Act 2010 Pt 5 related corporations) are NOT computed in v1. The aggregator assumes a single owner across all parcels in `properties`. Engage a registered tax agent for joint-ownership / common-control scenarios.',
    });
  }

  return {
    perStateAssessments,
    grandTotalGeneralTax,
    grandTotalTrustSurcharge,
    grandTotalForeignSurcharge,
    grandTotalTax:
      grandTotalGeneralTax +
      grandTotalTrustSurcharge +
      grandTotalForeignSurcharge,
    statesAssessed: perStateAssessments.length,
    citations,
    uncomputed,
  };
}
