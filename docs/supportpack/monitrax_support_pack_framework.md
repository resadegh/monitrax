# Monitrax Support Pack Framework Template

## 0. Metadata

- **Pack ID:** SP-AREA-XXX
- **Version:** v1.0.0
- **Status:** Draft | In Progress | Complete
- **Author:** 
- **Date:** YYYY-MM-DD
- **Target App Version:** 
- **Target Area(s):**
- **Risk Level:** Low | Medium | High
- **AI Executor:** Claude

---

## 1. Purpose & Outcomes

**Goal:**  
> Describe the purpose in one sentence.

**Key Outcomes:**
- Outcome 1
- Outcome 2
- Outcome 3

**Non-goals:**
- Explicitly list things *not* included.

---

## 2. System Invariants (Must NOT Break)

- Backend API response shapes stay backward compatible.
- No schema or migration changes unless explicitly allowed.
- Auth, permission, env vars remain unchanged.
- Existing tests and build must pass.

### Invariant Exceptions  
(Add only if needed.)

---

## 3. Scope & Impact

**In Scope:**
- Areas / features included.

**Out of Scope:**
- Areas not to modify.

**Impacted Modules:**
- UI files
- API routes
- Shared libs
- Docs

---

## 4. Dependencies & Preconditions

- APIs that must exist
- UI components to reuse
- Feature flags
- Branching requirements

---

## 5. Execution Blocks (AI-Friendly)

### Block N: [Title]

**Objective:**  
Short objective.

**Allowed Files/Areas:**  
- List files allowed to be touched.

**Forbidden Changes:**  
- Schema  
- Auth  
- Dependencies  

**High-Level Steps:**
1. Step 1  
2. Step 2  
3. Step 3  

**Implementation Notes:**  
- Reuse patterns  
- Keep additive  

**Validation Checks:**  
- lint  
- typecheck  
- route loads  

**Git Requirements:**  
Commit pattern.

**Stop Condition:**  
Claude must stop and wait for approval.

---

## 6. Testing Plan

- Unit tests  
- Integration  
- Manual smoke tests  

---

## 7. Rollback Plan

- Revert strategy  
- Feature flags  
- Data checks  

---

## 8. AI Execution Contract

- Work only in allowed files.
- No schema or dependency changes.
- After each block: validate → summarise → STOP.
