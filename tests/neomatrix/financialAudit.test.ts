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
import { TAX_YEAR_2024_25 } from '@/lib/tax-engine/config/taxYearConfig';

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
];

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
