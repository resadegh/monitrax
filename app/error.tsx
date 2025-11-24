'use client';

import { useEffect } from 'react';
import { log } from '@/lib/utils/logger';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary
 * Catches unhandled errors in the application and displays a user-friendly message
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error for debugging and monitoring
    log.error('Unhandled application error', error, {
      digest: error.digest,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Something went wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {error.message || 'An unexpected error occurred. Please try again.'}
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {isDev && error.stack && (
              <div className="text-left bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-auto max-h-48">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </div>
            )}

            {/* Error Digest */}
            {error.digest && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Error ID: {error.digest}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={reset} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/dashboard">
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
