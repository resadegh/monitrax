/**
 * Admin Portal Help Content — Centralized library
 *
 * All user-facing help text for the admin portal lives here. This keeps
 * content separate from UI code, makes it easy to update, and allows
 * for future localization.
 *
 * Usage:
 *   import { helpContent } from '@/lib/admin/help-content';
 *   <HelpTip content={helpContent.mfaSetup.intro} />
 *
 * Structure:
 *   helpContent.<section>.<key> → HelpContent object
 *
 * Each HelpContent has:
 *   - title: string (required)
 *   - description: string (optional)
 *   - steps: string[] (optional — numbered steps)
 *   - tips: string[] (optional — highlighted tips in amber box)
 *   - learnMoreHref: string (optional — link to docs)
 *   - learnMoreLabel: string (optional — link label)
 */

import type { HelpContent } from '@/components/admin/ui/HelpTip';

// ============================================================================
// MFA SETUP WIZARD
// ============================================================================

export const mfaSetupHelp: Record<string, HelpContent> = {
  intro: {
    title: 'Why is MFA required?',
    description:
      'Monitrax processes CDR-regulated financial data. Privileged admin roles (SUPER_ADMIN, BILLING_ADMIN) must use multi-factor authentication to protect access to this data per CDR Rules §1.3 and Basiq accreditation.',
    tips: [
      'MFA enrollment is permanent — you can change factors later but cannot disable MFA entirely.',
      'Once enrolled, every admin portal login will require your authenticator code.',
    ],
    learnMoreHref: 'https://support.google.com/accounts/answer/1066447',
    learnMoreLabel: 'About authenticator apps',
  },

  authenticatorApps: {
    title: 'Which authenticator app should I use?',
    description: 'Any TOTP-compatible authenticator app works. These are the most popular:',
    tips: [
      'Google Authenticator — simplest, available on iOS and Android',
      'Authy — includes cloud backup across devices',
      '1Password / Bitwarden — if you already use a password manager with TOTP support',
      'Microsoft Authenticator — if your org uses Microsoft 365',
    ],
  },

  scanQr: {
    title: 'How to scan the QR code',
    description: 'Your authenticator app has a built-in camera scanner. Point it at the QR code and the account will be added automatically.',
    steps: [
      'Open your authenticator app',
      'Tap the + button (usually top-right)',
      'Choose "Scan QR code" (not "Enter key manually")',
      'Point the camera at the QR code on screen',
      'The app will add "Monitrax" to its list',
    ],
    tips: [
      'If you cannot scan (e.g., running on the same device), use the manual key shown below the QR code.',
    ],
  },

  manualKey: {
    title: 'Manual key entry',
    description: 'If you cannot scan the QR code (for example, if you are running Monitrax on your phone), you can enter the secret key manually.',
    steps: [
      'Tap "Enter key manually" in your authenticator app',
      'For "Account name", enter your email',
      'For "Key", paste the secret shown on screen',
      'Save the entry',
    ],
    tips: [
      'The secret is case-insensitive and spaces do not matter.',
      'Do not share this secret with anyone — treat it like a password.',
    ],
  },

  verifyCode: {
    title: 'Where is the 6-digit code?',
    description: 'After adding Monitrax to your authenticator app, it will show a 6-digit code that refreshes every 30 seconds.',
    steps: [
      'Open your authenticator app',
      'Find the "Monitrax" entry you just added',
      'Read the 6-digit code next to it',
      'Enter the code here before it expires (~30 seconds)',
    ],
    tips: [
      'If the code is rejected, wait for a new one to appear (countdown to 0) and try again.',
      'Make sure your phone clock is synced — TOTP codes are time-based.',
    ],
  },

  authenticatorName: {
    title: 'What is this name for?',
    description: 'This is a friendly label shown when you sign in or when you need to manage your enrolled factors. Choose something you will recognize like "iPhone" or "Work laptop".',
    tips: [
      'You can enroll multiple factors with different names (e.g., "iPhone" and "Backup tablet").',
    ],
  },

  complete: {
    title: 'What happens after enrollment?',
    description: 'Firebase now has your MFA secret. But your current session token does not include the MFA claim because you signed in before MFA was enabled.',
    steps: [
      'Sign out (button below)',
      'Sign back in with your email/password',
      'Firebase will prompt you for your authenticator code',
      'After MFA challenge, you will be redirected to the dashboard',
    ],
    tips: [
      'From now on, every admin portal login will require MFA.',
    ],
  },
};

// ============================================================================
// ADMIN LOGIN
// ============================================================================

export const loginHelp: Record<string, HelpContent> = {
  intro: {
    title: 'Admin Portal Sign-In',
    description:
      'This portal is for authorized Monitrax staff only. You can sign in with Google (recommended) or with your email and password.',
    tips: [
      'Google Sign-In uses your Google account 2FA — no extra setup needed.',
      'Email/password users must enroll in MFA via the authenticator app after first sign-in.',
    ],
  },

  googleSignIn: {
    title: 'Google Sign-In',
    description:
      'Sign in with your Google Workspace or personal Google account. Your account must be linked to a Monitrax admin user (by email).',
    tips: [
      'Enable 2-Step Verification on your Google account for maximum security.',
      'Your Google account must be the same email used to create your admin user.',
    ],
  },

  emailPassword: {
    title: 'Email & Password Sign-In',
    description: 'Use the email and password you were given by your administrator. If this is your first sign-in, you will be prompted to enroll in MFA immediately after.',
    tips: [
      'Passwords must be at least 12 characters with complexity requirements.',
      'If you forgot your password, use "Forgot password?" below.',
    ],
  },

  forgotPassword: {
    title: 'Forgot Password',
    description: 'Enter your email, then click "Forgot password?" We will send a password reset link to your inbox.',
    steps: [
      'Enter your email in the email field',
      'Click "Forgot password?"',
      'Check your email for the reset link',
      'Follow the link to create a new password',
      'Return here to sign in',
    ],
    tips: [
      'The reset link expires in 1 hour.',
      'If you do not receive the email, check spam and verify the email is registered as an admin.',
    ],
  },
};

// ============================================================================
// ADMIN SETTINGS
// ============================================================================

export const settingsHelp: Record<string, HelpContent> = {
  profile: {
    title: 'Your Admin Profile',
    description: 'This tab shows the Firebase account behind your admin session. All authentication is handled by GCP Identity Platform.',
    tips: [
      'Your Firebase UID is the unique identifier used across the platform.',
      'The "Sign-in Provider" tells you whether you logged in via password, Google, etc.',
    ],
  },

  mfaStatus: {
    title: 'Multi-Factor Authentication',
    description: 'Shows your MFA enrollment status. SUPER_ADMIN and BILLING_ADMIN accounts must have at least one factor enrolled.',
    steps: [
      'Click "Enroll Now" to start MFA setup',
      'Scan the QR code with your authenticator app',
      'Enter the 6-digit code to verify',
      'Sign out and back in to activate MFA',
    ],
    tips: [
      'You can enroll multiple factors (e.g., phone + authenticator app) for redundancy.',
    ],
  },

  adminUsers: {
    title: 'Admin Users',
    description: 'Manage all accounts with admin portal access. Only SUPER_ADMIN can add, remove, or change roles of other admins.',
    steps: [
      'Click "+ Add Admin" to create a new admin account',
      'Enter the new admin\'s email, name, and role',
      'The new admin receives a welcome email with sign-in instructions',
      'On first sign-in, they must enroll in MFA (if SUPER_ADMIN or BILLING_ADMIN)',
    ],
    tips: [
      'Deactivated admins cannot sign in but their audit trail is preserved.',
      'Admins inactive for 90+ days are flagged automatically (CDR §1.7).',
    ],
  },

  securityPolicies: {
    title: 'Platform Security Policies',
    description: 'View the security policies enforced across the admin portal. These are configured via code and environment variables.',
    tips: [
      'MFA is enforced for SUPER_ADMIN and BILLING_ADMIN automatically.',
      'IP whitelist is controlled by ADMIN_IP_WHITELIST env var on Vercel.',
      'Session duration is controlled by Firebase (1-hour token with auto-refresh).',
    ],
    learnMoreHref: '/admin/docs/security',
    learnMoreLabel: 'Security policy docs',
  },

  notifications: {
    title: 'Admin Notification Preferences',
    description: 'Configure which alerts you want to receive via email. Notifications are delivered through GCP Cloud Monitoring alert policies.',
    tips: [
      'Critical findings are always sent regardless of this setting.',
      'Configure notification channels in GCP Console → Monitoring → Alerting.',
    ],
    learnMoreHref: 'https://console.cloud.google.com/monitoring/alerting',
    learnMoreLabel: 'Open Cloud Monitoring',
  },

  auditLog: {
    title: 'Admin Audit Log',
    description: 'Every admin action is logged with timestamp, admin ID, action, target, and IP address. Logs are dual-written to PostgreSQL (fast queries) and Cloud Logging (365-day retention).',
    tips: [
      'Use the Refresh button to load the latest entries.',
      'For historical queries (>90 days old), use the Cloud Logging API directly.',
    ],
  },

  systemInfo: {
    title: 'System Information',
    description: 'Live GCP configuration status via the healthcheck endpoint. Useful for diagnosing environment-related issues.',
    tips: [
      'All fields should show "Configured" in production.',
      'The service account email is monitrax-backend — it needs specific IAM roles. See the GCP Operations doc.',
    ],
  },
};

// ============================================================================
// CDR COMPLIANCE
// ============================================================================

export const cdrHelp: Record<string, HelpContent> = {
  compliance: {
    title: 'CDR Compliance Dashboard',
    description:
      'Shows the real-time status of Monitrax\'s Consumer Data Right (CDR) compliance. All metrics are aggregated — no raw financial data is displayed here.',
    tips: [
      'CDR data is never shown in the admin portal — only counts and status.',
      'Click "Refresh" after user actions to see updated metrics.',
    ],
    learnMoreHref: 'https://www.accc.gov.au/consumers/consumer-data-right',
    learnMoreLabel: 'About CDR',
  },

  consentOverview: {
    title: 'Consent Overview',
    description:
      'Shows the lifecycle state of all CDR consents held by Monitrax. A consent allows us to collect CDR data on behalf of a consumer from their bank.',
    tips: [
      'Active: User has granted consent and it has not expired',
      'Expiring: Will expire in next 30 days — user should renew',
      'Revoked: User or bank revoked consent; CDR data deleted',
      'Expired: Consent reached its expiry date; CDR data deleted',
    ],
  },

  basiqConnections: {
    title: 'Bank Connections (Basiq)',
    description:
      'Direct bank connections via Basiq. Each connection allows Monitrax to sync transactions and balances for the connected accounts.',
    tips: [
      'Connections can be disabled by the user at any time.',
      'Bank-side revocations are detected via the Basiq webhook.',
    ],
  },

  complianceChecklist: {
    title: 'Compliance Checklist',
    description: 'Real-time checks of key CDR compliance requirements. All items should show "pass" for full compliance.',
    tips: [
      'Warning items should be investigated immediately.',
      'Failed items block Basiq accreditation.',
    ],
  },

  gcpServices: {
    title: 'GCP Services Health',
    description: 'Status of required GCP services for CDR compliance. Services marked as "enabled" are live; "planned" are not yet configured.',
    tips: [
      'Cloud Logging: Required for 365-day audit log retention',
      'Security Command Center: Required for vulnerability scanning',
      'Cloud Scheduler: Required for consent expiry automation',
      'Cloud KMS: Required for encryption key management',
    ],
  },

  revoke: {
    title: 'Revoke CDR Consent',
    description: 'Revoking consent triggers immediate deletion of the user\'s CDR data (within 24 hours per Basiq §5.6).',
    tips: [
      'This action is irreversible — the user must reconnect their bank to grant consent again.',
      'All CDR-derived data (budgets, cashflow, insights) will also be deleted.',
    ],
    learnMoreHref: '/docs/operational/admin/05_CDR_COMPLIANCE_PROCEDURES.md',
    learnMoreLabel: 'Revoke procedure',
  },
};

// ============================================================================
// GCP INFRASTRUCTURE
// ============================================================================

export const gcpHelp: Record<string, HelpContent> = {
  uptime: {
    title: 'Uptime & Alerts',
    description:
      'Live data from GCP Cloud Monitoring. Shows all uptime checks configured for Monitrax and any alert policies that would fire on failure.',
    tips: [
      'Uptime checks run every 5 minutes by default.',
      'Alert policies trigger notifications to email/SMS when checks fail.',
      'Create new checks in GCP Console — the admin portal is read-only.',
    ],
    learnMoreHref: 'https://cloud.google.com/monitoring/uptime-checks',
    learnMoreLabel: 'About uptime checks',
  },

  errors: {
    title: 'Error Tracking',
    description:
      'Grouped application errors from GCP Error Reporting. Errors are auto-grouped by stack trace signature so you can see the top recurring issues.',
    tips: [
      'Click an error group to view it in GCP Console for full stack traces.',
      'Filter by time range to focus on recent issues.',
      'Resolve errors in GCP Console — the admin portal is read-only.',
    ],
    learnMoreHref: 'https://cloud.google.com/error-reporting',
    learnMoreLabel: 'About Error Reporting',
  },

  scheduler: {
    title: 'Cloud Scheduler',
    description:
      'Manage scheduled jobs that run on the Monitrax backend. The most critical job is monitrax-cdr-lifecycle which handles consent expiry and CDR data deletion.',
    steps: [
      'View job status (Enabled/Paused/Disabled)',
      'See last run and next run times',
      'Use "Run Now" to trigger manually (SUPER_ADMIN only)',
      'Pause/Resume a job if needed (SUPER_ADMIN only)',
    ],
    tips: [
      'Do not pause the CDR lifecycle job unless investigating an issue — it runs daily at 02:00 UTC.',
    ],
  },

  securityFindings: {
    title: 'Security Findings',
    description:
      'Active security findings from GCP Security Command Center. Findings are grouped by severity: Critical, High, Medium, Low.',
    tips: [
      'Critical findings should be resolved immediately.',
      'SCC requires GCP_ORGANIZATION_ID env var and org-level IAM access.',
      'Resolve findings in GCP Console — the admin portal is read-only.',
    ],
    learnMoreHref: 'https://cloud.google.com/security-command-center',
    learnMoreLabel: 'About SCC',
  },
};

// ============================================================================
// AGGREGATE EXPORT
// ============================================================================

export const helpContent = {
  mfaSetup: mfaSetupHelp,
  login: loginHelp,
  settings: settingsHelp,
  cdr: cdrHelp,
  gcp: gcpHelp,
};

export default helpContent;
