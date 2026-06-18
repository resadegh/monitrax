/**
 * Phase 50 D.4 — Learned routing (the DIE's "you usually file <vendor> under
 * <entity>" memory). SUGGEST-ONLY.
 *
 * When a user attaches a recognised document from a vendor (e.g. "Bunnings") to
 * a specific entity (e.g. their investment property), we remember that choice.
 * The next document from the same vendor can then PRE-SELECT the same entity in
 * the "What is this for?" selector — saving the user a tap.
 *
 * AUTONOMY CONTRACT (Reza decision 2026-06-18 — load-bearing, see Phase 50 doc
 * Decisions log + CLAUDE.md §0 behaviour-psychology lens): this module NEVER
 * applies a link or writes a financial record on its own. It only (a) records
 * what the user chose and (b) reads back a SUGGESTION. The user always confirms
 * (and can change the selection) in the existing confirm flow. Autonomy is
 * earned and explicit — the AI proposes, the human disposes.
 *
 * SSOT: this is the single place vendor→entity routing memory is written and
 * read. Recording happens at the document-link chokepoint (the link API +
 * confirm route); reading happens in the scan/upload "What is this for?"
 * surface. No other module should re-implement either half.
 *
 * The write is §12.11-safe: `upsert` is keyed by the unique
 * (userId, vendorKey, entityType, entityId) tuple and only ever mutates rows
 * this code path owns; the only columns it touches are `count` (increment) and
 * `lastUsedAt` — never user-entered financial data.
 */

import { prisma } from '@/lib/db';
import type { LinkedEntityType } from '@/lib/documents/types';

/** Entity types worth remembering a routing for — the ones a document is
 *  meaningfully "for". We don't learn routings to generic EXPENSE/INCOME rows
 *  (those are the record the document creates, not the asset it belongs to). */
const ROUTABLE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'ASSET',
  'PROPERTY',
  'LOAN',
  'INVESTMENT_ACCOUNT',
  'INVESTMENT_HOLDING',
  'OFFSET_ACCOUNT',
  'ACCOUNT',
]);

export interface VendorEntityHint {
  entityType: LinkedEntityType;
  entityId: string;
  count: number;
}

/**
 * Normalize a raw vendor string into a stable lookup key so cosmetic variants
 * collapse together: "Bunnings Warehouse", "BUNNINGS WAREHOUSE #4012" and
 * "bunnings  warehouse" all map to "bunningswarehouse".
 *
 * Returns '' when there's nothing usable — callers treat '' as "no key, skip".
 */
export function normalizeVendorKey(vendor: unknown): string {
  if (typeof vendor !== 'string') return '';
  return vendor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') // strip spaces, punctuation, store numbers
    .trim();
}

/** True when this entity type is worth learning a routing for. */
export function isRoutableEntityType(entityType: string): boolean {
  return ROUTABLE_ENTITY_TYPES.has(entityType);
}

/**
 * Record that the user routed a document from `vendor` to (`entityType`,
 * `entityId`). Increments the count if the routing already exists. No-op when
 * the vendor key is empty or the entity type isn't routable.
 *
 * Fire-and-forget friendly — callers should not block the user's confirm on
 * this. Swallows its own errors so a hint-write failure never breaks a link.
 */
export async function recordVendorEntityHint(
  userId: string,
  vendor: unknown,
  entityType: string,
  entityId: string,
): Promise<void> {
  const vendorKey = normalizeVendorKey(vendor);
  if (!vendorKey || !entityId || !isRoutableEntityType(entityType)) return;

  try {
    await prisma.vendorEntityHint.upsert({
      where: {
        // §12.11: keyed by the unique tuple this code path owns. The `update`
        // branch only ever touches a row created by this same function.
        userId_vendorKey_entityType_entityId: {
          userId,
          vendorKey,
          entityType: entityType as LinkedEntityType,
          entityId,
        },
      },
      create: {
        userId,
        vendorKey,
        entityType: entityType as LinkedEntityType,
        entityId,
        count: 1,
      },
      update: {
        count: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  } catch (err) {
    // Non-fatal: a routing memory is a convenience, never load-bearing.
    console.warn('[D.4] recordVendorEntityHint failed (non-fatal):', err);
  }
}

/**
 * Get the suggested entity routing for `vendor`, or null when there's no memory.
 * Returns the most-chosen routing (highest count, most recently used as the
 * tiebreaker). The caller treats this as a SUGGESTION to pre-select — never an
 * instruction to auto-apply.
 */
export async function getVendorEntityHint(
  userId: string,
  vendor: unknown,
): Promise<VendorEntityHint | null> {
  const vendorKey = normalizeVendorKey(vendor);
  if (!vendorKey) return null;

  const hint = await prisma.vendorEntityHint.findFirst({
    where: { userId, vendorKey },
    orderBy: [{ count: 'desc' }, { lastUsedAt: 'desc' }],
    select: { entityType: true, entityId: true, count: true },
  });

  return hint
    ? {
        entityType: hint.entityType as LinkedEntityType,
        entityId: hint.entityId,
        count: hint.count,
      }
    : null;
}

/**
 * Record a hint by reading the vendor off a document's analysis. This is the
 * SSOT recording entrypoint used by the link API + confirm route, so both the
 * scan flow and the My Vault flow learn from the same place.
 *
 * Reads `vendor` (then a few fallbacks) from the DocumentAnalysis extractedData,
 * unwrapping the {value, confidence} ExtractedField shape when present. No-op
 * when there's no analysis, no vendor, or the entity type isn't routable.
 */
export async function recordHintFromDocument(
  userId: string,
  documentId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  if (!isRoutableEntityType(entityType)) return;

  try {
    const analysis = await prisma.documentAnalysis.findUnique({
      where: { documentId },
      select: { extractedData: true, verifiedData: true },
    });
    if (!analysis) return;

    const vendor = extractVendor(analysis.verifiedData) ?? extractVendor(analysis.extractedData);
    if (!vendor) return;

    await recordVendorEntityHint(userId, vendor, entityType, entityId);
  } catch (err) {
    console.warn('[D.4] recordHintFromDocument failed (non-fatal):', err);
  }
}

/** Pull a vendor-ish string out of an extractedData/verifiedData JSON blob,
 *  unwrapping the {value, confidence} ExtractedField shape if present. */
function extractVendor(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  for (const key of ['vendor', 'vendorName', 'payee', 'merchant', 'name']) {
    const raw = obj[key];
    if (raw == null) continue;
    const value =
      typeof raw === 'object' && raw !== null && 'value' in raw
        ? (raw as { value: unknown }).value
        : raw;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}
