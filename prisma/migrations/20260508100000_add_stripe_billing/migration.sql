-- Phase 32C PR6 — Stripe billing (test-mode)
--
-- Additive migration. Creates 3 tables (stripe_customers,
-- stripe_subscriptions, stripe_webhook_events) + 2 enums
-- (SubscriptionStatus, BillingPlanTier) + extends AuditAction with
-- 7 new lifecycle values. CLAUDE.md §12.11 N/A — no row mutations.

-- 1. Extend AuditAction (additive enum values)

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_CHECKOUT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_SUBSCRIPTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_SUBSCRIPTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_SUBSCRIPTION_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_INVOICE_PAID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_INVOICE_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_WEBHOOK_RECEIVED';

-- 2. New enums

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED',
  'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID', 'PAUSED'
);

CREATE TYPE "BillingPlanTier" AS ENUM ('STUDIO', 'PRACTICE', 'ENTERPRISE');

-- 3. StripeCustomer

CREATE TABLE "stripe_customers" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "isTestMode"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_customers_organizationId_key" ON "stripe_customers"("organizationId");
CREATE UNIQUE INDEX "stripe_customers_stripeCustomerId_key" ON "stripe_customers"("stripeCustomerId");
CREATE INDEX "stripe_customers_stripeCustomerId_idx" ON "stripe_customers"("stripeCustomerId");

ALTER TABLE "stripe_customers"
  ADD CONSTRAINT "stripe_customers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. StripeSubscription

CREATE TABLE "stripe_subscriptions" (
  "id"                   TEXT NOT NULL,
  "organizationId"       TEXT NOT NULL,
  "customerId"           TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "status"               "SubscriptionStatus" NOT NULL,
  "planTier"             "BillingPlanTier" NOT NULL,
  "stripePriceId"        TEXT NOT NULL,
  "stripeProductId"      TEXT NOT NULL,
  "currentPeriodStart"   TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd"     TIMESTAMP(3) NOT NULL,
  "cancelAtPeriodEnd"    BOOLEAN NOT NULL DEFAULT false,
  "isTestMode"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_subscriptions_organizationId_key" ON "stripe_subscriptions"("organizationId");
CREATE UNIQUE INDEX "stripe_subscriptions_customerId_key" ON "stripe_subscriptions"("customerId");
CREATE UNIQUE INDEX "stripe_subscriptions_stripeSubscriptionId_key" ON "stripe_subscriptions"("stripeSubscriptionId");
CREATE INDEX "stripe_subscriptions_stripeSubscriptionId_idx" ON "stripe_subscriptions"("stripeSubscriptionId");
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions"("status");

ALTER TABLE "stripe_subscriptions"
  ADD CONSTRAINT "stripe_subscriptions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stripe_subscriptions"
  ADD CONSTRAINT "stripe_subscriptions_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. StripeWebhookEvent

CREATE TABLE "stripe_webhook_events" (
  "id"              TEXT NOT NULL,
  "stripeEventId"   TEXT NOT NULL,
  "eventType"       TEXT NOT NULL,
  "livemode"        BOOLEAN NOT NULL,
  "payload"         JSONB NOT NULL,
  "processedAt"     TIMESTAMP(3),
  "processingError" TEXT,
  "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_webhook_events_stripeEventId_key" ON "stripe_webhook_events"("stripeEventId");
CREATE INDEX "stripe_webhook_events_eventType_idx" ON "stripe_webhook_events"("eventType");
CREATE INDEX "stripe_webhook_events_receivedAt_idx" ON "stripe_webhook_events"("receivedAt");
