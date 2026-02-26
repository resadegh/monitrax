'use client';

/**
 * MFA Security Settings Page
 * Phase 10: Multi-factor authentication management
 *
 * When GCP Identity Platform is configured:
 *   - Uses Firebase MFA (TOTP enrollment via TotpMultiFactorGenerator)
 *   - MFA is enforced by Firebase during sign-in
 *
 * When GCP is NOT configured (legacy):
 *   - Uses the custom Monitrax TOTP/SMS backend APIs
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, Smartphone, Key, Download, CheckCircle2, AlertCircle, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import QRCode from 'qrcode';
import {
  startTOTPEnrollment,
  finalizeTOTPEnrollment,
  getEnrolledFactors,
  unenrollFactor,
  type TOTPEnrollmentResult,
  type MFAFactorInfo,
} from '@/lib/firebase/mfa';
import type { TotpSecret } from 'firebase/auth';

// ============================================
// TYPES (Legacy Monitrax MFA)
// ============================================

interface LegacyMFAMethod {
  id: string;
  type: 'TOTP' | 'SMS' | 'WEBAUTHN';
  isEnabled: boolean;
  isPrimary: boolean;
  lastUsedAt: string | null;
  phoneNumber?: string | null;
  createdAt: string;
}

interface LegacyMFASetupResult {
  id: string;
  type: string;
  secret?: string;
  qrCodeUrl?: string;
  qrCodeDataUrl?: string;
  backupCodes: string[];
}

interface LegacySMSSetupResult {
  id: string;
  type: string;
  phoneNumber: string;
  backupCodes: string[];
}

// ============================================
// COMPONENT
// ============================================

export default function SecurityMFAPage() {
  const { token, isGCPEnabled, firebaseUser } = useAuth();

  // Render the appropriate MFA management based on auth mode
  if (isGCPEnabled) {
    return <FirebaseMFASettings firebaseUser={firebaseUser} />;
  }

  return <LegacyMFASettings token={token} />;
}

// ============================================
// FIREBASE MFA SETTINGS (GCP Identity Platform)
// ============================================

function FirebaseMFASettings({ firebaseUser }: { firebaseUser: import('firebase/auth').User | null }) {
  const [enrolledFactors, setEnrolledFactors] = useState<MFAFactorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TOTP Enrollment State
  const [showTOTPSetupDialog, setShowTOTPSetupDialog] = useState(false);
  const [totpEnrollment, setTotpEnrollment] = useState<TOTPEnrollmentResult | null>(null);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpVerifying, setTotpVerifying] = useState(false);

  const loadFactors = () => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    const factors = getEnrolledFactors(firebaseUser);
    setEnrolledFactors(factors);
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, [firebaseUser]);

  const handleStartTOTPEnrollment = async () => {
    if (!firebaseUser) return;
    setError(null);

    try {
      const result = await startTOTPEnrollment(firebaseUser);
      setTotpEnrollment(result);

      // Generate QR code data URL from the otpauth URI
      try {
        const dataUrl = await QRCode.toDataURL(result.totpUri, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setTotpQrDataUrl(dataUrl);
      } catch {
        // QR generation failed — user can still use manual key
      }

      setShowTOTPSetupDialog(true);
    } catch (err) {
      console.error('TOTP enrollment error:', err);
      const message = err instanceof Error ? err.message : 'Failed to start TOTP setup';
      if (message.includes('auth/requires-recent-login')) {
        setError('Please sign out and sign back in to set up MFA (recent login required).');
      } else {
        setError(message);
      }
    }
  };

  const handleFinalizeTOTPEnrollment = async () => {
    if (!firebaseUser || !totpEnrollment || totpCode.length !== 6) return;
    setTotpVerifying(true);
    setError(null);

    try {
      await finalizeTOTPEnrollment(
        firebaseUser,
        totpEnrollment.secret as TotpSecret,
        totpCode,
        'Authenticator App'
      );
      setShowTOTPSetupDialog(false);
      setTotpEnrollment(null);
      setTotpQrDataUrl(null);
      setTotpCode('');
      loadFactors();
    } catch (err) {
      console.error('TOTP verification error:', err);
      const message = err instanceof Error ? err.message : 'Verification failed';
      if (message.includes('auth/invalid-verification-code')) {
        setError('Invalid code. Please try again.');
      } else {
        setError(message);
      }
    } finally {
      setTotpVerifying(false);
    }
  };

  const handleUnenrollFactor = async (factorUid: string, displayName: string | null) => {
    if (!firebaseUser) return;
    if (!confirm(`Are you sure you want to remove "${displayName || 'this MFA method'}"?`)) {
      return;
    }

    try {
      await unenrollFactor(firebaseUser, factorUid);
      loadFactors();
    } catch (err) {
      console.error('Unenroll error:', err);
      const message = err instanceof Error ? err.message : 'Failed to remove MFA method';
      if (message.includes('auth/requires-recent-login')) {
        setError('Please sign out and sign back in to remove MFA (recent login required).');
      } else {
        setError(message);
      }
    }
  };

  const hasMFA = enrolledFactors.length > 0;
  const totpFactor = enrolledFactors.find((f) => f.factorId === 'totp');
  const phoneFactor = enrolledFactors.find((f) => f.factorId === 'phone');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Please sign in to manage MFA settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Multi-Factor Authentication
        </h1>
        <p className="text-muted-foreground">
          Add an extra layer of security to your account
        </p>
        <Badge variant="outline" className="mt-2">
          Powered by GCP Identity Platform
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>MFA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {hasMFA ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">MFA Enabled</span>
                <Badge variant="secondary">{enrolledFactors.length} method(s) active</Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-600">MFA Not Enabled</span>
                <span className="text-sm text-muted-foreground ml-2">
                  We recommend enabling at least one MFA method
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TOTP (Authenticator App) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Authenticator App (TOTP)
          </CardTitle>
          <CardDescription>
            Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpFactor ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">TOTP Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    {totpFactor.displayName || 'Authenticator App'}
                  </div>
                  {totpFactor.enrollmentTime && (
                    <div className="text-sm text-muted-foreground">
                      Enrolled: {new Date(totpFactor.enrollmentTime).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <Badge className="bg-green-500">Active</Badge>
              </div>
              <Button
                onClick={() => handleUnenrollFactor(totpFactor.uid, totpFactor.displayName)}
                variant="destructive"
              >
                Disable TOTP
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Setup two-factor authentication using your smartphone's authenticator app.
                This is the most secure MFA option.
              </p>
              <Button onClick={handleStartTOTPEnrollment}>
                <Smartphone className="mr-2 h-4 w-4" />
                Setup Authenticator App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phone (SMS) — show status only (enrollment requires reCAPTCHA setup) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Authentication
          </CardTitle>
          <CardDescription>
            Receive verification codes via SMS to your mobile phone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phoneFactor ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">SMS Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    {phoneFactor.displayName || 'Phone'}
                  </div>
                </div>
                <Badge className="bg-green-500">Active</Badge>
              </div>
              <Button
                onClick={() => handleUnenrollFactor(phoneFactor.uid, phoneFactor.displayName)}
                variant="destructive"
              >
                Disable SMS
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                SMS-based MFA can be configured via the GCP Identity Platform console.
                Once enrolled, you'll receive a verification code via SMS during sign-in.
              </p>
              <Button disabled variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Setup via GCP Console
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passkeys (FIDO2) — Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Passkeys (FIDO2)
          </CardTitle>
          <CardDescription>
            Use biometric authentication or hardware security keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Passkey support coming soon. Use fingerprint, Face ID, or hardware security keys for passwordless authentication.
          </p>
          <Button disabled variant="outline">
            <Key className="mr-2 h-4 w-4" />
            Setup Passkey (Coming Soon)
          </Button>
        </CardContent>
      </Card>

      {/* TOTP Setup Dialog */}
      <AlertDialog open={showTOTPSetupDialog} onOpenChange={setShowTOTPSetupDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Setup Authenticator App</AlertDialogTitle>
            <AlertDialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {totpEnrollment && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                {totpQrDataUrl ? (
                  <div className="bg-white p-4 rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={totpQrDataUrl}
                      alt="QR Code for authenticator app"
                      width={200}
                      height={200}
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 p-8 rounded text-center text-sm text-muted-foreground">
                    QR Code loading...
                  </div>
                )}
              </div>

              {/* Manual Entry */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Can't scan? Enter this code manually:
                </p>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                  {totpEnrollment.secretKey}
                </code>
              </div>

              {/* Verification Input */}
              <div className="space-y-2">
                <Label htmlFor="totpCode">Verification Code</Label>
                <Input
                  id="totpCode"
                  placeholder="Enter 6-digit code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoComplete="one-time-code"
                />
              </div>

              {/* Error inside dialog */}
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowTOTPSetupDialog(false);
              setTotpEnrollment(null);
              setTotpQrDataUrl(null);
              setTotpCode('');
              setError(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalizeTOTPEnrollment}
              disabled={totpVerifying || totpCode.length !== 6}
            >
              {totpVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Enable'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// LEGACY MFA SETTINGS (Custom Monitrax Backend)
// ============================================

function LegacyMFASettings({ token }: { token: string | null }) {
  const [mfaMethods, setMFAMethods] = useState<LegacyMFAMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TOTP Setup State
  const [showTOTPSetupDialog, setShowTOTPSetupDialog] = useState(false);
  const [totpSetupResult, setTOTPSetupResult] = useState<LegacyMFASetupResult | null>(null);
  const [totpVerificationCode, setTOTPVerificationCode] = useState('');
  const [totpVerifying, setTOTPVerifying] = useState(false);

  // SMS Setup State
  const [showSMSSetupDialog, setShowSMSSetupDialog] = useState(false);
  const [smsPhoneNumber, setSMSPhoneNumber] = useState('');
  const [smsSetupResult, setSMSSetupResult] = useState<LegacySMSSetupResult | null>(null);
  const [smsVerificationCode, setSMSVerificationCode] = useState('');
  const [smsVerifying, setSMSVerifying] = useState(false);
  const [smsSending, setSMSSending] = useState(false);
  const [smsCodeSent, setSMSCodeSent] = useState(false);

  // Backup Codes State
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);

  // Load MFA methods
  const loadMFAMethods = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/mfa/methods', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load MFA methods');
      }

      const data = await response.json();
      setMFAMethods(data.methods || []);
    } catch (err) {
      console.error('Error loading MFA methods:', err);
      setError('Failed to load MFA methods');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // TOTP (Google Authenticator) Functions
  // ============================================

  const setupTOTP = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/mfa/totp/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to setup TOTP');
      }

      const data: LegacyMFASetupResult = await response.json();
      setTOTPSetupResult(data);
      setShowTOTPSetupDialog(true);
    } catch (err) {
      console.error('Error setting up TOTP:', err);
      setError(err instanceof Error ? err.message : 'Failed to setup TOTP');
    }
  };

  const verifyAndEnableTOTP = async () => {
    if (!token || !totpSetupResult || !totpVerificationCode) return;

    setTOTPVerifying(true);

    try {
      const response = await fetch('/api/auth/mfa/totp/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mfaMethodId: totpSetupResult.id,
          code: totpVerificationCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid verification code');
      }

      // Show backup codes
      setBackupCodes(totpSetupResult.backupCodes);
      setShowBackupCodesDialog(true);
      setShowTOTPSetupDialog(false);
      setTOTPVerificationCode('');
      setTOTPSetupResult(null);

      // Reload methods
      await loadMFAMethods();
    } catch (err) {
      console.error('Error verifying TOTP:', err);
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setTOTPVerifying(false);
    }
  };

  const disableTOTP = async (methodId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to disable TOTP authentication?')) {
      return;
    }

    try {
      const response = await fetch('/api/auth/mfa/totp/disable', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mfaMethodId: methodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disable TOTP');
      }

      await loadMFAMethods();
    } catch (err) {
      console.error('Error disabling TOTP:', err);
      setError('Failed to disable TOTP');
    }
  };

  // ============================================
  // SMS MFA Functions
  // ============================================

  const setupSMS = async () => {
    if (!token || !smsPhoneNumber) {
      setError('Please enter a valid phone number');
      return;
    }

    setSMSSending(true);

    try {
      const response = await fetch('/api/auth/mfa/sms/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber: smsPhoneNumber }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to setup SMS MFA');
      }

      const data: LegacySMSSetupResult = await response.json();
      setSMSSetupResult(data);
      setSMSCodeSent(true);
    } catch (err) {
      console.error('Error setting up SMS MFA:', err);
      setError(err instanceof Error ? err.message : 'Failed to setup SMS MFA');
    } finally {
      setSMSSending(false);
    }
  };

  const verifyAndEnableSMS = async () => {
    if (!token || !smsSetupResult || !smsVerificationCode) return;

    setSMSVerifying(true);

    try {
      const response = await fetch('/api/auth/mfa/sms/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mfaMethodId: smsSetupResult.id,
          code: smsVerificationCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid verification code');
      }

      // Show backup codes
      setBackupCodes(smsSetupResult.backupCodes);
      setShowBackupCodesDialog(true);
      setShowSMSSetupDialog(false);
      setSMSVerificationCode('');
      setSMSSetupResult(null);
      setSMSCodeSent(false);
      setSMSPhoneNumber('');

      // Reload methods
      await loadMFAMethods();
    } catch (err) {
      console.error('Error verifying SMS:', err);
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setSMSVerifying(false);
    }
  };

  const resendSMSCode = async () => {
    if (!token || !smsSetupResult) return;

    setSMSSending(true);

    try {
      const response = await fetch('/api/auth/mfa/sms/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mfaMethodId: smsSetupResult.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend code');
      }
    } catch (err) {
      console.error('Error resending SMS code:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setSMSSending(false);
    }
  };

  const disableSMS = async (methodId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to disable SMS authentication?')) {
      return;
    }

    try {
      const response = await fetch('/api/auth/mfa/sms/disable', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mfaMethodId: methodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disable SMS MFA');
      }

      await loadMFAMethods();
    } catch (err) {
      console.error('Error disabling SMS:', err);
      setError('Failed to disable SMS MFA');
    }
  };

  // ============================================
  // Backup Codes Functions
  // ============================================

  const regenerateBackupCodes = async (methodId: string) => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/mfa/backup-codes/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mfaMethodId: methodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate backup codes');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setShowBackupCodesDialog(true);
    } catch (err) {
      console.error('Error regenerating backup codes:', err);
      setError('Failed to regenerate backup codes');
    }
  };

  const downloadBackupCodes = () => {
    const content = `Monitrax Backup Codes
Generated: ${new Date().toISOString()}

IMPORTANT: Store these codes in a secure location.
Each code can only be used once.

${backupCodes.join('\n')}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitrax-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  useEffect(() => {
    loadMFAMethods();
  }, [token]);

  // ============================================
  // RENDER
  // ============================================

  const totpMethod = mfaMethods.find((m) => m.type === 'TOTP' && m.isEnabled);
  const smsMethod = mfaMethods.find((m) => m.type === 'SMS' && m.isEnabled);
  const hasMFA = mfaMethods.some((m) => m.isEnabled);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Multi-Factor Authentication
        </h1>
        <p className="text-muted-foreground">
          Add an extra layer of security to your account
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>MFA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {hasMFA ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">MFA Enabled</span>
                <Badge variant="secondary">{mfaMethods.filter((m) => m.isEnabled).length} method(s) active</Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-600">MFA Not Enabled</span>
                <span className="text-sm text-muted-foreground ml-2">
                  We recommend enabling at least one MFA method
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TOTP (Google Authenticator) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Authenticator App (TOTP)
          </CardTitle>
          <CardDescription>
            Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpMethod ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">TOTP Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    Last used: {totpMethod.lastUsedAt ? new Date(totpMethod.lastUsedAt).toLocaleString() : 'Never'}
                  </div>
                </div>
                <Badge className="bg-green-500">Active</Badge>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => regenerateBackupCodes(totpMethod.id)} variant="outline">
                  Regenerate Backup Codes
                </Button>
                <Button onClick={() => disableTOTP(totpMethod.id)} variant="destructive">
                  Disable TOTP
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Setup two-factor authentication using your smartphone's authenticator app.
                This is the most secure MFA option.
              </p>
              <Button onClick={setupTOTP}>
                <Smartphone className="mr-2 h-4 w-4" />
                Setup Authenticator App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS MFA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Authentication
          </CardTitle>
          <CardDescription>
            Receive verification codes via SMS to your mobile phone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {smsMethod ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">SMS Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    Phone: {smsMethod.phoneNumber ? `****${smsMethod.phoneNumber.slice(-4)}` : 'Unknown'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last used: {smsMethod.lastUsedAt ? new Date(smsMethod.lastUsedAt).toLocaleString() : 'Never'}
                  </div>
                </div>
                <Badge className="bg-green-500">Active</Badge>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => regenerateBackupCodes(smsMethod.id)} variant="outline">
                  Regenerate Backup Codes
                </Button>
                <Button onClick={() => disableSMS(smsMethod.id)} variant="destructive">
                  Disable SMS
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Receive a verification code via SMS when you sign in.
                Works with any mobile phone that can receive text messages.
              </p>
              <Button onClick={() => setShowSMSSetupDialog(true)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Setup SMS Authentication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passkeys (WebAuthn) - Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Passkeys (FIDO2)
          </CardTitle>
          <CardDescription>
            Use biometric authentication or hardware security keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Passkey support coming soon. Use fingerprint, Face ID, or hardware security keys for passwordless authentication.
          </p>
          <Button disabled variant="outline">
            <Key className="mr-2 h-4 w-4" />
            Setup Passkey (Coming Soon)
          </Button>
        </CardContent>
      </Card>

      {/* TOTP Setup Dialog */}
      <AlertDialog open={showTOTPSetupDialog} onOpenChange={setShowTOTPSetupDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Setup Authenticator App</AlertDialogTitle>
            <AlertDialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {totpSetupResult && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                {totpSetupResult.qrCodeDataUrl ? (
                  <div className="bg-white p-4 rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={totpSetupResult.qrCodeDataUrl}
                      alt="QR Code for authenticator app"
                      width={200}
                      height={200}
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 p-8 rounded text-center text-sm text-muted-foreground">
                    QR Code loading...
                  </div>
                )}
              </div>

              {/* Manual Entry */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Can't scan? Enter this code manually:
                </p>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                  {totpSetupResult.secret}
                </code>
              </div>

              {/* Verification Input */}
              <div className="space-y-2">
                <Label htmlFor="totpCode">Verification Code</Label>
                <Input
                  id="totpCode"
                  placeholder="Enter 6-digit code"
                  value={totpVerificationCode}
                  onChange={(e) => setTOTPVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowTOTPSetupDialog(false);
              setTOTPSetupResult(null);
              setTOTPVerificationCode('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={verifyAndEnableTOTP}
              disabled={totpVerifying || totpVerificationCode.length !== 6}
            >
              {totpVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Enable'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SMS Setup Dialog */}
      <AlertDialog open={showSMSSetupDialog} onOpenChange={setShowSMSSetupDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Setup SMS Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              {smsCodeSent
                ? 'Enter the 6-digit code sent to your phone'
                : 'Enter your mobile phone number to receive verification codes'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {!smsCodeSent ? (
              /* Phone Number Input */
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Mobile Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+61 412 345 678"
                  value={smsPhoneNumber}
                  onChange={(e) => setSMSPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your number in international format (e.g., +61 for Australia)
                </p>
              </div>
            ) : (
              /* Verification Code Input */
              <>
                <div className="text-center text-sm text-muted-foreground">
                  Code sent to {smsPhoneNumber}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smsCode">Verification Code</Label>
                  <Input
                    id="smsCode"
                    placeholder="Enter 6-digit code"
                    value={smsVerificationCode}
                    onChange={(e) => setSMSVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>
                <Button
                  variant="link"
                  className="w-full"
                  onClick={resendSMSCode}
                  disabled={smsSending}
                >
                  {smsSending ? 'Sending...' : "Didn't receive the code? Resend"}
                </Button>
              </>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowSMSSetupDialog(false);
              setSMSSetupResult(null);
              setSMSVerificationCode('');
              setSMSCodeSent(false);
              setSMSPhoneNumber('');
            }}>
              Cancel
            </AlertDialogCancel>
            {!smsCodeSent ? (
              <Button
                onClick={setupSMS}
                disabled={smsSending || !smsPhoneNumber}
              >
                {smsSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Code'
                )}
              </Button>
            ) : (
              <AlertDialogAction
                onClick={verifyAndEnableSMS}
                disabled={smsVerifying || smsVerificationCode.length !== 6}
              >
                {smsVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable'
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup Codes Dialog */}
      <AlertDialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Backup Codes</AlertDialogTitle>
            <AlertDialogDescription>
              Save these backup codes in a secure location. Each code can be used once if you lose access to your authenticator device or phone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded font-mono text-sm grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div key={index} className="text-center py-1 px-2 bg-white dark:bg-gray-900 rounded">
                  {code}
                </div>
              ))}
            </div>

            <Button onClick={downloadBackupCodes} className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download Backup Codes
            </Button>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowBackupCodesDialog(false)}>
              I've Saved My Codes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
