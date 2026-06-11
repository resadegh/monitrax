-- Phase 47 Stage B1 (Q-EOF-2, decided 2026-06-10): retail/industry super
-- attaches to the member's PERSONAL_NAME entity (member-benefit
-- semantics). SMSF member accounts already attach to their SMSF entity
-- (Phase 39.5) and are untouched here.
--
-- §12.11 discipline: the UPDATE is confined to rows where
-- "ownerEntityId" IS NULL — it can never overwrite an existing
-- attribution (SMSF links included). The only column touched is the
-- attribution pointer; no financial values. Users without a
-- PERSONAL_NAME entity (none post-Phase-41a backfill; defensive) are
-- simply left null and handled lazily by the create-path default.
UPDATE "superannuation_accounts" sa
SET "ownerEntityId" = le.id
FROM "legal_entities" le
WHERE sa."ownerEntityId" IS NULL
  AND le."userId" = sa."userId"
  AND le."type" = 'PERSONAL_NAME';
