/**
 * Phase 41E reform 2026-27 — canonical constants + helpers.
 *
 * Single source of truth for the 12 May 2026 Federal Budget tax-law
 * cut-over moment + per-measure commencement dates + the helpers
 * every grandfathering test in the engine reads. Documented in
 * `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.
 *
 * CLAUDE.md §12.14 (NON-NEGOTIABLE):
 *   - Every grandfathering test in the engine uses `REFORM_CUT_OVER_UTC`.
 *   - No other file may hard-code the cut-over timestamp.
 *   - No other file may hard-code per-measure commencement dates —
 *     read `getMeasureCommencement(measure)` instead.
 *
 * Why a separate file (not in `taxYearConfig.ts`):
 *   - The cut-over is a SINGLE moment in time (one timestamp, forever).
 *     It is not a per-FY config — it never changes per FY.
 *   - The per-measure commencement dates are also fixed (they only
 *     move if Treasury defers a Bill; in that case the commencement
 *     date is updated here and every consumer auto-picks up the change).
 *   - Grouping all reform-related constants in one file makes the audit
 *     trail simple: a future review can grep for `REFORM_` once.
 */

/**
 * Canonical reform cut-over moment for the 12 May 2026 Federal Budget.
 *
 * **7:30pm AEST on 12 May 2026 = `2026-05-12T09:30:00Z` UTC.**
 *
 * AEST is UTC+10. Daylight saving (AEDT, UTC+11) ends the first Sunday
 * of April — by 12 May AEDT does NOT apply, so the offset is UTC+10
 * not UTC+11. Verified: April 6 2026 (first Sunday) → AEST resumes.
 *
 * This is the load-bearing constant for **negative gearing
 * grandfathering (Measure 1)** and **CGT discount grandfathering
 * (Measure 2)** — assets where the acquisition CONTRACT (not
 * settlement) was signed at or before this moment are grandfathered
 * under the pre-reform rules indefinitely. Assets contracted AFTER
 * this moment fall under the post-reform regime once each measure
 * commences.
 *
 * **Do not change this value.** Treasury announced the cut-over at
 * Budget delivery; only Royal Assent of the Bill can move it, in
 * which case this file is updated + every test re-verified.
 */
export const REFORM_CUT_OVER_UTC = new Date('2026-05-12T09:30:00Z');

/**
 * Display label for the cut-over — used in UI copy + audit-log
 * messages. Reads naturally to AU users (AEST, not UTC).
 */
export const REFORM_CUT_OVER_AEST_LABEL = '7:30pm AEST 12 May 2026';

/**
 * The eight Budget 2026-27 reform measures. Closed discriminant —
 * adding a new measure means adding to this union + to
 * `MEASURE_COMMENCEMENT` + the per-measure `commencementVerified` flag
 * in `taxYearConfig.ts`. Reviewer rejects PRs that skip any of those.
 */
export type ReformMeasure =
  | 'NEGATIVE_GEARING_NEW_BUILDS_ONLY' // M1 — residential property
  | 'CGT_INDEXATION_PLUS_MIN_RATE' // M2 — 50% discount replaced
  | 'TRUST_MINIMUM_TAX' // M3 — 30% min tax on discretionary trusts
  | 'FOREIGN_RESIDENT_CGT' // M4 — Div 855 TARP + 365-day PAT
  | 'LOSS_REFUNDABILITY' // M5 — company carry-back + start-up + R&DTI
  | 'FOREIGN_PURCHASE_BAN' // M6 — already law, extended
  | 'VC_CAPS_LIFTED' // M7 — VCLP/ESVCLP
  | 'EV_FBT_PHASED' // M8 — phased transition
  | 'DYNAMIC_PAYG'; // M9 — monthly opt-in for SMEs

/**
 * Per-measure commencement date. The date the rule activates,
 * regardless of when the asset was acquired. Grandfathering of the
 * underlying asset (where applicable — measures 1 + 2) uses
 * `REFORM_CUT_OVER_UTC`, NOT this date.
 *
 * Format: ISO date (start of FY in AEST). Sources:
 *   - M1: 1 Jul 2027 (start of FY 2027-28)
 *   - M2: 1 Jul 2027 (start of FY 2027-28)
 *   - M3: 1 Jul 2028 (start of FY 2028-29)
 *   - M4: TBC — exposure draft published 10 Apr 2026; uses
 *         Royal-Assent gate via `taxYearConfig.commencementVerified`
 *         flag. Placeholder date is the earliest plausible
 *         commencement; do not use without the flag check.
 *   - M5: 1 Jul 2026 (current FY 2026-27 — carry-back is THIS FY).
 *         Start-up + R&DTI components defer to 1 Jul 2028
 *         (FY 2028-29).
 *   - M6: 1 Jan 2025 (already law; ban runs until 30 Jun 2029)
 *   - M7: 1 Jul 2027 (FY 2027-28; applies to new + existing funds)
 *   - M8: 1 Apr 2027 (Phase 2 commences); 1 Apr 2029 (Phase 3)
 *   - M9: 1 Jul 2027 (FY 2027-28 — opt-in)
 */
export const MEASURE_COMMENCEMENT: Record<ReformMeasure, Date> = {
  NEGATIVE_GEARING_NEW_BUILDS_ONLY: new Date('2027-06-30T14:00:00Z'), // 1 Jul 2027 00:00 AEST
  CGT_INDEXATION_PLUS_MIN_RATE: new Date('2027-06-30T14:00:00Z'),
  TRUST_MINIMUM_TAX: new Date('2028-06-30T14:00:00Z'), // 1 Jul 2028 00:00 AEST
  FOREIGN_RESIDENT_CGT: new Date('2026-12-31T13:00:00Z'), // placeholder; gate on commencementVerified
  LOSS_REFUNDABILITY: new Date('2026-06-30T14:00:00Z'), // 1 Jul 2026 00:00 AEST (current FY)
  // Audit MA.1-004 (2026-06-07): 1 Jan 2025 00:00 AEDT = 2024-12-31T13:00:00Z
  // (AEDT = UTC+11, January is summer DST in Australia). Previous value
  // `2025-01-01T13:00:00Z` was 2 Jan 2025 00:00 AEDT (24h late). No
  // observed impact at FY-level granularity; fixed for per-asset checks.
  FOREIGN_PURCHASE_BAN: new Date('2024-12-31T13:00:00Z'), // 1 Jan 2025 00:00 AEDT, already in force
  VC_CAPS_LIFTED: new Date('2027-06-30T14:00:00Z'),
  EV_FBT_PHASED: new Date('2027-03-31T13:00:00Z'), // 1 Apr 2027 00:00 AEDT
  DYNAMIC_PAYG: new Date('2027-06-30T14:00:00Z'),
};

/**
 * Grandfathering classification for a single asset acquisition.
 *
 * - `GRANDFATHERED` — contract was signed AT or BEFORE the cut-over;
 *   pre-reform rules apply indefinitely (50% CGT discount, negative
 *   gearing offsets other income, etc.).
 * - `POST_REFORM` — contract was signed AFTER the cut-over; subject
 *   to the new regime once each measure commences.
 * - `UNKNOWN` — contract date is missing; the engine cannot determine
 *   grandfathering and MUST surface UNCOMPUTED rather than guess.
 *
 * This is a pure function — caller supplies the date or null; no
 * Date.now(), no I/O, no globals. Suitable for use inside any
 * tax-engine division.
 */
export type GrandfatheringStatus =
  | 'GRANDFATHERED'
  | 'POST_REFORM'
  | 'UNKNOWN';

/**
 * Classify an acquisition contract date against the reform cut-over.
 *
 * Edge case — the cut-over moment itself: contracts signed exactly
 * AT 2026-05-12T09:30:00Z are GRANDFATHERED (Treasury fact sheet:
 * "at or before 7:30pm AEST on 12 May 2026"). The boundary is
 * inclusive of grandfathering.
 *
 * @param contractDate The acquisition CONTRACT date (CGT event A1
 *   per s109-5 ITAA 1997). NOT the settlement date, NOT the
 *   registration date. If null, returns 'UNKNOWN'.
 */
export function classifyAcquisitionGrandfathering(
  contractDate: Date | null | undefined,
): GrandfatheringStatus {
  if (!contractDate) return 'UNKNOWN';
  return contractDate.getTime() <= REFORM_CUT_OVER_UTC.getTime()
    ? 'GRANDFATHERED'
    : 'POST_REFORM';
}

/**
 * Is the given FY at or after the commencement of the given measure?
 *
 * The FY string must match the canonical format `YYYY-YY` (e.g.
 * `"2027-28"`). The function reads the FY's start date (1 July of
 * the leading year) and compares against the measure's commencement.
 *
 * Caller MUST also check the per-measure `commencementVerified` flag
 * on `taxYearConfig` before applying post-reform math — this function
 * tells you *when* the measure activates by date, not *whether* the
 * Bill has assented.
 */
export function isPostCommencementFy(
  fy: string,
  measure: ReformMeasure,
): boolean {
  const match = fy.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error(
      `[Phase 41E] Invalid FY format "${fy}" — expected YYYY-YY (e.g. "2027-28")`,
    );
  }
  const leadingYear = Number(match[1]);
  const fyStartUtc = new Date(
    `${leadingYear}-06-30T14:00:00Z`, // 1 July (AEST) of leading year
  );
  return fyStartUtc.getTime() >= MEASURE_COMMENCEMENT[measure].getTime();
}

/**
 * Human-readable label for a measure — used in UNCOMPUTED rationales
 * + audit-log messages. Mirrors the table in §2 of the Phase doc.
 */
export const MEASURE_LABEL: Record<ReformMeasure, string> = {
  NEGATIVE_GEARING_NEW_BUILDS_ONLY:
    'Negative gearing restricted to new builds (Phase 41E Measure 1)',
  CGT_INDEXATION_PLUS_MIN_RATE:
    'CGT 50% discount replaced with cost-base indexation + 30% minimum tax rate (Phase 41E Measure 2)',
  TRUST_MINIMUM_TAX:
    '30% minimum tax on discretionary-trust taxable income (Phase 41E Measure 3)',
  FOREIGN_RESIDENT_CGT:
    'Foreign-resident CGT regime strengthened — Div 855 TARP + 365-day PAT (Phase 41E Measure 4)',
  LOSS_REFUNDABILITY:
    'Loss refundability — company carry-back + start-up + R&D Tax Incentive (Phase 41E Measure 5)',
  FOREIGN_PURCHASE_BAN:
    'Foreign-purchase ban on established dwellings extended to 30 Jun 2029 (Phase 41E Measure 6)',
  VC_CAPS_LIFTED:
    'Venture-capital incentive caps lifted — VCLP + ESVCLP (Phase 41E Measure 7)',
  EV_FBT_PHASED:
    'Electric-car FBT phased transition (Phase 41E Measure 8)',
  DYNAMIC_PAYG:
    'Dynamic PAYG instalments — monthly opt-in for SMEs (Phase 41E Measure 9)',
};
