# Phase M: Admin Portal — GCP-First Architecture

**Version:** 1.2
**Created:** 2026-04-12
**Last Updated:** 2026-04-12
**Status:** IN PROGRESS — M.1 through M.4 complete, UI modernization in progress
**Depends On:** Phase E (GCP Service Enablement), Phase L (CDR Code-Level Remediation)
**Effort:** ~15-20 dev days across 5 sub-phases
**Source:** CDR Implementation Plan Phase M, CLAUDE.md §12.7 (GCP-First)

---

## 1. Vision & Design Principles

### The Core Rule

> **GCP is the single source of truth for identity, access, security, and observability.
> The Admin Portal is a thin UI layer that orchestrates GCP APIs — it never rebuilds
> capabilities that GCP provides as managed services.**

### Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **GCP Identity is the source of truth** | Admin users authenticate via GCP Identity Platform (Firebase Auth) with custom claims. No separate password tables. |
| 2 | **GCP APIs for user operations** | Suspend/disable users calls `admin.auth().updateUser()`. Session revocation calls `admin.auth().revokeRefreshTokens()`. |
| 3 | **GCP for observability** | Audit logs dual-write to Cloud Logging (7-year CDR retention). Admin reads from Cloud Logging API. |
| 4 | **GCP for security** | Vulnerability status from SCC API. Encryption from Cloud KMS API. WAF from Cloud Armor. |
| 5 | **No custom rebuilds** | If GCP provides it, the admin portal calls the GCP API or links to GCP Console. |
| 6 | **GCP IAM for infrastructure** | Admin roles map to GCP IAM roles. No direct database access from dev machines. |

---

## 2. Current State & Problems

### Admin Portal Status: BROKEN

The admin portal is deployed at `monitrax.com.au/admin/` but non-functional:
- **CDR Compliance page:** "No authentication token provided"
- **Security Monitoring page:** "No authentication token provided"
- **Feature Flags page:** "No authentication token provided"
- **Settings page:** "Failed to fetch audit logs", "No admin users found"
- **Support Tools page:** UI renders but API calls fail

### Root Cause

The admin portal uses a completely custom, parallel identity system:
- `AdminUser` table with SHA256 password hashing (not bcrypt)
- `AdminSession` table with custom 64-char hex token management
- Custom `admin_session` httpOnly cookie
- None of this connects to GCP Identity Platform

After the database migration to GCP Cloud SQL, the admin session/token system is not functioning.

### Why This Is a CDR Compliance Risk

| Issue | CDR Impact |
|-------|------------|
| Admin portal broken → no CDR compliance monitoring | §2.5 (log review) not operational |
| Custom admin auth bypasses GCP Identity Platform | Violates GCP-First (CLAUDE.md §12.7) |
| No MFA session verification for admin | §1.3 (MFA enforcement) gap for admin access |
| Audit logs only in PostgreSQL | §2.7 (90-day log retention) not guaranteed long-term |
| GCP service health shows "unknown" | Cannot demonstrate CDR security posture |

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  GCP IDENTITY PLATFORM                   │
│            Firebase Auth + Custom Claims                 │
│  { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }      │
│  MFA enforced via sign_in_second_factor claim            │
└────────────────────────┬────────────────────────────────┘
                         │ Firebase ID Token (JWT)
                         │ Verified by verifyGCPIdToken()
┌────────────────────────▼────────────────────────────────┐
│                   ADMIN PORTAL UI                        │
│          Thin control plane for GCP services              │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Business │ │ CDR      │ │ GCP    │ │ GCP          │  │
│  │ Ops      │ │ Consent  │ │ Audit  │ │ Security     │  │
│  │ (Custom) │ │ Mgmt     │ │ Viewer │ │ Status       │  │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └──────┬───────┘  │
└───────┼─────────────┼───────────┼─────────────┼──────────┘
        │             │           │             │
        ▼             ▼           ▼             ▼
 ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐
 │ Cloud SQL  │ │ CDR      │ │ Cloud   │ │ SCC + KMS +  │
 │ PostgreSQL │ │ Lifecycle│ │ Logging │ │ Cloud        │
 │            │ │ Service  │ │ API     │ │ Monitoring   │
 │ • Billing  │ │          │ │         │ │ APIs         │
 │ • Flags    │ │ • Delete │ │ • 7yr   │ │              │
 │ • Licenses │ │ • Anon   │ │ • Search│ │ • Findings   │
 │ • Orgs     │ │ • Revoke │ │ • Alert │ │ • Key status │
 └────────────┘ └──────────┘ └─────────┘ └──────────────┘
```

---

## 4. What Stays Custom vs What Moves to GCP

### Custom (Monitrax Business Logic — GCP Has No Equivalent)

| Capability | Reason |
|------------|--------|
| Billing & Subscriptions | Stripe integration, tier pricing, MRR/ARR |
| Organization License Management | Multi-tenant business logic |
| Feature Flag System | App-specific rollout control |
| CDR Consent Aggregation | Monitrax CDR-specific metrics from CDRConsent model |
| User Impersonation | Support debugging tool (audited) |
| CDR Complaint Tracking | CDR compliance record-keeping |

### Moves to GCP (Managed Services Replace Custom Code)

| Current Custom Code | GCP Replacement | API |
|---------------------|-----------------|-----|
| `AdminUser` table + SHA256 passwords | GCP Identity Platform with custom claims | Firebase Admin SDK |
| `AdminSession` table + custom tokens | Firebase ID tokens | `verifyGCPIdToken()` |
| Custom account lockout | `admin.auth().updateUser(uid, { disabled: true })` | Identity Platform API |
| Custom session revocation | `admin.auth().revokeRefreshTokens(uid)` | Identity Platform API |
| MFA check = DB flag | Firebase `sign_in_second_factor` claim | Token verification |
| Audit logs in PostgreSQL only | Dual-write: PostgreSQL + Cloud Logging | Cloud Logging API |
| Custom anomaly detection | Cloud Monitoring alert policies | Monitoring API |
| Custom error tracking | GCP Error Reporting | Error Reporting API |
| "GCP health: unknown" | Real GCP API calls | SCC, Monitoring, KMS APIs |
| Custom log retention | Cloud Logging retention policies | Logging API |

---

## 5. GCP IAM Role Mapping

### Admin Portal Roles → GCP IAM Roles

| Admin Portal Role | Firebase Custom Claim | GCP IAM Roles | Purpose |
|-------------------|----------------------|---------------|---------|
| **SUPER_ADMIN** | `{ monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }` | `roles/iam.admin`, `roles/cloudsql.admin`, `roles/logging.admin`, `roles/monitoring.admin`, `roles/cloudkms.admin` | Full platform + infrastructure control |
| **BILLING_ADMIN** | `{ monitraxAdmin: true, adminRole: 'BILLING_ADMIN' }` | `roles/logging.viewer`, `roles/monitoring.viewer` | Financial ops + read-only infra |
| **SUPPORT_ADMIN** | `{ monitraxAdmin: true, adminRole: 'SUPPORT_ADMIN' }` | `roles/logging.viewer`, `roles/cloudsql.viewer` | User support + log review |
| **VIEWER** | `{ monitraxAdmin: true, adminRole: 'VIEWER' }` | `roles/logging.viewer` | Read-only access |

### GCP IAM Enforcement

- Production database accessible **only** via GCP Console/IAM — no direct SSH/tunnel from dev machines
- Cloud SQL connections require IAM database authentication
- Secrets managed via GCP Secret Manager (not `.env` files in production)
- All GCP resource access logged via Cloud Audit Logs

---

## 6. Admin Auth Flow — Before vs After

### Before (Current — BROKEN)

```
Admin → Email/Password → Custom SHA256 check → AdminUser table
  → Custom 64-char hex token → AdminSession table → admin_session cookie
  → verifyAdminAuth() checks custom session token
  → BROKEN after Cloud SQL migration
```

### After (GCP-First)

```
Admin → Firebase Auth (email/password + MFA) → GCP Identity Platform
  → Firebase ID Token (JWT, signed by Google, 1-hour expiry)
  → verifyGCPIdToken() (same as user auth — already implemented)
  → Check custom claim: token.monitraxAdmin === true
  → Check admin role: token.adminRole (SUPER_ADMIN|BILLING_ADMIN|etc.)
  → Proceed with admin API request
```

### Key Benefits

1. **Single identity provider** — No separate admin identity system to maintain
2. **MFA built-in** — Firebase MFA with `sign_in_second_factor` claim verification
3. **OAuth support** — Admins can use Google SSO (tied to company Google Workspace)
4. **Token rotation** — Firebase handles token refresh automatically
5. **Session management** — Revoke via `revokeRefreshTokens()` (server-side)
6. **Audit trail** — Firebase logs all auth events to Cloud Audit Logs

---

## 7. Implementation Sequence

```
Phase M.1 (Admin Auth) ────────────────────────┐
  M.1.1 Set Firebase custom claims              │
  M.1.2 Create verifyAdminGCPAuth() guard       │
  M.1.3 Migrate admin login to Firebase         │
  M.1.4 Migrate admin API routes                │
  M.1.5 User disable via GCP API               │
  M.1.6 Session revocation via GCP API          │
  M.1.7 Deprecate custom AdminUser auth         │
  M.1.8 Fix broken admin portal                 │
                                                │
Phase M.2 (Observability) ← depends on E ──────┤
  M.2.1 Audit log dual-write to Cloud Logging   │
  M.2.2 Admin audit page → Cloud Logging API    │
  M.2.3 CDR dashboard → real GCP health data    │
  M.2.4 Security page → Cloud Monitoring API    │
  M.2.5 Error page → Error Reporting API        │
                                                │
Phase M.3 (Security) ← depends on E ───────────┤
  M.3.1 SCC findings integration                │
  M.3.2 Cloud KMS key status                    │
  M.3.3 Cloud Armor WAF status                  │
  M.3.4 GCP IAM role documentation              │
                                                │
Phase M.4 (CDR Consent Admin) ← depends on L ──┘
  M.4.1 Real consent metrics from CDRConsent
  M.4.2 Admin consent management actions
  M.4.3 CDR complaint management UI
```

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase Admin SDK adds dependency | Medium | SDK is official, well-maintained, required for Identity Platform |
| Admin users lose existing sessions | Low | Expected — old sessions won't work after migration |
| GCP API rate limits | Low | Admin portal has low traffic; well within free tier |
| Cloud Logging costs | Low | Free tier: 50GB/month; admin logs are small |
| SCC Standard tier limitations | Low | Free for GCP projects; covers Web Security Scanner |

---

## 9. Success Criteria

| Criteria | Verification |
|----------|-------------|
| Admin login works via Firebase Auth | Admin can sign in and access all pages |
| MFA enforced for admin sessions | `sign_in_second_factor` verified on admin routes |
| User suspend calls GCP Identity Platform | `admin.auth().updateUser()` called, user cannot log in |
| Audit logs written to Cloud Logging | `gcloud logging read` returns admin audit entries |
| CDR compliance shows real GCP health | SCC, Monitoring, KMS status no longer "unknown" |
| No custom admin password hashing | Zero references to SHA256 admin password logic |
| Admin portal fully functional | All pages load data — no "token not provided" errors |

---

---

## 10. Admin Portal Navigation Structure (GCP-Aligned)

The admin portal sidebar is organized into **5 sections** that reflect the admin's actual responsibilities now that GCP services are integrated. This replaces the original Phase 33 flat navigation with a structure aligned to the GCP-First principle.

### Section 1: Overview
| Page | Purpose | Data Source |
|------|---------|-------------|
| Dashboard | Platform overview with key metrics | PostgreSQL (app data) |

### Section 2: Business Management (Monitrax Custom Logic)
These pages manage Monitrax-specific business logic that has no GCP equivalent.

| Page | Purpose | Data Source |
|------|---------|-------------|
| Organizations | Multi-tenant org management | PostgreSQL |
| Users | User account management | PostgreSQL + Firebase Auth API |
| Billing | Revenue, subscriptions, refunds | PostgreSQL + Stripe |
| Analytics | Growth, retention, feature usage | PostgreSQL |
| Feature Flags | Global and per-org flag control | PostgreSQL |

### Section 3: GCP Infrastructure (Direct GCP API Integration)
These pages call GCP APIs directly. The admin portal is a thin UI that reads from GCP.

| Page | GCP API | Route |
|------|---------|-------|
| Uptime & Alerts | Cloud Monitoring | `/admin/uptime` |
| Error Tracking | Error Reporting | `/admin/errors` |
| Cloud Scheduler | Cloud Scheduler | `/admin/scheduler` |
| Security Findings | Security Command Center | `/admin/security-findings` |

### Section 4: Compliance & Security
| Page | Purpose | Data Source |
|------|---------|-------------|
| CDR Compliance | Consent, complaints, data lifecycle | PostgreSQL (CDRConsent, CDRComplaint) + GCP health |
| Audit Logs | Searchable audit trail | Cloud Logging API + PostgreSQL fallback |
| Security Monitoring | Auth events, sessions, violations | PostgreSQL + Cloud Logging |

### Section 5: Operations
| Page | Purpose | Data Source |
|------|---------|-------------|
| Support Tools | User impersonation, lookup | PostgreSQL |
| Settings | Admin users, IP whitelist, preferences | PostgreSQL |

---

## 11. UI Design System

The admin portal follows a clean, modern, technical aesthetic:

### Design Principles

| # | Principle | Implementation |
|---|-----------|---------------|
| 1 | **Generous whitespace** | 1600px max-width container, 8px base grid, large padding on cards |
| 2 | **Subtle hierarchy** | Small caps section labels, medium-weight headings, tabular-nums for stats |
| 3 | **Restrained color** | Slate/navy dark mode (`#070B14`, `#0A0F1C`), blue accent only for active/primary |
| 4 | **Soft edges** | `rounded-xl` (12px) for cards, `rounded-lg` (8px) for buttons/inputs |
| 5 | **Layered shadows** | Minimal shadow on rest, soft lift on hover |
| 6 | **Fine borders** | `border-white/[0.06]` in dark mode — almost invisible but provides structure |
| 7 | **Thin icons** | 1.75 stroke width Heroicons (not 2) for a lighter feel |

### Color Tokens

**Dark Mode (Default):**
- Background: `#070B14` (main), `#0A0F1C` (sidebar), `#0F1624` (cards)
- Borders: `rgba(255,255,255,0.06)`
- Text: `white` (primary), `gray-400` (secondary), `gray-500` (tertiary)
- Accent: `blue-500` (primary action), `emerald-500` (success), `amber-500` (warning), `rose-500` (error)

**Light Mode:**
- Background: `gray-50` (main), `white` (sidebar/cards)
- Borders: `gray-200/70`
- Text: `gray-900` (primary), `gray-500` (secondary), `gray-400` (tertiary)

### Typography Scale

| Element | Class | Use |
|---------|-------|-----|
| Page title | `text-[24px] font-semibold tracking-tight` | AdminHeader |
| Card title | `text-[15px] font-semibold tracking-tight` | AdminCardHeader |
| Stat value | `text-[28px] font-semibold tabular-nums` | StatsCard |
| Stat label | `text-[12px] font-medium uppercase tracking-wider` | StatsCard |
| Body | `text-[13px]` | Default |
| Nav item | `text-[13px] font-medium` | Sidebar |
| Section label | `text-[10px] font-semibold uppercase tracking-[0.08em]` | Sidebar sections |

### Component Guidelines

- **StatsCard**: Supports `accentColor` prop (blue, green, amber, red, purple, gray) for categorization
- **AdminCard**: `hoverable` prop for interactive cards with lift-on-hover effect
- **AdminBadge**: Uses dot indicator (`dot={true}`) for status badges
- **AdminButton**: Small shadow on primary/danger for subtle depth

---

## 12. Contextual Help Center (Centralized Help System)

The admin portal includes a **centralized contextual help system** that provides in-context guidance throughout the UI. It addresses the common challenge where technical admin portals are intimidating to first-time users — each control, field, and section can have a small `?` icon that reveals a help panel with explanations, steps, tips, and links to documentation.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│         lib/admin/help-content.ts (single source)       │
│                                                          │
│  export const helpContent = {                            │
│    mfaSetup: { intro, scanQr, verifyCode, ... },         │
│    login: { intro, googleSignIn, forgotPassword, ... },  │
│    settings: { profile, mfaStatus, auditLog, ... },      │
│    cdr: { compliance, consentOverview, revoke, ... },    │
│    gcp: { uptime, errors, scheduler, ... },              │
│    // Future sections just add here                      │
│  };                                                      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│      components/admin/ui/HelpTip.tsx                     │
│                                                          │
│  <HelpTip>    — Small ? icon with collapsible panel      │
│  <HelpBanner> — Page-level dismissible help banner       │
│                                                          │
│  Both consume HelpContent objects from help-content.ts   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Any admin page                          │
│                                                          │
│  import { helpContent } from '@/lib/admin/help-content';  │
│  import { HelpTip } from '@/components/admin/ui/HelpTip'; │
│                                                          │
│  <h3>                                                     │
│    Set up MFA                                             │
│    <HelpTip content={helpContent.mfaSetup.intro} />       │
│  </h3>                                                    │
└─────────────────────────────────────────────────────────┘
```

### HelpContent Schema

Every help entry follows the same structure for consistency:

```typescript
interface HelpContent {
  title: string;              // Heading shown at top of panel
  description?: string;       // Paragraph explanation
  steps?: string[];           // Numbered walkthrough
  tips?: string[];            // Highlighted "lightbulb" tips (amber)
  learnMoreHref?: string;     // Link to docs (external or internal)
  learnMoreLabel?: string;    // Custom link label
}
```

### Components

#### `<HelpTip>` — Inline Help Icon

A small `?` icon (HelpCircle from lucide-react) that appears next to labels, headings, or field captions. Click to toggle an inline panel showing the help content.

**Properties:**
- `content: HelpContent` — What to display
- `align?: 'left' | 'right'` — Panel alignment
- `size?: 'sm' | 'md'` — Icon size
- `className?: string`

**Features:**
- Keyboard accessible (tab + enter)
- Click-outside to close
- Matches admin portal dark mode palette
- Mobile-friendly (click, not hover)

**Usage:**
```tsx
<h3 className="flex items-center gap-1.5">
  Enter verification code
  <HelpTip content={helpContent.mfaSetup.verifyCode} />
</h3>
```

#### `<HelpBanner>` — Page-Level Help Banner

A larger dismissible banner that appears at the top of complex pages. Users can dismiss it (state persisted in localStorage) and re-show it via a "Show help" button.

**Properties:**
- `content: HelpContent` — What to display
- `storageKey?: string` — Unique key to remember dismissed state
- `className?: string`

**Usage:**
```tsx
<HelpBanner
  content={helpContent.mfaSetup.intro}
  storageKey="mfa-intro"
/>
```

### Design Principles

1. **Contextual, not intrusive** — Help is available but never forced. Users see only a small `?` icon until they need it.
2. **Progressive disclosure** — Short title → description → optional steps → optional tips → optional link.
3. **Centralized content** — All wording in one file. Non-developers can review/edit without touching UI code.
4. **Localization-ready** — Structure supports wrapping strings in a future `t()` function without restructuring.
5. **Dismissible page banners** — First-time users see the banner; returning users can hide it.
6. **Consistent visual language** — Every help entry uses the same icon, colors, typography.

### Content Guidelines

When writing help text, follow these rules:

| Field | Guideline |
|-------|-----------|
| **title** | 3-6 words. Frame as a question when possible ("Why is MFA required?") |
| **description** | 1-3 sentences. Plain English, no jargon. |
| **steps** | Use only for procedural instructions. 3-7 steps max. Start each with an action verb. |
| **tips** | Short gotchas or best practices. Max 3 tips per entry. |
| **learnMoreHref** | Link to docs or external resources for deep dives. |

### How to Add Help to a New Section

Adding help text to a new page/section takes less than 2 minutes:

**Step 1**: Add content to `lib/admin/help-content.ts`:

```typescript
export const billingHelp: Record<string, HelpContent> = {
  overview: {
    title: 'Billing Dashboard',
    description: 'Real-time revenue metrics for Monitrax.',
    tips: ['MRR is calculated from active subscriptions.'],
  },
  refund: {
    title: 'Processing a Refund',
    description: 'Refunds are processed via Stripe immediately.',
    steps: [
      'Find the transaction',
      'Click Refund',
      'Enter reason',
      'Confirm',
    ],
  },
};

export const helpContent = {
  // ... existing
  billing: billingHelp,
};
```

**Step 2**: Import and use in your component:

```tsx
import { HelpTip } from '@/components/admin/ui/HelpTip';
import { helpContent } from '@/lib/admin/help-content';

<h3 className="flex items-center gap-1.5">
  Billing Overview
  <HelpTip content={helpContent.billing.overview} />
</h3>
```

That's it. No styling, no markup — the component handles everything.

### Current Coverage

| Section | Pages with Help |
|---------|----------------|
| **MFA Setup** | ✅ All 4 wizard steps (intro, scan, verify, complete) |
| **Admin Login** | ✅ Title, Forgot Password |
| **Admin Settings** | ⬜ Pending — schema ready in help-content.ts |
| **CDR Compliance** | ⬜ Pending — schema ready in help-content.ts |
| **GCP Pages** | ⬜ Pending — schema ready in help-content.ts |

Help content for all other sections is already defined in `lib/admin/help-content.ts` — just needs to be wired into each page.

### Future Enhancements

- **First-time guided tour**: A welcome overlay that walks new admins through the portal's key areas. Could be built on top of the existing HelpContent structure.
- **In-app search**: A global help search that queries `helpContent` and jumps the user to the relevant section.
- **Feedback loop**: "Was this helpful?" button on each help tip that logs analytics.
- **Localization**: Wrap all strings in `t()` for multi-language support.
- **Per-role help**: Different help text based on admin role (SUPER_ADMIN sees more technical details than VIEWER).

---

## 13. Post-Implementation: Operational & BAU Support Documentation

**After Phase M implementation is complete**, the following operational documents MUST be created to enable admin portal support team training and ongoing BAU (Business As Usual) operations:

### Required Documents

| Document | Path | Purpose |
|----------|------|---------|
| Admin Portal Operations Guide | `docs/operational/admin/01_ADMIN_PORTAL_OPERATIONS.md` | Step-by-step procedures for all admin operations: user management, org management, billing, consent management, CDR compliance monitoring |
| Admin Portal Troubleshooting Runbook | `docs/operational/admin/02_ADMIN_TROUBLESHOOTING_RUNBOOK.md` | Common issues, error codes, resolution steps, escalation procedures |
| GCP Service Operations for Admins | `docs/operational/admin/03_GCP_SERVICE_OPERATIONS.md` | How admin portal interacts with GCP services (Identity Platform, Cloud Logging, Monitoring, SCC), how to navigate GCP Console for deeper investigation |
| Admin Onboarding & Training Guide | `docs/operational/admin/04_ADMIN_ONBOARDING_TRAINING.md` | New admin setup: Firebase Auth account creation, custom claims assignment, GCP IAM role provisioning, MFA enrollment, first-login walkthrough |
| CDR Compliance Admin Procedures | `docs/operational/admin/05_CDR_COMPLIANCE_PROCEDURES.md` | CDR-specific admin procedures: consent review, data deletion requests, complaint handling, OAIC escalation, breach notification via admin portal |
| Admin Portal BAU Support Playbook | `docs/bau-framework/ADMIN_PORTAL_BAU_PLAYBOOK.md` | Daily/weekly/monthly admin tasks, monitoring checklist, compliance verification procedures, incident response from admin perspective |

### Document Creation Timing

- Documents created **after** Phase M implementation is complete (not before — avoids documenting the old broken system)
- Each sub-phase (M.1-M.4) should update the relevant sections as features are implemented
- Final review and polish after all Phase M sub-phases are complete

---

*Last Updated: 2026-04-12*
*Status: PLANNED — awaiting Phase E completion for GCP service dependencies*
