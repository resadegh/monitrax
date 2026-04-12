# Changelog — 2026-04-12 — Admin Portal UI Modernization + GCP-Aligned Navigation

## Session: claude/review-monitrax-compliance-ZOfAM

### Summary

Modernized the admin portal UI with a cleaner, technical aesthetic and restructured the sidebar navigation to reflect the GCP-First architecture. Added 4 new admin pages that surface GCP data (Uptime, Errors, Security Findings, Cloud Scheduler).

### Changes Made

- **Type**: UI/UX / Architecture
- **Scope**: Admin Portal (Phase M UI layer)

---

## Sidebar Restructure — GCP-Aligned Navigation

The admin portal sidebar now uses 5 clear sections that reflect the admin's actual responsibilities in the GCP-First architecture:

| Section | Pages | Data Source |
|---------|-------|-------------|
| **Overview** | Dashboard | App data |
| **Business Management** | Organizations, Users, Billing, Analytics, Feature Flags | Monitrax PostgreSQL |
| **GCP Infrastructure** | Uptime & Alerts, Error Tracking, Cloud Scheduler, Security Findings | GCP APIs |
| **Compliance & Security** | CDR Compliance, Audit Logs, Security Monitoring | PostgreSQL + Cloud Logging |
| **Operations** | Support Tools, Settings | PostgreSQL |

### New Admin Pages

| Page | Route | GCP API |
|------|-------|---------|
| Uptime & Alerts | `/admin/uptime` | Cloud Monitoring |
| Error Tracking | `/admin/errors` | Error Reporting |
| Security Findings | `/admin/security-findings` | Security Command Center |
| Cloud Scheduler | `/admin/scheduler` | Cloud Scheduler |

Each page follows the same pattern:
- Stats cards at top (summary metrics)
- Data table (live GCP data)
- "Open in GCP Console" button (deep-link fallback)
- Refresh button
- Graceful handling when GCP credentials unavailable

---

## UI Modernization

### Design Principles Applied

1. **Generous whitespace**: 1600px max-width container, 8px base grid
2. **Subtle hierarchy**: Small caps section labels, tabular-nums for stats
3. **Restrained color**: Navy dark mode (`#070B14`), blue accent only for primary
4. **Soft edges**: `rounded-xl` (12px) cards, `rounded-lg` (8px) buttons
5. **Layered shadows**: Minimal rest, soft lift on hover
6. **Fine borders**: `border-white/[0.06]` in dark mode
7. **Thin icons**: 1.75 stroke width (lighter feel)

### Components Modernized

| Component | Key Changes |
|-----------|-------------|
| `AdminSidebar` | New 5-section structure, modern dark navy design, refined icons, section labels with tracking |
| `AdminCard` | Softer borders, subtle shadows, optional `hoverable` prop with lift effect |
| `AdminButton` | Smaller padding, subtle shadows on primary/danger, refined focus rings |
| `AdminBadge` | Cleaner color variants (kept existing) |
| `StatsCard` | Larger values (28px), tabular-nums, `accentColor` prop, uppercase labels |
| `AdminHeader` | Bigger title (24px), tighter tracking, cleaner layout |
| `EmptyState` | More refined icon container, better text hierarchy |
| `AdminLayoutClient` | Max-width container, deeper dark background (`#070B14`) |

### Color Palette (Dark Mode)

| Token | Value | Use |
|-------|-------|-----|
| Background | `#070B14` | Main content area |
| Sidebar | `#0A0F1C` | Sidebar background |
| Card | `#0F1624` | Card background |
| Border | `rgba(255,255,255,0.06)` | Subtle borders |
| Primary accent | `#3b82f6` (blue-500) | Active nav, primary button |
| Success | `#10b981` (emerald-500) | Success states |
| Warning | `#f59e0b` (amber-500) | Warning states |
| Error | `#f43f5e` (rose-500) | Error states |

---

## Files Changed

### New Files
- `app/admin/uptime/page.tsx` — Cloud Monitoring uptime checks page
- `app/admin/errors/page.tsx` — Error Reporting page
- `app/admin/security-findings/page.tsx` — Security Command Center findings page

### Updated Files
- `components/admin/layout/AdminSidebar.tsx` — Complete rewrite with 5-section structure
- `components/admin/layout/AdminHeader.tsx` — Typography refinements
- `components/admin/ui/AdminCard.tsx` — Modernized card, stats card, empty state
- `components/admin/ui/AdminButton.tsx` — Modernized variants and sizing
- `app/admin/AdminLayoutClient.tsx` — Max-width container, deeper dark background
- `docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md` — Added sections 10 (nav) and 11 (design system)

---

## Build Status

| Step | Status |
|------|--------|
| `npm run build` | PASS |
| New pages compiled | ✅ `/admin/uptime`, `/admin/errors`, `/admin/scheduler`, `/admin/security-findings` |
| TypeScript | Zero errors |

---

## Verification (Post-Deploy)

After merging and deploying:
1. Log in to admin portal at `monitrax.com.au/admin/login`
2. Verify new sidebar has 5 sections
3. Navigate to each new GCP page and verify data loads
4. Dashboard should no longer show "Failed to fetch" (global fetch interceptor fixes it)
5. Test the modernized design — cleaner, more technical feel

---

*Session Date: 2026-04-12*
