# Monitrax - Claude Code Change Management Protocol

> **This document defines the MANDATORY change management process for ALL Claude Code sessions.**
> **Every instruction in this file MUST be followed WITHOUT user prompting.**

---

## PART 1: SESSION STARTUP PROTOCOL (MANDATORY)

At the START of every new session, BEFORE making ANY changes, you MUST complete these steps:

### Step 1: Read ALL Core Blueprint Documents

Read these documents IN ORDER to understand the current system state:

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

### Step 2: Read Relevant Phase Documents

If the requested change relates to a specific feature, read the corresponding Phase document:

```
docs/blueprint/PHASE_*.md  (relevant to the change)
```

### Step 3: Review Current Codebase State

Before making changes, explore and understand:

1. **Schema**: Read `prisma/schema.prisma` to understand data models
2. **Affected Files**: Identify and read all files that will be modified
3. **Related Components**: Review connected components/APIs
4. **Recent Changes**: Check `docs/blueprint/CHANGELOG_*.md` for recent updates

### Step 4: Create Session Todo List

Use TodoWrite to create a task list including:
- [ ] Blueprint documents read
- [ ] Codebase reviewed
- [ ] Implementation tasks (specific to request)
- [ ] Documentation updates
- [ ] PR creation

---

## PART 2: CHANGE MANAGEMENT PROCESS

### 2.1 Branch Strategy

**ALWAYS create a feature branch for changes:**

```bash
git checkout -b claude/{feature-name}-{session-id-suffix}
```

**NEVER commit directly to main/master.**

### 2.2 Implementation Standards

Follow these rules for ALL code changes:

| Rule | Description |
|------|-------------|
| **Small Commits** | Each commit should be atomic and reversible |
| **Descriptive Messages** | Commit messages must explain WHY, not just WHAT |
| **No Breaking Changes** | Maintain backward compatibility |
| **Test Before Commit** | Run `npm run build` and `npm run lint` before committing |

### 2.3 Commit Message Format

```
type(scope): description

- Detail 1
- Detail 2

Refs: docs/blueprint/PHASE_XX.md
https://claude.ai/code/{session-url}
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## PART 3: DOCUMENTATION REQUIREMENTS (MANDATORY)

### 3.1 What MUST Be Documented

After EVERY change, update the relevant documentation:

| Change Type | Documentation Required |
|-------------|----------------------|
| **New Feature** | Update Phase doc, MASTER_BLUEPRINT.md, create CHANGELOG entry |
| **Bug Fix** | Update CHANGELOG, add to ERROR_LOG.md if applicable |
| **Schema Change** | Update 03_DATA_MODEL.md, Phase doc, MASTER_BLUEPRINT.md |
| **API Change** | Update 07_API_STANDARDS.md, Phase doc |
| **UI Change** | Update 06_UI_UX_FOUNDATION.md if pattern changes |
| **New Engine** | Update 01_ARCHITECTURE_OVERVIEW.md, create/update Phase doc |

### 3.2 Changelog Entry Format

Create or update `docs/blueprint/CHANGELOG_YYYY_MM_DD.md`:

```markdown
# Changelog - YYYY-MM-DD

## Session: {session-id}

### Changes Made
- **Type**: Feature/Fix/Enhancement
- **Scope**: {module/component affected}
- **Description**: {what was changed and why}

### Files Modified
- `path/to/file1.ts` - {description of change}
- `path/to/file2.ts` - {description of change}

### Documentation Updated
- `docs/blueprint/PHASE_XX.md` - {what was updated}
- `docs/blueprint/MASTER_BLUEPRINT.md` - {what was updated}

### Testing
- [ ] Build passes
- [ ] Lint passes
- [ ] Manual testing completed

### PR
- PR URL: {url}
- Status: {Open/Merged}
```

### 3.3 Phase Document Updates

When implementing Phase features, update the Phase document:

1. Mark completed items as ✅
2. Update implementation notes
3. Add any new requirements discovered
4. Document any deviations from original spec

### 3.4 Master Blueprint Updates

Update `docs/blueprint/MASTER_BLUEPRINT.md` when:

- Phase status changes (In Progress → Complete)
- New capabilities are added
- Architecture changes occur

---

## PART 4: DEPLOYMENT PROCESS (PR REQUIRED)

### 4.1 Every Deployment = Pull Request

**NO direct deployments. ALL changes go through PR.**

### 4.2 PR Creation Checklist

Before creating PR, verify:

- [ ] All code changes committed
- [ ] All documentation updated
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Changelog entry created
- [ ] Relevant Phase docs updated

### 4.3 PR Template

When creating PR, use this format:

```markdown
## Summary
{Brief description of changes}

## Changes Made
- {Change 1}
- {Change 2}

## Documentation Updated
- [ ] Changelog entry created
- [ ] Phase document updated
- [ ] Master Blueprint updated (if applicable)

## Testing
- [ ] Build passes
- [ ] Lint passes
- [ ] Manual testing completed

## Blueprint Alignment
- Follows: docs/blueprint/PHASE_XX.md
- Architecture: docs/blueprint/01_ARCHITECTURE_OVERVIEW.md

https://claude.ai/code/{session-url}
```

### 4.4 PR Delivery

After creating PR:
1. Provide the PR URL to the user
2. Summarize what was changed
3. List any follow-up actions needed

---

## PART 5: VERSION CONTROL STANDARDS

### 5.1 File Change Tracking

For every session, maintain awareness of:

```
Files Created:    {list}
Files Modified:   {list}
Files Deleted:    {list}
Docs Updated:     {list}
```

### 5.2 Rollback Readiness

Every change must be reversible:

- Commits are atomic
- No destructive database operations without backup plan
- Document rollback steps for complex changes

### 5.3 Conflict Resolution

If conflicts arise:

1. Fetch latest from remote
2. Review conflicts carefully
3. Preserve existing functionality
4. Document resolution in commit message

---

## PART 6: ARCHITECTURE ENFORCEMENT

### 6.1 Master Financial Service (CRITICAL)

**ALL financial calculations MUST use:**
- `lib/services/masterFinancialService.ts` → `getMasterFinancialSnapshot()`
- API endpoint: `/api/master-snapshot`

**NEVER:**
- Calculate expenses/income/cashflow directly in API routes
- Create new calculation logic outside the Master Financial Service
- Aggregate financial data manually in components

### 6.2 Canonical Utility Locations

| Logic Type | Location |
|------------|----------|
| ALL FINANCIAL DATA | `lib/services/masterFinancialService.ts` |
| Currency formatting | `lib/utils/formatters.ts` |
| Frequency conversion | `lib/utils/frequencies.ts` |
| Ownership validation | `lib/utils/ownership.ts` |
| Net worth | `lib/calculations/netWorthCalculator.ts` |
| Cashflow | `lib/calculations/cashflowOrchestrator.ts` |
| Expense aggregation | `lib/calculations/expenseAggregator.ts` |
| Income aggregation | `lib/calculations/incomeAggregator.ts` |
| Loan aggregation | `lib/calculations/loanAggregator.ts` |

### 6.3 Module Boundaries (Strict)

- Properties cannot fetch Loans directly
- Loans cannot fetch Accounts directly
- All modules request from: Snapshot Engine, Insights Engine, or their own API

### 6.4 Financial Engines Must Be Pure

Engines must:
- Accept raw data
- Return structured outputs
- **NEVER** mutate global state
- **NEVER** fetch from external sources

### 6.5 GRDCS Entity Contract

Every entity MUST have:
```typescript
{
  id: string,        // Format: {module}-{uuid}
  type: string,
  name: string,
  href: string,      // Format: /{module}/{id}
  metadata: Record<string, any>,
  links: GRDCSLink[]
}
```

### 6.6 API Response Format (Universal)

```json
{
  "success": boolean,
  "data": {},
  "error": null | { "code": string, "message": string, "details": any },
  "meta": { "timestamp": "ISO8601", "durationMs": number }
}
```

### 6.7 UI/UX Standards

- **Entity dialogs** must have: Overview, Linked Data, Insights, Actions tabs
- **No dead-ends** - every screen leads somewhere
- **No duplicate numbers** - each metric appears in one primary location
- **Severity colors**: Critical=#DC2626, High=#EA580C, Medium=#F59E0B, Low=#3B82F6

---

## PART 7: SESSION END PROTOCOL

Before ending a session, ensure:

### 7.1 Completion Checklist

- [ ] All code changes committed and pushed
- [ ] All documentation updated
- [ ] Changelog entry created for today
- [ ] PR created and URL provided to user
- [ ] Summary of changes provided
- [ ] Any pending items documented for next session

### 7.2 Handoff Documentation

If work is incomplete, document:

1. What was completed
2. What remains to be done
3. Any blockers or issues
4. Recommended next steps

---

## PART 8: KEY FILE LOCATIONS

| Purpose | Path |
|---------|------|
| Prisma Schema | `prisma/schema.prisma` |
| API Routes | `app/api/` |
| Dashboard Pages | `app/dashboard/` |
| Shared Components | `components/` |
| Business Logic | `lib/` |
| Blueprint Docs | `docs/blueprint/` |
| Changelogs | `docs/blueprint/CHANGELOG_*.md` |
| Phase Docs | `docs/blueprint/PHASE_*.md` |
| Master Blueprint | `docs/blueprint/MASTER_BLUEPRINT.md` |

---

## PART 9: QUICK REFERENCE

### Pre-Change Checklist
- [ ] Read ALL core blueprint documents
- [ ] Read relevant Phase documents
- [ ] Review affected codebase areas
- [ ] Create session todo list
- [ ] Create feature branch

### Post-Change Checklist
- [ ] All changes committed with proper messages
- [ ] Documentation updated (Changelog, Phase docs, Master Blueprint)
- [ ] Build passes
- [ ] Lint passes
- [ ] PR created
- [ ] PR URL provided to user
- [ ] Summary provided to user

---

## PART 10: RESEARCH-BEFORE-ACTION PROTOCOL (CRITICAL)

> **This section exists because of a recurring issue: making assumptions instead of reading
> the documentation and understanding the architecture before writing code.**
> **This is a PERMANENT behavioral rule that applies to EVERY session, EVERY task, EVERY decision.**

### 10.1 The Rule: NEVER Guess — ALWAYS Verify

Before making ANY design decision or writing ANY code, you MUST:

1. **Read the relevant blueprint documents** — not skim, READ
2. **Read the relevant source code** — understand how it currently works
3. **Trace the data flow** — follow the actual code path end-to-end
4. **Check recent changelogs** — understand what has changed recently
5. **Only THEN** propose or implement a solution

### 10.2 Common Mistakes to Avoid

| Mistake | Correct Behavior |
|---------|-----------------|
| Assuming how auth works | Read `01_ARCHITECTURE_OVERVIEW.md` §6, `PHASE_10*.md`, and the actual auth code |
| Assuming a route is used | Check if the frontend actually calls it (read the page/component) |
| Assuming a feature exists | Search the codebase with Glob/Grep before claiming it exists |
| Adding code to a file without reading it | ALWAYS read the full file first |
| Making changes based on a previous session's memory | Re-verify — the codebase may have changed |
| Adding logging/features to dead code | Verify the code path is actually exercised |

### 10.3 The Research Checklist (Before Every Change)

For EVERY change, complete this checklist mentally:

- [ ] **What does the blueprint say?** — Read the relevant Phase doc and architecture doc
- [ ] **How does it currently work?** — Read the actual implementation files end-to-end
- [ ] **What calls this code?** — Trace callers/consumers (frontend → API → service → DB)
- [ ] **Is this code even active?** — Verify the code path is reachable from the frontend
- [ ] **What are the dependencies?** — Read connected modules/services
- [ ] **What changed recently?** — Check changelogs and recent commits

### 10.4 Build Plan Requirement

For ANY non-trivial change:

1. **Create a build plan** using TodoWrite BEFORE writing code
2. **Track progress** — update todo status as you complete each item
3. **Keep the plan current** — add/remove tasks as scope changes
4. **Mark completion** — never leave stale todos

### 10.5 When Continuing a Previous Session

When resuming from a previous session or context summary:

1. **Do NOT trust the summary blindly** — verify key claims by reading files
2. **Re-read affected source files** — they may have changed
3. **Re-read relevant Phase docs** — requirements may have been updated
4. **Check git log** — see what was actually committed vs what was claimed

### 10.6 Enforcement

This protocol is enforced by CLAUDE.md and must be followed in EVERY session.
If you catch yourself about to write code without having read the relevant documents
and source files, **STOP and read them first**. No exceptions.

---

## PART 11: MANDATORY CHANGE DOCUMENTATION & BUILD TRACKING (NON-NEGOTIABLE)

> **Every code change MUST be documented and tracked. No exceptions.**
> **This section exists because undocumented changes lead to lost context, debugging guesswork,
> and repeated mistakes across sessions. This is a PERMANENT, NON-NEGOTIABLE rule.**

### 11.1 Change Log — Every Session, Every Change

For EVERY session that produces code changes, you MUST create or update a changelog:

**File**: `docs/blueprint/CHANGELOG_YYYY_MM_DD.md` (one per day, append if exists)

**Required content for each change:**

```markdown
## Session: {session-id-suffix}

### Changes Made
- **Type**: Feature / Fix / Refactor / Enhancement
- **Scope**: {module/component affected}
- **Root Cause** (for fixes): {why the bug existed}
- **Solution**: {what was changed and why}

### Files Modified
- `path/to/file.ts` — {description of change}

### Build Status
- [x] TypeScript compilation passes
- [x] Build passes (`npm run build`)
- [ ] Tests pass (if applicable)

### Commit History
| Hash | Message |
|------|---------|
| abc1234 | fix(scope): description |
```

### 11.2 Build Tracker — Always Verify Before Committing

**Before EVERY commit:**

1. Run `npm run build` (or at minimum verify TypeScript compiles)
2. Record the build result in the changelog
3. If the build fails, **fix it before committing** — NEVER commit broken code
4. If a pre-existing build issue blocks (unrelated to your changes), document it clearly

**Track build status throughout the session:**

| Step | Status | Notes |
|------|--------|-------|
| Initial build | PASS/FAIL | Before making changes |
| After change 1 | PASS/FAIL | Description |
| After change 2 | PASS/FAIL | Description |
| Final build | PASS/FAIL | Before push |

### 11.3 Progress Summary — On Request or Session End

When asked for progress OR at session end, provide a structured summary:

1. **What was done** — List all changes with file paths and commit hashes
2. **What was verified** — Build status, manual checks performed
3. **What remains** — Pending work, known issues, follow-up tasks
4. **Architecture decisions** — Why specific approaches were chosen

### 11.4 Inline Documentation for Complex Fixes

When fixing bugs, always add a brief comment explaining the fix in the code itself:

```typescript
// Fix: [description of what was wrong and why this is correct]
// See: docs/blueprint/CHANGELOG_YYYY_MM_DD.md
```

### 11.5 Enforcement

- This rule is NON-NEGOTIABLE across ALL sessions
- Undocumented changes are treated as incomplete work
- If you realize you forgot to document a change, stop and document it immediately
- Changelog entries are the **primary audit trail** for all Claude Code sessions

---

## ENFORCEMENT

**This protocol is MANDATORY for every Claude Code session working on Monitrax.**

**Failure to follow this protocol results in:**
- Inconsistent codebase
- Missing documentation
- Untraceable changes
- Technical debt

**When in doubt:**
1. Read the blueprint documents
2. Ask the user for clarification
3. Document your decisions
4. Create smaller, reversible changes

---

*Last Updated: 2026-02-27*
*Protocol Version: 1.2*
