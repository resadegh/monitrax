-- MON-135: the AI categoriser must be able to record "no recurrence
-- determination" as NULL instead of asserting `false`. Constraint loosening
-- only — no data is modified or dropped; existing `false` values remain
-- (they are the ambiguous historical cohort recorded in the PR's provenance
-- note). See docs/issues/handoffs/CODE_BRIEF_MON-135_t3-precondition-ai-isrecurring.md

-- AICategorizationLearning.aiIsRecurring: Boolean NOT NULL DEFAULT false -> Boolean NULL
ALTER TABLE "AICategorizationLearning" ALTER COLUMN "aiIsRecurring" DROP NOT NULL;
ALTER TABLE "AICategorizationLearning" ALTER COLUMN "aiIsRecurring" DROP DEFAULT;

-- TransactionReviewQueue.aiIsRecurring: Boolean NOT NULL DEFAULT false -> Boolean NULL
ALTER TABLE "TransactionReviewQueue" ALTER COLUMN "aiIsRecurring" DROP NOT NULL;
ALTER TABLE "TransactionReviewQueue" ALTER COLUMN "aiIsRecurring" DROP DEFAULT;
