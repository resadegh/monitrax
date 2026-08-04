/**
 * Phase 40 — POST /api/cfo/advice/chat
 *
 * Follow-up Q&A scoped to the user's active AI Advice document. The AI
 * sees the same sanitised snapshot context that drove the original
 * advice + the prior chat turns, and is bound by the same anti-hallucination
 * rules: it may narrate qualitatively but MUST cite numbers via
 * snapshotPath references which the UI hydrates from the actual snapshot.
 *
 * Chat history is persisted alongside the advice doc and cascade-deletes
 * with it (so chat lifetime = 24h advice cache lifetime). This is what
 * gives the user "today's conversation persists, but doesn't accumulate
 * indefinitely".
 *
 * Auth: requires `report.read` permission.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { generateGeminiTextCompletion } from '@/lib/ai/google/geminiClient';
import { GEMINI_MODELS } from '@/lib/ai/google/modelConfig';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { generateOrFetchAdvice, type AIAdviceDocument } from '@/lib/cfo';
import { buildAIContext } from '@/lib/cfo/aiAdvisor';
import { determineTrailStage } from '@/lib/cfo/trailStage';
import { computeCFOComponents, scanForRisks, generateActions } from '@/lib/cfo';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { groundNarrative } from '@/lib/neobrain/verifyNarrativeFigures';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

const CHAT_SYSTEM_PROMPT = `You are the Personal CFO inside Monitrax,
continuing an interactive conversation with the user about their advice
document. You have access to the same structured <context> JSON that
generated the advice, plus the prior chat turns and the
<advice> document itself.

# Hard rules

- Stay focused on the user's financial picture. Decline gracefully if
  asked something off-topic.
- NEVER invent numbers. If you need a precise figure, refer the user to a
  scenario they can run via the "Run scenario" button on the relevant
  recommendation, or describe the figure qualitatively ("a meaningful
  reduction", "a small amount").
- Reference numbers from <context> by quoting the path, e.g. "your
  monthly cashflow (cashflow.monthlyCashflow)" — do NOT type the dollar
  amount yourself. The UI will replace the path with the real value.
- Keep replies short (≤ 4 short paragraphs). Be warm, direct, and
  practical. End with one clear next step or one clarifying question.
- If the user asks "what happens if I sell X / pay extra on Y / etc",
  point them at the suggestedScenario already in the advice doc, OR
  describe what scenario type they should run.
`;

interface ChatBody {
  message?: string;
}

export const POST = withPermission('report.read', async (request: NextRequest, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO');
    if (gateBlocked) return gateBlocked;
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Body must be JSON.' } },
      { status: 400 }
    );
  }

  const userMessage = (body.message ?? '').trim();
  if (!userMessage) {
    return NextResponse.json(
      { success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message is required.' } },
      { status: 400 }
    );
  }
  if (userMessage.length > 2000) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'MESSAGE_TOO_LONG', message: 'Message must be 2000 characters or fewer.' },
      },
      { status: 400 }
    );
  }

  try {
    // Fetch (or generate) the advice doc — chat is scoped to it.
    const advice: AIAdviceDocument = await generateOrFetchAdvice({ userId: auth.userId });

    // Load prior chat turns (oldest first) so the AI has conversational context.
    const prior = await prisma.aIAdviceChatMessage.findMany({
      where: { adviceId: advice.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Persist the user turn first so it survives even if the AI call fails.
    await prisma.aIAdviceChatMessage.create({
      data: {
        adviceId: advice.id,
        role: 'user',
        content: userMessage,
      },
    });

    // Reconstruct the context document the original advice was grounded in.
    const snapshot = await getMasterFinancialSnapshot(auth.userId);
    const trailStage = determineTrailStage({
      hasAccounts: snapshot.counts.accounts > 0,
      monthlyCashflow: snapshot.quickMetrics.monthlyCashflow,
      emergencyFundMonths: snapshot.emergencyFund.monthsCovered,
      hasInvestments: snapshot.counts.investments > 0,
      healthScore: snapshot.healthScore.score,
    });
    const [cfoComponents, risks] = await Promise.all([
      computeCFOComponents(auth.userId), // MON-030 2b: advisor action-signals (not a score)
      scanForRisks(auth.userId),
    ]);
    const ruleActionsResult = await generateActions(auth.userId, risks.risks, cfoComponents);
    const ruleActions = [
      ...ruleActionsResult.doNow,
      ...ruleActionsResult.upcoming,
      ...ruleActionsResult.considerSoon,
      ...ruleActionsResult.background,
    ];
    const { context } = buildAIContext(snapshot, trailStage, ruleActions, []);

    const transcript = prior
      .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
      .join('\n\n');

    const userPrompt = [
      `<context>\n${JSON.stringify(context, null, 2)}\n</context>`,
      `<advice>\n${JSON.stringify(
        {
          situationAssessment: advice.situationAssessment,
          headlineAdvice: advice.headlineAdvice,
          recommendations: advice.recommendations.map((r) => ({
            id: r.id,
            title: r.title,
            reasoning: r.reasoning,
            steps: r.steps,
            suggestedScenario: r.suggestedScenario,
          })),
          watchPoints: advice.watchPoints,
        },
        null,
        2
      )}\n</advice>`,
      transcript ? `<transcript>\n${transcript}\n</transcript>` : '',
      `USER: ${userMessage}\nASSISTANT:`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await generateGeminiTextCompletion({
      surface: 'cfo-advisor',
      model: GEMINI_MODELS.FINANCIAL_ADVISOR, // Flash for follow-up — cheap + fast
      systemPrompt: CHAT_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.4,
      maxTokens: 1024,
    });

    // Neobrain grounding (Phase C): the chat reply is free text, so verify its
    // $/% figures against the user's real snapshot numbers (+ safe derivations)
    // and redact + note any that don't trace — the user never reads an invented
    // number even though the model is told not to produce one.
    const qm = snapshot.quickMetrics;
    const backedAmounts = [
      qm.netWorthValue,
      qm.totalAssets,
      qm.totalLiabilities,
      qm.monthlyIncome,
      qm.monthlyExpenses,
      qm.monthlyCashflow,
      qm.monthlyLoanRepayments,
      qm.liquidCash,
    ];
    const backedPercents =
      qm.monthlyIncome > 0
        ? [(qm.monthlyCashflow / qm.monthlyIncome) * 100, (qm.monthlyExpenses / qm.monthlyIncome) * 100]
        : [];
    const groundedText = groundNarrative(result.text, backedAmounts, backedPercents).text;

    // Persist the assistant turn.
    const assistantTurn = await prisma.aIAdviceChatMessage.create({
      data: {
        adviceId: advice.id,
        role: 'assistant',
        content: groundedText,
      },
    });

    createAuditLog({
      userId: auth.userId,
      action: 'AI_ADVICE_CHAT',
      entityType: 'AIAdviceDocument',
      entityId: advice.id,
      metadata: sanitizeCdrMetadata({
        priorTurnCount: prior.length,
        userMessageLength: userMessage.length,
        assistantMessageLength: groundedText.length,
        model: result.usage.model,
        tokensUsed: result.usage.totalTokens,
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        adviceId: advice.id,
        message: {
          id: assistantTurn.id,
          role: 'assistant',
          content: groundedText,
          createdAt: assistantTurn.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[/api/cfo/advice/chat] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CHAT_FAILED', message: 'Could not send the message right now.' },
      },
      { status: 500 }
    );
  }
});

// GET — return chat history for the user's active advice doc (for
// page-load hydration).
export const GET = withPermission('report.read', async (_request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO');
    if (gateBlocked) return gateBlocked;
  try {
    const advice = await prisma.aIAdviceDocument.findFirst({
      where: { userId: auth.userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: {
        chatMessages: { orderBy: { createdAt: 'asc' }, take: 50 },
      },
    });
    if (!advice) {
      return NextResponse.json({ success: true, data: { adviceId: null, messages: [] } });
    }
    return NextResponse.json({
      success: true,
      data: {
        adviceId: advice.id,
        messages: advice.chatMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[/api/cfo/advice/chat GET] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CHAT_HISTORY_FAILED', message: 'Could not load chat history.' },
      },
      { status: 500 }
    );
  }
});
