'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Small delay to ensure searchParams are fully populated after hydration
    const timer = setTimeout(() => {
      const token = searchParams.get('token');
      const userParam = searchParams.get('user');

      if (token && userParam) {
        try {
          const user = JSON.parse(userParam);

          // Store in localStorage synchronously
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));

          // Verify storage was successful
          const storedToken = localStorage.getItem('token');
          if (storedToken !== token) {
            throw new Error('Failed to store authentication data');
          }

          setStatus('success');

          // Use replace to prevent back-navigation to this callback page
          // Small delay to ensure localStorage is fully persisted
          setTimeout(() => {
            window.location.replace('/dashboard');
          }, 100);
        } catch (error) {
          console.error('OAuth callback error:', error);
          setStatus('error');
          setErrorMessage('Failed to complete sign in. Please try again.');
          setTimeout(() => {
            router.replace('/signin?error=oauth_failed');
          }, 2000);
        }
      } else {
        // Check if we're still waiting for params (hydration)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const urlUser = urlParams.get('user');

        if (urlToken && urlUser) {
          // Params exist in URL but not in searchParams yet - retry
          return;
        }

        setStatus('error');
        setErrorMessage('Missing authentication data. Redirecting to sign in...');
        setTimeout(() => {
          router.replace('/signin?error=missing_token');
        }, 2000);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [searchParams, router]);

  return (
    <div className="bg-card p-8 rounded-lg shadow-lg text-center border border-border">
      {status === 'processing' && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Completing sign in...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-foreground font-medium">Sign in successful!</p>
          <p className="text-muted-foreground text-sm mt-1">Redirecting to dashboard...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-destructive font-medium">{errorMessage}</p>
        </>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-primary">
      <Suspense fallback={
        <div className="bg-card p-8 rounded-lg shadow-lg text-center border border-border">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }>
        <OAuthCallbackContent />
      </Suspense>
    </div>
  );
}
