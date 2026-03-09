# Approved Dependencies List

**Version:** 1.0
**Created:** 2026-03-08
**Owner:** Resadegh (Director, Monitrax)
**Review Cycle:** Quarterly (next review: 2026-06-08)
**Basiq Requirement:** Section 6 — Development Practices (§6.4)

---

## 1. Purpose

This document maintains a list of approved npm packages used in Monitrax. All dependencies must be reviewed before inclusion in the project. New dependencies must be approved through the PR review process.

---

## 2. Approval Criteria

Before adding a new dependency, verify:

| Criterion | Minimum Requirement |
|-----------|-------------------|
| **Maintainability** | Active maintenance (commits within last 6 months) |
| **Popularity** | Established community usage (npm weekly downloads > 10,000 for core packages) |
| **Security** | No known critical/high CVEs (`npm audit`) |
| **License** | MIT, Apache-2.0, ISC, or BSD — no GPL for runtime dependencies |
| **Size** | Minimal bundle impact (prefer tree-shakeable packages) |
| **Alternatives** | Confirm no built-in Node.js/browser API can replace it |

---

## 3. Approved Production Dependencies

Last reviewed: 2026-03-08

### Framework & Runtime

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `next` | 15.2.6 | React framework (App Router, API routes, SSR) | MIT | 2026-03-08 |
| `react` | ^19.0.0 | UI library | MIT | 2026-03-08 |
| `react-dom` | ^19.0.0 | React DOM renderer | MIT | 2026-03-08 |
| `typescript` | ^5 | Type-safe JavaScript | Apache-2.0 | 2026-03-08 |

### Database & ORM

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `@prisma/client` | ^5.22.0 | PostgreSQL ORM client | Apache-2.0 | 2026-03-08 |

### Authentication & Security

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `firebase` | ^12.9.0 | GCP Identity Platform client (auth, MFA, OAuth) | Apache-2.0 | 2026-03-08 |
| `google-auth-library` | ^10.6.1 | GCP token verification (server-side) | Apache-2.0 | 2026-03-08 |
| `bcryptjs` | ^2.4.3 | Password hashing (admin accounts) | MIT | 2026-03-08 |
| `jsonwebtoken` | ^9.0.2 | Legacy JWT operations | MIT | 2026-03-08 |

### GCP Services

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `@google-cloud/storage` | ^7.18.0 | Google Cloud Storage (documents) | Apache-2.0 | 2026-03-08 |
| `@google-cloud/vision` | ^5.3.4 | Google Vision API (OCR, document analysis) | Apache-2.0 | 2026-03-08 |
| `@google/generative-ai` | ^0.24.1 | Google Gemini AI (financial analysis, recommendations) | Apache-2.0 | 2026-03-08 |

### UI Components

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `@radix-ui/react-alert-dialog` | ^1.1.15 | Accessible alert dialog | MIT | 2026-03-08 |
| `@radix-ui/react-checkbox` | ^1.3.3 | Accessible checkbox | MIT | 2026-03-08 |
| `@radix-ui/react-dialog` | ^1.1.15 | Accessible dialog/modal | MIT | 2026-03-08 |
| `@radix-ui/react-dropdown-menu` | ^2.1.15 | Accessible dropdown menu | MIT | 2026-03-08 |
| `@radix-ui/react-label` | ^2.1.8 | Accessible label | MIT | 2026-03-08 |
| `@radix-ui/react-select` | ^2.2.6 | Accessible select input | MIT | 2026-03-08 |
| `@radix-ui/react-separator` | ^1.1.8 | Visual separator | MIT | 2026-03-08 |
| `@radix-ui/react-slot` | ^1.2.4 | Slot component for composition | MIT | 2026-03-08 |
| `@radix-ui/react-switch` | ^1.2.6 | Accessible toggle switch | MIT | 2026-03-08 |
| `@radix-ui/react-tabs` | ^1.1.13 | Accessible tabs | MIT | 2026-03-08 |
| `@radix-ui/react-tooltip` | ^1.2.8 | Accessible tooltip | MIT | 2026-03-08 |
| `lucide-react` | ^0.553.0 | Icon library | ISC | 2026-03-08 |
| `recharts` | ^3.5.0 | Chart library (SVG charts) | MIT | 2026-03-08 |

### Styling

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `tailwindcss` | ^3.4.1 | Utility-first CSS framework | MIT | 2026-03-08 |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities for Tailwind | MIT | 2026-03-08 |
| `tailwind-merge` | ^3.4.0 | Merge Tailwind classes safely | MIT | 2026-03-08 |
| `postcss` | ^8 | CSS processing | MIT | 2026-03-08 |
| `class-variance-authority` | ^0.7.1 | Component variant management | Apache-2.0 | 2026-03-08 |
| `clsx` | ^2.1.1 | Conditional className utility | MIT | 2026-03-08 |
| `next-themes` | ^0.4.6 | Dark/light mode support | MIT | 2026-03-08 |

### Utilities

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `zod` | ^3.23.8 | Schema validation (API input validation) | MIT | 2026-03-08 |
| `uuid` | ^9.0.0 | UUID generation | MIT | 2026-03-08 |
| `xlsx` | ^0.18.5 | Excel file generation (reports/export) | Apache-2.0 | 2026-03-08 |
| `jszip` | ^3.10.1 | ZIP file creation (bulk downloads) | MIT/GPLv3 (dual) | 2026-03-08 |
| `qrcode` | ^1.5.4 | QR code generation (MFA setup) | MIT | 2026-03-08 |
| `unpdf` | ^1.4.0 | PDF text extraction | MIT | 2026-03-08 |

### Communication

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `resend` | ^6.5.2 | Email delivery service | MIT | 2026-03-08 |
| `twilio` | ^5.10.7 | SMS delivery (MFA codes, notifications) | MIT | 2026-03-08 |

### AI (Legacy)

| Package | Version | Purpose | License | Review Date | Notes |
|---------|---------|---------|---------|-------------|-------|
| `openai` | ^6.9.1 | Legacy OpenAI integration | Apache-2.0 | 2026-03-08 | Superseded by Gemini (Phase 27). Candidate for removal. |

---

## 4. Approved Development Dependencies

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `prisma` | ^5.22.0 | Prisma CLI (schema management, migrations) | Apache-2.0 | 2026-03-08 |
| `vitest` | ^1.6.1 | Test framework | MIT | 2026-03-08 |
| `@vitest/coverage-v8` | ^1.6.1 | Test coverage with V8 | MIT | 2026-03-08 |
| `eslint` | ^8 | Code linting | MIT | 2026-03-08 |
| `eslint-config-next` | 15.2.6 | Next.js ESLint rules | MIT | 2026-03-08 |
| `ts-node` | ^10.9.2 | TypeScript execution (seed scripts) | MIT | 2026-03-08 |

### Type Definitions

| Package | Version | Purpose | License | Review Date |
|---------|---------|---------|---------|-------------|
| `@types/bcryptjs` | ^2.4.6 | bcryptjs types | MIT | 2026-03-08 |
| `@types/jsonwebtoken` | ^9.0.7 | JWT types | MIT | 2026-03-08 |
| `@types/node` | ^20 | Node.js types | MIT | 2026-03-08 |
| `@types/qrcode` | ^1.5.6 | QR code types | MIT | 2026-03-08 |
| `@types/react` | ^19 | React types | MIT | 2026-03-08 |
| `@types/react-dom` | ^19 | React DOM types | MIT | 2026-03-08 |
| `@types/uuid` | ^10.0.0 | UUID types | MIT | 2026-03-08 |

---

## 5. Dependency Review Process

### Adding New Dependencies

1. Developer proposes dependency in PR description
2. Verify against approval criteria (§2)
3. Run `npm audit` to check for known vulnerabilities
4. Check license compatibility
5. Add to this document with review date
6. Merge PR

### Removing Dependencies

1. Identify unused dependencies via build analysis
2. Remove from `package.json`
3. Update this document (move to "Removed" section with reason)
4. Verify build passes

### Vulnerability Response

| Severity | Action | Timeline |
|----------|--------|----------|
| Critical | Update immediately or find alternative | < 24 hours |
| High | Update in next release | < 7 days |
| Medium | Update in next sprint | < 30 days |
| Low | Update at next quarterly review | Next review cycle |

---

## 6. Packages Under Review / Candidates for Removal

| Package | Reason | Action |
|---------|--------|--------|
| `openai` | Superseded by `@google/generative-ai` (Phase 27 Gemini migration) | Remove when all OpenAI references cleaned up |
| `jsonwebtoken` | Legacy — GCP Identity Platform handles token verification | Review whether still needed |

---

## 7. Automated Monitoring

| Tool | Status | Purpose |
|------|--------|---------|
| Dependabot | Enabled (`.github/dependabot.yml`) | Automated dependency update PRs |
| `npm audit` | CI pipeline | Vulnerability scanning on every push |
| GitHub Security Advisories | Enabled | Notification of vulnerable dependencies |

---

*Last Updated: 2026-03-08*
*Next Review: 2026-06-08 (Quarterly)*
