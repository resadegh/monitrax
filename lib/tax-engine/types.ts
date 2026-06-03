/**
 * Phase 20: Australian Tax Intelligence Engine
 * Type definitions
 */

// =============================================================================
// Define enums locally for type safety
// These mirror the Prisma schema enums
// =============================================================================

export enum SalaryType {
  GROSS = 'GROSS',
  NET = 'NET',
}

export enum PayFrequency {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum TaxCategory {
  SALARY_WAGES = 'SALARY_WAGES',
  ALLOWANCES = 'ALLOWANCES',
  BONUSES = 'BONUSES',
  TERMINATION = 'TERMINATION',
  DIVIDENDS_FRANKED = 'DIVIDENDS_FRANKED',
  DIVIDENDS_UNFRANKED = 'DIVIDENDS_UNFRANKED',
  INTEREST = 'INTEREST',
  CAPITAL_GAINS = 'CAPITAL_GAINS',
  RENTAL = 'RENTAL',
  GOVERNMENT_TAXABLE = 'GOVERNMENT_TAXABLE',
  GOVERNMENT_EXEMPT = 'GOVERNMENT_EXEMPT',
  GIFTS = 'GIFTS',
  INHERITANCE = 'INHERITANCE',
  INSURANCE_PAYOUT = 'INSURANCE_PAYOUT',
  HOBBY_INCOME = 'HOBBY_INCOME',
  TAX_EXEMPT = 'TAX_EXEMPT',
}

export enum SuperContributionType {
  EMPLOYER_SG = 'EMPLOYER_SG',
  SALARY_SACRIFICE = 'SALARY_SACRIFICE',
  PERSONAL_DEDUCTIBLE = 'PERSONAL_DEDUCTIBLE',
  PERSONAL_NON_DEDUCT = 'PERSONAL_NON_DEDUCT',
  SPOUSE = 'SPOUSE',
  GOVERNMENT_COCONTRIB = 'GOVERNMENT_COCONTRIB',
  DOWNSIZER = 'DOWNSIZER',
}

export enum IncomeType {
  SALARY = 'SALARY',
  RENT = 'RENT',
  RENTAL = 'RENTAL',
  INVESTMENT = 'INVESTMENT',
  OTHER = 'OTHER',
}

export enum Frequency {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

// =============================================================================
// Tax Year Configuration Types
// =============================================================================

export interface TaxBracket {
  min: number;
  max: number | null; // null for the highest bracket
  baseAmount: number;
  rate: number; // marginal rate as decimal (e.g., 0.19 for 19%)
}

export interface MedicareThresholds {
  single: number;
  family: number;
  dependentChildIncrease: number;
  shadeOutMultiplier: number; // e.g., 1.25 means shade-out is 125% of threshold
}

export interface MedicareSurchargeThreshold {
  min: number;
  max: number | null;
  rate: number;
}

export interface LITOWithdrawalTier {
  threshold: number; // Income threshold for this tier
  withdrawalRate: number; // Rate per dollar (e.g., 0.05 = 5 cents)
}

export interface LITOConfig {
  maxOffset: number;
  fullThreshold: number;
  tier1: LITOWithdrawalTier; // First withdrawal tier (5c/$)
  tier2: LITOWithdrawalTier; // Second withdrawal tier (1.5c/$)
  cutoffThreshold: number;
}

export interface TaxYearConfig {
  financialYear: string;
  startDate: Date;
  endDate: Date;

  /**
   * Display label, e.g. "FY24-25". Read by UI consumers instead of
   * hard-coding the subtitle. (CLAUDE.md §12.2 SSOT.)
   */
  label: string;

  // Tax brackets
  brackets: TaxBracket[];
  taxFreeThreshold: number;

  // Medicare
  medicareRate: number;
  medicareThresholds: MedicareThresholds;
  medicareSurchargeThresholds: MedicareSurchargeThreshold[];

  // Tax offsets
  lito: LITOConfig;
  saptoSingle: number;
  saptoCoupleEach: number;

  // Super
  superGuaranteeRate: number;
  /**
   * Maximum quarterly OTE (Ordinary Time Earnings) on which SG must
   * be paid. Above this, SG is capped. ATO publishes this annually.
   * FY24-25: $62,500; FY25-26: $65,250 (preliminary).
   */
  superGuaranteeQuarterlyCap: number;
  concessionalCap: number;
  nonConcessionalCap: number;
  division293Threshold: number;
  /**
   * Tax rate on concessional contributions inside the fund (per
   * ITAA 1997 s295-485). 15% across all FYs covered. Replaces the
   * 7 hard-coded `0.15` / `0.85` values across the tax-route layer.
   */
  superContributionsTaxRate: number;
  /**
   * Government co-contribution income threshold — phase-out upper
   * bound. Below this, eligible for some co-contribution. Indexed
   * annually. FY24-25: $60,400.
   */
  coContributionIncomeThreshold: number;
  /**
   * Total Super Balance threshold below which carry-forward of
   * unused concessional cap is permitted (ITAA s291-20(3)).
   * Currently $500,000 across all FYs.
   */
  carryForwardTsbThreshold: number;
  /**
   * Total Super Balance tiers controlling bring-forward
   * non-concessional eligibility (ITAA s292-85(2)). At or above
   * `none`, no bring-forward; between `reduced` and `none`, 2-year
   * bring-forward; below `full`, full 3-year bring-forward.
   */
  bringForwardThresholds: BringForwardThresholds;

  // CGT
  cgtDiscount: number;
  cgtDiscountMonths: number; // Holding period for discount eligibility

  /**
   * Per-FY review checkpoint. Forces an explicit human review of
   * thresholds before the FY commences. Per
   * `PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10.2.
   */
  reviewSchedule: TaxYearReviewSchedule;

  // Phase 41e.3 — high-balance super tax thresholds.
  /**
   * Transfer Balance Cap (s294-35) — maximum amount that can be moved
   * to retirement-phase super. Indexed annually. FY24-25: $1.9M.
   */
  transferBalanceCap: number;
  /**
   * Division 296 commencement flag. Divulged but not Royal Assent
   * confirmed at time of writing — this flag gates the Div 296 calc.
   * When `false`, the calc returns 0 and surfaces UC-DIV-296-PENDING.
   */
  div296CommencementVerified: boolean;
  /** Div 296 TSB threshold ($3M proposed) — applies when commencementVerified is true. */
  div296TsbThreshold: number;
  /** Div 296 additional rate on earnings attributable to TSB above threshold. */
  div296Rate: number;

  // -------------------------------------------------------------------------
  // Phase 41E reform 2026-27 — per-measure commencement flags (CLAUDE.md §12.14).
  //
  // Each flag follows the proven Div 296 pattern: when `false`, the
  // corresponding division module returns 0 / NOOP and surfaces an
  // `UC-*-PENDING-*` flag. When the Bill assents, this flag flips to
  // `true` and the rule activates with zero further code change.
  //
  // **Never flip any of these to true** without:
  //   (a) Royal Assent of the relevant Bill confirmed by Reza, AND
  //   (b) the corresponding division module's rule-mechanic populated
  //       (not just the skeleton), AND
  //   (c) the matching knowledge-pack entry in
  //       `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` updated to
  //       `status: 'assented'` with the actual Act + section reference.
  //
  // See `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10 for per-measure
  // detail; CLAUDE.md §12.14 for the project-level governance rule.
  // -------------------------------------------------------------------------

  /** Measure 1 — negative gearing → new builds only (1 Jul 2027 / FY 2027-28). */
  negativeGearingReformCommencementVerified: boolean;
  /** Measure 2 — CGT cost-base indexation regime (1 Jul 2027 / FY 2027-28). */
  cgtIndexationCommencementVerified: boolean;
  /** Measure 2 — CGT 30% minimum effective tax rate floor (1 Jul 2027). */
  cgtMinRateCommencementVerified: boolean;
  /** Measure 3 — 30% min tax on discretionary-trust taxable income (1 Jul 2028 / FY 2028-29). */
  trustMinTaxCommencementVerified: boolean;
  /** Measure 4 — foreign-resident CGT (Div 855 TARP + 365-day PAT). Exposure draft published 10 Apr 2026; TBC Royal Assent. */
  foreignResidentCgtCommencementVerified: boolean;
  /** Measure 5 — loss refundability (company carry-back, current FY 2026-27). */
  lossCarryBackCommencementVerified: boolean;
  /** Measure 8 — Electric-car FBT phase 2 (1 Apr 2027). */
  evFbtPhase2CommencementVerified: boolean;
  /** Measure 9 — Dynamic PAYG (monthly opt-in for SMEs, 1 Jul 2027). */
  dynamicPaygCommencementVerified: boolean;

  /**
   * Phase 41E Measure 2 — CPI All-Groups Quarterly index for the cost-base
   * indexation regime. Map keyed by quarter (e.g. "2027-Q3"); value = the
   * published CPI for that quarter. Populated from ATO's published CPI
   * table in Stage 2 when the indexation mechanic ships. Empty record for
   * Stage 1 — the indexation module returns UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT
   * regardless.
   */
  cpiQuarterlyIndex: Record<string, number>;
}

export interface BringForwardThresholds {
  /** Below this TSB → 3-year bring-forward available (3× cap). */
  full: number;
  /** Below this TSB → 2-year bring-forward available (2× cap). */
  reduced: number;
  /** At or above this TSB → no bring-forward (1× cap only). */
  none: number;
}

export interface TaxYearReviewSchedule {
  /** ISO date by which the next review of this FY's config is due. */
  nextReviewBy: string;
  /**
   * Who's responsible for the review. Owners read this so they
   * know whose desk the review lands on each year.
   */
  reviewers: string[];
}

// =============================================================================
// Salary Processing Types
// =============================================================================

export interface SalaryInput {
  amount: number;
  salaryType: 'GROSS' | 'NET';
  payFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  salarySacrifice?: number;
  salarySacrificeFrequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  hasTaxFreeThreshold?: boolean; // Default true
  hasHECSDebt?: boolean;
  hecsDebt?: number;
}

export interface SalaryBreakdown {
  // Annual amounts
  grossSalary: number;
  netSalary: number;

  // Superannuation
  superGuarantee: number;
  salarySacrifice: number;
  totalSuper: number;

  // Tax
  taxableIncome: number; // Gross - Salary Sacrifice
  paygWithholding: number;
  medicareLevy: number;
  totalTax: number;

  // Per pay period amounts
  perPeriod: {
    gross: number;
    super: number;
    tax: number;
    net: number;
    frequency: string;
  };

  // Calculation breakdown for display
  calculations: CalculationStep[];
}

export interface CalculationStep {
  label: string;
  value: number;
  operation?: '+' | '-' | '=' | '*';
  explanation?: string;
}

// =============================================================================
// PAYG Types
// =============================================================================

export interface PAYGCoefficients {
  a: number;
  b: number;
}

export interface PAYGScale {
  weeklyEarningsMin: number;
  weeklyEarningsMax: number | null;
  coefficients: PAYGCoefficients;
}

// =============================================================================
// Income Taxability Types
// =============================================================================

export interface TaxabilityResult {
  category: string; // TaxCategory enum value
  taxableAmount: number;
  exemptAmount: number;
  frankingCredits: number;
  grossedUpAmount: number;
  explanation: string;
  references: string[];
}

export interface IncomeContext {
  incomeType: string;
  amount: number;
  frequency: string;
  propertyId?: string;
  investmentAccountId?: string;
  frankingPercentage?: number;
  isFromTrust?: boolean;
  isGovernmentPayment?: boolean;
  paymentType?: string;
}

// =============================================================================
// Tax Position Types
// =============================================================================

export interface TaxPositionInput {
  userId: string;
  financialYear: string;
}

export interface IncomeBreakdown {
  salary: number;
  rental: number;
  dividends: number;
  interest: number;
  capitalGains: number;
  other: number;
  total: number;
  frankingCredits: number;
}

export interface DeductionBreakdown {
  workRelated: number;
  property: number;
  investment: number;
  depreciation: number;
  other: number;
  total: number;
}

export interface TaxCalculation {
  assessableIncome: number;
  taxableIncome: number;
  taxOnIncome: number;
  medicareLevy: number;
  medicareSurcharge: number;
  grossTax: number;
  offsets: TaxOffsets;
  netTax: number;
  effectiveRate: number;
  marginalRate: number;
}

export interface TaxOffsets {
  lito: number;
  sapto: number;
  frankingCredits: number;
  foreignTax: number;
  other: number;
  total: number;
}

export interface TaxPositionResult {
  financialYear: string;
  income: IncomeBreakdown;
  deductions: DeductionBreakdown;
  tax: TaxCalculation;
  paygWithheld: number;
  estimatedRefund: number; // Positive = refund, Negative = owing
  superContributions: {
    concessional: number;
    nonConcessional: number;
    total: number;
    division293Tax: number;
  };
  warnings: string[];
  recommendations: TaxRecommendation[];
}

export interface TaxRecommendation {
  id: string;
  type: 'SAVINGS' | 'OPTIMIZATION' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// =============================================================================
// Super Types
// =============================================================================

export interface SuperPosition {
  totalBalance: number;
  taxableComponent: number;
  taxFreeComponent: number;
  currentYearContributions: {
    concessional: number;
    nonConcessional: number;
    employerSG: number;
    salarySacrifice: number;
    personalDeductible: number;
  };
  caps: {
    concessional: number;
    nonConcessional: number;
    carryForwardAvailable: number;
  };
  remainingCaps: {
    concessional: number;
    nonConcessional: number;
  };
  warnings: string[];
}

// =============================================================================
// Scenario Modelling Types
// =============================================================================

export interface TaxScenario {
  name: string;
  changes: {
    additionalIncome?: number;
    additionalDeductions?: number;
    salarySacrificeChange?: number;
    sellProperty?: string;
    sellInvestment?: { holdingId: string; amount: number };
  };
}

export interface ScenarioResult {
  scenario: TaxScenario;
  originalTax: number;
  newTax: number;
  difference: number;
  percentageChange: number;
  breakdown: TaxPositionResult;
}

// =============================================================================
// Helper Types
// =============================================================================

export interface FinancialYear {
  year: string; // e.g., "2024-25"
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

export function getCurrentFinancialYear(): FinancialYear {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Australian FY runs July 1 to June 30
  if (month >= 6) {
    // July onwards = current year to next year
    return {
      year: `${year}-${(year + 1).toString().slice(-2)}`,
      startDate: new Date(year, 6, 1), // July 1
      endDate: new Date(year + 1, 5, 30), // June 30
      isCurrent: true,
    };
  } else {
    // Before July = previous year to current year
    return {
      year: `${year - 1}-${year.toString().slice(-2)}`,
      startDate: new Date(year - 1, 6, 1),
      endDate: new Date(year, 5, 30),
      isCurrent: true,
    };
  }
}

export function parseFinancialYear(fy: string): FinancialYear {
  // Parse "2024-25" format
  const [startYear] = fy.split('-');
  const year = parseInt(startYear, 10);

  const now = new Date();
  const currentFY = getCurrentFinancialYear();

  return {
    year: fy,
    startDate: new Date(year, 6, 1),
    endDate: new Date(year + 1, 5, 30),
    isCurrent: fy === currentFY.year,
  };
}

// =============================================================================
// Phase 41e.0 — Entity-Aware Orchestration Types
// =============================================================================
//
// Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §4 + the audit
// doc §6.2, these types are the contract that the 41e orchestration layer
// (`entityTaxRouter` + per-rule modules + `MasterTaxPosition` orchestrator)
// builds against. They sit alongside the existing Phase 20 individual-level
// types (TaxYearConfig, TaxPositionResult, etc.) — Phase 20 is preserved as
// a calc-primitive library; 41e composes those primitives entity by entity.
//
// Authority-citation traceability is mandatory per architecture doc §1(3) —
// every rule result the new layer produces carries an `AuthorityCitation`
// recording the ITAA section / SIS Act / TR / TD / PCG it was computed
// against. The cumulative set of citations per `MasterTaxPosition` is the
// audit trail a registered tax agent reviewer reads to verify the snapshot.

/**
 * Reference to the AU primary authority a tax-rule result was computed
 * against. Consumed by the AFSL/TPB/NCCP boundaries renderer to show
 * "computed per ITAA 1997 s115-25" footnotes wherever a calculated number
 * is surfaced.
 */
export interface AuthorityCitation {
  /** Type of source — keeps citations easy to filter + style consistently. */
  kind:
    | 'ITAA_1936'
    | 'ITAA_1997'
    | 'SIS_ACT'
    | 'TR' // Taxation Ruling
    | 'TD' // Taxation Determination
    | 'PCG' // Practical Compliance Guideline
    | 'PS_LA' // Practice Statement Law Administration
    | 'STATE_DUTIES_ACT'
    | 'STATE_LAND_TAX_ACT';
  /** e.g. "s115-25", "Div 6", "TR 2022/4". */
  reference: string;
  /** ISO date when the citation was last reviewed against the live source. */
  lastReviewed: string;
}

/**
 * FY-indexed reference for any threshold lookup. Per architecture doc §1(6),
 * thresholds are NEVER hard-coded — every consumer asks for `FYReference`
 * + a key, and `taxYearConfig.ts` is the single resolver.
 */
export interface FYReference {
  financialYear: string;
  /** Display label, e.g. "FY24-25" — same as `TaxYearConfig.label`. */
  label: string;
}

/**
 * Per-entity facts the tax dispatcher needs to compute that entity's tax
 * position. Composed from the new entity-aware aggregator outputs (slice
 * C of 41e.0) — every income / expense / loan / property / investment /
 * asset row the entity owns, plus structural metadata (entity type, role,
 * trustee chain, etc.) that drives the dispatch.
 *
 * Sub-PRs 41e.1+ progressively populate the optional fields:
 *   - 41e.1 adds `cgtEvents` for Div 115 dispatch
 *   - 41e.4 adds `trustDistributionResolutions` for Div 6/6E streaming
 *   - 41e.6 adds `div7aLoans` for private-company loan compliance
 *   - 41e.11 adds `lrbaArrangements` + `brpHoldings` for SMSF dispatch
 */
export interface EntityTaxFacts {
  entityId: string;
  /**
   * Mirrors the Prisma `LegalEntityType` enum. Phase 44 (Part 1a) widened
   * this from the original 7 values to the full structural grammar. The
   * tax dispatcher handles the original 7 explicitly; the Phase 44
   * additions fall through to its existing default until Part 1b wires
   * regime-aware dispatch for them — no dispatch behaviour changes here.
   */
  entityType:
    | 'PERSONAL_NAME'
    | 'COMPANY'
    | 'DISCRETIONARY_TRUST'
    | 'UNIT_TRUST'
    | 'SMSF'
    | 'PARTNERSHIP'
    | 'SOLE_TRADER'
    | 'INDIVIDUAL'
    | 'FIXED_TRUST'
    | 'HYBRID_TRUST'
    | 'BARE_TRUST'
    | 'TESTAMENTARY_TRUST'
    | 'DECEASED_ESTATE'
    | 'FOREIGN_COMPANY'
    | 'INCORPORATED_ASSOCIATION'
    | 'CO_OPERATIVE'
    | 'STRATA_BODY_CORPORATE'
    | 'CUSTODIAN_PLATFORM'
    | 'OTHER';
  /** FY this fact-set applies to. */
  fy: FYReference;
  /**
   * Income items owned by this entity (filtered by `ownerEntityId`).
   * Shape matches `IncomeItem` from
   * `lib/tax-engine/position/taxPositionCalculator.ts`. Imported as a
   * structural row to avoid a circular import — the per-rule modules
   * that compose this type also import from `position/`.
   */
  incomes: ReadonlyArray<{
    id: string;
    name: string;
    type: string;
    amount: number;
    frequency: string;
    propertyId?: string;
    investmentAccountId?: string;
    grossAmount?: number;
    paygWithholding?: number;
    frankingPercentage?: number;
    frankingCredits?: number;
  }>;
  /** Expense items owned by this entity. Same shape as `ExpenseItem`. */
  expenses: ReadonlyArray<{
    id: string;
    name: string;
    category: string;
    amount: number;
    frequency: string;
    isTaxDeductible: boolean;
    propertyId?: string;
    loanId?: string;
    investmentAccountId?: string;
  }>;
  /** Depreciation schedules. Same shape as `DepreciationItem`. */
  depreciations: ReadonlyArray<{
    id: string;
    propertyId: string;
    currentYearDeduction: number;
    type: string;
  }>;
  /** Super contributions in scope (only meaningful for SMSF / individuals). */
  superContributions?: {
    concessional: number;
    nonConcessional: number;
  };
  /**
   * 41e.4+ — streaming resolution metadata for trust entities. If absent
   * for a DISCRETIONARY_TRUST at FY-end, the dispatcher applies the
   * default-distribution penalty rate per s99A.
   */
  trustDistributionResolutionAt?: string;
  /**
   * Phase 41e.1 slice D-1 — trust distribution allocation for
   * DISCRETIONARY_TRUST / UNIT_TRUST entities. When provided, the
   * router runs `allocateTrustDistribution` and produces a real
   * `EntityTaxPosition.result` instead of the UNCOMPUTED-flagged
   * placeholder. When absent, the router falls back to the
   * UNCOMPUTED branch (audit §10.3 — never false numbers).
   *
   * `trustNetIncome` is the s95 net income (already computed by
   * caller). `beneficiaries` carries presently-entitled shares.
   * Streaming (Div 6E character allocation) lands in 41e.4 and
   * surfaces a `UC-DIV-6E-STREAMING` flag until then.
   */
  trustDistribution?: {
    trustNetIncome: number;
    beneficiaries: ReadonlyArray<{
      id: string;
      name: string;
      presentlyEntitledShare: number;
      isNonResidentOrDisabled?: boolean;
      /**
       * Phase 41e.4 — per-beneficiary streaming allocation. Absolute
       * dollars of franked dividends / capital gains streamed to this
       * beneficiary. Activates Div 6E when paired with a valid
       * `streamingResolutionAt` and `characterPools`.
       */
      streaming?: {
        frankedDividends?: number;
        capitalGains?: number;
      };
    }>;
    hasFamilyTrustElection?: boolean;
    /**
     * Phase 41e.4 — character pools in the trust net income that
     * can be streamed under Div 6E.
     */
    characterPools?: {
      frankedDividends?: number;
      capitalGains?: number;
    };
    /** Phase 41e.4 — ISO date trustee passed streaming resolution. */
    streamingResolutionAt?: string;
    /**
     * Phase 41e.5 — `true` if testamentary trust / deceased estate.
     * Drives WHITE-zone classification per PCG 2022/2 ¶13.
     */
    isTestamentaryTrust?: boolean;
    /**
     * Phase 41e.5 — per-beneficiary s100A facts. When provided, the
     * conservative blanket UC-S100A-RISK flag is replaced with a real
     * PCG 2022/2 classification (white/green/blue/red) on the result's
     * `s100aClassification` field.
     */
    s100aFacts?: ReadonlyArray<{
      beneficiaryId: string;
      relationshipToController?:
        | 'CONTROLLER'
        | 'IMMEDIATE_FAMILY'
        | 'EXTENDED_FAMILY'
        | 'UNRELATED';
      isMinor?: boolean;
      beneficiaryReceivedFunds?: boolean;
      unpaidPresentEntitlement?: boolean;
      fundsUsedByOther?: boolean;
    }>;
  };
  /**
   * Phase 41e.1 slice D-2 — CGT events for the FY. When non-empty,
   * the router runs `applyCapitalLossNetting` (which composes Div 115
   * discount per entity type) and attaches the result to
   * `EntityTaxPosition.cgtResult`. Independent of `result` so a
   * TRUST entity can carry BOTH a Div 6 distribution (in `result`)
   * AND a CGT calc (in `cgtResult`); a COMPANY entity carries only
   * `cgtResult` (its base income tax dispatch lands with 41e.7).
   */
  cgtEvents?: ReadonlyArray<{
    id: string;
    monthsHeld: number;
    nominalAmount: number;
    label?: string;
  }>;
  /**
   * Unused capital losses from prior FYs, oldest-first per s100-50.
   * Caller passes the unconsumed balance from the user's CGT register.
   */
  carryForwardCapitalLosses?: ReadonlyArray<{
    financialYear: string;
    amount: number;
  }>;
  /** SMSF-specific: complying status for s115-100 1/3 discount. */
  smsfIsComplying?: boolean;
  /** Subdiv 115-D foreign-resident flag — surfaces UNCOMPUTED. */
  isForeignResident?: boolean;
  /**
   * Phase 41e.2 — SMSF contribution caps. When provided for an SMSF
   * entity, the router runs the existing `capTracker.trackContributionCaps`
   * primitive and produces an `EntityTaxPosition.result` containing the
   * `CapTrackingResult` shape. Until then the SMSF stays UNCOMPUTED.
   *
   * Concessional + non-concessional YTD totals at the date of dispatch
   * (typically pulled from `SuperContribution` rows). Carry-forward
   * unused amounts from prior FYs feed the s291-20(3) carry-forward
   * rule. `totalSuperBalance` gates the bring-forward eligibility per
   * s292-85(2) — config thresholds in `bringForwardThresholds`.
   */
  smsfContributions?: {
    concessionalYTD: number;
    nonConcessionalYTD: number;
    totalSuperBalance?: number;
    carryForwardAmounts?: ReadonlyArray<{
      financialYear: string;
      unusedAmount: number;
    }>;
  };
  /**
   * Phase 41e.3 — Div 293 / Div 296 / TBC inputs. Optional companion
   * to `smsfContributions`. Surfaces high-income surcharge and
   * high-balance tax on the SMSF dispatch result (under
   * `result.highIncomeSuperTax`). Div 296 is gated by
   * `config.div296CommencementVerified` until Royal Assent.
   */
  highIncomeSuper?: {
    /** Income for Div 293 purposes (s293-15 calc). */
    div293Income: number;
    /** Concessional contributions (typically same as smsfContributions.concessionalYTD). */
    concessionalContributions: number;
    /** Total Super Balance at start of FY. */
    totalSuperBalance: number;
    /** TSB earnings during the FY (Div 296 base). Optional. */
    tsbEarnings?: number;
    /** Amount in retirement phase super (TBC tracking). */
    transferBalanceUsed?: number;
  };
  /**
   * Phase 41e.6 — Division 7A loans owed by the COMPANY entity to a
   * shareholder/associate. When provided for a COMPANY entity, the
   * router runs `classifyDiv7ALoans` and returns the result on the
   * entity's `result.div7aClassification`. Without data, the COMPANY
   * UNCOMPUTED placeholder remains.
   */
  div7aLoans?: ReadonlyArray<{
    loanId: string;
    loanLabel?: string;
    openingBalance: number;
    yearsRemaining: number;
    benchmarkRate: number;
    paymentsMadeThisFy: number;
    hasComplianceAgreement: boolean;
    isSubTrustUpe?: boolean;
  }>;
  /**
   * Phase 44 Part 2c-i — SMSF fund-earnings income tax. When provided for
   * an SMSF entity, the router runs `calculateSmsfIncomeTax` (Div 295 —
   * 15% concessional / ECPI / NALI top-rate) and adds the result to the
   * entity's `result.smsfIncomeTax`. Shape mirrors `SmsfIncomeTaxInput`
   * from `lib/tax-engine/super/smsfIncomeTax.ts` — inlined here to avoid
   * a circular import (same rationale as the other dispatch fields).
   */
  smsfIncomeTax?: {
    assessableInvestmentIncome: number;
    deductions: number;
    assessableContributions: number;
    nonArmsLengthIncome: number;
    isComplying: boolean;
    isInPensionPhase: boolean;
    ecpiExemptProportion?: number;
    /** Phase 44.2 slice 2 — refundable franking credits (Div 207 + s67-25). */
    frankingCredits?: number;
  };
}

/**
 * Per-entity tax position — the output of dispatching a single entity
 * through `entityTaxRouter`. Wraps a Phase 20 `TaxPositionResult` for
 * PERSONAL_NAME flows, or a NET-NEW result shape for COMPANY / TRUST /
 * SMSF flows (precise shape TBD per sub-PR — kept as `unknown` here so
 * sub-PRs can refine without churn in this commit).
 */
export interface EntityTaxPosition {
  entityId: string;
  entityType: EntityTaxFacts['entityType'];
  fy: FYReference;
  /** The actual tax computation output. PERSONAL_NAME ⇒ `TaxPositionResult`. */
  result: unknown;
  /**
   * Phase 41e.1 slice D-2 — optional CGT calc result when the entity
   * had `cgtEvents` for the FY. Populated by `applyCapitalLossNetting`.
   * Independent of `result` so an entity can carry both an income-tax
   * computation AND a CGT computation (or just one). Shape is the
   * `CapitalLossNettingResult` from `divisions/capitalLossNetting.ts`
   * — kept as `unknown` here per the same rationale as `result`.
   */
  cgtResult?: unknown;
  /** Cumulative authority citations for every rule applied. */
  citations: AuthorityCitation[];
  /** UNCOMPUTED items flagged during dispatch (per audit §10.3). */
  uncomputed: UncomputedFlag[];
}

/**
 * Audit-friendly statement of "this is what we deliberately did not
 * compute, and why." Per audit doc §10.3 — every UNCOMPUTED item
 * surfaces as a UI badge with plain-English explanation, never a false
 * number.
 */
export interface UncomputedFlag {
  /** Stable identifier, e.g. `UC-FBT`, `UC-PROPERTY-DEPRECIATION`. */
  id: string;
  /** Plain-English rationale shown to the user. */
  rationale: string;
  /** Linked authority if the omission has one (rare). */
  citation?: AuthorityCitation;
}

/**
 * Household-wide tax position — sum of every entity's `EntityTaxPosition`
 * for a given user + FY, plus inter-entity flows (Div 6 distributions
 * pushed from trust → beneficiary, Div 7A imputations from company →
 * shareholder, etc.) that 41e.4+ progressively model.
 *
 * This is the canonical replacement for `buildTaxSummary()` once 41e.17
 * ships the orchestrator. Until then, slice C's adapter remains the
 * bridge.
 */
export interface MasterTaxPosition {
  userId: string;
  fy: FYReference;
  entities: EntityTaxPosition[];
  /** Cumulative across the household — the snapshot summary number. */
  totals: {
    assessableIncome: number;
    taxableIncome: number;
    netTax: number;
    paygWithheld: number;
    estimatedRefund: number;
  };
  /** Aggregate of every entity's authority citations, deduplicated. */
  authoritySources: AuthorityCitation[];
  /** Aggregate UNCOMPUTED flags across all entities, deduplicated. */
  uncomputed: UncomputedFlag[];
  computedAt: string;
}
