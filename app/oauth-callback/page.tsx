'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (token && userParam) {
      try {
        const user = JSON.parse(userParam);

        // Store in localStorage (same as regular login)
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        console.error('OAuth callback error:', error);
        router.push('/signin?error=oauth_failed');
      }
    } else {
      router.push('/signin?error=missing_token');
    }
  }, [searchParams, router]);

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Completing sign in...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Suspense fallback={
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      }>
        <OAuthCallbackContent />
      </Suspense>
    </div>
  );
}
