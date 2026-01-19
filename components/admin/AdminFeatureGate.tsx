'use client';

/**
 * Phase 33: Admin Feature Gate Component
 *
 * Conditionally renders children based on admin feature flags.
 */

import React from 'react';
import { isAdminFeatureEnabled, type AdminFeatureFlags } from '@/lib/admin/featureFlags';

interface AdminFeatureGateProps {
  feature: keyof AdminFeatureFlags;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Gate component that only renders children if the feature is enabled
 */
export function AdminFeatureGate({ feature, children, fallback }: AdminFeatureGateProps) {
  const isEnabled = isAdminFeatureEnabled(feature);

  if (!isEnabled) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

/**
 * Feature unavailable placeholder
 */
export function FeatureUnavailable({ featureName }: { featureName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Feature Unavailable
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        The {featureName} feature is currently disabled. Contact your administrator to enable it.
      </p>
    </div>
  );
}

/**
 * Coming soon placeholder
 */
export function ComingSoon({ featureName }: { featureName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Coming Soon
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        The {featureName} feature is under development and will be available soon.
      </p>
    </div>
  );
}

/**
 * Access denied placeholder
 */
export function AdminAccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Access Denied
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        You do not have permission to access this feature. Contact your administrator for access.
      </p>
    </div>
  );
}
