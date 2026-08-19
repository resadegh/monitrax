/**
 * Phase 26: Confirm Analysis Action API
 *
 * POST /api/documents/analyze/confirm
 * Confirms extracted data and creates the corresponding entity.
 *
 * This is the final step in the document intelligence flow:
 * 1. Upload document (Phase 25 DME)
 * 2. Analyze document (Phase 26 DIE)
 * 3. User reviews and confirms extracted data
 * 4. Create entity (this endpoint)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { SuggestedActionType } from '@/lib/documents/intelligence';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import {
  findReceiptMatches,
  linkReceiptToTransaction,
  type ReceiptMatchVerdict,
} from '@/lib/bookkeeping/receiptMatcher';
import {
  reconcileSuggestedAction,
  type ReconcileRecordType,
} from '@/lib/documents/intelligence/reconcile/reconcileSuggestedAction';
import { recordVendorEntityHint } from '@/lib/documents/intelligence/learnedRouting';
import { classifyIntake } from '@/lib/intake/classifyIntake';

// Types defined locally to avoid dependency on Prisma client regeneration timing
type ExpenseCategory =
  | 'HOUSING' | 'RENT' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL'
  | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SUBSCRIPTION'
  | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'OTHER';


type IncomeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';

// ============================================================================
// Types
// ============================================================================

interface ConfirmRequest {
  analysisId: string;
  action: SuggestedActionType;
  data: Record<string, unknown>;
  corrections?: Record<string, boolean>;  // Fields that were corrected by user
}

// ============================================================================
// POST /api/documents/analyze/confirm
// ============================================================================

export const POST = withPermission('report.export', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Parse request body
    const body: ConfirmRequest = await request.json();
    const { analysisId, action, data, corrections } = body;

    if (!analysisId || !action || !data) {
      return NextResponse.json(
        { success: false, error: 'analysisId, action, and data are required' },
        { status: 400 }
      );
    }

    // Verify analysis belongs to user's document
    const analysis = await prisma.documentAnalysis.findFirst({
      where: {
        id: analysisId,
        document: {
          userId,
        },
      },
      include: {
        document: true,
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Execute the action
    let entity: { type: string; id: string; data: Record<string, unknown> } | null = null;
    // Phase 42 PR3 — receipt match verdict (only populated for
    // CREATE_EXPENSE on a receipt). The flow is:
    //   1. Create the Expense (existing behaviour preserved)
    //   2. Attempt fuzzy match against existing UnifiedTransactions
    //   3a. AUTO_LINK → link the matched tx to the new Expense + set
    //       matchedDocumentId; no parallel RECEIPT row created
    //   3b. PICK_FROM → return the candidates so the UI can prompt
    //   3c. NO_MATCH → create a new RECEIPT-sourced UnifiedTransaction
    //       tied to the document + the new Expense
    let receiptMatch: ReceiptMatchVerdict | null = null;

    switch (action) {
      case 'CREATE_EXPENSE':
        entity = await createExpenseFromAnalysis(userId, analysis.document.id, data);
        // Skip receipt-matching when the expense was reconciled to an existing
        // one (D.2) — it already has its transaction; re-running would risk a
        // duplicate RECEIPT row.
        if (entity && entity.data?.duplicate !== true) {
          receiptMatch = await applyReceiptMatch(
            userId,
            analysis.document.id,
            entity.id,
            data
          );
        }
        break;

      case 'CREATE_INCOME':
        entity = await createIncomeFromAnalysis(userId, analysis.document.id, data);
        break;

      case 'CREATE_LOAN':
        entity = await createLoanFromAnalysis(userId, analysis.document.id, data);
        break;

      case 'UPDATE_LOAN':
        entity = await updateLoanFromAnalysis(userId, data);
        break;

      case 'LINK_TO_PROPERTY':
        entity = await linkDocumentToProperty(userId, analysis.document.id, data);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Action '${action}' is not yet supported` },
          { status: 400 }
        );
    }

    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Failed to create entity' },
        { status: 500 }
      );
    }

    // Update analysis record
    const correctedFields = corrections
      ? Object.keys(corrections).filter(k => corrections[k])
      : [];

    await prisma.documentAnalysis.update({
      where: { id: analysisId },
      data: {
        userVerified: true,
        verifiedAt: new Date(),
        verifiedData: data as object,
        userCorrectedFields: correctedFields,
        createdEntityType: entity.type,
        createdEntityId: entity.id,
      },
    });

    console.log('[API] Entity created from analysis:', {
      analysisId,
      entityType: entity.type,
      entityId: entity.id,
    });

    return NextResponse.json({
      success: true,
      entity,
      // Phase 50 D.2 — true when we linked the document to an EXISTING record
      // instead of creating a duplicate (the confirm UI can say "linked to your
      // existing <vendor> expense" rather than "created").
      reconciled: entity.data?.duplicate === true,
      // Phase 42 PR3 — only present for CREATE_EXPENSE on a receipt;
      // tells the client whether we auto-linked, want it to prompt,
      // or created a fresh RECEIPT-sourced tx.
      receiptMatch,
    });
  } catch (error) {
    console.error('[API] Confirm action error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm action',
      },
      { status: 500 }
    );
  }
});

// ============================================================================
// Phase 42 PR3 — Receipt → transaction reconciliation
// ============================================================================

/**
 * Apply the canonical receipt-match flow after a CREATE_EXPENSE confirm.
 *
 * Per Phase 42 spec §3 D-42-7 thresholds (lib/bookkeeping/receiptMatcher.ts):
 *   - AUTO_LINK (composite ≥ 0.95) → link matched tx to the new Expense
 *     + set tx.matchedDocumentId. NO new RECEIPT row created.
 *   - PICK_FROM (0.7-0.95) → return verdict; UI prompts user. No DB
 *     mutation here — the user-picker endpoint will be a follow-up
 *     (PR3.5) that POSTs the chosen tx id and runs the same link logic.
 *   - NO_MATCH (<0.7) → create a new UnifiedTransaction with
 *     source='RECEIPT' tied to the document + the new Expense. The
 *     existing receipt-style record stays as the canonical row for
 *     "this is the bookkeeping reality of this purchase."
 *
 * Returns the verdict so the caller can include it in the response.
 * Per CLAUDE.md §12.3 — the matcher is the single source of truth
 * for the threshold rules; this function is wiring, not duplication.
 */
async function applyReceiptMatch(
  userId: string,
  documentId: string,
  expenseId: string,
  data: Record<string, unknown>
): Promise<ReceiptMatchVerdict | null> {
  const amountRaw = Number(data.amount);
  const dateStr = typeof data.date === 'string' ? data.date : null;
  const vendor = typeof data.vendor === 'string' ? data.vendor : undefined;
  const accountId = typeof data.accountId === 'string' ? data.accountId : null;

  if (!Number.isFinite(amountRaw) || amountRaw === 0 || !dateStr) {
    // Not enough data to attempt a match — caller can still create the
    // Expense; we just don't surface a receiptMatch verdict.
    return null;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  const verdict = await findReceiptMatches(userId, {
    amount: Math.abs(amountRaw),
    date,
    vendor,
    accountId,
  });

  if (verdict.kind === 'AUTO_LINK') {
    // PR3.5 — shared link executor (SSOT with /api/bookkeeping/receipts/pick-match).
    await linkReceiptToTransaction({
      userId,
      transactionId: verdict.match.transaction.id,
      documentId,
      expenseId,
      source: 'AI',
    });
    return verdict;
  }

  if (verdict.kind === 'NO_MATCH') {
    // Synthesise a RECEIPT-sourced UnifiedTransaction so the receipt
    // exists in the canonical ledger even when no bank match was found.
    // The future Tax Pack export aggregates RECEIPT + bank rows into
    // one timeline.
    //
    // We need an Account to attach it to — receipts don't have one.
    // Use the user's Cash account (auto-created on first call). This
    // is a deliberate choice: cash receipts (paper) and bank-paid
    // receipts that didn't match a bank line both sit on Cash. The
    // user can re-attribute via the [id] PATCH route later.
    const { getOrCreateCashAccount } = await import('@/lib/bookkeeping/cashAccount');
    const cashAccount = await getOrCreateCashAccount(userId);
    const signedAmount = -Math.abs(amountRaw); // receipts are OUT spends
    await prisma.unifiedTransaction.create({
      data: {
        userId,
        accountId: cashAccount.id,
        date,
        amount: signedAmount,
        currency: 'AUD',
        direction: 'OUT',
        description: vendor ?? 'Receipt',
        merchantRaw: vendor ?? null,
        merchantStandardised: vendor ?? null,
        source: 'RECEIPT',
        expenseId,
        matchedDocumentId: documentId,
        userCorrectedCategory: false,
        processedAt: new Date(),
      },
    });
    return verdict;
  }

  // PICK_FROM — leave it to the UI; do not mutate.
  return verdict;
}

// ============================================================================
// Phase 50 D.2 — record reconciliation helpers
// ============================================================================

/** Link a document to an entity, ignoring the unique-constraint if already
 *  linked (the existing record may already carry this doc). */
async function linkDocIfMissing(
  documentId: string,
  entityType: 'EXPENSE' | 'INCOME' | 'LOAN' | 'PROPERTY',
  entityId: string,
): Promise<void> {
  await prisma.documentLink.createMany({
    data: [{ documentId, entityType, entityId }],
    skipDuplicates: true,
  });
}

/**
 * D.2: before a CREATE_* writes a new record, check whether the document's
 * action duplicates an existing one. If so, link the document to the existing
 * record and return it (flagged `duplicate`) so the confirm flow doesn't write a
 * second copy. Returns null when there's no duplicate (caller creates as normal).
 */
async function reconcileOrNull(
  userId: string,
  documentId: string,
  type: ReconcileRecordType,
  data: Record<string, unknown>,
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  const verdict = await reconcileSuggestedAction(userId, type, data);
  if (!verdict.duplicate || !verdict.existingId) return null;
  await linkDocIfMissing(documentId, type, verdict.existingId);
  console.log('[Confirm] D.2 reconcile — linked document to existing', type, verdict.existingId);
  return {
    type,
    id: verdict.existingId,
    data: { id: verdict.existingId, duplicate: true },
  };
}

// ============================================================================
// Entity Creation Functions
// ============================================================================

async function createExpenseFromAnalysis(
  userId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
    // D.2: reuse an existing matching expense instead of creating a duplicate.
    const reconciled = await reconcileOrNull(userId, documentId, 'EXPENSE', data);
    if (reconciled) return reconciled;

    // Map category string to enum
    const categoryMap: Record<string, ExpenseCategory> = {
      HOUSING: 'HOUSING',
      RATES: 'RATES',
      INSURANCE: 'INSURANCE',
      MAINTENANCE: 'MAINTENANCE',
      PERSONAL: 'PERSONAL',
      UTILITIES: 'UTILITIES',
      FOOD: 'FOOD',
      TRANSPORT: 'TRANSPORT',
      ENTERTAINMENT: 'ENTERTAINMENT',
      STRATA: 'STRATA',
      LAND_TAX: 'LAND_TAX',
      LOAN_INTEREST: 'LOAN_INTEREST',
      REGISTRATION: 'REGISTRATION',
      MODIFICATIONS: 'MODIFICATIONS',
      OTHER: 'OTHER',
    };

    const categoryStr = String(data.category || 'OTHER').toUpperCase();
    const category = categoryMap[categoryStr] || 'OTHER';

    // MON-078: cadence + recurrence via the ONE intake classifier — the
    // legacy monthly fallback for imports lives there (named), not here.
    // (MON-037 RC-B: a one-off invoice must be expressible as one-off, not
    // silently minted as recurring-MONTHLY — the ×12 class.)
    const intake = classifyIntake({
      kind: 'expense',
      source: 'DOCUMENT_IMPORT',
      declaredFrequency: data.frequency ? String(data.frequency) : null,
      declaredIsRecurring: data.isRecurring != null ? Boolean(data.isRecurring) : null,
    });

    const ownerEntityId = await getDefaultLegalEntityId(userId);
    const expense = await prisma.expense.create({
      data: {
        userId,
        ownerEntityId,
        name: String(data.vendor || data.name || 'Expense'),
        vendorName: data.vendor ? String(data.vendor) : null,
        amount: Number(data.amount) || 0,
        category,
        frequency: intake.frequency,
        isTaxDeductible: Boolean(data.taxDeductible),
        isEssential: Boolean(data.isEssential ?? true),
        isRecurring: intake.isRecurring,
        propertyId: data.propertyId ? String(data.propertyId) : null,
        loanId: data.loanId ? String(data.loanId) : null,
      },
    });

    // Link document to expense
    await prisma.documentLink.create({
      data: {
        documentId,
        entityType: 'EXPENSE',
        entityId: expense.id,
      },
    });

    // M2.6 #16: when the expense is attributed to a property, the receipt
    // must ALSO surface in that property's Documents section — the global
    // scan / SmartInbox path previously linked the EXPENSE only, so the
    // evidence never appeared on the property (the auto-link engine that
    // would have added it, resolveAutoLinks, has no callers).
    if (expense.propertyId) {
      await linkDocIfMissing(documentId, 'PROPERTY', expense.propertyId);
    }

    // Phase 50 D.4 — learn the vendor→asset/property/loan routing (suggest-only)
    // when the user attributed this expense to one. Fire-and-forget.
    const vendor = data.vendor ?? data.name;
    if (data.propertyId) void recordVendorEntityHint(userId, vendor, 'PROPERTY', String(data.propertyId));
    if (data.loanId) void recordVendorEntityHint(userId, vendor, 'LOAN', String(data.loanId));
    if (data.assetId) void recordVendorEntityHint(userId, vendor, 'ASSET', String(data.assetId));

    return {
      type: 'EXPENSE',
      id: expense.id,
      data: expense as unknown as Record<string, unknown>,
    };
  } catch (error) {
    console.error('[Confirm] Create expense error:', error);
    return null;
  }
}

async function createIncomeFromAnalysis(
  userId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
    // D.2: reuse an existing matching income instead of creating a duplicate.
    const reconciled = await reconcileOrNull(userId, documentId, 'INCOME', data);
    if (reconciled) return reconciled;

    // Map income type
    const typeMap: Record<string, IncomeType> = {
      SALARY: 'SALARY',
      RENT: 'RENT',
      RENTAL: 'RENTAL',
      INVESTMENT: 'INVESTMENT',
      OTHER: 'OTHER',
    };
    const typeStr = String(data.type || 'OTHER').toUpperCase();
    const incomeType = typeMap[typeStr] || 'OTHER';

    // MON-078: cadence + recurrence via the ONE intake classifier (MON-053:
    // the analyzer's explicit one-off flag wins; the legacy import fallback
    // lives in the classifier, named, until C1/C2 tighten it).
    const intake = classifyIntake({
      kind: 'income',
      source: 'DOCUMENT_IMPORT',
      declaredFrequency: data.frequency ? String(data.frequency) : null,
      declaredIsRecurring: data.isRecurring != null ? Boolean(data.isRecurring) : null,
    });

    const ownerEntityId = await getDefaultLegalEntityId(userId);
    const income = await prisma.income.create({
      data: {
        userId,
        ownerEntityId,
        name: String(data.name || 'Income'),
        amount: Number(data.amount) || 0,
        type: incomeType,
        frequency: intake.frequency,
        isRecurring: intake.isRecurring, // MON-053
        isTaxable: Boolean(data.isTaxable ?? true),
        propertyId: data.propertyId ? String(data.propertyId) : null,
      },
    });

    // Link document to income
    await prisma.documentLink.create({
      data: {
        documentId,
        entityType: 'INCOME',
        entityId: income.id,
      },
    });

    return {
      type: 'INCOME',
      id: income.id,
      data: income as unknown as Record<string, unknown>,
    };
  } catch (error) {
    console.error('[Confirm] Create income error:', error);
    return null;
  }
}

async function createLoanFromAnalysis(
  userId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
    // D.2: reuse an existing matching loan instead of creating a duplicate.
    const reconciled = await reconcileOrNull(userId, documentId, 'LOAN', data);
    if (reconciled) return reconciled;

    const ownerEntityId = await getDefaultLegalEntityId(userId);
    const loan = await prisma.loan.create({
      data: {
        userId,
        ownerEntityId,
        name: String(data.name || 'Loan'),
        type: data.loanType === 'INVESTMENT_LOAN' ? 'INVESTMENT' : 'HOME',
        principal: Number(data.principal) || 0,
        interestRateAnnual: Number(data.interestRate) || 0.05,
        rateType: data.rateType === 'FIXED' ? 'FIXED' : 'VARIABLE',
        termMonthsRemaining: Number(data.termMonths) || 360,
        minRepayment: Number(data.repaymentAmount) || 0,
        repaymentFrequency: 'MONTHLY',
        isInterestOnly: data.repaymentType === 'INTEREST_ONLY',
        propertyId: data.propertyId ? String(data.propertyId) : null,
      },
    });

    // Link document to loan
    await prisma.documentLink.create({
      data: {
        documentId,
        entityType: 'LOAN',
        entityId: loan.id,
      },
    });

    return {
      type: 'LOAN',
      id: loan.id,
      data: loan as unknown as Record<string, unknown>,
    };
  } catch (error) {
    console.error('[Confirm] Create loan error:', error);
    return null;
  }
}

async function updateLoanFromAnalysis(
  userId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
    const loanId = String(data.loanId);

    // Verify loan belongs to user
    const existing = await prisma.loan.findFirst({
      where: { id: loanId, userId },
    });

    if (!existing) {
      return null;
    }

    const loan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        principal: data.principal ? Number(data.principal) : undefined,
        interestRateAnnual: data.interestRate ? Number(data.interestRate) : undefined,
      },
    });

    return {
      type: 'LOAN',
      id: loan.id,
      data: loan as unknown as Record<string, unknown>,
    };
  } catch (error) {
    console.error('[Confirm] Update loan error:', error);
    return null;
  }
}

async function linkDocumentToProperty(
  userId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
    const propertyId = String(data.propertyId);

    // Create link (M2.6 #42: idempotent — a repeat confirm previously hit
    // the unique constraint and surfaced a failure for an already-correct
    // state; linkDocIfMissing uses skipDuplicates).
    await linkDocIfMissing(documentId, 'PROPERTY', propertyId);

    // Phase 50 D.4 — learn vendor→property routing (suggest-only).
    void recordVendorEntityHint(userId, data.vendor ?? data.name, 'PROPERTY', propertyId);

    return {
      type: 'DOCUMENT_LINK',
      id: documentId,
      data: { propertyId },
    };
  } catch (error) {
    console.error('[Confirm] Link to property error:', error);
    return null;
  }
}
