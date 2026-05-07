/**
 * Phase 42 PR6 — Cancel-subscription deep-link primitive.
 *
 * Per spec §6 — "subscription cancel hints surface as one-tap
 * 'Manage subscription' affordance on recurring-payment cards".
 * This is the primitive that consumes PR5's `CANCEL_URL_REGISTRY`
 * (and any user override on the Vendor row) and renders a single
 * outbound link.
 *
 * Hard rules per spec §6.7:
 *   - Direct deep-link to the merchant's account page; NO Monitrax
 *     middleware (no click-tracking; no analytics).
 *   - Hidden when no URL known.
 *   - `target="_blank"` + `rel="noopener noreferrer"` for safety.
 *
 * Per CLAUDE.md §0 designer lens: small, restrained, single-purpose.
 * Lives wherever a recurring-payment row or vendor-card surfaces a
 * call-to-action. Composes the existing PR5 surface; no new API.
 */

import { ExternalLink } from 'lucide-react';

interface CancelSubscriptionLinkProps {
  cancelUrl: string | null | undefined;
  /** Display name of the merchant — used in link copy. */
  vendorName?: string;
  variant?: 'pill' | 'inline';
}

export function CancelSubscriptionLink({
  cancelUrl,
  vendorName,
  variant = 'inline',
}: CancelSubscriptionLinkProps) {
  if (!cancelUrl) return null;
  const label = vendorName ? `Manage on ${vendorName}` : 'Manage subscription';

  if (variant === 'pill') {
    return (
      <a
        href={cancelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
      >
        {label}
        <ExternalLink className="w-3 h-3" aria-hidden />
      </a>
    );
  }

  return (
    <a
      href={cancelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900 hover:underline underline-offset-2"
    >
      {label}
      <ExternalLink className="w-3 h-3" aria-hidden />
    </a>
  );
}
