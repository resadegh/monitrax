'use client';

/**
 * Security Settings Page - Phase 10
 *
 * User-facing security center for:
 * - Password change
 * - MFA status and management link
 * - Session management
 * - Connected accounts (OAuth)
 * - Account deletion
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: Date;
  isCurrent: boolean;
}

interface OAuthAccount {
  provider: string;
  email: string | null;
  connected: boolean;
}

interface MFAMethod {
  id: string;
  type: 'TOTP' | 'SMS' | 'WEBAUTHN';
  isEnabled: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // MFA State
  const [mfaMethods, setMfaMethods] = useState<MFAMethod[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // OAuth State
  const [connectedAccounts, setConnectedAccounts] = useState<OAuthAccount[]>([
    { provider: 'google', email: null, connected: false },
    { provider: 'apple', email: null, connected: false },
    { provider: 'microsoft', email: null, connected: false },
  ]);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Load MFA methods
  const loadMFAMethods = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/mfa/methods', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMfaMethods(data.methods || []);
        setMfaEnabled(data.methods?.some((m: MFAMethod) => m.isEnabled) || false);
      }
    } catch (err) {
      console.error('Error loading MFA methods:', err);
    }
  };

  // Load active sessions
  const loadSessions = async () => {
    if (!token) return;
    setSessionsLoading(true);

    try {
      const response = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(
          data.sessions?.map((s: {
            id: string;
            deviceName?: string;
            browser?: string;
            os?: string;
            location?: string;
            ipAddress?: string;
            lastActivity?: string;
            isCurrent?: boolean;
          }) => ({
            id: s.id,
            device: s.deviceName || 'Unknown Device',
            browser: s.browser || 'Unknown',
            os: s.os || 'Unknown',
            location: s.location || 'Unknown',
            ip: s.ipAddress ? `${s.ipAddress.substring(0, 8)}xxx.xxx` : 'Unknown',
            lastActive: new Date(s.lastActivity || Date.now()),
            isCurrent: s.isCurrent || false,
          })) || []
        );
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      // Set default session for current device if API fails
      setSessions([
        {
          id: 'current',
          device: 'Current Device',
          browser: 'Unknown',
          os: 'Unknown',
          location: 'Unknown',
          ip: 'Unknown',
          lastActive: new Date(),
          isCurrent: true,
        },
      ]);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Load OAuth accounts
  const loadOAuthAccounts = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/oauth/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accounts) {
          setConnectedAccounts(data.accounts);
        }
      }
    } catch (err) {
      console.error('Error loading OAuth accounts:', err);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccessMessage('Password changed successfully');
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle session revocation
  const handleRevokeSession = async (sessionId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setSuccessMessage('Session revoked successfully');
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Error revoking session:', err);
      setError('Failed to revoke session');
    }
  };

  // Handle revoke all sessions
  const handleRevokeAllSessions = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/sessions/revoke-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        setSuccessMessage('All other sessions have been signed out');
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Error revoking all sessions:', err);
      setError('Failed to sign out other devices');
    }
  };

  // Handle OAuth connection
  const handleConnectOAuth = (provider: string) => {
    // Redirect to OAuth flow
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  // Handle OAuth disconnection
  const handleDisconnectOAuth = async (provider: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/auth/oauth/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setConnectedAccounts((prev) =>
          prev.map((a) =>
            a.provider === provider ? { ...a, connected: false, email: null } : a
          )
        );
        setSuccessMessage(`${provider} account disconnected`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Error disconnecting OAuth:', err);
      setError(`Failed to disconnect ${provider}`);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadMFAMethods(), loadSessions(), loadOAuthAccounts()]);
      setLoading(false);
    };

    if (token) {
      loadData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Security Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security, sessions, and authentication methods.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="float-right">×</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isChangingPassword ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Password is set
                  </p>
                </div>
                <Button onClick={() => setIsChangingPassword(true)}>
                  Change Password
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={passwordLoading}>
                    {passwordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsChangingPassword(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {mfaEnabled ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Not Enabled
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {mfaEnabled
                    ? `${mfaMethods.filter((m) => m.isEnabled).length} authentication method(s) configured`
                    : 'Enable 2FA to add an extra layer of security.'}
                </p>
              </div>
              <Button onClick={() => router.push('/dashboard/settings/security-mfa')}>
                {mfaEnabled ? 'Manage 2FA' : 'Enable 2FA'}
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {!mfaEnabled && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  We recommend enabling two-factor authentication to protect your financial data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage devices where you're currently logged in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Monitor className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{session.device}</p>
                            {session.isCurrent && (
                              <Badge variant="outline" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {session.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.isCurrent
                                ? 'Active now'
                                : `${Math.round(
                                    (Date.now() - session.lastActive.getTime()) / (1000 * 60 * 60)
                                  )}h ago`}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          <LogOut className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {sessions.length > 1 && (
                  <>
                    <Separator className="my-4" />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out All Other Devices
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Sign out all other devices?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will sign you out of all devices except this one. You'll need to sign in
                            again on those devices.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRevokeAllSessions}>
                            Sign Out All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              Link external accounts for easier sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connectedAccounts.map((account) => (
                <div
                  key={account.provider}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {account.provider === 'google' && (
                        <span className="text-lg font-bold">G</span>
                      )}
                      {account.provider === 'apple' && (
                        <span className="text-lg font-bold"></span>
                      )}
                      {account.provider === 'microsoft' && (
                        <span className="text-lg font-bold">M</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{account.provider}</p>
                      {account.connected ? (
                        <p className="text-sm text-muted-foreground">{account.email}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not connected</p>
                      )}
                    </div>
                  </div>
                  {account.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectOAuth(account.provider)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnectOAuth(account.provider)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and
                    remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
