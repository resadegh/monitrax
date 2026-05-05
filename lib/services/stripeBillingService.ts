/**
 * Phase 32C PR6 — Stripe billing service (test-mode at v1).
 *
 * Three responsibilities:
 *   1. **Customer + Checkout** — `getOrCreateCustomer`, `createCheckoutSession`.
 *      The Org owner clicks "Subscribe to Practice" → we lazy-create a
 *      Stripe Customer (one per Org) and hand them a Stripe-hosted
 *      Checkout URL. Stripe collects payment, returns to a success URL.
 *   2. **Webhook reconciliation** — `handleWebhookEvent`. Stripe is the
 *      authoritative source of truth for subscription state; we mirror
 *      its events into `StripeSubscription` rows. Idempotent — every
 *      event is recorded in `StripeWebhookEvent` with a unique constraint
 *      on `stripeEventId` so re-deliveries are deduped.
 *   3. **Lookup** — `getSubscriptionStatus`, `cancelAtPeriodEnd`.
 *      Read-only convenience helpers for the UI + planTier gate.
 *
 * All paths are test-mode at v1. The `isTestMode` flag is recorded on
 * every customer and subscription so the webhook handler can route to
 * the right keyspace when we go live (PROD-deferred).
 *
 * Pricing model — three plans, monthly recurring:
 *   - Studio    AU$199 / month
 *   - Practice  AU$599 / month
 *   - Enterprise (custom — sales-led; we don't auto-create these)
 *
 * Stripe price IDs are read from environment variables so each environment
 * (dev / preview / prod) can map to its own Stripe products without a
 * code change. All required env vars are listed in `BILLING_ENV_VARS` below.
 */
import 'server-only';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import type {
  BillingPlanTier,
  StripeCustomer,
  StripeSubscription,
  SubscriptionStatus,
} from '@prisma/client';

// =============================================================================
// CONSTANTS
// =============================================================================

export const BILLING_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_STUDIO_PRICE_ID',
  'STRIPE_PRACTICE_PRICE_ID',
  'BILLING_SUCCESS_URL',
  'BILLING_CANCEL_URL',
] as const;

// Stripe API version pinned so the SDK doesn't surprise us with breaking
// changes on a minor bump. Pinned to the latest supported by stripe@22.x.
// Cast through `as never` because Stripe ships the literal type as a tag
// and our pinned value matches what the runtime accepts.
const STRIPE_API_VERSION = '2025-09-30.clover' as never;

// =============================================================================
// SHAPES
// =============================================================================

export class StripeBillingServiceError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_CONFIGURED'
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_INPUT'
      | 'STRIPE_ERROR'
      | 'WEBHOOK_VERIFICATION_FAILED',
  ) {
    super(message);
    this.name = 'StripeBillingServiceError';
  }
}

export interface CheckoutInput {
  organizationId: string;
  ownerEmail: string;
  planTier: 'STUDIO' | 'PRACTICE'; // ENTERPRISE is sales-led
  /** Used by Stripe Checkout's success redirect — usually `/portal/billing?success=true`. */
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  url: string; // Stripe-hosted Checkout URL
  customerId: string; // Stripe customer id (cus_xxx)
}

// =============================================================================
// LAZY STRIPE CLIENT
// =============================================================================

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeBillingServiceError(
      'STRIPE_SECRET_KEY is not configured. Billing flows are unavailable in this environment.',
      'NOT_CONFIGURED',
    );
  }
  stripeClient = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

/**
 * True when the Stripe client is wired in this environment. The /portal/billing
 * UI uses this to show a "Configure billing in your env" notice in dev/demo
 * environments where the key isn't set, instead of crashing.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// =============================================================================
// PRICE LOOKUP
// =============================================================================

function priceIdForTier(tier: 'STUDIO' | 'PRACTICE'): string {
  const id =
    tier === 'STUDIO'
      ? process.env.STRIPE_STUDIO_PRICE_ID
      : process.env.STRIPE_PRACTICE_PRICE_ID;
  if (!id) {
    throw new StripeBillingServiceError(
      `STRIPE_${tier}_PRICE_ID is not configured`,
      'NOT_CONFIGURED',
    );
  }
  return id;
}

// =============================================================================
// CUSTOMER MANAGEMENT
// =============================================================================

export async function getOrCreateCustomer(
  organizationId: string,
  email: string,
): Promise<StripeCustomer> {
  const existing = await prisma.stripeCustomer.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { monitrax_organization_id: organizationId },
  });

  return prisma.stripeCustomer.create({
    data: {
      organizationId,
      stripeCustomerId: customer.id,
      email,
      isTestMode: !customer.livemode,
    },
  });
}

// =============================================================================
// CHECKOUT
// =============================================================================

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
  if (!isStripeConfigured()) {
    throw new StripeBillingServiceError('Billing is not configured', 'NOT_CONFIGURED');
  }
  if (input.planTier !== 'STUDIO' && input.planTier !== 'PRACTICE') {
    throw new StripeBillingServiceError(
      'Only STUDIO and PRACTICE are self-serve. Enterprise is sales-led.',
      'INVALID_INPUT',
    );
  }

  const customer = await getOrCreateCustomer(input.organizationId, input.ownerEmail);
  const priceId = priceIdForTier(input.planTier);
  const stripe = getStripeClient();

  const successUrl =
    input.successUrl ??
    process.env.BILLING_SUCCESS_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/billing?success=true`;
  const cancelUrl =
    input.cancelUrl ??
    process.env.BILLING_CANCEL_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/billing?cancelled=true`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // We capture organization id via metadata + the customer's metadata so
    // the webhook handler always has a stable lookup path.
    metadata: {
      monitrax_organization_id: input.organizationId,
      monitrax_plan_tier: input.planTier,
    },
    subscription_data: {
      metadata: {
        monitrax_organization_id: input.organizationId,
        monitrax_plan_tier: input.planTier,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Optional but Stripe-recommended hardening flags
    automatic_tax: { enabled: false },
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new StripeBillingServiceError('Stripe did not return a checkout URL', 'STRIPE_ERROR');
  }
  return { url: session.url, customerId: customer.stripeCustomerId };
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Verifies + records a Stripe webhook event. Returns `{ duplicate: true }`
 * for re-deliveries (Stripe retries up to 3 days). The actual subscription
 * mirroring is dispatched from `processWebhookEvent`.
 */
export function constructAndVerifyWebhookEvent(
  rawBody: string,
  signatureHeader: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new StripeBillingServiceError(
      'STRIPE_WEBHOOK_SECRET is not configured',
      'NOT_CONFIGURED',
    );
  }
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signatureHeader, secret);
  } catch {
    throw new StripeBillingServiceError(
      'Webhook signature verification failed',
      'WEBHOOK_VERIFICATION_FAILED',
    );
  }
}

/**
 * Dedupe + persist + dispatch. Idempotent — if the same `stripeEventId`
 * arrives twice, the second call is a no-op.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<{ duplicate: boolean }> {
  // Dedupe at the database boundary
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing) {
    return { duplicate: true };
  }

  const recorded = await prisma.stripeWebhookEvent.create({
    data: {
      stripeEventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      payload: event.data as unknown as Stripe.Event['data'] as never, // Json column
    },
  });

  try {
    await dispatchEvent(event);
    await prisma.stripeWebhookEvent.update({
      where: { id: recorded.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.stripeWebhookEvent.update({
      where: { id: recorded.id },
      data: {
        processingError:
          err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      },
    });
    throw err;
  }
  return { duplicate: false };
}

async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await mirrorSubscription(event.data.object as Stripe.Subscription);
      return;
    case 'customer.subscription.deleted':
      await markSubscriptionCancelled(event.data.object as Stripe.Subscription);
      return;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      return;
    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object as Stripe.Invoice);
      return;
    default:
      // Unhandled event — that's fine; we logged it in StripeWebhookEvent.
      return;
  }
}

async function mirrorSubscription(sub: Stripe.Subscription): Promise<void> {
  const organizationId = sub.metadata?.monitrax_organization_id;
  if (!organizationId) {
    throw new Error(`Subscription ${sub.id} missing monitrax_organization_id metadata`);
  }

  const customer = await prisma.stripeCustomer.findUnique({
    where: { organizationId },
  });
  if (!customer) {
    throw new Error(`No StripeCustomer for org ${organizationId} (sub ${sub.id})`);
  }

  const price = sub.items.data[0]?.price;
  if (!price) throw new Error(`Subscription ${sub.id} has no price`);

  const planTier = resolvePlanTierFromMetadata(
    sub.metadata?.monitrax_plan_tier,
    price.id,
  );

  const status = mapStripeStatus(sub.status);

  // Stripe's subscription type now exposes period start/end on the items —
  // we use the first item's period to match the subscription's billing cycle.
  const item = sub.items.data[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeSub = sub as any;
  const periodStart = item?.current_period_start ?? stripeSub.current_period_start ?? 0;
  const periodEnd = item?.current_period_end ?? stripeSub.current_period_end ?? 0;

  await prisma.stripeSubscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      organizationId,
      customerId: customer.id,
      stripeSubscriptionId: sub.id,
      status,
      planTier,
      stripePriceId: price.id,
      stripeProductId: typeof price.product === 'string' ? price.product : price.product.id,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      isTestMode: !sub.livemode,
    },
    update: {
      status,
      planTier,
      stripePriceId: price.id,
      stripeProductId: typeof price.product === 'string' ? price.product : price.product.id,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
  });
}

async function markSubscriptionCancelled(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.stripeSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!existing) return; // never recorded — nothing to update
  await prisma.stripeSubscription.update({
    where: { id: existing.id },
    data: { status: 'CANCELED', cancelAtPeriodEnd: false },
  });
}

function resolvePlanTierFromMetadata(
  metadataTier: string | undefined,
  priceId: string,
): BillingPlanTier {
  if (metadataTier === 'STUDIO' || metadataTier === 'PRACTICE' || metadataTier === 'ENTERPRISE') {
    return metadataTier;
  }
  // Fallback by price id
  if (priceId === process.env.STRIPE_STUDIO_PRICE_ID) return 'STUDIO';
  if (priceId === process.env.STRIPE_PRACTICE_PRICE_ID) return 'PRACTICE';
  // Default — the org will need an admin to fix this; logged via the
  // webhook event row.
  return 'STUDIO';
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'trialing': return 'TRIALING';
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled': return 'CANCELED';
    case 'incomplete': return 'INCOMPLETE';
    case 'incomplete_expired': return 'INCOMPLETE_EXPIRED';
    case 'unpaid': return 'UNPAID';
    case 'paused': return 'PAUSED';
    default: return 'INCOMPLETE';
  }
}

// =============================================================================
// READ HELPERS
// =============================================================================

export async function getSubscriptionStatus(
  organizationId: string,
): Promise<StripeSubscription | null> {
  return prisma.stripeSubscription.findUnique({
    where: { organizationId },
  });
}

export async function getCustomerForOrg(
  organizationId: string,
): Promise<StripeCustomer | null> {
  return prisma.stripeCustomer.findUnique({
    where: { organizationId },
  });
}

/** Schedules a cancellation at the end of the current billing period. */
export async function cancelAtPeriodEnd(organizationId: string): Promise<StripeSubscription> {
  const sub = await prisma.stripeSubscription.findUnique({ where: { organizationId } });
  if (!sub) throw new StripeBillingServiceError('No active subscription', 'NOT_FOUND');

  const stripe = getStripeClient();
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return prisma.stripeSubscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true },
  });
}

/** Reverts a scheduled cancellation. */
export async function resumeSubscription(organizationId: string): Promise<StripeSubscription> {
  const sub = await prisma.stripeSubscription.findUnique({ where: { organizationId } });
  if (!sub) throw new StripeBillingServiceError('No active subscription', 'NOT_FOUND');

  const stripe = getStripeClient();
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return prisma.stripeSubscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: false },
  });
}

// =============================================================================
// PHASE 32C PR6b — LEAD-FEE INVOICING
// =============================================================================
//
// When `acceptRequest` (in professionalRequestService) accepts a marketplace
// request, the org owes Monitrax a lead fee (AU$80/$150/$250 by tier). PR4c
// recorded the BILLING INTENT in `professional_requests.leadFeeChargedAt`;
// PR6b creates the actual Stripe Invoice + sends it.
//
// Flow:
//   1. acceptRequest fires → calls createLeadFeeInvoiceForRequest()
//   2. We resolve the org's StripeCustomer (lazy-create if needed; the org
//      may not have subscribed to a plan yet but they still pay lead fees)
//   3. Create a Stripe Invoice + InvoiceItem, send it
//   4. Persist `stripeInvoiceId` + status=PENDING_PAYMENT + invoice URL on
//      the ProfessionalRequest
//   5. Stripe fires `invoice.paid` / `invoice.payment_failed` webhooks
//      → handleInvoicePaid / handleInvoiceFailed update the request

interface CreateLeadFeeInvoiceInput {
  requestId: string;
  /** Owner email — used to lazy-create the StripeCustomer if no subscription
   *  exists yet (lead fees are payable even without an active plan). */
  ownerEmail: string;
}

/**
 * Creates and sends a Stripe Invoice for a lead fee.
 *
 * Idempotent — if `stripeInvoiceId` is already set on the request, returns
 * the existing invoice id without creating a new one. Failure does NOT
 * roll back the accept; ops can re-run by calling this with the same id.
 */
export async function createLeadFeeInvoiceForRequest(
  input: CreateLeadFeeInvoiceInput,
): Promise<{ invoiceId: string; invoiceUrl: string | null }> {
  const request = await prisma.professionalRequest.findUnique({
    where: { id: input.requestId },
    include: {
      listing: { select: { organizationId: true, displayName: true } },
      requester: { select: { name: true, email: true } },
    },
  });
  if (!request) {
    throw new StripeBillingServiceError('Request not found', 'NOT_FOUND');
  }
  if (request.status !== 'ACCEPTED') {
    throw new StripeBillingServiceError(
      `Cannot invoice from status ${request.status} — must be ACCEPTED`,
      'INVALID_INPUT',
    );
  }
  if (!request.leadFeeAmount || !request.leadFeeTier) {
    throw new StripeBillingServiceError(
      'Request has no lead-fee tier resolved (was acceptRequest run?)',
      'INVALID_INPUT',
    );
  }

  // Idempotent — already invoiced
  if (request.stripeInvoiceId) {
    return {
      invoiceId: request.stripeInvoiceId,
      invoiceUrl: request.leadFeeInvoiceUrl ?? null,
    };
  }

  if (!isStripeConfigured()) {
    // Dev/demo path — record the intent without creating a Stripe invoice.
    // The architectural pattern is visible (status=PENDING_PAYMENT) without
    // requiring real keys.
    await prisma.professionalRequest.update({
      where: { id: request.id },
      data: { leadFeeStatus: 'PENDING_CREATE' },
    });
    return { invoiceId: `stub-${request.id}`, invoiceUrl: null };
  }

  const customer = await getOrCreateCustomer(
    request.listing.organizationId,
    input.ownerEmail,
  );
  const stripe = getStripeClient();

  // Mark intent so a re-run after a failure doesn't double-create
  await prisma.professionalRequest.update({
    where: { id: request.id },
    data: { leadFeeStatus: 'PENDING_CREATE' },
  });

  // Convert decimal AUD → cents (Stripe wants integer minor units)
  const amountCents = Math.round(Number(request.leadFeeAmount) * 100);

  // Create the InvoiceItem first, then collect into an Invoice
  await stripe.invoiceItems.create({
    customer: customer.stripeCustomerId,
    amount: amountCents,
    currency: 'aud',
    description: `Marketplace lead fee · ${request.requester.name} · ${request.leadFeeTier} tier`,
    metadata: {
      monitrax_request_id: request.id,
      monitrax_organization_id: request.listing.organizationId,
      monitrax_lead_fee_tier: request.leadFeeTier,
    },
  });

  const invoice = await stripe.invoices.create({
    customer: customer.stripeCustomerId,
    auto_advance: true, // Stripe finalises + attempts collection automatically
    collection_method: 'charge_automatically',
    description: `Lead fee for accepted marketplace request from ${request.requester.name}`,
    metadata: {
      monitrax_request_id: request.id,
      monitrax_organization_id: request.listing.organizationId,
    },
  });

  if (!invoice.id) {
    throw new StripeBillingServiceError('Stripe did not return an invoice id', 'STRIPE_ERROR');
  }

  // Finalise immediately so payment attempt fires now
  await stripe.invoices.finalizeInvoice(invoice.id);

  await prisma.professionalRequest.update({
    where: { id: request.id },
    data: {
      stripeInvoiceId: invoice.id,
      leadFeeStatus: 'PENDING_PAYMENT',
      leadFeeInvoiceUrl: invoice.hosted_invoice_url ?? null,
    },
  });

  return { invoiceId: invoice.id, invoiceUrl: invoice.hosted_invoice_url ?? null };
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Lead-fee invoices carry monitrax_request_id metadata; subscription
  // invoices don't (they're handled by mirrorSubscription's separate path).
  const requestId = invoice.metadata?.monitrax_request_id;
  if (!requestId || !invoice.id) return;

  await prisma.professionalRequest.update({
    where: { stripeInvoiceId: invoice.id },
    data: {
      leadFeeStatus: 'PAID',
      leadFeePaidAt: new Date(),
    },
  }).catch(() => {
    // Request may have been deleted; webhook re-deliveries handle the rest
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const requestId = invoice.metadata?.monitrax_request_id;
  if (!requestId || !invoice.id) return;

  await prisma.professionalRequest.update({
    where: { stripeInvoiceId: invoice.id },
    data: {
      leadFeeStatus: 'FAILED',
      leadFeeFailedAt: new Date(),
    },
  }).catch(() => {});
}

/**
 * Reads the most-recent lead-fee invoices for an org for the billing UI.
 */
export async function listLeadFeeInvoicesForOrg(organizationId: string, limit = 50) {
  return prisma.professionalRequest.findMany({
    where: {
      listing: { organizationId },
      stripeInvoiceId: { not: null },
    },
    orderBy: { leadFeeChargedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      leadFeeAmount: true,
      leadFeeTier: true,
      leadFeeStatus: true,
      leadFeeChargedAt: true,
      leadFeePaidAt: true,
      leadFeeFailedAt: true,
      stripeInvoiceId: true,
      leadFeeInvoiceUrl: true,
      requester: { select: { name: true } },
      listing: { select: { displayName: true } },
    },
  });
}
