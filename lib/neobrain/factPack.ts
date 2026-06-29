/**
 * Neobrain — Personal Financial Index (the "FactPack").
 *
 * Phase 54 §15 Phase A. The factual-grounding layer the Gemini agent reasons
 * over so it never invents numbers. This module assembles a typed, read-through
 * view of the user's real financial facts + app-level reference data — and
 * PERSISTS NOTHING (Reza directive 2026-06-27: "be mindful of what data will be
 * stored … just useful and relevant data"). It is a VIEW over the existing
 * canonical SSOTs, not a new store:
 *
 *   - user values    ← getMasterFinancialSnapshot()  (§6.1 SSOT)
 *   - app values     ← CATEGORY_HIERARCHY + taxYearConfig
 *   - derived facts   ← the snapshot's own engine-computed fields (never AI prose)
 *
 * The grounding contract (Phase B will enforce it): every figure the AI emits
 * is a typed reference (`Fact.ref`) into this pack; the server resolves it; a
 * validator rejects any un-referenced number. A fact that is not present is
 * `absent` — the AI says so, it never estimates.
 *
 * Each fact carries one of three states (§15.2):
 *   - `value`  — present (render it; may be a real $0 → see `zero`)
 *   - `zero`   — genuinely zero (e.g. no debt) — a real fact
 *   - `absent` — not connected / not provided — refuse + One Clear Action, never "$0"
 *
 * …plus `asOf` + `stale` (§15.2 gap-fix) so the AI can qualify "as of <date>"
 * and refuse on stale-beyond-threshold rather than present a stale number as
 * current.
 *
 * SSOT note: `ref` uses the same snapshot-path convention the CFO advisor
 * already resolves (`lib/cfo/aiAdvisor.ts:resolveSnapshotPath`); Phase B
 * generalises that one resolver — this module does not add a second one.
 */
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { CATEGORY_HIERARCHY, ALL_CATEGORIES } from '@/lib/tie/types';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';

export type FactState = 'value' | 'zero' | 'absent';
export type FactSource = 'user' | 'app' | 'derived';
export type FactUnit = 'AUD' | 'percent' | 'months' | 'days' | 'ratio' | 'count' | 'flag';

/** One grounded fact. The AI references it by `ref`; the server resolves it. */
export interface Fact {
  /** Stable identifier, e.g. "cashflow.monthlyCashflow". */
  key: string;
  /** Human label for prompt context, e.g. "Monthly cash flow". */
  label: string;
  state: FactState;
  /** Numeric value (null when `absent`). */
  value: number | null;
  unit: FactUnit;
  /** Dot-path the server resolves (snapshot-path convention for user/derived). */
  ref: string;
  source: FactSource;
  /** ISO timestamp the underlying value was computed (null for static app facts). */
  asOf: string | null;
  /** True when the snapshot flagged the data as stale (user/derived only). */
  stale: boolean;
}

/**
 * A Phase 41E reform measure surfaced with its commencement status, so the AI
 * never presents an un-assented reform as current law (CLAUDE.md §12.14).
 * `commenced` mirrors the canonical `*CommencementVerified` flag on the
 * TaxYearConfig — false until Royal Assent is verified in the engine config.
 */
export interface TaxReformMeasure {
  measure: string;
  commenced: boolean;
  status: 'in-effect' | 'announced-not-in-effect';
}

/**
 * The current-FY Australian tax law, AI-readable, sourced ENTIRELY from the
 * canonical `getTaxYearConfig()` SSOT (lib/tax-engine/config/taxYearConfig.ts) —
 * never re-typed (§12.2.1). The grounding layer hands this to the agent so any
 * tax-rule statement (brackets, thresholds, caps, CGT, reform status) is grounded
 * on real law, not the model's training memory.
 */
export interface TaxRulesReference {
  financialYear: string;
  authority: string;
  residentIncomeTaxBrackets: Array<{ min: number; max: number | null; rate: number }>;
  taxFreeThreshold: number;
  medicareLevyRate: number;
  medicareLevyThresholdSingle: number;
  lowIncomeTaxOffsetMax: number;
  superGuaranteeRate: number;
  concessionalCap: number;
  nonConcessionalCap: number;
  division293Threshold: number;
  cgtDiscount: number;
  cgtDiscountMinMonths: number;
  transferBalanceCap: number;
  /** Phase 41E measures with commencement status — never present un-commenced as law. */
  reformMeasures: TaxReformMeasure[];
}

/** Map a canonical commencement flag → a status-tagged reform measure. */
function reformMeasure(measure: string, commenced: boolean): TaxReformMeasure {
  return { measure, commenced, status: commenced ? 'in-effect' : 'announced-not-in-effect' };
}

/**
 * Pure: TaxYearConfig → AI-readable tax-law reference. Every value is read
 * straight from the canonical config (no re-typed law). Reform measures carry
 * their commencement status from the engine's `*CommencementVerified` flags.
 */
export function buildTaxRulesReference(config: TaxYearConfig): TaxRulesReference {
  return {
    financialYear: config.financialYear,
    authority: 'ATO, via the canonical getTaxYearConfig() — lib/tax-engine/config/taxYearConfig.ts',
    residentIncomeTaxBrackets: config.brackets.map((b) => ({ min: b.min, max: b.max, rate: b.rate })),
    taxFreeThreshold: config.taxFreeThreshold,
    medicareLevyRate: config.medicareRate,
    medicareLevyThresholdSingle: config.medicareThresholds.single,
    lowIncomeTaxOffsetMax: config.lito.maxOffset,
    superGuaranteeRate: config.superGuaranteeRate,
    concessionalCap: config.concessionalCap,
    nonConcessionalCap: config.nonConcessionalCap,
    division293Threshold: config.division293Threshold,
    cgtDiscount: config.cgtDiscount,
    cgtDiscountMinMonths: config.cgtDiscountMonths,
    transferBalanceCap: config.transferBalanceCap,
    reformMeasures: [
      reformMeasure('Negative gearing limited to new builds only', config.negativeGearingReformCommencementVerified),
      reformMeasure('CGT 50% discount replaced by indexation + 30% minimum rate', config.cgtIndexationCommencementVerified),
      reformMeasure('30% minimum tax on discretionary trust distributions', config.trustMinTaxCommencementVerified),
      reformMeasure('Expanded foreign-resident CGT', config.foreignResidentCgtCommencementVerified),
      reformMeasure('Company loss carry-back refundability', config.lossCarryBackCommencementVerified),
      reformMeasure('EV FBT phase-2 transition', config.evFbtPhase2CommencementVerified),
      reformMeasure('Dynamic (monthly opt-in) PAYG instalments', config.dynamicPaygCommencementVerified),
      reformMeasure('Division 296 — extra 15% tax on super balances over $3M', config.div296CommencementVerified),
    ],
  };
}

/** Which slices to assemble — keep the pack minimal per surface (storage/cost). */
export type FactScope =
  | 'netWorth'
  | 'cashflow'
  | 'debt'
  | 'emergencyFund'
  | 'tax'
  | 'app';

export const ALL_FACT_SCOPES: FactScope[] = [
  'netWorth',
  'cashflow',
  'debt',
  'emergencyFund',
  'tax',
  'app',
];

export interface FactPack {
  userId: string;
  /** ISO timestamp the pack was assembled. */
  assembledAt: string;
  /** ISO timestamp of the underlying snapshot (the freshness anchor). */
  snapshotAsOf: string | null;
  anyStale: boolean;
  scopes: FactScope[];
  facts: Fact[];
  /** App reference data the AI may ground category/tax claims on. */
  reference: {
    taxYear: string;
    categoryGroups: string[];
    validCategories: string[];
    /** Current-FY AU tax law (brackets, thresholds, caps, CGT, reform status). */
    taxRules: TaxRulesReference;
  };
}

// ── state helper ───────────────────────────────────────────────────────────

/**
 * Decide a fact's state. `presence` distinguishes "not connected" from a real
 * zero: for count-gated slices (debt/property), pass the record count — count 0
 * → `absent`; otherwise a 0 value is a genuine `zero`.
 */
function stateFor(value: number | null | undefined, presence?: number): FactState {
  if (presence !== undefined && presence <= 0) return 'absent';
  if (value === null || value === undefined || !Number.isFinite(value)) return 'absent';
  return value === 0 ? 'zero' : 'value';
}

function userFact(
  key: string,
  label: string,
  value: number | null | undefined,
  unit: FactUnit,
  ref: string,
  asOf: string | null,
  stale: boolean,
  source: FactSource = 'user',
  presence?: number,
): Fact {
  const state = stateFor(value, presence);
  return {
    key,
    label,
    state,
    value: state === 'absent' ? null : (value as number),
    unit,
    ref,
    source,
    asOf,
    stale,
  };
}

// ── pure assembler (the testable core) ──────────────────────────────────────

/**
 * Pure: snapshot + scope → FactPack. No I/O. The unit-testable core.
 */
export function assembleFactPack(
  snapshot: MasterFinancialSnapshot,
  opts?: { scopes?: FactScope[] },
): FactPack {
  const scopes = opts?.scopes ?? ALL_FACT_SCOPES;
  const want = (s: FactScope) => scopes.includes(s);

  const asOf = snapshot.calculatedAt instanceof Date
    ? snapshot.calculatedAt.toISOString()
    : new Date(snapshot.calculatedAt as unknown as string).toISOString();
  const stale = !!snapshot.staleness?.anyStale;
  const qm = snapshot.quickMetrics;
  const counts = snapshot.counts;

  const facts: Fact[] = [];

  if (want('netWorth')) {
    facts.push(
      userFact('netWorth.totalAssets', 'Total assets', qm.totalAssets, 'AUD', 'quickMetrics.totalAssets', asOf, stale),
      userFact('netWorth.totalLiabilities', 'Total liabilities', qm.totalLiabilities, 'AUD', 'quickMetrics.totalLiabilities', asOf, stale),
      userFact('netWorth.netWorth', 'Net worth', qm.netWorthValue, 'AUD', 'quickMetrics.netWorthValue', asOf, stale),
    );
  }

  if (want('cashflow')) {
    facts.push(
      userFact('cashflow.monthlyIncome', 'Monthly net income', qm.monthlyIncome, 'AUD', 'quickMetrics.monthlyIncome', asOf, stale),
      userFact('cashflow.monthlyExpenses', 'Monthly expenses', qm.monthlyExpenses, 'AUD', 'quickMetrics.monthlyExpenses', asOf, stale),
      userFact('cashflow.monthlyCashflow', 'Monthly cash flow', qm.monthlyCashflow, 'AUD', 'quickMetrics.monthlyCashflow', asOf, stale),
      userFact('cashflow.savingsRate', 'Savings rate', qm.savingsRate, 'percent', 'quickMetrics.savingsRate', asOf, stale),
      // Actuals (the §19.1 truth when transactions exist). When no actual data,
      // the value is absent — the AI must not present declared figures as actual.
      userFact('cashflow.actualNetCashflow', 'Actual net cash flow (this month)', qm.actualNetCashflow, 'AUD', 'quickMetrics.actualNetCashflow', asOf, stale, 'derived', qm.hasActualData ? 1 : 0),
      {
        key: 'cashflow.hasActualData',
        label: 'Transaction-based actuals available',
        state: 'value',
        value: qm.hasActualData ? 1 : 0,
        unit: 'flag',
        ref: 'quickMetrics.hasActualData',
        source: 'derived',
        asOf,
        stale,
      },
    );
  }

  if (want('debt')) {
    // Count-gated: no loans → absent ("not connected"), never "$0".
    facts.push(
      userFact('debt.totalLiabilities', 'Total debt', qm.totalLiabilities, 'AUD', 'quickMetrics.totalLiabilities', asOf, stale, 'user', counts.loans),
      userFact('debt.monthlyRepayments', 'Monthly loan repayments', qm.monthlyLoanRepayments, 'AUD', 'quickMetrics.monthlyLoanRepayments', asOf, stale, 'user', counts.loans),
    );
  }

  if (want('emergencyFund')) {
    const ef = snapshot.emergencyFund;
    facts.push(
      userFact('emergencyFund.liquidCash', 'Liquid cash', ef?.liquidCash, 'AUD', 'emergencyFund.liquidCash', asOf, stale),
      userFact('emergencyFund.monthsCovered', 'Months of expenses covered', ef?.monthsCovered, 'months', 'emergencyFund.monthsCovered', asOf, stale, 'derived'),
      userFact('emergencyFund.targetMonths', 'Target months', ef?.targetMonths, 'months', 'emergencyFund.targetMonths', asOf, stale, 'app'),
      userFact('emergencyFund.gap', 'Emergency-fund gap', ef?.gap, 'AUD', 'emergencyFund.gap', asOf, stale, 'derived'),
    );
  }

  if (want('tax')) {
    const tax = snapshot.tax;
    facts.push(
      userFact('tax.taxableIncome', 'Estimated taxable income', tax?.estimatedTaxableIncome, 'AUD', 'tax.estimatedTaxableIncome', asOf, stale, 'derived'),
      userFact('tax.taxPayable', 'Estimated tax payable', tax?.estimatedTaxPayable, 'AUD', 'tax.estimatedTaxPayable', asOf, stale, 'derived'),
      userFact('tax.marginalRate', 'Marginal tax rate', tax?.marginalTaxRate, 'percent', 'tax.marginalTaxRate', asOf, stale, 'derived'),
      userFact('tax.effectiveRate', 'Effective tax rate', tax?.effectiveTaxRate, 'percent', 'tax.effectiveTaxRate', asOf, stale, 'derived'),
    );
  }

  // App reference data — the second dataset (Reza R1). Static, not user-scoped,
  // so it carries no asOf/stale and is never an invented number.
  const taxConfig = getCurrentTaxYearConfig();
  // ALL_CATEGORIES is { level1, level2 }[] — flatten to unambiguous
  // "Group > Category" path strings for the AI to ground category claims on.
  const validCategories = ALL_CATEGORIES.map((c) => `${c.level1} > ${c.level2}`);
  // The current-FY tax law, sourced from the canonical engine config (§12.2.1).
  const taxRules = buildTaxRulesReference(taxConfig);
  const reference = {
    taxYear: taxConfig.financialYear,
    categoryGroups: Object.keys(CATEGORY_HIERARCHY),
    validCategories,
    taxRules,
  };
  if (want('app')) {
    facts.push(
      {
        key: 'app.taxYear',
        label: 'Current Australian financial year',
        state: 'value',
        value: null,
        unit: 'flag',
        ref: 'reference.taxYear',
        source: 'app',
        asOf: null,
        stale: false,
      },
      {
        key: 'app.categoryCount',
        label: 'Number of valid spending categories',
        state: 'value',
        value: ALL_CATEGORIES.length,
        unit: 'count',
        ref: 'reference.validCategories',
        source: 'app',
        asOf: null,
        stale: false,
      },
    );
  }

  // The most-cited single-number tax rules as resolvable `app` facts — so the
  // grounding validator can verify them like any other ref (the brackets array
  // + reform measures live on `reference.taxRules`, which the clause surfaces).
  // Included whenever tax or app context is requested.
  if (want('tax') || want('app')) {
    const appRule = (key: string, label: string, value: number, unit: FactUnit, ref: string): Fact => ({
      key, label, state: 'value', value, unit, ref, source: 'app', asOf: null, stale: false,
    });
    facts.push(
      appRule('taxRule.taxFreeThreshold', 'Tax-free threshold', taxRules.taxFreeThreshold, 'AUD', 'reference.taxRules.taxFreeThreshold'),
      appRule('taxRule.medicareLevyRate', 'Medicare levy rate', taxRules.medicareLevyRate * 100, 'percent', 'reference.taxRules.medicareLevyRate'),
      appRule('taxRule.superGuaranteeRate', 'Super Guarantee rate', taxRules.superGuaranteeRate * 100, 'percent', 'reference.taxRules.superGuaranteeRate'),
      appRule('taxRule.concessionalCap', 'Concessional super cap', taxRules.concessionalCap, 'AUD', 'reference.taxRules.concessionalCap'),
      appRule('taxRule.nonConcessionalCap', 'Non-concessional super cap', taxRules.nonConcessionalCap, 'AUD', 'reference.taxRules.nonConcessionalCap'),
      appRule('taxRule.division293Threshold', 'Division 293 threshold', taxRules.division293Threshold, 'AUD', 'reference.taxRules.division293Threshold'),
      appRule('taxRule.cgtDiscount', 'CGT discount', taxRules.cgtDiscount * 100, 'percent', 'reference.taxRules.cgtDiscount'),
    );
  }

  return {
    userId: snapshot.userId,
    assembledAt: asOf, // stamped from the snapshot (no Date.now — deterministic/testable)
    snapshotAsOf: asOf,
    anyStale: stale,
    scopes,
    facts,
    reference,
  };
}

// ── I/O wrapper ──────────────────────────────────────────────────────────────

/**
 * Fetch the canonical snapshot for a user and assemble the FactPack. Thin —
 * all logic is in the pure {@link assembleFactPack}. Persists nothing.
 */
export async function assembleFactPackForUser(
  userId: string,
  opts?: { scopes?: FactScope[] },
): Promise<FactPack> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return assembleFactPack(snapshot, opts);
}
