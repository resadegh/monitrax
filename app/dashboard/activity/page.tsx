'use client';

/**
 * MY ACCOUNTS → ACTIVITY
 * Phase 36: UX Simplification
 *
 * Unified transactional view. Replaces separate /transactions and /recurring
 * pages at the nav level. Recurring patterns become a filter, not a tab —
 * because they are the same data (UnifiedTransaction) with a different lens.
 *
 * Relationships preserved: every transaction's links to Account / Property /
 * Loan / Income / Expense / Investment remain intact via the existing API —
 * this page only changes presentation.
 *
 * Design: Apple-like. One primary list, smart filter chips at top, grouped by
 * day, subtle rise animation on mount. Clicking a row jumps to the existing
 * transaction detail (which owns edit/link/split actions).
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowDown,
  ArrowUp,
  Search,
  Sparkles,
  Repeat,
  AlertTriangle,
  Filter,
  Calendar,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Transaction {
  id: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  description?: string | null;
  merchantStandardised?: string | null;
  merchantRaw?: string | null;
  categoryLevel1?: string | null;
  categoryLevel2?: string | null;
  isRecurring?: boolean;
  isTransfer?: boolean;
  source?: string;
  anomalyFlags?: string[];
  account?: { id: string; name: string; type: string } | null;
  accountId?: string;
  // Preserved relationship ids — clicking through uses these
  propertyId?: string | null;
  loanId?: string | null;
  incomeId?: string | null;
  expenseId?: string | null;
  investmentAccountId?: string | null;
}

interface RecurringPayment {
  id: string;
  merchantStandardised: string;
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'IRREGULAR';
  expectedAmount: number;
  lastOccurrence?: string | null;
  nextExpected?: string | null;
  occurrenceCount: number;
  isActive: boolean;
  account?: { id: string; name: string } | null;
  linkedExpense?: { id: string; name: string } | null;
  matchStatus?: string;
}

type FilterMode = 'all' | 'in' | 'out' | 'recurring' | 'anomalies';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByDay(txns: Transaction[]): Array<{ label: string; key: string; items: Transaction[]; net: number }> {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const key = t.date.slice(0, 10); // YYYY-MM-DD
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const sortedKeys = Array.from(groups.keys()).sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  return sortedKeys.map((key) => {
    const items = groups.get(key)!;
    const net = items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
    let label: string;
    if (key === today) label = 'Today';
    else if (key === yesterday) label = 'Yesterday';
    else {
      const d = new Date(key);
      label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    return { label, key, items, net };
  });
}

function formatPattern(p: RecurringPayment['pattern']): string {
  switch (p) {
    case 'WEEKLY': return 'Weekly';
    case 'FORTNIGHTLY': return 'Fortnightly';
    case 'MONTHLY': return 'Monthly';
    case 'QUARTERLY': return 'Quarterly';
    case 'ANNUALLY': return 'Yearly';
    default: return 'Irregular';
  }
}

function monthlyEquivalent(r: RecurringPayment): number {
  const a = r.expectedAmount;
  switch (r.pattern) {
    case 'WEEKLY': return a * 4.33;
    case 'FORTNIGHTLY': return a * 2.17;
    case 'MONTHLY': return a;
    case 'QUARTERLY': return a / 3;
    case 'ANNUALLY': return a / 12;
    default: return a;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityPage() {
  const { token } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/unified-transactions?limit=100', { headers })
        .then((r) => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] })),
      fetch('/api/unified-transactions/recurring?active=true', { headers })
        .then((r) => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] })),
    ])
      .then(([txnRes, recRes]) => {
        setTransactions(txnRes.data ?? []);
        setRecurring(recRes.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // --- Filtering ------------------------------------------------------------

  const filtered = useMemo(() => {
    let out = transactions;

    switch (filter) {
      case 'in':
        out = out.filter((t) => t.direction === 'IN' && !t.isTransfer);
        break;
      case 'out':
        out = out.filter((t) => t.direction === 'OUT' && !t.isTransfer);
        break;
      case 'recurring':
        out = out.filter((t) => t.isRecurring);
        break;
      case 'anomalies':
        out = out.filter((t) => (t.anomalyFlags?.length ?? 0) > 0);
        break;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (t) =>
          (t.merchantStandardised?.toLowerCase().includes(q) ?? false) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          (t.categoryLevel1?.toLowerCase().includes(q) ?? false),
      );
    }

    return out;
  }, [transactions, filter, search]);

  // --- Totals for hero ------------------------------------------------------

  const monthTotals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = transactions.filter((t) => new Date(t.date) >= monthStart && !t.isTransfer);
    const income = thisMonth.filter((t) => t.direction === 'IN').reduce((s, t) => s + t.amount, 0);
    const spend = thisMonth.filter((t) => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0);
    return { income, spend, net: income - spend };
  }, [transactions]);

  const recurringMonthly = useMemo(
    () => recurring.reduce((s, r) => s + monthlyEquivalent(r), 0),
    [recurring],
  );

  const anomalyCount = useMemo(
    () => transactions.filter((t) => (t.anomalyFlags?.length ?? 0) > 0).length,
    [transactions],
  );

  // --- Render ---------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 anim-fade-in">
        {/* HERO */}
        <header className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">My Accounts · Activity</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
            What&apos;s moving
          </h1>

          {/* Month summary tiles — live, calm, tabular */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 anim-rise-stagger">
            <SummaryTile
              label="Money in"
              value={monthTotals.income}
              icon={ArrowDown}
              tone="emerald"
            />
            <SummaryTile
              label="Money out"
              value={-monthTotals.spend}
              icon={ArrowUp}
              tone="rose"
            />
            <SummaryTile
              label="Recurring"
              value={-recurringMonthly}
              icon={Repeat}
              tone="sky"
              sub={`${recurring.length} active`}
            />
            <SummaryTile
              label="Net this month"
              value={monthTotals.net}
              icon={Sparkles}
              tone={monthTotals.net >= 0 ? 'emerald' : 'rose'}
              emphasis
            />
          </div>

          {anomalyCount > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-sm text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium">{anomalyCount} anomaly{anomalyCount === 1 ? '' : ''}{anomalyCount === 1 ? '' : 's'} to review</span>
              <button className="text-amber-700 underline underline-offset-2 hover:text-amber-900" onClick={() => setFilter('anomalies')}>
                Show
              </button>
            </div>
          )}
        </header>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-5">
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} icon={Filter} label="All" />
            <FilterChip active={filter === 'in'} onClick={() => setFilter('in')} icon={ArrowDown} label="Money in" tone="emerald" />
            <FilterChip active={filter === 'out'} onClick={() => setFilter('out')} icon={ArrowUp} label="Money out" tone="rose" />
            <FilterChip active={filter === 'recurring'} onClick={() => setFilter('recurring')} icon={Repeat} label="Recurring" tone="sky" />
            {anomalyCount > 0 && (
              <FilterChip active={filter === 'anomalies'} onClick={() => setFilter('anomalies')} icon={AlertTriangle} label={`Anomalies · ${anomalyCount}`} tone="amber" />
            )}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search merchant or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <LoadingList />
        ) : filter === 'recurring' && recurring.length > 0 ? (
          <RecurringList recurring={recurring} />
        ) : filtered.length === 0 ? (
          <EmptyActivity filter={filter} />
        ) : (
          <TransactionGroups groups={groupByDay(filtered)} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Summary tile (live-ish, subtle)
// ---------------------------------------------------------------------------

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
  sub,
  emphasis,
}: {
  label: string;
  value: number;
  icon: typeof ArrowDown;
  tone: 'emerald' | 'rose' | 'sky' | 'amber';
  sub?: string;
  emphasis?: boolean;
}) {
  const toneBg =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
    tone === 'rose' ? 'bg-rose-50 text-rose-600' :
    tone === 'sky' ? 'bg-sky-50 text-sky-600' :
    'bg-amber-50 text-amber-600';

  return (
    <div className={`rounded-2xl border border-border bg-card p-4 hover-lift ${emphasis ? 'ring-1 ring-primary/10' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${toneBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${value < 0 ? 'text-rose-600' : 'text-foreground'}`}>
        {formatCurrency(value)}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
  active,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Filter;
  label: string;
  tone?: 'emerald' | 'rose' | 'sky' | 'amber';
}) {
  const activeTone =
    tone === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' :
    tone === 'rose' ? 'bg-rose-600 text-white border-rose-600' :
    tone === 'sky' ? 'bg-sky-600 text-white border-sky-600' :
    tone === 'amber' ? 'bg-amber-600 text-white border-amber-600' :
    'bg-foreground text-background border-foreground';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all duration-200 ${
        active
          ? `${activeTone} shadow-sm`
          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Transaction groups (by day)
// ---------------------------------------------------------------------------

function TransactionGroups({ groups }: { groups: ReturnType<typeof groupByDay> }) {
  return (
    <div className="space-y-6 anim-rise">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-baseline justify-between px-1 mb-2">
            <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
            <span className={`text-xs tabular-nums ${g.net < 0 ? 'text-rose-600' : g.net > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {g.net >= 0 ? '+' : ''}{formatCurrency(g.net)}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {g.items.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TxRow({ t }: { t: Transaction }) {
  const label = t.merchantStandardised || t.merchantRaw || t.description || 'Transaction';
  const isIn = t.direction === 'IN';
  const hasAnomaly = (t.anomalyFlags?.length ?? 0) > 0;

  // Pick a drill-through link that preserves GRDCS relationships.
  // Priority: explicit linked entity > account > transactions list fallback.
  const href =
    t.propertyId ? `/dashboard/properties/${t.propertyId}` :
    t.loanId ? `/dashboard/loans/${t.loanId}` :
    t.accountId || t.account?.id ? `/dashboard/accounts#${t.accountId ?? t.account?.id}` :
    `/transactions?txId=${t.id}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-border last:border-0 hover-lift hover:bg-muted/40 group"
    >
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
          t.isTransfer
            ? 'bg-slate-50 text-slate-500'
            : isIn
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-600'
        }`}
      >
        {t.isTransfer ? (
          <ArrowLeftRight className="w-4 h-4" />
        ) : isIn ? (
          <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUp className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{label}</span>
          {t.isRecurring && (
            <Repeat className="w-3 h-3 text-sky-600 shrink-0" aria-label="Recurring" />
          )}
          {hasAnomaly && (
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" aria-label="Anomaly" />
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {t.categoryLevel1 || 'Uncategorised'}
          {t.account && <> · {t.account.name}</>}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className={`font-semibold tabular-nums text-sm ${isIn ? 'text-emerald-600' : 'text-foreground'}`}>
          {isIn ? '+' : '-'}{formatCurrency(t.amount)}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Recurring list (used when the "Recurring" filter is active)
// ---------------------------------------------------------------------------

function RecurringList({ recurring }: { recurring: RecurringPayment[] }) {
  const sorted = [...recurring].sort((a, b) => {
    const aNext = a.nextExpected ? new Date(a.nextExpected).getTime() : Infinity;
    const bNext = b.nextExpected ? new Date(b.nextExpected).getTime() : Infinity;
    return aNext - bNext;
  });

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden anim-rise">
      {sorted.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600">
            <Repeat className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate flex items-center gap-2">
              {r.merchantStandardised}
              {r.linkedExpense ? (
                <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50 px-1.5 py-0">Linked</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50 px-1.5 py-0">Unlinked</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5">
              <span>{formatPattern(r.pattern)}</span>
              {r.nextExpected && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Next: {new Date(r.nextExpected).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </span>
                </>
              )}
              {r.account && <><span>·</span><span className="truncate">{r.account.name}</span></>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold tabular-nums text-sm">{formatCurrency(r.expectedAmount)}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              ≈ {formatCurrency(monthlyEquivalent(r))} / mo
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading + empty states
// ---------------------------------------------------------------------------

function LoadingList() {
  return (
    <div className="space-y-6">
      {[1, 2].map((g) => (
        <div key={g}>
          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
          <div className="rounded-2xl border border-border bg-card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-xl bg-muted animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-44 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-2.5 w-28 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyActivity({ filter }: { filter: FilterMode }) {
  const copy =
    filter === 'in' ? { title: 'No income yet', sub: 'Connect a bank or wait for the next sync.' } :
    filter === 'out' ? { title: 'No spending yet', sub: 'Connect a bank or wait for the next sync.' } :
    filter === 'recurring' ? { title: 'No recurring payments detected', sub: 'Monitrax detects these automatically from your bank feed once we have a few weeks of data.' } :
    filter === 'anomalies' ? { title: 'Nothing unusual', sub: 'No anomalies detected in recent transactions.' } :
    { title: 'No activity yet', sub: 'Connect a bank to see transactions roll in automatically.' };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 sm:p-14 text-center anim-rise">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 mb-4">
        <Sparkles className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{copy.title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{copy.sub}</p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/dashboard/accounts">Connect a bank</Link>
        </Button>
      </div>
    </div>
  );
}
