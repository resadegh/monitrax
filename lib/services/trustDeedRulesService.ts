/**
 * Phase 41f.4 — Trust-deed rules consumer service.
 *
 * Read-only helper for Phase 41e tax engines + the AI advisor tools.
 *
 * Per spec doc §1.1 + §6.2:
 *   - Tax engines consume **CONFIRMED** rules only.
 *   - Rules below `CONFIDENCE_THRESHOLD` (0.7) are filtered out by
 *     `highConfidenceOnly()` so that downstream calculations never
 *     consume an extracted rule the AI was uncertain about.
 *
 * This service is the SINGLE READ PATH for trust-deed rules from any
 * Phase 41e or 41h consumer. New callers (e.g. Phase 41e.4 Div 6E
 * streaming wired to consume from this service rather than expecting
 * the caller to construct beneficiaries manually) should go through
 * `getConfirmedRulesForEntity()`.
 *
 * Wiring into specific Phase 41e consumers (MasterTaxPosition
 * orchestrator + AI advisor tools) is deferred to a follow-up PR
 * (41f.4-extension OR part of Phase 41i.6's surface-audit work). The
 * Zod-validated typed shape lands in this PR so the contract is
 * locked.
 */

import 'server-only';
import prisma from '@/lib/db';
import {
  TrustDeedExtractionSchema,
  highConfidenceOnly,
  type TrustDeedExtraction,
} from '@/lib/integrations/trust-deed';

export interface ConfirmedRulesPayload {
  rulesId: string;
  legalEntityId: string;
  confirmedAt: Date;
  /** The Zod-validated extraction shape, with low-confidence rules already filtered out. */
  rules: TrustDeedExtraction;
}

/**
 * Returns the latest CONFIRMED `TrustDeedExtractedRules` for the
 * entity, with low-confidence beneficiaries / distribution rules
 * already filtered out via `highConfidenceOnly()`.
 *
 * Returns `null` when no CONFIRMED rules exist (entity has no deed
 * uploaded; or all uploads are EXTRACTED/REJECTED). Callers should
 * surface UNCOMPUTED in that case (typically `UC-TRUST-DEED-NOT-CONFIRMED`).
 *
 * Returns `null` if the persisted JSON fails Zod validation (defensive
 * — should never happen in practice since the extraction service
 * Zod-validates at write time, but this prevents downstream tax
 * engines from consuming a malformed rule).
 */
export async function getConfirmedRulesForEntity(
  legalEntityId: string,
): Promise<ConfirmedRulesPayload | null> {
  const row = await prisma.trustDeedExtractedRules.findFirst({
    where: { legalEntityId, status: 'CONFIRMED' },
    orderBy: { confirmedAt: 'desc' },
  });
  if (!row || !row.confirmedAt) return null;

  // Reconstruct the typed extraction shape from Prisma's JSON columns
  // and Zod-validate. If the validation fails, return null — never
  // hand a malformed shape to a tax engine.
  const candidate = {
    beneficiaries: row.beneficiaries,
    distributionRules: row.distributionRules,
    vestingDate: row.vestingDate ? row.vestingDate.toISOString().slice(0, 10) : null,
    trusteePower: row.trusteePower,
    loanProvisions: row.loanProvisions,
    uncomputedNotes: row.uncomputedNotes,
    overallConfidence: 1, // user CONFIRMED — implicit user trust
  };

  const parsed = TrustDeedExtractionSchema.safeParse(candidate);
  if (!parsed.success) {
    // Defensive — log + return null. Future Phase 41i.6 surface audit
    // would catch this drift; for now, fail closed.
    console.warn(
      'Persisted trust-deed rules failed Zod validation on read:',
      row.id,
      parsed.error.issues.slice(0, 3),
    );
    return null;
  }

  return {
    rulesId: row.id,
    legalEntityId: row.legalEntityId,
    confirmedAt: row.confirmedAt,
    rules: highConfidenceOnly(parsed.data),
  };
}

/**
 * Convenience — returns just the Zod-validated `TrustDeedExtraction`
 * for the entity, or null if no CONFIRMED rules exist. Loses the
 * provenance metadata (rulesId, confirmedAt) — use
 * `getConfirmedRulesForEntity` if you need those.
 */
export async function getConfirmedExtractionForEntity(
  legalEntityId: string,
): Promise<TrustDeedExtraction | null> {
  const payload = await getConfirmedRulesForEntity(legalEntityId);
  return payload?.rules ?? null;
}
