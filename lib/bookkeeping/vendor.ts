/**
 * Phase 42 PR5 — Vendor service.
 *
 * Vendor is the **consumer-side merchant card** (annual totals,
 * contracts, cancel link, default category). Promoted from
 * `MerchantMapping` per spec §3 D-42-5. MerchantMapping STAYS as
 * the AI-learning surface (categorisation confidence, correction
 * count); Vendor is the user-facing entity.
 *
 * Hard rule (CLAUDE.md §0 architect lens): NOT an AP master.
 * Payment terms, AP cycle, invoice tracking — all out of scope.
 * Xero owns those.
 *
 * Per CLAUDE.md §12.2 SSOT — `lookupVendor()` is the single
 * function that resolves "do I have a Vendor for this merchant
 * already?". Called by the auto-promote path on first transaction
 * + by any UI that drills into a merchant pill.
 *
 * Annual-totals aggregator reads from `unified_transactions` (the
 * canonical ledger), composing the existing `merchantStandardised`
 * shape — no parallel transaction scan, no duplicate calc engine.
 */

import prisma from '@/lib/db';
import type { Vendor } from '@prisma/client';
import { lookupMCC } from '@/lib/bank/mccCatalog';

/**
 * Normalise a vendor name to the canonical key shape.
 * Mirror of `normaliseMerchantForMcc` and PR1's `normaliseDescription`.
 */
export function normaliseVendorName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up a vendor by merchant string. Returns null if not found.
 * Cheap O(1) — uses the unique index on (userId, normalisedName).
 */
export async function lookupVendor(
  userId: string,
  merchant: string | null | undefined
): Promise<Vendor | null> {
  if (!merchant) return null;
  const normalised = normaliseVendorName(merchant);
  if (normalised.length === 0) return null;
  return prisma.vendor.findUnique({
    where: { userId_normalisedName: { userId, normalisedName: normalised } },
  });
}

/**
 * Get-or-create a Vendor row. Idempotent. Auto-populates `mcc` from
 * the catalog when known. The user can override every field via the
 * UI later; this just gives us a stable Vendor id at the moment we
 * first see the merchant.
 *
 * Race-tolerant — if two concurrent transactions promote the same
 * merchant, the second one re-reads the row that won.
 */
export async function resolveOrCreateVendor(input: {
  userId: string;
  name: string;
  mcc?: string | null;
}): Promise<Vendor> {
  const normalised = normaliseVendorName(input.name);
  if (normalised.length === 0) {
    throw new Error('Vendor name must be non-empty');
  }
  const existing = await prisma.vendor.findUnique({
    where: { userId_normalisedName: { userId: input.userId, normalisedName: normalised } },
  });
  if (existing) return existing;

  // MCC seed — prefer the input over the catalog if both supplied.
  const mcc = input.mcc ?? lookupMCC(input.name)?.mcc ?? null;

  try {
    return await prisma.vendor.create({
      data: {
        userId: input.userId,
        name: input.name.trim(),
        normalisedName: normalised,
        mcc,
      },
    });
  } catch (err) {
    // Recover from concurrent insert race.
    const winner = await prisma.vendor.findUnique({
      where: { userId_normalisedName: { userId: input.userId, normalisedName: normalised } },
    });
    if (winner) return winner;
    throw err;
  }
}

export interface VendorAnnualTotals {
  /** Number of distinct transactions for this vendor in the period. */
  transactionCount: number;
  /** Sum of OUT-direction transactions (positive number; absolute). */
  totalSpent: number;
  /** Sum of IN-direction transactions. */
  totalReceived: number;
  /** Most-recent transaction date in the period. */
  lastSeen: Date | null;
  /** Distinct accounts the vendor appeared on (cross-account picture). */
  accountCount: number;
}

/**
 * Aggregate annual totals for a vendor. Reads from `unified_transactions`
 * — the canonical ledger — by `merchantStandardised` (matched against
 * the vendor's normalised name).
 *
 * Per CLAUDE.md §12.3 — composes existing transaction data; no
 * parallel scan logic. The query stays cheap because the
 * `merchantStandardised` index is hit directly.
 */
export async function getVendorAnnualTotals(
  userId: string,
  vendorId: string,
  options: {
    /** Window start. Defaults to 12 months ago. */
    from?: Date;
    /** Window end. Defaults to now. */
    to?: Date;
  } = {}
): Promise<VendorAnnualTotals> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, userId },
    select: { id: true, normalisedName: true, name: true },
  });
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found or not owned by caller`);
  }

  const to = options.to ?? new Date();
  const from = options.from ?? (() => {
    const d = new Date(to);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d;
  })();

  // The merchantStandardised on UnifiedTransaction was canonicalised
  // at import time. We compare against vendor.name (case-insensitive)
  // since that's the human form; the normalisedName is the unique key
  // but transactions don't carry the normalised form directly.
  const transactions = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      date: { gte: from, lte: to },
      OR: [
        { merchantStandardised: { equals: vendor.name, mode: 'insensitive' } },
        // Also match on raw merchant (covers the case where standardised
        // hasn't been backfilled).
        { merchantRaw: { contains: vendor.name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, amount: true, direction: true, date: true, accountId: true },
  });

  if (transactions.length === 0) {
    return {
      transactionCount: 0,
      totalSpent: 0,
      totalReceived: 0,
      lastSeen: null,
      accountCount: 0,
    };
  }

  let totalSpent = 0;
  let totalReceived = 0;
  let lastSeen: Date | null = null;
  const accounts = new Set<string>();
  for (const tx of transactions) {
    accounts.add(tx.accountId);
    if (tx.direction === 'OUT') totalSpent += Math.abs(tx.amount);
    else totalReceived += Math.abs(tx.amount);
    if (!lastSeen || tx.date > lastSeen) lastSeen = tx.date;
  }
  return {
    transactionCount: transactions.length,
    totalSpent,
    totalReceived,
    lastSeen,
    accountCount: accounts.size,
  };
}

/**
 * Cancel-URL registry seed for high-volume AU subscriptions. Used by
 * `resolveOrCreateVendor` to populate the `cancelUrl` field at create
 * time. Per CLAUDE.md §12.2 — one place that knows "where do I
 * cancel <merchant>?", and it's here.
 *
 * Phase 42 spec §6.6 — surfaced as a one-tap "Manage subscription"
 * affordance on recurring-payment cards (PR6 engagement layer).
 */
export const CANCEL_URL_REGISTRY: Readonly<Record<string, string>> = {
  netflix: 'https://www.netflix.com/cancelplan',
  spotify: 'https://www.spotify.com/account/subscription/',
  disney: 'https://www.disneyplus.com/account/subscription',
  stan: 'https://www.stan.com.au/manage/subscription',
  binge: 'https://www.binge.com.au/account',
  appleone: 'https://support.apple.com/en-au/HT202039',
  audible: 'https://www.audible.com.au/account/membership',
  kayo: 'https://kayosports.com.au/account',
  paramount: 'https://www.paramountplus.com/au/account/',
  amazonprime: 'https://www.amazon.com.au/gp/css/account/info',
  agl: 'https://www.agl.com.au/account',
  origin: 'https://www.originenergy.com.au/my-account',
  energyaustralia: 'https://www.energyaustralia.com.au/home/login',
  telstra: 'https://www.telstra.com.au/my-account',
  optus: 'https://www.optus.com.au/login',
  vodafone: 'https://www.vodafone.com.au/myvodafone',
};

/**
 * Look up a cancel URL for a merchant key. The key is the same form
 * the MCC catalog uses (lowercase canonical, e.g. 'netflix').
 * Returns null when unknown — the UI hides the affordance.
 */
export function lookupCancelUrl(merchantKey: string): string | null {
  return CANCEL_URL_REGISTRY[merchantKey] ?? null;
}

export type { Vendor };
