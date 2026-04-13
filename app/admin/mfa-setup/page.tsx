'use client';

/**
 * Phase M: Admin MFA Setup Page
 *
 * Mandatory MFA enrollment wall for privileged admins (SUPER_ADMIN /
 * BILLING_ADMIN). Displayed after login when Firebase user does not have
 * a second factor enrolled.
 *
 * Flow:
 * 1. Admin signs in via email/password or Google
 * 2. /api/admin/auth/login returns { mfaSetupRequired: true }
 * 3. Client redirects to /admin/mfa-setup
 * 4. This page enrolls TOTP via Firebase multiFactor API
 * 5. After enrollment, signs out + redirects to login (so new token has
 *    sign_in_second_factor claim)
 *
 * Flow notes:
 * - AdminLayoutClient whitelists this route (won't redirect to login)
 * - verifyAdminGCPAuth returns mfaSetupRequired=true instead of rejecting
 * - All other admin routes block access until MFA is enrolled
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, multiFactor } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { startTOTPEnrollment, finalizeTOTPEnrollment, type TOTPEnrollmentResult } from '@/lib/firebase/mfa';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Shield, AlertTriangle, CheckCircle2, Copy, RefreshCw, LogOut } from 'lucide-react';

type Step = 'intro' | 'generating' | 'scan' | 'verify' | 'complete';

export default function AdminMFASetupPage() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [enrollment, setEnrollment] = useState<TOTPEnrollmentResult | null>(null);
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('Monitrax Authenticator');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Load Firebase user on mount
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      router.push('/admin/login');
      return;
    }
    if (!auth.currentUser) {
      router.push('/admin/login');
      return;
    }
    setFirebaseUser(auth.currentUser);

    // Check if already enrolled — redirect to dashboard if so
    try {
      const mfUser = multiFactor(auth.currentUser);
      if (mfUser.enrolledFactors && mfUser.enrolledFactors.length > 0) {
        // Already enrolled — nothing to do here
        router.push('/admin/dashboard');
        return;
      }
    } catch {
      // ignore
    }
  }, [router]);

  // Generate QR code as data URL when enrollment starts
  useEffect(() => {
    if (enrollment?.totpUri && !qrDataUrl) {
      // Use Google Chart API for QR code rendering (no extra dependency)
      const encoded = encodeURIComponent(enrollment.totpUri);
      setQrDataUrl(
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`
      );
    }
  }, [enrollment, qrDataUrl]);

  const handleStartEnrollment = async () => {
    setError(null);
    setIsProcessing(true);
    setStep('generating');

    try {
      if (!firebaseUser) throw new Error('Firebase user not loaded');
      const result = await startTOTPEnrollment(firebaseUser);
      setEnrollment(result);
      setStep('scan');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start MFA enrollment';
      setError(msg);
      setStep('intro');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    if (!enrollment || !firebaseUser) return;

    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a 6-digit code from your authenticator app');
      return;
    }

    setIsProcessing(true);
    try {
      await finalizeTOTPEnrollment(firebaseUser, enrollment.secret, code, displayName || 'Authenticator');
      setStep('complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify code';
      if (msg.includes('auth/invalid-verification-code')) {
        setError('Invalid code. Check the 6-digit code in your authenticator app and try again.');
      } else if (msg.includes('auth/totp-challenge-timeout')) {
        setError('Code expired. Please try again with the current code.');
      } else {
        setError(msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueAfterEnrollment = async () => {
    // Sign out so the next login includes the sign_in_second_factor claim
    try {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    } catch {
      // ignore
    }
    router.push('/admin/login');
  };

  const handleCopySecret = () => {
    if (enrollment?.secretKey) {
      navigator.clipboard.writeText(enrollment.secretKey);
    }
  };

  const handleLogout = async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    } catch {
      // ignore
    }
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-[#0A0F1C] dark:via-[#0A0F1C] dark:to-[#0F1929] py-12 px-4">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Multi-Factor Authentication Required
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            As a privileged admin, you must enroll in MFA before accessing the portal.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Step: Intro */}
        {step === 'intro' && (
          <AdminCard>
            <AdminCardHeader
              title="Set up your authenticator app"
              description="You'll need an authenticator app like Google Authenticator, Authy, or 1Password."
            />
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Why this is required:</strong> Monitrax handles CDR-regulated financial data.
                  Privileged admins (SUPER_ADMIN, BILLING_ADMIN) must use MFA to protect access to this data,
                  per CDR §1.3 and Basiq accreditation requirements.
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium text-gray-900 dark:text-white">How it works:</p>
                <ol className="space-y-1.5 list-decimal pl-5">
                  <li>Install an authenticator app on your phone</li>
                  <li>Scan the QR code we'll show you next</li>
                  <li>Enter the 6-digit code to verify</li>
                  <li>Sign back in — you'll be challenged for MFA going forward</li>
                </ol>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <AdminButton
                  onClick={handleStartEnrollment}
                  isLoading={isProcessing}
                  className="flex-1"
                >
                  Start MFA Setup
                </AdminButton>
                <AdminButton variant="outline" onClick={handleLogout}>
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                </AdminButton>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-500 text-center pt-2">
                Signed in as <strong>{firebaseUser?.email}</strong>
              </p>
            </div>
          </AdminCard>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <AdminCard>
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">Generating your MFA secret...</p>
            </div>
          </AdminCard>
        )}

        {/* Step: Scan QR */}
        {step === 'scan' && enrollment && (
          <AdminCard>
            <AdminCardHeader
              title="Scan with your authenticator"
              description="Point your authenticator app's camera at the QR code below."
            />
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex flex-col items-center p-6 rounded-xl bg-white dark:bg-white border border-gray-200 dark:border-white/[0.1]">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="MFA QR Code" className="w-[220px] h-[220px]" />
                ) : (
                  <div className="w-[220px] h-[220px] flex items-center justify-center bg-gray-100">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                )}
              </div>

              {/* Manual entry fallback */}
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Can't scan? Enter this key manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-white dark:bg-white/[0.04] px-2 py-1.5 rounded border border-gray-200 dark:border-white/[0.08] flex-1 break-all">
                    {enrollment.secretKey}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] text-gray-500 hover:text-gray-700 transition-colors"
                    title="Copy secret"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <AdminButton onClick={() => setStep('verify')} className="w-full">
                I've scanned the code →
              </AdminButton>
            </div>
          </AdminCard>
        )}

        {/* Step: Verify */}
        {step === 'verify' && (
          <AdminCard>
            <AdminCardHeader
              title="Enter verification code"
              description="Open your authenticator app and enter the 6-digit code for Monitrax."
            />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Authenticator Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., iPhone Authenticator"
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1624] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="w-full px-3 py-3 text-2xl font-mono text-center tracking-[0.5em] rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1624] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex gap-2">
                <AdminButton variant="outline" onClick={() => setStep('scan')}>
                  Back
                </AdminButton>
                <AdminButton
                  onClick={handleVerify}
                  isLoading={isProcessing}
                  className="flex-1"
                >
                  Verify & Enable MFA
                </AdminButton>
              </div>
            </div>
          </AdminCard>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <AdminCard>
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1.5">
                MFA Enrolled Successfully
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                Your authenticator app is now linked to your Monitrax admin account.
                You'll need to sign in again so we can issue a new token that includes the MFA challenge result.
              </p>
              <AdminButton onClick={handleContinueAfterEnrollment} className="w-full">
                Sign Out & Continue
              </AdminButton>
            </div>
          </AdminCard>
        )}

        {/* Security notice */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-500 mt-6">
          Secured by GCP Identity Platform. MFA enrollment is permanent — you can change it later in your profile.
        </p>
      </div>
    </div>
  );
}
