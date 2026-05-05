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
    case 'invoice.payment_failed':
      // Lead-fee invoice handling lands in PR6b. For PR6a we simply log
      // the event via the StripeWebhookEvent row (already persisted).
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
