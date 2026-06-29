/**
 * Neobrain — free-text figure verifier (Phase 54 §15 Phase C, cashflow wiring).
 *
 * The grounding validator (`grounding.ts`) checks REFS in a structured response.
 * A free-text narrative (the cashflow summary) doesn't cite refs — so this is its
 * companion: it scans the generated prose for dollar/percent figures and redacts
 * any that don't trace to a real, given value, then the caller appends a caveat
 * note. The anti-hallucination guarantee for narrative surfaces — the user never
 * reads an invented number (Reza decision 2026-06-29: "strip + regenerate note").
 *
 * PURE — no I/O, deterministically unit-tested. Conservative by design: a wide
 * "backed" set (the real values + safe derivations ×12 / ÷12 / roundings) plus a
 * tolerance, so legitimate arithmetic ("$200/mo → $2,400/yr") is NOT false-flagged.
 * A missed invented number is mitigated by the prompt grounding (the model is fed
 * only real facts); a redacted real number would be the worse error, so we err
 * toward NOT redacting.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Expand a list of real base values into the set of figures we accept as
 * "backed" — the value itself plus safe derivations the AI legitimately makes:
 * annualised (×12), monthlyised (÷12), and common roundings.
 */
export function buildBackedValues(base: number[]): number[] {
  const out = new Set<number>();
  for (const raw of base) {
    if (!Number.isFinite(raw)) continue;
    const v = Math.abs(raw);
    for (const d of [v, v * 12, v / 12, v * 52, v / 52]) {
      if (!Number.isFinite(d)) continue;
      out.add(round2(d));
      out.add(Math.round(d)); // whole units
      out.add(Math.round(d / 10) * 10); // nearest 10
      out.add(Math.round(d / 100) * 100); // nearest 100
      out.add(Math.round(d / 1000) * 1000); // nearest 1000
    }
  }
  return [...out];
}

/** True when `n` is within tolerance of any backed value (abs + relative). */
function isBacked(n: number, backed: number[], absTol: number): boolean {
  const v = Math.abs(n);
  return backed.some((b) => Math.abs(b - v) <= absTol || (b !== 0 && Math.abs((b - v) / b) <= 0.02));
}

export interface FigureVerification {
  /** The text with unbacked figures replaced by a neutral phrase. */
  redactedText: string;
  /** The original tokens that were redacted (for logging/observability). */
  unbacked: string[];
}

/**
 * Scan `text` for $ amounts and % rates; redact any not backed by the given
 * real values. `backedAmounts` and `backedPercents` are SEPARATE — a $4,200 must
 * not be "verified" by a 42% fact. Returns the cleaned text + the redacted tokens.
 */
export function verifyNarrativeFigures(
  text: string,
  backedAmounts: number[],
  backedPercents: number[],
  opts?: { amountTol?: number; percentTol?: number },
): FigureVerification {
  const amountTol = opts?.amountTol ?? 5; // ±$5
  const percentTol = opts?.percentTol ?? 1; // ±1 percentage point
  const unbacked: string[] = [];

  // Percentages first (so the % sign isn't swallowed by the currency pass).
  let out = text.replace(/\b\d{1,3}(?:\.\d+)?\s?%/g, (token) => {
    const n = parseFloat(token.replace(/[%\s]/g, ''));
    if (!Number.isFinite(n)) return token;
    if (isBacked(n, backedPercents, percentTol)) return token;
    unbacked.push(token);
    return 'an unverified rate';
  });

  // Dollar amounts: $1,234 or $1,234.56 (with optional k/m suffix left as-is).
  out = out.replace(/\$\s?[\d,]+(?:\.\d+)?/g, (token) => {
    const n = parseFloat(token.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n)) return token;
    if (isBacked(n, backedAmounts, amountTol)) return token;
    unbacked.push(token);
    return 'an unverified amount';
  });

  return { redactedText: out, unbacked };
}

/** The caveat appended to a summary when any figure was redacted. */
export const UNVERIFIED_FIGURES_NOTE =
  '\n\nNote: one or more figures could not be verified against your data and were removed.';

/**
 * One-shot: verify a narrative against real values and append the caveat note
 * when anything was redacted. Returns the safe-to-show text.
 */
export function groundNarrative(
  text: string,
  backedAmounts: number[],
  backedPercents: number[],
  opts?: { amountTol?: number; percentTol?: number },
): { text: string; redactedCount: number } {
  const { redactedText, unbacked } = verifyNarrativeFigures(
    text,
    buildBackedValues(backedAmounts),
    backedPercents,
    opts,
  );
  return {
    text: unbacked.length > 0 ? redactedText + UNVERIFIED_FIGURES_NOTE : redactedText,
    redactedCount: unbacked.length,
  };
}
