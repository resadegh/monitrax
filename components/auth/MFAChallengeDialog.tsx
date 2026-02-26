'use client';

/**
 * MFA Challenge Dialog
 *
 * Shown during login when the user has MFA enrolled in Firebase/GCP Identity Platform.
 * Handles TOTP (authenticator app) and Phone (SMS) second factors.
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/context/AuthContext';
import type { MFAFactorInfo } from '@/lib/firebase/mfa';

export function MFAChallengeDialog() {
  const {
    mfaChallenge,
    resolveMFAWithTOTP,
    resolveMFAWithPhone,
    cancelMFAChallenge,
  } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedHint, setSelectedHint] = useState<MFAFactorInfo | null>(null);

  if (!mfaChallenge) return null;

  const { hints } = mfaChallenge;

  // Auto-select the first hint if not already selected
  const activeHint = selectedHint || hints[0];
  const isTOTP = activeHint?.factorId === 'totp';

  const handleVerify = async () => {
    if (!activeHint || code.length < 6) return;

    setIsVerifying(true);
    setError('');

    try {
      if (isTOTP) {
        await resolveMFAWithTOTP(activeHint.uid, code);
      } else {
        await resolveMFAWithPhone(code);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      if (message.includes('auth/invalid-verification-code')) {
        setError('Invalid code. Please try again.');
      } else if (message.includes('auth/code-expired')) {
        setError('Code has expired. Please request a new one.');
      } else {
        setError(message);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6 && !isVerifying) {
      handleVerify();
    }
  };

  const handleCancel = () => {
    setCode('');
    setError('');
    setSelectedHint(null);
    cancelMFAChallenge();
  };

  return (
    <AlertDialog open={!!mfaChallenge} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Two-Factor Authentication</AlertDialogTitle>
          <AlertDialogDescription>
            {isTOTP
              ? 'Enter the 6-digit code from your authenticator app to complete sign-in.'
              : 'Enter the 6-digit code sent to your phone to complete sign-in.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Show factor selector if multiple factors enrolled */}
          {hints.length > 1 && (
            <div className="space-y-2">
              <Label>Choose verification method</Label>
              <div className="flex gap-2">
                {hints.map((hint) => (
                  <Button
                    key={hint.uid}
                    variant={activeHint?.uid === hint.uid ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedHint(hint);
                      setCode('');
                      setError('');
                    }}
                  >
                    {hint.factorId === 'totp' ? 'Authenticator' : 'SMS'}
                    {hint.displayName ? ` (${hint.displayName})` : ''}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Code input */}
          <div className="space-y-2">
            <Label htmlFor="mfaCode">Verification Code</Label>
            <Input
              id="mfaCode"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={handleKeyDown}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
              autoComplete="one-time-code"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isVerifying || code.length !== 6}
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
