/**
 * Neobrain — agent rental-statement parser (Phase 59 §6 / Phase 54 perception).
 *
 * Parses an uploaded agent rental statement (PDF text) into the typed shape
 * the managed-rental reconciliation consumes (the Tier-1 ITEMISED path):
 *
 *   { grossRent, lineItems: [{ label, amount, category, capitalVsImmediate? }],
 *     netDisbursement, period }
 *
 * THE GROUNDING RULE (lib/neobrain/grounding.ts discipline): the parser NEVER
 * emits a figure that is not literally on the statement. Every monetary value
 * the AI extracts is validated against the source text
 * (`groundRentalStatementParse`) — an ungrounded figure rejects the parse
 * (refuse, never estimate). Arithmetic integrity is also enforced:
 * gross − Σ lineItems must equal the net disbursement (± rounding).
 *
 * Downstream: a grounded parse feeds `reconcileManagedRental` (the statement's
 * net is reconciled against the bank credit) and
 * `buildItemisedStatementExpenses` builds the one-off DERIVED (`STATEMENT`,
 * itemised) expense payloads — one row per line item, each with its own
 * category. Persistence stays with the single locked producer
 * (app/api/rental-reconciliation — R1 source-lock).
 *
 * Compliance (spec §10): `capitalVsImmediate` is surfaced as the STATEMENT's
 * hint only ('unknown' by default) — the parser never rules deductibility.
 */

import {
  isGeminiConfigured,
  generateGeminiJSONCompletion,
  GEMINI_MODELS,
  truncateToTokenLimit,
} from '@/lib/ai';

// =============================================================================
// Types
// =============================================================================

/** Categories a statement line item may map to (ExpenseCategory subset). */
export type RentalStatementLineCategory =
  | 'PROPERTY_MANAGEMENT' // management fee, letting fee, admin, advertising
  | 'MAINTENANCE' // repairs, gardening, cleaning arranged by the agent
  | 'RATES' // council rates, water rates paid on the owner's behalf
  | 'UTILITIES' // utilities paid on the owner's behalf
  | 'INSURANCE' // landlord insurance paid via the agent
  | 'STRATA' // strata/body-corporate levies
  | 'OTHER';

export interface RentalStatementLineItem {
  /** The statement's own wording, e.g. "Management fee 5.5%". */
  label: string;
  /** AUD, positive — the amount the agent deducted. */
  amount: number;
  category: RentalStatementLineCategory;
  /** The statement's hint only — never a deductibility ruling (spec §10). */
  capitalVsImmediate?: 'capital' | 'immediate' | 'unknown';
}

export interface RentalStatementPeriod {
  /** ISO dates when the statement names them, else null. */
  start: string | null;
  end: string | null;
  /** The statement's own period wording, e.g. "1–31 May 2026". */
  label: string | null;
}

export interface RentalStatementParse {
  /** Gross rent collected for the period (AUD). */
  grossRent: number;
  lineItems: RentalStatementLineItem[];
  /** Net amount disbursed to the owner (AUD). */
  netDisbursement: number;
  period: RentalStatementPeriod;
  /** The managing agent's name when stated. */
  agentName: string | null;
  /** The property address when stated. */
  propertyAddress: string | null;
}

export interface RentalStatementGrounding {
  ok: boolean;
  /** Figures that could NOT be found on the statement (must never render). */
  ungrounded: Array<{ field: string; value: number }>;
  /** |gross − Σ items − net|, when it exceeds the rounding tolerance. */
  arithmeticGapAbs: number | null;
}

// =============================================================================
// The extraction prompt (canonical text — the ONE place it lives)
// =============================================================================

export const RENTAL_STATEMENT_PROMPT = `This is an Australian property agent RENTAL STATEMENT (owner/landlord statement).
Extract EXACTLY what is printed — never estimate, never infer a number that is not on the page.

Required JSON shape:
{
  "grossRent": { "value": number, "confidence": number, "source": "ai" },
  "netDisbursement": { "value": number, "confidence": number, "source": "ai" },
  "periodStart": { "value": "YYYY-MM-DD" | null, "confidence": number, "source": "ai" },
  "periodEnd": { "value": "YYYY-MM-DD" | null, "confidence": number, "source": "ai" },
  "periodLabel": { "value": string | null, "confidence": number, "source": "ai" },
  "agentName": { "value": string | null, "confidence": number, "source": "ai" },
  "propertyAddress": { "value": string | null, "confidence": number, "source": "ai" },
  "lineItems": {
    "value": [
      { "label": string, "amount": number,
        "category": "PROPERTY_MANAGEMENT" | "MAINTENANCE" | "RATES" | "UTILITIES" | "INSURANCE" | "STRATA" | "OTHER",
        "capitalVsImmediate": "capital" | "immediate" | "unknown" }
    ],
    "confidence": number, "source": "ai"
  }
}

Rules:
- grossRent = the rent COLLECTED for the period (before any deduction).
- lineItems = every deduction the agent made (management fee, letting fee, repairs, water, council, strata, insurance, advertising). Amounts positive, exactly as printed.
- netDisbursement = the amount PAID TO THE OWNER, exactly as printed.
- category: management/letting/admin/advertising fees → PROPERTY_MANAGEMENT; repairs/gardening/cleaning → MAINTENANCE; council/water rates → RATES; utilities → UTILITIES; landlord insurance → INSURANCE; strata/body-corporate → STRATA; anything else → OTHER.
- capitalVsImmediate: "capital" ONLY when the statement itself describes a capital improvement (e.g. "new hot water system installation"); repairs/fees are "immediate"; when unclear use "unknown". This is a hint, not tax advice.
- If a value is not on the statement, use null with confidence 0 — NEVER invent it.`;

// =============================================================================
// Grounding validator (pure)
// =============================================================================

/**
 * True when the dollar amount literally appears in the statement text —
 * tolerant of formatting ($1,234.56 / 1234.56 / 1,234.56 / 1234). Cents-less
 * amounts also match their ".00" rendering and vice versa.
 */
export function amountAppearsInText(amount: number, text: string): boolean {
  if (!Number.isFinite(amount)) return false;
  const abs = Math.abs(amount);
  const cents = abs.toFixed(2); // "1234.56"
  const [whole, frac] = cents.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ','); // "1,234"
  const candidates = new Set<string>([
    cents, // 1234.56
    `${grouped}.${frac}`, // 1,234.56
  ]);
  if (frac === '00') {
    candidates.add(whole); // 1234
    candidates.add(grouped); // 1,234
  }
  // Normalise the text once: strip $ and spaces inside numbers.
  const haystack = text.replace(/\$\s*/g, '$');
  for (const c of candidates) {
    // Word-ish boundary so "234.56" doesn't match inside "1,234.56".
    const re = new RegExp(`(^|[^\\d.,])\\$?${c.replace(/[.,]/g, '\\$&')}(?![\\d])`);
    if (re.test(haystack)) return true;
  }
  return false;
}

/** Rounding tolerance for gross − Σ items − net (statements round to cents). */
export const STATEMENT_ARITHMETIC_TOLERANCE = 0.05;

/**
 * The anti-hallucination gate: every monetary figure must be ON the
 * statement, and the statement must reconcile internally
 * (gross − Σ lineItems = net, ± tolerance). Pure.
 */
export function groundRentalStatementParse(
  parse: RentalStatementParse,
  statementText: string,
): RentalStatementGrounding {
  const ungrounded: RentalStatementGrounding['ungrounded'] = [];

  if (!amountAppearsInText(parse.grossRent, statementText)) {
    ungrounded.push({ field: 'grossRent', value: parse.grossRent });
  }
  if (!amountAppearsInText(parse.netDisbursement, statementText)) {
    ungrounded.push({ field: 'netDisbursement', value: parse.netDisbursement });
  }
  parse.lineItems.forEach((item, i) => {
    if (!amountAppearsInText(item.amount, statementText)) {
      ungrounded.push({ field: `lineItems[${i}] ${item.label}`, value: item.amount });
    }
  });

  const itemsTotal = parse.lineItems.reduce((sum, i) => sum + i.amount, 0);
  const gapAbs = Math.abs(parse.grossRent - itemsTotal - parse.netDisbursement);
  const arithmeticOk = gapAbs <= STATEMENT_ARITHMETIC_TOLERANCE;

  return {
    ok: ungrounded.length === 0 && arithmeticOk && parse.grossRent > 0 && parse.netDisbursement > 0,
    ungrounded,
    arithmeticGapAbs: arithmeticOk ? null : gapAbs,
  };
}

// =============================================================================
// The parse orchestration (AI extraction → grounding → typed parse or refusal)
// =============================================================================

export interface RentalStatementParseResult {
  /** The grounded parse — null when extraction failed or grounding rejected. */
  parse: RentalStatementParse | null;
  grounding: RentalStatementGrounding | null;
  /** Why parse is null (surface to the user; never a silent drop). */
  refusalReason: string | null;
}

interface AiField<T> {
  value: T;
  confidence?: number;
}

interface AiRentalStatementShape {
  grossRent?: AiField<number>;
  netDisbursement?: AiField<number>;
  periodStart?: AiField<string | null>;
  periodEnd?: AiField<string | null>;
  periodLabel?: AiField<string | null>;
  agentName?: AiField<string | null>;
  propertyAddress?: AiField<string | null>;
  lineItems?: AiField<RentalStatementLineItem[]>;
}

const LINE_CATEGORIES: readonly RentalStatementLineCategory[] = [
  'PROPERTY_MANAGEMENT',
  'MAINTENANCE',
  'RATES',
  'UTILITIES',
  'INSURANCE',
  'STRATA',
  'OTHER',
];

/** Coerce the AI's draft into the typed parse (defensive — bad rows dropped). */
export function coerceRentalStatementDraft(
  raw: AiRentalStatementShape,
): RentalStatementParse | null {
  const gross = raw.grossRent?.value;
  const net = raw.netDisbursement?.value;
  if (typeof gross !== 'number' || typeof net !== 'number') return null;

  const items = Array.isArray(raw.lineItems?.value) ? raw.lineItems.value : [];
  const lineItems: RentalStatementLineItem[] = items
    .filter((i) => i && typeof i.label === 'string' && typeof i.amount === 'number' && i.amount > 0)
    .map((i) => ({
      label: i.label.trim(),
      amount: i.amount,
      category: LINE_CATEGORIES.includes(i.category) ? i.category : 'OTHER',
      capitalVsImmediate:
        i.capitalVsImmediate === 'capital' || i.capitalVsImmediate === 'immediate'
          ? i.capitalVsImmediate
          : 'unknown',
    }));

  return {
    grossRent: gross,
    netDisbursement: net,
    lineItems,
    period: {
      start: typeof raw.periodStart?.value === 'string' ? raw.periodStart.value : null,
      end: typeof raw.periodEnd?.value === 'string' ? raw.periodEnd.value : null,
      label: typeof raw.periodLabel?.value === 'string' ? raw.periodLabel.value : null,
    },
    agentName: typeof raw.agentName?.value === 'string' ? raw.agentName.value : null,
    propertyAddress:
      typeof raw.propertyAddress?.value === 'string' ? raw.propertyAddress.value : null,
  };
}

/**
 * Parse a rental statement's extracted text. Refuses (parse: null) when the
 * AI is unavailable, extraction fails, or grounding rejects — never a guessed
 * number (§19.2 / grounding contract).
 */
export async function parseRentalStatement(
  statementText: string,
): Promise<RentalStatementParseResult> {
  if (!isGeminiConfigured()) {
    return { parse: null, grounding: null, refusalReason: 'AI analysis unavailable' };
  }

  try {
    const result = await generateGeminiJSONCompletion<AiRentalStatementShape>({
      surface: 'document-intelligence',
      model: GEMINI_MODELS.DOCUMENT_ANALYSIS,
      systemPrompt:
        'You extract data from Australian property documents. You only report what is printed — never estimate.',
      userPrompt: `${RENTAL_STATEMENT_PROMPT}\n\nDocument text:\n${truncateToTokenLimit(statementText, 8000)}`,
      maxTokens: 2000,
      temperature: 0.2,
    });

    const draft = coerceRentalStatementDraft(result.data ?? {});
    if (!draft) {
      return {
        parse: null,
        grounding: null,
        refusalReason: 'The statement did not yield a gross rent and net disbursement',
      };
    }

    const grounding = groundRentalStatementParse(draft, statementText);
    if (!grounding.ok) {
      return {
        parse: null,
        grounding,
        refusalReason:
          grounding.ungrounded.length > 0
            ? 'Some extracted figures are not on the statement — refused rather than guessed'
            : 'The statement does not reconcile (gross − costs ≠ net)',
      };
    }

    return { parse: draft, grounding, refusalReason: null };
  } catch (err) {
    console.error('[rentalStatement] parse failed:', err);
    return { parse: null, grounding: null, refusalReason: 'Statement analysis failed' };
  }
}

// =============================================================================
// Itemised derived-expense payloads (Tier-1 path — one row per line item)
// =============================================================================

export interface StatementExpenseContext {
  userId: string;
  ownerEntityId: string;
  incomeStreamId: string;
  propertyId?: string | null;
}

/**
 * Build the one-off DERIVED (`STATEMENT`, itemised) expense payloads for a
 * grounded parse — one row per statement line item, each with its own
 * category (spec §4). One-off (`isRecurring: false`): a statement documents
 * ONE period's actual costs; the tax engine counts each once (MON-037).
 * Persistence stays with the locked producer (R1 source-lock).
 */
export function buildItemisedStatementExpenses(
  ctx: StatementExpenseContext,
  parse: RentalStatementParse,
) {
  return parse.lineItems.map((item) => ({
    userId: ctx.userId,
    ownerEntityId: ctx.ownerEntityId,
    name: parse.period.label ? `${item.label} — ${parse.period.label}` : item.label,
    category: item.category,
    sourceType: (ctx.propertyId ? 'PROPERTY' : 'GENERAL') as 'PROPERTY' | 'GENERAL',
    amount: item.amount,
    frequency: 'MONTHLY' as const, // one-off: counted once, cadence moot (MON-037)
    isEssential: true,
    // The statement documents the cost; deductibility of CAPITAL items is the
    // user's/agent's call (spec §10) — default deductible only for immediate.
    isTaxDeductible: item.capitalVsImmediate !== 'capital',
    isRecurring: false,
    derived: true,
    derivedSource: 'STATEMENT' as const,
    itemised: true,
    derivedFromIncomeId: ctx.incomeStreamId,
    propertyId: ctx.propertyId ?? null,
  }));
}
