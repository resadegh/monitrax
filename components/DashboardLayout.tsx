'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Home,
  Banknote,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calculator,
  Receipt,
  LogOut,
  User,
  PieChart,
  Activity,
  ArrowLeftRight,
  RefreshCw,
  LineChart,
  Lightbulb,
  Menu,
  X,
  FileText,
  Brain,
  FolderOpen,
  Settings,
  ChevronDown,
  Briefcase,
  CreditCard,
  BarChart3,
  Car,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUISyncEngine } from '@/hooks/useUISyncEngine';
import { GlobalWarningRibbon } from '@/components/warnings/GlobalWarningRibbon';
import { FinancialHealthMiniWidget } from '@/components/health/FinancialHealthMiniWidget';
import AiChatButton from '@/components/AiChatButton';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

// Standalone navigation items (always visible)
const standaloneItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Personal CFO', href: '/dashboard/cfo', icon: Brain },
];

// Grouped navigation items (collapsible)
const navGroups: NavGroup[] = [
  {
    name: 'Portfolio',
    icon: Briefcase,
    items: [
      { name: 'Properties', href: '/dashboard/properties', icon: Home },
      { name: 'Loans', href: '/dashboard/loans', icon: Banknote },
      { name: 'Accounts', href: '/dashboard/accounts', icon: Wallet },
      { name: 'Investments', href: '/dashboard/investments/accounts', icon: PieChart },
      { name: 'Assets', href: '/dashboard/assets', icon: Car },
    ],
  },
  {
    name: 'Transactions',
    icon: CreditCard,
    items: [
      { name: 'Income', href: '/dashboard/income', icon: TrendingUp },
      { name: 'Expenses', href: '/dashboard/expenses', icon: TrendingDown },
      { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
      { name: 'Recurring', href: '/recurring', icon: RefreshCw },
    ],
  },
  {
    name: 'Planning',
    icon: Lightbulb,
    items: [
      { name: 'Cashflow', href: '/cashflow', icon: LineChart },
      { name: 'Financial Health', href: '/health', icon: Activity },
      { name: 'Strategy', href: '/strategy', icon: Lightbulb },
      { name: 'Debt Planner', href: '/dashboard/debt-planner', icon: Calculator },
      { name: 'Tax Calculator', href: '/dashboard/tax', icon: Receipt },
    ],
  },
  {
    name: 'Reporting',
    icon: BarChart3,
    items: [
      { name: 'Reports', href: '/dashboard/reports', icon: FileText },
      { name: 'Documents', href: '/dashboard/documents', icon: FolderOpen },
    ],
  },
];

// Settings navigation item (shown separately at bottom)
const settingsNavItem: NavItem = {
  name: 'Settings',
  href: '/dashboard/settings',
  icon: Settings,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Phase 14.5 - Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Collapsible nav groups state - auto-expand group containing current path
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Auto-expand group containing current route on initial load
    navGroups.forEach(group => {
      if (group.items.some(item => pathname === item.href || pathname.startsWith(item.href))) {
        initial.add(group.name);
      }
    });
    return initial;
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Auto-expand group when navigating to a page within it
  useEffect(() => {
    navGroups.forEach(group => {
      if (group.items.some(item => pathname === item.href || pathname.startsWith(item.href))) {
        setExpandedGroups(prev => {
          if (!prev.has(group.name)) {
            const next = new Set(prev);
            next.add(group.name);
            return next;
          }
          return prev;
        });
      }
    });
  }, [pathname]);

  // Phase 9.4 - Real-Time Global Health Feed
  const { state: syncState } = useUISyncEngine({
    enabled: true,
    pollingInterval: 30000, // 30 seconds
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/signin');
    }
  }, [user, isLoading, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Phase 9.5 - Global Warning Ribbon */}
      {syncState.warningRibbon.show && (
        <GlobalWarningRibbon
          config={syncState.warningRibbon}
          health={syncState.health}
          dismissible={true}
        />
      )}

      {/* Phase 14.5 - Mobile Header (visible on mobile only) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-brand-primary flex items-center justify-between px-4 shadow-lg">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-brand-secondary flex items-center justify-center">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Monitrax</h1>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Phase 14.5 - Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Responsive */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r border-border
          bg-card shadow-lg flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo/Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4 bg-brand-primary flex-shrink-0">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-brand-secondary flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Monitrax</h1>
              <p className="text-xs text-emerald-200">Financial Planning</p>
            </div>
          </Link>
          {/* Close button (mobile only) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          {/* Theme toggle (desktop only) */}
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* Standalone items (Dashboard, Personal CFO) */}
          {standaloneItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5 lg:h-4 lg:w-4" />
                {item.name}
              </Link>
            );
          })}

          {/* Collapsible nav groups */}
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups.has(group.name);
            const hasActiveChild = group.items.some(
              item => pathname === item.href || pathname.startsWith(item.href)
            );

            return (
              <div key={group.name} className="space-y-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    hasActiveChild
                      ? 'text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className="h-5 w-5 lg:h-4 lg:w-4" />
                    {group.name}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Group items */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="pl-4 space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Phase 12 - Financial Health Widget */}
          <div className="pt-4">
            <FinancialHealthMiniWidget />
          </div>
        </nav>

        {/* User Section - Fixed at bottom */}
        <div className="border-t border-border p-4 flex-shrink-0 space-y-2">
          {/* Settings Link */}
          <Link
            href={settingsNavItem.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              pathname.startsWith(settingsNavItem.href)
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings className="h-5 w-5 lg:h-4 lg:w-4" />
            {settingsNavItem.name}
          </Link>

          {/* User Info */}
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3 border border-border">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* Sign Out Button */}
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content - Responsive */}
      <div className="lg:pl-64">
        {/* Add top padding on mobile for the header */}
        <main className="min-h-screen p-4 pt-20 lg:p-8 lg:pt-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* AI Chat Floating Button */}
      <AiChatButton />
    </div>
  );
}
