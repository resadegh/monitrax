'use client';

/**
 * Phase 19.1: Settings Layout
 * Provides consistent navigation for all settings pages
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  Shield,
  Cloud,
  User,
  Bell,
  Palette,
  CreditCard,
  Key,
  ArrowLeft,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SettingsNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    name: 'General',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'Basic account settings',
  },
  {
    name: 'Profile',
    href: '/dashboard/settings/profile',
    icon: User,
    description: 'Your personal information',
  },
  {
    name: 'Security',
    href: '/dashboard/settings/security',
    icon: Shield,
    description: 'Password and authentication',
  },
  {
    name: 'Cloud Storage',
    href: '/dashboard/settings/storage',
    icon: Cloud,
    description: 'Connect Google Drive, iCloud',
  },
  {
    name: 'Notifications',
    href: '/dashboard/settings/notifications',
    icon: Bell,
    description: 'Email and push notifications',
  },
  {
    name: 'Appearance',
    href: '/dashboard/settings/appearance',
    icon: Palette,
    description: 'Theme and display preferences',
  },
  {
    name: 'API Keys',
    href: '/dashboard/settings/api-keys',
    icon: Key,
    description: 'Manage API access',
  },
  {
    name: 'Billing',
    href: '/dashboard/settings/billing',
    icon: CreditCard,
    description: 'Subscription and payments',
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
                Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your account settings and preferences
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
        <nav className="w-full lg:w-64 flex-shrink-0">
          <div className="space-y-1">
            {settingsNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard/settings' &&
                  pathname.startsWith(item.href));
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
        </nav>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
