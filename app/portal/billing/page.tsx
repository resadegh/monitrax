'use client';

/**
 * Phase 32C PR6 — Org-side billing page.
 *
 * Route: `/portal/billing`
 *
 * Shows the org's current plan, lets PORTAL_OWNER subscribe (Studio /
 * Practice via Stripe Checkout) or schedule cancellation. Enterprise is
 * sales-led — the button routes to a contact-sales mailto.
 *
 * In dev/demo environments where `STRIPE_SECRET_KEY` isn't set, the
 * billing API returns `configured: false` and we render a friendly
 * notice rather than crashing — the architectural pattern is visible
 * even without the key.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useOrganization } from '@/lib/portal';
import { PracticeGlassCard, PracticeHeader } from '@/components/portal/practice';
import { getPracticeProfessionConfig } from '@/lib/portal/practice';
import type { OrganizationType } from '@prisma/client';

interface BillingStatus {
  configured: boolean;
  planTier: 'STUDIO' | 'PRACTICE' | 'ENTERPRISE';
  subscription: {
    id: string;
    status: string;
    planTier: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    isTestMode: boolean;
  } | null;
  customer: {
    stripeCustomerId: string;
    email: string;
    isTestMode: boolean;
  } | null;
}

interface PlanTile {
  tier: 'STUDIO' | 'PRACTICE' | 'ENTERPRISE';
  name: string;
  priceLabel: string;
  monthly: number | null;
  features: string[];
  ctaLabel: string;
  ctaTone: 'primary' | 'secondary' | 'sales';
  recommended?: boolean;
}

const PLAN_TILES: PlanTile[] = [
  {
    tier: 'STUDIO',
    name: 'Studio',
    priceLabel: 'AU$199',
    monthly: 199,
    features: [
      '3 seats included',
      '50 active clients',
      '90-day audit log retention',
      'Marketplace listing',
      'In-app + email-through-app conversations',
    ],
    ctaLabel: 'Subscribe',
    ctaTone: 'secondary',
  },
  {
    tier: 'PRACTICE',
    name: 'Practice',
    priceLabel: 'AU$599',
    monthly: 599,
    features: [
      '10 seats included',
      '250 active clients',
      '365-day audit log retention',
      'White-label branding',
      'API access',
    ],
    ctaLabel: 'Subscribe',
    ctaTone: 'primary',
    recommended: true,
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    priceLabel: 'From AU$1,499',
    monthly: null,
    features: [
      'Unlimited seats + clients',
      '7-year audit log retention',
      'Single sign-on (SSO)',
      'Custom domain',
      'Dedicated success manager',
    ],
    ctaLabel: 'Contact sales',
    ctaTone: 'sales',
  },
];

function BillingContent() {
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get('success') === 'true';
  const checkoutCancelled = searchParams.get('cancelled') === 'true';

  const { currentOrg } = useOrganization();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const orgId = currentOrg?.id ?? null;
  const userRole = currentOrg?.role ?? 'VIEWER';
  const isOwner = userRole === 'OWNER';

  const profession =
    (currentOrg?.profession as OrganizationType | undefined) ??
    (currentOrg?.organizationType as OrganizationType | undefined) ??
    'FINANCIAL_ADVISOR';
  const practiceLabel = getPracticeProfessionConfig(profession).practiceLabel;

  const load = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/billing?organizationId=${orgId}`, { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load billing status');
      }
      const json = await res.json();
      setStatus(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing status');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubscribe = useCallback(async (tier: 'STUDIO' | 'PRACTICE') => {
    if (!orgId) return;
    setSubscribing(tier);
    setError(null);
    try {
      const res = await fetch('/api/portal/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, planTier: tier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Subscribe failed');
      const url = json.data?.url as string | undefined;
      if (!url) throw new Error('Stripe did not return a checkout URL');
      window.location.href = url; // Stripe-hosted Checkout
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscribe failed');
      setSubscribing(null);
    }
  }, [orgId]);

  const handleCancel = useCallback(async () => {
    if (!orgId || !confirm('Cancel at end of billing period?')) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Cancel failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  }, [orgId, load]);

  const handleResume = useCallback(async () => {
    if (!orgId) return;
    setResuming(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/billing/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Resume failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume failed');
    } finally {
      setResuming(false);
    }
  }, [orgId, load]);

  const sub = status?.subscription;
  const currentTier = status?.planTier ?? 'STUDIO';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
        <PracticeHeader
          organisationName={currentOrg?.name?.split(' ')[0] ?? 'there'}
          profession={profession}
          practiceLabel={practiceLabel}
        />

        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Billing</h1>
          <p className="mt-1 text-[14px] text-slate-600 max-w-2xl">
            Manage your firm&rsquo;s subscription. Plan changes take effect immediately; cancellations apply at the end of the current billing period.
          </p>
        </div>

        {checkoutSuccess && (
          <PracticeGlassCard padding="md" accentTone="opportunity">
            <p className="text-[14px] text-emerald-900 font-medium">Subscription activated.</p>
            <p className="text-[12px] text-emerald-800 mt-1">
              Stripe will fire the subscription-created webhook within seconds. Refresh this page if your plan tier hasn&rsquo;t updated.
            </p>
          </PracticeGlassCard>
        )}

        {checkoutCancelled && (
          <PracticeGlassCard padding="md">
            <p className="text-[14px] text-slate-700">Checkout was cancelled. Your existing plan is unchanged.</p>
          </PracticeGlassCard>
        )}

        {error && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <p className="text-[14px] text-rose-700">{error}</p>
          </PracticeGlassCard>
        )}

        {!isLoading && status && !status.configured && (
          <PracticeGlassCard padding="md">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-1">Billing not configured in this environment</h3>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Stripe API keys aren&rsquo;t set in this environment. Plan tiles below are illustrative only — clicking Subscribe will return a 503. Configure <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">STRIPE_WEBHOOK_SECRET</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">STRIPE_STUDIO_PRICE_ID</code>, and <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">STRIPE_PRACTICE_PRICE_ID</code> to activate. See <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">lib/services/stripeBillingService.ts</code>.
            </p>
          </PracticeGlassCard>
        )}

        {/* Current subscription */}
        {!isLoading && sub && (
          <PracticeGlassCard padding="lg">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[12px] font-medium uppercase tracking-wide text-slate-500 mb-1">Current plan</div>
                <div className="text-[24px] font-semibold text-slate-900">{currentTier}</div>
                <p className="text-[12px] text-slate-500 mt-1">
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {sub.isTestMode && <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">Test mode</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-2.5 py-0.5 text-[11px] font-medium ${
                  sub.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' :
                  sub.status === 'TRIALING' ? 'bg-sky-50 text-sky-800 ring-sky-200' :
                  sub.status === 'PAST_DUE' ? 'bg-amber-50 text-amber-800 ring-amber-200' :
                  'bg-rose-50 text-rose-800 ring-rose-200'
                }`}>
                  {sub.status}
                </span>
                {sub.cancelAtPeriodEnd ? (
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={!isOwner || resuming}
                    className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
                  >
                    {resuming ? 'Resuming…' : 'Resume subscription'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={!isOwner || cancelling}
                    className="inline-flex items-center rounded-full bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-900 px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel at period end'}
                  </button>
                )}
              </div>
            </div>
            {sub.cancelAtPeriodEnd && (
              <div className="mt-4 rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-2 text-[12px] text-rose-900">
                Cancellation scheduled for {new Date(sub.currentPeriodEnd).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}. Your team keeps full access until then.
              </div>
            )}
          </PracticeGlassCard>
        )}

        {/* Plan tiles */}
        <div>
          <h2 className="text-[18px] font-semibold text-slate-900 mb-1">
            {sub ? 'Change your plan' : 'Choose a plan'}
          </h2>
          <p className="text-[12px] text-slate-500 mb-4">
            All plans billed monthly in AUD. Annual pricing available on Practice + Enterprise — contact sales for a 15% discount.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLAN_TILES.map((tile) => {
              const isCurrent = sub?.planTier === tile.tier && (sub?.status === 'ACTIVE' || sub?.status === 'TRIALING');
              return (
                <PracticeGlassCard
                  key={tile.tier}
                  padding="lg"
                  accentTone={tile.recommended ? 'opportunity' : null}
                  className={isCurrent ? 'ring-2 ring-emerald-300' : ''}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-[16px] font-semibold text-slate-900">{tile.name}</h3>
                    {tile.recommended && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-[24px] font-semibold text-slate-900 tabular-nums mb-0.5">{tile.priceLabel}</div>
                  <div className="text-[11px] text-slate-500 mb-4">{tile.monthly !== null ? 'per month' : 'monthly, custom'}</div>

                  <ul className="space-y-1.5 text-[12px] text-slate-700 leading-relaxed mb-5">
                    {tile.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="text-emerald-600 flex-shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full inline-flex items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 px-3 py-2 text-[12px] font-medium"
                    >
                      Current plan
                    </button>
                  ) : tile.tier === 'ENTERPRISE' ? (
                    <a
                      href="mailto:sales@monitrax.com.au?subject=Enterprise%20enquiry"
                      className="w-full inline-flex items-center justify-center rounded-full bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-[12px] font-medium transition-colors"
                    >
                      Contact sales →
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSubscribe(tile.tier as 'STUDIO' | 'PRACTICE')}
                      disabled={!isOwner || subscribing !== null}
                      className={`w-full inline-flex items-center justify-center rounded-full px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        tile.ctaTone === 'primary'
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      {subscribing === tile.tier ? 'Loading…' : sub ? `Switch to ${tile.name}` : tile.ctaLabel}
                    </button>
                  )}
                </PracticeGlassCard>
              );
            })}
          </div>
          {!isOwner && (
            <p className="mt-4 text-[11px] text-slate-500 text-center">
              Only the Org owner can change billing. Ask <Link href="/portal/team" className="underline">your team admin</Link> to upgrade.
            </p>
          )}
        </div>

        <PracticeGlassCard padding="md">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Lead-fee billing</h3>
          <p className="text-[13px] text-slate-700 leading-relaxed mb-2">
            Lead fees from accepted marketplace requests are billed separately, charged via Stripe per accepted engagement (AU$80 / $150 / $250 by user net-worth bracket).
          </p>
          <p className="text-[11px] text-slate-500">
            Invoice history surface ships in the next slice (PR6b). For now, lead-fee billing intent is recorded on each ProfessionalRequest.<code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">leadFeeChargedAt</code> column.
          </p>
        </PracticeGlassCard>
      </div>
    </div>
  );
}

export default function PortalBillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}
