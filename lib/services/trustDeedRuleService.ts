/**
 * Phase 44 Part 2b — trust-deed-rule service (SSOT writer).
 *
 * The ONLY writer of `TrustDeedRule` — structured, queryable deed-derived
 * facts (PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md §4.4, §5). The typed
 * promotion of `TrustDeedExtractedRules`' JSON columns; the SSOT the tax
 * engine reads (`trustMinimumTax` repoints onto it in Part 2c).
 * `TrustDeedExtractedRules` is retained as the raw PDF-extraction
 * provenance record.
 *
 * `ruleValue` is typed JSON whose shape varies by `ruleType`. v1
 * validates it is a non-null JSON object; fuller per-`ruleType` Zod
 * schemas land as the deed-rule shapes firm up (§4.4 — "JSON for
 * flexibility as the trust-deed rule shape evolves"). No tax arithmetic
 * here (§8.3).
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, TrustDeedRuleType } from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

export type TrustDeedRuleErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'INVALID_RULE_VALUE'
  | 'RULE_NOT_FOUND';

export class TrustDeedRuleValidationError extends Error {
  constructor(public readonly code: TrustDeedRuleErrorCode, message: string) {
    super(message);
    this.name = 'TrustDeedRuleValidationError';
  }
}

/**
 * Pure check — is `ruleValue` a non-null JSON object (not null, not an
 * array, not a primitive)? Exported for unit testing. Fuller per-`ruleType`
 * Zod schemas land as the deed-rule shapes firm up (§4.4).
 */
export function isValidRuleValue(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface CreateTrustDeedRuleInput {
  trustEntityId: string;
  ruleType: TrustDeedRuleType;
  /** Typed JSON, shape varies by `ruleType`. Must be a non-null object. */
  ruleValue: Record<string, unknown>;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  sourceExtractionId?: string | null;
  extractedConfidence?: number | null;
}

/**
 * Record a structured trust-deed rule. Hard-rejects a trust not owned by
 * the user, and a `ruleValue` that is not a non-null JSON object.
 */
export async function createTrustDeedRule(
  userId: string,
  input: CreateTrustDeedRuleInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  if (!isValidRuleValue(input.ruleValue)) {
    throw new TrustDeedRuleValidationError(
      'INVALID_RULE_VALUE',
      'ruleValue must be a non-null JSON object.',
    );
  }

  const owned = await prisma.legalEntity.count({
    where: { id: input.trustEntityId, userId },
  });
  if (owned !== 1) {
    throw new TrustDeedRuleValidationError(
      'ENTITY_NOT_FOUND',
      'The trust does not exist or is not owned by you.',
    );
  }

  const created = await prisma.trustDeedRule.create({
    data: {
      userId,
      trustEntityId: input.trustEntityId,
      ruleType: input.ruleType,
      ruleValue: input.ruleValue as Prisma.InputJsonValue,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      effectiveTo: input.effectiveTo ?? null,
      sourceExtractionId: input.sourceExtractionId ?? null,
      extractedConfidence: input.extractedConfidence ?? null,
    },
    select: { id: true },
  });

  void logCRUD({
    userId,
    action: 'CREATE',
    entityType: 'TrustDeedRule',
    entityId: created.id,
    metadata: { ruleType: input.ruleType },
    ...requestMeta,
  }).catch(() => {});

  return created.id;
}

/** End a deed rule by setting `effectiveTo` (the deed was varied / superseded). */
export async function endTrustDeedRule(
  userId: string,
  ruleId: string,
  effectiveTo: Date,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.trustDeedRule.findFirst({
    where: { id: ruleId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new TrustDeedRuleValidationError(
      'RULE_NOT_FOUND',
      'Trust-deed rule not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the write; `effectiveTo` only.
  await prisma.trustDeedRule.update({
    where: { id: ruleId, userId },
    data: { effectiveTo },
  });
  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'TrustDeedRule',
    entityId: ruleId,
    metadata: { ended: true },
    ...requestMeta,
  }).catch(() => {});
}

/** Hard-delete a deed rule (a mistaken entry). */
export async function deleteTrustDeedRule(
  userId: string,
  ruleId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.trustDeedRule.findFirst({
    where: { id: ruleId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new TrustDeedRuleValidationError(
      'RULE_NOT_FOUND',
      'Trust-deed rule not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the delete to the caller's row.
  await prisma.trustDeedRule.delete({ where: { id: ruleId, userId } });
  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'TrustDeedRule',
    entityId: ruleId,
    ...requestMeta,
  }).catch(() => {});
}

export interface TrustDeedRuleSummary {
  id: string;
  trustEntityId: string;
  ruleType: TrustDeedRuleType;
  ruleValue: unknown;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceExtractionId: string | null;
  extractedConfidence: number | null;
  accountantVerified: boolean;
}

/** List a user's trust-deed rules, optionally filtered to one trust. */
export async function listTrustDeedRules(
  userId: string,
  filter?: { trustEntityId?: string },
  client: PrismaTxOrClient = prisma,
): Promise<TrustDeedRuleSummary[]> {
  const rows = await client.trustDeedRule.findMany({
    where: {
      userId,
      ...(filter?.trustEntityId && { trustEntityId: filter.trustEntityId }),
    },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      trustEntityId: true,
      ruleType: true,
      ruleValue: true,
      effectiveFrom: true,
      effectiveTo: true,
      sourceExtractionId: true,
      extractedConfidence: true,
      accountantVerified: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    trustEntityId: r.trustEntityId,
    ruleType: r.ruleType,
    ruleValue: r.ruleValue,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    sourceExtractionId: r.sourceExtractionId,
    extractedConfidence:
      r.extractedConfidence === null ? null : Number(r.extractedConfidence),
    accountantVerified: r.accountantVerified,
  }));
}
