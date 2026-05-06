'use client';

/**
 * Phase 41f.2 — /dashboard/entities/[id]/connect-bookkeeping
 *
 * Connect-Xero surface for a personal LegalEntity (Pty Ltd / Sole
 * Trader / Trust trustee / SMSF). Renders three states:
 *
 *   - Not configured     → friendly "coming soon" notice (env vars
 *                          unset; mirrors the Phase 41h.3 pattern)
 *   - Not connected      → "Connect Xero" CTA button (initiates the
 *                          OAuth flow via POST /connect)
 *   - Connected          → tenant name + last connected + Disconnect CTA
 *
 * Strategic positioning per spec doc §1: trust-building copy
 * reassures the user that we CONSUME Xero data, never replace it.
 *
 * Reads `?result=success | error&reason=...` query params to render
 * a toast after the user returns from Xero. Honoring §1.1 scope
 * boundary: copy explicitly says we read snapshot, don't write back,
 * don't generate documents.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plug,
  Unplug,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface IntegrationStatus {
  configured: boolean;
  entity: { id: string; name: string; type: string };
  integration: {
    id: string;
    provider: 'XERO' | 'MYOB' | 'QUICKBOOKS' | string;
    providerOrganization: string | null;
    providerTenantId: string | null;
    isConnected: boolean;
    lastConnectedAt: string | null;
    connectionError: string | null;
    tokenExpiresAt: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
  } | null;
}

const CALLBACK_REASONS: Record<string, string> = {
  INVALID_STATE: 'The session expired. Please try connecting again.',
  ENTITY_NOT_FOUND: 'We could not find this entity. Try refreshing the page.',
  TOKEN_EXCHANGE_FAILED: 'Xero refused our request. Please try again or contact support.',
  TENANT_LIST_FAILED: 'Could not read your Xero organisations. Please try again.',
  NO_TENANTS: 'Your Xero account has no organisations available. Connect a Xero org first.',
  XERO_NOT_CONFIGURED: 'Xero integration is being set up. Please check back soon.',
  MISSING_CODE_OR_STATE: 'Xero did not return the expected response. Please try again.',
  access_denied: 'You declined the Xero permission. No connection was made.',
};

export default function ConnectBookkeepingPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const entityId = params?.id;

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackResult = search?.get('result') ?? null;
  const callbackReason = search?.get('reason') ?? null;
  const callbackDetail = search?.get('detail') ?? null;

  const fetchStatus = useCallback(async () => {
    if (!entityId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/accounting`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setStatus((await res.json()) as IntegrationStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [entityId, token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!entityId || !token) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/accounting/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as
        | { authorizeUrl: string }
        | { error: string; code?: string };
      if (!res.ok || !('authorizeUrl' in json)) {
        const code = 'code' in json ? json.code : undefined;
        const msg = 'error' in json ? json.error : `HTTP ${res.status}`;
        throw new Error(
          code === 'XERO_NOT_CONFIGURED'
            ? 'Xero integration is being set up. Please check back soon.'
            : msg,
        );
      }
      window.location.href = json.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!entityId || !token) return;
    if (!confirm('Disconnect Xero from this entity? Your books stay in Xero — we just stop pulling the snapshot.')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/accounting/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      // Clean URL params and refresh the status
      router.replace(`/dashboard/entities/${entityId}/connect-bookkeeping`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Connect bookkeeping"
        description="Pull a snapshot of your books into Monitrax. Your books stay in Xero — we just read the headline numbers so your wealth view is grounded in real data."
        action={
          <Link
            href="/dashboard/entities"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Structure
          </Link>
        }
      />

      <div className="space-y-6">
        {callbackResult === 'success' && (
          <SuccessBanner />
        )}
        {callbackResult === 'error' && callbackReason && (
          <ErrorBanner reason={callbackReason} detail={callbackDetail} />
        )}

        {loading && (
          <Card>
            <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </CardContent>
          </Card>
        )}

        {!loading && status && (
          <>
            <EntitySummaryCard entity={status.entity} />

            {!status.configured && <NotConfiguredCard />}

            {status.configured && status.integration?.isConnected && (
              <ConnectedCard
                integration={status.integration}
                onDisconnect={handleDisconnect}
                disabled={actionLoading}
              />
            )}

            {status.configured && !status.integration?.isConnected && (
              <ConnectCard onConnect={handleConnect} disabled={actionLoading} />
            )}

            <ScopeBoundaryCard />
          </>
        )}

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function SuccessBanner() {
  return (
    <Card className="border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <CardContent className="flex items-start gap-3 p-4">
        <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-sm font-semibold">Xero connected.</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll pull your latest snapshot in the next sync. Your books stay in Xero.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorBanner({ reason, detail }: { reason: string; detail: string | null }) {
  const message = CALLBACK_REASONS[reason] ?? `Xero connection failed (${reason}).`;
  return (
    <Card className="border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertCircle className="h-5 w-5 flex-none text-amber-600 dark:text-amber-400" />
        <div className="text-sm">
          <p className="font-semibold">Connection didn&apos;t complete.</p>
          <p className="text-muted-foreground">{message}</p>
          {detail && <p className="text-xs text-muted-foreground/80 mt-1">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EntitySummaryCard({ entity }: { entity: IntegrationStatus['entity'] }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Entity</p>
          <p className="text-base font-semibold">{entity.name}</p>
        </div>
        <span className="text-xs text-muted-foreground">{entity.type.replace(/_/g, ' ').toLowerCase()}</span>
      </CardContent>
    </Card>
  );
}

function NotConfiguredCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bookkeeping integration is being set up</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        We&apos;re finalising the Xero connection for Monitrax. Please check back soon — your wealth view will be ready to consume your books the moment we ship.
      </CardContent>
    </Card>
  );
}

function ConnectCard({ onConnect, disabled }: { onConnect: () => void; disabled: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4" />
          Connect Xero
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We&apos;ll redirect you to Xero. After you grant access, we&apos;ll pull a Balance Sheet + Profit &amp; Loss snapshot. Your books stay in Xero — we never write back.
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
            Read-only access (Reports, Transactions, Contacts)
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
            You can disconnect any time
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
            We never modify your books
          </li>
        </ul>
        <Button onClick={onConnect} disabled={disabled} size="sm">
          {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
          Connect Xero
        </Button>
      </CardContent>
    </Card>
  );
}

function ConnectedCard({
  integration,
  onDisconnect,
  disabled,
}: {
  integration: NonNullable<IntegrationStatus['integration']>;
  onDisconnect: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Connected to {integration.provider === 'XERO' ? 'Xero' : integration.provider}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Organisation</p>
            <p className="font-medium">{integration.providerOrganization ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last connected</p>
            <p className="font-medium">{formatTimestamp(integration.lastConnectedAt)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last sync</p>
          <p className="font-medium">
            {integration.lastSyncAt ? formatTimestamp(integration.lastSyncAt) : 'Not synced yet — pulling on next refresh.'}
          </p>
        </div>
        <Button
          onClick={onDisconnect}
          disabled={disabled}
          size="sm"
          variant="outline"
          className="mt-2"
        >
          {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
          Disconnect
        </Button>
      </CardContent>
    </Card>
  );
}

function ScopeBoundaryCard() {
  // Per PHASE_41F_BOOKKEEPING_INTEGRATION.md §1.1 — explicit user-facing
  // statement of what Monitrax does and does NOT do with imported books.
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">What we do — and don&apos;t do</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ul className="space-y-1.5">
            <li>✓ Read your Balance Sheet snapshot</li>
            <li>✓ Read your Profit &amp; Loss summary</li>
            <li>✓ Surface tax-engine inputs (Div 7A, Div 6E, SMSF)</li>
          </ul>
          <ul className="space-y-1.5">
            <li>✗ Write back to Xero</li>
            <li>✗ Generate or modify legal documents</li>
            <li>✗ File anything with the ATO or ASIC</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
