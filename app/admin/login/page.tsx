'use client';

/**
 * Phase 33: Admin Login Page
 *
 * Login page for admin portal access.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Input } from '@/components/admin/ui/AdminForm';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mfaCode: showMfa ? mfaCode : undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requireMfa) {
          setShowMfa(true);
          return;
        }
        throw new Error(data.error?.message || 'Login failed');
      }

      // Redirect to dashboard on success
      router.push(ADMIN_ROUTES.DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Portal
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Sign in to access the Monitrax admin dashboard
          </p>
        </div>

        <AdminCard>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="admin@monitrax.com"
              required
              autoComplete="email"
              disabled={showMfa}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              disabled={showMfa}
            />

            {showMfa && (
              <Input
                label="MFA Code"
                type="text"
                value={mfaCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMfaCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                autoComplete="one-time-code"
                maxLength={6}
              />
            )}

            <AdminButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              {showMfa ? 'Verify' : 'Sign in'}
            </AdminButton>
          </form>

          {showMfa && (
            <button
              type="button"
              onClick={() => {
                setShowMfa(false);
                setMfaCode('');
              }}
              className="w-full mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Use a different account
            </button>
          )}
        </AdminCard>

        {/* Security notice */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
          This portal is for authorized Monitrax staff only.
          <br />
          All access is logged and monitored.
        </p>
      </div>
    </div>
  );
}
