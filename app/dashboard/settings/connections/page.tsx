'use client';

/**
 * Bank Connections Settings (Settings overhaul 2026-05-08)
 *
 * The "stop sharing my bank with Monitrax" surface. Users could already
 * disconnect a Basiq institution from /dashboard/accounts but per the
 * 2026-05-08 review, that's the wrong place mentally — disconnecting a
 * bank is a Settings operation, not an Accounts operation. CDR consent
 * lens + behavioural-psychology lens both say control surfaces belong
 * in one predictable place.
 *
 * This page reuses the existing /api/basiq/connections + DELETE
 * /api/basiq/connections/[id] endpoints — no new server logic.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  Link as LinkIcon,
  Unlink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface BasiqConnection {
  id: string;
  basiqConnectionId: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionLogo?: string | null;
  status: 'ACTIVE' | 'PENDING' | 'RECONNECT' | 'ERROR';
  lastSyncedAt: string | null;
  createdAt: string;
  accounts?: { id: string; name: string; type: string }[];
}

export default function ConnectionsSettingsPage() {
  const { token } = useAuth();
  const [connections, setConnections] = useState<BasiqConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/basiq/connections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setConnections(result.data || []);
      } else {
        const result = await response.json().catch(() => ({}));
        // No active CDR consent is not an error — just empty
        if (response.status === 403 || response.status === 412) {
          setConnections([]);
        } else {
          throw new Error(result.error?.message || 'Failed to load');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const disconnect = async (id: string, label: string) => {
    if (!token) return;
    if (
      !confirm(
        `Disconnect ${label}? Monitrax will stop receiving data from this bank and the connection record is removed. You'll need to re-link the bank to share data again.`
      )
    ) {
      return;
    }
    setActionLoading(id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/basiq/connections/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.error?.message || result.error || 'Failed to disconnect'
        );
      }
      setSuccess(`Disconnected ${label}.`);
      setTimeout(() => setSuccess(null), 5000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: BasiqConnection['status']) => {
    const map: Record<BasiqConnection['status'], { label: string; cls: string }> =
      {
        ACTIVE: {
          label: 'Active',
          cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        },
        PENDING: {
          label: 'Pending',
          cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        },
        RECONNECT: {
          label: 'Reconnect needed',
          cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        },
        ERROR: {
          label: 'Error',
          cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        },
      };
    const v = map[status] || map.PENDING;
    return <Badge className={v.cls}>{v.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Bank connections
          </CardTitle>
          <CardDescription>
            The banks Monitrax is currently reading data from via Open
            Banking (CDR). Disconnect any time — your CDR consent for that
            institution is removed and we stop syncing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <Alert className="border-green-500 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No banks connected.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <a href="/dashboard/accounts">Connect a bank</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {c.institutionLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.institutionLogo}
                        alt=""
                        className="h-10 w-10 rounded object-contain bg-white border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {c.institutionName || 'Unknown institution'}
                        </p>
                        {statusBadge(c.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.accounts?.length || 0} account
                        {(c.accounts?.length || 0) === 1 ? '' : 's'}
                        {c.lastSyncedAt
                          ? ` · last synced ${new Date(
                              c.lastSyncedAt
                            ).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      disconnect(
                        c.id,
                        c.institutionName || 'this bank'
                      )
                    }
                    disabled={actionLoading === c.id}
                  >
                    {actionLoading === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-4">
            Tip: revoking CDR consent does the same thing for every
            connection in one go — manage it from{' '}
            <a
              href="/dashboard/settings/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy &amp; CDR
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
