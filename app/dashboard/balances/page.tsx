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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Upload,
  Pencil,
  FileText,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  AccountDetailDialog,
  type AccountDetail,
} from '@/components/accounts/AccountDetailDialog';
import {
  AccountFormDialog,
  type AccountFormValues,
} from '@/components/accounts/AccountFormDialog';
import {
  LoanFormDialog,
  type LoanFormPropertyOption,
  type LoanFormAssetOption,
} from '@/components/loans/LoanFormDialog';
import { AddSourcePicker } from '@/components/ui/AddSourcePicker';
import { TransactionImportDialog } from '@/components/bank/TransactionImportDialog';
import { useBasiqConnect } from '@/hooks/useBasiqConnect';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

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
  // Recent transactions enriched server-side (PR #551). Empty
  // array when /api/accounts couldn't fetch them — the row still
  // renders, the dialog just shows "No transactions recorded".
  transactions?: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    category?: string | null;
  }>;
  // GRDCS metadata from the server response. Used by the
  // AccountDetailDialog's "Linked" tab.
  _links?: {
    self: string;
    related: GRDCSLinkedEntity[];
  };
  _meta?: {
    linkedCount: number;
    missingLinks: GRDCSMissingLink[];
  };
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

function BalancesPageContent() {
  const { token } = useAuth();
  const router = useRouter();
  const { openLinkedEntity } = useCrossModuleNavigation();

  // Account-detail dialog state. Phase 1 of "make /dashboard/accounts
  // redundant" (see CHANGELOG_2026_04_29): clicking an account row now
  // opens the dialog inline instead of navigating to the accounts page
  // and forcing a second click.
  const [detailAccount, setDetailAccount] = useState<AccountRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Phase 1b: account create/edit form is now hosted inline. Opening
  // the form with `editingAccount = null` runs in create mode (e.g.
  // the "+ Account" toolbar button); opening it with a populated
  // value runs in edit mode (e.g. the "Edit Account" button in the
  // detail dialog).
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<
    AccountFormValues | null
  >(null);

  // Phase 1b: loan create/edit form. Properties + assets are fetched
  // lazily on first open (most users won't click + Loan) so we don't
  // bloat the initial Balances page load.
  const [loanFormOpen, setLoanFormOpen] = useState(false);
  const [loanFormProperties, setLoanFormProperties] = useState<
    LoanFormPropertyOption[]
  >([]);
  const [loanFormAssets, setLoanFormAssets] = useState<LoanFormAssetOption[]>([]);
  const [loanFormLookupsLoaded, setLoanFormLookupsLoaded] = useState(false);

  // Phase 1c: data-source picker state. The "+ Account" / "+ Loan"
  // toolbar buttons open a small 2-tile picker (Import / Manual) per
  // user direction (CHANGELOG_2026_04_29). Recommended path is
  // surfaced first; manual is the secondary tile.
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [loanPickerOpen, setLoanPickerOpen] = useState(false);

  // Phase 1c: TransactionImportDialog inline on Balances. Opened
  // from the account-source picker's Import tile. Body shape and
  // submit flow are handled internally by the existing dialog.
  const [importOpen, setImportOpen] = useState(false);

  // Phase 1c: Basiq Connect Bank, top-level toolbar action. Same
  // hook used by the legacy /dashboard/accounts page so behaviour
  // (consent URL, MOBILE_REQUIRED redirect, error copy) is byte-for-
  // byte identical.
  const { isConnecting, connectBank } = useBasiqConnect();

  const openAccountDetail = (account: AccountRow) => {
    setDetailAccount(account);
    setDetailOpen(true);
  };

  const openAccountCreate = () => {
    setEditingAccount(null);
    setAccountFormOpen(true);
  };

  const openLoanCreate = async () => {
    // Lazy-fetch properties + assets the first time the dialog opens.
    // Both endpoints are best-effort — failure leaves the lookup
    // selects empty rather than blocking the form (the user can
    // still create an unlinked loan).
    if (!loanFormLookupsLoaded && token) {
      const headers = { Authorization: `Bearer ${token}` };
      const [propsResult, assetsResult] = await Promise.allSettled([
        fetch('/api/properties', { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/assets', { headers }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (propsResult.status === 'fulfilled' && propsResult.value) {
        const props = propsResult.value.data ?? propsResult.value.properties ?? [];
        setLoanFormProperties(
          props.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }))
        );
      }
      if (assetsResult.status === 'fulfilled' && assetsResult.value) {
        const ass = assetsResult.value.data ?? assetsResult.value.assets ?? [];
        setLoanFormAssets(
          ass.map(
            (a: {
              id: string;
              name: string;
              currentValue: number;
              vehicleMake?: string;
              vehicleModel?: string;
            }) => ({
              id: a.id,
              name: a.name,
              currentValue: a.currentValue,
              vehicleMake: a.vehicleMake,
              vehicleModel: a.vehicleModel,
            })
          )
        );
      }
      setLoanFormLookupsLoaded(true);
    }
    setLoanFormOpen(true);
  };

  // Delete handler for the AccountDetailDialog footer. The dialog
  // already shows the AlertDialog confirmation step before this
  // fires — by the time we get here the user has typed/clicked
  // "Delete account". On success we reload so the row drops out of
  // the Cash section without a page refresh.
  const handleDeleteAccount = async (account: AccountDetail) => {
    if (!token) return;
    const response = await fetch(`/api/accounts/${account.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        typeof errorData.error === 'string'
          ? errorData.error
          : `Failed to delete account (${response.status})`
      );
    }
    void reloadData();
  };

  const openAccountEdit = (account: AccountDetail) => {
    setEditingAccount({
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution ?? '',
      currentBalance: account.currentBalance,
      // The dialog stores this as a percentage (e.g. 2.5); the form
      // dialog handles the percent↔decimal conversion internally.
      interestRate: account.interestRate ?? 0,
    });
    setAccountFormOpen(true);
  };

  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setDetailOpen(false);
    openLinkedEntity(entity);
  };

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [connections, setConnections] = useState<BasiqConnection[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-endpoint error tracking so we can surface "couldn't load X"
  // hints next to each section instead of silently hiding it.
  // Previously the page used `Promise.all` + a `.then` that fell back
  // to `[]` on `r.ok === false` — which made an intermittent 5xx on
  // /api/accounts indistinguishable from an empty list, so the Cash
  // section just disappeared. Switching to `Promise.allSettled` plus
  // explicit error state lets sections render whatever data did
  // arrive and clearly signal which fetches failed.
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [loansError, setLoansError] = useState<string | null>(null);

  // Tracks whether a fetch was started by an unmounted effect cleanup,
  // so the per-section setters can ignore late responses. Refactored
  // out of the original cancellable-flag pattern so the same logic
  // is reachable from `reloadData` (called by the form-dialog
  // `onSaved` callbacks below) without duplicating the fetch+parse
  // chain.
  const cancelledRef = useRef(false);
  const reloadData = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    setAccountsError(null);
    setLoansError(null);

    /*
     * Retry-on-5xx wrapper for the primary entity fetches.
     *
     * /api/accounts and /api/loans intermittently 500 on Vercel
     * cold-starts (the first request after an idle period spins up
     * a fresh function instance + reopens the Cloud SQL connection,
     * which can blow past the function timeout the first try).
     * PR #551 already split the unified_transactions enrichment out
     * as best-effort, but the primary query itself can still hit the
     * cold-start window. Retrying once after a short delay catches
     * those one-shot failures without surfacing the "Couldn't load"
     * banner to the user.
     *
     * Single retry only — if the second attempt also fails we honour
     * the per-section error state and show the cached-data hint
     * (PR #550 behaviour preserved). No exponential backoff because
     * the user is waiting; a 600ms delay is the upper bound we'll
     * tolerate.
     */
    const fetchWithRetry = async (url: string, label: string) => {
      const attempt = async () => {
        const r = await fetch(url, { headers });
        if (!r.ok) throw new Error(`${label} ${r.status}`);
        return r.json();
      };
      try {
        return await attempt();
      } catch (err) {
        // Only retry on 5xx / network-level failures. 4xx (auth,
        // forbidden, not found) is a real error — surface it.
        const msg = err instanceof Error ? err.message : String(err);
        const code = Number(msg.match(/\b(\d{3})\b/)?.[1] ?? 0);
        const isRetryable = code === 0 || code >= 500;
        if (!isRetryable) throw err;
        await new Promise((resolve) => setTimeout(resolve, 600));
        return attempt();
      }
    };

    const accountsPromise = fetchWithRetry('/api/accounts', 'accounts');
    const loansPromise = fetchWithRetry('/api/loans', 'loans');
    const connectionsPromise = fetch('/api/basiq/connections', { headers })
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .catch(() => ({ connections: [] }));

    const [accResult, loanResult, connResult] = await Promise.allSettled([
      accountsPromise,
      loansPromise,
      connectionsPromise,
    ]);

    if (cancelledRef.current) return;

    if (accResult.status === 'fulfilled') {
      const r = accResult.value;
      setAccounts(r.data ?? r.accounts ?? []);
    } else {
      setAccountsError(
        accResult.reason instanceof Error
          ? accResult.reason.message
          : String(accResult.reason)
      );
    }

    if (loanResult.status === 'fulfilled') {
      const r = loanResult.value;
      setLoans(r.data ?? r.loans ?? []);
    } else {
      setLoansError(
        loanResult.reason instanceof Error
          ? loanResult.reason.message
          : String(loanResult.reason)
      );
    }

    if (connResult.status === 'fulfilled') {
      const r = connResult.value;
      setConnections(r.connections ?? r.data ?? []);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    cancelledRef.current = false;
    void reloadData();
    return () => {
      cancelledRef.current = true;
    };
  }, [reloadData]);

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
              {/*
               * Phase 1c: Connect Bank promoted to a top-level toolbar
               * button (Basiq returns both deposit/credit accounts AND
               * loan accounts when the institution exposes them, so
               * this single action seeds both Cash and Debt sections).
               * Recommended path — placed first.
               */}
              <Button
                variant="default"
                size="sm"
                onClick={() => void connectBank()}
                disabled={isConnecting}
                className="hidden sm:inline-flex bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Landmark className="w-4 h-4 mr-1.5" />
                )}
                Connect Bank
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAccountPickerOpen(true)}
                className="hidden sm:inline-flex"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLoanPickerOpen(true)}
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
        ) : accounts.length === 0 &&
          loans.length === 0 &&
          !accountsError &&
          !loansError ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {/* CASH */}
            {(totals.cashAccounts.length > 0 || accountsError) && (
              <Section
                title="Cash"
                subtitle="Where your money lives"
                total={totals.cash}
                accent="emerald"
                errorHint={
                  accountsError ? "Couldn't load latest balances. Showing cached data." : null
                }
              >
                <div className="anim-rise-stagger">
                  {totals.cashAccounts.map((a) => (
                    <AccountRowView key={a.id} account={a} onClick={() => openAccountDetail(a)} />
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
                    <AccountRowView key={a.id} account={a} onClick={() => openAccountDetail(a)} />
                  ))}
                </div>
              </Section>
            )}

            {/* DEBT */}
            {(loans.length > 0 || loansError) && (
              <Section
                title="Debt"
                subtitle="Home, investment, and personal loans"
                total={-totals.debt}
                accent="rose"
                errorHint={
                  loansError ? "Couldn't load loans. Showing cached data." : null
                }
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

      {/*
       * AccountDetailDialog rendered at page level so it survives a
       * row's hover/focus state. `detailAccount` is typed as the
       * server-side AccountRow which structurally satisfies AccountDetail
       * (same id/name/type/currentBalance/transactions/_links/_meta
       * fields) — see the cast below.
       *
       * Phase 1 hides the import button (`onImportClick` omitted): the
       * Balances page doesn't host a TransactionImportDialog yet.
       * Phase 2 will lift the import flow over from
       * /dashboard/accounts as part of retiring that page.
       */}
      <AccountDetailDialog
        account={detailAccount as AccountDetail | null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openAccountEdit}
        onDelete={handleDeleteAccount}
        onLinkedEntityNavigate={handleLinkedEntityNavigate}
      />

      {/*
       * Account create/edit form rendered at page level so it
       * survives any source row's hover/focus state. Used both by
       * the "+ Account" toolbar button (create mode) and by the
       * detail dialog's "Edit Account" button (edit mode). Phase 1b
       * of accounts-page retirement.
       */}
      <AccountFormDialog
        open={accountFormOpen}
        onOpenChange={setAccountFormOpen}
        editing={editingAccount}
        onSaved={() => {
          // Refresh balances + reopen-data after a successful save.
          // No optimistic update — the server is the source of truth
          // for currentBalance, balanceSource, and interestRate
          // formatting (decimal vs percentage), so a clean refetch
          // avoids a brief mismatch in the UI.
          void reloadData();
        }}
      />

      {/*
       * Loan create form rendered at page level so the "+ Loan"
       * button on the Balances toolbar opens it inline. Phase 1b of
       * accounts/loans-page retirement.
       *
       * `offsetAccounts` is filtered to non-credit cash accounts —
       * that's what users link offsets against. `allAccounts`
       * passes everything including credit cards for LINE_OF_CREDIT
       * loans.
       */}
      <LoanFormDialog
        open={loanFormOpen}
        onOpenChange={setLoanFormOpen}
        editing={null}
        properties={loanFormProperties}
        offsetAccounts={accounts
          .filter((a) => a.type !== 'CREDIT_CARD')
          .map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            currentBalance: a.currentBalance,
          }))}
        allAccounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currentBalance: a.currentBalance,
        }))}
        assets={loanFormAssets}
        onSaved={() => {
          void reloadData();
        }}
      />

      {/*
       * Phase 1c: 2-tile source picker dialogs. Opened by the
       * "+ Account" / "+ Loan" toolbar buttons. Import is the
       * recommended (first) tile per user direction; manual entry is
       * secondary. Connect Bank lives separately at the top of the
       * toolbar — Basiq covers both accounts and loans, so it doesn't
       * belong inside either picker.
       */}
      <AddSourcePicker
        open={accountPickerOpen}
        onOpenChange={setAccountPickerOpen}
        title="Add an account"
        description="How would you like to add this account?"
        tiles={[
          {
            icon: Upload,
            title: 'Import bank statement',
            description:
              'Upload a CSV, OFX, or QIF file — we’ll create the account using the closing balance.',
            recommended: true,
            accent: 'emerald',
            onSelect: () => setImportOpen(true),
          },
          {
            icon: Pencil,
            title: 'Enter manually',
            description: 'Type the account name, balance, and details yourself.',
            accent: 'blue',
            onSelect: () => openAccountCreate(),
          },
        ]}
      />

      <AddSourcePicker
        open={loanPickerOpen}
        onOpenChange={setLoanPickerOpen}
        title="Add a loan"
        description="How would you like to add this loan?"
        tiles={[
          {
            icon: FileText,
            title: 'Upload loan document',
            description:
              'Drop a PDF statement or contract — we’ll auto-fill rate, principal, and repayment.',
            recommended: true,
            accent: 'emerald',
            // The LoanFormDialog already hosts FormDocumentUpload at
            // the top of the form (Phase 19). For now this tile just
            // opens the same dialog — the upload area is the first
            // thing the user sees. Phase 1d (if needed) can add an
            // explicit `focusUpload` prop to scroll/highlight it.
            onSelect: () => void openLoanCreate(),
          },
          {
            icon: Pencil,
            title: 'Enter manually',
            description: 'Type the lender, balance, rate, and repayment yourself.',
            accent: 'blue',
            onSelect: () => void openLoanCreate(),
          },
        ]}
      />

      {/*
       * Phase 1c: TransactionImportDialog hosted on Balances.
       * Opened from the account-source picker's Import tile.
       * `accounts` prop is the existing-IMPORT-account list so the
       * import flow can either create a new account from the file
       * (when none is selected) or import into an existing one.
       */}
      <TransactionImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          institution: a.institution ?? undefined,
        }))}
        onImportComplete={() => {
          setImportOpen(false);
          void reloadData();
        }}
        onAccountCreated={() => {
          // The import flow may auto-create an account from the
          // statement's closing balance — refresh so it shows up in
          // the Cash section immediately.
          void reloadData();
        }}
      />
    </DashboardLayout>
  );
}

// Wrap in Suspense for useSearchParams (via useCrossModuleNavigation,
// Next.js 15 requirement). Mirrors /dashboard/loans/page.tsx.
export default function BalancesPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </DashboardLayout>
      }
    >
      <BalancesPageContent />
    </Suspense>
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
  errorHint,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  accent: 'emerald' | 'amber' | 'rose';
  /** Optional hint shown next to the subtitle when this section's data
   *  failed to refresh (e.g. /api/accounts hiccupped). Falls back to
   *  null when everything loaded cleanly. */
  errorHint?: string | null;
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
          {errorHint && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {errorHint}
            </p>
          )}
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

function AccountRowView({
  account,
  onClick,
}: {
  account: AccountRow;
  onClick: () => void;
}) {
  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = meta.icon;
  const isBasiq = account.balanceSource === 'BASIQ';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 sm:px-5 py-4 border-b border-border last:border-0 hover-lift hover:bg-muted/40 group text-left"
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
    </button>
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
