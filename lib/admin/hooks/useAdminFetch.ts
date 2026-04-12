/**
 * useAdminFetch — Shared admin API fetch helper
 *
 * Automatically sends the Firebase ID token with every request as
 * Authorization: Bearer <token>. Replaces the old cookie-based auth
 * that broke after the Phase M.1 migration.
 *
 * Usage:
 *   const fetchAdmin = useAdminFetch();
 *   const res = await fetchAdmin('/api/admin/dashboard');
 */

'use client';

import { useCallback } from 'react';
import { getFirebaseAuth } from '@/lib/firebase/config';

export function useAdminFetch() {
  return useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      } catch {
        // Token fetch failed — request will proceed and get 401
      }
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }, []);
}
