/**
 * Phase 32: Portal Feature Gate Component
 *
 * A component that conditionally renders children based on feature flags.
 * Used to safely enable/disable portal features without code changes.
 */

'use client';

import { ReactNode } from 'react';

interface PortalFeatureGateProps {
  feature: string;
  enabled?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Feature Gate Component
 *
 * Renders children only if the specified feature is enabled.
 * Shows fallback content (or nothing) when feature is disabled.
 *
 * Usage:
 * ```tsx
 * <PortalFeatureGate feature="clientManagement">
 *   <ClientList />
 * </PortalFeatureGate>
 * ```
 */
export function PortalFeatureGate({
  feature,
  enabled = false,
  children,
  fallback,
}: PortalFeatureGateProps) {
  // In client components, we receive the enabled state as a prop
  // This is computed on the server using getPortalFeatureFlags()

  if (!enabled) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  return <>{children}</>;
}

/**
 * Feature Unavailable Component
 *
 * A standard component to display when a feature is not available.
 */
export function FeatureUnavailable({
  title = 'Feature Not Available',
  message = 'This feature is not currently enabled for your organization.',
  showContactLink = true,
}: {
  title?: string;
  message?: string;
  showContactLink?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mx-auto">{message}</p>
      {showContactLink && (
        <p className="mt-4 text-sm text-slate-400">
          Need access?{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Contact your administrator
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * Coming Soon Component
 *
 * A standard component to display for features still in development.
 */
export function ComingSoon({
  title = 'Coming Soon',
  message = 'This feature is currently under development and will be available soon.',
  expectedPhase,
}: {
  title?: string;
  message?: string;
  expectedPhase?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <div className="w-12 h-12 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mx-auto">{message}</p>
      {expectedPhase && (
        <p className="mt-4 text-xs text-slate-400">Expected in: {expectedPhase}</p>
      )}
    </div>
  );
}

/**
 * Portal Access Denied Component
 *
 * Displayed when a user doesn't have access to the portal.
 */
export function PortalAccessDenied({
  reason = 'default',
}: {
  reason?: 'not_enabled' | 'not_member' | 'insufficient_role' | 'default';
}) {
  const messages = {
    not_enabled: {
      title: 'Portal Not Enabled',
      message:
        'The Enterprise Portal is not enabled for your organization. Contact your administrator to enable portal access.',
    },
    not_member: {
      title: 'Access Denied',
      message:
        "You are not a member of this organization. If you believe this is an error, please contact the organization administrator.",
    },
    insufficient_role: {
      title: 'Insufficient Permissions',
      message:
        'You do not have permission to access this feature. Contact your administrator for access.',
    },
    default: {
      title: 'Access Denied',
      message: 'You do not have access to this resource.',
    },
  };

  const { title, message } = messages[reason];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full p-8">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500">{message}</p>
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
