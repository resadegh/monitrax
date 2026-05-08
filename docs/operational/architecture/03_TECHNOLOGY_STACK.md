# Technology Stack

Complete reference of all technologies, services, and dependencies used by Monitrax.

> **Cost-side companion:** for the **paid-services inventory** (every external vendor, pricing model, estimated monthly spend, actuals), see [`docs/operational/cost-control/00_VENDOR_INVENTORY.md`](../cost-control/00_VENDOR_INVENTORY.md). For per-vendor budget-alert + spend-cap setup, see [`docs/operational/cost-control/01_BUDGET_ALERTS_SETUP.md`](../cost-control/01_BUDGET_ALERTS_SETUP.md). Reviewers reject PRs that add a new external vendor without a row in those docs (CLAUDE.md §16.2 covered surface).

---

## Core Platform

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Next.js | 15.2.6 | Full-stack React framework (App Router) |
| UI Library | React | 19.x | Component rendering |
| Language | TypeScript | 5.x | Type-safe development |
| ORM | Prisma | 5.22.0 | Database access and schema management |
| Database | PostgreSQL | 15 | Primary data store (GCP Cloud SQL) |
| CSS | TailwindCSS | 3.4.1 | Utility-first styling |
| CSS Animations | tailwindcss-animate | 1.0.7 | Animation utilities |
| Hosting | Vercel | -- | Frontend + API hosting, CDN, serverless functions |
| Auth | Firebase (GCP Identity Platform) | 12.9.0 | Authentication, MFA, OAuth, token management |

---

## UI Component Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| Radix UI (multiple packages) | Various | Accessible, unstyled primitives (dialogs, dropdowns, tabs, tooltips, etc.) |
| lucide-react | 0.553.0 | Icon library |
| class-variance-authority | 0.7.1 | Component variant management (Shadcn/UI pattern) |
| clsx | 2.1.1 | Conditional CSS class merging |
| tailwind-merge | 3.4.0 | Intelligent Tailwind class merging |
| next-themes | 0.4.6 | Dark/light theme switching |
| recharts | 3.5.0 | Chart and data visualisation library |

### Radix UI Packages in Use

- `@radix-ui/react-alert-dialog` (1.1.15)
- `@radix-ui/react-checkbox` (1.3.3)
- `@radix-ui/react-dialog` (1.1.15)
- `@radix-ui/react-dropdown-menu` (2.1.15)
- `@radix-ui/react-label` (2.1.8)
- `@radix-ui/react-select` (2.2.6)
- `@radix-ui/react-separator` (1.1.8)
- `@radix-ui/react-slot` (1.2.4)
- `@radix-ui/react-switch` (1.2.6)
- `@radix-ui/react-tabs` (1.1.13)
- `@radix-ui/react-tooltip` (1.2.8)

---

## Backend / API Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| @prisma/client | 5.22.0 | Database queries (generated from schema) |
| zod | 3.23.8 | Input validation for API routes |
| jsonwebtoken | 9.0.2 | JWT handling (legacy, being phased out) |
| bcryptjs | 2.4.3 | Password hashing (legacy auth paths) |
| google-auth-library | 10.6.1 | GCP token verification for Firebase Auth |
| uuid | 9.0.0 | Unique identifier generation |

---

## External Services

### Basiq Open Banking

| Aspect | Detail |
|--------|--------|
| Purpose | Australian CDR-compliant bank data aggregation |
| Data provided | Account balances, transactions, account details |
| Integration | REST API via `/api/basiq/*` routes |
| CDR compliance | All data classified as CDR-protected |
| Environments | Production key for real data, sandbox key for dev |

### Resend (Email)

| Aspect | Detail |
|--------|--------|
| Package | resend 6.5.2 |
| Purpose | Transactional email delivery |
| Used for | Notifications, alerts, magic link delivery |

### Twilio (SMS)

| Aspect | Detail |
|--------|--------|
| Package | twilio 5.10.7 |
| Purpose | SMS notifications |
| Used for | MFA codes, alerts |

### Google Gemini AI

| Aspect | Detail |
|--------|--------|
| Package | @google/generative-ai 0.24.1 |
| Purpose | AI-powered financial strategy, document intelligence, category inference |
| Used by | AI Strategy Engine, Document Intelligence Engine, Transactional Intelligence |
| Migration | All AI features migrated from OpenAI to Gemini (Phase 27) |

### Google Cloud Vision

| Aspect | Detail |
|--------|--------|
| Package | @google-cloud/vision 5.3.4 |
| Purpose | OCR text extraction from documents and receipts |

### Google Maps / Places

| Aspect | Detail |
|--------|--------|
| Integration | Google Maps Geocoding API via `/api/geocode` and `/api/places` |
| Purpose | Property address lookup and validation |

### OpenAI (Legacy)

| Aspect | Detail |
|--------|--------|
| Package | openai 6.9.1 |
| Status | Legacy -- all active AI features now use Google Gemini |
| Note | Package still in dependencies; may be removed in future cleanup |

---

## GCP Services

| Service | Purpose | Status |
|---------|---------|--------|
| **Identity Platform** | Sole authentication provider (Firebase Auth) | Active |
| **Cloud SQL** | PostgreSQL database hosting (prod + dev instances) | Active |
| **Cloud Storage (GCS)** | Document and file storage | Active |
| **Cloud Vision** | OCR for document intelligence | Active |
| **Cloud Scheduler** | Scheduled jobs (CDR consent expiry checks) | Active |
| **Cloud KMS (CMEK)** | Customer-managed encryption keys for CDR data at rest | Required for CDR |
| **Cloud Armor** | WAF and DDoS protection for CDR endpoints | Required for CDR |
| **Security Command Center** | Vulnerability scanning and compliance monitoring | Required for CDR |
| **Cloud Logging** | Centralised log retention (90+ days) | Planned |
| **Cloud Monitoring** | Uptime checks, error rate alerts | Planned |
| **Error Reporting** | Automated error grouping and alerting | Planned |
| **Cloud DLP** | PII detection and redaction in CDR data | Planned |

---

## File Processing Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| xlsx | 0.18.5 | Excel file generation for report exports |
| jszip | 3.10.1 | ZIP file creation for bulk document downloads |
| unpdf | 1.4.0 | PDF text extraction |
| qrcode | 1.5.4 | QR code generation (MFA setup) |

---

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| prisma | 5.22.0 | Schema management, migrations, Prisma Studio |
| vitest | 1.6.1 | Test runner |
| @vitest/coverage-v8 | 1.6.1 | Code coverage |
| eslint | 8.x | Code linting |
| eslint-config-next | 15.2.6 | Next.js-specific lint rules |
| ts-node | 10.9.2 | TypeScript execution for scripts and seeds |
| @types/uuid | 10.0.0 | TypeScript types for uuid |

---

## Build Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Local development server |
| `build` | `prisma generate && next build` | Production build (no DB push -- critical safety rule) |
| `start` | `next start` | Start production server |
| `lint` | `next lint` | Run ESLint |
| `test` | `vitest run` | Run test suite |
| `test:watch` | `vitest` | Run tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Run tests with coverage report |
| `postinstall` | `prisma generate` | Auto-generate Prisma client after npm install |

---

## Database Schema Scale

| Metric | Count |
|--------|-------|
| Prisma models | 83 |
| API route files | 204 |
| API module directories | 46 |
| Dashboard pages | 17 |

---

## Key Architecture Constraints

These are not technologies but rules that affect how technologies are used. Support should be aware of them.

| Constraint | Detail |
|------------|--------|
| No `prisma db push` in build scripts | Schema changes are manual only to prevent data loss |
| Firebase is the sole auth provider | No custom JWT system -- all auth goes through Firebase |
| Financial calculations centralised | All via `masterFinancialService.ts`, never inline in API routes |
| CDR data never in dev | Production database only for real bank data |
| API routes are thin wrappers | Business logic lives in `lib/`, not in route handlers |
| Node.js 20+ required | Minimum runtime version |
| Package manager | npm (not yarn or pnpm) |

---

Last Updated: 2026-04-09
