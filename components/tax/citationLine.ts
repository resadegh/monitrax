/**
 * MON-107 — render the ENGINE's citation trail as the card's citation line.
 *
 * The engines (classifyPsi / applyDiv152) already emit the correct
 * per-branch `citations` array (e.g. s87-60 on the ATO-determination PSB
 * route, s86-15 only on attribution routes). A card that hardcodes a
 * citation restates engine metadata — the Ring-1 source-lock violation
 * VR-037 finding 5 caught live (the $0 PSB branch cited s86-15, the
 * attribution provision). One producer per derived string: the engine owns
 * the citation, this helper only formats what it emitted.
 *
 * Pure — kept separate from the 'use client' cards so the guardrail test
 * (tests/tax/mon107PsiCitationLine.test.ts) exercises the exact rendered
 * string against the real engine output.
 */

export interface CitationRef {
  kind: string;
  reference: string;
}

const KIND_LABELS: Record<string, string> = {
  ITAA_1997: 'ITAA 1997',
  ITAA_1936: 'ITAA 1936',
  TR: 'TR',
  TD: 'TD',
};

/**
 * "ITAA 1997 Part 2-42 (PSI) · s84-5 · s87-15 (PSB) · TR 2022/3 · …" —
 * the kind label prefixes the first citation of each consecutive run of the
 * same kind; subsequent references of that kind render bare. Falls back to
 * `fallback` only when the engine emitted nothing (absent/empty array).
 */
export function formatCitationLine(
  citations: ReadonlyArray<CitationRef> | null | undefined,
  fallback = 'ITAA 1997 Part 2-42',
): string {
  if (!citations || citations.length === 0) return fallback;
  const parts: string[] = [];
  let prevKind: string | null = null;
  for (const c of citations) {
    const label = KIND_LABELS[c.kind] ?? c.kind.replace(/_/g, ' ');
    parts.push(c.kind === prevKind ? c.reference : `${label} ${c.reference}`);
    prevKind = c.kind;
  }
  return parts.join(' · ');
}
