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

// Types defined locally to avoid dependency on Prisma client regeneration timing
type ExpenseCategory =
  | 'HOUSING' | 'RENT' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL'
  | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SUBSCRIPTION'
  | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'OTHER';

type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

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

    switch (action) {
      case 'CREATE_EXPENSE':
        entity = await createExpenseFromAnalysis(userId, analysis.document.id, data);
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
        entity = await linkDocumentToProperty(analysis.document.id, data);
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
// Entity Creation Functions
// ============================================================================

async function createExpenseFromAnalysis(
  userId: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
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

    // Map frequency
    const frequencyMap: Record<string, Frequency> = {
      WEEKLY: 'WEEKLY',
      FORTNIGHTLY: 'FORTNIGHTLY',
      MONTHLY: 'MONTHLY',
      QUARTERLY: 'QUARTERLY',
      ANNUAL: 'ANNUAL',
    };
    const frequencyStr = String(data.frequency || 'MONTHLY').toUpperCase();
    const frequency = frequencyMap[frequencyStr] || 'MONTHLY';

    const expense = await prisma.expense.create({
      data: {
        userId,
        name: String(data.vendor || data.name || 'Expense'),
        vendorName: data.vendor ? String(data.vendor) : null,
        amount: Number(data.amount) || 0,
        category,
        frequency,
        isTaxDeductible: Boolean(data.taxDeductible),
        isEssential: Boolean(data.isEssential ?? true),
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

    // Map frequency
    const frequencyMap: Record<string, Frequency> = {
      WEEKLY: 'WEEKLY',
      FORTNIGHTLY: 'FORTNIGHTLY',
      MONTHLY: 'MONTHLY',
      QUARTERLY: 'QUARTERLY',
      ANNUAL: 'ANNUAL',
    };
    const frequencyStr = String(data.frequency || 'MONTHLY').toUpperCase();
    const frequency = frequencyMap[frequencyStr] || 'MONTHLY';

    const income = await prisma.income.create({
      data: {
        userId,
        name: String(data.name || 'Income'),
        amount: Number(data.amount) || 0,
        type: incomeType,
        frequency,
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
    const loan = await prisma.loan.create({
      data: {
        userId,
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
  documentId: string,
  data: Record<string, unknown>
): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> {
  try {
    const propertyId = String(data.propertyId);

    // Create link
    await prisma.documentLink.create({
      data: {
        documentId,
        entityType: 'PROPERTY',
        entityId: propertyId,
      },
    });

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
