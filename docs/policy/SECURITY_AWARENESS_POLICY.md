# Security Awareness Policy

**Version:** 1.0
**Created:** 2026-03-08
**Owner:** Resadegh (Director, Monitrax)
**Review Cycle:** Annual (next review: 2027-03-08)
**Basiq Requirement:** Section 7 — HR Practices (§7.1, §7.3)
**Applies To:** Director (current), all future staff

---

## 1. Purpose

This policy ensures that all individuals with access to Monitrax systems and CDR-protected data understand their security responsibilities and receive appropriate training. It establishes the framework for security awareness that will scale as the team grows.

---

## 2. Current Context

Monitrax is operated by a sole director who handles all development, administration, and data access. This policy documents the director's self-directed security awareness and establishes the requirements that will apply to future staff.

---

## 3. Director Security Awareness (Current)

The director maintains security awareness through:

| Activity | Frequency | Evidence |
|----------|-----------|---------|
| CDR compliance work (this project) | Ongoing | CDR Compliance Matrix, Implementation Plan |
| OAIC privacy guidance review | Quarterly | Manual review of OAIC updates |
| Dependency vulnerability review | Monthly | `npm audit` output review |
| Security incident review | As needed | Incident Response Plan |
| CLAUDE.md security rules maintenance | Ongoing | CLAUDE.md §12.5, §13 |

---

## 4. Security Topics All Personnel Must Understand

### 4.1 CDR Data Handling

| Topic | Key Points |
|-------|-----------|
| What is CDR data | Bank accounts, transactions, balances sourced via Basiq Open Banking |
| CDR data classification | CDR-Protected, CDR-Derived, Non-CDR (see CLAUDE.md §13.1) |
| Consent lifecycle | Active → Expired/Revoked → Data deleted |
| Data minimization | Only collect CDR data necessary for the service |
| No CDR data in logs | Use `sanitizeCdrMetadata()` for all audit logging |
| No CDR data in errors | Generic error messages to clients |
| No CDR data on devices | Browser rendering only, no local storage |

### 4.2 Access Control

| Topic | Key Points |
|-------|-----------|
| Authentication | GCP Identity Platform (Firebase Auth) — unique accounts only |
| MFA | Required for CDR data access and admin roles |
| RBAC | 4 roles (Owner, Admin, Contributor, Viewer) — least privilege |
| Password requirements | 12+ characters with complexity |
| Session management | 30-minute idle timeout |

### 4.3 Secure Development

| Topic | Key Points |
|-------|-----------|
| Code review | All changes via Pull Request |
| Dependency management | Review new packages, monitor for vulnerabilities |
| Secret management | No secrets in code; use environment variables or GCP Secret Manager |
| OWASP Top 10 | Awareness of common vulnerabilities (XSS, injection, CSRF) |
| Build verification | `npm run build` must pass before commits |

### 4.4 Incident Response

| Topic | Key Points |
|-------|-----------|
| Recognizing incidents | Unusual access patterns, unexpected data exposure |
| Reporting | Immediately report suspected breaches |
| Containment | Revoke sessions, rotate credentials, isolate systems |
| Notification | OAIC notification within 30 days for CDR breaches |

---

## 5. Future Staff Onboarding Requirements

When hiring, new staff must complete the following before accessing any systems:

### Week 1 — Security Onboarding

- [ ] Read and sign this Security Awareness Policy
- [ ] Read CLAUDE.md §12.5 (Secure by Design) and §13 (CDR Compliance)
- [ ] Read CDR Data Retention Schedule
- [ ] Read Device Security Policy and confirm compliance
- [ ] Read Incident Response Plan
- [ ] Complete CDR data handling quiz (to be created)
- [ ] Set up MFA on all accounts
- [ ] Receive role-appropriate access (least privilege)

### Ongoing

- [ ] Quarterly security awareness refresher
- [ ] Annual policy review and re-acknowledgement
- [ ] Immediate notification of any suspected security incident

---

## 6. Security Awareness Training Schedule

| Training | Audience | Frequency | Format |
|----------|----------|-----------|--------|
| CDR data handling | All staff | Onboarding + Annual | Self-paced document review |
| Secure development practices | Developers | Onboarding + Annual | Self-paced + code review |
| Incident response procedures | All staff | Annual | Tabletop exercise |
| Phishing awareness | All staff | Quarterly | Email awareness |
| OWASP Top 10 | Developers | Annual | Self-paced |

---

## 7. Policy Violations

| Violation | Response |
|-----------|----------|
| Accidental CDR data exposure | Incident Response Plan activated; remediation required |
| Sharing credentials | Immediate credential rotation; written warning |
| Bypassing access controls | Investigation; potential termination |
| Failure to report incident | Written warning; retraining |

---

## 8. Compliance Verification

| Check | Frequency | Owner |
|-------|-----------|-------|
| Policy review and update | Annual | Director |
| Staff training completion | On hire + Annual | Director |
| Incident response drill | Annual | Director |
| CDR handling quiz (future) | On hire + Annual | Director |

---

## 9. References

| Document | Path |
|----------|------|
| CDR Compliance Matrix | `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` |
| CLAUDE.md (Security rules) | `CLAUDE.md` §12.5, §13 |
| CDR Data Retention Schedule | `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` |
| Device Security Policy | `docs/policy/DEVICE_SECURITY_POLICY.md` |
| Incident Response Plan | `docs/policy/INCIDENT_RESPONSE_PLAN.md` |
| Approved Dependencies List | `docs/policy/APPROVED_DEPENDENCIES.md` |

---

*Last Updated: 2026-03-08*
*Next Review: 2027-03-08*
