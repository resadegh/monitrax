'use client';

/**
 * Phase N.1: Consumer Privacy & CDR Consent Management Page
 *
 * Fulfills CDR Rules 1.14 (consumer dashboard) and 1.15 (consent management).
 *
 * Allows consumers to:
 * - View active CDR consents and what bank accounts are connected
 * - See what CDR data Monitrax holds about them
 * - Revoke consent (triggers immediate CDR data deletion)
 * - Delete all CDR data (right to erasure)
 *
 * Consent flow:
 *   GET /api/cdr/consent — lists active consents + CDR data summary
 *   POST /api/cdr/consent { action: 'revoke_org_consent', organizationClientId }
 *   POST /api/cdr/consent { action: 'revoke_all', confirm: true }
 *   POST /api/cdr/consent { action: 'delete_cdr_data', confirm: true }
 *
 * Gaps addressed: G13, G14 (CDR Rules 1.14)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';
import {
  Lock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  RotateCcw,
  Building2,
  Database,
  Calendar,
  ExternalLink,
  Download,
  UserX,
} from 'lucide-react';
import StartFreshDialog from '@/components/settings/StartFreshDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrgConsent {
  id: string;
  organizationId: string;
  consentStatus: string;
  accessScopes: string[];
  consentGrantedAt: string | null;
  consentExpiresAt: string | null;
  consentRevokedAt: string | null;
}

interface CDRDataSummary {
  hasBasiqConnection: boolean;
  activeConnections: number;
  basiqAccounts: number;
  basiqTransactions: number;
  hasActiveConsent: boolean;
}

interface ConsentData {
  consents: OrgConsent[];
  cdrData: CDRDataSummary;
}

export default function PrivacySettingsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [startFreshOpen, setStartFreshOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cdr/consent', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to load consent data');
      }
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  const revokeOrgConsent = async (organizationClientId: string) => {
    if (!confirm('Are you sure you want to revoke this consent? Your CDR data will be deleted within 24 hours.')) {
      return;
    }
    setActionLoading(`revoke-${organizationClientId}`);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/cdr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'revoke_org_consent', organizationClientId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to revoke consent');
      }
      setSuccessMessage('Consent revoked. Your CDR data has been scheduled for deletion.');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const revokeAll = async () => {
    setActionLoading('revoke-all');
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/cdr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'revoke_all', confirm: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to revoke all consents');
      }
      setSuccessMessage(result.data?.message || 'All consents revoked and CDR data deleted.');
      setShowRevokeAllConfirm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const exportData = async () => {
    setActionLoading('export-data');
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/account/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.error?.message || result.error || 'Failed to export data'
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitrax-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccessMessage(
        'Your data export was downloaded as a JSON file. Keep it somewhere safe.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteCDRData = async () => {
    setActionLoading('delete-data');
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/cdr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'delete_cdr_data', confirm: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to delete CDR data');
      }
      setSuccessMessage('Your CDR data has been deleted.');
      setShowDeleteConfirm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getConsentBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      GRANTED: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
      EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' },
      REVOKED: { label: 'Revoked', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    };
    const variant = variants[status] || variants.PENDING;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const activeConsents = data?.consents.filter((c) => c.consentStatus === 'GRANTED') || [];
  const inactiveConsents = data?.consents.filter((c) => c.consentStatus !== 'GRANTED') || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Privacy & Consumer Data Right</h2>
            <p className="text-sm text-muted-foreground">
              Manage your consents and control your CDR data
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Under the Australian Consumer Data Right (CDR), you have the right to control your
          financial data, revoke consent at any time, and request deletion of your CDR data.
          Monitrax processes your CDR data only with your active consent.
        </AlertDescription>
      </Alert>

      {/* Error / Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-500 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading consent information...
          </CardContent>
        </Card>
      ) : data && (
        <>
          {/* CDR Data Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Your CDR Data
              </CardTitle>
              <CardDescription>
                A summary of the financial data Monitrax holds about you under CDR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Bank Connections</p>
                  <p className="text-2xl font-bold mt-1">{data.cdrData.activeConnections}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.cdrData.hasBasiqConnection ? 'Active' : 'None connected'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Bank Accounts</p>
                  <p className="text-2xl font-bold mt-1">{data.cdrData.basiqAccounts}</p>
                  <p className="text-xs text-muted-foreground mt-1">Accounts accessible via CDR</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold mt-1">{data.cdrData.basiqTransactions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Imported via open banking</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Consents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Active Consents
              </CardTitle>
              <CardDescription>
                {activeConsents.length === 0
                  ? 'You have not granted any CDR consent.'
                  : `You have granted ${activeConsents.length} active consent${activeConsents.length === 1 ? '' : 's'}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeConsents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No active CDR consents.</p>
                  <p className="text-xs mt-1">
                    You can grant consent by connecting a bank account in the Accounts section.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeConsents.map((consent) => (
                    <div
                      key={consent.id}
                      className="p-4 rounded-lg border bg-card flex items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">Organization Consent</h4>
                          {getConsentBadge(consent.consentStatus)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Organization ID: <span className="font-mono text-xs">{consent.organizationId}</span>
                        </p>
                        {consent.accessScopes && consent.accessScopes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {consent.accessScopes.map((scope) => (
                              <Badge key={scope} variant="outline" className="text-xs">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Granted: {formatDate(consent.consentGrantedAt)}
                          </div>
                          {consent.consentExpiresAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires: {formatDate(consent.consentExpiresAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeOrgConsent(consent.id)}
                        disabled={actionLoading === `revoke-${consent.id}`}
                      >
                        {actionLoading === `revoke-${consent.id}` ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Revoke'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Consents */}
          {inactiveConsents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past Consents</CardTitle>
                <CardDescription>
                  Previously revoked or expired consents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inactiveConsents.map((consent) => (
                    <div key={consent.id} className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-mono text-muted-foreground">{consent.organizationId}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getConsentBadge(consent.consentStatus)}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(consent.consentRevokedAt || consent.consentExpiresAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                These actions are permanent and cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Revoke All */}
              <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-700 dark:text-red-400">
                      Revoke All CDR Consents
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Revokes all organization consents and disconnects all bank accounts. Your CDR data will be
                      deleted within 24 hours (Basiq §5.6).
                    </p>
                  </div>
                  {!showRevokeAllConfirm ? (
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                      onClick={() => setShowRevokeAllConfirm(true)}
                      disabled={!data.cdrData.hasActiveConsent}
                    >
                      Revoke All
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowRevokeAllConfirm(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={revokeAll}
                        disabled={actionLoading === 'revoke-all'}
                      >
                        {actionLoading === 'revoke-all' ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm Revoke'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right to Portability — JSON Export */}
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Download My Data
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Get a JSON copy of everything Monitrax holds about you —
                      profile, accounts, loans, properties, transactions, consents
                      and documents metadata. Your right to portability under
                      the Privacy Act 1988 (APP 12) and the CDR.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={exportData}
                    disabled={actionLoading === 'export-data'}
                  >
                    {actionLoading === 'export-data' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download JSON
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Delete CDR Data */}
              <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete All CDR Data
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently deletes all CDR data Monitrax holds about you (bank accounts, transactions,
                      connections). This is your right to erasure under CDR Rules.
                    </p>
                  </div>
                  {!showDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={!data.cdrData.hasBasiqConnection}
                    >
                      Delete Data
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteCDRData}
                        disabled={actionLoading === 'delete-data'}
                      >
                        {actionLoading === 'delete-data' ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm Delete'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/*
               * Start fresh — full data reset, account survives. Added
               * 2026-06-12 (Reza: "users data will get so out of hand they
               * want to start over"). Unlike the two CDR cards above, this
               * wipes ALL financial data (manual + imported) via
               * /api/account/reset; the confirmation dialog carries the
               * what-goes/what-stays comparison + export nudge.
               */}
              <div className="p-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Start Fresh
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erase all your financial data and begin again as a new user — your login,
                      security settings, legal consents and billing stay. You&apos;ll land back in
                      the welcome wizard with a clean slate.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                    onClick={() => setStartFreshOpen(true)}
                  >
                    Start Fresh
                  </Button>
                </div>
              </div>

              {/*
               * Delete account cross-link — the full right-to-erasure flow
               * (30-day grace) lives on Settings → Security. Discoverability
               * fix 2026-06-12: users looking to "delete everything" check
               * THIS danger zone first (screenshot-confirmed), so the path
               * is surfaced here instead of leaving them to hunt.
               */}
              <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                      <UserX className="h-4 w-4" />
                      Delete Account
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently delete your account and all data, with a 30-day grace period to
                      change your mind. Managed from the Security page.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
                    <Link href="/dashboard/settings/security">Go to Security</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <StartFreshDialog
            open={startFreshOpen}
            onClose={() => setStartFreshOpen(false)}
            token={token}
          />

          {/* Your CDR Rights Info */}
          <Card>
            <CardHeader>
              <CardTitle>Your CDR Rights</CardTitle>
              <CardDescription>
                Under the Australian Consumer Data Right regime
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p>
                  <strong>Right to consent:</strong> You must explicitly consent before Monitrax collects your CDR data.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p>
                  <strong>Right to transparency:</strong> This page shows exactly what CDR data Monitrax holds.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p>
                  <strong>Right to revoke:</strong> You can revoke consent at any time.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p>
                  <strong>Right to erasure:</strong> You can request deletion of your CDR data.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p>
                  <strong>Right to complain:</strong> Contact us at{' '}
                  <a href="mailto:complaints@monitrax.com.au" className="text-blue-600 hover:underline">
                    complaints@monitrax.com.au
                  </a>{' '}
                  or escalate to the{' '}
                  <a
                    href="https://www.oaic.gov.au/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    OAIC
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
