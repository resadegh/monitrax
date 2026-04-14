'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Search,
  Users,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUISyncEngine } from '@/hooks/useUISyncEngine';
import { GlobalWarningRibbon } from '@/components/warnings/GlobalWarningRibbon';
import { FinancialHealthMiniWidget } from '@/components/health/FinancialHealthMiniWidget';
import AiChatButton from '@/components/AiChatButton';
import { UniversalSearch, useUniversalSearch } from '@/components/UniversalSearch';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import {
  OnboardingWelcomeModal,
  GuidedTour,
  WizardContainer,
  OnboardingProgressBadge,
  OnboardingResumeBanner,
  WizardData,
} from '@/components/onboarding';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId?: string; // For guided tour targeting
}

interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  tourId?: string; // For guided tour targeting
}

// Standalone navigation items (always visible)
const standaloneItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, tourId: 'nav-dashboard' },
  { name: 'Household', href: '/dashboard/household-profile', icon: Users, tourId: 'nav-household' },
  { name: 'Personal CFO', href: '/dashboard/cfo', icon: Brain, tourId: 'nav-cfo' },
];

// Grouped navigation items (collapsible)
const navGroups: NavGroup[] = [
  {
    name: 'Portfolio',
    icon: Briefcase,
    tourId: 'nav-portfolio',
    items: [
      { name: 'Properties', href: '/dashboard/properties', icon: Home, tourId: 'nav-properties' },
      { name: 'Loans', href: '/dashboard/loans', icon: Banknote, tourId: 'nav-loans' },
      { name: 'Accounts', href: '/dashboard/accounts', icon: Wallet, tourId: 'nav-accounts' },
      { name: 'Investments', href: '/dashboard/investments/accounts', icon: PieChart, tourId: 'nav-investments' },
      { name: 'Assets', href: '/dashboard/assets', icon: Car, tourId: 'nav-assets' },
    ],
  },
  {
    name: 'Transactions',
    icon: CreditCard,
    tourId: 'nav-transactions',
    items: [
      { name: 'Income', href: '/dashboard/income', icon: TrendingUp, tourId: 'nav-income' },
      { name: 'Expenses', href: '/dashboard/expenses', icon: TrendingDown, tourId: 'nav-expenses' },
      { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight, tourId: 'nav-all-transactions' },
      { name: 'Recurring', href: '/recurring', icon: RefreshCw, tourId: 'nav-recurring' },
    ],
  },
  {
    name: 'Planning',
    icon: Lightbulb,
    tourId: 'nav-planning',
    items: [
      { name: 'Budget Analysis', href: '/dashboard/budget-analysis', icon: Target, tourId: 'nav-budget-analysis' },
      { name: 'Debt Planner', href: '/dashboard/debt-planner', icon: Calculator, tourId: 'nav-debt' },
      { name: 'Cashflow', href: '/cashflow', icon: LineChart, tourId: 'nav-cashflow' },
      { name: 'Financial Health', href: '/health', icon: Activity, tourId: 'nav-health' },
      { name: 'Tax Calculator', href: '/dashboard/tax', icon: Receipt, tourId: 'nav-tax' },
      { name: 'Strategy', href: '/strategy', icon: Lightbulb, tourId: 'nav-strategy' },
    ],
  },
  {
    name: 'Reporting',
    icon: BarChart3,
    tourId: 'nav-reporting',
    items: [
      { name: 'Reports', href: '/dashboard/reports', icon: FileText, tourId: 'nav-reports' },
      { name: 'Documents', href: '/dashboard/documents', icon: FolderOpen, tourId: 'nav-documents' },
    ],
  },
];

// Settings navigation item (shown separately at bottom)
const settingsNavItem: NavItem = {
  name: 'Settings',
  href: '/dashboard/settings',
  icon: Settings,
  tourId: 'nav-settings',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Phase 14.5 - Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Universal search
  const { open: searchOpen, setOpen: setSearchOpen } = useUniversalSearch();

  // Phase 12: Onboarding state
  const {
    state: onboardingState,
    shouldShowWelcome,
    shouldShowOnboardingBadge,
    shouldShowResumeBanner,
    dismissWelcomeModal,
    dismissOnboardingBadge,
    startOnboarding,
    markTourCompleted,
    markTourSkipped,
    completeOnboarding,
    setCurrentStep,
    saveDraft,
    clearDraft,
  } = useOnboardingState();

  // Onboarding modal states
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  // Phase 12 PR 2: Hydrated draft + step index passed to WizardContainer.
  // Reads from the server-backed onboardingState; falls back to the local
  // draft if the server returned null (same-device blip safety net).
  const hydratedDraft = useMemo<Partial<WizardData> | undefined>(() => {
    const serverDraft = onboardingState?.draft;
    if (serverDraft && typeof serverDraft === 'object') {
      return serverDraft as Partial<WizardData>;
    }
    // Local fallback is only read when server said "no draft". This avoids
    // the case where a stale localStorage entry from a previous user
    // leaks into a different session (useOnboardingState namespaces by
    // userId so this is already safe, but the explicit check keeps intent
    // readable).
    return undefined;
  }, [onboardingState?.draft]);
  const hydratedStepIndex = onboardingState?.currentStep ?? 0;
  // Session-scoped banner dismiss (resets next login). For "never show
  // again" semantics, the user clicks Start over, which wipes the draft.
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);

  // Show welcome modal for new users (only on dashboard page).
  // Hardened "show once / never again" — backed by:
  //   • state.onboardingCompleted (set on bulk-create success)
  //   • state.preferences.dismissedWelcomeModal (set on any skip)
  //   • localStorage fallback (useOnboardingState)
  //   • draft/step progress priority (resume banner takes over)
  //   • wizard guard: do not re-open the welcome modal once the wizard
  //     has started (prevents a loop where startOnboarding refreshes
  //     state, momentarily flips shouldShowWelcome back to true, and
  //     this effect pops the welcome modal back over the wizard).
  // See useOnboardingState.shouldShowWelcome for the full contract.
  useEffect(() => {
    if (shouldShowWelcome && pathname === '/dashboard' && !showWizard) {
      setShowWelcomeModal(true);
    }
  }, [shouldShowWelcome, pathname, showWizard]);

  // Onboarding handlers - all wrapped in try-catch to work even if DB not migrated
  const handleStartSetup = useCallback(async () => {
    setShowWelcomeModal(false);
    setShowWizard(true);
    try {
      await startOnboarding();
    } catch (e) {
      console.warn('Could not save onboarding state:', e);
    }
  }, [startOnboarding]);

  const handleTakeTour = useCallback(() => {
    setShowWelcomeModal(false);
    setShowTour(true);
  }, []);

  // Phase 12 PR 2 — strict "show once / never again" contract:
  //   - handleSkipOnboarding: close-only. Modal reappears next login UNLESS
  //     the user explicitly ticks "Don't show this again" (which triggers
  //     onDismissPermanently in the modal → dismissWelcomeModal()).
  //   - handleWizardComplete: clears draft + sets onboardingCompleted=true,
  //     so the modal never returns.
  const handleSkipOnboarding = useCallback(() => {
    // NO server-side dismiss. This intentionally does NOT call
    // dismissWelcomeModal() — that's reserved for the checkbox path.
    setShowWelcomeModal(false);
  }, []);

  const handleTourComplete = useCallback(async () => {
    setShowTour(false);
    setShowWizard(true);
    try {
      await markTourCompleted();
    } catch (e) {
      console.warn('Could not save tour completion:', e);
    }
  }, [markTourCompleted]);

  const handleTourSkip = useCallback(async () => {
    setShowTour(false);
    try {
      await markTourSkipped();
    } catch (e) {
      console.warn('Could not save tour skip:', e);
    }
  }, [markTourSkipped]);

  const handleWizardComplete = useCallback(async (wizardData: WizardData) => {
    try {
      // Save all wizard data to the database via bulk-create API.
      // bulk-create itself clears UserPreference.onboardingDraft on success
      // (see PR 1 / PR 2 changelog), so the resume banner disappears and
      // the welcome modal will never re-fire (onboardingCompleted = true).
      const response = await fetch('/api/onboarding/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(wizardData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save wizard data:', errorData);
        throw new Error(errorData.error || 'Failed to save data');
      }

      // Mark onboarding as complete + clear local draft fallback.
      await completeOnboarding();
      await clearDraft();
      setShowWizard(false);

      // Full page reload to ensure client components refetch data
      // router.refresh() only invalidates server component cache,
      // but dashboard uses client-side useEffect to fetch data
      window.location.reload();
    } catch (e) {
      console.error('Could not complete wizard:', e);
      // Still close the wizard but show an error state could be added here
      setShowWizard(false);
    }
  }, [clearDraft, completeOnboarding, token]);

  const handleResumeOnboarding = useCallback(() => {
    setShowWizard(true);
  }, []);

  // Phase 12 PR 2: Wizard autosave callback. Invoked by WizardContainer
  // after the debounce fires. Persists the in-progress draft + current
  // step to the server so the user can resume on any device.
  const handleWizardAutoSave = useCallback(
    (wizardData: WizardData, stepIndex: number) => {
      // Fire-and-forget; saveDraft already catches and logs its own errors.
      void saveDraft(wizardData, stepIndex);
      // Also update the step index explicitly so `currentStep` on
      // useOnboardingState stays in sync for the resume banner label.
      void setCurrentStep(stepIndex);
    },
    [saveDraft, setCurrentStep]
  );

  // Phase 12 PR 2: Resume banner actions.
  const handleResumeBannerResume = useCallback(() => {
    setShowWizard(true);
  }, []);
  const handleResumeBannerStartOver = useCallback(async () => {
    try {
      await clearDraft();
      await setCurrentStep(0);
    } catch (e) {
      console.warn('Could not fully reset onboarding draft:', e);
    }
    setResumeBannerDismissed(true);
    // Force a fresh wizard instance on next open.
    setShowWizard(false);
  }, [clearDraft, setCurrentStep]);
  const handleResumeBannerDismiss = useCallback(() => {
    setResumeBannerDismissed(true);
  }, []);

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
    // Only redirect to signin when there's genuinely no authenticated session.
    // If token exists but user is null, the profile is still being fetched
    // from /api/auth/me — wait for it instead of redirecting.
    if (!isLoading && !user && !token) {
      router.push('/signin');
    }
  }, [user, isLoading, token, router]);

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

  if (isLoading || (token && !user)) {
    // Show loading spinner while:
    // 1. AuthContext is still initializing (isLoading)
    // 2. Token exists but user profile hasn't loaded yet (fetchUserProfile in progress)
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
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
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
        data-tour="sidebar"
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
          {/* Search and Theme toggle (desktop only) */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Search (⌘K)"
              title="Search (⌘K)"
            >
              <Search className="h-4 w-4 text-white" />
            </button>
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
                data-tour={item.tourId}
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
              <div key={group.name} className="space-y-1" data-tour={group.tourId}>
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
                          data-tour={item.tourId}
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
            data-tour={settingsNavItem.tourId}
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
        <main className="min-h-screen p-3 pt-16 sm:p-4 sm:pt-20 lg:p-8 lg:pt-8">
          <div className="mx-auto max-w-7xl">
            {/* Phase 12 PR 2: Resume banner for users with an unfinished
                wizard draft. Persists across ALL dashboard pages while
                onboarding is in progress (was previously gated to
                /dashboard only, which broke the flow when the user
                navigated to /dashboard/properties to add their first
                property — they'd lose the visual anchor and the way
                back to the wizard). The banner now disappears only
                when:
                  • the user dismisses it (session-scoped)
                  • the user clicks "Start over" (clears the draft)
                  • onboarding completes server-side
                  • the wizard or welcome modal is already open
                    (avoids stacking two onboarding affordances).
                See useOnboardingState.shouldShowResumeBanner for the
                full server-side contract. */}
            {!showWizard && !showWelcomeModal && shouldShowResumeBanner && !resumeBannerDismissed && (
              <OnboardingResumeBanner
                currentStep={onboardingState?.currentStep ?? 0}
                totalSteps={8}
                onResume={handleResumeBannerResume}
                onStartOver={handleResumeBannerStartOver}
                onDismiss={handleResumeBannerDismiss}
              />
            )}
            {/* Phase 12: Onboarding Progress Badge */}
            {shouldShowOnboardingBadge && onboardingState && (
              <div className="mb-4" data-tour="dashboard-stats">
                <OnboardingProgressBadge
                  isVisible={true}
                  currentStep={onboardingState.currentStep}
                  totalSteps={8}
                  onResume={handleResumeOnboarding}
                  onDismiss={dismissOnboardingBadge}
                />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* AI Chat Floating Button — hidden when onboarding modals are open
           so it doesn't overlap the wizard's Back/Next buttons. */}
      {!showWelcomeModal && !showWizard && <AiChatButton />}

      {/* Universal Search */}
      <UniversalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Phase 12: Onboarding Components */}
      {/* Welcome Modal for new users */}
      <OnboardingWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleSkipOnboarding}
        onStartSetup={handleStartSetup}
        onTakeTour={handleTakeTour}
        onSkip={handleSkipOnboarding}
        onDismissPermanently={dismissWelcomeModal}
      />

      {/* Guided Tour */}
      <GuidedTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        onDismissPermanently={dismissWelcomeModal}
      />

      {/* Enhanced Setup Wizard v2.0 — Phase 12 PR 2 hydrates from server
          draft + autosaves on every change. */}
      <WizardContainer
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
        initialData={hydratedDraft}
        initialStepIndex={hydratedStepIndex}
        onAutoSave={handleWizardAutoSave}
      />
    </div>
  );
}
