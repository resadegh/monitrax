'use client';

/**
 * Phase 32C PR4b — `<AskAProfessionalDialog />` picker.
 *
 * Fetches candidates from `/api/ask-a-pro/candidates` and renders one of
 * two flavours:
 *
 *   - **Org-attached** — the user has at least one active+granted
 *     `OrganizationClient`. Picker shows the assigned advisor (when set)
 *     OR the org's full active roster grouped by name. Clicking a member
 *     shows a placeholder "Send a message" card until Phase 32C PR4c/4d
 *     wires the in-app conversation thread + email-through-app.
 *
 *     Server enforces the leaky-funnel guardrail — public marketplace
 *     listings are NEVER returned for org-attached users.
 *
 *   - **D2C (public)** — no org links. Picker shows up to 3 best-fit
 *     APPROVED marketplace listings biased by the calling `context`
 *     (e.g. context="tax" boosts TAX_OPTIMISATION). Clicking a listing
 *     navigates to `/marketplace/[slug]` where the existing Connect CTA
 *     is the entry point to the full request lifecycle (PR4c).
 *
 *     A "See all professionals →" footer link drops the user on the
 *     full marketplace browse for cases where the 3-best-fit isn't right.
 *
 * Accessibility: dialog role, focus-trap via tabindex, Esc to close,
 * backdrop click to close, prefers-reduced-motion-aware. The picker
 * isn't a modal blocker — the user can dismiss any time.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  AskAProResult,
  OrgScopedCandidate,
  PublicListingCandidate,
} from '@/lib/services/askAProfessionalService';
import { ComposeRequestDialog } from './ComposeRequestDialog';

interface Props {
  context?: string;
  onClose: () => void;
}

export function AskAProfessionalDialog({ context, onClose }: Props) {
  const router = useRouter();
  const [data, setData] = useState<AskAProResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // PR4c: when the user clicks a public listing, open the compose dialog
  // instead of bare-navigating to the listing page. The compose dialog
  // wraps the picker so the user can dismiss it and pick someone else
  // without leaving the AskAPro flow.
  const [composeFor, setComposeFor] = useState<PublicListingCandidate | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (context) params.set('context', context);
      const res = await fetch(`/api/ask-a-pro/candidates?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 401) {
          // Unauthenticated D2C — fall through to a friendly nudge to sign up
          setError('SIGNED_OUT');
          return;
        }
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load professionals');
      }
      const json = await res.json();
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load professionals');
    } finally {
      setIsLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Body scroll lock for mobile
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="askapro-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl ring-1 ring-slate-900/5 max-h-[90vh] overflow-y-auto motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:sm:zoom-in-95 motion-safe:sm:slide-in-from-bottom-0 duration-200"
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 id="askapro-title" className="text-[15px] font-semibold text-slate-900">
              Talk to a professional
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {context ? contextHint(context) : 'Connect with someone who can help.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full hover:bg-slate-100 w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {isLoading && <DialogSkeleton />}

          {!isLoading && error === 'SIGNED_OUT' && (
            <div className="text-center py-8">
              <p className="text-[14px] text-slate-700 mb-4">
                Create a free Monitrax account to connect with a professional.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px] font-medium transition-colors"
                onClick={onClose}
              >
                Create account
              </Link>
            </div>
          )}

          {!isLoading && error && error !== 'SIGNED_OUT' && (
            <p className="text-[13px] text-rose-700 text-center py-6">{error}</p>
          )}

          {!isLoading && !error && data?.scope === 'org' && (
            <OrgScopeView candidates={data.orgCandidates} onClose={onClose} />
          )}

          {!isLoading && !error && data?.scope === 'public' && (
            <PublicScopeView
              listings={data.listings}
              totalAvailable={data.totalAvailable}
              context={context}
              onClose={onClose}
              onPickListing={(listing) => setComposeFor(listing)}
            />
          )}
        </div>
      </div>

      {composeFor && (
        <ComposeRequestDialog
          listingId={composeFor.id}
          listingDisplayName={composeFor.displayName}
          listingDiscipline={composeFor.discipline}
          context={context}
          onClose={() => setComposeFor(null)}
          onSubmitted={(requestId) => {
            setComposeFor(null);
            onClose();
            // After submit, drop the user on their request-tracking page so
            // they can see the SUBMITTED status + withdraw if they change
            // their mind. Soft handoff — keeps the success state visible.
            router.push(`/dashboard/requests?just=${requestId}`);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SCOPE VIEWS
// =============================================================================

function OrgScopeView({
  candidates,
  onClose,
}: {
  candidates: OrgScopedCandidate[];
  onClose: () => void;
}) {
  if (candidates.length === 0) {
    return <p className="text-[13px] text-slate-600 py-4">No active org links found.</p>;
  }

  return (
    <div className="space-y-5">
      {candidates.map((candidate) => (
        <section key={candidate.orgClientId}>
          <header className="mb-3">
            <h3 className="text-[14px] font-semibold text-slate-900">{candidate.organizationName}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Your linked {candidate.organizationProfession ? professionLabel(candidate.organizationProfession) : 'firm'}.
            </p>
          </header>

          {candidate.assignedMember ? (
            <MemberCard
              member={candidate.assignedMember}
              orgClientId={candidate.orgClientId}
              orgName={candidate.organizationName}
              highlighted
              onClose={onClose}
            />
          ) : (
            <p className="text-[12px] text-slate-500 italic mb-3">
              No specific advisor assigned to you yet — the firm&rsquo;s roster:
            </p>
          )}

          {candidate.assignedMember && candidate.roster.length > 1 && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mt-4 mb-2">
              Or another team member
            </p>
          )}

          <div className="space-y-2">
            {candidate.roster
              .filter((m) => !candidate.assignedMember || m.memberId !== candidate.assignedMember.memberId)
              .map((m) => (
                <MemberCard
                  key={m.memberId}
                  member={m}
                  orgClientId={candidate.orgClientId}
                  orgName={candidate.organizationName}
                  onClose={onClose}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MemberCard({
  member,
  orgClientId,
  orgName,
  highlighted = false,
  onClose,
}: {
  member: { memberId: string; name: string; email: string; role: string };
  orgClientId: string;
  orgName: string;
  highlighted?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Ensure-or-create the org-scoped conversation, then navigate.
      // PR4d wires the in-app thread + email-through-app for this engagement.
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgClientId,
          memberId: member.memberId,
          subject: `Conversation with ${member.name}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to open conversation');
      const conversationId = json.data?.conversation?.id as string | undefined;
      if (!conversationId) throw new Error('No conversation id returned');
      onClose();
      router.push(`/dashboard/conversations/${conversationId}`);
    } catch (err) {
      // Surface inline (rare path; the picker is open + user is authenticated).
      // eslint-disable-next-line no-console
      console.warn('[AskAPro] org-scoped conversation open failed', err);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors disabled:opacity-60 ${
        highlighted
          ? 'bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100'
          : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
      title={`Message ${member.name} at ${orgName}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-[13px] ${
        highlighted ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
      }`}>
        {member.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-slate-900 truncate">{member.name}</div>
        <div className="text-[11px] text-slate-500 truncate">{member.email}</div>
      </div>
      <span className={`text-[11px] uppercase tracking-wide font-medium ${
        highlighted ? 'text-emerald-700' : 'text-slate-500'
      }`}>
        {busy ? '…' : roleLabel(member.role)}
      </span>
    </button>
  );
}

function PublicScopeView({
  listings,
  totalAvailable,
  context,
  onClose,
  onPickListing,
}: {
  listings: PublicListingCandidate[];
  totalAvailable: number;
  onPickListing: (listing: PublicListingCandidate) => void;
  context?: string;
  onClose: () => void;
}) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[14px] text-slate-700 mb-3">
          No professionals match your context yet.
        </p>
        <Link
          href="/marketplace"
          onClick={onClose}
          className="inline-flex items-center rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-[13px] font-medium transition-colors"
        >
          Browse all professionals
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500 mb-3">
        {context ? `Best-fit for ${contextNoun(context)}` : 'Suggested for you'} · {listings.length} of {totalAvailable}
      </p>
      {listings.map((l) => (
        <button
          type="button"
          key={l.id}
          onClick={() => onPickListing(l)}
          className="group w-full text-left rounded-xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-sm transition-all p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h4 className="text-[14px] font-semibold text-slate-900 leading-snug">{l.displayName}</h4>
            {l.averageRating && (
              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                {parseFloat(l.averageRating).toFixed(1)} ★
              </span>
            )}
          </div>
          {l.tagline && (
            <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2 mb-2">{l.tagline}</p>
          )}
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{disciplineLabel(l.discipline)}</span>
            <span className="text-emerald-700 group-hover:translate-x-0.5 transition-transform">Send a question →</span>
          </div>
        </button>
      ))}
      <div className="pt-2 text-center">
        <Link
          href="/marketplace"
          onClick={onClose}
          className="text-[12px] text-emerald-700 hover:text-emerald-800 font-medium underline decoration-emerald-200 hover:decoration-emerald-500 underline-offset-2"
        >
          See all professionals →
        </Link>
      </div>
    </div>
  );
}

function DialogSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-slate-100 animate-pulse h-20" />
      ))}
    </div>
  );
}

// =============================================================================
// LABEL HELPERS
// =============================================================================

function contextHint(context: string): string {
  switch (context) {
    case 'tax':
    case 'tax-planning':
      return 'Find a tax-savvy professional for your structure.';
    case 'retirement':
      return 'Find a retirement-planning specialist.';
    case 'refinance':
      return 'Find a broker who can review your loan options.';
    case 'home-loan':
      return 'Find a broker for your home loan.';
    case 'investment-loan':
      return 'Find a broker for an investment loan.';
    case 'property':
      return 'Find someone who works with property investors.';
    case 'smsf':
      return 'Find an SMSF specialist.';
    case 'wealth':
      return 'Find a wealth-building strategist.';
    case 'trust':
      return 'Find a trust-accounting specialist.';
    case 'business':
      return 'Find a business-savvy professional.';
    case 'estate':
      return 'Find an estate-planning specialist.';
    case 'insurance':
      return 'Find a risk-and-insurance specialist.';
    default:
      return 'Connect with someone who can help.';
  }
}

function contextNoun(context: string): string {
  switch (context) {
    case 'tax': case 'tax-planning': return 'tax planning';
    case 'retirement': return 'retirement planning';
    case 'refinance': return 'refinancing';
    case 'home-loan': return 'home loans';
    case 'investment-loan': return 'investment loans';
    case 'property': return 'property investing';
    case 'smsf': return 'SMSFs';
    case 'wealth': return 'wealth building';
    case 'trust': return 'trust accounting';
    case 'business': return 'business owners';
    case 'estate': return 'estate planning';
    case 'insurance': return 'risk + insurance';
    default: return 'your question';
  }
}

function disciplineLabel(d: string): string {
  switch (d) {
    case 'FINANCIAL_ADVISOR': return 'Financial adviser';
    case 'MORTGAGE_BROKER': return 'Mortgage broker';
    case 'ACCOUNTING_FIRM': return 'Accounting firm';
    case 'TAX_AGENT': return 'Tax agent';
    case 'BOOKKEEPER': return 'Bookkeeper';
    case 'OTHER': return 'Professional';
    default: return d;
  }
}

function professionLabel(p: string): string {
  switch (p) {
    case 'FINANCIAL_ADVISOR': return 'financial advisory';
    case 'MORTGAGE_BROKER': return 'mortgage broker';
    case 'ACCOUNTING_FIRM': return 'accounting firm';
    case 'TAX_AGENT': return 'tax agency';
    case 'BOOKKEEPER': return 'bookkeeping firm';
    default: return 'firm';
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'OWNER': return 'Principal';
    case 'ADMIN': return 'Manager';
    case 'CONTRIBUTOR': return 'Adviser';
    case 'VIEWER': return 'Read-only';
    default: return role.toLowerCase();
  }
}
