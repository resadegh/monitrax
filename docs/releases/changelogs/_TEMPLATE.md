# Changelog: Version [X.Y.Z]

**Release Date**: [Date]
**Release Type**: Major | Minor | Patch | Hotfix
**Branch**: [branch-name]
**Deployed To**: Production | Staging | Both

---

## Summary

Brief summary of what this release contains (1-2 sentences).

---

## Features

### [Feature Name]
**Blueprint**: [Link]
**Design**: [Link]

Description of the feature and what it enables users to do.

- Sub-feature or capability 1
- Sub-feature or capability 2

---

## Improvements

### [Improvement Area]
Description of improvement and benefit.

---

## Bug Fixes

### [Bug Title]
**Issue**: [Link to issue if applicable]
**Root Cause**: Brief description of what caused the bug
**Fix**: How it was fixed

---

## Breaking Changes

### [Breaking Change]
**Affected**: [What is affected]
**Migration**: Steps to migrate

```typescript
// Before
oldWay();

// After
newWay();
```

---

## Database Changes

| Type | Object | Description |
|------|--------|-------------|
| Added | [table/column] | [Description] |
| Modified | [table/column] | [Description] |
| Removed | [table/column] | [Description] |

**Migration Required**: Yes/No
**Migration File**: [path if applicable]

---

## API Changes

### New Endpoints
- `POST /api/[endpoint]` - Description

### Modified Endpoints
- `GET /api/[endpoint]` - Added field X

### Deprecated Endpoints
- `DELETE /api/[endpoint]` - Use X instead

### Removed Endpoints
- `GET /api/[endpoint]` - Removed in favor of X

---

## Configuration Changes

### New Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `VAR_NAME` | Yes/No | Purpose |

### Changed Environment Variables
| Variable | Change |
|----------|--------|
| `VAR_NAME` | [Description of change] |

---

## Dependencies

### Added
- `package-name@version` - Purpose

### Updated
- `package-name` - From X.Y.Z to A.B.C

### Removed
- `package-name` - Reason

---

## Security Updates

- [Security update description]
- CVE fixes: [list if applicable]

---

## Performance

- [Performance improvement description]
- Benchmarks: [before vs after if applicable]

---

## Known Issues

- [Issue description] - Workaround: [workaround]

---

## Deployment Notes

### Pre-deployment Checklist
- [ ] Database backup completed
- [ ] Environment variables configured
- [ ] Team notified

### Post-deployment Verification
- [ ] Health check passing
- [ ] Critical paths tested
- [ ] Monitoring verified

---

## Contributors

- [Name] - [Contribution area]

---

## Related Documents

- Release Index: [Link]
- Architecture Log: [Entries]
- Blueprints: [Links]
- Designs: [Links]
