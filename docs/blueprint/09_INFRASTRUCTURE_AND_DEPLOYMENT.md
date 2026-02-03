# 09 — INFRASTRUCTURE AND DEPLOYMENT
### *Build, Deploy, and Database Management for Monitrax*

---

**Last Updated:** 2026-02-03
**Status:** Active

---

## 1. Overview

This document defines the infrastructure, build process, deployment pipeline, and database management strategy for Monitrax. It serves as the authoritative reference for all deployment-related operations.

---

## 2. Infrastructure Architecture

### 2.1 Platform Overview

| Component | Platform | Purpose |
|-----------|----------|---------|
| **Frontend** | Vercel | Next.js hosting, edge functions, CDN |
| **Backend API** | Render | API routes, background jobs |
| **Database** | Render PostgreSQL | Primary data store |
| **File Storage** | Google Cloud Storage | Document storage (Phase 19.3) |
| **Maps & Geocoding** | Google Maps Platform | Property locations (Phase 20) |

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL (Frontend)                          │
│   • Next.js App Router                                          │
│   • React Server Components                                     │
│   • Edge Functions                                              │
│   • CDN / Static Assets                                         │
│   • Google Maps JavaScript API                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDER (Backend)                           │
│   • Next.js API Routes                                          │
│   • Prisma ORM                                                  │
│   • Background Processing                                       │
│   • Google Geocoding API                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│  RENDER PostgreSQL  │ │  GOOGLE CLOUD   │ │  GOOGLE MAPS        │
│   (Database)        │ │  STORAGE        │ │  PLATFORM           │
│                     │ │                 │ │                     │
│ • Primary data      │ │ • Document      │ │ • Maps JavaScript   │
│ • Automated backups │ │   storage       │ │ • Geocoding API     │
│ • Prisma schema     │ │ • Signed URLs   │ │ • Places API        │
└─────────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

## 3. Build Process

### 3.1 Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### 3.2 Production Build Commands

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "postinstall": "prisma generate"
  }
}
```

### 3.3 Render Build Configuration

**render.yaml:**

```yaml
services:
  - type: web
    name: monitrax
    runtime: node
    buildCommand: npm install && npx prisma generate && npm run build
    startCommand: npm start
```

**NOTE:** The build command does NOT include `prisma db push`. Schema changes must be applied manually to protect legacy database tables. See Section 4.5 for manual schema sync procedures.

---

## 4. Database Management

### 4.1 Schema Management Strategy

Monitrax uses **manual schema synchronization** to protect legacy database tables:

| Command | Environment | Purpose |
|---------|-------------|---------|
| `prisma db push` | Manual only | Sync schema to database (run via Render Shell) |
| `prisma migrate dev` | Development | Create migration files (local only) |
| `prisma generate` | Build time | Generate Prisma client (safe, doesn't modify DB) |

### 4.2 Why Manual Schema Sync?

1. **Data Protection** — Prevents accidental deletion of legacy tables not in schema
2. **Controlled Changes** — Schema modifications are explicit and intentional
3. **Audit Trail** — Changes are reviewed before application
4. **Legacy Table Preservation** — Database contains tables for future features

### 4.3 Legacy Tables (Pending Audit)

The following tables exist in the database but are not in the Prisma schema:

| Table | Status | Notes |
|-------|--------|-------|
| `admin_users` | Preserved | May be needed for admin features |
| `admin_sessions` | Preserved | Admin authentication sessions |
| `import_batches` | Preserved | Transaction import tracking |
| `organization_invitations` | Preserved | Multi-tenant invitations |
| `organization_portal_settings` | Preserved | Portal configuration |
| `transaction_review_queue` | Preserved | Transaction review workflow |

These tables will be audited in a future cleanup phase to determine if they should be:
- Added to the schema (if actively used)
- Dropped (if confirmed unused)
- Migrated to new structures

### 4.3 Schema Change Workflow

```
1. Developer updates prisma/schema.prisma
2. Developer commits and pushes to branch
3. PR is merged to main
4. Render auto-deploys (or manual deploy triggered)
5. Build command runs: npx prisma db push
6. Database schema is automatically updated
7. Application starts with new schema
```

### 4.4 Database Backup Best Practices

Before major schema changes:

1. Go to **Render Dashboard** → **Your PostgreSQL Database**
2. Navigate to **"Backups"** tab
3. Click **"Create Backup"**
4. Wait for backup to complete before deploying

### 4.5 Manual Database Operations

If direct SQL execution is needed:

```bash
# Option 1: Render PSQL Console
# Render Dashboard → Database → PSQL tab

# Option 2: External connection
psql "your-render-database-url" -f script.sql

# Option 3: Database GUI (pgAdmin, DBeaver)
# Use External Database URL from Render Dashboard
```

---

## 5. Environment Configuration

### 5.1 Required Environment Variables

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string | Render (auto-injected) |
| `JWT_SECRET` | Authentication token secret | Render (auto-generated) |
| `NODE_ENV` | Environment mode | Render: `production` |
| `NEXT_PUBLIC_API_URL` | API base URL | Vercel |

### 5.2 Render Environment Variables

Set in **Render Dashboard** → **Environment**:

```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<auto-generated>
NODE_ENV=production

# Google Cloud Storage (Phase 19.3)
GCS_PROJECT_ID=monitrax-479700
GCS_BUCKET_NAME=monitrax-documents
GCS_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>

# Google Maps API (Phase 20)
GOOGLE_MAPS_API_KEY=<your-api-key>
```

### 5.3 Vercel Environment Variables

Set in **Vercel Dashboard** → **Settings** → **Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://monitrax.onrender.com

# Google Maps API (Phase 20) - Frontend
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-api-key>
```

### 5.4 Google Cloud Setup

To encode your service account key for `GCS_SERVICE_ACCOUNT_KEY`:

```bash
# Mac/Linux
base64 -i service-account-key.json | tr -d '\n'

# Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("service-account-key.json"))
```

---

## 6. Deployment Process

### 6.1 Automatic Deployment (Recommended)

1. Push code to `main` branch
2. Render detects changes and triggers build
3. Build command executes:
   - `npm install`
   - `npx prisma generate`
   - `npx prisma db push` (syncs database)
   - `npm run build`
4. Application restarts with new code

### 6.2 Manual Deployment

1. Go to **Render Dashboard** → **Your Web Service**
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Monitor build logs for success

### 6.3 Deployment Checklist

Before deploying major changes:

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Database backup created (for schema changes)
- [ ] Environment variables updated (if needed)
- [ ] PR reviewed and approved

---

## 7. Monitoring and Health Checks

### 7.1 Health Check Endpoint

```
GET /api/health
```

Render uses this endpoint to verify application health.

### 7.2 Monitoring Locations

| Metric | Location |
|--------|----------|
| Build Logs | Render Dashboard → Events |
| Runtime Logs | Render Dashboard → Logs |
| Database Metrics | Render Dashboard → Database → Metrics |
| Frontend Metrics | Vercel Dashboard → Analytics |

---

## 8. Troubleshooting

### 8.1 Build Failures

**Issue:** `prisma db push` fails

**Solution:**
- Check DATABASE_URL is correctly set
- Verify database is accessible
- Check for schema conflicts

**Issue:** TypeScript compilation errors

**Solution:**
- Run `npm run build` locally first
- Fix all type errors before pushing

### 8.2 Database Issues

**Issue:** Schema out of sync

**Solution:**
- Trigger manual deploy on Render
- Or run `npx prisma db push` directly via Render Shell

**Issue:** Need to rollback schema

**Solution:**
1. Revert the schema change in code
2. Deploy the reverted code
3. `prisma db push` will sync the rollback

### 8.3 Connection Issues

**Issue:** Cannot connect to database

**Solution:**
- Verify DATABASE_URL in Render environment
- Check database is running (Render Dashboard)
- Verify IP allowlist if using external tools

---

## 9. Security Considerations

### 9.1 Database Security

- Database URL contains credentials — never commit to git
- Use Render's auto-injection for DATABASE_URL
- External connections require SSL

### 9.2 Build Security

- Dependencies are installed fresh on each build
- `npm audit` should be run periodically
- Keep Node.js version updated in Render settings

### 9.3 Secrets Management

- All secrets stored in Render/Vercel environment variables
- JWT_SECRET is auto-generated by Render
- Never log or expose secrets in code

---

## 10. Quick Reference

### Common Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Generate Prisma client
npx prisma generate

# Sync schema to database (what Render does)
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio

# View database schema
npx prisma db pull
```

### Key URLs

| Service | URL |
|---------|-----|
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| GitHub Repository | https://github.com/resadegh/monitrax |

---

## 11. Revision History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-04 | Initial document creation | Claude |

---

**END OF INFRASTRUCTURE AND DEPLOYMENT DOCUMENTATION**
