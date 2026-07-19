import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractIncomeLinks, wrapWithGRDCS } from '@/lib/grdcs';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { classifyIntake } from '@/lib/intake/classifyIntake';
import { detectCadenceMismatch, detectOneOffFingerprint, detectRentGap } from '@/lib/intake/detectors';

export const GET = withPermission('income.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Fetch income entries and linked transactions in parallel
      const [income, linkedTransactions, derivedExpenseLinks] = await Promise.all([
        prisma.income.findMany({
          where: { userId },
          include: { property: true, investmentAccount: true },
          orderBy: { createdAt: 'desc' },
        }),
        // Phase 30: Fetch ALL linked transactions (not just current month) to show actuals
        prisma.unifiedTransaction.findMany({
          where: {
            userId,
            incomeId: { not: null },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            incomeId: true,
          },
          orderBy: { date: 'desc' },
        }),
        // Phase 59 (D4): streams that already have a derived agent-cost
        // expense — the rent-gap detector never nags a captured stream.
        prisma.expense.findMany({
          where: { userId, derived: true, derivedFromIncomeId: { not: null } },
          select: { derivedFromIncomeId: true },
        }),
      ]);

      const streamsWithAgentCosts = new Set(
        derivedExpenseLinks.map((e: { derivedFromIncomeId: string | null }) => e.derivedFromIncomeId),
      );

      // Group transactions by incomeId and calculate totals
      // Also track current month vs all-time for display
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const actualsByIncomeId = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        currentMonthCount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of linkedTransactions) {
        if (tx.incomeId) {
          const existing = actualsByIncomeId.get(tx.incomeId) || {
            totalAmount: 0,
            totalCount: 0,
            currentMonthAmount: 0,
            currentMonthCount: 0,
            transactions: [],
          };
          const txAmount = Math.abs(tx.amount);
          const txDate = new Date(tx.date);

          existing.totalAmount += txAmount;
          existing.totalCount += 1;
          existing.transactions.push({ date: txDate, amount: txAmount });

          // Track current month separately
          if (txDate >= currentMonthStart) {
            existing.currentMonthAmount += txAmount;
            existing.currentMonthCount += 1;
          }

          actualsByIncomeId.set(tx.incomeId, existing);
        }
      }

      // Apply GRDCS wrapper to each income and add actuals
      const incomeWithLinks = income.map((inc: typeof income[number]) => {
        const links = extractIncomeLinks(inc);
        const wrapped = wrapWithGRDCS(inc as Record<string, unknown>, 'income', links);

        // Phase 30: Add actual from transactions
        const actuals = actualsByIncomeId.get(inc.id);

        // Calculate monthly average from transactions using DAYS-BASED approach
        // This provides accurate averages regardless of how payments fall across calendar months
        // Formula: (sum / totalDaysCovered) * 30.44 = monthly average
        //
        // Payment timing matters:
        // - ADVANCE (rent): Last payment covers future period, exclude from average
        // - ARREARS (salary, etc.): All payments cover completed periods, include all
        let monthlyAverage = null;
        if (actuals && actuals.transactions.length >= 2) {
          const sortedTx = actuals.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

          // Determine payment timing based on income type
          // RENTAL income is typically paid in ADVANCE
          const isRentalIncome = inc.type === 'RENTAL' || inc.type === 'RENT' || inc.propertyId;
          const paymentTiming = isRentalIncome ? 'ADVANCE' : 'ARREARS';

          if (paymentTiming === 'ADVANCE') {
            // For ADVANCE payments (rent): exclude last payment (covers future period)
            // Calculate days-based average for accurate monthly figure
            const completedPayments = sortedTx.slice(0, -1); // Exclude last payment
            if (completedPayments.length >= 1) {
              const sumForAverage = completedPayments.reduce((sum, tx) => sum + tx.amount, 0);
              const firstDate = completedPayments[0].date;
              const lastCompletedDate = completedPayments[completedPayments.length - 1].date;

              if (completedPayments.length === 1) {
                // Single completed payment - assume it represents one month
                monthlyAverage = sumForAverage;
              } else {
                // Multiple payments: calculate based on actual days
                const daysSpan = Math.max(1, (lastCompletedDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

                // Calculate average payment interval to account for period covered by last completed payment
                const avgPaymentInterval = daysSpan / (completedPayments.length - 1);

                // Total days covered = span + one interval (for period the last completed payment covers)
                const totalDaysCovered = daysSpan + avgPaymentInterval;

                // Monthly average = (sum / days) * 30.44 (average days per month)
                monthlyAverage = (sumForAverage / totalDaysCovered) * 30.44;
              }
            }
          } else {
            // For ARREARS payments (salary, etc.): include all payments
            // Calculate based on actual date range covered
            const firstDate = sortedTx[0].date;
            const lastDate = sortedTx[sortedTx.length - 1].date;
            const daysCovered = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

            // Monthly average = (sum / days) * 30.44
            if (daysCovered > 0) {
              monthlyAverage = (actuals.totalAmount / daysCovered) * 30.44;
            }
          }
        }

        return {
          ...wrapped,
          // Budget = entry.amount (what user entered)
          budgetAmount: inc.amount,
          // D2 (MON-001): flag when the STORED cadence disagrees with the
          // cadence this row's own transactions imply (e.g. weekly rent
          // stored MONTHLY → ~4.3× understated). Nudge only — the user
          // reviews and edits; nothing is auto-changed.
          cadenceMismatch: actuals
            ? detectCadenceMismatch({
                frequency: inc.frequency,
                isRecurring: inc.isRecurring,
                transactionDates: actuals.transactions.map((t) => t.date),
              })
            : null,
          // D1 (MON-075): a "recurring" row whose whole evidence is ONE
          // transaction with $0 this month — the one-off fingerprint
          // (MON-053 class). Review nudge; the user decides.
          oneOffFingerprint: actuals
            ? detectOneOffFingerprint({
                isRecurring: inc.isRecurring,
                transactionCount: actuals.totalCount,
                inWindowActual: actuals.currentMonthAmount,
              })
            : null,
          // D4 (Phase 59 / MON-079): rental deposits materially below the
          // declared gross with no agent-cost expense captured — "you may be
          // missing management-fee deductions — upload your rental statement."
          // Nudge only; the confirm flow records the deduction.
          rentGap: actuals
            ? detectRentGap({
                incomeType: inc.type,
                isRecurring: inc.isRecurring,
                declaredAmount: inc.amount,
                declaredFrequency: inc.frequency,
                transactions: actuals.transactions,
                hasAgentCostExpense: streamsWithAgentCosts.has(inc.id),
              })
            : null,
          // Actual = total from ALL linked transactions
          actualFromTransactions: actuals ? actuals.totalAmount : null,
          // Current month actual
          currentMonthActual: actuals ? actuals.currentMonthAmount : null,
          // Monthly average calculated from transaction history
          monthlyAverageActual: monthlyAverage ? Math.round(monthlyAverage * 100) / 100 : null,
          transactionCount: actuals ? actuals.totalCount : 0,
          currentMonthTransactionCount: actuals ? actuals.currentMonthCount : 0,
          hasTransactions: actuals !== undefined && actuals.totalCount > 0,
        };
      });

      return NextResponse.json({
        data: incomeWithLinks,
        _meta: {
          count: incomeWithLinks.length,
          totalLinkedEntities: incomeWithLinks.reduce((sum: number, i: { _meta: { linkedCount: number } }) => sum + i._meta.linkedCount, 0),
          currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
        },
      });
    } catch (error) {
      console.error('Get income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const POST = withPermission('income.write', async (request, auth) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        amount,
        frequency,
        isRecurring, // MON-053: false = one-off receipt, counted once (never ×frequency)
        isTaxable,
        propertyId,
        investmentAccountId,
        sourceType,
        // Phase 59: managed rentals — amount/frequency stay the DECLARED GROSS;
        // MANAGED marks the stream as agent-disbursed (net credits reconcile
        // against gross via reconcileManagedRental).
        rentalMode,
        managingAgentName,
        // Phase 20: Salary-specific fields
        salaryType,
        payFrequency,
        grossAmount,
        netAmount,
        paygWithholding,
        superGuaranteeRate,
        superGuaranteeAmount,
        salarySacrifice,
        // Phase 20: Investment-specific fields
        frankingPercentage,
        frankingCredits,
      } = body;

      if (!name || !type || amount === undefined || !frequency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Validate ownership of related entities using centralized utility
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, auth.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, auth.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      // Helper to safely convert to number
      const toNumber = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      };

      // Helper to convert Frequency enum to PayFrequency enum (ANNUAL -> ANNUALLY)
      // PayFrequency values: WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, ANNUALLY
      const toPayFrequency = (freq: string | undefined | null): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY' | null => {
        if (freq === undefined || freq === null) return null;
        // Map ANNUAL to ANNUALLY (Frequency uses ANNUAL, PayFrequency uses ANNUALLY)
        const mapped = freq === 'ANNUAL' ? 'ANNUALLY' : freq;
        // Validate it's a valid PayFrequency value
        const validPayFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'HALF_YEARLY'] as const;
        if (validPayFrequencies.includes(mapped as typeof validPayFrequencies[number])) {
          return mapped as typeof validPayFrequencies[number];
        }
        return null;
      };

      const ownerEntityId = await getDefaultLegalEntityId(auth.userId);

      // MON-078: frequency + recurrence are decided by the ONE intake
      // classifier — never defaulted locally (intake source-lock enforced).
      const intake = classifyIntake({
        kind: 'income',
        source: 'MANUAL',
        declaredFrequency: frequency,
        declaredIsRecurring: isRecurring !== undefined ? Boolean(isRecurring) : null, // MON-053
      });

      // Mechanism A (MON-084/076): manual creation CONVERGES on the source
      // signature instead of minting a sibling row.
      //
      // 1) Property rental (RENT/RENTAL + propertyId): the scope IS the stream
      //    (MON-009 scope-singleton). This route is the wizard's SSOT write
      //    boundary for rental income — declaring "this property's rent" when
      //    a stream already exists UPDATES that stream's declared fields
      //    (amount/frequency/recurrence/rentalMode), never mints a second
      //    row. The existing row's name is preserved (it may carry the
      //    reconciled payer identity).
      const isRentalCreate = (type === 'RENT' || type === 'RENTAL') && propertyId;
      if (isRentalCreate) {
        const rentalScopeRows = await prisma.income.findMany({
          where: { userId: auth.userId, propertyId, type: { in: ['RENT', 'RENTAL'] } },
          orderBy: { createdAt: 'asc' },
        });
        const rentalMatch = classifyIntake({
          kind: 'income',
          source: 'MANUAL',
          declaredFrequency: frequency,
          streamPolicy: 'scope-singleton',
          existingRows: rentalScopeRows.map((r: { id: string; name: string; amount: number }) => ({
            id: r.id, name: r.name, amount: r.amount,
          })),
        }).streamMatch;
        if (rentalMatch) {
          const updated = await prisma.income.update({
            where: { id: rentalMatch.id },
            data: {
              amount: toNumber(amount) ?? 0,
              frequency: intake.frequency,
              isRecurring: intake.isRecurring,
              isTaxable: isTaxable !== undefined ? Boolean(isTaxable) : true,
              rentalMode: rentalMode === 'MANAGED' ? 'MANAGED' : 'DIRECT',
              managingAgentName:
                rentalMode === 'MANAGED' && typeof managingAgentName === 'string' && managingAgentName.trim()
                  ? managingAgentName.trim()
                  : null,
            },
            include: { property: true, investmentAccount: true },
          });
          void createAuditLog({
            userId: auth.userId,
            action: 'UPDATE',
            entityType: 'INCOME',
            entityId: updated.id,
            metadata: sanitizeCdrMetadata({ convergedBy: 'mechanism-a-rental-scope-singleton' }),
          }).catch(() => {});
          return NextResponse.json({ data: updated, converged: true });
        }
      }

      // 2) Everything else: an EXACT normalised-name match on the signature
      //    (type + ownerEntity + compatible scope) is the SAME source — a
      //    second row would be the Ingeus-×3 class. Surfaced as 409 with the
      //    existing row so the user edits it instead (never a silent mint,
      //    never a silent overwrite of their data — §12.11). Near-duplicates
      //    are deliberately NOT blocked on manual intake: intent is ambiguous
      //    and a false block is worse (C3 doctrine — user-review, not
      //    auto-merge).
      if (!isRentalCreate && type !== 'RENT' && type !== 'RENTAL') {
        const signatureRows = await prisma.income.findMany({
          where: { userId: auth.userId, type, ownerEntityId },
          orderBy: { createdAt: 'asc' },
        });
        const signatureMatch = classifyIntake({
          kind: 'income',
          source: 'MANUAL',
          declaredFrequency: frequency,
          streamPolicy: 'source-signature',
          candidate: {
            name,
            amount: toNumber(amount) ?? 0,
            scopeKey: propertyId ?? investmentAccountId ?? null,
          },
          existingRows: signatureRows.map(
            (r: { id: string; name: string; amount: number; propertyId: string | null; investmentAccountId: string | null }) => ({
              id: r.id,
              name: r.name,
              amount: r.amount,
              scopeKey: r.propertyId ?? r.investmentAccountId ?? null,
            }),
          ),
        }).streamMatch;
        if (signatureMatch?.confidence === 'exact') {
          const existing = signatureRows.find((r: { id: string }) => r.id === signatureMatch.id);
          return NextResponse.json(
            {
              error: `You already have an income source "${existing?.name ?? name}" (${type}). Edit that source instead of adding a duplicate — one source, one row, so your totals stay true.`,
              code: 'DUPLICATE_INCOME_SOURCE',
              existingId: signatureMatch.id,
            },
            { status: 409 },
          );
        }
      }

      const incomeRecord = await prisma.income.create({
        data: {
          userId: auth.userId,
          ownerEntityId,
          name,
          type,
          amount: toNumber(amount) ?? 0,
          frequency: intake.frequency,
          isRecurring: intake.isRecurring,
          isTaxable: isTaxable !== undefined ? Boolean(isTaxable) : true,
          propertyId: propertyId || null,
          investmentAccountId: investmentAccountId || null,
          sourceType: sourceType || 'GENERAL',
          // Phase 59: MANAGED only valid on rental streams; anything else stays DIRECT
          rentalMode:
            rentalMode === 'MANAGED' && (type === 'RENT' || type === 'RENTAL')
              ? 'MANAGED'
              : 'DIRECT',
          managingAgentName:
            rentalMode === 'MANAGED' && typeof managingAgentName === 'string' && managingAgentName.trim()
              ? managingAgentName.trim()
              : null,
          // Phase 20: Salary-specific fields
          salaryType: type === 'SALARY' ? salaryType : null,
          payFrequency: type === 'SALARY' ? toPayFrequency(payFrequency) : null,
          grossAmount: toNumber(grossAmount),
          netAmount: toNumber(netAmount),
          paygWithholding: toNumber(paygWithholding),
          superGuaranteeRate: toNumber(superGuaranteeRate),
          superGuaranteeAmount: toNumber(superGuaranteeAmount),
          salarySacrifice: toNumber(salarySacrifice),
          // Phase 20: Investment-specific fields
          frankingPercentage: toNumber(frankingPercentage),
          frankingCredits: toNumber(frankingCredits),
        },
        include: { property: true, investmentAccount: true },
      });

      // Audit every state-changing write (CLAUDE.md §12.5). This route is a
      // wizard SSOT write boundary for property rental income (Phase 12
      // Track F.2). Generic CREATE action with entityType — F.8 owns the
      // income/expenses domain. No CDR/financial values in metadata (§13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'CREATE',
        status: 'SUCCESS',
        entityType: 'Income',
        entityId: incomeRecord.id,
        metadata: { type: incomeRecord.type, hasProperty: !!incomeRecord.propertyId },
      });

      return NextResponse.json(incomeRecord, { status: 201 });
    } catch (error) {
      console.error('Create income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
