# CDR Consumer Complaints Policy

**Version:** 1.0
**Created:** 2026-04-11
**Owner:** Director (Resadegh)
**Status:** ACTIVE
**Compliance Reference:** CDR Rules 1.15, Basiq CDR Representative requirements

---

## 1. Purpose

This policy establishes the formal process for receiving, managing, and resolving consumer complaints related to Consumer Data Right (CDR) data handling by Monitrax. It ensures compliance with CDR Rules and the Australian Privacy Act 1988.

---

## 2. Scope

This policy covers all complaints relating to:
- CDR data access, collection, use, or disclosure
- CDR consent management (granting, modifying, revoking)
- CDR data accuracy or completeness
- CDR data deletion or retention
- Privacy concerns related to CDR data
- Service issues affecting CDR data handling

---

## 3. Complaint Channels

Consumers may lodge CDR-related complaints via:

| Channel | Contact Details |
|---------|----------------|
| **Email** | complaints@monitrax.com.au |
| **In-App** | Dashboard > Settings > Privacy > Lodge Complaint |
| **Post** | Renew Group Holding Pty Ltd, [Registered Address] |

All channels are monitored and acknowledged within **2 business days**.

---

## 4. Complaint Handling Process

### 4.1 Receipt & Acknowledgement

1. Complaint is received and logged in the `CDRComplaint` database model
2. Automated acknowledgement sent to complainant within **2 business days**
3. Unique complaint reference number assigned
4. Complaint categorised by type:
   - `DATA_ACCESS` — Access to CDR data
   - `DATA_DELETION` — CDR data not being deleted as requested
   - `CONSENT_MANAGEMENT` — Issues with consent handling
   - `DATA_ACCURACY` — CDR data accuracy concerns
   - `PRIVACY` — General privacy concerns
   - `SERVICE` — Service-related CDR issues

### 4.2 Investigation

1. Director reviews the complaint within **5 business days**
2. Relevant CDR audit logs reviewed (`AuditLog` with CDR-related actions)
3. CDR data lifecycle records checked (consent status, deletion history)
4. Technical investigation conducted if system issue suspected
5. Complainant contacted for additional information if required

### 4.3 Resolution

1. Resolution determined within **30 calendar days** of receipt
2. Complainant notified of outcome in writing
3. If resolution requires CDR data action (deletion, correction):
   - Action executed immediately
   - Confirmation sent to complainant
   - Action logged in audit trail
4. Complaint record updated with resolution details

### 4.4 Escalation

If the complaint cannot be resolved within 30 days, or the complainant is unsatisfied:

1. Complainant informed of right to escalate to the **Office of the Australian Information Commissioner (OAIC)**
2. OAIC contact details provided:
   - Website: https://www.oaic.gov.au/
   - Phone: 1300 363 992
   - Post: GPO Box 5218, Sydney NSW 2001
3. Complaint marked as `ESCALATED` in the system
4. OAIC reference number recorded if escalation proceeds

---

## 5. Record Keeping

All CDR complaints are tracked in the `CDRComplaint` database model with:

| Field | Description |
|-------|-------------|
| `id` | Unique complaint reference |
| `userId` | Complainant (if registered user) |
| `category` | Complaint type |
| `description` | Full complaint text |
| `status` | OPEN / IN_PROGRESS / RESOLVED / ESCALATED / CLOSED |
| `resolution` | Resolution description |
| `resolvedAt` | Date resolved |
| `resolvedBy` | Person who resolved |
| `escalatedToOAIC` | Whether escalated to OAIC |
| `oaicReferenceId` | OAIC reference if escalated |

Records retained for **7 years** per Australian record-keeping requirements.

---

## 6. Internal Review

- All CDR complaints reviewed quarterly by the Director
- Patterns identified and systemic issues addressed
- Policy updated if complaint trends indicate process gaps
- Complaint statistics included in CDR compliance reporting

---

## 7. Staff Training

When staff are hired:
- All staff with CDR data access will be trained on this complaints policy
- Training includes: complaint identification, escalation procedures, privacy obligations
- Training documented in accordance with `SECURITY_AWARENESS_POLICY.md`

---

## 8. Review Schedule

This policy is reviewed:
- **Annually** (minimum)
- **After any CDR complaint is escalated to OAIC**
- **After any CDR data breach**
- **When CDR Rules are updated by the ACCC**

---

*Last Updated: 2026-04-11*
*Next Review: 2027-04-11*
