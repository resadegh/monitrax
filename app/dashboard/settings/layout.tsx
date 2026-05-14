'use client';

/**
 * My Settings layout (Settings overhaul 2026-05-08)
 *
 * Renamed "Settings" → "My Settings" per CLAUDE.md §14 warm-language
 * rule (My Wealth, My Guide, My Household — and now My Settings).
 *
 * Sidebar regrouped from one flat list into five mental-model groups:
 *   - Me            — Profile, Appearance, Trusted contact
 *   - My money data — Bank connections, Cloud storage, Categorisation, Shares
 *   - Privacy & safety — Security, MFA, Privacy & CDR
 *   - My notifications
 *   - My plan       — API access, Billing
 *
 * Behavioural-psychology lens (Mani et al. 2013): grouping reduces the
 * cognitive cost of finding the right control.
 *
 * Visual surface unchanged — same `<Card>` vocabulary, same active-state
 * treatment. The Phase 39 GlassHero pass is queued separately.
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  Shield,
  ShieldCheck,
  Send,
  Cloud,
  User,
  Bell,
  Palette,
  CreditCard,
  Key,
  ArrowLeft,
  X,
  Lock,
  HeartHandshake,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBasiqEnabled } from '@/lib/featureFlags/BasiqGateContext';

interface SettingsNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

const settingsNavGroups: SettingsNavGroup[] = [
  {
    label: 'Me',
    items: [
      {
        name: 'Profile',
        href: '/dashboard/settings/profile',
        icon: User,
        description: 'Your personal information',
      },
      {
        name: 'Appearance',
        href: '/dashboard/settings/appearance',
        icon: Palette,
        description: 'Theme, locale, currency, financial year',
      },
      {
        name: 'Trusted contact',
        href: '/dashboard/settings/trusted-contact',
        icon: HeartHandshake,
        description: 'Someone to loop in if you ever need help',
      },
    ],
  },
  {
    label: 'My money data',
    items: [
      {
        name: 'Bank connections',
        href: '/dashboard/settings/connections',
        icon: LinkIcon,
        description: 'Banks Monitrax reads from via Open Banking',
      },
      {
        name: 'Cloud storage',
        href: '/dashboard/settings/storage',
        icon: Cloud,
        description: 'Where your documents live',
      },
      {
        name: 'AI categorisation',
        href: '/dashboard/settings/categorization',
        icon: Sparkles,
        description: 'How aggressive the auto-categorise is',
      },
      {
        name: 'Shares',
        href: '/dashboard/settings/shares',
        icon: Send,
        description: 'Active and revoked share links',
      },
    ],
  },
  {
    label: 'Privacy & safety',
    items: [
      {
        name: 'Security',
        href: '/dashboard/settings/security',
        icon: Shield,
        description: 'Password, sessions, sign-in providers',
      },
      {
        name: 'Two-factor auth',
        href: '/dashboard/settings/security-mfa',
        icon: ShieldCheck,
        description: 'Authenticator, SMS, backup codes',
      },
      {
        name: 'Privacy & CDR',
        href: '/dashboard/settings/privacy',
        icon: Lock,
        description: 'Consent, data export, right to erasure',
      },
    ],
  },
  {
    label: 'My notifications',
    items: [
      {
        name: 'Notifications',
        href: '/dashboard/settings/notifications',
        icon: Bell,
        description: 'Email and push',
      },
    ],
  },
  {
    label: 'My plan',
    items: [
      {
        name: 'Billing',
        href: '/dashboard/settings/billing',
        icon: CreditCard,
        description: 'Subscription and payments',
      },
      {
        name: 'API access',
        href: '/dashboard/settings/api-keys',
        icon: Key,
        description: 'Programmatic data access',
      },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const basiqEnabled = useBasiqEnabled();

  // Hide the Bank-connections nav entry when BASIQ_INTEGRATION is OFF.
  // The page itself also renders a "not available yet" notice (see
  // /dashboard/settings/connections/page.tsx) — this just removes the
  // navigation pathway so users don't see a dead nav link.
  const visibleGroups = settingsNavGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      basiqEnabled ? true : item.href !== '/dashboard/settings/connections',
    ),
  }));

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Dashboard</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Settings className="h-8 w-8" />
                My Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your account, your money data, and your privacy.
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <X className="h-4 w-4" />
              Close
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Settings Navigation Sidebar */}
        <nav className="w-full lg:w-64 flex-shrink-0 space-y-6">
          {/* Overview link sits above the groups */}
          <div className="space-y-1">
            <Link
              href="/dashboard/settings"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                pathname === '/dashboard/settings'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Settings className="h-4 w-4" />
              <div className="flex-1">
                <div>Overview</div>
                {pathname !== '/dashboard/settings' && (
                  <div className="text-xs text-muted-foreground/70 hidden lg:block">
                    Account snapshot
                  </div>
                )}
              </div>
            </Link>
          </div>

          {visibleGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="flex-1">
                      <div>{item.name}</div>
                      {!isActive && (
                        <div className="text-xs text-muted-foreground/70 hidden lg:block">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
