'use client';

/**
 * MY ACCOUNTS → ACTIVITY → Review categories (Phase 52.5c)
 *
 * Dedicated full-page categorisation triage inbox. The calm surface for
 * clearing a backlog — complements the inline Activity `ConfidenceReviewCard`
 * (which deep-links here). Reuses the existing, KB-wired review-queue +
 * bulk-confirm endpoints (no new endpoints). See ReviewCategoriesInbox for the
 * Stitch design refs + glass vocabulary.
 */

import DashboardLayout from '@/components/DashboardLayout';
import { ReviewCategoriesInbox } from '@/components/bookkeeping/ReviewCategoriesInbox';

export default function ReviewCategoriesPage() {
  return (
    <DashboardLayout>
      <ReviewCategoriesInbox />
    </DashboardLayout>
  );
}
