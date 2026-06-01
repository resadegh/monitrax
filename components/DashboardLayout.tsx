'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useUISyncEngine } from '@/hooks/useUISyncEngine';
import { GlobalWarningRibbon } from '@/components/warnings/GlobalWarningRibbon';
import { BasiqGateProvider } from '@/lib/featureFlags/BasiqGateContext';
import AiChatButton from '@/components/AiChatButton';
import { HelpDrawerButton } from '@/components/help/HelpDrawerButton';
import { FeedbackButton } from '@/components/help/FeedbackButton';
import { UniversalSearch, useUniversalSearch } from '@/components/UniversalSearch';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import {
  OnboardingWelcomeModal,
  GuidedTour,
  WizardContainer,
  OnboardingResumeBanner,
  WizardData,
} from '@/components/onboarding';
// Phase 14.6 (2026-05-08) — TRAIL nav SSOT + the legacy mobile sub-tab pills.
// SectionTabsRow stays — it shows the active section's child routes (e.g.
// Balances · Activity · My Structure under My Accounts) and is independent
// of the chrome swap. MoreSheet is the overflow drawer for phones,
// triggered from the editorial bottom nav's "More" cell.
import { SectionTabsRow } from '@/components/shell/SectionTabsRow';
import { MoreSheet } from '@/components/shell/MoreSheet';
import { ConsentMigrationModal } from '@/components/auth/ConsentMigrationModal';
// Phase R2b (2026-05-27) — Restrained Editorial shell. The sidebar +
// topbar + bottom nav swap in here; every other DashboardLayout
// concern (providers, modals, onboarding, floating buttons,
// SectionTabsRow, MoreSheet) is preserved unchanged. The legacy
// mobile <header> + desktop <aside> + <MobileTabBar /> are removed
// (only the chrome — not the functionality, which the editorial
// primitives provide). See PR #904 + .stitch/designs/dashboard-*.
import {
  EditorialAppShell,
  EditorialSidebar,
  EditorialTopBar,
  EditorialBottomNav,
} from '@/components/editorial';

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

  // Phase R2b (2026-05-27): the pending-reconciliation badge that used to
  // sit on the sidebar's "My Accounts" row is temporarily dropped while
  // we ship the editorial chrome. The hook (`usePendingReconciliationCount`)
  // remains available and is still used elsewhere — the badge re-attaches
  // once EditorialNavRow learns a `badge` prop (tracked in
  // IMPLEMENTATION_PLAN.md). The signal isn't lost; only the visual
  // affordance moves.

  // Universal search
  const { open: searchOpen, setOpen: setSearchOpen } = useUniversalSearch();

  // Phase 12: Onboarding state
  const {
    state: onboardingState,
    shouldShowWelcome,
    shouldShowResumeBanner,
    dismissWelcomeModal,
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

  // Phase 12 Track F (2026-05-20): the auto-route-incomplete-users-from-
  // /dashboard-to-/onboarding effect was REMOVED here. It made the
  // wizard inescapable — any incomplete-onboarding user with a saved
  // draft who landed on /dashboard (including via the wizard's own
  // "Exit" button) was immediately `router.push`'d back to /onboarding.
  // An infinite loop with no way out.
  //
  // It was also redundant: `<OnboardingResumeBanner>` ("Continue your
  // TRAIL", with a Resume button) already renders on /dashboard for
  // exactly the returning-incomplete-user case — gently, visibly, and
  // dismissable. That banner IS the SSOT affordance for "you have
  // setup to finish". Forcibly hijacking navigation on top of it was
  // both user-hostile (traps the user) and a duplicate.
  //
  // Returning incomplete users now land on /dashboard, see the resume
  // banner, and choose for themselves whether to continue setup or
  // browse the app. Truly fresh users still get the welcome modal.

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
      // Track G.3c: `bulk-create` is retired. Every domain wrote itself
      // to the real tables via its step's commit (Track F + G.3a);
      // `completeOnboarding` calls the `/api/onboarding/complete`
      // finaliser — marks completion + the cross-domain wiring (G.3b).
      // `clearDraft` wipes `UserPreference.onboardingDraft`.
      await completeOnboarding(wizardData);
      await clearDraft();
      setShowWizard(false);

      // Full page reload to ensure client components refetch data
      // (router.refresh() only invalidates the server-component cache).
      window.location.reload();
    } catch (e) {
      console.error('Could not complete wizard:', e);
      // Still close the wizard — onboarding completion is best-effort here.
      setShowWizard(false);
    }
  }, [clearDraft, completeOnboarding]);

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
    <BasiqGateProvider>
      {/* Phase 47 PR 2 — Existing-user consent migration modal.
          Fires for any authenticated user lacking current-version Terms /
          Privacy / AFSL acceptance. Non-dismissible until accepted;
          fail-safe on API trouble (skips modal, retries next page load). */}
      <ConsentMigrationModal />

      {/* Phase 9.5 — Global Warning Ribbon. Renders ABOVE the editorial
          shell so it spans the full viewport width on both mobile and
          desktop. */}
      {syncState.warningRibbon.show && (
        <GlobalWarningRibbon
          config={syncState.warningRibbon}
          health={syncState.health}
          dismissible={true}
        />
      )}

      {/* Phase R2b (2026-05-27) — Restrained Editorial app shell.
          Composes EditorialSidebar (desktop) + EditorialTopBar
          (responsive, wired to UniversalSearch + MoreSheet) +
          EditorialBottomNav (mobile, "More" cell opens MoreSheet) around
          <main>. The `onboarding-active-shell` class lights the content
          column with a subtle sky tint while the user has an unfinished
          wizard draft (same gating boolean as the persistent resume
          banner — single source of truth, see
          `useOnboardingState.shouldShowResumeBanner`). The CSS lives in
          styles/wizard-animations.css under "ONBOARDING ACTIVE SHELL". */}
      <div className="flex min-h-screen bg-editorial-ivory text-editorial-ink">
        <EditorialSidebar
          user={{ name: user.name, email: user.email }}
          onSignOut={logout}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <EditorialTopBar
            user={{ name: user.name, email: user.email }}
            onSearchClick={() => setSearchOpen(true)}
            onAvatarClick={() => setMoreSheetOpen(true)}
            chromeButtons={
              // Inline AI / Feedback / Help buttons sit in the topbar's
              // right cluster on desktop (resolves the bubble-vs-search
              // collision flagged 2026-06-01). Order matches the legacy
              // floating layout: 💬 feedback · 🤖 AI · ? help. Hidden
              // when onboarding modals are open so they don't compete
              // with the wizard's controls.
              !showWelcomeModal && !showWizard ? (
                <>
                  <FeedbackButton placement="inline" />
                  <AiChatButton placement="inline" />
                  <HelpDrawerButton audiences={['consumer', 'compliance']} placement="inline" />
                </>
              ) : null
            }
          />

          <main
            data-tour="main-content"
            className={`flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6 ${
              !showWizard && !showWelcomeModal && shouldShowResumeBanner && !resumeBannerDismissed
                ? 'onboarding-active-shell'
                : ''
            }`}
          >
            <div className="mx-auto max-w-7xl">
              {/* Phase 14.6 — Sub-tab pill row (phones only). Renders
                  the active TRAIL section's sub-tabs so users reach a
                  sub-tab in ONE tap from the bottom bar, not two. */}
              <SectionTabsRow />

              {/* Phase 12 PR 2 — Resume banner for users with an
                  unfinished wizard draft. */}
              {!showWizard && !showWelcomeModal && shouldShowResumeBanner && !resumeBannerDismissed && (
                <OnboardingResumeBanner
                  currentStep={onboardingState?.currentStep ?? 0}
                  totalSteps={8}
                  onResume={handleResumeBannerResume}
                  onStartOver={handleResumeBannerStartOver}
                  onDismiss={handleResumeBannerDismiss}
                />
              )}

              {children}
            </div>
          </main>
        </div>

        <EditorialBottomNav onMoreClick={() => setMoreSheetOpen(true)} />
      </div>

      {/* MoreSheet — overflow nav for phones. Triggered by the editorial
          TopBar avatar AND the editorial BottomNav "More" cell. */}
      <MoreSheet
        open={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        user={{ name: user?.name, email: user?.email }}
        onSignOut={logout}
      />

      {/* Floating chrome — MOBILE ONLY (2026-06-01). On desktop these
          three buttons are rendered inline inside `EditorialTopBar`'s
          right cluster via the `chromeButtons` slot above. The mobile
          `<header className="md:hidden">` doesn't reserve space for
          them in its right area, so they keep the fixed-top-right
          floating treatment. Hidden while onboarding modals are open
          so they don't overlap the wizard's controls. */}
      {!showWelcomeModal && !showWizard && (
        <div className="md:hidden">
          <AiChatButton />
          <HelpDrawerButton audiences={['consumer', 'compliance']} />
          <FeedbackButton />
        </div>
      )}

      {/* Universal Search modal — wired to the editorial TopBar search
          pill via `setSearchOpen`. */}
      <UniversalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Phase 12 — Onboarding components (welcome modal, guided tour,
          wizard). Unchanged from the pre-editorial shell — all data
          flow + handlers above are preserved as-is. */}
      <OnboardingWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleSkipOnboarding}
        onStartSetup={handleStartSetup}
        onTakeTour={handleTakeTour}
        onSkip={handleSkipOnboarding}
        onDismissPermanently={dismissWelcomeModal}
      />

      <GuidedTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        onDismissPermanently={dismissWelcomeModal}
      />

      <WizardContainer
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
        initialData={hydratedDraft}
        initialStepIndex={hydratedStepIndex}
        onAutoSave={handleWizardAutoSave}
      />
    </BasiqGateProvider>
  );
}
