'use client';

/**
 * API Keys (placeholder)
 *
 * The previous /dashboard/settings/api-keys page generated mock keys
 * with crypto.randomUUID() client-side and stored them in React state
 * — fake keys that survived nothing. Per the 2026-05-08 settings
 * review, mock UI in production damages trust faster than missing UI.
 *
 * Real API keys ship with Phase 32B PR3+ (org-attached read-only API
 * for accountants / mortgage brokers / advisers). Until then this page
 * shows a single honest "not yet" state.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, ExternalLink } from 'lucide-react';

export default function ApiKeysPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API access
        </CardTitle>
        <CardDescription>
          Programmatic access to your Monitrax data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Key className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Coming with the Org Portal</p>
          <p className="text-sm text-muted-foreground mt-2">
            API keys ship with the Org Portal release (Phase 32B). They'll
            let your accountant or financial adviser pull a read-only copy
            of your data straight into their tools, with the same scoped
            consent model as Open Banking.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            For now, you can export everything as JSON from{' '}
            <a
              href="/dashboard/settings/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy &amp; CDR
            </a>
            .
          </p>
        </div>

        <Button variant="outline" asChild>
          <a href="/dashboard/settings/privacy">
            <ExternalLink className="h-4 w-4 mr-2" />
            Export my data instead
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
