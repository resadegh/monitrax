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
 * Tier 2 also projects user-created custom reminders (`computeCustomReminders`,
 * R1 PR2b) and the transaction-import-cadence nudge (`computeImportReminder`,
 * R7 — "time to import your latest transactions") through the same feed + state
 * machinery.
 *
 * Tier 2/3 extend this engine with: (a) term-deposit maturity, standalone
 * insurance, personal-document expiry as further producers; (b) persisted
 * snooze/dismiss/done state — the pure `applyReminderStates()` merge below is
 * shipped (R1 PR1), surfaced via the in-app bell (PR2); the bank-detected bills
 * feed (`computeBillReminders` from RecurringPayment.nextExpected, opt-in via
 * `pushBillReminders`) is shipped (PR3); (c) email/push delivery gated by
 * `UserPreference` via a daily Cloud Scheduler sweep (R2).
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

/**
 * Transaction-import cadence (R7): nudge ~monthly. The reminder is "due" this
 * many days after the data currently runs to, and only surfaces inside a short
 * window around that — so a user who imported recently isn't nagged 3 weeks
 * early, while a user a month behind is reminded.
 */
export const IMPORT_CADENCE_DAYS = 30;
const IMPORT_LEAD_DAYS = 7;
const IMPORT_UPCOMING_WINDOW_DAYS = 14;

/**
 * Bank-detected bills (R1 PR3) recur often, so they surface on a short fuse —
 * a few days before due, plus anything recently overdue — to stay useful, not
 * noisy. Opt-in: the feed only emits these when the user's `pushBillReminders`
 * preference is on.
 */
const BILL_LEAD_DAYS = 3;
const BILL_UPCOMING_WINDOW_DAYS = 7;

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
  | 'BANK_CONSENT'
  | 'CUSTOM'
  | 'IMPORT_DUE'
  | 'BILL_DUE';

/** Broad category — drives icon/colour grouping + the "act here" href. */
export type ReminderCategory = 'VEHICLE' | 'WARRANTY' | 'PROPERTY' | 'LOAN' | 'CONSENT' | 'CUSTOM' | 'IMPORT' | 'BILL';

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

/** User-created custom reminder (Phase 21.5 R1 PR2b). */
export interface CustomReminderSource {
  id: string;
  title: string;
  dueDate?: string | Date | null;
  /** Optional free-text note shown as the row subtitle. */
  note?: string | null;
}

/**
 * Bank-detected recurring bill (Phase 21.5 R1 PR3). Projected from the existing
 * `RecurringPayment` detection — this engine does NOT detect bills, it only
 * surfaces the next-due ones as reminders.
 */
export interface BillReminderSource {
  id: string;
  /** Standardised merchant name (e.g. "Netflix"). */
  merchant: string;
  expectedAmount?: number | null;
  nextExpected?: string | Date | null;
  /** RecurrencePattern value (WEEKLY / MONTHLY / …) for the cadence label. */
  pattern?: string | null;
}

/**
 * Transaction-import cadence (Phase 21.5 R7). Drives the "time to import your
 * latest transactions" reminder for users who rely on manual import (Basiq off,
 * or a non-feed account). One reminder per user, not per entity.
 */
export interface ImportCadenceSource {
  /** Latest transaction date the user has imported (max ImportBatch.dateRangeEnd). */
  lastImportedThrough?: string | Date | null;
  /** Earliest non-Basiq account creation — anchors the nudge when nothing imported yet. */
  earliestManualAccountCreatedAt?: string | Date | null;
  /** Whether the user has any account not on an automatic feed (i.e. relies on import). */
  hasManualAccounts: boolean;
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

/**
 * Project user-created custom reminders. The title is the headline; the note
 * (if any) becomes the row subtitle. These have no entity page, so `href` is
 * empty — consumers render them non-navigable. Snooze/dismiss/done is shared
 * with derived reminders via the `${id}:CUSTOM` key + `ReminderState`.
 */
export function computeCustomReminders(
  reminders: CustomReminderSource[],
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  const out: RenewalReminder[] = [];

  for (const reminder of reminders) {
    const due = toDate(reminder.dueDate);
    if (!due) continue;
    const daysUntilDue = daysUntil(due, now);
    out.push({
      id: `${reminder.id}:CUSTOM`,
      entityId: reminder.id,
      entityName: reminder.title,
      category: 'CUSTOM',
      sourceType: 'CUSTOM',
      label: '', // the title IS the reminder — no secondary label
      provider: reminder.note ?? null,
      dueDate: due.toISOString(),
      daysUntilDue,
      urgency: urgencyFor(daysUntilDue, DUE_SOON_LEAD_DAYS, opts.upcomingWindow),
      href: '', // no entity destination — consumers render non-navigable
    });
  }

  return sortReminders(out);
}

/**
 * Project the transaction-import-cadence reminder (R7). Returns at most one
 * reminder, and only for users who rely on manual import. A short surfacing
 * window means it appears as their data approaches/passes a month stale, not
 * weeks early. The import action advances `lastImportedThrough`, so the
 * due-date cycle moves forward and any prior dismiss/done auto-resets — i.e.
 * importing makes the reminder go away, and it returns next cycle.
 */
export function computeImportReminder(
  src: ImportCadenceSource,
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  if (!src.hasManualAccounts) return []; // Basiq-fed / no accounts → nothing to import

  const lastThrough = toDate(src.lastImportedThrough);
  const anchor = lastThrough ?? toDate(src.earliestManualAccountCreatedAt);
  if (!anchor) return []; // no accounts yet → don't nag

  const due = new Date(anchor.getTime() + IMPORT_CADENCE_DAYS * MS_PER_DAY);
  const daysUntilDue = daysUntil(due, now);

  return [
    {
      id: 'transactions:IMPORT_DUE',
      entityId: 'transactions',
      entityName: 'Your transactions',
      category: 'IMPORT',
      sourceType: 'IMPORT_DUE',
      label: 'Time to import',
      provider: lastThrough
        ? `Up to date through ${lastThrough.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`
        : 'No transactions imported yet',
      dueDate: due.toISOString(),
      daysUntilDue,
      urgency: urgencyFor(daysUntilDue, IMPORT_LEAD_DAYS, IMPORT_UPCOMING_WINDOW_DAYS),
      href: '/dashboard/balances?action=import',
    },
  ];
}

/** Human cadence label per RecurrencePattern. */
const BILL_PATTERN_LABEL: Record<string, string> = {
  WEEKLY: 'weekly',
  FORTNIGHTLY: 'fortnightly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'yearly',
  IRREGULAR: 'recurring',
};

/**
 * Project bank-detected recurring bills (R1 PR3): one reminder per bill that's
 * due soon (or recently overdue). Short fuse + the caller's opt-in gate keep
 * the high-volume feed calm. Amount + cadence become the row subtitle (the
 * user's own data, shown in-app only — never logged; CLAUDE.md §13.3).
 */
export function computeBillReminders(
  bills: BillReminderSource[],
  opts: ComputeOpts = {}
): RenewalReminder[] {
  const now = opts.now ?? new Date();
  const out: RenewalReminder[] = [];

  for (const bill of bills) {
    const due = toDate(bill.nextExpected);
    if (!due) continue;
    const daysUntilDue = daysUntil(due, now);
    const amount =
      typeof bill.expectedAmount === 'number'
        ? bill.expectedAmount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
        : null;
    const cadence = bill.pattern ? BILL_PATTERN_LABEL[bill.pattern] ?? null : null;
    const subtitle = [amount, cadence].filter(Boolean).join(' · ') || null;
    out.push({
      id: `${bill.id}:BILL_DUE`,
      entityId: bill.id,
      entityName: bill.merchant,
      category: 'BILL',
      sourceType: 'BILL_DUE',
      label: 'Bill due',
      provider: subtitle,
      dueDate: due.toISOString(),
      daysUntilDue,
      urgency: urgencyFor(daysUntilDue, BILL_LEAD_DAYS, BILL_UPCOMING_WINDOW_DAYS),
      href: '/recurring',
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
    custom?: CustomReminderSource[];
    importCadence?: ImportCadenceSource;
    bills?: BillReminderSource[];
  },
  opts: ComputeOpts = {}
): RenewalReminder[] {
  return sortReminders([
    ...computeAssetRenewals(input.assets ?? [], opts),
    ...computePropertyRenewals(input.properties ?? [], opts),
    ...computeLoanRenewals(input.loans ?? [], opts),
    ...computeConsentReminders(input.connections ?? [], opts),
    ...computeCustomReminders(input.custom ?? [], opts),
    ...(input.importCadence ? computeImportReminder(input.importCadence, opts) : []),
    ...computeBillReminders(input.bills ?? [], opts),
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

// ---------------------------------------------------------------------------
// Tier 2 — user state (snooze / dismiss / done)
// ---------------------------------------------------------------------------

/**
 * Persisted user action on a reminder (Phase 21.5 Tier 2). Mirrors the
 * `ReminderState` row but stays a plain shape so this engine remains pure +
 * Prisma-free. `reminderKey` is the engine's synthetic id
 * (`${entityId}:${sourceType}`); `dueDate` is the cycle the action was taken
 * against.
 */
export interface ReminderStateInput {
  reminderKey: string;
  dueDate: string | Date;
  status: 'SNOOZED' | 'DISMISSED' | 'DONE';
  snoozedUntil?: string | Date | null;
}

/** Live, post-merge state of a reminder for a given user + cycle. */
export type ReminderLiveState = 'ACTIVE' | 'SNOOZED' | 'DISMISSED' | 'DONE';

/** A reminder annotated with the user's current action state. */
export interface AnnotatedReminder extends RenewalReminder {
  state: ReminderLiveState;
  /** ISO instant the snooze lifts, when `state === 'SNOOZED'`. */
  snoozedUntil?: string | null;
}

/** Date-level (YYYY-MM-DD) equality — ignores time-of-day + tz drift. */
function sameDueDay(a: string | Date | null | undefined, b: string): boolean {
  const da = toDate(a);
  if (!da) return false;
  return da.toISOString().slice(0, 10) === b.slice(0, 10);
}

/**
 * Merge persisted user state onto projected reminders (PURE — no fetch, no
 * mutation; CLAUDE.md §6.4). A state row applies ONLY when its `dueDate`
 * matches the live reminder's `dueDate` (date-level): so when a renewal rolls
 * to its next cycle (the user updates the date), a prior dismiss/done/snooze
 * naturally resets and the reminder re-surfaces. An expired snooze
 * (`snoozedUntil` already passed) also reverts to ACTIVE. Reminders with no
 * matching state row are ACTIVE.
 */
export function applyReminderStates(
  reminders: RenewalReminder[],
  states: ReminderStateInput[],
  opts: { now?: Date } = {}
): AnnotatedReminder[] {
  const now = opts.now ?? new Date();
  const byKey = new Map(states.map((s) => [s.reminderKey, s]));

  return reminders.map((r) => {
    const s = byKey.get(r.id);
    // No state, or state belongs to a previous due-date cycle → ACTIVE.
    if (!s || !sameDueDay(s.dueDate, r.dueDate)) {
      return { ...r, state: 'ACTIVE' as const };
    }
    if (s.status === 'SNOOZED') {
      const until = toDate(s.snoozedUntil);
      if (until && until.getTime() > now.getTime()) {
        return { ...r, state: 'SNOOZED' as const, snoozedUntil: until.toISOString() };
      }
      return { ...r, state: 'ACTIVE' as const }; // snooze has lapsed
    }
    // DISMISSED | DONE — held for this cycle.
    return { ...r, state: s.status };
  });
}

/**
 * Reminders the user should see right now: ACTIVE only. Snoozed/dismissed/done
 * are held back (the notification centre can still surface them separately).
 */
export function visibleReminders(annotated: AnnotatedReminder[]): AnnotatedReminder[] {
  return annotated.filter((r) => r.state === 'ACTIVE');
}
