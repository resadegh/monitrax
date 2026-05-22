/**
 * Phase 44 Part 2b — private-company-benefit service (SSOT writer).
 *
 * The ONLY writer of `PrivateCompanyBenefit` — a Div 7A benefit (loan /
 * payment / debt forgiveness / UPE / sub-trust) from a private company
 * to a shareholder or associate (PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md
 * §4.3, §5). The Part 2c fact-assembler feeds the `LOAN` rows to the tax
 * engine as `EntityTaxFacts.div7aLoans`; the other benefit types are
 * recorded and the engine returns `UNCOMPUTED` (§7.1 G-DIV7A) — and the
 * engine never auto-deems a `UPE` / `SUB_TRUST_ARRANGEMENT` a Div 7A
 * dividend, that treatment being legally contested (§7.1 G-UPE).
 *
 * Digital twin (§6.1): a recipient the graph does not show as a
 * shareholder/associate of the company is RECORDED + warned, never
 * rejected. Only entity-not-owned is hard-rejected. No tax arithmetic
 * here (§8.3) — the service records the benefit; the engine assesses it.
 */

import { prisma } from '@/lib/db';
import type {
  Prisma,
  PrismaClient,
  PrivateCompanyBenefitType,
} from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

export type PrivateCompanyBenefitErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'SAME_ENTITY'
  | 'BENEFIT_NOT_FOUND';

export class PrivateCompanyBenefitValidationError extends Error {
  constructor(
    public readonly code: PrivateCompanyBenefitErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PrivateCompanyBenefitValidationError';
  }
}

export interface CreatePrivateCompanyBenefitInput {
  companyEntityId: string;
  recipientEntityId: string;
  financialYear: string;
  benefitType: PrivateCompanyBenefitType;
  amount: number;
  openingBalance?: number | null;
  loanTermYears?: number | null;
  benchmarkRate?: number | null;
  repaymentsThisFy?: number | null;
  hasComplianceAgreement?: boolean;
  isSubTrustUpe?: boolean;
}

export interface PrivateCompanyBenefitWriteResult {
  benefitId: string;
  warnings: string[];
}

/**
 * Record a Div 7A benefit. Hard-rejects an entity not owned by the user,
 * or a company-equals-recipient self-reference. A recipient the graph
 * does not show as a shareholder/associate is recorded + warned.
 */
export async function createPrivateCompanyBenefit(
  userId: string,
  input: CreatePrivateCompanyBenefitInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<PrivateCompanyBenefitWriteResult> {
  if (input.companyEntityId === input.recipientEntityId) {
    throw new PrivateCompanyBenefitValidationError(
      'SAME_ENTITY',
      'The company and the benefit recipient cannot be the same entity.',
    );
  }

  const owned = await prisma.legalEntity.count({
    where: { id: { in: [input.companyEntityId, input.recipientEntityId] }, userId },
  });
  if (owned !== 2) {
    throw new PrivateCompanyBenefitValidationError(
      'ENTITY_NOT_FOUND',
      'The company or the recipient does not exist or is not owned by you.',
    );
  }

  // Soft check — is the recipient a shareholder of the company, or an
  // associate (FAMILY_MEMBER_OF / ASSOCIATE_OF in either direction)?
  // Div 7A reaches shareholders + associates; a recipient outside that
  // set is recorded + flagged (the §6.1 associate test is a structural
  // indicator, not proof — §13-F8).
  const warnings: string[] = [];
  const linkCount = await prisma.entityRelationship.count({
    where: {
      userId,
      effectiveTo: null,
      OR: [
        {
          type: 'SHAREHOLDER_OF',
          fromEntityId: input.recipientEntityId,
          toEntityId: input.companyEntityId,
        },
        {
          type: { in: ['FAMILY_MEMBER_OF', 'ASSOCIATE_OF'] },
          fromEntityId: input.recipientEntityId,
        },
        {
          type: { in: ['FAMILY_MEMBER_OF', 'ASSOCIATE_OF'] },
          toEntityId: input.recipientEntityId,
        },
      ],
    },
  });
  if (linkCount === 0) {
    warnings.push(
      'The recipient is not recorded as a shareholder of the company or as an associate — Div 7A applies to shareholders and their associates; confirm the relationship.',
    );
  }

  const created = await prisma.privateCompanyBenefit.create({
    data: {
      userId,
      companyEntityId: input.companyEntityId,
      recipientEntityId: input.recipientEntityId,
      financialYear: input.financialYear,
      benefitType: input.benefitType,
      amount: input.amount,
      openingBalance: input.openingBalance ?? null,
      loanTermYears: input.loanTermYears ?? null,
      benchmarkRate: input.benchmarkRate ?? null,
      repaymentsThisFy: input.repaymentsThisFy ?? null,
      hasComplianceAgreement: input.hasComplianceAgreement ?? false,
      isSubTrustUpe: input.isSubTrustUpe ?? false,
    },
    select: { id: true },
  });

  void logCRUD({
    userId,
    action: 'CREATE',
    entityType: 'PrivateCompanyBenefit',
    entityId: created.id,
    metadata: { benefitType: input.benefitType, financialYear: input.financialYear },
    ...requestMeta,
  }).catch(() => {});

  return { benefitId: created.id, warnings };
}

/** Hard-delete a private-company benefit (a mistaken entry). */
export async function deletePrivateCompanyBenefit(
  userId: string,
  benefitId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.privateCompanyBenefit.findFirst({
    where: { id: benefitId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new PrivateCompanyBenefitValidationError(
      'BENEFIT_NOT_FOUND',
      'Private-company benefit not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the delete to the caller's row.
  await prisma.privateCompanyBenefit.delete({
    where: { id: benefitId, userId },
  });
  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'PrivateCompanyBenefit',
    entityId: benefitId,
    ...requestMeta,
  }).catch(() => {});
}

export interface PrivateCompanyBenefitSummary {
  id: string;
  companyEntityId: string;
  recipientEntityId: string;
  financialYear: string;
  benefitType: PrivateCompanyBenefitType;
  amount: number;
  openingBalance: number | null;
  loanTermYears: number | null;
  benchmarkRate: number | null;
  repaymentsThisFy: number | null;
  hasComplianceAgreement: boolean;
  isSubTrustUpe: boolean;
  accountantVerified: boolean;
}

/** List a user's private-company benefits, optionally filtered to one company / FY. */
export async function listPrivateCompanyBenefits(
  userId: string,
  filter?: { companyEntityId?: string; financialYear?: string },
  client: PrismaTxOrClient = prisma,
): Promise<PrivateCompanyBenefitSummary[]> {
  const rows = await client.privateCompanyBenefit.findMany({
    where: {
      userId,
      ...(filter?.companyEntityId && { companyEntityId: filter.companyEntityId }),
      ...(filter?.financialYear && { financialYear: filter.financialYear }),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyEntityId: true,
      recipientEntityId: true,
      financialYear: true,
      benefitType: true,
      amount: true,
      openingBalance: true,
      loanTermYears: true,
      benchmarkRate: true,
      repaymentsThisFy: true,
      hasComplianceAgreement: true,
      isSubTrustUpe: true,
      accountantVerified: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    companyEntityId: r.companyEntityId,
    recipientEntityId: r.recipientEntityId,
    financialYear: r.financialYear,
    benefitType: r.benefitType,
    amount: Number(r.amount),
    openingBalance: r.openingBalance === null ? null : Number(r.openingBalance),
    loanTermYears: r.loanTermYears,
    benchmarkRate: r.benchmarkRate === null ? null : Number(r.benchmarkRate),
    repaymentsThisFy: r.repaymentsThisFy === null ? null : Number(r.repaymentsThisFy),
    hasComplianceAgreement: r.hasComplianceAgreement,
    isSubTrustUpe: r.isSubTrustUpe,
    accountantVerified: r.accountantVerified,
  }));
}
