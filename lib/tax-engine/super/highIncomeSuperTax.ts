/**
 * Phase 41e.3 — Division 293 + Division 296 high-balance super tax.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.
 *
 * AU primary authority:
 *   - ITAA 1997 Div 293 — additional 15% tax on concessional super
 *     contributions for high-income earners ($250k threshold)
 *   - ITAA 1997 Div 296 — proposed additional 15% tax on TSB earnings
 *     above $3M (Royal Assent pending — gated by config flag)
 *   - ITAA 1997 s294-35 — Transfer Balance Cap (TBC; $1.9M FY24-25)
 *
 * Pure functions; no DB. Composed by the SMSF dispatch path in
 * `entityTaxRouter`.
 */

import type {
  TaxYearConfig,
  AuthorityCitation,
  UncomputedFlag,
} from '../types';

export interface HighIncomeSuperTaxInput {
  /** Income for Div 293 purposes (assessable income + total reportable
   * super contributions + reportable fringe benefits + losses, post add-backs). */
  div293Income: number;
  /** Concessional contributions YTD — base for Div 293 surcharge. */
  concessionalContributions: number;
  /** Total Super Balance at start of FY (used for Div 296 + TBC checks). */
  totalSuperBalance: number;
  /** TSB earnings during the FY (used for Div 296). Optional. */
  tsbEarnings?: number;
  /** Amount in retirement-phase super (TBC tracking). Optional. */
  transferBalanceUsed?: number;
}

export interface HighIncomeSuperTaxResult {
  div293: {
    applies: boolean;
    excessIncomeOverThreshold: number;
    /** Lesser of excess income and concessional contributions (s293-15). */
    taxableContributions: number;
    /** Additional tax payable (15% per Div 293). */
    tax: number;
  };
  div296: {
    applies: boolean;
    /** Proportion of earnings attributable to TSB > threshold. */
    excessTsbProportion: number;
    earningsTaxed: number;
    tax: number;
    /** When commencement is unverified, the calc returns 0 + UNCOMPUTED. */
    isPending: boolean;
  };
  tbc: {
    cap: number;
    used: number;
    headroom: number;
    isExceeded: boolean;
  };
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 'Div 293', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 's294-35', lastReviewed: '2026-05-05' },
];

/**
 * Compute Div 293 + Div 296 + TBC headroom for a high-income or
 * high-balance super member. Returns structurally complete result
 * regardless of inputs — when Div 296 commencement is unverified,
 * `applies` is false and `tax` is 0 with UC-DIV-296-PENDING surfaced.
 */
export function calculateHighIncomeSuperTax(
  input: HighIncomeSuperTaxInput,
  config: TaxYearConfig,
): HighIncomeSuperTaxResult {
  const citations: AuthorityCitation[] = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  // -- Division 293 ---------------------------------------------------
  const div293Threshold = config.division293Threshold;
  const div293Applies = input.div293Income > div293Threshold;
  const excessIncomeOverThreshold = Math.max(
    0,
    input.div293Income - div293Threshold,
  );
  // s293-15: taxable contributions = lesser of excess income and
  // low-tax (concessional) contributions.
  const taxableContributions = Math.min(
    excessIncomeOverThreshold,
    Math.max(0, input.concessionalContributions),
  );
  const div293Rate = config.superContributionsTaxRate; // 15% per ITAA 1997 s293-15
  const div293Tax = div293Applies ? taxableContributions * div293Rate : 0;

  // -- Division 296 (gated) -------------------------------------------
  const div296Pending = !config.div296CommencementVerified;
  const tsbAboveThreshold = Math.max(
    0,
    input.totalSuperBalance - config.div296TsbThreshold,
  );
  const tsbProportion =
    input.totalSuperBalance > 0
      ? tsbAboveThreshold / input.totalSuperBalance
      : 0;
  const earningsTaxed =
    div296Pending || !input.tsbEarnings
      ? 0
      : Math.max(0, input.tsbEarnings) * tsbProportion;
  const div296Tax = div296Pending ? 0 : earningsTaxed * config.div296Rate;
  const div296Applies =
    !div296Pending && input.totalSuperBalance > config.div296TsbThreshold;

  if (div296Pending && input.totalSuperBalance > config.div296TsbThreshold) {
    uncomputed.push({
      id: 'UC-DIV-296-PENDING',
      rationale: `TSB exceeds the proposed $${config.div296TsbThreshold.toLocaleString()} Div 296 threshold but the Bill has not received Royal Assent. No additional tax computed; once commencement is verified the calc activates automatically via config flag.`,
      citation: { kind: 'ITAA_1997', reference: 'Div 296 (proposed)', lastReviewed: '2026-05-05' },
    });
  } else if (div296Applies) {
    citations.push({
      kind: 'ITAA_1997',
      reference: 'Div 296',
      lastReviewed: '2026-05-05',
    });
  }

  // -- Transfer Balance Cap -------------------------------------------
  const tbcUsed = input.transferBalanceUsed ?? 0;
  const tbcHeadroom = Math.max(0, config.transferBalanceCap - tbcUsed);
  const tbcExceeded = tbcUsed > config.transferBalanceCap;

  if (tbcExceeded) {
    uncomputed.push({
      id: 'UC-TBC-EXCESS',
      rationale: `Transfer balance ($${tbcUsed.toLocaleString()}) exceeds the s294-35 cap of $${config.transferBalanceCap.toLocaleString()}. Excess transfer tax (s294-230) computation lands in a future sub-PR; the cap excess is reported here so the user can act on it.`,
      citation: { kind: 'ITAA_1997', reference: 's294-230', lastReviewed: '2026-05-05' },
    });
  }

  return {
    div293: {
      applies: div293Applies,
      excessIncomeOverThreshold,
      taxableContributions,
      tax: div293Tax,
    },
    div296: {
      applies: div296Applies,
      excessTsbProportion: tsbProportion,
      earningsTaxed,
      tax: div296Tax,
      isPending: div296Pending,
    },
    tbc: {
      cap: config.transferBalanceCap,
      used: tbcUsed,
      headroom: tbcHeadroom,
      isExceeded: tbcExceeded,
    },
    citations,
    uncomputed,
  };
}
