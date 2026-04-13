'use client';

/**
 * Phase M: Admin Settings Page — Modernized
 *
 * Multi-tab settings hub for admin portal configuration:
 * - My Profile: Current admin's details, MFA status, session info
 * - Admin Users: Manage all admin accounts
 * - Security Policies: Platform-wide security settings
 * - Notifications: Admin alert preferences
 * - Audit Log: Admin action history
 * - System Info: GCP services status, env config
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { StatusBadge, RoleBadge, AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { getFirebaseAuth } from '@/lib/firebase/config';
import type { User as FirebaseUser } from 'firebase/auth';
import { multiFactor } from 'firebase/auth';
import {
  Shield,
  User,
  Users,
  Lock,
  Bell,
  FileText,
  Server,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
} from 'lucide-react';

type TabId = 'profile' | 'admins' | 'security' | 'notifications' | 'audit' | 'system';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLogin: string | null;
  isInactive90Days: boolean;
  isCurrentlyLocked: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  adminUserId: string;
  action: string;
  category: string;
  targetType: string | null;
  targetId: string | null;
  description: string;
  timestamp: string;
  ipAddress: string;
  adminUser?: { name: string; email: string };
}

interface HealthCheck {
  projectId: string | null;
  hasServiceAccountKey: boolean;
  serviceAccountEmail: string | null;
  hasOrgId: boolean;
  orgId: string | null;
  hasCronSecret: boolean;
  environment: string;
  vercelEnv: string | null;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" /> },
  { id: 'admins', label: 'Admin Users', icon: <Users className="w-4 h-4" /> },
  { id: 'security', label: 'Security Policies', icon: <Shield className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'audit', label: 'Audit Log', icon: <FileText className="w-4 h-4" /> },
  { id: 'system', label: 'System Info', icon: <Server className="w-4 h-4" /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [mfaEnrolled, setMfaEnrolled] = useState<boolean>(false);
  const [mfaFactors, setMfaFactors] = useState<Array<{ displayName: string; factorId: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // Data fetching
  // ==========================================================================

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/admins');
      if (!response.ok) throw new Error('Failed to fetch admins');
      const data = await response.json();
      setAdmins(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/audit?limit=50');
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setAuditLogs(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchHealthCheck = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/gcp/healthcheck');
      if (response.ok) {
        const result = await response.json();
        setHealthCheck(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadFirebaseUser = useCallback(() => {
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      setFirebaseUser(auth.currentUser);
      try {
        const mfUser = multiFactor(auth.currentUser);
        const enrolled = mfUser.enrolledFactors || [];
        setMfaEnrolled(enrolled.length > 0);
        setMfaFactors(
          enrolled.map((f) => ({
            displayName: f.displayName || 'MFA Factor',
            factorId: f.factorId,
          }))
        );
      } catch (err) {
        console.error('Failed to load MFA factors:', err);
      }
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAdmins(), fetchAuditLogs(), fetchHealthCheck()]).finally(() => setLoading(false));
    loadFirebaseUser();
  }, [fetchAdmins, fetchAuditLogs, fetchHealthCheck, loadFirebaseUser]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ==========================================================================
  // Render tabs
  // ==========================================================================

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Settings"
        description="Admin portal configuration, security policies, and your profile"
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/[0.06] mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-3 pt-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* My Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader
              title="My Profile"
              description="Your Firebase Auth account details"
            />
            {firebaseUser ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Display Name</p>
                    <p className="text-sm font-medium">{firebaseUser.displayName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-sm font-medium">{firebaseUser.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email Verified</p>
                    <p className="text-sm">
                      {firebaseUser.emailVerified ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Not verified
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Firebase UID</p>
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-mono truncate">{firebaseUser.uid}</p>
                      <button
                        onClick={() => copyToClipboard(firebaseUser.uid)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy UID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Sign-in Provider</p>
                    <p className="text-sm">{firebaseUser.providerData[0]?.providerId || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Last Sign In</p>
                    <p className="text-sm">
                      {firebaseUser.metadata.lastSignInTime
                        ? new Date(firebaseUser.metadata.lastSignInTime).toLocaleString('en-AU')
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading profile...</p>
            )}
          </AdminCard>

          {/* MFA Status */}
          <AdminCard>
            <AdminCardHeader
              title="Multi-Factor Authentication"
              description="MFA is required for SUPER_ADMIN and BILLING_ADMIN roles (CDR §1.3)"
            />
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  {mfaEnrolled ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {mfaEnrolled ? 'MFA Enabled' : 'MFA Not Enrolled'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {mfaEnrolled
                        ? `${mfaFactors.length} second factor(s) configured`
                        : 'Required for admin portal access'}
                    </p>
                  </div>
                </div>
                <a
                  href="/dashboard/settings/security-mfa"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AdminButton variant={mfaEnrolled ? 'outline' : 'primary'}>
                    {mfaEnrolled ? 'Manage MFA' : 'Enroll Now'}
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </AdminButton>
                </a>
              </div>

              {mfaEnrolled && mfaFactors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enrolled Factors
                  </p>
                  {mfaFactors.map((factor, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-white/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{factor.displayName}</p>
                          <p className="text-xs text-gray-500">{factor.factorId.toUpperCase()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!mfaEnrolled && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Action required:</strong> As a privileged admin, you must enroll in MFA. Click "Enroll Now" to set up TOTP or SMS MFA via the main dashboard.
                  </p>
                </div>
              )}
            </div>
          </AdminCard>

          {/* Session Info */}
          <AdminCard>
            <AdminCardHeader
              title="Session Information"
              description="Your current admin portal session"
            />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.04]">
                <span className="text-gray-500">Session source</span>
                <span className="font-medium">Firebase Auth</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.04]">
                <span className="text-gray-500">Token expiry</span>
                <span className="font-medium">Auto-refresh (1 hour)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Inactivity timeout</span>
                <span className="font-medium">30 minutes</span>
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {/* Admin Users Tab */}
      {activeTab === 'admins' && (
        <AdminCard>
          <AdminCardHeader
            title="Admin Users"
            description="All admin accounts with access to this portal"
            action={<AdminButton size="sm">+ Add Admin</AdminButton>}
          />
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : admins.length > 0 ? (
            <AdminTable
              columns={[
                {
                  key: 'name',
                  header: 'Admin',
                  render: (a: AdminUser) => (
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.email}</p>
                    </div>
                  ),
                },
                { key: 'role', header: 'Role', render: (a: AdminUser) => <RoleBadge role={a.role} /> },
                {
                  key: 'mfa',
                  header: 'MFA',
                  render: (a: AdminUser) => (
                    <AdminBadge variant={a.mfaEnabled ? 'success' : 'warning'} size="sm" dot>
                      {a.mfaEnabled ? 'Enrolled' : 'Not set'}
                    </AdminBadge>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (a: AdminUser) => (
                    <StatusBadge status={a.isCurrentlyLocked ? 'suspended' : a.isActive ? 'active' : 'inactive'} />
                  ),
                },
                {
                  key: 'lastLogin',
                  header: 'Last Login',
                  render: (a: AdminUser) =>
                    a.lastLogin ? (
                      <span className="text-xs text-gray-500">
                        {new Date(a.lastLogin).toLocaleString('en-AU')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Never</span>
                    ),
                },
              ]}
              data={admins}
              keyExtractor={(a) => a.id}
            />
          ) : (
            <p className="text-center text-gray-500 py-8">No admin users found</p>
          )}
        </AdminCard>
      )}

      {/* Security Policies Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader
              title="MFA Enforcement Policy"
              description="Multi-factor authentication requirements for admin portal access"
            />
            <div className="space-y-3">
              <PolicyRow
                label="SUPER_ADMIN"
                value="MFA Required"
                status="enabled"
                description="Full access — MFA mandatory"
              />
              <PolicyRow
                label="BILLING_ADMIN"
                value="MFA Required"
                status="enabled"
                description="Billing operations — MFA mandatory"
              />
              <PolicyRow
                label="SUPPORT_ADMIN"
                value="MFA Recommended"
                status="optional"
                description="Support team — MFA strongly recommended"
              />
              <PolicyRow
                label="VIEWER"
                value="MFA Optional"
                status="optional"
                description="Read-only — MFA optional"
              />
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Session Policies"
              description="Session lifetime and security settings"
            />
            <div className="space-y-3">
              <PolicyRow label="Session duration" value="30 minutes" status="enabled" description="Auto-logout after inactivity" />
              <PolicyRow label="Token expiry" value="1 hour" status="enabled" description="Firebase ID token lifetime (auto-refresh)" />
              <PolicyRow label="Max concurrent sessions" value="3" status="enabled" description="Per admin user" />
              <PolicyRow label="Revoke on role change" value="Enabled" status="enabled" description="Force re-login when role changes" />
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Password Policy"
              description="Firebase Auth password requirements"
            />
            <div className="space-y-3">
              <PolicyRow label="Minimum length" value="12 characters" status="enabled" />
              <PolicyRow label="Complexity" value="Upper + Lower + Number + Symbol" status="enabled" />
              <PolicyRow label="Expiry" value="Not enforced" status="optional" description="Firebase doesn't enforce expiry — rotate manually" />
              <PolicyRow label="History" value="Not enforced" status="optional" />
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="IP Whitelist"
              description="Restrict admin portal access to specific IPs (CDR §3.2)"
            />
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
              <p className="text-sm text-gray-500">
                IP whitelist feature flag: <code className="text-xs bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded">ipWhitelist</code>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Configure via <code>ADMIN_IP_WHITELIST</code> environment variable on Vercel.
              </p>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Account Lockout"
              description="Failed login protection"
            />
            <div className="space-y-3">
              <PolicyRow label="Max failed attempts" value="5" status="enabled" />
              <PolicyRow label="Lockout duration" value="15 minutes" status="enabled" />
              <PolicyRow label="Reset on success" value="Enabled" status="enabled" />
            </div>
          </AdminCard>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader
              title="Admin Alerts"
              description="Configure when admins receive email notifications"
            />
            <div className="space-y-3">
              <NotificationRow label="Critical security findings" enabled={true} description="New CRITICAL/HIGH severity findings from Security Command Center" />
              <NotificationRow label="CDR compliance issues" enabled={true} description="Failed consent expiry jobs, OAIC escalations" />
              <NotificationRow label="High error rate" enabled={true} description="Error rate spikes (>50 errors in 5 min)" />
              <NotificationRow label="Auth failure spike" enabled={true} description="Brute force detection alerts" />
              <NotificationRow label="Uptime check failures" enabled={true} description="Health check endpoint failures" />
              <NotificationRow label="New admin user created" enabled={false} description="Notification when new admin account added" />
              <NotificationRow label="Impersonation sessions" enabled={false} description="When an admin impersonates a user" />
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Note: Notifications delivered via GCP Cloud Monitoring alert policies.
              Configure channels in <a href="https://console.cloud.google.com/monitoring/alerting" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Cloud Monitoring → Alerting</a>.
            </p>
          </AdminCard>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <AdminCard>
          <AdminCardHeader
            title="Recent Admin Actions"
            description="Latest 50 admin activity events (dual-written to Cloud Logging)"
            action={
              <AdminButton size="sm" variant="outline" onClick={fetchAuditLogs}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </AdminButton>
            }
          />
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : auditLogs.length > 0 ? (
            <AdminTable
              columns={[
                {
                  key: 'timestamp',
                  header: 'Time',
                  render: (l: AuditLog) => (
                    <span className="text-xs font-mono text-gray-500">
                      {new Date(l.timestamp).toLocaleString('en-AU')}
                    </span>
                  ),
                },
                {
                  key: 'admin',
                  header: 'Admin',
                  render: (l: AuditLog) => l.adminUser?.name || l.adminUserId || '—',
                },
                {
                  key: 'action',
                  header: 'Action',
                  render: (l: AuditLog) => (
                    <AdminBadge variant="neutral" size="sm">{l.action}</AdminBadge>
                  ),
                },
                { key: 'description', header: 'Description' },
                {
                  key: 'ipAddress',
                  header: 'IP',
                  render: (l: AuditLog) => <span className="text-xs font-mono">{l.ipAddress}</span>,
                },
              ]}
              data={auditLogs}
              keyExtractor={(l) => l.id}
            />
          ) : (
            <p className="text-center text-gray-500 py-8">No audit logs yet</p>
          )}
        </AdminCard>
      )}

      {/* System Info Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader
              title="GCP Configuration"
              description="Live environment and service account details"
              action={
                <AdminButton size="sm" variant="outline" onClick={fetchHealthCheck}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </AdminButton>
              }
            />
            {healthCheck ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Project ID" value={healthCheck.projectId || '—'} />
                  <InfoRow label="Organization ID" value={healthCheck.orgId || 'Not set'} />
                  <InfoRow
                    label="Service Account"
                    value={healthCheck.serviceAccountEmail || 'Not configured'}
                    truncate
                  />
                  <InfoRow label="Environment" value={healthCheck.vercelEnv || healthCheck.environment} />
                </div>

                <div className="mt-4 space-y-2">
                  <ConfigRow label="Service Account Key" enabled={healthCheck.hasServiceAccountKey} />
                  <ConfigRow label="Organization ID Set" enabled={healthCheck.hasOrgId} />
                  <ConfigRow label="CRON Secret Set" enabled={healthCheck.hasCronSecret} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading...</p>
            )}
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Admin Portal Version"
              description="Current deployment information"
            />
            <div className="space-y-3 text-sm">
              <InfoRow label="Version" value="Phase M complete" />
              <InfoRow label="Build" value={new Date().toISOString().split('T')[0]} />
              <InfoRow label="Auth" value="GCP Identity Platform (Firebase Auth)" />
              <InfoRow label="Database" value="GCP Cloud SQL (PostgreSQL, Sydney)" />
            </div>
          </AdminCard>
        </div>
      )}
    </AdminFeatureGate>
  );
}

// ==========================================================================
// Helper components
// ==========================================================================

function PolicyRow({
  label,
  value,
  status,
  description,
}: {
  label: string;
  value: string;
  status: 'enabled' | 'optional' | 'disabled';
  description?: string;
}) {
  const badgeVariant = status === 'enabled' ? 'success' : status === 'optional' ? 'warning' : 'neutral';
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
        <AdminBadge variant={badgeVariant} size="sm" dot>
          {status === 'enabled' ? 'Enforced' : status === 'optional' ? 'Optional' : 'Disabled'}
        </AdminBadge>
      </div>
    </div>
  );
}

function NotificationRow({ label, enabled, description }: { label: string; enabled: boolean; description: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <AdminBadge variant={enabled ? 'success' : 'neutral'} size="sm" dot>
        {enabled ? 'On' : 'Off'}
      </AdminBadge>
    </div>
  );
}

function InfoRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-mono ${truncate ? 'truncate' : ''}`}>{value}</p>
    </div>
  );
}

function ConfigRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-white/[0.04]">
      <span className="text-sm">{label}</span>
      {enabled ? (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" /> Configured
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="w-3.5 h-3.5" /> Missing
        </span>
      )}
    </div>
  );
}
