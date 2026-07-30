-- MON-135: the AI categoriser must be able to record "no recurrence
-- determination" as NULL instead of asserting `false`. Constraint loosening
-- only — no data is modified or dropped; existing `false` values remain
-- (they are the ambiguous historical cohort recorded in the PR's provenance
-- note). See docs/issues/handoffs/CODE_BRIEF_MON-135_t3-precondition-ai-isrecurring.md
--
-- v2 (preview build dpl_EjLB3iuC failed, 2026-07-30 04:41): v1 used the Prisma
-- MODEL names — both models are @@map'ped, so the real tables are the
-- snake_case names below (§19.2 lesson: the table name is part of the input
-- contract; verify the @@map, not the model). The failed v1 applied ZERO
-- statements (the script fails atomically); recovery =
--   npx prisma migrate resolve --rolled-back 20260730000000_mon135_nullable_ai_isrecurring
-- against the affected (dev) database, then the next deploy runs this
-- corrected script.

-- AICategorizationLearning (@@map "ai_categorization_learnings")
ALTER TABLE "ai_categorization_learnings" ALTER COLUMN "aiIsRecurring" DROP NOT NULL;
ALTER TABLE "ai_categorization_learnings" ALTER COLUMN "aiIsRecurring" DROP DEFAULT;

-- TransactionReviewQueue (@@map "transaction_review_queue")
ALTER TABLE "transaction_review_queue" ALTER COLUMN "aiIsRecurring" DROP NOT NULL;
ALTER TABLE "transaction_review_queue" ALTER COLUMN "aiIsRecurring" DROP DEFAULT;
