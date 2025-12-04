'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided');
      return;
    }

    // Verify the email
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Verification failed');
        }
      })
      .catch((err) => {
        console.error('Verification error:', err);
        setStatus('error');
        setErrorMessage('An error occurred during verification');
      });
  }, [searchParams]);

  return (
    <div className="bg-card p-8 rounded-lg shadow-lg text-center border border-border max-w-md w-full">
      {status === 'verifying' && (
        <>
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Verifying your email...</h1>
          <p className="text-muted-foreground">Please wait while we verify your email address.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Email verified!</h1>
          <p className="text-muted-foreground mb-6">
            Your email has been successfully verified. You can now access all features.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Verification failed</h1>
          <p className="text-muted-foreground mb-6">{errorMessage}</p>
          <div className="space-y-3">
            <Button asChild variant="outline" className="w-full">
              <Link href="/signin">Back to Sign In</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Need a new verification link?{' '}
              <Link href="/resend-verification" className="text-primary hover:underline">
                Resend email
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-primary p-6">
      <Suspense
        fallback={
          <div className="bg-card p-8 rounded-lg shadow-lg text-center border border-border max-w-md w-full">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
