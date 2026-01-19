/**
 * Phase 32: Portal Invitation Acceptance Page
 *
 * Handles invitation tokens for new organization members.
 * - Validates the invitation token
 * - Allows new users to create an account
 * - Allows existing users to accept the invitation
 * - Adds user to the organization upon acceptance
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

interface InvitationDetails {
  id: string;
  email: string;
  organizationName: string;
  organizationLogo?: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  userExists: boolean;
}

type Step = 'loading' | 'error' | 'login' | 'register' | 'success';

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { user, login, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // Validate invitation on mount
  useEffect(() => {
    validateInvitation();
  }, [token]);

  // If user is already logged in, try to accept automatically
  useEffect(() => {
    if (!authLoading && user && invitation) {
      if (user.email.toLowerCase() === invitation.email.toLowerCase()) {
        // Auto-accept for logged in user with matching email
        acceptInvitation();
      } else {
        // Wrong account logged in
        setError(`You're logged in as ${user.email}, but this invitation is for ${invitation.email}`);
        setStep('login');
      }
    }
  }, [authLoading, user, invitation]);

  const validateInvitation = async () => {
    try {
      const response = await fetch(`/api/portal/invitations/${token}/validate`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Invalid or expired invitation');
        setStep('error');
        return;
      }

      setInvitation(data.invitation);
      setEmail(data.invitation.email);

      // Determine next step
      if (data.invitation.userExists) {
        setStep('login');
      } else {
        setStep('register');
      }
    } catch (err) {
      setError('Failed to validate invitation. Please try again.');
      setStep('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      // After login, accept the invitation
      await acceptInvitation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create account and accept invitation in one call
      const response = await fetch(`/api/portal/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          password,
          createAccount: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create account');
      }

      // Store auth token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setStep('success');

      // Redirect to portal after a moment
      setTimeout(() => {
        router.push('/portal/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setIsSubmitting(false);
    }
  };

  const acceptInvitation = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch(`/api/portal/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ createAccount: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to accept invitation');
      }

      setStep('success');

      // Redirect to portal after a moment
      setTimeout(() => {
        router.push('/portal/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setIsSubmitting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      PORTAL_OWNER: 'Owner',
      PORTAL_ADMIN: 'Administrator',
      PORTAL_ADVISOR: 'Advisor',
      PORTAL_VIEWER: 'Viewer',
    };
    return labels[role] || role;
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <XIcon className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
          <p className="text-slate-400 mb-8">{error}</p>
          <div className="space-y-3">
            <Link
              href="/portal/signin"
              className="block w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Portal Sign In
            </Link>
            <Link
              href="/portal/request-access"
              className="block w-full py-2.5 px-4 border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              Request Access
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to {invitation?.organizationName}!</h1>
          <p className="text-slate-400 mb-4">
            You&apos;ve successfully joined as {getRoleLabel(invitation?.role || '')}.
          </p>
          <p className="text-slate-500 text-sm">Redirecting to portal dashboard...</p>
        </div>
      </div>
    );
  }

  // Login or Register form
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
          {/* Organization Info */}
          <div className="text-center mb-8">
            {invitation?.organizationLogo ? (
              <img
                src={invitation.organizationLogo}
                alt={invitation.organizationName}
                className="w-16 h-16 rounded-xl mx-auto mb-4 object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">
                  {invitation?.organizationName?.charAt(0) || 'O'}
                </span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-white mb-2">
              Join {invitation?.organizationName}
            </h1>
            <p className="text-slate-400">
              You&apos;ve been invited to join as{' '}
              <span className="text-blue-400 font-medium">
                {getRoleLabel(invitation?.role || '')}
              </span>
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Invited by {invitation?.invitedBy}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {step === 'login' && (
              <>
                <p className="text-sm text-slate-600 mb-6">
                  An account exists for <strong>{invitation?.email}</strong>. Sign in to accept the invitation.
                </p>
                <form onSubmit={handleLogin} className="space-y-5">
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
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50"
                      disabled
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Enter your password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign in & Accept Invitation'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                    Forgot your password?
                  </Link>
                </div>
              </>
            )}

            {step === 'register' && (
              <>
                <p className="text-sm text-slate-600 mb-6">
                  Create your account to join <strong>{invitation?.organizationName}</strong>.
                </p>
                <form onSubmit={handleRegister} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50"
                      disabled
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="At least 8 characters"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Confirm your password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? 'Creating account...' : 'Create Account & Join'}
                  </button>
                </form>

                <p className="mt-4 text-xs text-slate-500 text-center">
                  By creating an account, you agree to our{' '}
                  <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
