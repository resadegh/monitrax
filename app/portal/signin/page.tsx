/**
 * Phase 32: Portal Sign In Page
 *
 * Dedicated login page for organization portal users.
 * Uses the same authentication backend but with portal-specific UI.
 * After login, verifies user has organization access.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function PortalSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, login, logout, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/portal/dashboard';
  const inviteToken = searchParams.get('invite');

  // If already logged in, check organization access. Wait until the Firebase
  // ID token has been resolved by AuthContext — without it the fetch below
  // sends `Authorization: Bearer null` and the API returns 401, which the
  // catch-all renders as "Failed to verify organization access".
  useEffect(() => {
    if (!authLoading && user && token) {
      checkOrganizationAccess();
    }
  }, [authLoading, user, token]);

  const checkOrganizationAccess = async () => {
    setCheckingAccess(true);
    try {
      const response = await fetch('/api/portal/organizations', {
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.organizations && data.organizations.length > 0) {
          // User has organization access, redirect to portal
          router.push(redirectTo);
        } else {
          // User exists but has no organization access
          setError('You do not have access to any organization. Please contact your administrator or request access.');
          setCheckingAccess(false);
        }
      } else {
        setError('Failed to verify organization access. Please try again.');
        setCheckingAccess(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setCheckingAccess(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // The useEffect on [authLoading, user, token] will fire
      // checkOrganizationAccess() once AuthContext has the ID token. Calling
      // it synchronously here would race the token-state update.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
      setIsLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading || checkingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">
            {checkingAccess ? 'Verifying access...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-white">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="font-bold text-sm">M</span>
          </div>
          <span className="font-semibold">Monitrax</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Portal Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-4">
              <BuildingIcon className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400">Enterprise Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Sign in to your organization
            </h1>
            <p className="text-slate-400">
              Access your organization&apos;s client management portal
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Invitation Notice */}
            {inviteToken && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>You&apos;ve been invited!</strong> Sign in or create an account to join the organization.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* If user is logged in but has no access */}
            {user && error && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Logged in as <strong>{user.email}</strong>
                </p>
                <button
                  onClick={() => {
                    // Sign out of Firebase before reloading. Without this the
                    // useAuth() listener still reports a signed-in user and
                    // the useEffect re-fires the access check, bouncing the
                    // user straight back to this same screen.
                    logout();
                    window.location.reload();
                  }}
                  className="w-full py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Sign in with a different account
                </button>
                <div className="text-center">
                  <Link
                    href="/portal/request-access"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Request organization access
                  </Link>
                </div>
              </div>
            )}

            {/* Login Form (show if not logged in or no error) */}
            {(!user || !error) && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Signing in...
                    </span>
                  ) : (
                    'Sign in to Portal'
                  )}
                </button>
              </form>
            )}

            {/* Divider */}
            {(!user || !error) && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">New to Monitrax?</span>
                  </div>
                </div>

                {/* Register / Request Access */}
                <div className="space-y-3 text-center text-sm text-slate-600">
                  <p>
                    <Link href="/portal/register" className="text-blue-600 hover:text-blue-700 font-medium">
                      Register your organization
                    </Link>
                    {' '}to get started
                  </p>
                  <p>
                    Already have an organization? Contact your administrator for an invitation, or{' '}
                    <Link href="/portal/request-access" className="text-blue-600 hover:text-blue-700 font-medium">
                      request access
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer Links */}
          <div className="mt-8 text-center space-y-2">
            <p className="text-sm text-slate-400">
              Looking for the main app?{' '}
              <Link href="/signin" className="text-blue-400 hover:text-blue-300">
                Sign in here
              </Link>
            </p>
            <p className="text-sm text-slate-500">
              <Link href="/portal/login" className="hover:text-slate-400">
                Back to portal home
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Monitrax. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// Icons
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
