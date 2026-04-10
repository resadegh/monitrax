# Monitrax Database Migration Plan: Render PostgreSQL to GCP Cloud SQL

> **Document Version:** 1.1
> **Created:** 2026-04-09
> **Status:** MIGRATION COMPLETE (Phases 0-6). Security hardening + Render decommission pending.
> **Author:** Claude Code Session
> **Refs:** docs/blueprint/01_ARCHITECTURE_OVERVIEW.md, docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture](#2-current-architecture)
3. [Target Architecture](#3-target-architecture)
4. [Pre-Migration Checklist](#4-pre-migration-checklist)
5. [Migration Phases](#5-migration-phases)
6. [Step-by-Step Guide (User Actions)](#6-step-by-step-guide)
7. [Code Changes Required](#7-code-changes-required)
8. [Security & IAM Configuration](#8-security--iam-configuration)
9. [CDR Compliance Considerations](#9-cdr-compliance-considerations)
10. [Rollback Plan](#10-rollback-plan)
11. [Post-Migration Validation](#11-post-migration-validation)
12. [Cost Estimation](#12-cost-estimation)
13. [Progress Tracker](#13-progress-tracker)

---

## 1. Executive Summary

**Goal:** Migrate Monitrax's PostgreSQL database from Render to GCP Cloud SQL while preserving all data, relationships, security, and CDR compliance.

**What moves:**
- PostgreSQL database (88 models, 74 enums, ~3,987 schema lines)
- All user data, financial records, audit logs, CDR-protected data
- Legacy tables (tables in DB but not in Prisma schema — MUST be preserved)

**What stays the same:**
- Vercel frontend deployment (no change)
- Firebase/GCP Identity Platform auth (already on GCP)
- Google Cloud Storage for documents (already on GCP)
- All API routes and business logic (code changes are minimal)
- Basiq Open Banking integration (API key based, no DB dependency)

**What changes:**
- `DATABASE_URL` environment variable (Render connection string → Cloud SQL)
- Connection method (direct → Cloud SQL Auth Proxy or public IP with SSL)
- Backup strategy (Render managed → Cloud SQL automated backups)
- Monitoring (none → Cloud Monitoring + Cloud Logging)
- **Environment strategy: 2-tier (DEV/UAT + PROD) using Vercel environment scoping**

**Risk Level:** MEDIUM — The migration is a standard PostgreSQL-to-PostgreSQL move. The primary risks are downtime during cutover and data integrity verification.

**Estimated Downtime:** 15-30 minutes (during DNS/connection string cutover)

---

## 2. Current Architecture

### 2.1 Infrastructure Layout

```
┌─────────────────────┐     ┌─────────────────────────┐
│   Vercel (Frontend)  │────▶│   Render (Backend + DB)  │
│   Next.js 15.2.6     │     │   Node.js Web Service    │
│   React 19           │     │   PostgreSQL Database    │
│   Edge Middleware     │     │   Region: Oregon         │
└─────────────────────┘     │   Plan: Free tier         │
                             └─────────────────────────┘
                                        │
                             ┌──────────┴──────────┐
                             │                      │
                     ┌───────▼───────┐  ┌──────────▼─────────┐
                     │ GCP Identity   │  │ Google Cloud Storage│
                     │ Platform       │  │ (Documents)         │
                     │ (Firebase Auth)│  │                     │
                     └───────────────┘  └────────────────────┘
```

### 2.2 Render Configuration (from `render.yaml`)

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

### 2.3 Database Connection

- **File:** `lib/db.ts` — Prisma singleton client
- **Connection:** `DATABASE_URL` env var, format: `postgresql://user:password@host:port/monitrax?schema=public`
- **Provider:** PostgreSQL (confirmed in `prisma/schema.prisma` and `migration_lock.toml`)
- **Pooling:** Default Prisma connection pool (no PgBouncer or Prisma Accelerate)
- **Raw SQL:** Only `SELECT 1` in health check (`app/api/health/route.ts`)
- **Transactions:** Used in 6 files (bulk operations via `prisma.$transaction()`)

### 2.4 Database Schema Summary

| Category | Models | Key Tables |
|----------|--------|------------|
| User & Auth | 15 | User, OAuthAccount, PasskeyCredential, MFAMethod, AuditLog |
| Financial Core | 19 | Property, Loan, Account, Income, Expense, Transaction |
| Investments | 6 | InvestmentAccount, InvestmentHolding, PurchaseLot, CapitalGainEvent |
| Assets | 3 | Asset, AssetValueHistory, AssetServiceRecord |
| Banking/CDR | 3 | BasiqConnection, BankImportFile, BankTransactionRaw |
| AI/Categorization | 7 | MerchantMapping, UnifiedTransaction, AICategorizationLearning |
| Documents | 5 | Document (with Bytes field for file content), DocumentAnalysis |
| Admin/Org | 12 | Organization, OrganizationClient, GlobalFeatureFlag |
| Household | 3 | HouseholdProfile, HouseholdMember, HouseholdPet |
| Tax/Super | 3 | SuperannuationAccount, SuperContribution, TaxPosition |
| Strategy/Cashflow | 6 | StrategyRecommendation, CashflowForecast, BudgetAnalysis |
| **Total** | **88 models, 74 enums** | |

### 2.5 Critical Data Constraints

- **Legacy tables:** The database contains tables NOT in the Prisma schema. These MUST be preserved. (`prisma db push` is banned from build scripts for this reason)
- **CDR-protected data:** Basiq-sourced financial data (accounts, transactions) governed by Australian Consumer Data Right
- **Audit logs:** Immutable trail of 40+ action types — cannot be lost
- **UUID primary keys:** All models use `@default(uuid())` — no sequence/serial concerns
- **Cascade deletes:** Extensive `onDelete: Cascade` rules — referential integrity must be maintained
- **JSON columns:** 30+ models use `@db.Json` for flexible data
- **Bytes columns:** `Document.fileContent` stores binary file data
- **Decimal columns:** `BillingTransaction.amount` uses `@db.Decimal(10,2)`

### 2.6 Environment Variables (Database-Related)

| Variable | Purpose | Changes for GCP? |
|----------|---------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | YES — new Cloud SQL connection |
| `NODE_ENV` | Controls Prisma logging level | No |
| `GCP_PROJECT_ID` | GCP project for auth verification | No (already set) |

---

## 3. Target Architecture

### 3.1 Target Layout (2-Tier: DEV/UAT + PROD)

```
┌──────────────────────────────────────────────────────────┐
│                        VERCEL                             │
│                                                           │
│  ┌───────────────────┐       ┌──────────────────────────┐│
│  │  PRODUCTION        │       │  PREVIEW (DEV/UAT)        ││
│  │  main branch only  │       │  All other branches       ││
│  │  monitrax.com.au   │       │  branch-name.vercel.app   ││
│  └────────┬──────────┘       └────────────┬─────────────┘│
└───────────┼───────────────────────────────┼──────────────┘
            │                               │
   ┌────────▼──────────┐         ┌─────────▼────────────┐
   │ Cloud SQL PROD     │         │ Cloud SQL DEV/UAT     │
   │ monitrax-db-prod   │         │ monitrax-db-dev       │
   │ australia-southeast1│         │ australia-southeast1  │
   │ (Sydney)           │         │ (Sydney)              │
   │ Real user data     │         │ Synthetic/test data   │
   │ CDR-protected      │         │ NO real CDR data      │
   │ HA + backups       │         │ Minimal (db-f1-micro) │
   └────────┬──────────┘         └─────────┬────────────┘
            │                               │
            └───────────┬───────────────────┘
                        │ (shared services)
            ┌───────────▼───────────┐
            │ GCP Identity Platform  │
            │ (Firebase Auth)        │
            │ NO CHANGE              │
            ├────────────────────────┤
            │ Google Cloud Storage   │
            │ (Documents)            │
            │ NO CHANGE              │
            └────────────────────────┘
```

### 3.2 Two-Tier Environment Strategy

| Aspect | PRODUCTION | DEV/UAT (Preview) |
|--------|-----------|-------------------|
| **Vercel scope** | Production | Preview |
| **Branch** | `main` only | All non-main branches |
| **URL** | monitrax.com.au | branch-name.vercel.app |
| **Cloud SQL instance** | `monitrax-db-prod` | `monitrax-db-dev` |
| **Instance size** | `db-custom-1-3840` (1 vCPU, 3.75GB) | `db-f1-micro` (shared, cheapest) |
| **Data** | Real user data (migrated from Render) | Synthetic/seed data only |
| **CDR data** | Yes — CDR-protected, CMEK encrypted | NO — synthetic only (CDR §13.6) |
| **Backups** | Daily automated + point-in-time recovery | Weekly or manual only |
| **HA** | Recommended | Not needed |
| **Firebase Auth** | Shared project | Shared project |
| **GCS bucket** | Shared (or separate if needed) | Shared (or separate if needed) |

### 3.3 Vercel Environment Variable Scoping

Each env var is set with a **different value per Vercel scope**:

| Variable | Production Scope | Preview Scope |
|----------|-----------------|---------------|
| `DATABASE_URL` | `postgresql://...@PROD_IP/monitrax?sslmode=require` | `postgresql://...@DEV_IP/monitrax?sslmode=require` |
| `NODE_ENV` | `production` | `production` |
| `BASIQ_API_KEY` | Real API key | Sandbox/test key (or empty) |
| `GCP_PROJECT_ID` | Same | Same |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Same | Same |
| All other vars | Same or scoped as needed | Same or scoped as needed |

### 3.4 Change Transport Flow

```
Developer creates feature branch
        │
        ▼
Push to GitHub ──▶ Vercel auto-deploys PREVIEW
        │                    │
        │                    ▼
        │              Hits DEV/UAT database
        │              Test on preview URL
        │
        ▼
Merge PR to main ──▶ Vercel auto-deploys PRODUCTION
                             │
                             ▼
                       Hits PROD database
                       Live for users
```

### 3.5 Why Cloud SQL

| Requirement | Cloud SQL Capability |
|-------------|---------------------|
| PostgreSQL compatibility | Native PostgreSQL 14/15/16 |
| Automated backups | Daily automated + on-demand |
| CDR data encryption at rest | Default encryption + optional CMEK via Cloud KMS |
| High availability | Regional HA with automatic failover |
| Monitoring | Integrated with Cloud Monitoring |
| Audit logging | Cloud Audit Logs for admin activity |
| Scaling | Vertical scaling, read replicas |
| Region | australia-southeast1 (Sydney) — CDR data residency compliance |
| IAM integration | Cloud SQL IAM authentication option |

### 3.6 Connection Strategy

**Option A: Public IP + SSL (Recommended for Vercel)**
- Cloud SQL instance with public IP
- SSL certificate required for all connections
- Authorized networks whitelist (Vercel's IP ranges)
- Simplest setup for serverless (Vercel) → Cloud SQL

**Option B: Cloud SQL Auth Proxy (If self-hosting backend)**
- Required if migrating backend to Cloud Run/GKE
- Not needed if staying on Vercel

**Recommendation:** Option A (Public IP + SSL) since the frontend/API stays on Vercel.

---

## 4. Pre-Migration Checklist

Complete ALL items before starting migration.

### 4.1 GCP Project Setup

- [ ] **GCP Project exists** — Confirm `monitrax-479700` (or your project ID)
- [ ] **Billing enabled** — Cloud SQL requires billing
- [ ] **APIs enabled:**
  - [ ] Cloud SQL Admin API
  - [ ] Cloud SQL API
  - [ ] Cloud KMS API (if using CMEK)
  - [ ] Cloud Monitoring API
  - [ ] Cloud Logging API

### 4.2 Access & Permissions

- [ ] **You have these IAM roles** (or equivalent):
  - `roles/cloudsql.admin` — Create/manage Cloud SQL instances
  - `roles/cloudsql.client` — Connect to instances
  - `roles/iam.serviceAccountCreator` — Create service accounts
  - `roles/monitoring.admin` — Set up monitoring
- [ ] **gcloud CLI installed** and authenticated: `gcloud auth login`

### 4.3 Current Database Assessment

- [ ] **Record current database size:** Connect to Render DB and run:
  ```sql
  SELECT pg_size_pretty(pg_database_size('monitrax'));
  ```
- [ ] **Record table count (including legacy tables):**
  ```sql
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
  ```
- [ ] **Record row counts for critical tables:**
  ```sql
  SELECT schemaname, relname, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
  ```
- [ ] **Identify legacy tables** (tables in DB but NOT in Prisma schema):
  ```sql
  -- Compare actual tables vs Prisma-managed tables
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  ORDER BY table_name;
  ```
- [ ] **Record PostgreSQL version on Render:**
  ```sql
  SELECT version();
  ```
- [ ] **Save all results** in this document under Section 13 (Progress Tracker)

### 4.4 Backup Verification

- [ ] **Create a manual backup on Render** before starting anything
- [ ] **Export full database dump:**
  ```bash
  pg_dump -Fc -v -h <render-host> -U monitrax_user -d monitrax > monitrax_backup_$(date +%Y%m%d).dump
  ```
- [ ] **Verify dump file is valid:**
  ```bash
  pg_restore --list monitrax_backup_$(date +%Y%m%d).dump | head -20
  ```
- [ ] **Store backup in a safe location** (local + GCS bucket)

---

*Continued in: [MIGRATION_RENDER_TO_GCP_STEPS.md](./MIGRATION_RENDER_TO_GCP_STEPS.md)*
