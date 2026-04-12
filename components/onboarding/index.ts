// Phase 12: Onboarding Components
export { GuidedTour, monitraxTourSteps } from './GuidedTour';
export { TourSpotlight } from './TourSpotlight';
export { TourTooltip } from './TourTooltip';
export { OnboardingWelcomeModal } from './OnboardingWelcomeModal';
export { OnboardingProgressBadge } from './OnboardingProgressBadge';

// Phase 12 PR 2: Resume banner for users with an unfinished wizard draft.
export { OnboardingResumeBanner } from './OnboardingResumeBanner';

// Enhanced Setup Wizard v2.0 (the live wizard — see WizardContainer.tsx).
// The legacy InitialSetupWizard + ./steps/* were removed in PR1 correctness
// sweep (docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_CORRECTNESS.md).
export { WizardContainer } from './wizard';
export * from './wizard/types';
