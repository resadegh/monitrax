'use client';

/**
 * /dashboard/loans/[id] — redirect-only stub.
 *
 * The canonical loan-detail experience lives in the loans index
 * (`/dashboard/loans`), which renders a detail dialog when a loan is
 * clicked. The Balances page (`/dashboard/balances`) and Activity page
 * link directly to `/dashboard/loans/<id>` for deep-linking, which used
 * to 404 because no route existed at that path — only the strategy
 * sub-route (`/dashboard/loans/[id]/strategy`).
 *
 * This page redirects `/dashboard/loans/<id>` → `/dashboard/loans?focus=<id>`.
 * The loans index reads the `focus` query param and auto-opens the
 * detail dialog for that loan, then strips the param from the URL so a
 * refresh doesn't reopen the dialog.
 *
 * Building a full standalone detail page is tracked as follow-up work —
 * for now this preserves deep-linkable URLs without duplicating the
 * loan-detail UI that already exists in the index dialog.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LoanDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;

  useEffect(() => {
    if (id) {
      router.replace(`/dashboard/loans?focus=${encodeURIComponent(id)}`);
    } else {
      router.replace('/dashboard/loans');
    }
  }, [id, router]);

  return null;
}
