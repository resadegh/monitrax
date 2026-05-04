/**
 * Shared types for the Phase 41b/c entity surfaces.
 *
 * Mirrors the `LegalEntitySummary` shape from
 * `lib/services/legalEntityService.ts` — kept locally so the
 * client-side surfaces (`/dashboard/entities`, EntityTree,
 * EntityFormDialog) don't pull server-only types.
 */

export type LegalEntityType =
  | 'PERSONAL_NAME'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF'
  | 'PARTNERSHIP'
  | 'SOLE_TRADER';

export type LegalEntityRole =
  | 'PERSONAL'
  | 'HOLDING'
  | 'OPERATING'
  | 'INVESTMENT'
  | 'SUPERANNUATION';

export const TYPE_LABELS: Record<LegalEntityType, string> = {
  PERSONAL_NAME: 'My personal name',
  COMPANY: 'Company (Pty Ltd)',
  DISCRETIONARY_TRUST: 'Discretionary / family trust',
  UNIT_TRUST: 'Unit trust',
  SMSF: 'Self-Managed Super Fund',
  PARTNERSHIP: 'Partnership',
  SOLE_TRADER: 'Sole trader',
};

export const TYPE_LABELS_SHORT: Record<LegalEntityType, string> = {
  PERSONAL_NAME: 'Personal',
  COMPANY: 'Pty Ltd',
  DISCRETIONARY_TRUST: 'Trust',
  UNIT_TRUST: 'Unit Trust',
  SMSF: 'SMSF',
  PARTNERSHIP: 'Partnership',
  SOLE_TRADER: 'Sole Trader',
};

export const ROLE_LABELS: Record<LegalEntityRole, string> = {
  PERSONAL: 'Personal',
  HOLDING: 'Holding',
  OPERATING: 'Operating',
  INVESTMENT: 'Investment',
  SUPERANNUATION: 'Superannuation',
};

export interface OwnedObjectsCount {
  properties: number;
  loans: number;
  accounts: number;
  investmentAccounts: number;
  assets: number;
  incomes: number;
  expenses: number;
  total: number;
}

export interface Entity {
  id: string;
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
  tradingName: string | null;
  establishedDate: string | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  ownedObjectsCount: OwnedObjectsCount;
}

export interface HouseholdMember {
  id: string;
  name: string;
  relationship:
    | 'SELF'
    | 'SPOUSE'
    | 'PARTNER'
    | 'CHILD'
    | 'PARENT'
    | 'SIBLING'
    | 'OTHER';
  isIncomeEarner: boolean;
}

export const TYPES: LegalEntityType[] = [
  'PERSONAL_NAME',
  'COMPANY',
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'SMSF',
  'PARTNERSHIP',
  'SOLE_TRADER',
];

export const ROLES: LegalEntityRole[] = [
  'PERSONAL',
  'HOLDING',
  'OPERATING',
  'INVESTMENT',
  'SUPERANNUATION',
];

/**
 * Per-role visual palette. Drives entity-tile colour in the tree and
 * the entity-list chips. Warm-AU language; tones distinct enough that
 * a colour-blind reader can still tell roles apart.
 *
 * Inspired by the Phase 39 Wealth palette and Apple-glass aesthetic
 * — tile background is glass-on-warm-ivory, accent is the role colour
 * applied to icon + ring + chip.
 */
export const ROLE_PALETTE: Record<
  LegalEntityRole,
  {
    icon: string;       // text-color for the icon
    iconBg: string;     // background tint behind the icon
    ring: string;       // ring color for hover state
    chip: string;       // bg/text combo for the role chip
  }
> = {
  PERSONAL: {
    icon: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    ring: 'hover:ring-amber-300 dark:hover:ring-amber-600',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  HOLDING: {
    icon: 'text-indigo-700 dark:text-indigo-300',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    ring: 'hover:ring-indigo-300 dark:hover:ring-indigo-600',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
  OPERATING: {
    icon: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    ring: 'hover:ring-emerald-300 dark:hover:ring-emerald-600',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  SUPERANNUATION: {
    icon: 'text-violet-700 dark:text-violet-300',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    ring: 'hover:ring-violet-300 dark:hover:ring-violet-600',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  },
  INVESTMENT: {
    icon: 'text-fuchsia-700 dark:text-fuchsia-300',
    iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40',
    ring: 'hover:ring-fuchsia-300 dark:hover:ring-fuchsia-600',
    chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  },
};
