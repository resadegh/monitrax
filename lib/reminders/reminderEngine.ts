/**
 * Reminder Engine — canonical renewal/reminder projection (Phase 21.5).
 *
 * SSOT for "what does the user need to be reminded about, and how urgent is
 * it?" This is a PURE engine (CLAUDE.md §6.4): it accepts raw entity data and
 * returns structured reminders. It NEVER fetches, NEVER touches Prisma, NEVER
 * mutates global state. That keeps it usable from a React component, an API
 * route, or a future Cloud Scheduler sweep without change.
 *
 * Tier 1 producers (this cut) — all project from dates ALREADY on the models,
 * so there is no separate `Reminder` table for derived reminders (the dates
 * ARE the source of truth, and this projection reads them):
 *   - Vehicle registration / CTP / comprehensive insurance  (Asset, new cols)
 *   - Asset warranty expiry                                  (Asset.warrantyExpiry)
 *   - Property rates / land tax / insurance / strata /
 *     lease / compliance-cert renewals                       (Property, new cols)
 *   - Loan fixed-rate expiry                                 (Loan.fixedExpiry)
 *   - Bank-feed / CDR consent expiry                         (Account/CDRConsent.consentExpiresAt)
 *
 * Tier 2/3 extend this engine with: (a) term-deposit maturity, standalone
 * insurance, personal-document expiry as further producers; (b) persisted
 * snooze/dismiss/done state + the high-volume bank-detected bills feed
 * (RecurringPayment.nextExpected); (c) email/push delivery gated by
 * `UserPreference` via a daily Cloud Scheduler sweep.
 *
 * Where used (Tier 1):
 *   - app/api/reminders/route.ts          — unified GET (assets+properties+loans+accounts)
 *   - components/reminders/RenewalsCard    — self-contained "Renewals" card
 *   - app/dashboard/assets/page.tsx        — per-tile chip (vehicle + warranty)
 *   - app/dashboard/properties/page.tsx    — per-property renewals in detail
 *
 * Doc: docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md §8.2 / §13 (Phase 21.5).
 */

/** Lead window (days before due) at which a renewal becomes "due soon". */
export const DUE_SOON_LEAD_DAYS = 30;
/** Window (days before due) at which a renewal first surfaces as "upcoming". */
export const UPCOMING_WINDOW_DAYS = 60;
/**
 * Loans + CDR consent warrant a longer lead because acting takes time
 * (refinance paperwork; re-consent flows). Surfaced from 90 days out.
 */
export const LONG_LEAD_UPCOMING_WINDOW_DAYS = 90;

export type ReminderSourceType =
  | 'VEHICLE_REGISTRATION'
  | 'VEHICLE_CTP'
  | 'VEHICLE_INSURANCE'
  | 'ASSET_WARRANTY'
  | 'PROPERTY_COUNCIL_RATES'
  | 'PROPERTY_WATER_RATES'
  | 'PROPERTY_LAND_TAX'
  | 'PROPERTY_INSURANCE'
  | 'PROPERTY_STRATA'
  | 'PROPERTY_LEASE'
  | 'PROPERTY_COMPLIANCE'
  | 'LOAN_FIXED_EXPIRY'
  | 'BANK_CONSENT';

/** Broad category — drives icon/colour grouping + the "act here" href. */
export type ReminderCategory = 'VEHICLE' | 'WARRANTY' | 'PROPERTY' | 'LOAN' | 'CONSENT';

/**
 * Urgency tiers, ordered most→least pressing. Drives colour + sort order.
 *   OVERDUE   — due date has passed
 *   DUE_SOON  — within the lead window
 *   UPCOMING  — within the upcoming window (but not yet due-soon)
 *   OK        — further out than the upcoming window
 */
export type ReminderUrgency = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'OK';

export interface RenewalReminder {
  /** Stable synthetic key: `${entityId}:${sourceType}`. */
  id: string;
  /** Source entity id (asset / loan / account). */
  entityId: string;
  /** Source entity display name. */
  entityName: string;
  category: ReminderCategory;
  sourceType: ReminderSourceType;
  /** Human label, e.g. "Registration", "CTP insurance", "Fixed rate ends". */
  label: string;
  /** Optional provider/insurer/lender name for context. */
  provider?: string | null;
  /** Renewal/expiry due date, ISO string. */
  dueDate: string;
  /** Whole days until due. Negative = overdue. */
  daysUntilDue: number;
  urgency: ReminderUrgency;
  /** Where the user goes to act on it. */
  href: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days from `now` until `date` (negative if `date` is in the past). */
export function daysUntil(date: Date, now: Date): number {
  // Normalise both to UTC midnight so a renewal "today" reads as 0, not -1
  // because of a few hours' clock difference.
  const a = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / MS_PER_DAY);
}

export function urgencyFor(
  daysUntilDue: number,
  leadDays = DUE_SOON_LEAD_DAYS,
  upcomingWindow = UPCOMING_WINDOW_DAYS
): ReminderUrgency {
  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= leadDays) return 'DUE_SOON';
  if (daysUntilDue <= upcomingWindow) return 'UPCOMING';
  return 'OK';
}

const URGENCY_RANK: Record<ReminderUrgency, number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  UPCOMING: 2,
  OK: 3,
};

/** Stable sort: most→least urgent, then soonest due first. */
export function sortReminders(reminders: RenewalReminder[]): RenewalReminder[] {
  return [...reminders].sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      a.daysUntilDue - b.daysUntilDue
  );
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Producers
// ---------------------------------------------------------------------------

interface ComputeOpts {
  now?: Date;
  upcomingWindow?: number;
}

/**
 * Minimal asset shape this engine reads. Deliberately NOT the Prisma type so
 * the engine stays pure + decoupled (works with API JSON or DB rows).
 */
export interface AssetRenewalSource {
  id: string;
  name: string;
  type: string;
  status?: string | null;
  vehicleRegistrationExpiry?: string | Date | null;
  vehicleCtpExpiry?: string | Date | null;
  vehicleCtpProvider?: string | null;
  vehicleInsuranceExpiry?: string | Date | null;
  vehicleInsuranceProvider?: string | null;
  warrantyExpiry?: string | Date | null;
}

export interface LoanRenewalSource {
  id: string;
  name: string;
  rateType?: string | null;
  fixedExpiry?: string | Date | null;
}

export interface ConsentRenewalSource {
  id: string;
  /** Display name (institution / account label). */
  name: string;
  consentExpiresAt?: string | Date | null;
}

/**
 * Minimal property shape this engine reads. Renewal dates only — no
 * financial values (so this stays cheap to select + safe to pass around).
 */
export interface PropertyRenewalSource {
  id: string;
  name: string;
  councilRatesDueDate?: string | Date | null;
  waterRatesDueDate?: string | Date | null;
  landTaxDueDate?: string | Date | null;
  buildingInsuranceProvider?: string | null;
  buildingInsuranceExpiry?: string | Date | null;
  strataDueDate?: string | Date | null;
  leaseExpiry?: string | Date | null;
  complianceCertExpiry?: string | Date | null;
}

/**
 * Project asset reminders: vehicle renewals (registration / CTP / insurance,
 * vehicles only) + warranty expiry (any asset type). Returns EVERY reminder
 * with a date set (including OK ones), sorted. SOLD/WRITTEN_OFF assets produce
 * nothing.
 */
export function computeAssetRenewals(
  assets: AssetRenewalSource[],
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  const out: RenewalReminder[] = [];

  for (const asset of assets) {
    if (asset.status && asset.status !== 'ACTIVE') continue;
    const href = '/dashboard/assets';

    const push = (
      sourceType: ReminderSourceType,
      category: ReminderCategory,
      label: string,
      date: string | Date | null | undefined,
      provider?: string | null
    ) => {
      const due = toDate(date);
      if (!due) return;
      const daysUntilDue = daysUntil(due, now);
      out.push({
        id: `${asset.id}:${sourceType}`,
        entityId: asset.id,
        entityName: asset.name,
        category,
        sourceType,
        label,
        provider: provider ?? null,
        dueDate: due.toISOString(),
        daysUntilDue,
        urgency: urgencyFor(daysUntilDue, DUE_SOON_LEAD_DAYS, opts.upcomingWindow),
        href,
      });
    };

    if (asset.type === 'VEHICLE') {
      push('VEHICLE_REGISTRATION', 'VEHICLE', 'Registration', asset.vehicleRegistrationExpiry);
      push('VEHICLE_CTP', 'VEHICLE', 'CTP insurance', asset.vehicleCtpExpiry, asset.vehicleCtpProvider);
      push(
        'VEHICLE_INSURANCE',
        'VEHICLE',
        'Comprehensive insurance',
        asset.vehicleInsuranceExpiry,
        asset.vehicleInsuranceProvider
      );
    }
    push('ASSET_WARRANTY', 'WARRANTY', 'Warranty', asset.warrantyExpiry);
  }

  return sortReminders(out);
}

/**
 * Project property reminders: council/water rates, land tax, building &
 * contents insurance, strata levies, lease/rent-review, and compliance-cert
 * expiry. Each surfaces only when its date is set, so a renter who records
 * just a lease date gets exactly one reminder. The lease gets the longer lead
 * window — re-letting / rent review takes time to action.
 */
export function computePropertyRenewals(
  properties: PropertyRenewalSource[],
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  const out: RenewalReminder[] = [];

  for (const property of properties) {
    const href = '/dashboard/properties';

    const push = (
      sourceType: ReminderSourceType,
      label: string,
      date: string | Date | null | undefined,
      provider?: string | null,
      upcomingWindow?: number
    ) => {
      const due = toDate(date);
      if (!due) return;
      const daysUntilDue = daysUntil(due, now);
      out.push({
        id: `${property.id}:${sourceType}`,
        entityId: property.id,
        entityName: property.name,
        category: 'PROPERTY',
        sourceType,
        label,
        provider: provider ?? null,
        dueDate: due.toISOString(),
        daysUntilDue,
        urgency: urgencyFor(
          daysUntilDue,
          DUE_SOON_LEAD_DAYS,
          opts.upcomingWindow ?? upcomingWindow ?? UPCOMING_WINDOW_DAYS
        ),
        href,
      });
    };

    push('PROPERTY_COUNCIL_RATES', 'Council rates', property.councilRatesDueDate);
    push('PROPERTY_WATER_RATES', 'Water rates', property.waterRatesDueDate);
    push('PROPERTY_LAND_TAX', 'Land tax', property.landTaxDueDate);
    push(
      'PROPERTY_INSURANCE',
      'Building & contents insurance',
      property.buildingInsuranceExpiry,
      property.buildingInsuranceProvider
    );
    push('PROPERTY_STRATA', 'Strata / body corporate', property.strataDueDate);
    push(
      'PROPERTY_LEASE',
      'Lease renewal',
      property.leaseExpiry,
      null,
      LONG_LEAD_UPCOMING_WINDOW_DAYS
    );
    push('PROPERTY_COMPLIANCE', 'Compliance certificate', property.complianceCertExpiry);
  }

  return sortReminders(out);
}

/**
 * Project loan reminders: fixed-rate expiry (only when the rate is FIXED and
 * an expiry is set). Longer lead window — acting on a refinance takes time.
 */
export function computeLoanRenewals(
  loans: LoanRenewalSource[],
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  const out: RenewalReminder[] = [];

  for (const loan of loans) {
    if (loan.rateType && loan.rateType !== 'FIXED') continue;
    const due = toDate(loan.fixedExpiry);
    if (!due) continue;
    const daysUntilDue = daysUntil(due, now);
    out.push({
      id: `${loan.id}:LOAN_FIXED_EXPIRY`,
      entityId: loan.id,
      entityName: loan.name,
      category: 'LOAN',
      sourceType: 'LOAN_FIXED_EXPIRY',
      label: 'Fixed rate ends',
      dueDate: due.toISOString(),
      daysUntilDue,
      urgency: urgencyFor(
        daysUntilDue,
        DUE_SOON_LEAD_DAYS,
        opts.upcomingWindow ?? LONG_LEAD_UPCOMING_WINDOW_DAYS
      ),
      href: '/dashboard/loans',
    });
  }

  return sortReminders(out);
}

/**
 * Project bank-feed / CDR consent expiry reminders. Longer lead window — the
 * data feed dies when consent lapses, so prompt re-consent early.
 */
export function computeConsentReminders(
  connections: ConsentRenewalSource[],
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  const out: RenewalReminder[] = [];

  for (const conn of connections) {
    const due = toDate(conn.consentExpiresAt);
    if (!due) continue;
    const daysUntilDue = daysUntil(due, now);
    out.push({
      id: `${conn.id}:BANK_CONSENT`,
      entityId: conn.id,
      entityName: conn.name,
      category: 'CONSENT',
      sourceType: 'BANK_CONSENT',
      label: 'Bank connection consent expires',
      dueDate: due.toISOString(),
      daysUntilDue,
      urgency: urgencyFor(
        daysUntilDue,
        DUE_SOON_LEAD_DAYS,
        opts.upcomingWindow ?? LONG_LEAD_UPCOMING_WINDOW_DAYS
      ),
      href: '/dashboard/accounts',
    });
  }

  return sortReminders(out);
}

/** Merge every producer into one sorted list. */
export function computeAllReminders(
  input: {
    assets?: AssetRenewalSource[];
    properties?: PropertyRenewalSource[];
    loans?: LoanRenewalSource[];
    connections?: ConsentRenewalSource[];
  },
  opts: ComputeOpts = {}
): RenewalReminder[] {
  return sortReminders([
    ...computeAssetRenewals(input.assets ?? [], opts),
    ...computePropertyRenewals(input.properties ?? [], opts),
    ...computeLoanRenewals(input.loans ?? [], opts),
    ...computeConsentReminders(input.connections ?? [], opts),
  ]);
}

// ---------------------------------------------------------------------------
// Selectors / formatting
// ---------------------------------------------------------------------------

/** Reminders worth surfacing (everything except OK), preserving sort order. */
export function surfacedReminders(reminders: RenewalReminder[]): RenewalReminder[] {
  return reminders.filter((r) => r.urgency !== 'OK');
}

/** The single most-urgent surfaced reminder for one entity, or null. */
export function mostUrgentForEntity(
  reminders: RenewalReminder[],
  entityId: string
): RenewalReminder | null {
  const surfaced = surfacedReminders(reminders).filter((r) => r.entityId === entityId);
  return surfaced[0] ?? null;
}

/** Counts by urgency across a reminder set (for summary chips/badges). */
export function summariseReminders(reminders: RenewalReminder[]): {
  overdue: number;
  dueSoon: number;
  upcoming: number;
  total: number;
} {
  const surfaced = surfacedReminders(reminders);
  return {
    overdue: surfaced.filter((r) => r.urgency === 'OVERDUE').length,
    dueSoon: surfaced.filter((r) => r.urgency === 'DUE_SOON').length,
    upcoming: surfaced.filter((r) => r.urgency === 'UPCOMING').length,
    total: surfaced.length,
  };
}

/**
 * Warm, non-shaming relative-time phrase for a reminder. Behaviour-psychology
 * rule (CLAUDE.md §0): normalise + guide, never alarm. "Due in 12 days", not
 * "URGENT". Overdue stated plainly so it's actionable, not punitive.
 */
export function renewalTimingLabel(daysUntilDue: number): string {
  if (daysUntilDue < -1) return `Overdue by ${Math.abs(daysUntilDue)} days`;
  if (daysUntilDue === -1) return 'Overdue by 1 day';
  if (daysUntilDue === 0) return 'Due today';
  if (daysUntilDue === 1) return 'Due tomorrow';
  return `Due in ${daysUntilDue} days`;
}
