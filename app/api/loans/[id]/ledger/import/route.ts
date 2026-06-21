/**
 * Phase 51.1 — Loan-ledger statement import (build increment 2).
 *
 *   POST /api/loans/[id]/ledger/import   (multipart: file=<QIF/CSV>)
 *
 * Imports a loan's OWN statement into the quarantined `LoanTransaction` ledger.
 * Thin wrapper over `importLoanStatement()` (§12.3) — verifies loan ownership,
 * reads the upload, delegates, audits. The ledger never enters categorisation
 * or the spending view (see the service + Phase 51 doc).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { importLoanStatement } from '@/lib/bookkeeping/loanLedger/importLoanStatement';
import { createAuditLog } from '@/lib/security/auditLog';

// Parsing a large statement can exceed the 15s default.
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>('loan.write', async (request, auth, context) => {
  const { id: loanId } = await context!.params;

  // Ownership: only import into a loan the caller owns.
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId: auth.userId },
    select: { id: true, name: true },
  });
  if (!loan) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } },
      { status: 404 }
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Expected a multipart upload with a file' } },
      { status: 400 }
    );
  }
  if (!file) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_FILE', message: 'No file provided' } },
      { status: 400 }
    );
  }

  const content = await file.text();
  let result;
  try {
    result = await importLoanStatement({
      userId: auth.userId,
      loanId,
      fileName: file.name,
      content,
    });
  } catch {
    // Never leak parser internals to the client.
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_FAILED', message: 'Could not read that statement. Please upload a valid QIF or CSV.' } },
      { status: 422 }
    );
  }

  // Audit (fire-and-forget; never blocks the response). §12.5 — importing
  // creates ledger rows (state-changing). No CDR/financial detail in metadata.
  createAuditLog({
    userId: auth.userId,
    action: 'CREATE',
    entityType: 'LoanTransaction',
    entityId: loanId,
    metadata: { imported: result.imported, skipped: result.skipped, total: result.total },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: result });
});
