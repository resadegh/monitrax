'use client';

/**
 * Phase 32C PR4c — Connect CTA on the public listing detail page.
 *
 * Behaviour: clicking opens the `<ComposeRequestDialog />`. If the user
 * isn't authenticated, the API returns 401 and the dialog falls through
 * to the "Create a free Monitrax account" nudge. If the user is org-
 * attached (any active+granted OrganizationClient), the API returns
 * 403 ORG_USER_PUBLIC_BLOCKED and the dialog surfaces the friendly
 * leaky-funnel guardrail message — *"send them a message through your
 * existing connection rather than the public marketplace"*.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ComposeRequestDialog } from '@/components/ask-a-pro';

interface Props {
  listingId: string;
  listingDisplayName: string;
  listingDiscipline: string;
  publicSlug: string;
}

export function ConnectCta({ listingId, listingDisplayName, listingDiscipline, publicSlug }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-5 py-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[14px] font-semibold text-emerald-900">Want to talk to {listingDisplayName}?</h3>
          <p className="text-[12px] text-emerald-700 mt-0.5">
            Send them a question — they&rsquo;ll review and either accept or decline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px] font-medium transition-colors"
          >
            Send a question →
          </button>
          <Link
            href={`/signup?intent=connect&listing=${publicSlug}`}
            className="inline-flex items-center rounded-full hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 text-[12px] font-medium transition-colors"
          >
            Or create account
          </Link>
        </div>
      </div>
      {open && (
        <ComposeRequestDialog
          listingId={listingId}
          listingDisplayName={listingDisplayName}
          listingDiscipline={listingDiscipline}
          onClose={() => setOpen(false)}
          onSubmitted={(requestId) => {
            setOpen(false);
            router.push(`/dashboard/requests?just=${requestId}`);
          }}
        />
      )}
    </>
  );
}
