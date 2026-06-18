-- Phase 47 F4 (F-LAW review, 2026-06-12) — partnership subtype.
-- Distinguishes GENERAL / LIMITED / INCORPORATED_LIMITED / VCLP / ESVCLP.
-- Corporate limited partnerships are taxed as companies (Div 5A ITAA36);
-- VCLP / ESVCLP carry Phase 41E Measure 7 treatment. Additive, nullable —
-- existing rows untouched.
ALTER TABLE "legal_entities" ADD COLUMN "partnershipSubtype" TEXT;
