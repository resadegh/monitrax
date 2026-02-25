# GCP Identity Platform Migration - Implementation Prompt

> Copy everything below this line into a new Claude Code session.
> Each PHASE is designed to be a **separate session**. Complete one phase, test it, then start the next session with the next phase.

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

## CRITICAL: Pre-Migration Safety Steps

**Before writing ANY code, do ALL of the following:**

### Step 1: Create a backup tag of the current working state

```bash
git checkout main
git pull origin main
git tag pre-firebase-migration -m "Backup before Firebase Auth migration"
git push origin pre-firebase-migration
```

This tag is your safety net. If anything goes catastrophically wrong at any phase, you can restore:
```bash
git checkout pre-firebase-migration
```

### Step 2: Create the feature branch

```bash
git checkout -b firebase-auth-migration
```

### Step 3: Verify the app builds and works BEFORE touching anything

```bash
npm run build
npm run lint
```

**If either fails, DO NOT proceed. Fix existing issues first.**

### Step 4: Read the CLAUDE.md and blueprint docs

Follow the CLAUDE.md session startup protocol. Read all core blueprint documents before making changes.

---

## Migration Overview: 6 Phases with Testing Gates

Each phase is **self-contained**. The app MUST build, lint, and function after every phase. **DO NOT start the next phase until the current phase passes all tests.**

| Phase | What It Does | Risk Level | App State After |
|---|---|---|---|
| **Phase 1** | Add Firebase SDKs + foundation (additive only) | LOW | App works exactly as before + Firebase libs available |
| **Phase 2** | Dual-mode auth: Firebase AND legacy work side-by-side | MEDIUM | Both auth systems work, Firebase is optional path |
| **Phase 3** | Frontend auth components use Firebase | MEDIUM | Users can log in via Firebase, legacy still works as fallback |
| **Phase 4** | Switch API routes to prefer Firebase tokens | HIGH | Firebase is primary auth, legacy is fallback |
| **Phase 5** | Remove legacy auth code | HIGH | Firebase only, legacy deleted |
| **Phase 6** | Additional GCP services (Secret Manager, Cloud Logging) | LOW | Enhanced security and compliance |

---

## Current Architecture Reference

**Hosting**: Vercel (frontend) + Render (backend + PostgreSQL in Oregon)
**Database**: Render PostgreSQL via Prisma ORM (NOT being migrated)
**Current Auth**: Custom JWT + bcryptjs + jsonwebtoken

### Files to eventually DELETE (replaced by Firebase Auth) - ~3,600 lines:

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

### Files to eventually REFACTOR (keep but change auth mechanism):

| File | Lines | Change Required |
|---|---|---|
| `lib/auth.ts` | 119 | Replace `generateToken`/`verifyToken` with Firebase Admin `verifyIdToken()`. Remove bcryptjs/jsonwebtoken. Keep `getCurrentUser()` but refactor to use Firebase. |
| `lib/auth/context.ts` | 88 | Refactor `getAuthContext()` to decode Firebase ID token instead of custom JWT |
| `lib/auth/guards.ts` | 216 | Refactor guards to use Firebase Admin SDK `verifyIdToken()` |
| `lib/auth/permissions.ts` | 205 | KEEP AS-IS. Store user roles as Firebase Custom Claims. Permission logic stays local. |
| `lib/security/auditLog.ts` | 458 | KEEP AS-IS. Continue logging to PostgreSQL. |
| `lib/security/rateLimit.ts` | 233 | KEEP for now. Firebase handles auth-level rate limiting. |
| `lib/middleware/apiSecurity.ts` | 424 | Refactor `withSecurity()` to verify Firebase tokens instead of custom JWTs. |
| `lib/session/sessionTracking.ts` | 404 | Refactor to track Firebase sessions. Keep device fingerprinting. |
| `middleware.ts` | 59 | KEEP AS-IS (security headers). No changes needed. |

### Prisma Schema Context

The User model has ~50+ relationships to financial entities:

```prisma
model User {
  id                String    @id @default(uuid())
  firebaseUid       String?   @unique  // <-- ADD THIS (Phase 1)
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

### Existing GCP Usage (Already in the Project)

- `@google-cloud/storage` v7.18.0 - Document storage
- `@google-cloud/vision` v5.3.4 - OCR
- `@google/generative-ai` v0.24.1 - Gemini AI
- Google Maps API - Geocoding

Firebase should be enabled in the **same GCP project**.

### Environment Variables Currently in Use

```env
# Database (KEEP - stays on Render)
DATABASE_URL

# Auth (REPLACE with Firebase in later phases)
JWT_SECRET
NEXTAUTH_URL / NEXTAUTH_SECRET
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET / FACEBOOK_REDIRECT_URI
APPLE_CLIENT_ID / APPLE_CLIENT_SECRET / APPLE_REDIRECT_URI
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_REDIRECT_URI
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER

# GCP (KEEP)
GCS_PROJECT_ID / GCS_BUCKET_NAME / GCS_SERVICE_ACCOUNT_KEY
GOOGLE_MAPS_API_KEY / GEMINI_API_KEY

# Basiq (KEEP)
BASIQ_API_KEY / BASIQ_API_URL

# Email (KEEP if used for non-auth emails)
RESEND_API_KEY / FROM_EMAIL

# App (KEEP)
NODE_ENV / NEXT_PUBLIC_API_URL / NEXT_PUBLIC_APP_URL
```

---

## MANDATORY: Pre-Phase Protocol (Do This BEFORE Every Phase)

Every phase session MUST follow this exact sequence before writing any code:

### Step A: Read ALL Blueprint Documents (No Exceptions)

Read these IN ORDER to understand the full system:

```
docs/blueprint/00_OVERVIEW.md
docs/blueprint/01_ARCHITECTURE_OVERVIEW.md
docs/blueprint/02_DESIGN_PRINCIPLES.md
docs/blueprint/03_DATA_MODEL.md
docs/blueprint/04_GRDCS_SPECIFICATION.md
docs/blueprint/06_UI_UX_FOUNDATION.md
docs/blueprint/07_API_STANDARDS.md
docs/blueprint/MASTER_BLUEPRINT.md
```

Then read the relevant Phase documents:
```
docs/blueprint/PHASE_*.md  (any that relate to auth/security)
```

### Step B: Review ALL Code That Will Be Touched

For the current phase, read EVERY file that will be created, modified, or deleted. Also read files that import from or depend on those files. Understand the full dependency chain before making changes.

Specifically for auth migration, always review:
- `prisma/schema.prisma` - Full schema understanding
- `lib/auth.ts` and all files in `lib/auth/`
- `lib/security/` - All security modules
- `lib/session/` - Session management
- `lib/middleware/` - API security middleware
- `middleware.ts` - Edge middleware
- All files in `app/api/auth/` relevant to the phase
- Any components that handle auth state (login forms, auth providers, etc.)

### Step C: Check Recent Changes

Review changelogs and git log to understand what changed recently:
```bash
git log --oneline -20
ls docs/blueprint/CHANGELOG_*.md
```

### Step D: Create Detailed Implementation Plan

**BEFORE writing any code**, create a detailed implementation plan:

1. Use TodoWrite to create a comprehensive task list for the phase
2. Each task must be specific and actionable (not vague)
3. Include file paths for every file that will be touched
4. Include documentation update tasks
5. Include testing tasks
6. Present the plan to the user for approval BEFORE proceeding

Example todo list structure for a phase:
```
- [ ] Read all blueprint documents
- [ ] Review all affected code files
- [ ] Create implementation plan (this step)
- [ ] [Specific code task 1 with file path]
- [ ] [Specific code task 2 with file path]
- [ ] ...
- [ ] Update docs/blueprint/CHANGELOG_YYYY_MM_DD.md
- [ ] Update docs/blueprint/MASTER_BLUEPRINT.md
- [ ] Update relevant PHASE_*.md document
- [ ] Run npm run build
- [ ] Run npm run lint
- [ ] Manual testing verification
- [ ] Commit with proper message
- [ ] Push to branch
```

**DO NOT write any code until the user approves the plan.**

### Step E: Document Changes As You Go

As each task is completed, immediately update documentation:

1. **Changelog**: Create/update `docs/blueprint/CHANGELOG_YYYY_MM_DD.md` with every change made. Don't wait until the end. Update it after each commit.

2. **Phase Document**: Update the relevant `docs/blueprint/PHASE_*.md` to mark completed items with checkmarks and add implementation notes.

3. **Master Blueprint**: If the phase changes architecture, capabilities, or phase status, update `docs/blueprint/MASTER_BLUEPRINT.md`.

4. **Data Model**: If Prisma schema changes, update `docs/blueprint/03_DATA_MODEL.md`.

5. **API Standards**: If API routes are added/removed/changed, update `docs/blueprint/07_API_STANDARDS.md`.

6. **Architecture Overview**: If the auth architecture changes, update `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md`.

Use this changelog entry format:
```markdown
# Changelog - YYYY-MM-DD

## Session: Firebase Auth Migration - Phase X

### Changes Made
- **Type**: Feature/Refactor/Deletion
- **Scope**: Auth/Security/API
- **Description**: {what was changed and why}

### Files Created
- `path/to/new/file.ts` - {what it does}

### Files Modified
- `path/to/modified/file.ts` - {what changed}

### Files Deleted
- `path/to/deleted/file.ts` - {why it was removed}

### Documentation Updated
- `docs/blueprint/PHASE_XX.md` - {what was updated}
- `docs/blueprint/MASTER_BLUEPRINT.md` - {what was updated}

### Testing
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Manual testing completed

### Rollback
- Git tag: `phase-X-complete`
- Rollback command: `git checkout phase-{X-1}-complete`
```

---

## PHASE 1: Foundation (Additive Only - No Breaking Changes)

**Goal**: Install Firebase, create foundation files, update Prisma schema. The existing app continues working exactly as before. Nothing is removed or changed.

**Risk**: LOW - only adding new files and one optional DB field.

### Phase 1 Tasks

#### 1.1 Install dependencies

```bash
npm install firebase-admin firebase
```

Do NOT remove any existing dependencies yet.

#### 1.2 Create `lib/firebase/admin.ts`

- Initialize Firebase Admin SDK with service account credentials from env vars
- Singleton pattern (check if already initialized before calling `initializeApp`)
- Export `getFirebaseAdmin()` and `getFirebaseAuth()` helpers
- Environment variables needed: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Gracefully handle missing env vars (log warning, don't crash the app)

#### 1.3 Create `lib/firebase/client.ts`

- Initialize Firebase client SDK for browser
- Singleton pattern
- Export `getFirebaseApp()` and `getFirebaseClientAuth()` helpers
- Environment variables needed: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Gracefully handle missing env vars (return null, don't crash)

#### 1.4 Create `lib/firebase/auth.ts`

Server-side Firebase auth utilities:
- `verifyFirebaseToken(idToken: string): Promise<DecodedIdToken | null>` - Verify Firebase ID tokens, return null on failure
- `getOrCreateLocalUser(firebaseUser: DecodedIdToken): Promise<User>` - Find user by `firebaseUid` OR `email`, create if needed
- `syncUserRole(userId: string, role: UserRole): Promise<void>` - Set Firebase Custom Claims
- `revokeUserSessions(firebaseUid: string): Promise<void>` - Revoke all Firebase sessions

#### 1.5 Create `lib/firebase/index.ts`

Barrel export for all firebase modules.

#### 1.6 Update Prisma schema

Add `firebaseUid` to User model:
```prisma
firebaseUid  String?  @unique
```

Run: `npx prisma migrate dev --name add_firebase_uid`

**DO NOT remove or modify any existing models.**

#### 1.7 Create `.env.example` updates

Document the new Firebase env vars (add to existing `.env.example` or `.env.local.example`).

### Phase 1 Testing Gate

**ALL of these must pass before proceeding to Phase 2:**

```bash
# 1. Build must pass
npm run build

# 2. Lint must pass
npm run lint

# 3. Prisma migration must succeed
npx prisma migrate status

# 4. Verify no existing imports are broken
# (the new files are additive, nothing references them yet)

# 5. Verify the app starts without Firebase env vars set
# (should gracefully handle missing config, not crash)
```

**Commit with message**: `feat(auth): Phase 1 - Add Firebase SDK foundation and Prisma schema update`

### Phase 1 Rollback

If anything breaks: `git checkout pre-firebase-migration -- .` and `npx prisma migrate reset`

---

## PHASE 2: Dual-Mode Auth Layer (Both Systems Work)

**Goal**: Refactor the auth verification layer to try Firebase token FIRST, fall back to legacy JWT. Both auth methods work simultaneously. No user-facing changes.

**Risk**: MEDIUM - modifying core auth verification, but legacy fallback ensures nothing breaks.

**IMPORTANT**: Create a phase checkpoint tag before starting:
```bash
git tag phase-1-complete -m "Phase 1 complete: Firebase foundation added"
git push origin phase-1-complete
```

### Phase 2 Tasks

#### 2.1 Refactor `lib/auth.ts` - Add dual-mode token verification

Keep ALL existing functions. Add new ones alongside:

```typescript
// KEEP these existing functions (they still work for legacy tokens):
// - hashPassword, verifyPassword, generateToken, verifyToken, extractTokenFromHeader

// ADD a new function:
export async function getCurrentUser(request?: Request): Promise<CurrentUser | null> {
  // 1. Extract token from Authorization header
  // 2. Try Firebase verifyIdToken() first
  //    - If valid: look up user by firebaseUid, return CurrentUser
  // 3. If Firebase fails: fall back to legacy verifyToken()
  //    - If valid: look up user by userId from JWT, return CurrentUser
  // 4. If both fail: return null
}
```

The key insight: **the caller doesn't care which auth system verified the token**. They just get a `CurrentUser` or `null`.

#### 2.2 Refactor `lib/auth/context.ts` - Dual-mode context

Same approach - try Firebase first, fall back to legacy:

```typescript
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  // 1. Try Firebase token verification
  //    - If valid: build AuthContext from Firebase claims + local user
  // 2. Fall back to legacy JWT
  //    - If valid: build AuthContext from JWT + local user (existing logic)
  // 3. Return null if both fail
}
```

#### 2.3 Refactor `lib/auth/guards.ts` - No changes needed

Guards call `getAuthContext()` internally. Since we made `getAuthContext()` dual-mode, guards automatically work with both Firebase and legacy tokens. **No changes to guards.ts.**

#### 2.4 Refactor `lib/middleware/apiSecurity.ts` - Dual-mode

The `withSecurity()` function calls auth verification internally. Update it to use the dual-mode `getAuthContext()`. Keep all other security layers (rate limiting, permissions, audit logging) unchanged.

#### 2.5 Create `app/api/auth/firebase-login/route.ts` (NEW endpoint)

A **new** endpoint (does not replace existing `/api/auth/login`):

```typescript
// POST /api/auth/firebase-login
// Body: { idToken: string }
//
// 1. Verify Firebase ID token with Admin SDK
// 2. Find or create local user (getOrCreateLocalUser)
// 3. Sync role to Firebase Custom Claims if needed
// 4. Log auth event to audit log
// 5. Return user profile + any app-specific data
//
// This is the endpoint the Firebase client will call after
// successful Firebase authentication to establish the server-side session.
```

#### 2.6 Update `app/api/auth/me/route.ts` - Dual-mode

This already reads the current user. It should now work with both Firebase tokens and legacy JWTs (it will automatically if it uses `getCurrentUser()` or `getAuthContext()`).

### Phase 2 Testing Gate

**ALL of these must pass before proceeding to Phase 3:**

```bash
# 1. Build must pass
npm run build

# 2. Lint must pass
npm run lint

# 3. Test legacy auth still works:
# - Existing login/register endpoints still function
# - Existing JWT tokens are still accepted
# - All API routes that require auth still work with legacy tokens
# - The entire app works exactly as before

# 4. Test Firebase auth works (if Firebase env vars are configured):
# - A Firebase ID token is accepted by /api/auth/firebase-login
# - A Firebase ID token is accepted by /api/auth/me
# - A Firebase ID token is accepted by protected API routes

# 5. Test graceful degradation:
# - With Firebase env vars NOT set, app works with legacy auth only
# - No errors or crashes when Firebase is not configured
```

**Manual testing checklist**:
- [ ] Log in with existing credentials (legacy) - works
- [ ] Access dashboard with legacy JWT - works
- [ ] All financial API routes work with legacy JWT - works
- [ ] App builds and deploys without Firebase env vars - works
- [ ] If Firebase is configured: `/api/auth/firebase-login` accepts a valid Firebase token

**Commit with message**: `feat(auth): Phase 2 - Dual-mode auth verification (Firebase + legacy fallback)`

### Phase 2 Rollback

If anything breaks: `git checkout phase-1-complete`

---

## PHASE 3: Frontend Firebase Auth Components

**Goal**: Create Firebase-powered login/register UI components. Users can choose to use Firebase auth OR legacy auth. Both paths work.

**Risk**: MEDIUM - new UI components, but legacy login still works.

**IMPORTANT**: Create a phase checkpoint tag before starting:
```bash
git tag phase-2-complete -m "Phase 2 complete: Dual-mode auth verification"
git push origin phase-2-complete
```

### Phase 3 Tasks

#### 3.1 Create `lib/firebase/hooks.ts`

React hooks for Firebase auth:

```typescript
// useAuth() - Main auth hook
// Returns: { user, loading, error, signInWithEmail, signInWithGoogle, signOut, signUp }
// Wraps Firebase onAuthStateChanged
// After successful Firebase auth, calls /api/auth/firebase-login to sync with server

// useFirebaseToken() - Token hook for API calls
// Returns: { token, loading, refreshToken }
// Automatically refreshes Firebase ID token before expiry
// Returns null if user is not authenticated via Firebase
```

#### 3.2 Create `components/auth/FirebaseAuthProvider.tsx`

React context provider:
- Wraps Firebase `onAuthStateChanged`
- Provides auth state to entire app via context
- Handles token refresh and session persistence
- Co-exists with any existing auth provider (does NOT replace it yet)

#### 3.3 Create `components/auth/FirebaseLoginForm.tsx`

New login form component (does NOT replace existing `LoginForm`):
- Email/password sign-in via Firebase `signInWithEmailAndPassword`
- Google OAuth button via Firebase `signInWithPopup(GoogleAuthProvider)`
- After successful Firebase auth, calls `/api/auth/firebase-login` to sync server-side
- Error handling for wrong password, account not found, etc.
- Loading states

#### 3.4 Create `components/auth/FirebaseRegisterForm.tsx`

New registration form (does NOT replace existing):
- Firebase `createUserWithEmailAndPassword`
- Sends Firebase email verification
- Calls `/api/auth/firebase-login` to create local user record
- Password strength indicator (Firebase enforces policy, but show feedback)

#### 3.5 Create `components/auth/FirebaseMFAEnrollment.tsx`

MFA enrollment via Firebase:
- TOTP enrollment using Firebase `TotpMultiFactorGenerator`
- Show QR code for authenticator apps
- Verify enrollment with code

#### 3.6 Create `components/auth/FirebaseForgotPassword.tsx`

Password reset via Firebase:
- Firebase `sendPasswordResetEmail`
- Success/error states

#### 3.7 Update API client/fetch wrapper

Update any shared fetch utility or API client to:
- Check if user is authenticated via Firebase
- If yes: include Firebase ID token in `Authorization: Bearer <token>` header
- If no: fall back to existing token mechanism (legacy JWT from cookie/localStorage)

#### 3.8 Add Firebase auth pages (or update existing)

Either create new routes or add a toggle to existing login/register pages:
- Option A: Add "Sign in with Google" button to existing login page that uses Firebase
- Option B: Create `/auth/firebase-login` as a separate page for testing

**Recommended: Option A** - Add Firebase sign-in options to the existing login page alongside the existing form. This gives users both options during migration.

### Phase 3 Testing Gate

**ALL of these must pass before proceeding to Phase 4:**

```bash
# 1. Build must pass
npm run build

# 2. Lint must pass
npm run lint
```

**Manual testing checklist**:
- [ ] Legacy login still works (email/password via existing form)
- [ ] Firebase login works (email/password via new Firebase form)
- [ ] Firebase Google OAuth works (sign in with Google button)
- [ ] After Firebase login, user can access all dashboard pages
- [ ] After Firebase login, all API calls include correct token
- [ ] After Firebase login, financial data loads correctly
- [ ] Firebase registration creates user in both Firebase and local DB
- [ ] Firebase password reset email is sent
- [ ] MFA enrollment via Firebase works
- [ ] Logout works for both Firebase and legacy sessions
- [ ] App works without Firebase env vars (legacy-only mode)
- [ ] No console errors related to Firebase on any page

**Commit with message**: `feat(auth): Phase 3 - Firebase frontend auth components and hooks`

### Phase 3 Rollback

If anything breaks: `git checkout phase-2-complete`

---

## PHASE 4: Switch to Firebase Primary (Legacy as Fallback)

**Goal**: Make Firebase the primary auth method. Legacy JWT becomes the fallback. Update all API routes to prefer Firebase tokens. Migrate existing login/register pages to use Firebase.

**Risk**: HIGH - this is the critical switchover. Legacy fallback still exists for safety.

**IMPORTANT**: Create a phase checkpoint tag before starting:
```bash
git tag phase-3-complete -m "Phase 3 complete: Firebase frontend components"
git push origin phase-3-complete
```

### Phase 4 Tasks

#### 4.1 Update login page to use Firebase as default

Replace the existing login form with the Firebase login form. The old form can remain as a hidden fallback (e.g., accessible via `?legacy=true` query param) during testing.

#### 4.2 Update registration page to use Firebase as default

Replace the existing registration form with Firebase registration. Old form remains as hidden fallback.

#### 4.3 Create user migration endpoint `app/api/auth/migrate/route.ts`

For existing users who haven't been linked to Firebase yet:
- When a user logs in via legacy JWT and has no `firebaseUid`:
  - Prompt them to set up Firebase auth (re-enter password or use OAuth)
  - Or auto-create their Firebase account and link it
- Match users by email between Firebase and local database
- Handle edge cases: email exists in Firebase but different local user, etc.

#### 4.4 Update `app/api/auth/me/route.ts`

Ensure this returns consistent data regardless of auth method. Include Firebase-specific info (MFA status, linked providers) when available.

#### 4.5 Create admin migration script `scripts/migrate-users-to-firebase.ts`

For bulk-migrating existing users:
- Read all users from PostgreSQL
- For each user without `firebaseUid`:
  - Create Firebase user with same email
  - Store `firebaseUid` back in PostgreSQL
- **Note**: Passwords CANNOT be migrated. Users must reset their password.
- Can be run as: `npx ts-node scripts/migrate-users-to-firebase.ts`

#### 4.6 Refactor `lib/middleware/apiSecurity.ts` - Remove custom session/MFA checks

Now that Firebase is primary:
- Remove custom session validation calls (Firebase manages sessions)
- Remove custom MFA verification checks (Firebase enforces MFA before issuing token)
- Keep: rate limiting, IP restrictions, permission checks, audit logging

#### 4.7 Update session tracking

Refactor `lib/session/sessionTracking.ts` to:
- Track Firebase sessions instead of custom sessions
- Keep device fingerprinting and security checks
- Use Firebase token metadata for session info

### Phase 4 Testing Gate

**ALL of these must pass before proceeding to Phase 5:**

```bash
# 1. Build must pass
npm run build

# 2. Lint must pass
npm run lint
```

**Manual testing checklist (THOROUGH - this is the critical phase)**:
- [ ] New user registration via Firebase works end-to-end
- [ ] Existing user can log in via Firebase (after password reset if needed)
- [ ] Google OAuth login creates/links user correctly
- [ ] After login, dashboard loads with all financial data
- [ ] Properties list and detail pages load correctly
- [ ] Loans list and detail pages load correctly
- [ ] Accounts and transactions load correctly
- [ ] Basiq connection/sync still works
- [ ] All CRUD operations (create, edit, delete) work for financial entities
- [ ] RBAC permissions are enforced (test with different roles if possible)
- [ ] Audit log records auth events
- [ ] MFA enrollment and verification works
- [ ] Password reset works
- [ ] Logout clears session properly
- [ ] Token refresh works (stay logged in for >1 hour)
- [ ] Legacy fallback: `?legacy=true` login still works
- [ ] Multiple concurrent sessions work
- [ ] Rate limiting still functions

**Commit with message**: `feat(auth): Phase 4 - Firebase as primary auth with legacy fallback`

### Phase 4 Rollback

If anything breaks: `git checkout phase-3-complete`

---

## PHASE 5: Remove Legacy Auth Code

**Goal**: Delete all legacy auth code that Firebase has replaced. Clean up unused dependencies, API routes, and Prisma models.

**Risk**: HIGH - removing code is irreversible in the session (but recoverable via git tags). Only proceed after Phase 4 is thoroughly tested.

**IMPORTANT**: Create a phase checkpoint tag before starting:
```bash
git tag phase-4-complete -m "Phase 4 complete: Firebase is primary auth"
git push origin phase-4-complete
```

**CRITICAL**: Before this phase, confirm with the user:
- "Phase 4 has been tested and all auth flows work via Firebase. Ready to delete legacy code?"
- If ANY doubt, stay on Phase 4 longer.

### Phase 5 Tasks

#### 5.1 Delete legacy auth files

Delete these files:
- `lib/auth/oauth.ts` (607 lines)
- `lib/auth/magicLink.ts` (349 lines)
- `lib/auth/passkey.ts` (713 lines)
- `lib/auth/refreshToken.ts` (410 lines)
- `lib/session/sessionManager.ts` (269 lines)
- `lib/security/mfa.ts` (1,211 lines)
- `lib/security/emailVerification.ts` (416 lines)
- `lib/security/accountLockout.ts` (531 lines)

#### 5.2 Delete legacy API routes

Delete these directories:
- `app/api/auth/oauth/` (4 provider routes)
- `app/api/auth/callback/` (4 callback routes)
- `app/api/auth/magic-link/` (2 routes)
- `app/api/auth/passkey/` (6+ routes)
- `app/api/auth/mfa/` (entire directory)
- `app/api/auth/login/` (replaced by firebase-login)
- `app/api/auth/register/` (replaced by Firebase client SDK)
- `app/api/auth/verify-email/` (Firebase handles this)
- `app/api/auth/resend-verification/` (Firebase handles this)
- `app/api/auth/password/change/` (Firebase handles this)
- `app/api/auth/providers/` (Firebase handles this)

#### 5.3 Clean up `lib/auth.ts`

Remove legacy functions:
- `hashPassword()` - Firebase manages passwords
- `verifyPassword()` - Firebase manages passwords
- `generateToken()` - Firebase manages tokens
- `verifyToken()` - Firebase manages tokens

Keep only:
- `getCurrentUser()` (now Firebase-only)
- `extractTokenFromHeader()` (still needed)

#### 5.4 Remove legacy fallback from dual-mode functions

In `lib/auth/context.ts` and `lib/middleware/apiSecurity.ts`, remove the "try legacy JWT" fallback paths. Firebase is now the only auth method.

#### 5.5 Update barrel exports

Update `lib/auth/index.ts` and `lib/security/index.ts` to remove references to deleted files.

#### 5.6 Remove unused dependencies

```bash
npm uninstall bcryptjs @types/bcryptjs jsonwebtoken @types/jsonwebtoken twilio
```

Keep `resend` if it's used for non-auth emails (e.g., notifications). Remove if only used for auth emails.

#### 5.7 Clean up environment variables

Remove from `.env`, `.env.example`, `render.yaml`:
- `JWT_SECRET`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- All OAuth provider client IDs/secrets (now in Firebase console)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

#### 5.8 Mark Prisma models as deprecated (optional)

These models are no longer actively used but may contain historical data:
- `MFAMethod`, `PasskeyCredential`, `UserSession`, `MagicLink`, `OAuthAccount`, `LoginAttempt`, `EmailMFACode`

Options:
- **Option A (Safe)**: Add a comment `// @deprecated - Replaced by Firebase Auth` but keep them
- **Option B (Clean)**: Create a migration to drop the tables (only if no data worth keeping)

**Recommend Option A** for now. Clean up tables in a future session after confirming no data loss.

### Phase 5 Testing Gate

```bash
# 1. Build must pass (critical - removed imports will cause build failures)
npm run build

# 2. Lint must pass
npm run lint

# 3. Verify no import errors
# Check that no remaining file imports from a deleted file
```

**Manual testing checklist**:
- [ ] Firebase login works
- [ ] Firebase registration works
- [ ] Firebase Google OAuth works
- [ ] Dashboard and all financial pages load
- [ ] All CRUD operations work
- [ ] Basiq connection works
- [ ] MFA works via Firebase
- [ ] Audit logging works
- [ ] App starts without legacy env vars
- [ ] No 404 errors for deleted API routes (frontend shouldn't call them)
- [ ] No console errors

**Commit with message**: `refactor(auth): Phase 5 - Remove legacy auth code (~3,600 lines), Firebase is sole auth provider`

### Phase 5 Rollback

If anything breaks: `git checkout phase-4-complete`

---

## PHASE 6: Additional GCP Services (Optional, Post-Migration)

**Goal**: Add Cloud Secret Manager, Cloud Logging, and Cloud KMS for enhanced compliance. These are separate from the auth migration and can be done in a future session.

**Risk**: LOW - additive only, no auth changes.

**IMPORTANT**: Create a phase checkpoint tag before starting:
```bash
git tag phase-5-complete -m "Phase 5 complete: Legacy auth removed, Firebase only"
git push origin phase-5-complete
```

### Phase 6 Tasks

#### 6.1 Cloud Secret Manager - `lib/gcp/secretManager.ts`

- Replace env var secrets with Secret Manager lookups
- Secrets to migrate: `BASIQ_API_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `FIREBASE_PRIVATE_KEY`
- Cache secrets in memory with 5-minute TTL
- Graceful fallback to env vars if Secret Manager is unavailable

#### 6.2 Cloud Logging - `lib/gcp/logging.ts`

- Replace/augment `console.log` in `lib/utils/logger.ts` with Cloud Logging structured logs
- Set retention to 400 days (exceeds Basiq 90-day requirement)
- Create log-based metrics for security dashboards
- Keep console.log as fallback for local development

#### 6.3 Cloud KMS - `lib/gcp/kms.ts`

- Encrypt sensitive database fields (Basiq tokens, any remaining OAuth tokens)
- Sign audit log entries for tamper protection
- Envelope encryption pattern for performance

#### 6.4 Cloud DLP (if needed)

- CDR data de-identification if required by Basiq assessment

### Phase 6 Testing Gate

```bash
npm run build
npm run lint
```

**Manual testing checklist**:
- [ ] App works with Secret Manager configured
- [ ] App works without Secret Manager (falls back to env vars)
- [ ] Logs appear in Cloud Logging console
- [ ] Encrypted fields can be decrypted correctly
- [ ] No performance degradation from Secret Manager/KMS calls

**Commit with message**: `feat(security): Phase 6 - Add Cloud Secret Manager, Logging, and KMS`

---

## Critical Rules (Apply to ALL Phases)

1. **STOP if build fails.** Fix the build before making more changes. Never accumulate broken code.
2. **Keep `lib/auth/permissions.ts` exactly as-is.** RBAC logic is correct. Store roles as Firebase Custom Claims but keep permission checking local.
3. **Keep `lib/security/auditLog.ts` exactly as-is.** Audit logging to PostgreSQL must continue. Required for CDR compliance.
4. **Keep all financial models and APIs untouched.** This migration is AUTH ONLY. Do not modify any financial services, engines, or API routes outside of auth.
5. **Follow the existing CLAUDE.md protocol** - read blueprint docs, create feature branch, update documentation, create PR.
6. **Run `npm run build` and `npm run lint` before EVERY commit.**
7. **The Render PostgreSQL database stays.** We are NOT migrating the database. Only auth moves to Firebase.
8. **Tag before each phase.** Always have a rollback point.
9. **One phase per session.** Don't combine phases. Test thoroughly between them.
10. **When in doubt, keep legacy code.** It's easier to delete later than to recover deleted code that was still needed.
11. **Read before you write.** Every session must read all blueprint docs and review all affected code BEFORE making changes. No exceptions.
12. **Plan before you code.** Create a detailed TodoWrite plan and get user approval BEFORE any implementation.
13. **Document as you go.** Update changelogs, phase docs, and master blueprint after EACH significant change, not at the end.

---

## Dependencies

### To ADD (Phase 1):
```bash
npm install firebase-admin firebase
```

### To REMOVE (Phase 5 only, after full migration):
```bash
npm uninstall bcryptjs @types/bcryptjs jsonwebtoken @types/jsonwebtoken twilio
```

### Environment Variables to ADD (Phase 1):
```env
# Firebase Admin SDK (server-side, secret)
FIREBASE_PROJECT_ID="your-gcp-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Client SDK (client-side, public)
NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
```

### Environment Variables to REMOVE (Phase 5 only):
```env
JWT_SECRET
NEXTAUTH_URL / NEXTAUTH_SECRET
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET / FACEBOOK_REDIRECT_URI
APPLE_CLIENT_ID / APPLE_CLIENT_SECRET / APPLE_REDIRECT_URI
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_REDIRECT_URI
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER
```

---

## Success Criteria (Final - After All Phases)

The migration is complete when:
1. Users can sign up/sign in via Firebase (email/password + Google OAuth at minimum)
2. MFA can be enrolled and verified via Firebase
3. All API routes verify Firebase ID tokens (no legacy JWT code remains)
4. RBAC permissions work via Firebase Custom Claims + local permission checks
5. Audit logging continues to work for all auth events
6. `npm run build` and `npm run lint` pass
7. All existing financial features (properties, loans, accounts, transactions, Basiq connections) work unchanged
8. No in-memory auth state that would be lost on restart
9. All legacy auth code (~3,600 lines) has been removed
10. Git tags exist for every phase as rollback points

---

## Session Instructions

When starting a new session for any phase:

1. Tell Claude which phase you're implementing: "Implement Phase X of the Firebase Auth migration"
2. Claude MUST read this document first: `docs/prompts/GCP_IDENTITY_MIGRATION_PROMPT.md`
3. Claude MUST follow the **"MANDATORY: Pre-Phase Protocol"** section completely:
   a. Read ALL blueprint documents (Step A)
   b. Review ALL affected code files for this phase (Step B)
   c. Check recent changes via git log and changelogs (Step C)
   d. Create a detailed TodoWrite implementation plan and present it for approval (Step D)
   e. **WAIT for user approval before writing any code**
4. Only after user approves the plan, begin implementation
5. Document every change as it happens - update changelog, phase docs, master blueprint (Step E)
6. Create the phase checkpoint git tag BEFORE making code changes
7. Run `npm run build` and `npm run lint` AFTER making changes, before committing
8. Commit with the prescribed commit message format for the phase
9. Create a PR for the phase
10. Provide a summary of all changes, files touched, and docs updated

### How to Start a Phase Session

Copy this into the new session:

```
Read the file docs/prompts/GCP_IDENTITY_MIGRATION_PROMPT.md and implement Phase [X].

Before writing any code:
1. Follow the "MANDATORY: Pre-Phase Protocol" section completely
2. Read all blueprint documents
3. Review all code files that will be affected
4. Create a detailed implementation plan with TodoWrite
5. Show me the plan and WAIT for my approval before proceeding

Document all changes as you go into the relevant blueprint documents and changelogs.
```
