'use client';

/**
 * Phase 47 PR 2 — Existing-user consent migration modal.
 *
 * Mounted in `DashboardLayout` so it fires for any authenticated user who
 * lacks current-version consent for the mandatory bundle (Terms / Privacy /
 * AFSL Boundary Disclosure). Typical case: a friendly who signed up before
 * Phase 47 PR 1 shipped the consent flow.
 *
 * Behaviour:
 *   - On mount, GETs `/api/auth/consent/status`.
 *   - If `requiresConsent: true`, renders a NON-DISMISSIBLE blocking modal
 *     with the same two-tick UX as the register page.
 *   - On submit, POSTs to `/api/auth/consent` with
 *     `consentSource: 'EXISTING_USER_MIGRATION'`. The existing endpoint is
 *     idempotent and re-validates the version pin, so partial-state users
 *     (e.g. accepted ToS but not Privacy from a previous failed run) are
 *     handled cleanly.
 *   - On success, dismisses; user continues to the dashboard.
 *
 * Fail-safe: if the status fetch fails (network blip, auth glitch), the
 * modal stays hidden. Better to let the user through than to lock them out
 * on a flaky API call. The next page-load retries.
 *
 * Privacy: no CDR data flows through this surface; the request only carries
 * a Firebase ID token + 4 boolean ticks. (CLAUDE.md §13.3.)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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

export function ConsentMigrationModal() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [acceptedBundle, setAcceptedBundle] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch consent status when an authenticated token is available.
  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/consent/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return; // fail-safe: skip modal on API trouble
        const body = await res.json();
        if (cancelled) return;
        setStatus(body.data ?? null);
      } catch {
        // Network blip: skip modal; next page load retries.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const handleSubmit = async () => {
    if (!token) return;
    if (!acceptedBundle) {
      setError('Please confirm you have read and agree to the Terms, Privacy Policy, and AFSL Boundary Disclosure.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          termsAccepted: true,
          privacyAccepted: true,
          afslAcknowledged: true,
          marketingOptIn,
          consentSource: 'EXISTING_USER_MIGRATION',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body.error?.message ?? 'Could not record your consent — please retry.');
      }
      // Mark satisfied so the modal closes.
      setStatus((prev) => (prev ? { ...prev, requiresConsent: false, needed: [] } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your consent — please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const shouldShow = !!status && status.requiresConsent;

  if (!shouldShow) return null;

  return (
    <Dialog open={true} onOpenChange={() => { /* non-dismissible */ }}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Updated terms — please review</DialogTitle>
          <DialogDescription>
            We've published updated legal documents that govern your use of Monitrax. Please review and accept to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="migrationBundle"
                checked={acceptedBundle}
                onCheckedChange={(v) => setAcceptedBundle(v === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span className="text-sm text-stone-700 leading-relaxed">
                I have read and agree to Monitrax's{' '}
                <Link href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Terms of Service
                </Link>
                ,{' '}
                <Link href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Privacy Policy
                </Link>
                , and{' '}
                <Link href="/legal/afsl-boundary-disclosure" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  AFSL Boundary Disclosure
                </Link>
                . I understand Monitrax does not hold an AFSL and does not provide personal financial advice.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="migrationMarketing"
                checked={marketingOptIn}
                onCheckedChange={(v) => setMarketingOptIn(v === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span className="text-sm text-stone-600 leading-relaxed">
                Optional — send me occasional emails about new features, tips, and Australian financial updates. You can unsubscribe any time.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting || !acceptedBundle}>
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                'Accept and continue'
              )}
            </Button>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            If you'd prefer not to accept, you can{' '}
            <Link href="/dashboard/settings/security" className="underline">
              delete your account
            </Link>{' '}
            from Settings. Your information will be removed in accordance with our Privacy Policy and the CDR data lifecycle.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
