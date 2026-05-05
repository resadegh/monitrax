/**
 * Phase 41e.16 — GST / BAS calculator.
 *
 * Per *A New Tax System (Goods and Services Tax) Act 1999* (the
 * "GST Act"). 10% GST applies to most supplies of goods and services
 * by registered entities, with three structural exceptions:
 *
 *   - **GST-free** (s38) — basic food, health, education, exports,
 *     childcare. Supplier doesn't charge GST + can still claim
 *     input tax credits.
 *   - **Input-taxed** (s40) — residential rent, financial supplies,
 *     precious metals. Supplier doesn't charge GST + CANNOT claim
 *     input tax credits on related acquisitions.
 *   - **Out-of-scope** — not a supply for consideration / supplied
 *     by an unregistered entity below the $75k threshold.
 *
 * Reverse charge (s84) — for some imports + offshore supplies of
 * intangibles, the recipient (not the supplier) accounts for GST.
 *
 * BAS labels (per ATO BAS quarterly form):
 *   - **G1** — Total sales (incl. GST)
 *   - **G2** — Export sales (GST-free)
 *   - **G3** — Other GST-free sales
 *   - **G10** — Capital purchases (incl. GST)
 *   - **G11** — Non-capital purchases (incl. GST)
 *   - **1A** — GST on sales (output tax)
 *   - **1B** — GST on purchases (input tax credits)
 *
 * v1 covers: GST/GST-free/input-taxed classification + GST collected
 * + GST credits + net GST (1A-1B) + BAS label aggregation. Out of
 * scope for v1: GST grouping (Div 48), GST instalments (Div 162),
 * margin scheme (Div 75), going-concern exemption (s38-325).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

export const GST_RATE = 0.1; // 10% per s9-70 GST Act

export const GST_REGISTRATION_THRESHOLD = 75_000; // s23-15

export type GstClassification =
  | 'TAXABLE' // standard 10% applies
  | 'GST_FREE' // s38 — no GST charged, ITC available
  | 'INPUT_TAXED' // s40 — no GST charged, NO ITC
  | 'OUT_OF_SCOPE'; // not a taxable supply

export type SupplyType = 'SALE' | 'CAPITAL_PURCHASE' | 'NON_CAPITAL_PURCHASE';

export interface GstTransaction {
  /** Caller's stable id. */
  transactionId: string;
  supplyType: SupplyType;
  classification: GstClassification;
  /**
   * Amount EXCLUDING GST. Caller normalises before passing — e.g.
   * an invoice for $110 (incl. GST) is passed as $100 + classification
   * TAXABLE; the calc adds the $10 GST.
   */
  amountExcludingGst: number;
  /**
   * `true` if this is a reverse-charge supply (recipient accounts for
   * GST per Div 84). Only meaningful for purchases.
   */
  isReverseCharge?: boolean;
  /**
   * `true` if GST-free export under s38-185. Drives BAS G2 vs G3.
   */
  isExport?: boolean;
}

export interface GstInput {
  transactions: GstTransaction[];
  /** Annual turnover — checked against $75k registration threshold. */
  annualTurnover: number;
  /** `true` if the entity is GST-registered. */
  isRegistered: boolean;
}

export interface GstResult {
  /** Sum of GST collected on sales (BAS 1A). */
  gstCollected: number;
  /** Sum of input tax credits claimable (BAS 1B). */
  gstCreditsClaimable: number;
  /** Net GST payable to ATO (positive) or refundable (negative). */
  netGst: number;
  /** BAS label aggregation. */
  basLabels: {
    G1: number; // total sales incl GST
    G2: number; // export sales (GST-free)
    G3: number; // other GST-free sales
    G10: number; // capital purchases incl GST
    G11: number; // non-capital purchases incl GST
    label_1A: number; // GST on sales
    label_1B: number; // GST on purchases (ITCs)
  };
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Calculate GST + BAS labels from a list of transactions.
 */
export function calculateGst(input: GstInput): GstResult {
  const { transactions, annualTurnover, isRegistered } = input;

  const citations: AuthorityCitation[] = [
    { kind: 'ITAA_1997', reference: 'A New Tax System (GST) Act 1999 s9-70 (10% rate)', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 'GST Act s38 (GST-free supplies)', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 'GST Act s40 (input-taxed supplies)', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 'GST Act s23-15 ($75k registration threshold)', lastReviewed: '2026-05-05' },
  ];
  const uncomputed: UncomputedFlag[] = [];

  let gstCollected = 0;
  let gstCreditsClaimable = 0;
  let G1 = 0; // sales incl GST
  let G2 = 0; // export sales
  let G3 = 0; // other GST-free sales
  let G10 = 0; // capital purchases incl GST
  let G11 = 0; // non-capital purchases incl GST

  for (const tx of transactions) {
    const gstAmount =
      tx.classification === 'TAXABLE'
        ? tx.amountExcludingGst * GST_RATE
        : 0;
    const inclGst = tx.amountExcludingGst + gstAmount;

    if (tx.supplyType === 'SALE') {
      // Output side.
      if (tx.classification === 'TAXABLE') {
        gstCollected += gstAmount;
        G1 += inclGst;
      } else if (tx.classification === 'GST_FREE') {
        if (tx.isExport) {
          G2 += tx.amountExcludingGst;
        } else {
          G3 += tx.amountExcludingGst;
        }
        G1 += tx.amountExcludingGst; // G1 includes GST-free sales
      } else if (tx.classification === 'INPUT_TAXED') {
        // Input-taxed supplies don't add GST to G1 or to gstCollected.
        // (G1 traditionally excludes input-taxed; v1 follows that.)
      }
    } else {
      // Purchase side.
      const isCapital = tx.supplyType === 'CAPITAL_PURCHASE';
      if (tx.isReverseCharge) {
        // Reverse charge: recipient self-assesses GST. ITC offsets so
        // net is typically zero, but we still report it.
        const reverseGst = tx.amountExcludingGst * GST_RATE;
        gstCollected += reverseGst;
        gstCreditsClaimable += reverseGst;
        if (isCapital) G10 += tx.amountExcludingGst + reverseGst;
        else G11 += tx.amountExcludingGst + reverseGst;
      } else if (tx.classification === 'TAXABLE') {
        // ITC claimable on the GST component.
        gstCreditsClaimable += gstAmount;
        if (isCapital) G10 += inclGst;
        else G11 += inclGst;
      } else if (tx.classification === 'INPUT_TAXED') {
        // No ITC — the cost flows through but no GST claim.
        uncomputed.push({
          id: 'UC-GST-INPUT-TAXED-DENIAL',
          rationale: `Input-taxed acquisition (${tx.transactionId}) — no input tax credit available per s40 GST Act. Common scenario: acquisitions made for residential rental or financial supply businesses.`,
        });
      }
    }
  }

  const netGst = gstCollected - gstCreditsClaimable;

  // Surface registration-threshold check.
  if (!isRegistered && annualTurnover >= GST_REGISTRATION_THRESHOLD) {
    uncomputed.push({
      id: 'UC-GST-REGISTRATION-REQUIRED',
      rationale: `Annual turnover of $${annualTurnover.toLocaleString()} meets or exceeds the $75,000 registration threshold (s23-15 GST Act), but the entity is NOT registered. Registration is mandatory — engage a registered tax agent.`,
    });
  }

  // GST grouping (Div 48), instalments (Div 162), margin scheme (Div 75)
  // and going-concern (s38-325) are out of v1 scope.
  uncomputed.push({
    id: 'UC-GST-ADVANCED-DIVISIONS',
    rationale:
      'Advanced GST divisions NOT computed in v1: Div 48 (GST grouping), Div 162 (GST instalments / annual reporting), Div 75 (margin scheme on real property), s38-325 (going-concern exemption), Div 142 (excess GST). Engage a registered tax agent for these scenarios.',
  });

  return {
    gstCollected,
    gstCreditsClaimable,
    netGst,
    basLabels: {
      G1,
      G2,
      G3,
      G10,
      G11,
      label_1A: gstCollected,
      label_1B: gstCreditsClaimable,
    },
    citations,
    uncomputed,
  };
}
