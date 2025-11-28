/**
 * Phase 18: Bank Preview API
 * POST /api/bank/preview - Preview parsed bank statement before importing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { parseCSV, suggestColumnMappings, normaliseTransactions, countPotentialDuplicates } from '@/lib/bank';
import type { ParseOptions } from '@/lib/bank/types';

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const mappingsStr = formData.get('mappings') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
      }

      // Determine format
      const filename = file.name;
      const extension = filename.split('.').pop()?.toLowerCase();

      if (extension !== 'csv') {
        return NextResponse.json(
          { error: 'Preview currently only supports CSV files' },
          { status: 400 }
        );
      }

      // Read and parse file
      const content = await file.text();
      const fileHash = createHash('sha256').update(content).digest('hex');

      // Check if file was already imported
      const existingFile = await prisma.bankImportFile.findFirst({
        where: {
          userId,
          fileHash,
          status: 'COMPLETED',
        },
      });

      // Parse with provided mappings or auto-detect
      const mappings: ParseOptions | undefined = mappingsStr
        ? JSON.parse(mappingsStr)
        : undefined;

      const parsedFile = parseCSV(content, mappings);

      // Get suggested mappings if none provided
      const suggestedMappings = parsedFile.headers
        ? suggestColumnMappings(parsedFile.headers)
        : undefined;

      // Normalise to check for valid data
      const normalisationResult = normaliseTransactions(
        parsedFile.transactions,
        'preview',
        undefined
      );

      // Get existing transactions for duplicate preview
      const existingTransactions = await prisma.unifiedTransaction.findMany({
        where: { userId },
        select: {
          id: true,
          date: true,
          amount: true,
          description: true,
          direction: true,
          merchantStandardised: true,
        },
      });

      type ExistingTxType = (typeof existingTransactions)[number];
      const existingNormalised = existingTransactions.map((tx: ExistingTxType) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        rawDescription: tx.description,
        direction: tx.direction as 'IN' | 'OUT',
        sourceFileId: '',
        hash: createHash('sha256')
          .update(`${tx.date.toISOString().split('T')[0]}|${tx.amount.toFixed(2)}|${tx.description.substring(0, 50).toLowerCase().replace(/\s+/g, '')}`)
          .digest('hex'),
        merchantStandardised: tx.merchantStandardised ?? undefined,
      }));

      const duplicateCount = countPotentialDuplicates(
        normalisationResult.transactions,
        existingNormalised
      );

      // Calculate date range
      const validDates = normalisationResult.transactions
        .map(t => t.date)
        .filter(d => d);

      const dateRange = validDates.length > 0
        ? {
            from: new Date(Math.min(...validDates.map(d => d.getTime()))),
            to: new Date(Math.max(...validDates.map(d => d.getTime()))),
          }
        : undefined;

      // Calculate totals
      const totalCredit = normalisationResult.transactions
        .filter(t => t.direction === 'IN')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalDebit = normalisationResult.transactions
        .filter(t => t.direction === 'OUT')
        .reduce((sum, t) => sum + t.amount, 0);

      return NextResponse.json({
        filename,
        fileHash,
        format: 'CSV',
        alreadyImported: !!existingFile,
        existingFileId: existingFile?.id,
        headers: parsedFile.headers,
        suggestedMappings,
        metadata: parsedFile.metadata,
        statistics: {
          totalRows: parsedFile.totalRows,
          validTransactions: normalisationResult.statistics.normalised,
          invalidTransactions: normalisationResult.statistics.failed,
          potentialDuplicates: duplicateCount,
          totalCredit,
          totalDebit,
          netAmount: totalCredit - totalDebit,
        },
        dateRange,
        // Return first 50 transactions for preview
        preview: normalisationResult.transactions.slice(0, 50).map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          direction: t.direction,
          merchantStandardised: t.merchantStandardised,
        })),
        // Return first 10 errors for display
        errors: normalisationResult.errors.slice(0, 10),
      });
    } catch (error) {
      console.error('Preview error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Preview failed' },
        { status: 500 }
      );
    }
  });
}
