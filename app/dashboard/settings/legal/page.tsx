'use client';

/**
 * Phase 47 PR 3 — Settings → Legal page.
 *
 * Lets the user see what legal documents they have accepted, when, and at
 * what version; toggle marketing communications on/off (Spam Act revocation);
 * and download their complete consent record (Privacy Act APP 12).
 *
 * Data flow:
 *   - GET /api/auth/consent/status  → current vs accepted versions + marketing flag
 *   - POST /api/auth/consent        → opt back into marketing (idempotent)
 *   - POST /api/auth/consent/revoke → revoke marketing
 *   - GET /api/auth/consent/record  → download JSON
 *
 * The mandatory documents (ToS / Privacy / AFSL) are not user-revocable here —
 * if the user wants to "revoke" those, they delete their account (linked to
 * Settings → Security where the deletion flow lives). This page surfaces the
 * status + the document links + a clear pointer to the right path for
 * withdrawal.
 *
 * Behavioural-design note (CLAUDE.md §0 / §14): the tone is "here's where
 * you stand", never "here's what you owe us". The page is calm — green chips
 * for current acceptance, amber for "we have a newer version" (which kicks
 * the same modal that PR 2 mounts globally), no shouty CTAs.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileText, Download, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ConsentStatus {
  requiresConsent: boolean;
  needed: Array<'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'AFSL_BOUNDARY_DISCLOSURE'>;
  currentVersions: { tos: string; privacy: string; afsl: string };
  accepted: {
    tos: string | null;
    privacy: string | null;
    afsl: string | null;
    marketingOptIn: boolean;
  };
}

interface LegalDoc {
  key: 'tos' | 'privacy' | 'afsl';
  label: string;
  slug: string;
  description: string;
}

const LEGAL_DOCS: LegalDoc[] = [
  {
    key: 'tos',
    label: 'Terms of Service',
    slug: 'terms-of-service',
    description: 'The agreement between you and Monitrax.',
  },
  {
    key: 'privacy',
    label: 'Privacy Policy',
    slug: 'privacy-policy',
    description: 'How we collect, use, store, and protect your personal information.',
  },
  {
    key: 'afsl',
    label: 'AFSL, Credit and Tax Boundary Disclosure',
    slug: 'afsl-credit-tax-boundary-disclosure',
    description: 'What Monitrax is — and importantly, what it is not — under Australian financial-services, credit, and tax-agent-services law.',
  },
];

export default function SettingsLegalPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketingBusy, setMarketingBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/consent/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load your consent status — please refresh.');
      const body = await res.json();
      setStatus(body.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your consent status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleMarketing = async (next: boolean) => {
    if (!token || !status) return;
    setMarketingBusy(true);
    setError(null);
    try {
      if (next) {
        // Opt back in via the existing consent endpoint.
        const res = await fetch('/api/auth/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            termsAccepted: true,
            privacyAccepted: true,
            afslAcknowledged: true,
            marketingOptIn: true,
            consentSource: 'SETTINGS_UPDATE',
          }),
        });
        if (!res.ok) throw new Error('Could not opt in to marketing — please retry.');
      } else {
        const res = await fetch('/api/auth/consent/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ documentType: 'MARKETING_COMMUNICATIONS' }),
        });
        if (!res.ok) throw new Error('Could not revoke marketing — please retry.');
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your preference.');
    } finally {
      setMarketingBusy(false);
    }
  };

  const downloadRecord = async () => {
    if (!token) return;
    setDownloadBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/consent/record', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not download your record — please retry.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitrax-consent-record-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download your record.');
    } finally {
      setDownloadBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your consent state…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Legal
        </h2>
        <p className="text-muted-foreground mt-1">
          The documents you have accepted, your marketing preference, and a copy of your full consent record for your own records.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Mandatory documents */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          Documents you have accepted
        </h3>
        <div className="space-y-3">
          {LEGAL_DOCS.map((doc) => {
            const current = status?.currentVersions[doc.key] ?? null;
            const accepted = status?.accepted[doc.key] ?? null;
            const upToDate = accepted !== null && accepted === current;

            return (
              <div
                key={doc.key}
                className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-lg border border-stone-200 bg-stone-50 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{doc.label}</h4>
                    {upToDate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Up to date
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3 w-3" />
                        Newer version available
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-stone-600 mt-1">{doc.description}</p>
                  <p className="text-xs text-stone-500 mt-2">
                    Current version: <span className="font-mono">{current ?? '—'}</span>
                    {accepted && (
                      <>
                        {' '}· You accepted: <span className="font-mono">{accepted}</span>
                      </>
                    )}
                  </p>
                </div>
                <Link
                  href={`/legal/${doc.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline whitespace-nowrap"
                >
                  Read <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
        {status?.requiresConsent && (
          <p className="text-xs text-stone-500 mt-3">
            We have a newer version of one or more documents. On your next page load you'll see a brief acceptance prompt — no action needed here.
          </p>
        )}
      </section>

      {/* Marketing toggle */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          Marketing communications
        </h3>
        <div className="flex items-start justify-between rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex-1 pr-4">
            <h4 className="font-medium">Occasional emails about features and tips</h4>
            <p className="text-sm text-stone-600 mt-1">
              Separate from essential service emails (security alerts, billing). You can switch this back on any time.
            </p>
          </div>
          <Switch
            checked={status?.accepted.marketingOptIn ?? false}
            disabled={marketingBusy}
            onCheckedChange={(v) => toggleMarketing(v === true)}
          />
        </div>
      </section>

      {/* Download record */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          Your records
        </h3>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <h4 className="font-medium">Download my consent record</h4>
          <p className="text-sm text-stone-600 mt-1">
            A JSON file containing every consent event on your account — document type, version, timestamp, source. This is your full record under <span className="font-medium">Privacy Act APP 12</span>.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={downloadRecord}
            disabled={downloadBusy}
          >
            {downloadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download record (JSON)
          </Button>
        </div>
      </section>

      {/* Withdrawal pointer */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          Withdrawing acceptance
        </h3>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm text-stone-700">
            To withdraw acceptance of the mandatory documents (Terms of Service / Privacy Policy / AFSL, Credit and Tax Boundary Disclosure), you'll need to delete your account. We handle deletion in accordance with our Privacy Policy and the CDR data lifecycle — there's a 30-day cancellable grace period.
          </p>
          <Link
            href="/dashboard/settings/security"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
          >
            Go to account deletion <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
