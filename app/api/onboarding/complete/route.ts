import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import type { Frequency } from '@prisma/client';

/**
 * POST /api/onboarding/complete — the end-of-wizard finaliser.
 *
 * Phase 12 Track G.3b (2026-05-21): this route absorbs the cross-domain
 * wiring that used to live at the tail of `/api/onboarding/bulk-create`.
 * Those four things genuinely cannot be done by a single wizard step —
 * they need data from two domains at once — so they belong in the
 * end-of-wizard finaliser, not in a per-step `*Sync` layer:
 *
 *   1. Onboarding completion + `User.onboardingProfileType`.
 *   2. BASIQ/IMPORT offset account → loan link (`Loan.offsetAccountId`).
 *   3. CAR loan → vehicle Asset link (`Loan.linkedAssetId`).
 *   4. INVESTMENT-type income (links to an `InvestmentAccount`).
 *
 * The completion write is the CRITICAL path — it must succeed. The
 * cross-domain wiring is BEST-EFFORT: a cosmetic link failure must never
 * block a user from finishing onboarding (strictly safer than
 * `bulk-create`'s old all-or-nothing transaction). Called with no body
 * (e.g. a dashboard re-entry) it simply marks completion.
 *
 * Once G.3c lands, `bulk-create` is deleted and this is the sole
 * end-of-wizard write.
 */

interface FinaliseAccount {
  source?: unknown;
  type?: unknown;
  linkedLoanId?: unknown;
  existingAccountId?: unknown;
}
interface FinaliseDebt {
  type?: unknown;
  id?: unknown;
  linkedAssetId?: unknown;
}
interface FinaliseIncome {
  type?: unknown;
  amount?: unknown;
  name?: unknown;
  frequency?: unknown;
}
interface FinaliseInvestment {
  id?: unknown;
}
interface FinaliseBody {
  profileType?: unknown;
  accounts?: unknown;
  debts?: unknown;
  income?: unknown;
  investments?: unknown;
}

const VALID_PROFILE_TYPES = ['HOMEOWNER', 'INVESTOR', 'MIXED', 'STARTER'] as const;
type ProfileType = (typeof VALID_PROFILE_TYPES)[number];

/** A real DB id — the wizard mints synthetic `temp_…` / `chat-…` ids. */
function isRealId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    !id.startsWith('temp_') &&
    !id.startsWith('chat-')
  );
}

export const POST = withPermission('settings.write', async (request, auth) => {
  try {
    const userId = auth.userId;
    const body = (await request.json().catch(() => ({}))) as FinaliseBody;

    const profileType: ProfileType | null =
      typeof body.profileType === 'string' &&
      (VALID_PROFILE_TYPES as readonly string[]).includes(body.profileType)
        ? (body.profileType as ProfileType)
        : null;

    // --- Critical path — mark onboarding complete ----------------------
    await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingStep: 7,
        onboardingProfileType: profileType,
      },
    });
    await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, dismissedWelcomeModal: true },
      update: { dismissedWelcomeModal: true },
    });

    // --- Best-effort cross-domain wiring (Track G.3b) ------------------
    // A failure here must NEVER block completion — log + continue.
    await wireCrossDomainLinks(userId, body).catch((e) => {
      console.error('Onboarding finalise — cross-domain wiring failed:', e);
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        onboardingProfileType: true,
        onboardingStep: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: user,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
});

/**
 * The four cross-domain wirings relocated from `bulk-create`. Each is
 * ownership-guarded (`where: { …, userId }`). Best-effort by design — the
 * caller wraps this in `.catch()` so completion is never blocked.
 */
async function wireCrossDomainLinks(
  userId: string,
  body: FinaliseBody,
): Promise<void> {
  const accounts: FinaliseAccount[] = Array.isArray(body.accounts)
    ? body.accounts
    : [];
  const debts: FinaliseDebt[] = Array.isArray(body.debts) ? body.debts : [];
  const income: FinaliseIncome[] = Array.isArray(body.income) ? body.income : [];
  const investments: FinaliseInvestment[] = Array.isArray(body.investments)
    ? body.investments
    : [];

  // 1. BASIQ/IMPORT offset account → loan link. (MANUAL offset links are
  //    wired server-side by `/api/accounts` — Track F.3 — so only the
  //    externally-sourced accounts need wiring here.)
  for (const acc of accounts) {
    if (acc.source !== 'BASIQ' && acc.source !== 'IMPORT') continue;
    if (acc.type !== 'OFFSET') continue;
    if (
      typeof acc.linkedLoanId !== 'string' ||
      typeof acc.existingAccountId !== 'string'
    ) {
      continue;
    }
    const loan = await prisma.loan.findFirst({
      where: { id: acc.linkedLoanId, userId },
      select: { id: true },
    });
    if (loan) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { offsetAccountId: acc.existingAccountId },
      });
    }
  }

  // 2. CAR loan → vehicle Asset link. Both rows are real by now (the
  //    Debts step created the loan, the Assets step the vehicle).
  for (const debt of debts) {
    if (debt.type !== 'CAR') continue;
    if (!isRealId(debt.id) || !isRealId(debt.linkedAssetId)) continue;
    const [loan, asset] = await Promise.all([
      prisma.loan.findFirst({
        where: { id: debt.id, userId },
        select: { id: true },
      }),
      prisma.asset.findFirst({
        where: { id: debt.linkedAssetId, userId },
        select: { id: true },
      }),
    ]);
    if (loan && asset) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { linkedAssetId: asset.id },
      });
    }
  }

  // 3. INVESTMENT-type income — not GENERAL income, so the income step's
  //    F.8 sync does not own it; it links to an InvestmentAccount.
  const investmentIncome = income.filter(
    (inc) =>
      inc.type === 'INVESTMENT' &&
      typeof inc.amount === 'number' &&
      inc.amount > 0,
  );
  if (investmentIncome.length > 0) {
    const firstInvestmentAccountId =
      investments
        .map((inv) => inv.id)
        .find((id): id is string => isRealId(id)) ?? null;
    const ownerEntityId = await getDefaultLegalEntityId(userId);
    for (const inc of investmentIncome) {
      await prisma.income.create({
        data: {
          userId,
          ownerEntityId,
          name:
            (typeof inc.name === 'string' && inc.name.trim()) ||
            'Investment income',
          type: 'INVESTMENT',
          sourceType: 'INVESTMENT',
          investmentAccountId: firstInvestmentAccountId,
          amount: inc.amount as number,
          frequency: inc.frequency as Frequency,
        },
      });
    }
  }
}
