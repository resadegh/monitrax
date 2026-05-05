-- Phase 41e.0 slice B — defence-in-depth CHECK constraint for
-- LegalEntity.parentEntityId per audit doc §7.4.
--
-- Application-layer cycle-detection is the primary guard (validateParentChain
-- in lib/services/legalEntityService.ts, audit §7.3). This DB constraint
-- catches the simplest possible cycle (id = parent_entity_id) at the
-- storage layer regardless of how a row reaches the database — manual
-- INSERT, future bulk import, debugging session, etc.
--
-- §12.11 destructive-write checklist — N/A. The constraint adds a
-- guard; it does not modify, delete, or transform any existing row.
-- It rejects only rows where id = parent_entity_id, which we have
-- already established should not exist (validateParentChain Rule 1
-- has been blocking that case at the application layer since 41a).
-- If any such row existed, the constraint creation would fail and
-- the deploy would abort — the safe outcome.

ALTER TABLE "legal_entities"
  ADD CONSTRAINT "legal_entities_no_self_parent"
  CHECK ("id" <> "parentEntityId" OR "parentEntityId" IS NULL);
