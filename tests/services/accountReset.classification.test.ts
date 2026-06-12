/**
 * Account-reset classification drift test.
 *
 * `lib/services/accountReset.ts` wipes every model in RESET_DELETE_MODELS
 * for the requesting user. The danger is DRIFT: someone adds a new
 * user-owned model and forgets to classify it, leaving either a silent
 * hole in the wipe (user "starts fresh" but stale data survives) or an
 * accidental deletion of something that must be kept (consent records,
 * AFSL-retained communications).
 *
 * This test walks the Prisma DMMF and asserts every model with a direct
 * relation to `User` appears in EXACTLY ONE of the three classification
 * lists. Adding a model without classifying it turns the build red —
 * the same structural-drift defence as the 2026-06-11 AuditAction enum
 * fix (typed enum instead of `as string`).
 */

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  RESET_DELETE_MODELS,
  RESET_KEEP_MODELS,
  RESET_CDR_DELEGATED_MODELS,
} from '@/lib/services/accountReset';

/** Models with a direct FK relation pointing at User, from the DMMF. */
function userOwnedModels(): { name: string; fkFields: string[] }[] {
  const out: { name: string; fkFields: string[] }[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    const fkFields: string[] = [];
    for (const field of model.fields) {
      if (
        field.kind === 'object' &&
        field.type === 'User' &&
        field.relationFromFields &&
        field.relationFromFields.length > 0
      ) {
        fkFields.push(...field.relationFromFields);
      }
    }
    if (fkFields.length > 0) out.push({ name: model.name, fkFields });
  }
  return out;
}

describe('accountReset model classification', () => {
  const owned = userOwnedModels();
  const classified = new Set<string>([
    ...RESET_DELETE_MODELS,
    ...RESET_KEEP_MODELS,
    ...RESET_CDR_DELEGATED_MODELS,
  ]);

  it('classifies every user-owned model exactly once', () => {
    const missing = owned.map((m) => m.name).filter((name) => !classified.has(name));
    expect(
      missing,
      `New user-owned model(s) not classified in lib/services/accountReset.ts. ` +
        `Decide: does a "Start fresh" reset wipe this data (RESET_DELETE_MODELS), ` +
        `keep it (RESET_KEEP_MODELS), or is it CDR-lifecycle-owned ` +
        `(RESET_CDR_DELEGATED_MODELS)? Unclassified: ${missing.join(', ')}`,
    ).toEqual([]);

    // No double-classification either.
    const all = [
      ...RESET_DELETE_MODELS,
      ...RESET_KEEP_MODELS,
      ...RESET_CDR_DELEGATED_MODELS,
    ];
    expect(new Set(all).size, 'a model appears in more than one classification list').toBe(
      all.length,
    );
  });

  it('lists no model that no longer exists or lost its User relation', () => {
    const ownedNames = new Set(owned.map((m) => m.name));
    const stale = [...classified].filter((name) => !ownedNames.has(name));
    expect(
      stale,
      `Classified model(s) no longer have a direct User relation — remove from ` +
        `accountReset.ts lists: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it('every DELETE model is wipeable via a direct `userId` column', () => {
    // resetUserData() calls `deleteMany({ where: { userId } })` on every
    // DELETE model — that only works when the FK column is literally
    // `userId`. Models with differently-named user FKs (raterUserId,
    // authorId, …) must live in KEEP (they all do today) or the service
    // needs a per-model where-clause before they can be added to DELETE.
    const byName = new Map(owned.map((m) => [m.name, m.fkFields]));
    const badFk = RESET_DELETE_MODELS.filter(
      (name) => !(byName.get(name) ?? []).includes('userId'),
    );
    expect(
      badFk,
      `DELETE-classified model(s) without a direct \`userId\` column: ${badFk.join(', ')}`,
    ).toEqual([]);
  });

  it('the 7 Restrict-bearing entity models come before LegalEntity in the wipe order', () => {
    // The schema's only `onDelete: Restrict` relations are
    // <entity> → LegalEntity. If a Restrict-bearing model were ordered
    // after LegalEntity, the wipe transaction would abort at the DB layer.
    const restrictSources = new Set<string>();
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields) {
        if (field.kind === 'object' && field.relationOnDelete === 'Restrict') {
          expect(field.type, 'a NEW Restrict relation target appeared — re-derive the wipe order').toBe(
            'LegalEntity',
          );
          restrictSources.add(model.name);
        }
      }
    }
    const order = [...RESET_DELETE_MODELS];
    const legalEntityIdx = order.indexOf('LegalEntity');
    expect(legalEntityIdx).toBeGreaterThan(-1);
    for (const source of restrictSources) {
      const idx = order.indexOf(source as (typeof RESET_DELETE_MODELS)[number]);
      expect(
        idx,
        `Restrict-bearing model ${source} must be in RESET_DELETE_MODELS before LegalEntity`,
      ).toBeGreaterThan(-1);
      expect(idx, `${source} must be wiped BEFORE LegalEntity`).toBeLessThan(legalEntityIdx);
    }
  });
});
