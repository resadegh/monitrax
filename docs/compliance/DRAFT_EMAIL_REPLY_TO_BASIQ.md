# Draft Email Reply to Jad (Basiq/Cuscal)

**Status:** DRAFT — Review and personalise before sending
**To:** Jad (Basiq onboarding)
**CC:** compliance@basiq.io
**Subject:** RE: CDR Compliance Onboarding — Monitrax / Renew Group Holding

---

Hi Jad,

Thank you for the detailed onboarding pack and the clear instructions — really appreciated.

I've been working through the CDR Compliance form and wanted to give you a progress update:

**Completed:**
- Step 1 (Organisation Details) — filled in
- Step 2 (CDR Data Use) — answered
- Step 3 (Security Practices) — all 38 items reviewed and marked
- Step 5 (Policies) — we've documented all 25 security policies based on your template, customised for our environment
- Step 6 (Evidence) — most items captured, architecture diagram prepared

**In Progress:**
- Step 4 (GCP Technology) — we're in the process of enabling additional GCP services (Cloud Armor, Cloud Monitoring, Security Command Center). Some are marked as planned rather than active.
- Step 6, Item 11 (Vulnerability Scanning) — we're arranging a security assessment of our production environment. I'll update the Evidence folder once this is complete.
- Step 6, Item 14 (Insurance) — we're in the process of obtaining cyber liability and professional indemnity insurance. Certificates will be uploaded once available.

**Our Environment:**
- Frontend: Vercel (Next.js)
- Database: GCP Cloud SQL PostgreSQL (Sydney region, australia-southeast1)
- Identity: GCP Identity Platform (Firebase Auth) with MFA, OAuth, Passkeys
- Security: RBAC with 50+ permissions on all API routes, audit logging with CDR data sanitisation, CDR consent lifecycle management (automated deletion on consent expiry/revocation)

**Questions for you:**
1. For the vulnerability scan (Step 6, Item 11) — is an OWASP ZAP self-service scan acceptable, or do you require an external penetration test from a certified provider?
2. For the GCP tools (Step 4) — some services like Cloud DLP and Cloud Profiler are planned but not yet active. Is it acceptable to submit with these marked as False and enable them before go-live?
3. Is there a preferred format for the security policies document? We've prepared a comprehensive document covering all 25 areas — happy to upload as PDF to the Evidence folder.

I expect to have the remaining items completed within the next 2-3 weeks. I'll send through the completed form for review once everything is in place.

Thanks again for the support — happy to jump on a call if that would be easier to discuss any of this.

Kind regards,
Reza
Renew Group Holding Pty Ltd
Monitrax.com.au

---

## Notes for Reza Before Sending

1. **Personalise:** Adjust tone, add any specifics about your timeline
2. **Attach/link:** Once the spreadsheet is filled, mention it's ready for review
3. **Insurance timeline:** Update with actual expected date from broker
4. **Pen test timeline:** Update with vendor/approach chosen
5. **Don't send until:** At minimum Steps 1-3, 5 are complete in the spreadsheet
6. **Consider sending in two phases:** Initial submission (Steps 1-3, 5) now, then Steps 4, 6 once GCP services and evidence are ready
