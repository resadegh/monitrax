/**
 * Lighthouse Demo Dataset — Practice (B2B2C) v1
 *
 * Five fictitious Australian property-investor clients across all five TRAIL
 * stages, with alerts spanning every v1 trigger type (TRAIL advanced, Health
 * drop, Cashflow flipped negative, LVR <80%, Emergency fund <1mo). Used by
 * the Practice dashboard at `/portal/dashboard` to demo the cross-client
 * alert stream + client book to a lighthouse adviser without needing a
 * Basiq-connected production cohort.
 *
 * Numbers are realistic enough to feel like a real adviser's book, but
 * intentionally rounded — this is a UI fixture, not a financial calculator.
 * Fixtures live alongside the practice surface so they ship with the demo.
 *
 * When the alert engine starts reading real snapshot deltas (PR3+) this
 * module stays — it remains the storybook/E2E fixture and the empty-state
 * preview for orgs that haven't onboarded a real client yet.
 */
import type { TrailStage } from './types';

export type AlertSeverity = 'critical' | 'opportunity' | 'milestone';

export type AlertTriggerKind =
  | 'TRAIL_ADVANCED'
  | 'HEALTH_DROP'
  | 'CASHFLOW_NEGATIVE'
  | 'LVR_REFINANCE_WINDOW'
  | 'EMERGENCY_FUND_LOW'
  | 'PROPERTY_ADDED'
  | 'TAX_POSITION_CHANGED'
  | 'BAS_DUE'
  | 'INCOME_DROPPED';

export interface DemoAlert {
  id: string;
  clientId: string;
  triggerKind: AlertTriggerKind;
  severity: AlertSeverity;
  headline: string;
  body: string;
  context: string; // e.g. "Health 42 ↓18 · cashflow -$340/mo · last contact 41 days"
  primaryActionLabel: string;
  detectedAt: string; // ISO date string
}

export interface DemoClient {
  id: string;
  initials: string;
  name: string;
  email: string;
  trailStage: TrailStage;
  trailDelta?: 'advanced' | 'regressed' | null;
  healthScore: number;
  healthDelta30d: number;
  netWorthAud: number;
  monthlyCashflowAud: number;
  monthlyIncomeAud: number;
  lvr?: number | null;
  equityAvailableAud?: number | null;
  emergencyFundMonths?: number | null;
  taxPositionYtdAud?: number | null;
  missingReceiptsCount?: number | null;
  basDueDate?: string | null;
  propertiesCount: number;
  loansCount: number;
  lastContactDays: number;
  lastSnapshotIso: string;
}

const todayIso = (offsetDays = 0): string => {
  const d = new Date('2026-05-04T08:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString();
};

export const LIGHTHOUSE_CLIENTS: DemoClient[] = [
  {
    id: 'demo-client-sarah-kim',
    initials: 'SK',
    name: 'Sarah Kim',
    email: 'sarah.kim@example.com.au',
    trailStage: 'TRACK',
    trailDelta: null,
    healthScore: 42,
    healthDelta30d: -18,
    netWorthAud: 312_400,
    monthlyCashflowAud: -340,
    monthlyIncomeAud: 8_900,
    lvr: 0.82,
    equityAvailableAud: 0,
    emergencyFundMonths: 0.7,
    propertiesCount: 1,
    loansCount: 2,
    lastContactDays: 41,
    lastSnapshotIso: todayIso(0),
  },
  {
    id: 'demo-client-david-mei',
    initials: 'DM',
    name: 'David Mei',
    email: 'david.mei@example.com.au',
    trailStage: 'REDUCE',
    trailDelta: 'advanced',
    healthScore: 78,
    healthDelta30d: 9,
    netWorthAud: 1_412_000,
    monthlyCashflowAud: 2_140,
    monthlyIncomeAud: 14_500,
    lvr: 0.71,
    equityAvailableAud: 38_000,
    emergencyFundMonths: 4.2,
    propertiesCount: 1,
    loansCount: 1,
    lastContactDays: 2,
    lastSnapshotIso: todayIso(0),
  },
  {
    id: 'demo-client-emma-liu',
    initials: 'EL',
    name: 'Emma Liu',
    email: 'emma.liu@example.com.au',
    trailStage: 'INVEST',
    trailDelta: null,
    healthScore: 84,
    healthDelta30d: 2,
    netWorthAud: 2_146_000,
    monthlyCashflowAud: 3_820,
    monthlyIncomeAud: 22_400,
    lvr: 0.78,
    equityAvailableAud: 128_000,
    emergencyFundMonths: 6.5,
    taxPositionYtdAud: -12_400,
    propertiesCount: 3,
    loansCount: 2,
    lastContactDays: 0,
    lastSnapshotIso: todayIso(0),
  },
  {
    id: 'demo-client-noah-patel',
    initials: 'NP',
    name: 'Noah Patel',
    email: 'noah.patel@example.com.au',
    trailStage: 'ANCHOR',
    trailDelta: null,
    healthScore: 64,
    healthDelta30d: -3,
    netWorthAud: 824_500,
    monthlyCashflowAud: 920,
    monthlyIncomeAud: 11_200,
    lvr: 0.74,
    equityAvailableAud: 22_000,
    emergencyFundMonths: 2.4,
    taxPositionYtdAud: 3_100,
    missingReceiptsCount: 14,
    basDueDate: todayIso(-9), // BAS due in 9 days
    propertiesCount: 2,
    loansCount: 2,
    lastContactDays: 18,
    lastSnapshotIso: todayIso(0),
  },
  {
    id: 'demo-client-olivia-novak',
    initials: 'ON',
    name: 'Olivia Novak',
    email: 'olivia.novak@example.com.au',
    trailStage: 'LIVE',
    trailDelta: null,
    healthScore: 91,
    healthDelta30d: 1,
    netWorthAud: 4_320_000,
    monthlyCashflowAud: 8_640,
    monthlyIncomeAud: 28_900,
    lvr: 0.42,
    equityAvailableAud: 612_000,
    emergencyFundMonths: 11,
    taxPositionYtdAud: -38_900,
    missingReceiptsCount: 0,
    propertiesCount: 4,
    loansCount: 2,
    lastContactDays: 6,
    lastSnapshotIso: todayIso(0),
  },
];

/**
 * Profession-agnostic alerts. The Practice dashboard filters this list per
 * profession (`practiceProfessionConfig.alertTriggers`) so the same fixtures
 * power adviser, broker, and accountant views without duplicate data.
 */
export const LIGHTHOUSE_ALERTS: DemoAlert[] = [
  {
    id: 'alert-sarah-emergency',
    clientId: 'demo-client-sarah-kim',
    triggerKind: 'EMERGENCY_FUND_LOW',
    severity: 'critical',
    headline: 'Emergency fund dropped below 1 month',
    body: 'Buffer at 0.7 months. Cashflow turned negative this fortnight.',
    context: 'Health 42 ↓18  ·  cashflow -$340/mo  ·  last contact 41 days',
    primaryActionLabel: 'Schedule call',
    detectedAt: todayIso(0),
  },
  {
    id: 'alert-sarah-cashflow',
    clientId: 'demo-client-sarah-kim',
    triggerKind: 'CASHFLOW_NEGATIVE',
    severity: 'critical',
    headline: 'Monthly cashflow turned negative',
    body: 'Net -$340/mo on rolling 30-day. Repayments lifted with rate review.',
    context: 'Income $8,900  ·  expenses $9,240  ·  fixed cost share 71%',
    primaryActionLabel: 'Review budget',
    detectedAt: todayIso(0),
  },
  {
    id: 'alert-david-trail',
    clientId: 'demo-client-david-mei',
    triggerKind: 'TRAIL_ADVANCED',
    severity: 'milestone',
    headline: 'TRAIL stage advanced TRACK → REDUCE',
    body: 'Positive monthly cashflow held for 90 days. Behavioural milestone.',
    context: 'Cashflow +$2,140/mo  ·  Health 78 ↑9  ·  budget adherence 81%',
    primaryActionLabel: 'Send congratulations',
    detectedAt: todayIso(1),
  },
  {
    id: 'alert-emma-lvr',
    clientId: 'demo-client-emma-liu',
    triggerKind: 'LVR_REFINANCE_WINDOW',
    severity: 'opportunity',
    headline: 'LVR crossed below 80% — refinance window opened',
    body: 'Equity available $128,000. Current rate 6.34% on $1.18m balance.',
    context: 'LVR 78%  ·  equity $128k  ·  no rate review in 14 months',
    primaryActionLabel: 'Model refinance',
    detectedAt: todayIso(2),
  },
  {
    id: 'alert-noah-bas',
    clientId: 'demo-client-noah-patel',
    triggerKind: 'BAS_DUE',
    severity: 'critical',
    headline: 'BAS due in 9 days · 14 missing receipts',
    body: 'Q3 BAS lodgement window closes 13 May. Receipt gap unresolved.',
    context: 'Tax YTD +$3,100 owed  ·  receipts missing 14  ·  last review 18d',
    primaryActionLabel: 'Open BAS prep',
    detectedAt: todayIso(0),
  },
  {
    id: 'alert-noah-health',
    clientId: 'demo-client-noah-patel',
    triggerKind: 'HEALTH_DROP',
    severity: 'opportunity',
    headline: 'Health score drifting (64, ↓3 over 30 days)',
    body: 'Anchor stage but losing ground. Emergency fund slipped to 2.4 months.',
    context: 'Anchor stage  ·  emergency fund 2.4mo  ·  cashflow +$920',
    primaryActionLabel: 'Schedule check-in',
    detectedAt: todayIso(3),
  },
  {
    id: 'alert-olivia-tax',
    clientId: 'demo-client-olivia-novak',
    triggerKind: 'TAX_POSITION_CHANGED',
    severity: 'opportunity',
    headline: 'Negative gearing position widened to -$38,900 YTD',
    body: 'Depreciation Div 40/43 + interest deductions trending above plan.',
    context: 'Live stage  ·  4 properties  ·  Health 91  ·  tax YTD -$38,900',
    primaryActionLabel: 'Review structure',
    detectedAt: todayIso(4),
  },
];

export interface PracticeKpis {
  activeClients: number;
  needsAttention: number;
  trailAdvancedThisWeek: number;
  averageHealth: number;
  averageHealthDelta: number;
}

export const computeKpis = (
  clients: DemoClient[],
  alerts: DemoAlert[],
): PracticeKpis => {
  const clientsWithAlert = new Set(
    alerts.filter((a) => a.severity === 'critical' || a.severity === 'opportunity').map((a) => a.clientId),
  );
  const trailAdvanced = clients.filter((c) => c.trailDelta === 'advanced').length;
  const avg = clients.reduce((s, c) => s + c.healthScore, 0) / clients.length;
  const avgDelta = clients.reduce((s, c) => s + c.healthDelta30d, 0) / clients.length;
  return {
    activeClients: clients.length,
    needsAttention: clientsWithAlert.size,
    trailAdvancedThisWeek: trailAdvanced,
    averageHealth: Math.round(avg),
    averageHealthDelta: Math.round(avgDelta * 10) / 10,
  };
};
