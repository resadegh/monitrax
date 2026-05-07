-- Phase 42 PR6 — Engagement state (Daily Pulse / streak / celebration)
--
-- One additive table — `engagement_state` — keyed uniquely on userId.
-- Per CLAUDE.md §0 behaviour-psychologist lens: the streak system uses
-- a Duolingo-style shield mechanic (one missed day per 7-day window
-- doesn't break the streak); the completion celebration is gated to
-- once-per-day max via `lastCelebrationAt` so scarcity preserves the
-- delight.
--
-- All operations additive: CREATE TABLE × 1 + index + FK.
-- NO row UPDATE / DELETE / UPSERT, NO destructive ALTER. §12.11 N/A.

CREATE TABLE "engagement_state" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "lastShieldUsedAt" TIMESTAMP(3),
    "lastCelebrationAt" TIMESTAMP(3),
    "totalCategorisations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engagement_state_userId_key" ON "engagement_state"("userId");

ALTER TABLE "engagement_state"
    ADD CONSTRAINT "engagement_state_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
