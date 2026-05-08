'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wallet,
  LogOut,
  User,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUISyncEngine } from '@/hooks/useUISyncEngine';
import { GlobalWarningRibbon } from '@/components/warnings/GlobalWarningRibbon';
import { FinancialHealthMiniWidget } from '@/components/health/FinancialHealthMiniWidget';
import AiChatButton from '@/components/AiChatButton';
import { HelpDrawerButton } from '@/components/help/HelpDrawerButton';
import { FeedbackButton } from '@/components/help/FeedbackButton';
import { UniversalSearch, useUniversalSearch } from '@/components/UniversalSearch';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import {
  usePendingReconciliationCount,
  formatReconciliationCount,
} from '@/hooks/usePendingReconciliationCount';
import {
  OnboardingWelcomeModal,
  GuidedTour,
  WizardContainer,
  OnboardingProgressBadge,
  OnboardingResumeBanner,
  WizardData,
} from '@/components/onboarding';
// Phase 14.6 (2026-05-08) — TRAIL nav SSOT + mobile-first navigation primitives.
// See lib/navigation/trailNav.tsx, components/shell/MobileTabBar.tsx,
// components/shell/SectionTabsRow.tsx, components/shell/MoreSheet.tsx, and
// docs/architecture/06_UI_UX_FOUNDATION.md §12.
import {
  trailNavItems,
  settingsNavItem,
  isNavItemActive,
} from '@/lib/navigation/trailNav';
import { MobileTabBar } from '@/components/shell/MobileTabBar';
import { SectionTabsRow } from '@/components/shell/SectionTabsRow';
import { MoreSheet } from '@/components/shell/MoreSheet';

// =============================================================================
// TRAIL SIDEBAR — items defined in lib/navigation/trailNav.tsx (SSOT).
// Phase 14.6 (2026-05-08) — Same canonical list powers BOTH the desktop
// sidebar below AND the 5-tab MobileTabBar on phones. Never duplicate the
// nav structure here. See CLAUDE.md §12.2 (SSOT) + §6.2 (canonical
// utility locations).
// =============================================================================

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Phase 14.6 (2026-05-08) — Mobile More-sheet state. The legacy
  // `sidebarOpen` (hamburger drawer) is gone; phones use the bottom
  // tab bar (`<MobileTabBar />`) for primary nav and this sheet for
  // overflow (Safety Net, Household, Vault, Reports, Settings, Sign out).
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Phase 42 PR6.5e — Pending reconciliation count for the
  // sidebar badge on "My Accounts". Slack/Mail-style counter that
  // persists across pages so the user sees the recurring task
  // signal regardless of current route.
  const { count: pendingReconciliationCount } = usePendingReconciliationCount();
  const pendingReconciliationLabel = formatReconciliationCount(pendingReconciliationCount);

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

  // Close More sheet on route change (phones).
  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname]);

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

      {/* Phase 14.6 — Mobile header (phones only). Avatar opens MoreSheet
          for overflow nav (Safety Net, Household, Vault, Reports, Settings,
          Sign out). Primary nav lives in <MobileTabBar /> at the bottom. */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-brand-primary flex items-center justify-between px-4 shadow-lg">
        <button
          onClick={() => setMoreSheetOpen(true)}
          className="p-1 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="Open more menu"
          aria-haspopup="dialog"
          aria-expanded={moreSheetOpen}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white shadow-sm">
            <User className="h-4 w-4" />
          </span>
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
            className="p-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Search"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Phase 14.6 — Sidebar (tablets + desktop, ≥md). Phones use the
          bottom tab bar instead. The previous hamburger-drawer state
          (`sidebarOpen`) is gone; visibility is now purely a media query. */}
      <aside
        data-tour="sidebar"
        className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card shadow-lg flex-col"
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
          {/* Search and Theme toggle */}
          <div className="flex items-center gap-1">
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

        {/* Navigation — TRAIL framework (docs/blueprint/TRAIL_FRAMEWORK.md).
            Items sourced from lib/navigation/trailNav.tsx (SSOT). */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {trailNavItems.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <div key={item.href}>
                {/* Parent item */}
                <Link
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
                  {/* Phase 42 PR6.5e — Pending-reconciliation count badge.
                      Only renders on "My Accounts" (the surface where
                      uncategorised tx live) when count > 0. Slack/Mail
                      pattern: small amber pill, capped at "99+". */}
                  {item.name === 'My Accounts' && pendingReconciliationLabel && (
                    <span
                      aria-label={`${pendingReconciliationCount} unreconciled transaction${pendingReconciliationCount === 1 ? '' : 's'}`}
                      className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold tabular-nums bg-amber-500 text-white shadow-sm"
                    >
                      {pendingReconciliationLabel}
                    </span>
                  )}
                  {item.trailStage && (
                    <span className={`
                      flex h-7 w-7 items-center justify-center
                      rounded-lg text-xs font-bold
                      transition-colors duration-200
                      ${isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground/70'
                      }
                    `}>
                      {item.trailStage}
                    </span>
                  )}
                </Link>

                {/* Child items — visible when section is active */}
                {isActive && item.children && item.children.length > 0 && (
                  <div className="ml-[22px] mt-0.5 mb-1 pl-4 border-l-2 border-primary/20 space-y-0.5">
                    {item.children.map((child) => {
                      const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`
                            block rounded-lg px-3 py-1.5
                            text-[12px] font-medium
                            transition-all duration-150
                            ${isChildActive
                              ? 'text-primary bg-primary/5'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                            }
                          `}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Financial Health widget */}
          <div className="pt-3">
            <Separator className="mb-3" />
            <FinancialHealthMiniWidget />
          </div>
        </nav>

        {/* Bottom Section — Settings + User. Icon sourced from
            settingsNavItem.icon (lib/navigation/trailNav.tsx) so the
            sidebar and the More sheet on mobile both use the same glyph. */}
        {(() => {
          const SettingsIcon = settingsNavItem.icon;
          return (
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
                  <SettingsIcon className="h-4 w-4" />
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
          );
        })()}
      </aside>

      {/* Main Content — Phase 14.6 (2026-05-08).
          Sidebar offset and content padding now flip at `md:` (768px),
          not `lg:` (1024px) — iPad portrait gets the desktop sidebar
          rail instead of the phone layout. Bottom padding (`pb-24 md:pb-8`)
          reserves space for the fixed `<MobileTabBar />` on phones.

          `onboarding-active-shell` applies a subtle sky-blue ambient
          tint while the user has an unfinished wizard draft, giving
          the dashboard a "still in setup mode" cue that fades back to
          normal once onboarding completes. Same gating boolean as the
          persistent resume banner — single source of truth (see
          useOnboardingState.shouldShowResumeBanner). The CSS lives in
          styles/wizard-animations.css under "ONBOARDING ACTIVE SHELL". */}
      <div className="md:pl-64">
        <main
          className={`min-h-screen p-3 pt-16 pb-24 sm:p-4 sm:pt-20 sm:pb-24 md:p-8 md:pt-8 md:pb-8 ${
            !showWizard && !showWelcomeModal && shouldShowResumeBanner && !resumeBannerDismissed
              ? 'onboarding-active-shell'
              : ''
          }`}
        >
          <div className="mx-auto max-w-7xl">
            {/* Phase 14.6 — Sub-tab pill row (phones only). Renders the
                active TRAIL section's sub-tabs (e.g. Balances · Activity ·
                My Structure on My Accounts) so users reach a sub-tab in
                ONE tap from the bottom bar, not two. No-op on desktop and
                on sections without children. */}
            <SectionTabsRow />
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

      {/* Phase 14.6 — Mobile bottom tab bar (phones only). Persistent
          5-tab nav mapped to TRAIL stages: Home · Track · Reduce ·
          Invest · Guide. Anchor folds into More sheet per
          TRAIL_FRAMEWORK.md §5. */}
      <MobileTabBar />

      {/* Phase 14.6 — More sheet (phones only). Triggered by avatar
          button on the mobile header. Holds Safety Net, Household,
          Vault, Reports, Settings, Sign out. */}
      <MoreSheet
        open={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        user={{ name: user?.name, email: user?.email }}
        onSignOut={logout}
      />

      {/* AI Chat Floating Button — hidden when onboarding modals are open
           so it doesn't overlap the wizard's Back/Next buttons. */}
      {!showWelcomeModal && !showWizard && <AiChatButton />}

      {/* Phase 33b — In-app `?` help drawer. Hidden alongside AI Chat while
           onboarding modals are open so it doesn't overlap the wizard. The
           drawer itself is route-aware (lib/help/routeContext.ts) and
           audience-scoped — consumer dashboard sees consumer + compliance. */}
      {!showWelcomeModal && !showWizard && (
        <HelpDrawerButton audiences={['consumer', 'compliance']} />
      )}

      {/* Phase 33g.2 — Send-feedback floating button. Sits to the LEFT of
           the help drawer button. Opens the chat-style feedback drawer.
           AI-vs-form behaviour decided server-side via the
           ANTHROPIC_API_KEY env var presence — UI shape is identical
           either way; only the success message + AI typing indicator
           differ. Hidden alongside other floating chrome during onboarding. */}
      {!showWelcomeModal && !showWizard && <FeedbackButton />}

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
