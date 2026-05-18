/**
 * Phase 12 PR 3c.2c — Canonical helpers for writing `Account.currentBalance`.
 *
 * Per CLAUDE.md §12.2 (SSOT): every Prisma write that touches
 * `Account.currentBalance` MUST also set `balanceSource` AND
 * `balanceLastUpdatedAt`. Drift here is invisible to the user — it
 * shows up as the `<DataSourceChip>` (PR F) silently lying ("Manual ·
 * 4mo ago" on an account the Basiq sync touched yesterday) and the
 * `<StaleBalanceNudge>` (PR F) firing or not-firing on the wrong
 * accounts. The audit that produced this file found 3 such gaps;
 * this helper exists so the 4th never lands.
 *
 * Usage — every `prisma.account.{create, update, upsert}` whose data
 * payload includes `currentBalance` should also spread the result of
 * `balanceWriteFields(...)`:
 *
 *   ```ts
 *   await prisma.account.update({
 *     where: { id },
 *     data: {
 *       currentBalance: 12345.67,
 *       ...balanceWriteFields('USER_VERIFIED'),
 *     },
 *   });
 *   ```
 *
 * The `BalanceSource` literal type mirrors the Prisma enum exactly:
 *   - MANUAL         user manually entered balance
 *   - IMPORT         balance from CSV/QIF/OFX import
 *   - BASIQ          balance from Open Banking (Basiq)
 *   - USER_VERIFIED  user verified balance after import / explicit re-affirm
 *
 * NOTE: `lib/db/tenant.ts` and the seed scripts (`prisma/seed-*.ts`)
 * are out of scope — tenant.ts is multi-tenant scaffold not yet
 * active in prod; seed scripts write test fixtures and aren't
 * load-bearing for live users.
 */

import type { BalanceSource } from '@prisma/client';

export type BalanceSourceLiteral = BalanceSource;

export interface BalanceWriteFields {
  balanceSource: BalanceSource;
  balanceLastUpdatedAt: Date;
}

/**
 * The two fields every `Account.currentBalance` write must carry.
 * Caller spreads the return into the Prisma `data` payload.
 *
 * `now` is exposed for tests + the rare case where a caller already
 * has a canonical timestamp from upstream (e.g. an OFX statement's
 * statement date). Defaults to `new Date()`.
 */
export function balanceWriteFields(
  source: BalanceSourceLiteral,
  now: Date = new Date()
): BalanceWriteFields {
  return {
    balanceSource: source,
    balanceLastUpdatedAt: now,
  };
}
