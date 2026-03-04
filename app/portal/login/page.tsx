/**
 * Phase 32: Enterprise Portal Login Page
 *
 * Unified login page with Personal/Organization mode selection.
 * Checks PORTAL_ENABLED environment variable to show/hide organization login.
 *
 * AUTHENTICATION: Redirects to main /signin for authentication, then returns
 * to portal dashboard after successful login.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function PortalLoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [checkingPortal, setCheckingPortal] = useState(true);

  // Check if portal is enabled via API
  useEffect(() => {
    async function checkPortalEnabled() {
      try {
        const response = await fetch('/api/portal/status');
        if (response.ok) {
          const data = await response.json();
          setPortalEnabled(data.enabled);
        }
      } catch {
        // If API fails, assume portal is disabled
        setPortalEnabled(false);
      } finally {
        setCheckingPortal(false);
      }
    }
    checkPortalEnabled();
  }, []);

  // If already authenticated, redirect to portal dashboard
  useEffect(() => {
    if (!isLoading && user && portalEnabled) {
      router.push('/portal/dashboard');
    }
  }, [user, isLoading, portalEnabled, router]);

  // Handle organization login click - redirect to portal signin page
  const handleOrganizationLogin = () => {
    router.push('/portal/signin');
  };

  // Show loading while checking auth or portal status
  if (isLoading || checkingPortal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-md w-full p-8">
        {/* Portal Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          {/* Logo placeholder */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4">
              <span className="text-white text-2xl font-bold">M</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Monitrax Portal</h1>
            <p className="text-slate-500 mt-2">Enterprise Portal for Advisors</p>
          </div>

          {/* Feature Flag Notice - Only show if portal is NOT enabled */}
          {!portalEnabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-amber-600 text-xl">⚠️</span>
                <div>
                  <p className="text-amber-800 font-medium text-sm">Portal Not Yet Active</p>
                  <p className="text-amber-700 text-sm mt-1">
                    The Enterprise Portal is currently under development.
                    Please check back soon or contact support for early access.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Already logged in notice */}
          {user && portalEnabled && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-green-600 text-xl">✓</span>
                <div>
                  <p className="text-green-800 font-medium text-sm">Already Signed In</p>
                  <p className="text-green-700 text-sm mt-1">
                    Signed in as {user.email}. Redirecting to portal...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Mode Selection */}
          <div className="space-y-4">
            <div className="text-center text-sm text-slate-500 mb-4">
              Select your login type:
            </div>

            {/* Personal Login Button */}
            <a
              href="/signin"
              className="block w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg text-center font-medium text-slate-700 transition-colors border border-slate-200"
            >
              Personal Account Login
            </a>

            {/* Organization Login Button - Enabled when portal is active */}
            {portalEnabled ? (
              <button
                onClick={handleOrganizationLogin}
                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-medium text-white transition-colors"
              >
                Organization Portal Login
              </button>
            ) : (
              <button
                disabled
                className="block w-full py-3 px-4 bg-blue-50 rounded-lg text-center font-medium text-blue-400 cursor-not-allowed border border-blue-100"
              >
                Organization Portal Login
                <span className="block text-xs text-blue-300 mt-1">Coming Soon</span>
              </button>
            )}
          </div>

          {/* Footer Links */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
            {!portalEnabled && (
              <p>
                Interested in the Enterprise Portal?{' '}
                <a href="/portal/register" className="text-blue-600 hover:underline">
                  Register Your Organization
                </a>
              </p>
            )}
            {portalEnabled && (
              <>
                <p>
                  Don&apos;t have an organization?{' '}
                  <a href="/portal/register" className="text-blue-600 hover:underline">
                    Register Now
                  </a>
                </p>
                <p className="mt-2">
                  Need help?{' '}
                  <a href="/support" className="text-blue-600 hover:underline">
                    Contact Support
                  </a>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Version Info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          Phase 32: Enterprise Portal • v0.1.0
        </div>
      </div>
    </div>
  );
}
