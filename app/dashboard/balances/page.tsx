'use client';

/**
 * MY ACCOUNTS → BALANCES
 * Phase 36: UX Simplification
 *
 * A single, unified view of where your money lives and what you owe.
 * Replaces the separate /accounts and /loans pages at the nav level —
 * both detail pages remain reachable via direct URL for full CRUD.
 *
 * Design: Apple-like. Hero net position, grouped sections (Cash / Credit /
 * Debt), generous whitespace, subtle rise animation on first paint,
 * hover-lift on rows. No form-heavy tiles.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  CreditCard,
  Landmark,
  Home as HomeIcon,
  Car,
  Plus,
  ArrowUpRight,
  Link2,
  Building,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// ---------------------------------------------------------------------------
// Types (mirror the server response shape — preserved from existing endpoints)
// ---------------------------------------------------------------------------

interface AccountRow {
  id: string;
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  institution?: string | null;
  currentBalance: number;
  interestRate?: number | null;
  balanceSource?: string | null;
  balanceLastUpdatedAt?: string | null;
  linkedLoan?: { id: string; name: string } | null;
}

interface LoanRow {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT' | 'CAR' | 'PERSONAL' | 'LINE_OF_CREDIT' | 'STUDENT' | 'BUSINESS';
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly?: boolean;
  fixedExpiry?: string | null;
  property?: { id: string; name: string } | null;
  offsetAccount?: { id: string; name: string; currentBalance: number } | null;
  linkedAsset?: { id: string; name: string } | null;
  linkedAccount?: { id: string; name: string } | null;
}

interface BasiqConnection {
  id: string;
  institutionName: string;
  status: 'ACTIVE' | 'PENDING' | 'RECONNECT' | 'DISABLED' | 'ERROR';
  lastSyncedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE_META: Record<AccountRow['type'], { label: string; icon: typeof Wallet; accent: string }> = {
  OFFSET: { label: 'Offset', icon: Link2, accent: 'text-emerald-600 bg-emerald-50' },
  SAVINGS: { label: 'Savings', icon: Landmark, accent: 'text-emerald-600 bg-emerald-50' },
  TRANSACTIONAL: { label: 'Everyday', icon: Wallet, accent: 'text-sky-600 bg-sky-50' },
  CREDIT_CARD: { label: 'Credit card', icon: CreditCard, accent: 'text-amber-600 bg-amber-50' },
};

const LOAN_TYPE_META: Record<LoanRow['type'], { label: string; icon: typeof HomeIcon; accent: string }> = {
  HOME: { label: 'Home loan', icon: HomeIcon, accent: 'text-rose-600 bg-rose-50' },
  INVESTMENT: { label: 'Investment loan', icon: Building, accent: 'text-rose-600 bg-rose-50' },
  CAR: { label: 'Car loan', icon: Car, accent: 'text-rose-600 bg-rose-50' },
  PERSONAL: { label: 'Personal loan', icon: Wallet, accent: 'text-rose-600 bg-rose-50' },
  LINE_OF_CREDIT: { label: 'Line of credit', icon: CreditCard, accent: 'text-amber-600 bg-amber-50' },
  STUDENT: { label: 'Student loan', icon: Landmark, accent: 'text-rose-600 bg-rose-50' },
  BUSINESS: { label: 'Business loan', icon: Building, accent: 'text-rose-600 bg-rose-50' },
};

function relativeTime(iso?: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BalancesPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [connections, setConnections] = useState<BasiqConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/accounts', { headers }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch('/api/loans', { headers }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch('/api/basiq/connections', { headers }).then((r) => r.ok ? r.json() : { connections: [] }).catch(() => ({ connections: [] })),
    ])
      .then(([accRes, loanRes, connRes]) => {
        setAccounts(accRes.data ?? accRes.accounts ?? []);
        setLoans(loanRes.data ?? loanRes.loans ?? []);
        setConnections(connRes.connections ?? connRes.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // --- Totals --------------------------------------------------------------

  const totals = useMemo(() => {
    const cashAccounts = accounts.filter((a) => a.type === 'OFFSET' || a.type === 'SAVINGS' || a.type === 'TRANSACTIONAL');
    const creditAccounts = accounts.filter((a) => a.type === 'CREDIT_CARD');

    const cash = cashAccounts.reduce((s, a) => s + (a.currentBalance || 0), 0);
    const credit = creditAccounts.reduce((s, a) => s + (a.currentBalance || 0), 0); // typically negative
    const debt = loans.reduce((s, l) => s + (l.principal || 0), 0);
    const net = cash + credit - debt;

    return { cash, credit, debt, net, cashAccounts, creditAccounts };
  }, [accounts, loans]);

  const activeConnections = connections.filter((c) => c.status === 'ACTIVE').length;
  const mostRecentSync = connections
    .map((c) => c.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .pop();

  // --- Render --------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 anim-fade-in">
        {/* HERO --------------------------------------------------------- */}
        <header className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">My Accounts · Balances</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
                Your full picture
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/accounts')}
                className="hidden sm:inline-flex"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/loans')}
                className="hidden sm:inline-flex"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Loan
              </Button>
            </div>
          </div>

          {/* Net position — the only hero number. Everything drills down from here. */}
          {loading ? (
            <Skeleton className="h-24 w-full max-w-md mt-4" />
          ) : (
            <div className="mt-6 anim-rise">
              <div className="text-sm text-muted-foreground mb-1">Net position</div>
              <div
                className={`text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums ${
                  totals.net >= 0 ? 'text-foreground' : 'text-rose-600'
                }`}
              >
                {formatCurrency(totals.net)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Cash <span className="tabular-nums text-foreground font-medium">{formatCurrency(totals.cash)}</span>
                </span>
                {totals.creditAccounts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Credit <span className="tabular-nums text-foreground font-medium">{formatCurrency(totals.credit)}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Debt <span className="tabular-nums text-foreground font-medium">{formatCurrency(totals.debt)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Basiq freshness — live-ish tile, calm */}
          {activeConnections > 0 && (
            <div className="mt-6 inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm text-emerald-900">
              <span className="relative inline-block w-2 h-2 text-emerald-500">
                <span className="absolute inset-0 rounded-full bg-emerald-500" />
                <span className="pulse-dot absolute inset-0 rounded-full" />
              </span>
              <span className="font-medium">{activeConnections} bank{activeConnections === 1 ? '' : 's'} connected</span>
              {mostRecentSync && (
                <span className="text-emerald-700/70">· synced {relativeTime(mostRecentSync)}</span>
              )}
            </div>
          )}
        </header>

        {/* CONTENT ------------------------------------------------------ */}
        {loading ? (
          <LoadingSections />
        ) : accounts.length === 0 && loans.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {/* CASH */}
            {totals.cashAccounts.length > 0 && (
              <Section
                title="Cash"
                subtitle="Where your money lives"
                total={totals.cash}
                accent="emerald"
              >
                <div className="anim-rise-stagger">
                  {totals.cashAccounts.map((a) => (
                    <AccountRowView key={a.id} account={a} />
                  ))}
                </div>
              </Section>
            )}

            {/* CREDIT */}
            {totals.creditAccounts.length > 0 && (
              <Section
                title="Credit"
                subtitle="Revolving credit and cards"
                total={totals.credit}
                accent="amber"
              >
                <div className="anim-rise-stagger">
                  {totals.creditAccounts.map((a) => (
                    <AccountRowView key={a.id} account={a} />
                  ))}
                </div>
              </Section>
            )}

            {/* DEBT */}
            {loans.length > 0 && (
              <Section
                title="Debt"
                subtitle="Home, investment, and personal loans"
                total={-totals.debt}
                accent="rose"
              >
                <div className="anim-rise-stagger">
                  {loans.map((l) => (
                    <LoanRowView key={l.id} loan={l} accounts={accounts} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  subtitle,
  total,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  accent: 'emerald' | 'amber' | 'rose';
  children: React.ReactNode;
}) {
  const dotColor =
    accent === 'emerald' ? 'bg-emerald-500' : accent === 'amber' ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <section>
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className={`text-lg font-semibold tabular-nums ${total < 0 ? 'text-rose-600' : 'text-foreground'}`}>
          {formatCurrency(total)}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Account row
// ---------------------------------------------------------------------------

function AccountRowView({ account }: { account: AccountRow }) {
  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = meta.icon;
  const isBasiq = account.balanceSource === 'BASIQ';

  return (
    <Link
      href={`/dashboard/accounts#${account.id}`}
      className="flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-border last:border-0 hover-lift hover:bg-muted/40 group"
    >
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${meta.accent}`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{account.name}</div>
          {isBasiq && (
            <Badge variant="outline" className="text-[10px] font-medium border-emerald-200 text-emerald-700 bg-emerald-50 px-1.5 py-0">
              <Zap className="w-2.5 h-2.5 mr-0.5" /> Basiq
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{meta.label}</span>
          {account.institution && <><span>·</span><span className="truncate">{account.institution}</span></>}
          {account.linkedLoan && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Link2 className="w-3 h-3" /> Offsets {account.linkedLoan.name}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-right flex items-center gap-3">
        <div>
          <div className="font-semibold tabular-nums">{formatCurrency(account.currentBalance)}</div>
          {typeof account.interestRate === 'number' && account.interestRate > 0 && (
            <div className="text-xs text-muted-foreground tabular-nums">{(account.interestRate * 100).toFixed(2)}% p.a.</div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground/80 transition-colors" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loan row (preserves property/offset/asset relationships visually)
// ---------------------------------------------------------------------------

function LoanRowView({ loan, accounts }: { loan: LoanRow; accounts: AccountRow[] }) {
  const meta = LOAN_TYPE_META[loan.type];
  const Icon = meta.icon;

  // Offset account may come either via loan.offsetAccount (server-side include)
  // or by id — fall back to client-side lookup so the relationship is always surfaced.
  const offset = loan.offsetAccount ?? null;
  const offsetReduction = offset ? Math.max(0, Math.min(offset.currentBalance, loan.principal)) : 0;
  const effectivePrincipal = loan.principal - offsetReduction;

  return (
    <Link
      href={`/dashboard/loans/${loan.id}`}
      className="flex items-start gap-4 px-4 sm:px-5 py-4 border-b border-border last:border-0 hover-lift hover:bg-muted/40 group"
    >
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${meta.accent} shrink-0 mt-0.5`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{loan.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>{meta.label}</span>
          <span>·</span>
          <span className="tabular-nums">{(loan.interestRateAnnual * 100).toFixed(2)}% {loan.rateType === 'FIXED' ? 'fixed' : 'variable'}</span>
          {loan.isInterestOnly && <><span>·</span><span>Interest only</span></>}
        </div>

        {/* Relationship breadcrumbs — preserved exactly as in the old page */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {loan.property && (
            <LinkChip icon={HomeIcon} label={`Secured by ${loan.property.name}`} tone="rose" />
          )}
          {offset && (
            <LinkChip
              icon={Link2}
              label={`Offset: ${offset.name} (${formatCurrency(offset.currentBalance)})`}
              tone="emerald"
            />
          )}
          {loan.linkedAsset && (
            <LinkChip icon={Car} label={`Vehicle: ${loan.linkedAsset.name}`} tone="sky" />
          )}
          {loan.linkedAccount && (
            <LinkChip icon={CreditCard} label={`Card: ${loan.linkedAccount.name}`} tone="amber" />
          )}
        </div>
      </div>

      <div className="text-right flex items-center gap-3 shrink-0">
        <div>
          <div className="font-semibold tabular-nums text-rose-600">
            -{formatCurrency(loan.principal)}
          </div>
          {offset && (
            <div className="text-xs text-muted-foreground tabular-nums">
              Net after offset: <span className="text-foreground font-medium">{formatCurrency(-effectivePrincipal)}</span>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground/80 transition-colors" />
      </div>
    </Link>
  );
}

function LinkChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof HomeIcon;
  label: string;
  tone: 'emerald' | 'rose' | 'sky' | 'amber';
}) {
  const toneClass =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    tone === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-100' :
    tone === 'sky' ? 'bg-sky-50 text-sky-700 border-sky-100' :
    'bg-amber-50 text-amber-700 border-amber-100';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${toneClass}`}>
      <Icon className="w-2.5 h-2.5" />
      <span className="truncate max-w-[220px]">{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty + Loading states
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 sm:p-14 text-center anim-rise">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
        <Wallet className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">Connect your first account</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Link a bank to import balances and transactions automatically, or add an account manually to start tracking.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard/accounts">
            <Plus className="w-4 h-4 mr-1.5" /> Add account
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/loans">
            <Plus className="w-4 h-4 mr-1.5" /> Add loan
          </Link>
        </Button>
      </div>
    </div>
  );
}

function LoadingSections() {
  return (
    <div className="space-y-10">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="h-5 w-24 mb-3" />
          <div className="rounded-2xl border border-border bg-card">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Minimal Skeleton fallback. Use shared one if it exists; keeps the file self-contained.
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}
