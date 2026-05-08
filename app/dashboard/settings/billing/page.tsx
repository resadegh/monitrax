'use client';

/**
 * Billing (placeholder)
 *
 * The previous /dashboard/settings/billing page rendered a hardcoded
 * "Pro $19.99 active" badge with hardcoded usage stats and fake
 * invoice rows — none of it touched the server. Per the 2026-05-08
 * settings review, mock billing UI is worse than no billing UI: it
 * implies a paid-tier reality that doesn't exist yet.
 *
 * Real billing ships with Phase 32C PR6 (Stripe lifecycle: checkout,
 * subscription, invoice webhooks). Until that lands, Monitrax is free
 * and this page says so plainly.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Sparkles } from 'lucide-react';

export default function BillingPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing
        </CardTitle>
        <CardDescription>
          Your subscription and payment method.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-6">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Free during early access
            </Badge>
          </div>
          <p className="text-sm">
            Monitrax is free while we build out the foundation. Paid
            tiers and invoicing arrive with the Org Portal launch (Phase
            32C). When that ships you'll see your plan, payment method
            and full invoice history here — no subscription decisions
            until then.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Need a receipt for accounting purposes today? Email{' '}
          <a
            href="mailto:support@monitrax.com.au"
            className="underline underline-offset-2"
          >
            support@monitrax.com.au
          </a>{' '}
          and we'll sort you out.
        </p>
      </CardContent>
    </Card>
  );
}
