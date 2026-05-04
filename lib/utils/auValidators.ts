/**
 * AU regulatory identifier validators — Phase 41b.
 *
 * Single canonical source for ABN / ACN / TFN format + checksum validation.
 * Used by the entity wizard step + standalone entity-management surface +
 * server-side `/api/entities` Zod schemas.
 *
 * Authorities:
 *   - ABN — Australian Business Number, 11 digits with weighted modulus 89
 *     checksum per the ATO ABN spec (subtract 1 from first digit, multiply
 *     by weights [10,1,3,5,7,9,11,13,15,17,19], sum mod 89 must equal 0).
 *     Reference: https://abr.business.gov.au/Help/AbnFormat
 *   - ACN — Australian Company Number, 9 digits with weighted complement
 *     checksum per ASIC spec (multiply digits 1–8 by weights [8,7,6,5,4,3,2,1],
 *     sum mod 10, complement-to-10 must equal digit 9; if sum%10===0 then
 *     check digit is 0). Reference: ASIC Regulatory Guide 22.
 *   - TFN — Tax File Number format only (8 or 9 digits). Per CLAUDE.md §13
 *     the *value* is encrypted at rest via lib/security/tfnEncryption.ts;
 *     this validator never persists or logs the value.
 *
 * All three accept human-formatted input (with spaces, hyphens) and
 * normalise internally — a user typing "12 345 678 901" passes the same
 * check as "12345678901".
 */

const NUMERIC_ONLY = /^\d+$/;

/**
 * Strip non-digit characters from a string. Returns empty string for
 * null/undefined input.
 */
function digits(input: string | null | undefined): string {
  if (input == null) return '';
  return input.replace(/\D+/g, '');
}

// ---------------------------------------------------------------------------
// ABN — Australian Business Number
// ---------------------------------------------------------------------------

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

/**
 * Validate an ABN. Returns true for a properly formatted 11-digit ABN
 * with valid modulus-89 checksum. Accepts spaces/hyphens (normalised away).
 *
 * Returns false for null/empty (caller decides whether the field is
 * required); use `isValidAbnRequired` for required-field semantics.
 */
export function isValidAbn(input: string | null | undefined): boolean {
  const d = digits(input);
  if (d.length !== 11) return false;
  if (!NUMERIC_ONLY.test(d)) return false;

  // Subtract 1 from first digit, then weighted sum modulo 89.
  const adjusted = (parseInt(d[0], 10) - 1).toString() + d.slice(1);
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(adjusted[i], 10) * ABN_WEIGHTS[i];
  }
  return sum % 89 === 0;
}

/** True only when an ABN is present AND valid. */
export function isValidAbnRequired(input: string | null | undefined): boolean {
  const d = digits(input);
  return d.length > 0 && isValidAbn(d);
}

/**
 * Format a raw 11-digit ABN as `XX XXX XXX XXX` (the ATO display format).
 * Returns the input unchanged if it's not a valid 11-digit string.
 */
export function formatAbn(input: string | null | undefined): string {
  const d = digits(input);
  if (d.length !== 11) return input ?? '';
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

// ---------------------------------------------------------------------------
// ACN — Australian Company Number
// ---------------------------------------------------------------------------

const ACN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

/**
 * Validate an ACN. 9-digit Australian Company Number with ASIC complement
 * checksum.
 */
export function isValidAcn(input: string | null | undefined): boolean {
  const d = digits(input);
  if (d.length !== 9) return false;
  if (!NUMERIC_ONLY.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(d[i], 10) * ACN_WEIGHTS[i];
  }
  const remainder = sum % 10;
  const expectedCheckDigit = remainder === 0 ? 0 : 10 - remainder;
  return parseInt(d[8], 10) === expectedCheckDigit;
}

/** True only when an ACN is present AND valid. */
export function isValidAcnRequired(input: string | null | undefined): boolean {
  const d = digits(input);
  return d.length > 0 && isValidAcn(d);
}

/**
 * Format a raw 9-digit ACN as `XXX XXX XXX` (the ASIC display format).
 */
export function formatAcn(input: string | null | undefined): string {
  const d = digits(input);
  if (d.length !== 9) return input ?? '';
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
}

// ---------------------------------------------------------------------------
// TFN — Tax File Number (format only)
// ---------------------------------------------------------------------------

/**
 * Validate a TFN's format (8 or 9 digits). Per ATO spec the actual
 * checksum is not publicly published (security-by-obscurity); we
 * intentionally accept any 8/9-digit string. The value itself is
 * encrypted at rest via `lib/security/tfnEncryption.ts` per CLAUDE.md §13.
 *
 * NEVER log the input. NEVER pass the input to any AI. NEVER include
 * in audit metadata (use `sanitizeCdrMetadata` if a TFN-bearing object
 * accidentally flows through).
 */
export function isValidTfnFormat(input: string | null | undefined): boolean {
  const d = digits(input);
  return d.length === 8 || d.length === 9;
}

/** True only when a TFN is present AND format-valid. */
export function isValidTfnFormatRequired(input: string | null | undefined): boolean {
  const d = digits(input);
  return d.length > 0 && isValidTfnFormat(d);
}
