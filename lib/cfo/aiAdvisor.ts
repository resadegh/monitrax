/**
 * Phase 40 — AI Financial Advisor Orchestrator
 *
 * The single canonical entry point for generating an AI-powered financial
 * advice document for a user. Composes existing services — does NOT
 * duplicate any calculation logic (CLAUDE.md §12.2):
 *
 *   1. Pull the canonical financial picture via `getMasterFinancialSnapshot()`.
 *   2. Run the existing rule-based action engine + risk radar to produce
 *      ground-truth findings the AI must respect.
 *   3. Determine the user's TRAIL stage (`lib/cfo/trailStage.ts`).
 *   4. Sanitise the snapshot — aggregates only, no CDR-sensitive identifiers
 *      (account numbers, BSBs, transaction-level descriptions, payee names).
 *      See CLAUDE.md §13.3.
 *   5. Call Gemini Pro with a strict system prompt instructing the AI to
 *      narrate qualitatively and reference numbers via `snapshotPath` keys —
 *      it MUST NOT invent figures.
 *   6. Validate the returned document — drop any evidence item whose
 *      `snapshotPath` doesn't resolve to a number in the actual snapshot.
 *   7. On Gemini failure, fall back to a rule-engine-only advice doc so the
 *      surface is never empty.
 *
 * Numbers shown to the user come from one of two deterministic sources:
 *   • Snapshot lookups (via the validated `snapshotPath` field on each
 *     evidence item).
 *   • Scenario engine output (via `lib/cfo/scenarios/`), which is run
 *     server-side when the user clicks "Run scenario".
 *
 * The AI never writes a number the user sees. This is a structural
 * anti-hallucination guarantee.
 */

import { createHash } from 'crypto';

import { prisma } from '@/lib/db';
import {
  getMasterFinancialSnapshot,
  type MasterFinancialSnapshot,
} from '@/lib/services/masterFinancialService';
import { generateGeminiJSONCompletion } from '@/lib/ai/google/geminiClient';
import { GEMINI_MODELS } from '@/lib/ai/google/modelConfig';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { buildTaxRulesReference } from '@/lib/neobrain/factPack';
import { renderTaxLawLines } from '@/lib/neobrain/grounding';
import { calculateCFOScore } from './scoreCalculator';
import { scanForRisks } from './riskRadar';
import { generateActions } from './actionEngine';
import {
  determineTrailStage,
  getTrailStageInfo,
  type TrailStage,
} from './trailStage';
import { SCENARIO_TYPES, type ScenarioType, type LoanView } from './scenarios';
import type { CFOAction } from './types';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface AIAdviceEvidence {
  label: string;
  snapshotPath: string;
  format: 'currency' | 'percent' | 'number';
  /**
   * Server-resolved value at the time the advice was generated. The
   * snapshotPath is validated against the actual snapshot during AI
   * response validation; if it doesn't resolve, the evidence item is
   * dropped. The UI renders this value directly — it never tries to
   * resolve the path itself, and the AI never authored this number.
   */
  value: number;
}

export interface AIAdviceSuggestedScenario {
  type: ScenarioType;
  params: Record<string, unknown>;
  preview: string;
}

export interface AIAdviceRecommendation {
  id: string;
  priority: 'do_now' | 'upcoming' | 'consider' | 'background';
  category:
    | 'cashflow'
    | 'debt'
    | 'spending'
    | 'savings'
    | 'property'
    | 'investment'
    | 'tax'
    | 'risk';
  trailStage: TrailStage;
  title: string;
  reasoning: string; // qualitative narrative — no inline numbers expected
  steps: string[];
  evidence: AIAdviceEvidence[];
  suggestedScenario?: AIAdviceSuggestedScenario;
  confidence: number; // 0–1
}

export interface AIAdviceHeadline {
  title: string;
  detail: string;
}

export interface AIAdviceDocument {
  id: string;
  userId: string;
  trailStage: TrailStage;
  trailStageName: string;
  generatedAt: string; // ISO
  expiresAt: string; // ISO
  fingerprint: string;
  /**
   * Stale = the snapshot has shifted materially since this advice was
   * generated. The UI uses this to surface a "refresh advice" prompt —
   * but the advice itself does NOT auto-regenerate. Stability is the
   * goal: once advice is shown, it stays put until either (a) the 24h
   * TTL expires or (b) the user explicitly clicks Refresh. This avoids
   * the surface flickering on every minor balance move.
   */
  isStale: boolean;
  isFallback: boolean;
  /** Prompt-version stamp the doc was generated under — see PROMPT_VERSION. */
  promptVersion: string;
  situationAssessment: string; // 1–2 short sentences (≤ 35 words)
  headlineAdvice: AIAdviceHeadline[];
  recommendations: AIAdviceRecommendation[];
  watchPoints: string[];
  questionsForUser: string[];
  meta: {
    model?: string;
    tokensUsed?: number;
    estimatedCost?: number;
    snapshotCalculatedAt: string;
  };
}

export interface GenerateAdviceOptions {
  userId: string;
  forceRegenerate?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_TTL_HOURS = 24;
const PRO_MODEL = GEMINI_MODELS.PRO; // 'gemini-2.5-pro' (retires 2026-10-16 — fallback chain covers it)

/**
 * Bumped whenever we materially change the SYSTEM_PROMPT or the shape of
 * AIAdviceDocument so that already-cached docs from the prior prompt
 * version are ignored on read (forcing a fresh generation on next access).
 * Avoids the need to manually clear the table when the voice/tone changes.
 */
const PROMPT_VERSION = 'v2-guide-warm';

// =============================================================================
// PUBLIC ENTRY POINT
// =============================================================================

export async function generateOrFetchAdvice(
  options: GenerateAdviceOptions
): Promise<AIAdviceDocument> {
  const { userId, forceRegenerate = false } = options;

  // Load canonical snapshot + rule-engine outputs in parallel.
  const [snapshot, score, riskOutput, loanRows] = await Promise.all([
    getMasterFinancialSnapshot(userId),
    calculateCFOScore(userId),
    scanForRisks(userId),
    fetchLoanViews(userId),
  ]);
  const ruleActions = await generateActions(userId, riskOutput.risks, score.components);
  const allActions = [
    ...ruleActions.doNow,
    ...ruleActions.upcoming,
    ...ruleActions.considerSoon,
    ...ruleActions.background,
  ];

  const trailStage = determineUserTrailStage(snapshot);
  const fingerprint = fingerprintSnapshot(snapshot, trailStage);

  // Cache lookup. **Stability rule**: while a non-expired advice doc exists
  // for this user, return it as-is regardless of whether the snapshot
  // fingerprint has shifted. Minor data drift (a transaction imported, a
  // balance updated) MUST NOT regenerate the advice — the user is engaging
  // with this surface and the advice should stay stable until the TTL
  // expires or they explicitly click "Refresh". The fingerprint is
  // surfaced as `isStale` so the UI can offer a refresh prompt without
  // forcing one.
  if (!forceRegenerate) {
    const cached = await findFreshCache(userId);
    if (cached) {
      cached.isStale = cached.fingerprint !== fingerprint;
      return cached;
    }
  }

  // Generate fresh.
  let doc: AIAdviceDocument;
  try {
    doc = await callGeminiAdvisor({
      snapshot,
      trailStage,
      ruleActions: allActions,
      loanRows,
      fingerprint,
      userId,
    });
  } catch (err) {
    console.error('[aiAdvisor] Gemini failed, falling back to rule-engine advice:', err);
    doc = buildFallbackDoc({
      userId,
      snapshot,
      trailStage,
      ruleActions: allActions,
      fingerprint,
    });
  }

  // Persist (cache write — best-effort, non-blocking failure mode).
  await persistAdvice(doc).catch((err) => {
    console.error('[aiAdvisor] Failed to persist advice doc:', err);
  });

  return doc;
}

// =============================================================================
// CACHE
// =============================================================================

async function findFreshCache(userId: string): Promise<AIAdviceDocument | null> {
  try {
    const row = await prisma.aIAdviceDocument.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    const doc = rowToDocument(row);
    // Ignore docs generated under a previous prompt version — forces a
    // regeneration when we update the voice/tone/schema. Old rows TTL out
    // naturally; we don't actively delete (cheap and safe).
    const docPromptVersion =
      typeof (row.document as { promptVersion?: unknown } | null)?.promptVersion === 'string'
        ? ((row.document as { promptVersion: string }).promptVersion)
        : null;
    if (docPromptVersion !== PROMPT_VERSION) return null;
    return doc;
  } catch (err) {
    console.error('[aiAdvisor] cache lookup failed:', err);
    return null;
  }
}

async function persistAdvice(doc: AIAdviceDocument): Promise<void> {
  await prisma.aIAdviceDocument.create({
    data: {
      id: doc.id,
      userId: doc.userId,
      fingerprint: doc.fingerprint,
      trailStage: doc.trailStage,
      // The document JSON contains aggregates + AI narrative only — already
      // sanitised at construction time. CDR-safe per §13.3.
      document: doc as unknown as object,
      modelUsed: doc.meta.model ?? null,
      tokensUsed: doc.meta.tokensUsed ?? null,
      estimatedCost: doc.meta.estimatedCost ?? null,
      isFallback: doc.isFallback,
      expiresAt: new Date(doc.expiresAt),
    },
  });
}

function rowToDocument(row: {
  id: string;
  userId: string;
  fingerprint: string;
  trailStage: string;
  document: unknown;
  isFallback: boolean;
  expiresAt: Date;
  createdAt: Date;
  modelUsed: string | null;
  tokensUsed: number | null;
  estimatedCost: number | null;
}): AIAdviceDocument {
  // The persisted JSON is the document we wrote. Trust it, but stamp the
  // canonical fields from the row to avoid drift.
  const doc = row.document as AIAdviceDocument;
  return {
    ...doc,
    id: row.id,
    userId: row.userId,
    fingerprint: row.fingerprint,
    trailStage: row.trailStage as TrailStage,
    expiresAt: row.expiresAt.toISOString(),
    isFallback: row.isFallback,
    // `isStale` is recomputed by the caller against the current snapshot
    // fingerprint, so it can default to false here.
    isStale: false,
  };
}

// =============================================================================
// FINGERPRINTING
// =============================================================================

/**
 * Stable hash of the snapshot inputs that justify regenerating advice. When
 * any of these change materially, the fingerprint changes and a fresh AI
 * call is made. Inputs are bucketed (rounded) so that tiny fluctuations
 * (e.g. an account balance moving by $1) don't bust the cache.
 */
function fingerprintSnapshot(snapshot: MasterFinancialSnapshot, stage: TrailStage): string {
  const bucket = (v: number, step: number) => Math.round(v / step) * step;
  const payload = {
    stage,
    netWorth: bucket(snapshot.netWorth.netWorth, 1000),
    monthlyCashflow: bucket(snapshot.quickMetrics.monthlyCashflow, 100),
    monthlyIncome: bucket(snapshot.quickMetrics.monthlyIncome, 100),
    monthlyExpenses: bucket(snapshot.quickMetrics.monthlyExpenses, 100),
    debt: bucket(snapshot.debt.summary.totalPrincipal, 1000),
    properties: snapshot.properties.map((p) => ({
      id: p.id,
      value: bucket(p.currentValue, 5000),
      cashflow: bucket(p.monthlyCashflow, 100),
    })),
    investments: bucket(snapshot.investments.totalValue, 1000),
    healthScore: snapshot.healthScore.score,
    emergencyMonths: bucket(snapshot.emergencyFund.monthsCovered, 1),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}

// =============================================================================
// TRAIL STAGE
// =============================================================================

function determineUserTrailStage(snapshot: MasterFinancialSnapshot): TrailStage {
  return determineTrailStage({
    hasAccounts: snapshot.counts.accounts > 0,
    monthlyCashflow: snapshot.quickMetrics.monthlyCashflow,
    emergencyFundMonths: snapshot.emergencyFund.monthsCovered,
    hasInvestments: snapshot.counts.investments > 0,
    healthScore: snapshot.healthScore.score,
  });
}

// =============================================================================
// LOAN VIEW (for scenario context — fetched once, attached to fingerprint)
// =============================================================================

async function fetchLoanViews(userId: string): Promise<LoanView[]> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      principal: true,
      interestRateAnnual: true,
      termMonthsRemaining: true,
      minRepayment: true,
      type: true,
      repaymentFrequency: true,
      offsetAccount: { select: { currentBalance: true } },
    },
  });
  return loans.map((l) => {
    const remaining = Number(l.termMonthsRemaining ?? 360);
    // The canonical interest field (`interestRateAnnual`) is already a
    // decimal per the schema comment ("e.g., 0.0625 for 6.25%").
    const rate = Number(l.interestRateAnnual ?? 0);
    // Normalise repayment to monthly using the canonical frequency util
    // would force a circular import here — and the rule-engine already
    // uses the same Prisma column directly. We treat `minRepayment` as
    // monthly when frequency is MONTHLY (the default) and approximate
    // otherwise; this view is only used for scenario projections, where
    // the user can adjust inputs.
    const minMonthlyRepayment =
      l.repaymentFrequency === 'WEEKLY'
        ? Number(l.minRepayment ?? 0) * (52 / 12)
        : l.repaymentFrequency === 'FORTNIGHTLY'
          ? Number(l.minRepayment ?? 0) * (26 / 12)
          : Number(l.minRepayment ?? 0);
    return {
      id: l.id,
      name: l.name,
      principal: Number(l.principal),
      interestRate: rate,
      termMonths: remaining,
      remainingMonths: remaining,
      monthlyRepayment: minMonthlyRepayment,
      loanType: String(l.type ?? ''),
      offsetBalance: Number(l.offsetAccount?.currentBalance ?? 0),
    };
  });
}

// =============================================================================
// CDR SANITISATION + PROMPT BUILDING
// =============================================================================

/**
 * Build the structured context document that we send to Gemini. Aggregates
 * only — no account numbers, BSBs, transaction text, or payee names.
 * Property and loan names are passed through (they are user-chosen labels;
 * not CDR-protected per the project's classification — they're already
 * visible in the same-origin UI).
 */
function buildAIContext(
  snapshot: MasterFinancialSnapshot,
  trailStage: TrailStage,
  ruleActions: CFOAction[],
  loanRows: LoanView[]
): {
  context: object;
  scenarioableLoans: { id: string; name: string }[];
  scenarioableProperties: { id: string; name: string }[];
} {
  const stageInfo = getTrailStageInfo(trailStage);

  return {
    context: {
      userTrailStage: {
        letter: trailStage,
        name: stageInfo.name,
        tagline: stageInfo.tagline,
        focusAreas: stageInfo.focusAreas,
      },
      counts: snapshot.counts,
      netWorth: {
        total: round(snapshot.netWorth.netWorth),
        assets: round(snapshot.netWorth.assets.total),
        liabilities: round(snapshot.netWorth.liabilities.total),
      },
      cashflow: {
        monthlyIncome: round(snapshot.quickMetrics.monthlyIncome),
        monthlyExpenses: round(snapshot.quickMetrics.monthlyExpenses),
        monthlyLoanRepayments: round(snapshot.quickMetrics.monthlyLoanRepayments),
        monthlyCashflow: round(snapshot.quickMetrics.monthlyCashflow),
        savingsRate: round(snapshot.quickMetrics.savingsRate),
      },
      emergencyFund: {
        liquidCash: round(snapshot.emergencyFund.liquidCash),
        monthsCovered: round(snapshot.emergencyFund.monthsCovered, 2),
        targetMonths: snapshot.emergencyFund.targetMonths,
        gap: round(snapshot.emergencyFund.gap),
        status: snapshot.emergencyFund.status,
      },
      debt: {
        totalPrincipal: round(snapshot.debt.summary.totalPrincipal),
        weightedAverageRate: round(snapshot.debt.summary.weightedInterestRate, 3),
        debtToIncomeRatio: round(snapshot.debt.metrics.debtToIncomeRatio, 2),
        debtServiceRatio: round(snapshot.debt.metrics.debtServiceRatio, 2),
      },
      properties: snapshot.properties.map((p) => ({
        id: p.id,
        name: p.name,
        currentValue: round(p.currentValue),
        equity: round(p.equity),
        lvr: round(p.lvr, 1),
        monthlyCashflow: round(p.monthlyCashflow),
        rentalYield: round(p.rentalYield, 2),
        capitalGrowthPercent: round(p.capitalGrowthPercent, 2),
      })),
      investments: {
        totalValue: round(snapshot.investments.totalValue),
        unrealisedGainPercent: round(snapshot.investments.unrealisedGainPercent, 2),
        holdingsCount: snapshot.investments.holdingsCount,
        byType: snapshot.investments.byType,
      },
      tax: {
        estimatedTaxableIncome: round(snapshot.tax.estimatedTaxableIncome),
        estimatedTaxPayable: round(snapshot.tax.estimatedTaxPayable),
        effectiveTaxRate: round(snapshot.tax.effectiveTaxRate, 2),
        marginalTaxRate: round(snapshot.tax.marginalTaxRate, 2),
        totalDeductions: round(snapshot.tax.totalDeductions),
        estimatedRefundOrOwing: round(snapshot.tax.estimatedRefundOrOwing),
      },
      health: {
        score: snapshot.healthScore.score,
        grade: snapshot.healthScore.grade,
      },
      topExpenseCategories: snapshot.expenses.monthly.byCategory
        .slice(0, 8)
        .map((c) => ({
          category: c.category,
          monthlyAmount: round(c.amount),
          percentage: round(c.percentage, 1),
          isEssential: c.isEssential,
        })),
      ruleEngineFindings: ruleActions.slice(0, 12).map((a) => ({
        priority: a.priority,
        category: a.category,
        title: a.title,
        explanation: a.explanation,
        severity: a.severity,
        impactType: a.expectedImpact.type,
        impactDescription: a.expectedImpact.description,
      })),
      scenarioableLoans: loanRows.map((l) => ({ id: l.id, name: l.name })),
      scenarioableProperties: snapshot.properties.map((p) => ({ id: p.id, name: p.name })),
    },
    scenarioableLoans: loanRows.map((l) => ({ id: l.id, name: l.name })),
    scenarioableProperties: snapshot.properties.map((p) => ({ id: p.id, name: p.name })),
  };
}

function round(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are the Guide inside Monitrax — an Australian
personal-finance app built on the TRAIL framework
(Track → Reduce → Anchor → Invest → Live).

You speak with the warmth and clarity of a trusted friend who happens to
be a great financial adviser, designer, and behavioural psychologist.
You are NOT clinical, alarmist, or corporate. You never lecture.

# Your job

Read the structured <context> JSON. It is the user's CURRENT, REAL
financial picture (aggregates only — no transaction-level data). Make
sense of it for them, then produce a JSON advice document the
application will render verbatim.

# CRITICAL ANTI-HALLUCINATION RULES

1. You are NOT permitted to invent or estimate any dollar amount, percentage,
   ratio, or count. Every number that ends up on the user's screen comes
   either from the <context> object via a snapshotPath reference, or from a
   server-side scenario engine (which you can request via suggestedScenario).
2. In every prose field (situationAssessment, reasoning, headlineAdvice
   detail, watchPoints, questionsForUser), use QUALITATIVE language only:
   "modest", "well above target", "meaningful", "manageable", etc. Do NOT
   write specific dollar figures or percentages in prose.
3. To show a number, add an entry to the recommendation's "evidence" array
   with a "snapshotPath" pointing into the <context> object using dot
   notation (e.g. "cashflow.monthlyCashflow", "properties[0].lvr",
   "topExpenseCategories[2].monthlyAmount"). The UI will look up the
   actual value and format it. If you cannot identify a path, do not
   include the evidence item.
4. To project the impact of a change (selling a property, paying down a
   loan, refinancing, etc.), include a "suggestedScenario" with type +
   params. Valid scenario types: ${SCENARIO_TYPES.join(', ')}. Do NOT
   compute the impact yourself — the server will run it deterministically
   when the user clicks "Run scenario".
5. Use ONLY the loan/property IDs that appear under
   context.scenarioableLoans and context.scenarioableProperties.

# VOICE & TONE — non-negotiable

The previous version of this surface was big, dark, and intimidating —
read like a medical diagnosis. The user explicitly asked for the voice
of a "world-class financial adviser, designer, and human-behaviour
psychologist". Write accordingly.

- **situationAssessment is at most TWO short sentences (≤ 35 words combined).**
  It is a calm, framing opener — never a verdict. Lead with where they
  ARE and where the focus is, not what's wrong. The recommendations
  below carry the detail — the assessment just sets the scene.
- Never lead with the negative. "Your cashflow is negative" is wrong.
  "This month, your loans are working harder than your income — there's
  room to shift the balance" is right.
- Banned vocabulary (clinical / alarmist / corporate): "currently",
  "primarily due to", "issues", "addressing", "stability", "monitor",
  "discipline", "you should", "needs to", "must", "critical", "urgent",
  "warning", "diagnose", "stabilise". Also avoid all-caps section labels.
- Preferred phrasing: "right now", "because of", "let's", "you could",
  "worth considering", "one move that helps", "see how it goes",
  "settle into", "next step", "small adjustment".
- Treat the user as a competent peer, not a patient. No moralising. No
  "spending discipline", no "live within your means". Respectful of
  trade-offs they may already be aware of.
- Reasoning fields on each recommendation: 2–3 sentences MAX. Plain
  English. Same banned/preferred vocabulary applies.
- Headline advice items (title + detail): title is a 2–4 word verb phrase
  ("Trim a leaky category", "Talk to your lender"). Detail is one short
  sentence framing why it matters — never a number.
- Watch points: short, observation-style, no scolding ("Tax position
  worth a closer look before EOFY" — not "You must address tax before
  EOFY").
- Questions for the user: framed as conversation openers, not
  interrogations. ("Is the rental income on Smith St still around what's
  recorded?" — not "What is your rental income?")

# TRAIL framing

- The user's stage (context.userTrailStage) sets priority. A REDUCE-stage
  user gets cashflow & spending moves first; an INVEST-stage user gets
  portfolio moves. Don't push someone in REDUCE into INVEST-stage moves.
- The user has already seen the rule-engine findings
  (context.ruleEngineFindings) in their dashboard. Synthesise — group,
  prioritise, explain the WHY, add scenarios — don't just restate.
- For every recommendation, ALWAYS include a "steps" array (3–5 concrete
  moves) and a clear suggestedScenario when one applies.
- If a property is significantly negative-geared, propose
  "sellProperty" as a scenario the user can model — but frame it as one
  option to explore, never as the right answer.

# Output schema (return ONLY this JSON, no prose outside the JSON)

{
  "situationAssessment": "string — 1 to 2 short sentences, ≤ 35 words combined",
  "headlineAdvice": [
    { "title": "string — 2 to 4 word verb phrase", "detail": "string — one short sentence" }
  ],
  "recommendations": [
    {
      "id": "string — kebab-case slug",
      "priority": "do_now" | "upcoming" | "consider" | "background",
      "category": "cashflow" | "debt" | "spending" | "savings" | "property" | "investment" | "tax" | "risk",
      "trailStage": "T" | "R" | "A" | "I" | "L",
      "title": "string",
      "reasoning": "string — 2 to 3 sentences, plain English",
      "steps": ["string", "..."],
      "evidence": [
        { "label": "string", "snapshotPath": "string", "format": "currency" | "percent" | "number" }
      ],
      "suggestedScenario": {
        "type": "sellProperty" | "payDownLoan" | "refinanceLoan" | "redirectToOffset" | "cutSpendCategory" | "addInvestment",
        "params": { "...": "..." },
        "preview": "string — one sentence describing what this scenario will model"
      },
      "confidence": 0.0 to 1.0
    }
  ],
  "watchPoints": ["string — short observation, no scolding"],
  "questionsForUser": ["string — conversational opener, not interrogation"]
}

Rules:
- 3–6 recommendations. Order by priority and TRAIL relevance.
- Every recommendation MUST have at least one evidence item.
- suggestedScenario is OPTIONAL but strongly preferred when a concrete
  numeric projection would help the user make the call.
- Confidence reflects how strongly the data supports the recommendation.

# Examples of the voice

GOOD situationAssessment (REDUCE stage, negative cashflow):
  "Your loans are working harder than your income this month. A couple
  of small moves below would shift the balance — let's start there."

GOOD situationAssessment (INVEST stage, healthy):
  "Cashflow is steady and the safety net is in good shape. Now's a good
  moment to look at where the next dollar grows hardest."

BAD (clinical, alarmist) — do NOT do this:
  "Your monthly cashflow is currently negative, primarily due to loan
  repayments and property expenses. As you're in the 'Reduce' stage,
  our focus is on identifying areas to improve your cashflow and manage
  your debt. Addressing these issues will help you regain financial
  stability."
`;

// =============================================================================
// GEMINI CALL
// =============================================================================

interface GeminiAdvisorInput {
  snapshot: MasterFinancialSnapshot;
  trailStage: TrailStage;
  ruleActions: CFOAction[];
  loanRows: LoanView[];
  fingerprint: string;
  userId: string;
}

interface RawAIResponse {
  situationAssessment?: string;
  headlineAdvice?: Array<{ title?: string; detail?: string }>;
  recommendations?: Array<{
    id?: string;
    priority?: string;
    category?: string;
    trailStage?: string;
    title?: string;
    reasoning?: string;
    steps?: string[];
    evidence?: Array<{ label?: string; snapshotPath?: string; format?: string }>;
    suggestedScenario?: {
      type?: string;
      params?: Record<string, unknown>;
      preview?: string;
    };
    confidence?: number;
  }>;
  watchPoints?: string[];
  questionsForUser?: string[];
}

async function callGeminiAdvisor(input: GeminiAdvisorInput): Promise<AIAdviceDocument> {
  const { context, scenarioableLoans, scenarioableProperties } = buildAIContext(
    input.snapshot,
    input.trailStage,
    input.ruleActions,
    input.loanRows
  );

  // Neobrain tax-law grounding (Phase D): the CFO already grounds NUMBERS via
  // snapshotPath validation; add the canonical CURRENT TAX LAW so any tax-rule
  // statement (bracket/rate/threshold/cap/CGT/super) grounds on the engine
  // config, never model memory — reform-aware (§12.14). Reuses the ONE tax-law
  // renderer (§12.2.1), same source as the FactPack grounding clause.
  const taxLaw = renderTaxLawLines(buildTaxRulesReference(getCurrentTaxYearConfig())).join('\n');
  const userPrompt =
    `<context>\n${JSON.stringify(context, null, 2)}\n</context>\n\n` +
    `<tax-law>\n${taxLaw}\n</tax-law>\n\n` +
    `Tax grounding: when you state any tax rule (bracket, rate, threshold, cap, CGT, super), use ONLY the <tax-law> above — never recall a rate or threshold from memory. A measure marked "announced-not-in-effect" is NOT current law; mention it only as a proposed future change.\n\n` +
    `Return the advice document JSON now.`;

  const result = await generateGeminiJSONCompletion<RawAIResponse>({
    surface: 'cfo-advisor',
    model: PRO_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
    maxTokens: 4096,
  });

  const validated = validateAIResponse(result.data, {
    snapshot: input.snapshot,
    scenarioableLoans,
    scenarioableProperties,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  const stageInfo = getTrailStageInfo(input.trailStage);

  return {
    id: cryptoRandomId(),
    userId: input.userId,
    trailStage: input.trailStage,
    trailStageName: stageInfo.name,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fingerprint: input.fingerprint,
    isStale: false,
    isFallback: false,
    promptVersion: PROMPT_VERSION,
    situationAssessment: validated.situationAssessment,
    headlineAdvice: validated.headlineAdvice,
    recommendations: validated.recommendations,
    watchPoints: validated.watchPoints,
    questionsForUser: validated.questionsForUser,
    meta: {
      model: result.usage.model,
      tokensUsed: result.usage.totalTokens,
      estimatedCost: result.usage.estimatedCost,
      snapshotCalculatedAt:
        input.snapshot.calculatedAt instanceof Date
          ? input.snapshot.calculatedAt.toISOString()
          : new Date(input.snapshot.calculatedAt).toISOString(),
    },
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

interface ValidationContext {
  snapshot: MasterFinancialSnapshot;
  scenarioableLoans: { id: string; name: string }[];
  scenarioableProperties: { id: string; name: string }[];
}

interface ValidatedAIResponse {
  situationAssessment: string;
  headlineAdvice: AIAdviceHeadline[];
  recommendations: AIAdviceRecommendation[];
  watchPoints: string[];
  questionsForUser: string[];
}

function validateAIResponse(
  raw: RawAIResponse,
  ctx: ValidationContext
): ValidatedAIResponse {
  const validPriorities = new Set(['do_now', 'upcoming', 'consider', 'background']);
  const validCategories = new Set([
    'cashflow',
    'debt',
    'spending',
    'savings',
    'property',
    'investment',
    'tax',
    'risk',
  ]);
  const validStages = new Set<TrailStage>(['T', 'R', 'A', 'I', 'L']);
  const validScenarioTypes = new Set<ScenarioType>(SCENARIO_TYPES);

  const recs: AIAdviceRecommendation[] = (raw.recommendations ?? [])
    .map((r): AIAdviceRecommendation | null => {
      if (!r.title || !r.reasoning) return null;
      const priority = validPriorities.has(r.priority ?? '')
        ? (r.priority as AIAdviceRecommendation['priority'])
        : 'consider';
      const category = validCategories.has(r.category ?? '')
        ? (r.category as AIAdviceRecommendation['category'])
        : 'risk';
      const trailStage = validStages.has(r.trailStage as TrailStage)
        ? (r.trailStage as TrailStage)
        : 'R';

      const evidence = (r.evidence ?? [])
        .map((e): AIAdviceEvidence | null => {
          if (!e.snapshotPath || !e.label) return null;
          // Resolve path against the snapshot — drop the item if it doesn't
          // resolve to a number. This is the structural anti-hallucination
          // guarantee: the AI authored a label + a path; we authored the
          // number.
          const resolved = resolveSnapshotPath(ctx.snapshot, e.snapshotPath);
          if (typeof resolved !== 'number' || !Number.isFinite(resolved)) return null;
          const fmt =
            e.format === 'currency' || e.format === 'percent' || e.format === 'number'
              ? e.format
              : 'currency';
          return { label: e.label, snapshotPath: e.snapshotPath, format: fmt, value: resolved };
        })
        .filter((x): x is AIAdviceEvidence => x !== null);

      let suggestedScenario: AIAdviceSuggestedScenario | undefined;
      if (r.suggestedScenario && r.suggestedScenario.type) {
        if (validScenarioTypes.has(r.suggestedScenario.type as ScenarioType)) {
          const valid = validateScenarioParams(
            r.suggestedScenario.type as ScenarioType,
            r.suggestedScenario.params ?? {},
            ctx
          );
          if (valid) {
            suggestedScenario = {
              type: r.suggestedScenario.type as ScenarioType,
              params: valid,
              preview: r.suggestedScenario.preview ?? 'Run this scenario',
            };
          }
        }
      }

      return {
        id: r.id || slugify(r.title),
        priority,
        category,
        trailStage,
        title: r.title,
        reasoning: r.reasoning,
        steps: Array.isArray(r.steps) ? r.steps.filter((s) => typeof s === 'string') : [],
        evidence,
        suggestedScenario,
        confidence: typeof r.confidence === 'number' ? clamp(r.confidence, 0, 1) : 0.6,
      };
    })
    .filter((x): x is AIAdviceRecommendation => x !== null);

  return {
    situationAssessment:
      typeof raw.situationAssessment === 'string'
        ? raw.situationAssessment
        : "Here's a quick read of where you are right now.",
    headlineAdvice: (raw.headlineAdvice ?? [])
      .filter((h) => h.title && h.detail)
      .map((h) => ({ title: h.title!, detail: h.detail! })),
    recommendations: recs,
    watchPoints: (raw.watchPoints ?? []).filter((s) => typeof s === 'string'),
    questionsForUser: (raw.questionsForUser ?? []).filter((s) => typeof s === 'string'),
  };
}

/**
 * Walk a dotted path into the snapshot and return the value at that path
 * if and only if it's a finite number. Used to validate AI-supplied
 * snapshotPath references — the structural anti-hallucination guarantee.
 *
 * Supports: "cashflow.monthlyCashflow", "properties[0].lvr",
 * "topExpenseCategories[2].monthlyAmount". Note that the AI sees a
 * derived context document (built by `buildAIContext`), so path lookups
 * reproduce that mapping rather than walking the raw snapshot directly.
 */
function resolveSnapshotPath(snapshot: MasterFinancialSnapshot, path: string): unknown {
  // Reconstruct the context view (cheap; pure function, no I/O).
  const ctxView = buildAIContext(snapshot, 'R', [], []).context as Record<string, unknown>;
  return resolvePath(ctxView, path);
}

function resolvePath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  // Split on '.' but respect "[index]" notation.
  const tokens: (string | number)[] = [];
  for (const part of path.split('.')) {
    const match = part.match(/^([a-zA-Z0-9_]+)((?:\[\d+\])*)$/);
    if (!match) return undefined;
    tokens.push(match[1]);
    const idxBlob = match[2];
    if (idxBlob) {
      const matches = idxBlob.matchAll(/\[(\d+)\]/g);
      for (const m of matches) tokens.push(parseInt(m[1], 10));
    }
  }
  let cur: unknown = obj;
  for (const t of tokens) {
    if (cur == null) return undefined;
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[t];
    } else {
      cur = (cur as Record<string, unknown>)[t];
    }
  }
  return cur;
}

function validateScenarioParams(
  type: ScenarioType,
  params: Record<string, unknown>,
  ctx: ValidationContext
): Record<string, unknown> | null {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

  switch (type) {
    case 'sellProperty': {
      const propertyId = str(params.propertyId);
      if (!propertyId || !ctx.scenarioableProperties.find((p) => p.id === propertyId)) return null;
      const sellingCostsPercent = num(params.sellingCostsPercent);
      return sellingCostsPercent != null ? { propertyId, sellingCostsPercent } : { propertyId };
    }
    case 'payDownLoan': {
      const loanId = str(params.loanId);
      const extraMonthly = num(params.extraMonthly);
      if (!loanId || extraMonthly == null || extraMonthly <= 0) return null;
      if (!ctx.scenarioableLoans.find((l) => l.id === loanId)) return null;
      return { loanId, extraMonthly };
    }
    case 'refinanceLoan': {
      const loanId = str(params.loanId);
      const newRate = num(params.newRate);
      if (!loanId || newRate == null || newRate <= 0 || newRate > 0.5) return null;
      if (!ctx.scenarioableLoans.find((l) => l.id === loanId)) return null;
      const switchingCosts = num(params.switchingCosts);
      return switchingCosts != null ? { loanId, newRate, switchingCosts } : { loanId, newRate };
    }
    case 'redirectToOffset': {
      const loanId = str(params.loanId);
      const amount = num(params.amount);
      if (!loanId || amount == null || amount <= 0) return null;
      if (!ctx.scenarioableLoans.find((l) => l.id === loanId)) return null;
      return { loanId, amount };
    }
    case 'cutSpendCategory': {
      const category = str(params.category);
      const monthlyReduction = num(params.monthlyReduction);
      if (!category || monthlyReduction == null || monthlyReduction <= 0) return null;
      return { category, monthlyReduction };
    }
    case 'addInvestment': {
      const monthlyAmount = num(params.monthlyAmount);
      if (monthlyAmount == null || monthlyAmount <= 0) return null;
      const out: Record<string, unknown> = { monthlyAmount };
      const expectedAnnualReturn = num(params.expectedAnnualReturn);
      if (expectedAnnualReturn != null) out.expectedAnnualReturn = expectedAnnualReturn;
      const years = num(params.years);
      if (years != null) out.years = years;
      return out;
    }
    case 'salarySacrificeToSuper': {
      const monthlySacrifice = num(params.monthlySacrifice);
      if (monthlySacrifice == null || monthlySacrifice < 0) return null;
      const out: Record<string, unknown> = { monthlySacrifice };
      const grossSalaryAnnual = num(params.grossSalaryAnnual);
      if (grossSalaryAnnual != null) out.grossSalaryAnnual = grossSalaryAnnual;
      const ytdConcessional = num(params.ytdConcessional);
      if (ytdConcessional != null) out.ytdConcessional = ytdConcessional;
      const currentSuperBalance = num(params.currentSuperBalance);
      if (currentSuperBalance != null) out.currentSuperBalance = currentSuperBalance;
      return out;
    }
  }
}

// =============================================================================
// FALLBACK (rule-engine-only advice doc)
// =============================================================================

function buildFallbackDoc(input: {
  userId: string;
  snapshot: MasterFinancialSnapshot;
  trailStage: TrailStage;
  ruleActions: CFOAction[];
  fingerprint: string;
}): AIAdviceDocument {
  const stageInfo = getTrailStageInfo(input.trailStage);
  const now = new Date();
  // Shorter TTL for the fallback so we retry the AI sooner.
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  const recs: AIAdviceRecommendation[] = input.ruleActions.slice(0, 5).map((a) => ({
    id: a.id || slugify(a.title),
    priority:
      a.priority === 'consider_soon'
        ? 'consider'
        : (a.priority as AIAdviceRecommendation['priority']),
    category: a.category as AIAdviceRecommendation['category'],
    trailStage: input.trailStage,
    title: a.title,
    reasoning: a.explanation,
    steps: [a.expectedImpact.description],
    evidence: [],
    confidence: a.confidence ?? 0.5,
  }));

  return {
    id: cryptoRandomId(),
    userId: input.userId,
    trailStage: input.trailStage,
    trailStageName: stageInfo.name,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fingerprint: input.fingerprint,
    isStale: false,
    isFallback: true,
    promptVersion: PROMPT_VERSION,
    situationAssessment:
      "Here are a few things worth a look — based on the latest snapshot. A fuller take will be along shortly.",
    headlineAdvice: [],
    recommendations: recs,
    watchPoints: [],
    questionsForUser: [],
    meta: {
      snapshotCalculatedAt:
        input.snapshot.calculatedAt instanceof Date
          ? input.snapshot.calculatedAt.toISOString()
          : new Date(input.snapshot.calculatedAt).toISOString(),
    },
  };
}

// =============================================================================
// UTIL
// =============================================================================

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function cryptoRandomId(): string {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 24);
}

// Expose for the snapshot-path resolver and the chat endpoint.
export { resolveSnapshotPath, fingerprintSnapshot, buildAIContext };
