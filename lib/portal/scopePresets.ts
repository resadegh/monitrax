/**
 * scopePresets — Phase 0 / Phase 32B PR3 #10
 *
 * Profession-aware consent-scope presets. When an adviser, broker, or
 * accountant invites a client, they need to request `DataAccessScope`
 * coverage. Free-form scope picking puts the burden of "what does my
 * profession actually need?" on every adviser, every time. These three
 * presets encode the common answers as one-click templates — the
 * adviser can still fine-tune via the existing checkboxes afterward.
 *
 * SSOT contract: this file is the single source of truth for the
 * preset → scope-set mapping. The invite UI imports from here; any
 * future surface that needs the same presets (mobile, bulk-invite,
 * marketplace onboarding) imports from here too. No duplication.
 *
 * Scope semantics (`DataAccessScope` enum, `prisma/schema.prisma`):
 *   FULL · FINANCIAL · INVESTMENTS · TAX · DOCUMENTS · TRANSACTIONS ·
 *   PROPERTIES · LOANS
 *
 * @see docs/blueprint/PHASE_32B_PRACTICE_SURFACE.md (PR3 #10)
 * @see components/portal/team/InviteModal.tsx
 */

import type { DataAccessScope } from '@prisma/client';

export type ScopePresetId = 'LENDING' | 'TAX' | 'ADVISORY';

export interface ScopePreset {
  id: ScopePresetId;
  /** Short label for the quick-pick button. */
  label: string;
  /** Who this preset is for — one line, plain English. */
  forWhom: string;
  /** The scope set this preset applies. Order is display order. */
  scopes: DataAccessScope[];
}

/**
 * The three canonical presets.
 *
 * - **LENDING** — mortgage brokers / lending specialists. They assess
 *   serviceability and existing debt: loans + the security properties
 *   behind them + transaction history for income verification. They
 *   do NOT need investments, tax detail, or document storage.
 * - **TAX** — tax agents / accountants. They prepare returns: tax data
 *   + transaction history (for deduction substantiation) + uploaded
 *   documents (receipts, statements). They do NOT need raw account
 *   balances, investments, properties, or loans as separate scopes —
 *   the tax engine already surfaces what they need.
 * - **ADVISORY** — financial advisers. They do holistic planning:
 *   everything *except* document storage (which can contain
 *   material outside their remit — wills, legal letters, medical
 *   docs). This is "FULL minus DOCUMENTS" expressed as the explicit
 *   six-scope enumeration, NOT the `FULL` scope literal — the invite
 *   UI's toggle logic treats `FULL` as mutually exclusive, so the
 *   minus-one case has to be enumerated.
 */
export const SCOPE_PRESETS: readonly ScopePreset[] = [
  {
    id: 'LENDING',
    label: 'Mortgage / lending',
    forWhom: 'Brokers assessing serviceability and existing debt',
    scopes: ['LOANS', 'PROPERTIES', 'TRANSACTIONS'],
  },
  {
    id: 'TAX',
    label: 'Tax / accounting',
    forWhom: 'Accountants preparing returns and substantiating deductions',
    scopes: ['TAX', 'TRANSACTIONS', 'DOCUMENTS'],
  },
  {
    id: 'ADVISORY',
    label: 'Financial advice',
    forWhom: 'Advisers doing holistic planning (everything except documents)',
    // "FULL minus DOCUMENTS" — every scope the FULL grant covers,
    // except DOCUMENTS. Enumerated because the invite UI treats the
    // `FULL` literal as a mutually-exclusive selection.
    scopes: ['FINANCIAL', 'INVESTMENTS', 'TAX', 'TRANSACTIONS', 'PROPERTIES', 'LOANS'],
  },
] as const;

/**
 * Look up a preset by id. Returns `undefined` for unknown ids (callers
 * should treat that as "no preset selected", i.e. free-form picking).
 */
export function getScopePreset(id: ScopePresetId): ScopePreset | undefined {
  return SCOPE_PRESETS.find((p) => p.id === id);
}

/**
 * Given a current scope selection, return the preset id whose scope
 * set it matches exactly (order-insensitive), or `null` if it matches
 * none. Used by the invite UI to highlight the active preset chip and
 * to de-highlight when the adviser manually deviates.
 */
export function matchScopePreset(
  selected: readonly DataAccessScope[],
): ScopePresetId | null {
  const sortedSelected = [...selected].sort();
  for (const preset of SCOPE_PRESETS) {
    const sortedPreset = [...preset.scopes].sort();
    if (
      sortedPreset.length === sortedSelected.length &&
      sortedPreset.every((s, i) => s === sortedSelected[i])
    ) {
      return preset.id;
    }
  }
  return null;
}
