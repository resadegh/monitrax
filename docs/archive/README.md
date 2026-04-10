# Archived Documents

**Status:** ARCHIVED - These documents are no longer authoritative.

---

## Purpose

This directory contains documents that have been **superseded, outdated, or consolidated**. They are preserved for historical reference and audit trail purposes but should **NOT** be used as a source of truth.

## Why Documents Are Archived

| Reason | Meaning |
|--------|---------|
| **Superseded** | A newer, more complete version exists elsewhere |
| **Outdated** | Content references deprecated infrastructure or incorrect status |
| **Consolidated** | Content has been merged into a single authoritative document |
| **Point-in-time** | Was a snapshot report that is no longer current |

## Rules

1. **Never update an archived document** - they are read-only historical records
2. **Never reference an archived document** as a source of truth in active docs
3. **Each archived file includes a deprecation notice** at the top explaining what replaced it
4. **Git history is preserved** - all moves use `git mv` so full history is available

## Finding the Authoritative Version

Each archived document includes a header with the path to its replacement. If you need the current version, follow that reference.

## Changelog Archives

The `changelogs/` subdirectory contains individual per-session changelog files. These have been consolidated into `docs/changelog/CHANGELOG.md` (the single authoritative changelog).

---

*Archive created: 2026-04-10*
*Archive policy: docs/bau-framework/07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md*
