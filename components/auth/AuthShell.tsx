/**
 * Public-side auth shell — single-column dark Deep Cosmos chrome.
 *
 * Phase 48 PR 6 (2026-05-26). Shared wrapper for `/signin`, `/register`,
 * `/verify-email`, `/resend-verification` (and any future auth surface).
 * Single-column centred form, subtle radial emerald glow, consistent
 * brand mark + footer with legal links. Built from the Stitch canonical
 * `signin` + `register` screens.
 *
 * Composes: cosmos-* tokens + cosmos-glass + cosmos-glow-center (PR 1).
 *
 * Behavioural contract — this component is presentational only. It
 * does NOT touch any auth state, AuthContext, or form handlers. The
 * consuming page passes its form (or any other content) as `children`.
 * This is intentional — keeps auth logic in one place per page and
 * preserves the existing state machines / MFA paths / OAuth flows.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthShellProps = {
  /** Heading shown above the form panel. */
  title: string;
  /** Optional subtitle / sub-link. */
  subtitle?: ReactNode;
  /** Optional small line above the title (e.g. "Welcome back."). */
  eyebrow?: string;
  /** The form / content. Rendered inside a `cosmos-glass` panel. */
  children: ReactNode;
  /** Optional content rendered after the main panel (legal disclaimer, etc.). */
  belowPanel?: ReactNode;
};

export function AuthShell({ title, subtitle, eyebrow, children, belowPanel }: AuthShellProps) {
  return (
    <div className="cosmos-glow-center relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cosmos px-6 py-12">
      <main className="relative z-10 flex w-full max-w-[440px] flex-col">
        {/* Brand header */}
        <header className="mb-10 flex flex-col items-center">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="Monitrax — home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cosmos-action/30 bg-cosmos-action/15">
              <span className="text-xl font-bold tracking-tight text-cosmos-action">M</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-cosmos">Monitrax</span>
          </Link>
          {eyebrow ? <p className="text-sm text-cosmos-muted">{eyebrow}</p> : null}
        </header>

        {/* Form panel */}
        <section className="cosmos-glass rounded-2xl p-8 md:p-10">
          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-cosmos">{title}</h1>
            {subtitle ? <div className="text-sm text-cosmos-soft">{subtitle}</div> : null}
          </div>
          {children}
        </section>

        {belowPanel ? <div className="mt-6">{belowPanel}</div> : null}

        {/* Footer */}
        <footer className="mt-10 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-cosmos-muted">
            <Link
              href="/legal/terms-of-service"
              className="transition-colors hover:text-cosmos"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/privacy-policy"
              className="transition-colors hover:text-cosmos"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/afsl-credit-tax-boundary-disclosure"
              className="transition-colors hover:text-cosmos"
            >
              AFSL
            </Link>
          </div>
          <p className="text-xs text-cosmos-faint">
            © {new Date().getFullYear()} Monitrax. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}

/**
 * Standard auth-form label. Use this for every <input> label in the
 * auth surfaces — uppercase tracking + cosmos-soft colour vocabulary.
 */
export function AuthLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-cosmos-soft"
    >
      {children}
    </label>
  );
}

/**
 * Standard auth-form primary submit button. Renders as the emerald
 * cosmos-cta pill with a built-in loading spinner.
 */
export function AuthSubmit({
  children,
  isLoading,
  disabled,
  loadingLabel = 'Working...',
}: {
  children: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={isLoading || disabled}
      className="cosmos-cta inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Standard auth-form secondary (OAuth / ghost) button. Translucent
 * cosmos-surface fill with hairline border, 48px tall to match
 * the primary submit.
 */
export function AuthGhostButton({
  children,
  onClick,
  disabled,
  type = 'button',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-cosmos-hairline bg-cosmos-surface/50 text-sm font-medium text-cosmos transition-colors hover:bg-cosmos-elevated disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Standard "Or continue with" divider for auth forms.
 */
export function AuthDivider({ label = 'Or continue with' }: { label?: string }) {
  return (
    <div className="relative py-2">
      <div aria-hidden="true" className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-cosmos-hairline" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-cosmos-surface/80 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-cosmos-muted backdrop-blur-sm">
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Standard auth error banner.
 */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      {children}
    </div>
  );
}

/**
 * Standard auth info banner (e.g. session-expired notice).
 */
export function AuthInfo({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
    >
      {children}
    </div>
  );
}
