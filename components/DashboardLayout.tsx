'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Home,
  Wallet,
  LogOut,
  User,
  Menu,
  X,
  FileText,
  Brain,
  Settings,
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
  tourId?: string;
  // REACH stage tag — shown as subtle badge for journey-aligned items
  reachStage?: 'R' | 'E' | 'A' | 'C' | 'H';
  // Matching routes — additional paths that should highlight this item
  matchRoutes?: string[];
}

// =============================================================================
// REACH SIDEBAR — 8 flat items, no accordion groups
// Framework: docs/blueprint/REACH_FRAMEWORK.md
//
// Home → My Household → My Accounts [R] → My Budget [A] →
// My Wealth [C] → My CFO [H] → Reports → Settings
// =============================================================================

const reachNavItems: NavItem[] = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: LayoutDashboard,
    tourId: 'nav-dashboard',
  },
  {
    name: 'My Household',
    href: '/dashboard/household-profile',
    icon: Users,
    tourId: 'nav-household',
  },
  {
    name: 'My Accounts',
    href: '/dashboard/accounts',
    icon: Wallet,
    tourId: 'nav-accounts',
    reachStage: 'R',
    // All pages that live under the "My Accounts" tab group
    matchRoutes: [
      '/dashboard/accounts',
      '/dashboard/loans',
      '/dashboard/income',
      '/dashboard/expenses',
      '/transactions',
      '/recurring',
    ],
  },
  {
    name: 'My Budget',
    href: '/dashboard/budget-analysis',
    icon: Target,
    tourId: 'nav-budget',
    reachStage: 'A',
    matchRoutes: [
      '/dashboard/budget-analysis',
      '/cashflow',
      '/dashboard/debt-planner',
      '/dashboard/tax',
    ],
  },
  {
    name: 'My Wealth',
    href: '/dashboard/properties',
    icon: Home,
    tourId: 'nav-wealth',
    reachStage: 'C',
    matchRoutes: [
      '/dashboard/properties',
      '/dashboard/investments',
      '/dashboard/assets',
    ],
  },
  {
    name: 'My CFO',
    href: '/dashboard/cfo',
    icon: Brain,
    tourId: 'nav-cfo',
    reachStage: 'H',
    matchRoutes: [
      '/dashboard/cfo',
      '/health',
      // Strategy is redundant with CFO — marked for cleanup
      // '/strategy',
    ],
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: FileText,
    tourId: 'nav-reports',
    matchRoutes: [
      '/dashboard/reports',
      '/dashboard/documents',
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
    readLocalDraft,
  } = useOnboardingState();

  // Onboarding modal states
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  // Phase 12 PR 2: Hydrated draft + step index passed to WizardContainer.
  // Reads from the server-backed onboardingState; falls back to the local
  // draft if the server returned null (same-device blip safety net).
  //
  // Fix (Phase 12 v3 — bug A.2): the previous implementation documented a
  // localStorage fallback but never actually invoked it — it just returned
  // `undefined` on the server-null branch. Users who saved a local draft
  // during a network blip (offline, flaky connection, tab crash between
  // debounced server writes) silently lost it on resume. We now call
  // `readLocalDraft()` — which `useOnboardingState` already exposes and
  // namespaces by userId — so the same-device blip path actually works.
  // See docs/blueprint/PHASE_12_REDESIGN_V3.md §7.1 bug A.2.
  const hydratedDraft = useMemo<Partial<WizardData> | undefined>(() => {
    const serverDraft = onboardingState?.draft;
    if (serverDraft && typeof serverDraft === 'object') {
      return serverDraft as Partial<WizardData>;
    }
    // Server said "no draft" → try the same-device local cache. The hook
    // namespaces by userId, so a stale entry from a previous user cannot
    // leak in here.
    const localDraft = readLocalDraft();
    if (localDraft && typeof localDraft === 'object') {
      return localDraft as Partial<WizardData>;
    }
    return undefined;
  }, [onboardingState?.draft, readLocalDraft]);
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

  // Phase 12 twin-track (C.1): auto-route incomplete users from
  // /dashboard to the new /onboarding wizard. Triggers only when:
  //   • the user is on /dashboard (not a sub-page — we never redirect
  //     from /dashboard/properties, /dashboard/accounts, etc.),
  //   • onboardingState has loaded (not null),
  //   • onboarding is not marked complete,
  //   • the user has no real data yet,
  //   • the user has EITHER dismissed the welcome modal before OR
  //     has a saved draft (i.e. they've seen the greeting once or
  //     have in-progress setup to resume),
  //   • the `?legacy=wizard` support/QA escape hatch is NOT active.
  //
  // Truly fresh users (no draft, no dismiss flag) still see the
  // welcome modal first, click "Start setup", and land on the same
  // wizard via handleStartSetup. This effect covers the "returning
  // incomplete user" case where the welcome modal has already been
  // dismissed. Users who opt out of the wizard entirely go to
  // /dashboard/setup via the "Start over" button (which clears the
  // draft) and the auto-redirect respects hasExistingData.
  useEffect(() => {
    if (pathname !== '/dashboard') return;
    if (!onboardingState) return;
    if (onboardingState.onboardingCompleted) return;
    if (onboardingState.hasExistingData) return;

    // Respect the legacy escape hatch: users hitting
    // /dashboard?legacy=wizard must stay on /dashboard with the
    // legacy flow for support/QA purposes.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('legacy') === 'wizard') return;
    }

    const hasDismissedWelcome =
      onboardingState.preferences?.dismissedWelcomeModal === true;
    const hasSavedDraft =
      onboardingState.draft !== null && onboardingState.draft !== undefined;

    if (hasDismissedWelcome || hasSavedDraft) {
      router.push('/onboarding');
    }
  }, [pathname, onboardingState, router]);

  // Onboarding handlers - all wrapped in try-catch to work even if DB not migrated
  //
  // Phase 12 twin-track (C.0): handleStartSetup routes to the new
  // /onboarding linear wizard (Track B). The wizard is the first-time
  // discovery experience; /dashboard/setup is the refinement engine
  // that users land on AFTER the wizard completes. The legacy
  // WizardContainer remains reachable via /dashboard?legacy=wizard
  // for support and QA until Track C.2 deletes it.
  const handleStartSetup = useCallback(async () => {
    setShowWelcomeModal(false);
    try {
      await startOnboarding();
    } catch (e) {
      console.warn('Could not save onboarding state:', e);
    }
    router.push('/onboarding');
  }, [startOnboarding, router]);

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
  //
  // Fix (Phase 12 v3 — bug A.4): this used to fire `saveDraft` and
  // `setCurrentStep` as two independent parallel POSTs, which raced each
  // other on the server — POST #2 could land before POST #1, leaving the
  // server with an advanced step index + a stale draft if POST #1 then
  // failed. `saveDraft` now takes the step index as its second argument
  // and persists both fields in a single atomic POST, and it also
  // optimistically updates local hook state so the resume banner label
  // stays fresh without a second POST. One call, one request, no race.
  // See docs/blueprint/PHASE_12_REDESIGN_V3.md §7.1 bug A.4.
  const handleWizardAutoSave = useCallback(
    (wizardData: WizardData, stepIndex: number) => {
      // Fire-and-forget; saveDraft already catches and logs its own errors,
      // and now also mirrors `currentStep` into local hook state on success.
      void saveDraft(wizardData, stepIndex);
    },
    [saveDraft]
  );

  // Phase 12 twin-track (C.1): Resume banner Resume routes to the
  // new /onboarding wizard (Track B) so the user can pick up where
  // they left off. Start over clears the draft AND routes to
  // /dashboard/setup (bypassing the wizard entirely — starting over
  // means the user is opting out of the first-time wizard and going
  // straight to the refinement engine).
  const handleResumeBannerResume = useCallback(() => {
    router.push('/onboarding');
  }, [router]);
  const handleResumeBannerStartOver = useCallback(async () => {
    try {
      await clearDraft();
      await setCurrentStep(0);
    } catch (e) {
      console.warn('Could not fully reset onboarding draft:', e);
    }
    setResumeBannerDismissed(true);
    router.push('/dashboard/setup');
  }, [clearDraft, setCurrentStep, router]);
  const handleResumeBannerDismiss = useCallback(() => {
    setResumeBannerDismissed(true);
  }, []);

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

        {/* Navigation — REACH Framework flat list (docs/blueprint/REACH_FRAMEWORK.md) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {reachNavItems.map((item) => {
            // Active state: exact match for Home, prefix match for others
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/dashboard/setup'
              : item.matchRoutes
                ? item.matchRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))
                : pathname === item.href || pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tourId}
                className={`
                  group flex items-center gap-3 rounded-xl px-3 py-2.5
                  text-[13px] font-medium tracking-wide
                  transition-all duration-200 ease-out
                  ${isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }
                `}
              >
                <div className={`
                  flex h-8 w-8 items-center justify-center rounded-lg
                  transition-colors duration-200
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                  }
                `}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex-1">{item.name}</span>
                {/* REACH stage badge */}
                {item.reachStage && (
                  <span className={`
                    text-[10px] font-bold tracking-widest uppercase
                    px-1.5 py-0.5 rounded-md
                    ${isActive
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted/80 text-muted-foreground/60'
                    }
                  `}>
                    {item.reachStage}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Separator before health widget */}
          <div className="pt-3">
            <Separator className="mb-3" />
            <FinancialHealthMiniWidget />
          </div>
        </nav>

        {/* Bottom Section — Settings + User */}
        <div className="border-t border-border px-3 py-3 flex-shrink-0 space-y-1.5">
          {/* Settings */}
          <Link
            href={settingsNavItem.href}
            data-tour={settingsNavItem.tourId}
            className={`
              group flex items-center gap-3 rounded-xl px-3 py-2.5
              text-[13px] font-medium tracking-wide
              transition-all duration-200 ease-out
              ${pathname.startsWith(settingsNavItem.href)
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }
            `}
          >
            <div className={`
              flex h-8 w-8 items-center justify-center rounded-lg
              transition-colors duration-200
              ${pathname.startsWith(settingsNavItem.href)
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
              }
            `}>
              <Settings className="h-4 w-4" />
            </div>
            <span className="flex-1">Settings</span>
          </Link>

          {/* User Info + Sign Out */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button
              onClick={logout}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content - Responsive */}
      <div className="lg:pl-64">
        {/* Add top padding on mobile for the header.
            `onboarding-active-shell` applies a subtle sky-blue ambient
            tint while the user has an unfinished wizard draft, giving
            the dashboard a "still in setup mode" cue that fades back to
            normal once onboarding completes. Same gating boolean as the
            persistent resume banner — single source of truth (see
            useOnboardingState.shouldShowResumeBanner). The CSS lives in
            styles/wizard-animations.css under "ONBOARDING ACTIVE SHELL". */}
        <main
          className={`min-h-screen p-3 pt-16 sm:p-4 sm:pt-20 lg:p-8 lg:pt-8 ${
            !showWizard && !showWelcomeModal && shouldShowResumeBanner && !resumeBannerDismissed
              ? 'onboarding-active-shell'
              : ''
          }`}
        >
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
