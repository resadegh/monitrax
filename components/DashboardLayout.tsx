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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUISyncEngine } from '@/hooks/useUISyncEngine';
import { GlobalWarningRibbon } from '@/components/warnings/GlobalWarningRibbon';
import { FinancialHealthMiniWidget } from '@/components/health/FinancialHealthMiniWidget';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', href: '/dashboard/properties', icon: Home },
  { name: 'Loans', href: '/dashboard/loans', icon: Banknote },
  { name: 'Accounts', href: '/dashboard/accounts', icon: Wallet },
  { name: 'Income', href: '/dashboard/income', icon: TrendingUp },
  { name: 'Expenses', href: '/dashboard/expenses', icon: TrendingDown },
  { name: 'Investments', href: '/dashboard/investments/accounts', icon: PieChart },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Recurring', href: '/recurring', icon: RefreshCw },
  { name: 'Cashflow', href: '/cashflow', icon: LineChart },
  { name: 'Financial Health', href: '/health', icon: Activity },
  { name: 'Strategy', href: '/strategy', icon: Lightbulb },
  { name: 'Debt Planner', href: '/dashboard/debt-planner', icon: Calculator },
  { name: 'Tax Calculator', href: '/dashboard/tax', icon: Receipt },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Phase 14.5 - Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Phase 9.4 - Real-Time Global Health Feed
  const { state: syncState } = useUISyncEngine({
    enabled: true,
    pollingInterval: 30000, // 30 seconds
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
      {/* Phase 9.5 - Global Warning Ribbon */}
      {syncState.warningRibbon.show && (
        <GlobalWarningRibbon
          config={syncState.warningRibbon}
          health={syncState.health}
          dismissible={true}
        />
      )}

      {/* Phase 14.5 - Mobile Header (visible on mobile only) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 flex items-center justify-between px-4 shadow-lg">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
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
          fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 dark:border-slate-800
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-lg flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo/Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Monitrax</h1>
              <p className="text-xs text-blue-100">Financial Planning</p>
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
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 text-white shadow-md'
                    : 'text-muted-foreground hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-950/50 dark:hover:to-purple-950/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5 lg:h-4 lg:w-4" />
                {item.name}
              </Link>
            );
          })}

          {/* Phase 12 - Financial Health Widget */}
          <div className="pt-4">
            <FinancialHealthMiniWidget />
          </div>
        </nav>

        {/* User Section - Fixed at bottom */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex-shrink-0">
          <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 p-3 mb-2 border border-blue-100 dark:border-blue-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 text-white">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
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
    </div>
  );
}
