-- MON-088: capture private hospital cover per household member.
-- Additive nullable column — no default, no backfill: null = "not entered",
-- which the tax engine treats conservatively as no cover while the UI shows
-- "Not sure". No existing data is touched.
ALTER TABLE "household_members" ADD COLUMN "hasPrivateHospitalCover" BOOLEAN;
