'use client';

/**
 * MFA Security Settings Page
 * Phase 10: Multi-factor authentication management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Shield, Smartphone, Key, Download, CheckCircle2, AlertCircle } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface MFAMethod {
  id: string;
  type: 'TOTP' | 'SMS' | 'WEBAUTHN';
  isEnabled: boolean;
  isPrimary: boolean;
  lastUsedAt: string | null;
  phoneNumber?: string | null;
  createdAt: string;
}

interface MFASetupResult {
  id: string;
  type: string;
  secret?: string;
  qrCodeUrl?: string;
  backupCodes: string[];
}

// ============================================
// COMPONENT
// ============================================

export default function SecurityMFAPage() {
  const [mfaMethods, setMFAMethods] = useState<MFAMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupType, setSetupType] = useState<'TOTP' | 'WEBAUTHN' | null>(null);
  const [setupResult, setSetupResult] = useState<MFASetupResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);

  // Load MFA methods
  const loadMFAMethods = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/security/mfa/methods');

      if (!response.ok) {
        throw new Error('Failed to load MFA methods');
      }

      const data = await response.json();
      setMFAMethods(data.methods);
    } catch (error) {
      console.error('Error loading MFA methods:', error);
    } finally {
      setLoading(false);
    }
  };

  // Setup TOTP MFA
  const setupTOTP = async () => {
    try {
      const response = await fetch('/api/security/mfa/setup/totp', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to setup TOTP');
      }

      const data: MFASetupResult = await response.json();
      setSetupResult(data);
      setSetupType('TOTP');
      setShowSetupDialog(true);
    } catch (error) {
      console.error('Error setting up TOTP:', error);
    }
  };

  // Verify and enable TOTP
  const verifyTOTP = async () => {
    if (!setupResult || !verificationCode) return;

    setVerifying(true);

    try {
      const response = await fetch('/api/security/mfa/verify/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaMethodId: setupResult.id,
          code: verificationCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid verification code');
      }

      // Show backup codes
      setBackupCodes(setupResult.backupCodes);
      setShowBackupCodesDialog(true);
      setShowSetupDialog(false);
      setVerificationCode('');

      // Reload methods
      await loadMFAMethods();
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      alert('Invalid verification code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Disable MFA method
  const disableMFA = async (methodId: string) => {
    if (!confirm('Are you sure you want to disable this MFA method?')) {
      return;
    }

    try {
      const response = await fetch(`/api/security/mfa/${methodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disable MFA');
      }

      await loadMFAMethods();
    } catch (error) {
      console.error('Error disabling MFA:', error);
    }
  };

  // Regenerate backup codes
  const regenerateBackupCodes = async (methodId: string) => {
    try {
      const response = await fetch(`/api/security/mfa/${methodId}/backup-codes`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate backup codes');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setShowBackupCodesDialog(true);
    } catch (error) {
      console.error('Error regenerating backup codes:', error);
    }
  };

  // Download backup codes
  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitrax-backup-codes-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  useEffect(() => {
    loadMFAMethods();
  }, []);

  // ============================================
  // RENDER
  // ============================================

  const totpMethod = mfaMethods.find((m) => m.type === 'TOTP');
  const hasMFA = mfaMethods.some((m) => m.isEnabled);

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
            Use an authenticator app like Google Authenticator or Authy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpMethod && totpMethod.isEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">TOTP Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    Last used: {totpMethod.lastUsedAt ? new Date(totpMethod.lastUsedAt).toLocaleString() : 'Never'}
                  </div>
                </div>
                <Badge>Active</Badge>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => regenerateBackupCodes(totpMethod.id)} variant="outline">
                  Regenerate Backup Codes
                </Button>
                <Button onClick={() => disableMFA(totpMethod.id)} variant="destructive">
                  Disable TOTP
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Setup two-factor authentication using your smartphone's authenticator app.
              </p>
              <Button onClick={setupTOTP}>
                <Smartphone className="mr-2 h-4 w-4" />
                Setup Authenticator App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passkeys (WebAuthn) */}
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
      <AlertDialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Setup Authenticator App</AlertDialogTitle>
            <AlertDialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {setupResult && (
            <div className="space-y-4">
              {/* QR Code Placeholder */}
              <div className="bg-white p-4 rounded border-2 border-dashed border-gray-300 text-center">
                <div className="text-sm text-muted-foreground mb-2">QR Code</div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded break-all">
                  {setupResult.qrCodeUrl}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Manual setup code: {setupResult.secret}
                </div>
              </div>

              {/* Verification Input */}
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={verifyTOTP} disabled={verifying || verificationCode.length !== 6}>
              {verifying ? 'Verifying...' : 'Verify & Enable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup Codes Dialog */}
      <AlertDialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Backup Codes</AlertDialogTitle>
            <AlertDialogDescription>
              Save these backup codes in a secure location. Each code can be used once if you lose access to your authenticator device.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded font-mono text-sm space-y-1">
              {backupCodes.map((code, index) => (
                <div key={index}>{code}</div>
              ))}
            </div>

            <Button onClick={downloadBackupCodes} className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download Backup Codes
            </Button>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction>I've Saved My Codes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
