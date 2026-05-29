-- Phase 21.5 Tier 2 — per-user reminder snooze/dismiss/done state
--
-- Additive only. Creates one enum + one new table; touches no existing table.
--   - "ReminderStatus" enum (SNOOZED / DISMISSED / DONE)
--   - "reminder_states" table — per-user state keyed by the engine's synthetic
--     reminder id (`${entityId}:${sourceType}`). Absence of a row = ACTIVE; a
--     row exists only once the user acts on a reminder, so the table stays small.
--     `dueDate` records the cycle the action applies to, so the pure merge can
--     reset dismiss/done once the renewal rolls over.
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — pure additive (CREATE TYPE
--   + CREATE TABLE only). No UPDATE/DELETE, no DROP/ALTER ... DROP/TRUNCATE, no
--   backfill. No existing row touched.
--
-- CLAUDE.md §12.12: matching schema.prisma change ships in the same PR.
-- CLAUDE.md §12.14: N/A — no tax-engine / reform interaction (UI state only).

CREATE TYPE "ReminderStatus" AS ENUM ('SNOOZED', 'DISMISSED', 'DONE');

CREATE TABLE "reminder_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reminder_states_userId_reminderKey_key" ON "reminder_states"("userId", "reminderKey");

CREATE INDEX "reminder_states_userId_idx" ON "reminder_states"("userId");

ALTER TABLE "reminder_states" ADD CONSTRAINT "reminder_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
