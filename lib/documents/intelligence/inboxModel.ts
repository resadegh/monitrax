/**
 * MON-187 — the Smart Inbox row model, extracted PURE and typed against the
 * analyzer's OWN types (M2 kept-depth PR-1).
 *
 * Why this module exists: SmartInbox previously declared a LOCAL copy of the
 * suggested-action shape with a `type` field, while the analyzers store
 * `action` (types.ts `SuggestedAction`). `top?.type` was always undefined, so
 * every row resolved actionless and every checkbox was born disabled — the
 * whole intake pipeline was display-only (P-9 findings F1/F3). The existing
 * component test was source-scan only, so the field contract was never
 * exercised. Moving the model here ties it to the real `SuggestedAction` type
 * (compile-time) and gives it a worked-fixture test (runtime) — the
 * field-name-mismatch class dies at the lowest ring.
 *
 * Also owns the WRAPPED→FLAT payload flatten: extractedData fields are
 * `{ value, confidence }` objects, but the confirm route reads FLAT scalars
 * (`Number(data.amount)`, `String(data.vendor)` — confirm/route.ts). The
 * component used to spread the wrapped objects straight into the payload,
 * which would have written "[object Object]"/NaN on approve. `payloadFor`
 * flattens everything first, then overlays the user's edits (edits win —
 * the user is the source of truth).
 *
 * Used by: components/documents/SmartInbox.tsx (render only).
 * Locked by: tests/documents/inboxModel.test.ts.
 */

import type { SuggestedAction } from './types';
import { classifyConfidence } from './confidencePolicy';

export interface InboxAnalysis {
  id: string;
  documentType: string;
  overallConfidence: number;
  extractedData: Record<string, unknown> | null;
  /** The analyzer's actions — `action` is the stored field (types.ts).
   *  `type` is tolerated for any legacy rows written before the shape settled. */
  suggestedActions: Array<Partial<SuggestedAction> & { type?: string; description?: string }> | null;
}

export interface InboxDocument {
  id: string;
  originalFilename: string;
  analysis: InboxAnalysis | null;
}

export interface InboxRowModel {
  doc: InboxDocument;
  analysisId: string;
  action: string | null;
  actionLabel: string | null;
  vendor: string;
  amount: string;
  date: string;
  category: string;
  band: 'AUTO' | 'CONFIRM' | 'ASK';
  confidenceLabel: string;
  tone: 'emerald' | 'amber' | 'slate';
}

export const ACTION_LABELS: Record<string, string> = {
  CREATE_EXPENSE: 'Add as expense',
  CREATE_INCOME: 'Add as income',
  CREATE_LOAN: 'Add as loan',
  UPDATE_LOAN: 'Update loan',
  LINK_TO_PROPERTY: 'Link to property',
};

/** Unwrap the analyzer's `{value, confidence}` field shape → a flat scalar. */
export function flat(v: unknown): unknown {
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    return (v as { value: unknown }).value;
  }
  return v;
}

/** Flatten EVERY wrapped field of an extractedData object to plain scalars. */
export function flattenExtracted(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) out[k] = flat(v);
  return out;
}

export function pickStr(data: Record<string, unknown> | null, keys: string[]): string {
  if (!data) return '';
  for (const k of keys) {
    const val = flat(data[k]);
    if (val != null && val !== '') return String(val);
  }
  return '';
}

/** The action id of a suggested action — `action` is the stored field name;
 *  `type` accepted as a legacy fallback. NEVER read `.type` alone (MON-187). */
export function actionIdOf(a: { action?: unknown; type?: unknown } | null | undefined): string | null {
  const id = a?.action ?? a?.type;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Build the per-document row model the inbox renders and approves from. */
export function buildInboxRows(docs: InboxDocument[]): InboxRowModel[] {
  return docs
    .filter((d) => d.analysis)
    .map((doc) => {
      const a = doc.analysis!;
      const top = (a.suggestedActions ?? [])
        .slice()
        .sort((x, y) => (Number(y.confidence) || 0) - (Number(x.confidence) || 0))[0];
      const actionId = actionIdOf(top ?? null);
      const verdict = classifyConfidence(a.overallConfidence ?? 0);
      return {
        doc,
        analysisId: a.id,
        action: actionId,
        actionLabel: actionId ? ACTION_LABELS[actionId] ?? actionId : null,
        vendor:
          pickStr(a.extractedData, ['vendor', 'vendorName', 'payee', 'merchant', 'name']) ||
          doc.originalFilename,
        amount: pickStr(a.extractedData, ['amount', 'total', 'totalAmount', 'amountDue']),
        date: pickStr(a.extractedData, ['date', 'issueDate', 'transactionDate']),
        category: pickStr(a.extractedData, ['category']),
        band: verdict.band,
        confidenceLabel: verdict.label,
        tone: verdict.tone,
      };
    });
}

export type InboxEdits = Partial<Record<'vendor' | 'amount' | 'date' | 'category', string>>;

/**
 * The confirm payload for a row: extractedData FLATTENED (the confirm route
 * reads flat scalars), with the user's edits overlaid (edits win).
 */
export function payloadFor(row: InboxRowModel, edits: InboxEdits | undefined): Record<string, unknown> {
  const base = flattenExtracted(row.doc.analysis?.extractedData);
  if (edits?.vendor != null) {
    base.vendor = edits.vendor;
    base.name = edits.vendor;
  }
  if (edits?.amount != null) base.amount = edits.amount;
  if (edits?.date != null) base.date = edits.date;
  if (edits?.category != null) base.category = edits.category;
  // The card shows `total` as the amount when `amount` is absent (receipts
  // store `total`) — mirror it so the flat payload always carries `amount`.
  if (base.amount == null && base.total != null) base.amount = base.total;
  return base;
}
