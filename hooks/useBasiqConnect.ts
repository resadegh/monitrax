'use client';

/**
 * useBasiqConnect — shared Basiq "Connect Bank" hook.
 *
 * Phase 1c of accounts/loans-page retirement (CHANGELOG_2026_04_29).
 *
 * The legacy `/dashboard/accounts` page held the canonical
 * `handleConnectBank()` implementation. This hook lifts the **connect-only**
 * portion (the part that opens a Basiq consent window) into a single
 * source of truth so the Balances page can call exactly the same code.
 *
 * Sync and disconnect flows stay on the legacy page for now — they're
 * tied to a list of existing connections and a richer management UI
 * that Phase 2 will migrate alongside the legacy page retirement.
 *
 * Body shape, headers, error-recovery branches, and copy preserved
 * EXACTLY from the legacy implementation per user direction
 * (no behavioural change).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export interface UseBasiqConnect {
  /** True while the consent URL is being requested. Disable the trigger button on this. */
  isConnecting: boolean;
  /** Kick off the Basiq connect flow. Opens the consent URL in a new window. */
  connectBank: () => Promise<void>;
}

export function useBasiqConnect(): UseBasiqConnect {
  const { token } = useAuth();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  const connectBank = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Connect using profile mobile from user settings — preserved
      // verbatim from /dashboard/accounts/page.tsx#handleConnectBank.
      const response = await fetch('/api/basiq/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const result = await response.json();
        // Open Basiq consent URL in new window
        window.open(result.data.consentUrl, '_blank', 'width=600,height=700');
        // Show message to user
        alert(
          'A new window has opened for you to connect your bank. After connecting, click "Sync" to import your accounts.'
        );
      } else {
        const error = await response.json();
        // If mobile is required, redirect to profile settings
        if (error.error?.code === 'MOBILE_REQUIRED') {
          const shouldRedirect = confirm(
            'To connect your bank, you need to add your Australian mobile number to your profile.\n\nClick OK to go to Profile Settings.'
          );
          if (shouldRedirect) {
            router.push('/dashboard/settings/profile');
          }
        } else {
          alert(
            `Failed to connect bank: ${error.error?.message || 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      console.error('Error connecting bank:', error);
      alert('Failed to connect bank. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [token, router]);

  return { isConnecting, connectBank };
}
