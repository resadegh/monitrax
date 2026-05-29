-- Phase 21.5 R1 PR2b — user-created custom reminders
--
-- Additive only. Creates one new table; touches no existing table.
--   - "reminders" — user-created custom reminders (title + dueDate + optional
--     note). Projected into the unified feed by computeCustomReminders; the
--     synthetic id `${id}:CUSTOM` shares the ReminderState snooze/dismiss/done
--     machinery (no separate state table).
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — pure additive
--   (CREATE TABLE only). No UPDATE/DELETE, no DROP/ALTER ... DROP/TRUNCATE,
--   no backfill. No existing row touched.
--
-- CLAUDE.md §12.12: matching schema.prisma change ships in the same PR.
-- CLAUDE.md §12.14: N/A — no tax-engine / reform interaction (UI content only).

CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");

ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
