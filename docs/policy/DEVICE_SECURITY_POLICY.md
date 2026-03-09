# Device & Endpoint Security Policy

**Version:** 1.0
**Created:** 2026-03-08
**Owner:** Resadegh (Director, Monitrax)
**Review Cycle:** Annual (next review: 2027-03-08)
**Basiq Requirement:** Section 4 — Device Management (§4.1, §4.2, §4.3)
**Applies To:** All devices used to develop, administer, or access Monitrax production systems

---

## 1. Purpose

This policy defines the security requirements for devices (laptops, desktops, mobile devices) that access Monitrax systems containing CDR-protected data. It ensures device-level security controls are in place to protect consumer financial data.

---

## 2. Current Context

Monitrax is operated by a sole director/developer. There are no employees at this time. This policy applies to the director's personal devices and will be extended to staff devices when the team grows.

---

## 3. Device Security Requirements

### 3.1 Operating System & Patching (§4.1)

| Requirement | Implementation |
|-------------|----------------|
| OS auto-updates enabled | macOS automatic updates enabled (System Settings → General → Software Update) |
| Security patches applied promptly | Critical patches applied within 7 days of release |
| OS must be a supported version | macOS running a currently supported version (receiving security updates) |
| No jailbroken or rooted devices | Not applicable (macOS) |

### 3.2 Production Network Isolation (§4.2)

| Requirement | Implementation |
|-------------|----------------|
| No direct database access from dev devices | Production PostgreSQL on Render — accessible only via Render Dashboard or Render Shell |
| No SSH tunnel to production DB | Prohibited. All production DB operations via Render Console |
| API access via HTTPS only | Dev machines connect to production API endpoints via HTTPS |
| GCP Console access via IAM | GCP resources (Identity Platform, Cloud Storage, Vision AI) accessed via GCP Console with IAM-controlled permissions |
| Environment separation | Development uses local PostgreSQL or test database; production credentials never used in local development |

### 3.3 Anti-Malware & Endpoint Protection (§4.3)

| Requirement | Implementation |
|-------------|----------------|
| Anti-malware active | macOS XProtect (built-in, always active, auto-updated) |
| Gatekeeper enabled | macOS Gatekeeper prevents unsigned/unverified applications from running |
| Firewall enabled | macOS Application Firewall enabled (System Settings → Network → Firewall) |
| FileVault encryption | FileVault full-disk encryption enabled for all startup volumes |

---

## 4. Access Controls

| Control | Implementation |
|---------|----------------|
| Device login password | Strong password required (12+ characters) |
| Screen auto-lock | Enabled after 5 minutes of inactivity |
| Biometric auth | Touch ID enabled where available |
| No shared device access | Development devices are single-user only |

---

## 5. Software Requirements

| Category | Allowed | Prohibited |
|----------|---------|------------|
| Browser | Chrome, Safari, Firefox (latest versions) | Outdated browsers without security patches |
| Development tools | VS Code, Terminal, Git, Node.js, npm | Unlicensed or pirated software |
| Remote access | GCP Console, Render Dashboard (HTTPS) | Direct SSH to production, VPN tunnels to prod network |
| Communication | Email, Slack (encrypted channels) | Unencrypted communication channels for CDR data |

---

## 6. CDR Data on Devices

| Rule | Implementation |
|------|----------------|
| No CDR data stored locally | CDR data fetched via API, rendered in browser, never saved to disk |
| No CDR data in browser storage | localStorage/sessionStorage must not contain financial data |
| No CDR data in screenshots/recordings | Sensitive data must be redacted before sharing |
| No CDR data in email | Financial data must not be sent via email |
| Development uses synthetic data | Dev/staging environments use mock data only |

---

## 7. Incident Response (Device Compromise)

If a device is lost, stolen, or compromised:

1. **Immediately** revoke all active sessions (admin and user)
2. **Immediately** rotate all credentials stored on the device
3. **Report** via the Incident Response Plan (`docs/policy/INCIDENT_RESPONSE_PLAN.md`)
4. **Remote wipe** the device if possible (via Find My Mac)
5. **Audit** all access from the device in the last 30 days

---

## 8. Future Staff Onboarding

When hiring staff, the following must be added to the onboarding process:

- [ ] Device security policy acknowledgement signed
- [ ] FileVault encryption verified
- [ ] Firewall enabled
- [ ] Auto-updates enabled
- [ ] Screen auto-lock configured (5 min max)
- [ ] No direct production database access configured
- [ ] Separate dev credentials issued (not shared with director)

---

## 9. Compliance Verification

| Check | Frequency | Owner |
|-------|-----------|-------|
| FileVault encryption active | Quarterly | Director |
| OS auto-updates enabled | Quarterly | Director |
| No CDR data on local disk | Quarterly | Director |
| Firewall enabled | Quarterly | Director |
| Policy review | Annual | Director |

---

## 10. References

| Document | Path |
|----------|------|
| CDR Compliance Matrix | `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` §4 |
| Incident Response Plan | `docs/policy/INCIDENT_RESPONSE_PLAN.md` |
| CLAUDE.md §13.6 | Environment Separation rules |

---

*Last Updated: 2026-03-08*
*Next Review: 2027-03-08*
