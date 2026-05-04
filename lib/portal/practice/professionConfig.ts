/**
 * Profession-aware Practice dashboard configuration.
 *
 * Reza decision (2026-05-04, four-lens recommendation): the same Practice
 * surface serves three profession personas — `FINANCIAL_ADVISOR`,
 * `MORTGAGE_BROKER`, `ACCOUNTING_FIRM` — by swapping defaults, not the
 * underlying engine. One canonical client view + book engine; columns,
 * alert filters, and AFSL/credit-licence framing change per profession.
 *
 * `OrganizationType` is the existing Prisma enum; we map only the three
 * professions we support at v1 here. Other types (TAX_AGENT, BOOKKEEPER,
 * OTHER) fall back to the accountant config for v1 — re-evaluate when those
 * professions get explicit support.
 */
import type { OrganizationType } from '@prisma/client';
import type { AlertTriggerKind } from './lighthouseDataset';

export type ClientBookColumnKey =
  | 'trail'
  | 'health'
  | 'netWorth'
  | 'cashflow'
  | 'lastSeen'
  | 'lvr'
  | 'equityAvailable'
  | 'taxPositionYtd'
  | 'missingReceipts'
  | 'basDue';

export interface ClientBookColumn {
  key: ClientBookColumnKey;
  label: string;
  align?: 'left' | 'right';
}

export interface PracticeProfessionConfig {
  /** OrganizationType key */
  professionKey: OrganizationType;
  /** Display label in chrome ("Adviser practice", "Broker practice"...) */
  practiceLabel: string;
  /** One-line tone caption shown under the morning hello */
  bookCaption: string;
  /** Alert kinds that surface by default for this profession */
  alertTriggers: AlertTriggerKind[];
  /** Default columns in the client book */
  columns: ClientBookColumn[];
  /** AFSL / credit / tax-agent compliance footnote shown on the surface */
  complianceFootnote: string;
}

const ADVISER: PracticeProfessionConfig = {
  professionKey: 'FINANCIAL_ADVISOR',
  practiceLabel: 'Adviser practice',
  bookCaption: "Here's where your book stands today.",
  alertTriggers: [
    'TRAIL_ADVANCED',
    'HEALTH_DROP',
    'CASHFLOW_NEGATIVE',
    'EMERGENCY_FUND_LOW',
    'INCOME_DROPPED',
    'PROPERTY_ADDED',
  ],
  columns: [
    { key: 'trail', label: 'TRAIL' },
    { key: 'health', label: 'Health' },
    { key: 'netWorth', label: 'Net worth', align: 'right' },
    { key: 'cashflow', label: 'Cashflow', align: 'right' },
    { key: 'lastSeen', label: 'Last seen' },
  ],
  complianceFootnote:
    'General information only. Recommendations are issued under your AFSL — Monitrax surfaces signals, you provide the advice.',
};

const BROKER: PracticeProfessionConfig = {
  professionKey: 'MORTGAGE_BROKER',
  practiceLabel: 'Broker practice',
  bookCaption: "Here's where your loan book stands today.",
  alertTriggers: [
    'LVR_REFINANCE_WINDOW',
    'PROPERTY_ADDED',
    'CASHFLOW_NEGATIVE',
    'INCOME_DROPPED',
  ],
  columns: [
    { key: 'lvr', label: 'LVR', align: 'right' },
    { key: 'equityAvailable', label: 'Equity available', align: 'right' },
    { key: 'cashflow', label: 'Cashflow', align: 'right' },
    { key: 'health', label: 'Health' },
    { key: 'lastSeen', label: 'Last seen' },
  ],
  complianceFootnote:
    'General information only. Credit recommendations are issued under your ACL — Monitrax surfaces refinance windows, you originate.',
};

const ACCOUNTANT: PracticeProfessionConfig = {
  professionKey: 'ACCOUNTING_FIRM',
  practiceLabel: 'Accounting practice',
  bookCaption: "Here's where your client tax positions stand today.",
  alertTriggers: [
    'BAS_DUE',
    'TAX_POSITION_CHANGED',
    'PROPERTY_ADDED',
    'INCOME_DROPPED',
  ],
  columns: [
    { key: 'taxPositionYtd', label: 'Tax YTD', align: 'right' },
    { key: 'missingReceipts', label: 'Missing receipts', align: 'right' },
    { key: 'basDue', label: 'BAS due' },
    { key: 'health', label: 'Health' },
    { key: 'lastSeen', label: 'Last seen' },
  ],
  complianceFootnote:
    'General information only. Tax advice is issued under your tax agent registration — Monitrax surfaces gaps, you advise.',
};

const REGISTRY: Partial<Record<OrganizationType, PracticeProfessionConfig>> = {
  FINANCIAL_ADVISOR: ADVISER,
  MORTGAGE_BROKER: BROKER,
  ACCOUNTING_FIRM: ACCOUNTANT,
};

export const getPracticeProfessionConfig = (
  profession: OrganizationType,
): PracticeProfessionConfig => {
  // Tax agents + bookkeepers fall back to accountant config at v1; OTHER → adviser.
  return REGISTRY[profession] ?? (profession === 'OTHER' ? ADVISER : ACCOUNTANT);
};

export const PROFESSION_OPTIONS: ReadonlyArray<{
  key: OrganizationType;
  label: string;
  hint: string;
}> = [
  { key: 'FINANCIAL_ADVISOR', label: 'Financial adviser', hint: 'AFSL — advice on wealth, super, insurance' },
  { key: 'MORTGAGE_BROKER', label: 'Mortgage broker', hint: 'ACL — origination + refinance' },
  { key: 'ACCOUNTING_FIRM', label: 'Accountant / tax agent', hint: 'TPB — tax + structure + BAS' },
];
