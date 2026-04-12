'use client';

/**
 * Phase 33: Support Tools Page
 *
 * User impersonation, access logs, and error tracking.
 * Uses real data from /api/admin/users for user lookup.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

interface UserSearchResult {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  subscription: {
    tier: string;
    status: string;
  };
}

const supportTools = [
  {
    title: 'User Impersonation',
    description: 'Login as a user to debug issues. All actions are logged.',
    href: `${ADMIN_ROUTES.SUPPORT}/impersonate`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: 'blue',
  },
  {
    title: 'Access Logs',
    description: 'View user and admin access logs across the platform.',
    href: `${ADMIN_ROUTES.SUPPORT}/logs`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'green',
  },
  {
    title: 'Error Logs',
    description: 'Track and diagnose application errors and exceptions.',
    href: `${ADMIN_ROUTES.SUPPORT}/logs?type=errors`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    color: 'red',
  },
  {
    title: 'Admin Audit Log',
    description: 'Review all admin actions and changes for compliance.',
    href: `${ADMIN_ROUTES.SETTINGS}?tab=audit`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: 'purple',
  },
];

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function SupportPage() {
  const router = useRouter();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchEmail.trim()) {
      setSearchError('Please enter an email address');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchEmail)}`, {
        
      });

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchEmail]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Support Tools"
        description="Debugging and troubleshooting tools for customer support"
      />

      {/* Quick User Lookup - moved to top for visibility */}
      <AdminCard className="mb-6">
        <AdminCardHeader
          title="Quick User Lookup"
          description="Search for a user by email to view their account"
        />
        <div className="flex gap-4 mb-4">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter user email..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <AdminButton onClick={handleSearch} disabled={searching}>
            {searching ? 'Searching...' : 'Look Up'}
          </AdminButton>
        </div>

        {searchError && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">{searchError}</p>
        )}

        {hasSearched && searchResults.length === 0 && !searching && !searchError && (
          <p className="text-gray-500 text-sm">No users found matching that email.</p>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.name || 'Unnamed User'}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <TierBadge tier={user.subscription.tier} size="sm" />
                  <AdminBadge
                    variant={user.subscription.status === 'active' ? 'success' : 'error'}
                    size="sm"
                  >
                    {user.subscription.status}
                  </AdminBadge>
                  <AdminButton
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(ADMIN_ROUTES.USER_DETAIL(user.id))}
                  >
                    View
                  </AdminButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {supportTools.map((tool) => (
          <Link key={tool.title} href={tool.href}>
            <AdminCard className="h-full hover:border-blue-500 transition-colors cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${colorClasses[tool.color]}`}>
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {tool.description}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </AdminCard>
          </Link>
        ))}
      </div>
    </AdminFeatureGate>
  );
}
