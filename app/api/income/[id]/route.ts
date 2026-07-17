import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership, verifyRelatedOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';
import { reconcileManagedRental } from '@/lib/calculations/rentalReconciliation';
import { buildRetroactiveManagedRentalSuggestion } from '@/lib/services/managedRentalService';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('income.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const income = await prisma.income.findUnique({
        where: { id },
        include: {
          property: true,
          investmentAccount: true,
        },
      });

      // Verify ownership using centralized utility
      const result = verifyOwnership(income, auth.userId, 'Income');
      if (!result.success) return result.response;

      return NextResponse.json(result.resource);
    } catch (error) {
      console.error('Get income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PUT = withPermission<RouteContext>('income.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = await request.json();
      const {
        name,
        type,
        amount,
        frequency,
        isRecurring, // MON-053: reclassify a mislabelled recurring row as one-off (or back)
        isTaxable,
        propertyId,
        investmentAccountId,
        sourceType,
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
        // Phase 59: managed rentals (declared gross stays in amount/frequency)
        rentalMode,
        managingAgentName,
      } = body;

      // Verify ownership
      const existing = await prisma.income.findUnique({ where: { id } });
      const ownershipResult = verifyOwnership(existing, auth.userId, 'Income');
      if (!ownershipResult.success) return ownershipResult.response;

      // Validate ownership of related entities
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

      // Helper to safely convert to number (returns undefined if not provided, null if explicitly null)
      const toNumber = (val: unknown): number | null | undefined => {
        if (val === undefined) return undefined; // Not provided - don't update
        if (val === null) return null; // Explicitly null - set to null
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      };

      // Helper to convert Frequency enum to PayFrequency enum (ANNUAL -> ANNUALLY)
      // PayFrequency values: WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, ANNUALLY
      const toPayFrequency = (freq: string | undefined | null): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY' | null | undefined => {
        if (freq === undefined) return undefined;
        if (freq === null) return null;
        // Map ANNUAL to ANNUALLY (Frequency uses ANNUAL, PayFrequency uses ANNUALLY)
        const mapped = freq === 'ANNUAL' ? 'ANNUALLY' : freq;
        // Validate it's a valid PayFrequency value
        const validPayFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'HALF_YEARLY'] as const;
        if (validPayFrequencies.includes(mapped as typeof validPayFrequencies[number])) {
          return mapped as typeof validPayFrequencies[number];
        }
        return null;
      };

      // Determine the correct payFrequency value
      const resolvedPayFrequency = type === 'SALARY'
        ? toPayFrequency(payFrequency)
        : null;

      // MON-080: the RESULTING state of this save (client value wins when
      // sent, else the stored value) — drives the D2 gross gate + the D1
      // retroactive reconcile below.
      const resultingType = type ?? ownershipResult.resource.type;
      const resultingRentalMode =
        rentalMode !== undefined
          ? rentalMode === 'MANAGED' && (resultingType === 'RENT' || resultingType === 'RENTAL')
            ? 'MANAGED'
            : 'DIRECT'
          : ownershipResult.resource.rentalMode;
      const resultingAmount = toNumber(amount) ?? ownershipResult.resource.amount;
      const resultingFrequency = frequency ?? ownershipResult.resource.frequency;

      // MON-080 D2 — GROSS-INTEGRITY GATE (spec §3 pillar; ITAA s6-5): never
      // persist a MANAGED stream whose declared "rent" is not distinct from
      // its net deposits — that books the NET where the ATO assesses GROSS
      // (understated assessable income) and makes the gap permanently zero.
      // Judged by the ONE engine (§12.2.1): if reconciling the declared
      // amount against the MEDIAN linked deposit yields no material gap,
      // the declared figure IS (or is below) the net — require the real
      // gross. Streams with no linked deposits can't be judged → allowed.
      if (resultingRentalMode === 'MANAGED') {
        const deposits = await prisma.unifiedTransaction.findMany({
          where: { userId: auth.userId, incomeId: id, direction: 'IN' },
          select: { amount: true, date: true },
          orderBy: { date: 'desc' },
          take: 12,
        });
        if (deposits.length > 0) {
          const amounts = deposits.map((t: { amount: number }) => Math.abs(t.amount)).sort((a: number, b: number) => a - b);
          const mid = Math.floor(amounts.length / 2);
          const medianNet = amounts.length % 2 === 1 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
          const probe = reconcileManagedRental({
            declaredGrossAmount: resultingAmount,
            declaredGrossFrequency: resultingFrequency,
            netDisbursementAmount: medianNet,
            disbursementDates: deposits.map((t: { date: Date }) => t.date),
          });
          if (!probe.material) {
            return NextResponse.json(
              {
                error:
                  'It looks like the amount on this stream is what the agent pays out, not the full rent. Enter the full rent before your agent’s fees to mark it as managed — or keep it as "straight from the tenant" if there are no agent costs.',
                code: 'GROSS_REQUIRED',
                medianNetDeposit: medianNet,
                declared: { amount: resultingAmount, frequency: resultingFrequency },
              },
              { status: 422 },
            );
          }
        }
      }

      const income = await prisma.income.update({
        where: { id },
        data: {
          name,
          type,
          amount: toNumber(amount) ?? ownershipResult.resource.amount,
          frequency,
          // MON-053: only touch the flag when the client explicitly sends it.
          isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : undefined,
          isTaxable,
          propertyId: propertyId !== undefined ? propertyId : undefined,
          investmentAccountId: investmentAccountId !== undefined ? investmentAccountId : undefined,
          sourceType: sourceType !== undefined ? sourceType : undefined,
          // Phase 59: only touch when the client explicitly sends it (partial-
          // update discipline); MANAGED only valid on rental streams.
          rentalMode:
            rentalMode !== undefined
              ? rentalMode === 'MANAGED' && (type === 'RENT' || type === 'RENTAL')
                ? 'MANAGED'
                : 'DIRECT'
              : undefined,
          managingAgentName:
            managingAgentName !== undefined
              ? typeof managingAgentName === 'string' && managingAgentName.trim()
                ? managingAgentName.trim()
                : null
              : undefined,
          // Phase 20: Salary-specific fields
          salaryType: type === 'SALARY' ? salaryType : null,
          payFrequency: resolvedPayFrequency,
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
        include: {
          property: true,
          investmentAccount: true,
        },
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'UPDATE',
        status: 'SUCCESS',
        entityType: 'Income',
        entityId: income.id,
        metadata: { type: income.type, hasProperty: !!income.propertyId },
      });

      // MON-080 D1 — retroactive reconcile: when this save turned the stream
      // MANAGED (the natural order — deposits linked first, marked managed
      // later), reconcile the ALREADY-linked disbursements and hand the
      // suggest-and-confirm card back with the response. Same single
      // producer + existingDerived idempotency guard as the link flow
      // (§12.2.1); null = nothing fires. Additive key — the raw income
      // fields stay top-level for existing consumers.
      const becameManaged =
        income.rentalMode === 'MANAGED' && ownershipResult.resource.rentalMode !== 'MANAGED';
      const managedRental = becameManaged
        ? await buildRetroactiveManagedRentalSuggestion({ userId: auth.userId, income })
        : null;

      return NextResponse.json({ ...income, managedRental });
    } catch (error) {
      console.error('Update income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const DELETE = withPermission<RouteContext>('income.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;

      // Verify ownership using centralized utility
      const existing = await prisma.income.findUnique({ where: { id } });
      const result = verifyOwnership(existing, auth.userId, 'Income');
      if (!result.success) return result.response;

      await prisma.income.delete({ where: { id } });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'DELETE',
        status: 'SUCCESS',
        entityType: 'Income',
        entityId: id,
      });

      return NextResponse.json({ message: 'Income deleted successfully' });
    } catch (error) {
      console.error('Delete income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
