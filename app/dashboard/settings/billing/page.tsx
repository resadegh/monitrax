'use client';

/**
 * Phase 19.1: Billing Settings Page
 * Subscription and payment management
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Check,
  Zap,
  Building2,
  Crown,
  ExternalLink,
  Download,
  Calendar,
} from 'lucide-react';

export default function BillingSettingsPage() {
  // Mock subscription data
  const subscription = {
    plan: 'Pro',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    amount: 19.99,
    currency: 'AUD',
  };

  const usage = {
    documents: { used: 45, limit: 500 },
    storage: { used: 256, limit: 5120 }, // MB
    apiCalls: { used: 1234, limit: 10000 },
  };

  const invoices = [
    { id: '1', date: new Date(2024, 10, 1), amount: 19.99, status: 'paid' },
    { id: '2', date: new Date(2024, 9, 1), amount: 19.99, status: 'paid' },
    { id: '3', date: new Date(2024, 8, 1), amount: 19.99, status: 'paid' },
  ];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">{subscription.plan}</h3>
                  <Badge variant="default" className="bg-green-500">
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  ${subscription.amount}/{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}
                  {' '}&middot;{' '}
                  Renews {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>
            <Button variant="outline">
              Manage Subscription
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Period</CardTitle>
          <CardDescription>
            Your current usage against plan limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Documents</span>
              <span>{usage.documents.used} / {usage.documents.limit}</span>
            </div>
            <Progress value={(usage.documents.used / usage.documents.limit) * 100} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Storage</span>
              <span>{(usage.storage.used / 1024).toFixed(2)} GB / {(usage.storage.limit / 1024).toFixed(0)} GB</span>
            </div>
            <Progress value={(usage.storage.used / usage.storage.limit) * 100} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>API Calls</span>
              <span>{usage.apiCalls.used.toLocaleString()} / {usage.apiCalls.limit.toLocaleString()}</span>
            </div>
            <Progress value={(usage.apiCalls.used / usage.apiCalls.limit) * 100} />
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Upgrade or downgrade your subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Free Plan */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5" />
                <h4 className="font-medium">Free</h4>
              </div>
              <p className="text-2xl font-bold mb-2">$0</p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  50 documents
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  100MB storage
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Basic insights
                </li>
              </ul>
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <h4 className="font-medium">Pro</h4>
                <Badge>Popular</Badge>
              </div>
              <p className="text-2xl font-bold mb-2">$19.99<span className="text-sm font-normal">/mo</span></p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  500 documents
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  5GB storage
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  AI-powered insights
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Cloud integrations
                </li>
              </ul>
              <Button className="w-full" disabled>
                Current Plan
              </Button>
            </div>

            {/* Business Plan */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5" />
                <h4 className="font-medium">Business</h4>
              </div>
              <p className="text-2xl font-bold mb-2">$49.99<span className="text-sm font-normal">/mo</span></p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Unlimited documents
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  50GB storage
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  API access
                </li>
              </ul>
              <Button variant="outline" className="w-full">
                Upgrade
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{formatDate(invoice.date)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${invoice.amount.toFixed(2)} AUD
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                    {invoice.status}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
