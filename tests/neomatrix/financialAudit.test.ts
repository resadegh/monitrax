/**
 * Neomatrix A1 — EXECUTABLE, LAW-REFERENCED AUDIT (Phase 53 §14 A1).
 *
 * This is the step that makes the Neomatrix a *referee* over the code, not a
 * mirror of it. For each audited engine we:
 *   1. state the governing law / formula (the authority — NOT the code),
 *   2. hand-derive the expected output FROM that law (CLAUDE.md §19.2 step 3),
 *   3. run the REAL engine and assert its output equals the law-derived value.
 *
 * A passing case is a *law-anchored lock*: if the engine ever drifts from the
 * law, this fails. A genuine mismatch is a `suspected-issue` — it is NOT
 * committed as a failing assertion; it is raised with Reza with the law
 * citation + wrong-vs-right numbers, and the engine is left unchanged
 * (CLAUDE.md §10/§19 — documentation/model only, never silently fix).
 *
 * Every audited node id must exist in financial-graph.json — the audit is tied
 * to the model. Documentation/model + test only; no financial logic changed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateNetWorth } from '@/lib/calculations/netWorthCalculator';
import { resolveCanonicalCashflow } from '@/lib/calculations/canonicalCashflow';
import { calculateIncomeTax } from '@/lib/tax-engine/core/incomeTaxCalculator';
import { calculateMedicareLevy } from '@/lib/tax-engine/core/medicareLevyCalculator';
import { calculateGst } from '@/lib/tax-engine/gst/gstCalculator';
import { calculateHighIncomeSuperTax } from '@/lib/tax-engine/super/highIncomeSuperTax';
import { calculateSuperGuarantee } from '@/lib/tax-engine/super/contributionCalculator';
import { calculateCgtDiscount } from '@/lib/tax-engine/divisions/cgtDiscount';
import { calculateSmsfIncomeTax } from '@/lib/tax-engine/super/smsfIncomeTax';
import { calculateAggregateScore } from '@/lib/health/aggregateEngine';
import { scoreToRiskBand } from '@/lib/health/types';
import { calculateOverallScoreDecimal } from '@/lib/cfo/scoreCalculator';
import { Decimal } from '@/lib/decimal';
import { TAX_YEAR_2024_25 } from '@/lib/tax-engine/config/taxYearConfig';

const cfoComponents = (cf: number, debt: number, emerg: number, div: number, spend: number, save: number) =>
  ({
    cashflowStrength: new Decimal(cf),
    debtCoverage: new Decimal(debt),
    emergencyBuffer: new Decimal(emerg),
    investmentDiversification: new Decimal(div),
    spendingControl: new Decimal(spend),
    savingsRate: new Decimal(save),
  }) as never;

const graph = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/financial-logic/graph/financial-graph.json'), 'utf8'),
);
const nodeIds = new Set(graph.nodes.map((n: { id: string }) => n.id));

/** One law-referenced audit case. `expected` is derived from `law`, not the code. */
interface AuditCase {
  node: string; // must exist in the Neomatrix graph
  law: string; // the governing authority (external to the code)
  derivation: string; // how `expected` was hand-computed from `law`
  actual: () => number; // runs the REAL engine
  expected: number;
}

const CASES: AuditCase[] = [
  // ── Net worth — the accounting identity (assets − liabilities) ──────────────
  {
    node: 'engine.netWorthCalculator.calculateNetWorth',
    law: 'Accounting identity: net worth = Σ assets − Σ liabilities',
    derivation: 'property 800,000 + cash 20,000 + (100 units × $50 = 5,000) − loan 600,000 = 225,000',
    actual: () =>
      calculateNetWorth(
        [{ currentValue: 800000 }],
        [{ currentBalance: 20000 }],
        [{ units: 100, currentPrice: 50 }],
        [{ principal: 600000 }],
      ).netWorth,
    expected: 225000,
  },
  {
    node: 'engine.netWorthCalculator.calculateNetWorth',
    law: 'Investment market value = units × (currentPrice ?? averagePrice); falls back to average price when no current price',
    derivation: '200 units × averagePrice $25 (no currentPrice) = 5,000; no liabilities → net worth 5,000',
    actual: () =>
      calculateNetWorth([], [], [{ units: 200, averagePrice: 25 }], []).netWorth,
    expected: 5000,
  },
  {
    node: 'engine.netWorthCalculator.calculateNetWorth',
    law: 'Phase 39.5 rule: super counted UNLESS fundType === "SMSF" (SMSF wealth flows through the SMSF entity\'s owned assets — counting both double-counts)',
    derivation: 'INDUSTRY super 100,000 counted; SMSF super 100,000 excluded → net worth 100,000',
    actual: () =>
      calculateNetWorth(
        [],
        [],
        [],
        [],
        [
          { balance: 100000, fundType: 'INDUSTRY' },
          { balance: 100000, fundType: 'SMSF' },
        ],
      ).netWorth,
    expected: 100000,
  },

  // ── Canonical cashflow — the actuals-vs-declared SSOT (CLAUDE.md §19.1) ──────
  {
    node: 'engine.canonicalCashflow.resolveCanonicalCashflow',
    law: 'CLAUDE.md §19.1: actuals win when present. savingsRate = net / inflow × 100',
    derivation: 'hasActualData=true → net 4,000; savingsRate = 4,000 / 10,000 × 100 = 40',
    actual: () =>
      resolveCanonicalCashflow(
        { hasActualData: true, inflow: 10000, outflow: 6000, net: 4000, avgOutflow: 5500 },
        { inflow: 8000, outflow: 5000, net: 3000 },
      ).savingsRate,
    expected: 40,
  },
  {
    node: 'engine.canonicalCashflow.resolveCanonicalCashflow',
    law: 'CLAUDE.md §19.1: declared is the fallback ONLY when no actual data. savingsRate = net / inflow × 100',
    derivation: 'hasActualData=false → declared net 3,000; savingsRate = 3,000 / 8,000 × 100 = 37.5',
    actual: () =>
      resolveCanonicalCashflow(
        { hasActualData: false, inflow: 0, outflow: 0, net: 0, avgOutflow: 0 },
        { inflow: 8000, outflow: 5000, net: 3000 },
      ).savingsRate,
    expected: 37.5,
  },
  {
    node: 'engine.canonicalCashflow.resolveCanonicalCashflow',
    law: 'savingsRate is 0 when there is no inflow (no divide-by-zero)',
    derivation: 'declared inflow 0 → savingsRate 0',
    actual: () =>
      resolveCanonicalCashflow(
        { hasActualData: false, inflow: 0, outflow: 0, net: 0, avgOutflow: 0 },
        { inflow: 0, outflow: 500, net: -500 },
      ).savingsRate,
    expected: 0,
  },

  // ── Income tax — ATO FY24-25 Stage 3 marginal brackets (the LAW) ────────────
  // ATO published brackets: 0% ≤18,200 · 16% 18,201–45,000 · 30% 45,001–135,000
  // (base 4,288) · 37% 135,001–190,000 (base 31,288) · 45% 190,001+ (base 51,638).
  {
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25: tax-free threshold $18,200',
    derivation: 'taxable income $18,200 → $0',
    actual: () => calculateIncomeTax(18200, TAX_YEAR_2024_25).taxPayable,
    expected: 0,
  },
  {
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25: 16% on 18,201–45,000',
    derivation: '16% × (45,000 − 18,200) = 0.16 × 26,800 = 4,288',
    actual: () => calculateIncomeTax(45000, TAX_YEAR_2024_25).taxPayable,
    expected: 4288,
  },
  {
    // The P0 bug regression-lock: income exactly AT a bracket minimum used to
    // return $0 (broke out of the loop). Must now tax in the new bracket.
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25 bracket boundary $45,001 (base 4,288 + 30%): must NOT be $0',
    derivation: '4,288 + 30% × (45,001 − 45,000) = 4,288 + 0.30 = 4,288.30',
    actual: () => calculateIncomeTax(45001, TAX_YEAR_2024_25).taxPayable,
    expected: 4288.3,
  },
  {
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25: $100,000 in the 30% bracket (base 4,288)',
    derivation: '4,288 + 30% × (100,000 − 45,000) = 4,288 + 16,500 = 20,788',
    actual: () => calculateIncomeTax(100000, TAX_YEAR_2024_25).taxPayable,
    expected: 20788,
  },
  {
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25 bracket boundary $135,001 (base 31,288 + 37%): must NOT be $0',
    derivation: '31,288 + 37% × (135,001 − 135,000) = 31,288 + 0.37 = 31,288.37',
    actual: () => calculateIncomeTax(135001, TAX_YEAR_2024_25).taxPayable,
    expected: 31288.37,
  },
  {
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25: $190,000 (top of the 37% bracket, base 31,288)',
    derivation: '31,288 + 37% × (190,000 − 135,000) = 31,288 + 20,350 = 51,638',
    actual: () => calculateIncomeTax(190000, TAX_YEAR_2024_25).taxPayable,
    expected: 51638,
  },
  {
    node: 'engine.incomeTaxCalculator.calculateIncomeTax',
    law: 'ATO FY24-25: $200,000 in the 45% bracket (base 51,638)',
    derivation: '51,638 + 45% × (200,000 − 190,000) = 51,638 + 4,500 = 56,138',
    actual: () => calculateIncomeTax(200000, TAX_YEAR_2024_25).taxPayable,
    expected: 56138,
  },

  // ── Medicare levy — Medicare Levy Act (2% above the shade-out) ───────────────
  {
    node: 'engine.medicareLevyCalculator.calculateMedicareLevy',
    law: 'Medicare Levy 2% of taxable income above the shade-out (single)',
    derivation: '$100,000 is above the shade-out → 2% × 100,000 = 2,000',
    actual: () => calculateMedicareLevy({ taxableIncome: 100000 }, TAX_YEAR_2024_25).total,
    expected: 2000,
  },

  // ── GST — A New Tax System (GST) Act 1999, s9-70 (10%) ───────────────────────
  {
    node: 'engine.gstCalculator.calculateGst',
    law: 'GST Act s9-70: 10% on a taxable supply',
    derivation: '$1,000 taxable sale → 10% = $100 GST collected; no purchases → net GST $100',
    actual: () =>
      calculateGst({
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 1000 },
        ],
        annualTurnover: 1000,
        isRegistered: true,
      }).netGst,
    expected: 100,
  },
  {
    node: 'engine.gstCalculator.calculateGst',
    law: 'Net GST = GST collected on sales − input tax credits on purchases',
    derivation: 'sale $1,000 (GST $100) − purchase $500 (ITC $50) = net $50',
    actual: () =>
      calculateGst({
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 1000 },
          { transactionId: 'p1', supplyType: 'NON_CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 500 },
        ],
        annualTurnover: 1000,
        isRegistered: true,
      }).netGst,
    expected: 50,
  },
  {
    node: 'engine.gstCalculator.calculateGst',
    law: 'GST Act s38: a GST-free supply charges no GST',
    derivation: '$1,000 GST-free sale → $0 GST collected',
    actual: () =>
      calculateGst({
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'GST_FREE', amountExcludingGst: 1000 },
        ],
        annualTurnover: 1000,
        isRegistered: true,
      }).gstCollected,
    expected: 0,
  },

  // ── Div 293 — extra 15% super tax (ITAA 1997 Div 293, s293-15) ───────────────
  {
    node: 'engine.highIncomeSuperTax.calculateHighIncomeSuperTax',
    law: 's293-15: 15% × lesser of (Div293 income − $250k threshold) and concessional contributions',
    derivation: 'income $300k → excess $50k; min($50k, concessional $30k) = $30k; 15% × $30k = $4,500',
    actual: () =>
      calculateHighIncomeSuperTax(
        { div293Income: 300000, concessionalContributions: 30000, totalSuperBalance: 0 },
        TAX_YEAR_2024_25,
      ).div293.tax,
    expected: 4500,
  },
  {
    node: 'engine.highIncomeSuperTax.calculateHighIncomeSuperTax',
    law: 's293-15: the lesser-of rule caps on the excess income when it is the smaller',
    derivation: 'income $260k → excess $10k; min($10k, concessional $25k) = $10k; 15% × $10k = $1,500',
    actual: () =>
      calculateHighIncomeSuperTax(
        { div293Income: 260000, concessionalContributions: 25000, totalSuperBalance: 0 },
        TAX_YEAR_2024_25,
      ).div293.tax,
    expected: 1500,
  },
  {
    node: 'engine.highIncomeSuperTax.calculateHighIncomeSuperTax',
    law: 's293-15: no Div 293 below the $250k threshold',
    derivation: 'income $200k < $250k → Div 293 does not apply → $0',
    actual: () =>
      calculateHighIncomeSuperTax(
        { div293Income: 200000, concessionalContributions: 25000, totalSuperBalance: 0 },
        TAX_YEAR_2024_25,
      ).div293.tax,
    expected: 0,
  },

  // ── Super guarantee — SGAA 1992 (11.5% FY24-25 on OTE, capped at max base) ───
  {
    node: 'engine.contributionCalculator.calculateSuperGuarantee',
    law: 'SGAA 1992: SG = SG rate (11.5% FY24-25) × OTE, capped at the max contribution base',
    derivation: '$100,000 OTE (below the ~$260k annual max base) × 11.5% = $11,500',
    actual: () => calculateSuperGuarantee(100000, TAX_YEAR_2024_25).amount,
    expected: 11500,
  },

  // ── CGT discount — Div 115 (pre-reform; no acquisitionContractDate = default) ─
  {
    node: 'engine.cgtDiscount.calculateCgtDiscount',
    law: 'ITAA 1997 s115-25: individual 50% discount when held ≥ 12 months',
    derivation: 'PERSONAL_NAME, 24 months, nominal gain $100,000 → 50% discount → taxable $50,000',
    actual: () =>
      calculateCgtDiscount({ entityType: 'PERSONAL_NAME', monthsHeld: 24, nominalGain: 100000 }).discountedGain,
    expected: 50000,
  },
  {
    node: 'engine.cgtDiscount.calculateCgtDiscount',
    law: 'ITAA 1997 s115-100: complying super fund 33⅓% discount',
    derivation: 'SMSF, 24 months, nominal gain $90,000 → 1/3 discount → taxable $60,000',
    actual: () =>
      calculateCgtDiscount({ entityType: 'SMSF', monthsHeld: 24, nominalGain: 90000, isComplying: true }).discountedGain,
    expected: 60000,
  },
  {
    node: 'engine.cgtDiscount.calculateCgtDiscount',
    law: 'ITAA 1997 s115-10: companies get NO CGT discount',
    derivation: 'COMPANY, 24 months, nominal gain $100,000 → 0% discount → taxable $100,000',
    actual: () =>
      calculateCgtDiscount({ entityType: 'COMPANY', monthsHeld: 24, nominalGain: 100000 }).discountedGain,
    expected: 100000,
  },
  {
    node: 'engine.cgtDiscount.calculateCgtDiscount',
    law: 'ITAA 1997 s115-25: NO discount when held < 12 months',
    derivation: 'PERSONAL_NAME, 6 months, nominal gain $100,000 → 0% discount → taxable $100,000',
    actual: () =>
      calculateCgtDiscount({ entityType: 'PERSONAL_NAME', monthsHeld: 6, nominalGain: 100000 }).discountedGain,
    expected: 100000,
  },

  // ── SMSF income tax — Div 295 (complying fund 15%; NALI at top rate s295-550) ─
  {
    node: 'engine.smsfIncomeTax.calculateSmsfIncomeTax',
    law: 'ITAA 1997 Div 295: assessable (concessional) contributions taxed at 15%',
    derivation: '$100,000 concessional contributions × 15% = $15,000',
    actual: () =>
      calculateSmsfIncomeTax(
        { assessableInvestmentIncome: 0, deductions: 0, assessableContributions: 100000, nonArmsLengthIncome: 0, isComplying: true, isInPensionPhase: false },
        TAX_YEAR_2024_25,
      ).contributionsTax,
    expected: 15000,
  },
  {
    node: 'engine.smsfIncomeTax.calculateSmsfIncomeTax',
    law: 'ITAA 1997 Div 295: a complying fund\'s investment income taxed at 15%',
    derivation: '$50,000 investment income (no deductions, not pension phase) × 15% = $7,500',
    actual: () =>
      calculateSmsfIncomeTax(
        { assessableInvestmentIncome: 50000, deductions: 0, assessableContributions: 0, nonArmsLengthIncome: 0, isComplying: true, isInPensionPhase: false },
        TAX_YEAR_2024_25,
      ).investmentIncomeTax,
    expected: 7500,
  },
  {
    node: 'engine.smsfIncomeTax.calculateSmsfIncomeTax',
    law: 'ITAA 1997 s295-550: non-arm\'s-length income (NALI) taxed at the top marginal rate (45%)',
    derivation: '$10,000 NALI × 45% = $4,500',
    actual: () =>
      calculateSmsfIncomeTax(
        { assessableInvestmentIncome: 0, deductions: 0, assessableContributions: 0, nonArmsLengthIncome: 10000, isComplying: true, isInPensionPhase: false },
        TAX_YEAR_2024_25,
      ).naliTax,
    expected: 4500,
  },

  // ── Health aggregate score — Monitrax methodology (weighted − penalty, clamp) ─
  {
    node: 'engine.aggregateEngine.calculateAggregateScore',
    law: 'Health methodology: score = round(clamp(0,100, Σ(catScore×catWeight) − totalPenalty))',
    derivation: '(80×0.5 + 60×0.5) − 0 = 70',
    actual: () =>
      calculateAggregateScore(
        [{ score: 80, weight: 0.5 }, { score: 60, weight: 0.5 }] as never,
        { totalPenalty: 0 } as never,
      ),
    expected: 70,
  },
  {
    node: 'engine.aggregateEngine.calculateAggregateScore',
    law: 'Penalty modifiers subtract from the weighted score',
    derivation: '(80×0.5 + 60×0.5) − 10 = 60',
    actual: () =>
      calculateAggregateScore(
        [{ score: 80, weight: 0.5 }, { score: 60, weight: 0.5 }] as never,
        { totalPenalty: 10 } as never,
      ),
    expected: 60,
  },
  {
    node: 'engine.aggregateEngine.calculateAggregateScore',
    law: 'Score is clamped to a 0-100 ceiling',
    derivation: '100×1.5 = 150 → clamp to 100',
    actual: () =>
      calculateAggregateScore([{ score: 100, weight: 1.5 }] as never, { totalPenalty: 0 } as never),
    expected: 100,
  },
  {
    node: 'engine.aggregateEngine.calculateAggregateScore',
    law: 'Score is clamped to a 0 floor',
    derivation: '(10×1) − 50 = −40 → clamp to 0',
    actual: () =>
      calculateAggregateScore([{ score: 10, weight: 1 }] as never, { totalPenalty: 50 } as never),
    expected: 0,
  },

  // ── CFO score — Monitrax 6-component weighting (.25/.20/.15/.15/.15/.10) ──────
  {
    node: 'engine.scoreCalculator.calculateOverallScoreDecimal',
    law: 'CFO methodology: overall = Σ(component × weight); weights sum to 1.0',
    derivation: 'all components 100 → 100 × (0.25+0.20+0.15+0.15+0.15+0.10) = 100',
    actual: () => calculateOverallScoreDecimal(cfoComponents(100, 100, 100, 100, 100, 100)).toNumber(),
    expected: 100,
  },
  {
    node: 'engine.scoreCalculator.calculateOverallScoreDecimal',
    law: 'CFO methodology: each component is weighted by its share',
    derivation: '80×.25 + 60×.20 + 40×.15 + 100×.15 + 50×.15 + 20×.10 = 20+12+6+15+7.5+2 = 62.5',
    actual: () => calculateOverallScoreDecimal(cfoComponents(80, 60, 40, 100, 50, 20)).toNumber(),
    expected: 62.5,
  },
  {
    node: 'engine.scoreCalculator.calculateOverallScoreDecimal',
    law: 'CFO methodology: all-zero components → 0',
    derivation: 'all 0 → 0',
    actual: () => calculateOverallScoreDecimal(cfoComponents(0, 0, 0, 0, 0, 0)).toNumber(),
    expected: 0,
  },
];

// Risk-band classifier returns a string, so it has its own boundary block.
describe('Neomatrix A1 — health risk-band boundaries (scoreToRiskBand)', () => {
  it('every audited node exists in the graph', () => {
    expect(nodeIds.has('engine.aggregateEngine.calculateAggregateScore')).toBe(true);
  });
  const cases: [number, string][] = [
    [80, 'EXCELLENT'], [79, 'GOOD'], [60, 'GOOD'], [59, 'MODERATE'],
    [40, 'MODERATE'], [39, 'CONCERNING'], [20, 'CONCERNING'], [19, 'CRITICAL'], [0, 'CRITICAL'],
  ];
  for (const [score, band] of cases) {
    it(`score ${score} → ${band} (Monitrax health band thresholds)`, () => {
      expect(scoreToRiskBand(score)).toBe(band);
    });
  }
});

describe('Neomatrix A1 — executable law-referenced audit (model refs the code)', () => {
  it('every audited node exists in financial-graph.json (audit tied to the model)', () => {
    const missing = CASES.map((c) => c.node).filter((id) => !nodeIds.has(id));
    expect(missing).toEqual([]);
  });

  for (const c of CASES) {
    it(`${c.node} matches the law: ${c.derivation}`, () => {
      // The engine's output MUST equal the value the LAW says it should be.
      // A mismatch here is a suspected-issue to raise with Reza — never a
      // licence to change the engine.
      expect(c.actual()).toBeCloseTo(c.expected, 2);
    });
  }
});
