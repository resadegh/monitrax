'use client';

/**
 * Phase 33: User Impersonation Page
 *
 * Allows support admins to impersonate users for debugging.
 * All impersonation sessions are logged and time-limited.
 *
 * Per CLAUDE.md: Impersonation requires reason and is audited.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface ImpersonationSession {
  id: string;
  adminUser: {
    name: string;
    email: string;
  };
  targetUserId: string;
  targetUserEmail?: string;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  actionsPerformed: string[];
}

interface UserSearchResult {
  id: string;
  email: string;
  name: string | null;
}

export default function ImpersonatePage() {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [reason, setReason] = useState('');
  const [recentSessions, setRecentSessions] = useState<ImpersonationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);

  const fetchRecentSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/audit?action=USER_IMPERSONATED&limit=20', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Transform audit logs to impersonation session format
        const sessions = (data.data || []).map((log: Record<string, unknown>) => ({
          id: log.id,
          adminUser: log.adminUser || { name: 'Unknown', email: '' },
          targetUserId: (log.metadata as Record<string, string>)?.targetUserId || '',
          targetUserEmail: (log.metadata as Record<string, string>)?.targetUserEmail || '',
          reason: (log.metadata as Record<string, string>)?.reason || log.description || '',
          startedAt: log.timestamp,
          endedAt: null,
          actionsPerformed: [],
        }));
        setRecentSessions(sessions);
      }
    } catch (err) {
      console.error('Failed to fetch impersonation sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentSessions();
  }, [fetchRecentSessions]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchEmail)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      }
    } catch (err) {
      setError('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleImpersonate = async () => {
    if (!selectedUser || !reason.trim()) {
      setError('Please select a user and provide a reason');
      return;
    }

    setImpersonating(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to start impersonation');
      }

      const data = await response.json();

      // Redirect to user's dashboard with impersonation token
      if (data.data?.redirectUrl) {
        window.open(data.data.redirectUrl, '_blank');
      } else {
        // Show success message
        setError(null);
        setSelectedUser(null);
        setReason('');
        fetchRecentSessions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start impersonation');
    } finally {
      setImpersonating(false);
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="User Impersonation"
        description="Login as a user to debug issues. All actions are logged."
      />

      {/* Warning Banner */}
      <AdminCard className="mb-6 border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Impersonation is a privileged action
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              All impersonation sessions are logged and audited. Sessions are limited to 1 hour maximum.
              A valid reason is required and will be recorded.
            </p>
          </div>
        </div>
      </AdminCard>

      {/* Impersonation Form */}
      <AdminCard className="mb-6">
        <AdminCardHeader
          title="Start Impersonation Session"
          description="Search for a user and provide a reason for impersonation"
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* User Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search User
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter user email..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <AdminButton onClick={handleSearch} disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </AdminButton>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select User
              </label>
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                    selectedUser?.id === user.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium">{user.name || 'Unnamed User'}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              ))}
            </div>
          )}

          {/* Selected User Display */}
          {selectedUser && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Selected User:</p>
              <p className="font-medium">{selectedUser.name || 'Unnamed User'} ({selectedUser.email})</p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Impersonation *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why you need to impersonate this user (required for audit)..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <AdminButton
              onClick={handleImpersonate}
              disabled={!selectedUser || !reason.trim() || impersonating}
            >
              {impersonating ? 'Starting Session...' : 'Start Impersonation'}
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {/* Recent Sessions */}
      <AdminCard padding="none">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <AdminCardHeader
            title="Recent Impersonation Sessions"
            description="Audit trail of all impersonation activity"
          />
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <AdminTable
            columns={[
              {
                key: 'startedAt',
                header: 'Time',
                render: (s) => new Date(s.startedAt).toLocaleString('en-AU'),
              },
              {
                key: 'admin',
                header: 'Admin',
                render: (s) => s.adminUser?.name || 'Unknown',
              },
              {
                key: 'targetUserEmail',
                header: 'Target User',
              },
              {
                key: 'reason',
                header: 'Reason',
                render: (s) => (
                  <span className="text-sm truncate max-w-xs block">{s.reason}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (s) => (
                  <AdminBadge variant={s.endedAt ? 'success' : 'warning'} size="sm">
                    {s.endedAt ? 'Ended' : 'Active'}
                  </AdminBadge>
                ),
              },
            ]}
            data={recentSessions}
            keyExtractor={(s) => s.id}
            emptyMessage="No impersonation sessions recorded"
          />
        )}
      </AdminCard>
    </AdminFeatureGate>
  );
}
