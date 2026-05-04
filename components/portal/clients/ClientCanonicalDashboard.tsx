/**
 * Phase 32B PR3 — Canonical client dashboard rendered through the
 * professional drill-in.
 *
 * Renders the SAME canonical primitives the consumer dashboard uses
 * (MasterFinancialSnapshot from `lib/services/masterFinancialService.ts`).
 * No mode flag inside the consumer dashboard files; instead the drill-in
 * page composes the canonical widgets with a viewer-aware snapshot. Per
 * Phase 32B hard constraint: drill-in renders the consumer dashboard
 * verbatim — not a separate `ClientDetail.tsx`.
 *
 * Tiles outside the granted scope render as locked placeholders so the
 * professional sees *what the client could grant next*, not a blank
 * column. Behaviour-psychology lens: makes the next consent extension
 * an obvious next-best-action rather than a hidden capability.
 */

'use client';

import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { DataAccessScope } from '@prisma/client';
import { formatCurrency } from '@/lib/utils/formatters';

interface ClientCanonicalDashboardProps {
  snapshot: MasterFinancialSnapshot;
  appliedScopes: DataAccessScope[];
}

export function ClientCanonicalDashboard({
  snapshot,
  appliedScopes,
}: ClientCanonicalDashboardProps) {
  const has = (s: DataAccessScope) => appliedScopes.includes('FULL') || appliedScopes.includes(s);

  return (
    <div className="space-y-8">
      {/* KPI strip — driven by snapshot.quickMetrics */}
      <section
        aria-label="Headline metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <KpiTile
          label="Net worth"
          value={formatCurrency(snapshot.quickMetrics.netWorthValue, { abbreviate: true })}
          tone="primary"
        />
        <KpiTile
          label="Monthly cashflow"
          value={formatCurrency(snapshot.quickMetrics.monthlyCashflow, { abbreviate: true })}
          tone={snapshot.quickMetrics.monthlyCashflow >= 0 ? 'positive' : 'negative'}
          locked={!has('FINANCIAL')}
        />
        <KpiTile
          label="Liquid cash"
          value={formatCurrency(snapshot.quickMetrics.liquidCash, { abbreviate: true })}
          locked={!has('FINANCIAL')}
        />
        <KpiTile
          label="Savings rate"
          value={`${snapshot.quickMetrics.savingsRate.toFixed(1)}%`}
          locked={!has('FINANCIAL')}
        />
      </section>

      {/* Health */}
      <Card title="Financial health" badge={`Grade ${snapshot.healthScore.grade}`}>
        <div className="flex items-end gap-4">
          <div className="text-4xl font-bold text-slate-900">{snapshot.healthScore.score}</div>
          <p className="text-sm text-slate-500 pb-1">/ 100</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <HealthComponentRow label="Savings rate" value={snapshot.healthScore.components.savingsRate.score} />
          <HealthComponentRow label="Emergency fund" value={snapshot.healthScore.components.emergencyFund.score} />
          <HealthComponentRow label="Debt to income" value={snapshot.healthScore.components.debtToIncome.score} />
          <HealthComponentRow label="Net-worth growth" value={snapshot.healthScore.components.netWorthGrowth.score} />
        </dl>
      </Card>

      {/* Cashflow */}
      <Card title="Cashflow" subtle="Monthly">
        {has('FINANCIAL') ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <CashflowRow
              label="Income"
              gross={snapshot.cashflow.monthlyGrossIncome}
              net={snapshot.cashflow.monthlyNetIncome}
            />
            <CashflowRow label="Expenses" gross={snapshot.cashflow.monthlyExpenses} />
            <CashflowRow
              label="Cashflow"
              gross={snapshot.cashflow.monthlyCashflow}
              tone={snapshot.cashflow.monthlyCashflow >= 0 ? 'positive' : 'negative'}
            />
          </div>
        ) : (
          <ScopeLocked scope="FINANCIAL" />
        )}
      </Card>

      {/* Properties */}
      {snapshot.properties.length > 0 ? (
        <Card title="Property portfolio" subtle={`${snapshot.properties.length} held`}>
          <ul className="divide-y divide-slate-100">
            {snapshot.properties.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(p.currentValue, { abbreviate: true })} · LVR {p.lvr.toFixed(0)}% · Yield{' '}
                    {p.rentalYield.toFixed(1)}%
                  </p>
                </div>
                <div className={p.monthlyCashflow >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatCurrency(p.monthlyCashflow, { abbreviate: true })}/mo
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : has('PROPERTIES') ? null : (
        <Card title="Property portfolio">
          <ScopeLocked scope="PROPERTIES" />
        </Card>
      )}

      {/* Loans / debt */}
      <Card title="Debt" subtle={`DTI ${snapshot.debt.metrics.debtToIncomeRatio.toFixed(2)}`}>
        {has('LOANS') ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Total debt" value={formatCurrency(snapshot.debt.metrics.totalDebt, { abbreviate: true })} />
            <Stat
              label="Monthly repayments"
              value={formatCurrency(snapshot.debt.metrics.monthlyRepayments, { abbreviate: true })}
            />
            <Stat
              label="Weighted rate"
              value={`${snapshot.debt.summary.weightedInterestRate.toFixed(2)}%`}
            />
            <Stat
              label="Debt service ratio"
              value={`${(snapshot.debt.metrics.debtServiceRatio * 100).toFixed(1)}%`}
            />
          </div>
        ) : (
          <ScopeLocked scope="LOANS" />
        )}
      </Card>

      {/* Investments */}
      <Card title="Investments" subtle={`${snapshot.investments.holdingsCount} holdings`}>
        {has('INVESTMENTS') ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Portfolio value" value={formatCurrency(snapshot.investments.totalValue, { abbreviate: true })} />
            <Stat label="Cost base" value={formatCurrency(snapshot.investments.totalCostBase, { abbreviate: true })} />
            <Stat
              label="Unrealised gain"
              value={formatCurrency(snapshot.investments.unrealisedGain, { abbreviate: true })}
              tone={snapshot.investments.unrealisedGain >= 0 ? 'positive' : 'negative'}
            />
            <Stat
              label="Return"
              value={`${snapshot.investments.unrealisedGainPercent.toFixed(1)}%`}
              tone={snapshot.investments.unrealisedGainPercent >= 0 ? 'positive' : 'negative'}
            />
          </div>
        ) : (
          <ScopeLocked scope="INVESTMENTS" />
        )}
      </Card>

      {/* Tax */}
      <Card title="Tax" subtle={`Rate ${snapshot.tax.effectiveTaxRate.toFixed(1)}%`}>
        {has('TAX') ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat
              label="Estimated taxable income"
              value={formatCurrency(snapshot.tax.estimatedTaxableIncome, { abbreviate: true })}
            />
            <Stat
              label="Estimated tax payable"
              value={formatCurrency(snapshot.tax.estimatedTaxPayable, { abbreviate: true })}
            />
            <Stat
              label="Total deductions"
              value={formatCurrency(snapshot.tax.totalDeductions, { abbreviate: true })}
            />
            <Stat
              label="Estimated refund / owing"
              value={formatCurrency(snapshot.tax.estimatedRefundOrOwing, { abbreviate: true })}
              tone={snapshot.tax.estimatedRefundOrOwing >= 0 ? 'positive' : 'negative'}
            />
          </div>
        ) : (
          <ScopeLocked scope="TAX" />
        )}
      </Card>

      {/* Emergency fund */}
      <Card title="Emergency fund" subtle={`${snapshot.emergencyFund.monthsCovered.toFixed(1)} months covered`}>
        {has('FINANCIAL') ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Liquid cash" value={formatCurrency(snapshot.emergencyFund.liquidCash, { abbreviate: true })} />
            <Stat
              label="Target"
              value={`${snapshot.emergencyFund.targetMonths} mo`}
            />
            <Stat
              label="Status"
              value={snapshot.emergencyFund.status}
              tone={statusTone(snapshot.emergencyFund.status)}
            />
            <Stat
              label="Gap"
              value={formatCurrency(snapshot.emergencyFund.gap, { abbreviate: true })}
            />
          </div>
        ) : (
          <ScopeLocked scope="FINANCIAL" />
        )}
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone = 'neutral',
  locked = false,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'positive' | 'negative' | 'neutral';
  locked?: boolean;
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
      ? 'text-rose-700'
      : tone === 'primary'
      ? 'text-slate-900'
      : 'text-slate-700';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass} ${locked ? 'opacity-40' : ''}`}>
        {locked ? '——' : value}
      </p>
      {locked && <p className="text-[10px] text-amber-700 mt-1">Scope not granted</p>}
    </div>
  );
}

function Card({
  title,
  subtle,
  badge,
  children,
}: {
  title: string;
  subtle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtle && <p className="text-xs text-slate-500">{subtle}</p>}
        </div>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-semibold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function CashflowRow({
  label,
  gross,
  net,
  tone,
}: {
  label: string;
  gross: number;
  net?: number;
  tone?: 'positive' | 'negative';
}) {
  const toneClass = tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${toneClass}`}>
        {formatCurrency(gross, { abbreviate: true })}
      </p>
      {net !== undefined && (
        <p className="text-[11px] text-slate-400 mt-0.5">
          Net {formatCurrency(net, { abbreviate: true })}
        </p>
      )}
    </div>
  );
}

function HealthComponentRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 mt-1">{value.toFixed(0)}</dd>
    </div>
  );
}

function ScopeLocked({ scope }: { scope: DataAccessScope }) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-800">
      The client has not granted <strong>{scope}</strong> scope. Request consent extension to view.
    </div>
  );
}

function statusTone(status: string): 'positive' | 'negative' | 'neutral' {
  if (status === 'good' || status === 'excellent') return 'positive';
  if (status === 'danger' || status === 'warning') return 'negative';
  return 'neutral';
}
