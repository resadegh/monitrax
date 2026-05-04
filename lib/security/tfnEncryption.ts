/**
 * TFN (Tax File Number) at-rest encryption helper — Phase 41a.
 *
 * Mirrors the `MFAMethod.secret` pattern in `lib/security/mfa.ts` (Phase 10):
 * a single canonical wrap/unwrap pair lives here so every TFN read/write goes
 * through one swap-point. When CMEK lands (`IMPLEMENTATION_PLAN.md` Up Next #3
 * — "CMEK for Cloud SQL data-at-rest"), the bodies of `encryptTfn()` and
 * `decryptTfn()` change to call into Cloud KMS. Callers do not change.
 *
 * Hard rules (CLAUDE.md §13):
 *   - TFN is OPTIONAL on `LegalEntity` (`tfnEncrypted` is nullable; default-off).
 *   - TFN is NEVER logged (`log.info(..., { tfn })` is a code-review reject).
 *   - TFN is NEVER included in audit metadata — if a tfn-bearing entity object
 *     flows through `createAuditLog()`, run it through `sanitizeCdrMetadata()`
 *     first.
 *   - TFN is NEVER sent to Gemini or any AI model.
 *   - TFN is NEVER included in API responses by default. The standard SELECT
 *     for a `LegalEntity` row should explicitly omit the `tfnEncrypted` field
 *     unless the caller has a documented reason to read it.
 *
 * What this helper IS:
 *   - A reversible obfuscation wrapper that prevents accidental disclosure
 *     of TFNs in DB dumps, log spillover, and snapshot exports.
 *
 * What this helper IS NOT:
 *   - A substitute for KMS-backed CMEK. The CDR data-at-rest tier compliance
 *     gap is closed by CMEK + Cloud SQL encryption-at-rest, which is queued
 *     under Up Next #3 and tracked in `CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.3.
 *
 * Format detail:
 *   - On write: input is normalised (digits-only, trailing checksum digit
 *     preserved), validated as 8 or 9 digits per ATO TFN spec, then base64
 *     wrapped — same encoding used by `MFAMethod.secret`.
 *   - On read: base64 unwrap, return raw digits.
 *   - Validation rejects strings that don't match the 8–9 digit shape so
 *     malformed input never makes it to disk.
 */

const TFN_DIGIT_PATTERN = /^\d{8,9}$/;

/**
 * Encrypt a TFN for at-rest storage in `LegalEntity.tfnEncrypted`.
 * Returns null when input is null/empty, so callers can pipe optional values
 * through without conditional branching.
 */
export function encryptTfn(rawTfn: string | null | undefined): string | null {
  if (rawTfn == null) return null;
  const digits = rawTfn.replace(/\s+/g, '');
  if (digits === '') return null;
  if (!TFN_DIGIT_PATTERN.test(digits)) {
    throw new Error('Invalid TFN: must be 8 or 9 digits (no spaces, no separators).');
  }
  return Buffer.from(digits, 'utf-8').toString('base64');
}

/**
 * Decrypt a TFN from at-rest storage. Returns null for null inputs (no
 * branching at the call site). Callers MUST treat the return value as
 * sensitive — never log, never include in audit metadata, never serialise
 * into an API response by default.
 */
export function decryptTfn(encrypted: string | null | undefined): string | null {
  if (encrypted == null || encrypted === '') return null;
  try {
    const digits = Buffer.from(encrypted, 'base64').toString('utf-8');
    if (!TFN_DIGIT_PATTERN.test(digits)) {
      throw new Error('Decrypted TFN failed digit-shape validation.');
    }
    return digits;
  } catch {
    throw new Error('TFN decryption failed.');
  }
}

/**
 * Mask a TFN for display in UIs that need to confirm presence without
 * disclosing the value (e.g. "TFN on file: ***-***-789"). Accepts an
 * already-decrypted raw TFN. Never log the unmasked value to derive this.
 */
export function maskTfn(rawTfn: string | null | undefined): string {
  if (rawTfn == null || rawTfn === '') return '';
  const digits = rawTfn.replace(/\s+/g, '');
  if (!TFN_DIGIT_PATTERN.test(digits)) return '';
  const last3 = digits.slice(-3);
  return `***-***-${last3}`;
}
