# GCP Identity Platform Migration - Implementation Prompt

> Copy everything below this line into a new Claude Code session.

---

## Task: Migrate Monitrax Authentication to Google Cloud Identity Platform (Firebase Auth)

You are working on **Monitrax**, a Next.js 15 personal finance app. The goal is to replace the entire custom authentication stack with **Google Cloud Identity Platform (Firebase Auth)** to meet **Basiq CDR (Consumer Data Right) compliance requirements** for Australian Open Banking.

### Why This Migration

Monitrax integrates with **Basiq** (Australian Open Banking API) and must pass their CDR compliance checklist. The current auth system is custom-built with critical production gaps:
- Session/token storage is **in-memory** (lost on server restart)
- JWT has a **hardcoded fallback secret** in `lib/auth.ts`
- OAuth CSRF state is **in-memory** (not distributed)
- Rate limiting is **in-memory** (not persistent)
- No managed password policy enforcement
- No managed brute force protection
- MFA is custom-implemented (~1,211 lines) instead of using a managed service

By migrating to GCP Identity Platform, we satisfy these Basiq requirements automatically:
- Unique user accounts with managed identity
- MFA (TOTP, SMS, Phone) - managed by Google
- Strong password policies - configurable in Firebase console
- Session management - Firebase handles token refresh/rotation
- Account lockout/brute force - automatic
- Admin user review - Firebase console shows all users
- Audit logging - Firebase Auth events auto-logged to Cloud Audit Logs

---

### Current Architecture (What You're Replacing)

**Hosting**: Vercel (frontend) + Render (backend + PostgreSQL in Oregon)
**Database**: Render PostgreSQL via Prisma ORM
**Current Auth**: Custom JWT + bcryptjs + jsonwebtoken

#### Files to DELETE (replaced by Firebase Auth) - ~3,600 lines:

| File | Lines | What It Does | Firebase Replacement |
|---|---|---|---|
| `lib/auth/oauth.ts` | 607 | Custom OAuth for Google/Apple/Microsoft/Facebook | Firebase OAuth providers |
| `lib/auth/magicLink.ts` | 349 | Custom magic link/passwordless auth | Firebase email link sign-in |
| `lib/auth/passkey.ts` | 713 | Custom WebAuthn/FIDO2 (incomplete) | Firebase passkey support |
| `lib/auth/refreshToken.ts` | 410 | Custom refresh token rotation (in-memory) | Firebase token refresh |
| `lib/session/sessionManager.ts` | 269 | Custom session management (in-memory) | Firebase session management |
| `lib/security/mfa.ts` | 1,211 | Custom TOTP/SMS/Email MFA | Firebase MFA |
| `lib/security/emailVerification.ts` | 416 | Custom email verification via Resend | Firebase email verification |
| `lib/security/accountLockout.ts` | 531 | Custom brute force protection | Firebase automatic protection |

#### Files to REFACTOR (keep but change auth mechanism):

| File | Lines | Change Required |
|---|---|---|
| `lib/auth.ts` | 119 | Replace `generateToken`/`verifyToken` with Firebase Admin `verifyIdToken()`. Remove bcryptjs/jsonwebtoken. Keep `getCurrentUser()` but refactor to use Firebase. |
| `lib/auth/context.ts` | 88 | Refactor `getAuthContext()` to decode Firebase ID token instead of custom JWT |
| `lib/auth/guards.ts` | 216 | Refactor guards to use Firebase Admin SDK `verifyIdToken()` |
| `lib/auth/permissions.ts` | 205 | KEEP AS-IS. Store user roles as Firebase Custom Claims. Permission logic stays local. |
| `lib/security/auditLog.ts` | 458 | KEEP AS-IS. Continue logging to PostgreSQL. Optionally also send to Cloud Logging. |
| `lib/security/rateLimit.ts` | 233 | KEEP for now (application-level rate limiting). Firebase handles auth-level rate limiting. |
| `lib/middleware/apiSecurity.ts` | 424 | Refactor `withSecurity()` to verify Firebase tokens instead of custom JWTs. Remove session/MFA checks (Firebase handles these). |
| `lib/session/sessionTracking.ts` | 404 | Refactor to track Firebase sessions. Keep device fingerprinting and security checks. |
| `middleware.ts` | 59 | KEEP AS-IS (security headers). No changes needed. |

#### API Routes to DELETE (replaced by Firebase client SDK):

All routes under `app/api/auth/` that handle authentication flows:

**DELETE these directories entirely:**
- `app/api/auth/oauth/` (4 provider routes)
- `app/api/auth/callback/` (4 callback routes)
- `app/api/auth/magic-link/` (request + verify)
- `app/api/auth/passkey/` (register options/verify, authenticate options/verify, list, [id])
- `app/api/auth/mfa/totp/` (setup, enable, verify, disable)
- `app/api/auth/mfa/sms/` (setup, verify, resend, disable)
- `app/api/auth/mfa/email/` (send, verify)
- `app/api/auth/mfa/backup-codes/` (regenerate)
- `app/api/auth/mfa/methods/`
- `app/api/auth/login/`
- `app/api/auth/register/`
- `app/api/auth/verify-email/`
- `app/api/auth/resend-verification/`
- `app/api/auth/password/change/`
- `app/api/auth/providers/`

**KEEP and refactor:**
- `app/api/auth/me/route.ts` - Refactor to decode Firebase token and return user profile
- `app/api/auth/logout/route.ts` - Refactor to revoke Firebase session

#### Prisma Schema Models Affected:

**Models that become OPTIONAL (Firebase manages this data, but keep for local reference/audit):**

```prisma
// These can be simplified or removed since Firebase manages them:
model MFAMethod { ... }        // Firebase MFA replaces this
model PasskeyCredential { ... } // Firebase passkeys replaces this
model UserSession { ... }       // Firebase sessions replaces this
model MagicLink { ... }         // Firebase email links replaces this
model OAuthAccount { ... }      // Firebase OAuth replaces this
model LoginAttempt { ... }      // Firebase brute force replaces this
model EmailMFACode { ... }      // Firebase MFA replaces this
```

**Models to KEEP:**
```prisma
model User { ... }         // Keep but add `firebaseUid String? @unique` field
model AuditLog { ... }     // Keep for application-level audit
model Organization { ... } // Keep for multi-tenancy
model OrganizationMember { ... } // Keep for org roles
```

**User model changes:**
- ADD: `firebaseUid String? @unique` - Links local user to Firebase UID
- KEEP: `email`, `name`, `role`, `mfaEnabled`, `emailVerified` - Synced from Firebase
- KEEP: `basiqUserId` - Basiq integration
- MAKE OPTIONAL: `password` (already nullable) - Firebase manages passwords
- KEEP: All financial relationships (properties, loans, accounts, etc.)

#### Dependencies to ADD:
```
npm install firebase-admin firebase
```

#### Dependencies to REMOVE (after migration):
```
# These become unused:
bcryptjs (and @types/bcryptjs) - Firebase handles password hashing
jsonwebtoken (and @types/jsonwebtoken) - Firebase handles tokens
twilio - Firebase Phone Auth replaces SMS MFA
resend - Firebase handles email verification (keep if used for other emails)
```

#### Environment Variables:

**ADD these:**
```env
# Firebase Admin SDK (server-side)
FIREBASE_PROJECT_ID="your-gcp-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Client SDK (client-side, these are public)
NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
```

**REMOVE these (after migration):**
```env
JWT_SECRET              # Firebase manages tokens
NEXTAUTH_URL            # Not using NextAuth
NEXTAUTH_SECRET         # Not using NextAuth
GOOGLE_CLIENT_ID        # Configured in Firebase console
GOOGLE_CLIENT_SECRET    # Configured in Firebase console
GOOGLE_REDIRECT_URI     # Firebase handles redirects
FACEBOOK_CLIENT_ID      # Configured in Firebase console
FACEBOOK_CLIENT_SECRET  # Configured in Firebase console
FACEBOOK_REDIRECT_URI   # Firebase handles redirects
APPLE_CLIENT_ID         # Configured in Firebase console
APPLE_CLIENT_SECRET     # Configured in Firebase console
APPLE_REDIRECT_URI      # Firebase handles redirects
MICROSOFT_CLIENT_ID     # Configured in Firebase console
MICROSOFT_CLIENT_SECRET # Configured in Firebase console
MICROSOFT_REDIRECT_URI  # Firebase handles redirects
TWILIO_ACCOUNT_SID      # Firebase Phone Auth replaces Twilio
TWILIO_AUTH_TOKEN        # Firebase Phone Auth replaces Twilio
TWILIO_PHONE_NUMBER     # Firebase Phone Auth replaces Twilio
```

---

### Implementation Plan

#### Phase 1: Firebase Admin SDK Setup (Server-Side)

1. Create `lib/firebase/admin.ts`:
   - Initialize Firebase Admin SDK with service account credentials
   - Export `auth` instance for `verifyIdToken()`, `createCustomToken()`, `setCustomClaims()`
   - Singleton pattern (initialize once)

2. Create `lib/firebase/auth.ts`:
   - `verifyFirebaseToken(idToken: string): Promise<DecodedIdToken>` - Verify Firebase ID tokens
   - `getOrCreateLocalUser(firebaseUser: DecodedIdToken): Promise<User>` - Find or create local Prisma user from Firebase UID
   - `syncUserRole(userId: string, role: UserRole): Promise<void>` - Set Firebase Custom Claims for RBAC
   - `revokeUserSessions(firebaseUid: string): Promise<void>` - Revoke all Firebase sessions

3. Refactor `lib/auth.ts`:
   - Remove `generateToken()`, `verifyToken()`, `hashPassword()`, `verifyPassword()`
   - Replace `getCurrentUser()` to extract Firebase ID token from Authorization header and verify with Admin SDK
   - Keep `extractTokenFromHeader()` (still needed for Bearer token extraction)

4. Refactor `lib/auth/context.ts`:
   - `getAuthContext()` should call Firebase Admin `verifyIdToken()` and then look up local user by `firebaseUid`
   - Return same `AuthContext` type but populated from Firebase token + local user record

5. Refactor `lib/auth/guards.ts`:
   - All guards should verify Firebase ID token instead of custom JWT
   - Permission checks remain the same (using local RBAC from `permissions.ts`)

6. Refactor `lib/middleware/apiSecurity.ts`:
   - Replace JWT verification with Firebase `verifyIdToken()`
   - Remove custom session validation (Firebase manages sessions)
   - Remove custom MFA checks (Firebase enforces MFA before issuing token)
   - Keep: rate limiting, IP restrictions, permission checks, audit logging

#### Phase 2: Firebase Client SDK Setup (Frontend)

1. Create `lib/firebase/client.ts`:
   - Initialize Firebase client SDK
   - Export `auth` instance

2. Create `lib/firebase/hooks.ts` (React hooks):
   - `useAuth()` - Returns current user, loading state, sign-in/sign-out methods
   - `useFirebaseToken()` - Returns current ID token for API calls
   - Automatically refreshes tokens before expiry

3. Create `components/auth/AuthProvider.tsx`:
   - React context provider wrapping Firebase `onAuthStateChanged`
   - Provides user state to entire app
   - Handles token refresh and session persistence

4. Create/update auth UI components:
   - `components/auth/LoginForm.tsx` - Email/password + OAuth buttons using Firebase
   - `components/auth/RegisterForm.tsx` - Firebase `createUserWithEmailAndPassword`
   - `components/auth/MFAEnrollment.tsx` - Firebase MFA enrollment (TOTP)
   - `components/auth/ForgotPassword.tsx` - Firebase `sendPasswordResetEmail`

5. Update API client/fetch wrapper:
   - All API calls should include Firebase ID token in Authorization header
   - Token auto-refresh before API calls

#### Phase 3: User Migration Strategy

1. Add `firebaseUid` field to User model in Prisma schema
2. Create migration endpoint `app/api/auth/migrate/route.ts`:
   - For existing users: When they first log in via Firebase, match by email and link `firebaseUid`
   - For new users: Create both Firebase account and local User record
3. Create admin script to bulk-migrate existing users to Firebase:
   - Read all users from PostgreSQL
   - Create corresponding Firebase users (preserving email)
   - Store `firebaseUid` back in PostgreSQL
   - Note: Passwords CANNOT be migrated (bcrypt hashes are one-way). Users must reset password on first Firebase login.

#### Phase 4: Delete Legacy Auth Code

After migration is verified:
1. Delete all files listed in "Files to DELETE" section
2. Remove unused API routes
3. Remove unused Prisma models (or mark as deprecated)
4. Remove unused npm dependencies
5. Update barrel exports (`lib/auth/index.ts`, `lib/security/index.ts`)

#### Phase 5: Additional GCP Services (Post-Auth Migration)

After Firebase Auth is working:

1. **Cloud Secret Manager** - Create `lib/gcp/secretManager.ts`:
   - Replace env var secrets with Secret Manager lookups
   - Migrate: `BASIQ_API_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`
   - Cache secrets in memory with TTL

2. **Cloud Logging** - Create `lib/gcp/logging.ts`:
   - Replace `console.log` in `lib/utils/logger.ts` with Cloud Logging structured logs
   - Set retention to 400 days (exceeds Basiq 90-day requirement)
   - Create log-based metrics for security dashboards

3. **Cloud KMS** - Create `lib/gcp/kms.ts`:
   - Encrypt sensitive database fields (Basiq tokens, OAuth tokens if any remain)
   - Sign audit log entries for tamper protection

4. **Cloud DLP** - For CDR data de-identification if required by Basiq

---

### Critical Rules

1. **DO NOT break existing functionality.** The app must work at every step. Users should be able to use the app throughout migration.
2. **Keep `lib/auth/permissions.ts` exactly as-is.** The RBAC logic is correct and well-tested. Store roles as Firebase Custom Claims but keep permission checking local.
3. **Keep `lib/security/auditLog.ts` exactly as-is.** Audit logging to PostgreSQL must continue. This is required for CDR compliance.
4. **Keep all financial models and APIs untouched.** This migration is AUTH ONLY. Do not modify any financial services, engines, or API routes outside of auth.
5. **Follow the existing CLAUDE.md protocol** - read blueprint docs, create feature branch, update documentation, create PR.
6. **Test with `npm run build` and `npm run lint`** before every commit.
7. **The Render PostgreSQL database stays.** We are NOT migrating the database. Only auth moves to Firebase.

### Existing GCP Usage (Already in the Project)

The project already uses these Google Cloud services:
- `@google-cloud/storage` v7.18.0 - Document storage in GCS bucket `monitrax-documents`
- `@google-cloud/vision` v5.3.4 - OCR for document intelligence
- `@google/generative-ai` v0.24.1 - Gemini AI for financial analysis
- Google Maps API - Property geocoding

All use the same GCP project. Firebase should be enabled in the **same GCP project** so credentials and IAM are unified.

### Environment Variables Currently in Use

```env
# Database (KEEP - stays on Render)
DATABASE_URL

# Auth (REPLACE with Firebase)
JWT_SECRET
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET / FACEBOOK_REDIRECT_URI
APPLE_CLIENT_ID / APPLE_CLIENT_SECRET / APPLE_REDIRECT_URI
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_REDIRECT_URI
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER

# GCP (KEEP - already configured)
GCS_PROJECT_ID
GCS_BUCKET_NAME
GCS_SERVICE_ACCOUNT_KEY
GOOGLE_MAPS_API_KEY
GEMINI_API_KEY

# Basiq (KEEP - Open Banking)
BASIQ_API_KEY
BASIQ_API_URL

# Email (KEEP if used for non-auth emails, otherwise REMOVE)
RESEND_API_KEY
FROM_EMAIL

# App (KEEP)
NODE_ENV
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_APP_URL
```

### Current `render.yaml`

```yaml
databases:
  - name: monitrax-db
    databaseName: monitrax
    user: monitrax_user
    region: oregon

services:
  - type: web
    name: monitrax
    runtime: node
    region: oregon
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: monitrax-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
```

After migration, `JWT_SECRET` can be removed from `render.yaml` since Firebase manages tokens.

### Current `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
```

No changes needed for Firebase.

### Key Prisma Schema Context

The User model has ~50+ relationships to financial entities. The `firebaseUid` field must be added WITHOUT disrupting any existing relations:

```prisma
model User {
  id                String    @id @default(uuid())
  firebaseUid       String?   @unique  // <-- ADD THIS
  email             String    @unique
  password          String?             // Keep nullable, Firebase manages passwords
  name              String
  role              UserRole  @default(OWNER)
  emailVerified     Boolean   @default(false)
  mfaEnabled        Boolean   @default(false)
  basiqUserId       String?   @unique
  // ... 50+ financial relationships remain untouched
}
```

### Success Criteria

The migration is complete when:
1. Users can sign up/sign in via Firebase (email/password + Google OAuth at minimum)
2. MFA can be enrolled and verified via Firebase
3. All API routes verify Firebase ID tokens instead of custom JWTs
4. RBAC permissions work via Firebase Custom Claims + local permission checks
5. Audit logging continues to work for all auth events
6. `npm run build` and `npm run lint` pass
7. All existing financial features (properties, loans, accounts, transactions, Basiq connections) work unchanged
8. No in-memory auth state that would be lost on restart
