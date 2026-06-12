'use client';

/**
 * Phase 33: User Lookup (formerly "User Impersonation")
 *
 * 2026-06-12: the Impersonate action was removed — it called
 * `POST /api/admin/users/:userId/impersonate`, an endpoint that was never
 * built, so every click 404'd. Impersonation needs its own design pass
 * (time-boxed read-only sessions, full audit trail, CDR exposure) before it
 * ships — tracked in docs/IMPLEMENTATION_PLAN.md § Up Next. Until then this
 * page is an honest support tool: find a user, open their real profile
 * (/admin/users/[userId]) for account state, activity, and suspend actions.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Input } from '@/components/admin/ui/AdminForm';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

interface UserSearchResult {
  id: string;
  email: string;
  name: string | null;
}

export default function ImpersonatePage() {
  const router = useRouter();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users?search=${encodeURIComponent(searchEmail)}`
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      } else {
        setError('Failed to search users');
      }
    } catch {
      setError('Failed to search users');
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="User Lookup"
        description="Find a user and open their profile for support actions."
      />

      {/* Impersonation status notice */}
      <AdminCard className="mb-6 border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Impersonation is not available yet
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Signing in as a user requires a dedicated, fully-audited flow that
              hasn&apos;t been built. For support work, open the user&apos;s
              profile — it shows their account state, subscription, last login,
              and recent activity, with suspend/reactivate actions.
            </p>
          </div>
        </div>
      </AdminCard>

      {/* Search */}
      <AdminCard className="mb-6">
        <AdminCardHeader title="Find User" description="Search by email or name" />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              value={searchEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchEmail(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="user@example.com"
            />
          </div>
          <AdminButton onClick={handleSearch} disabled={searching || !searchEmail.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </AdminButton>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {searched && !searching && searchResults.length === 0 && !error && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            No users matched that search.
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.name || 'Unnamed User'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(ADMIN_ROUTES.USER_DETAIL(user.id))}
                >
                  View profile →
                </AdminButton>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminFeatureGate>
  );
}
