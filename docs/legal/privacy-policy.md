---
title: Privacy Policy
slug: privacy-policy
version: v0.1-draft-2026-05-24
effectiveFrom: 2026-05-24
status: DRAFT
audience: public
summary: How Monitrax collects, uses, stores, and protects your personal information.
---

> **DRAFT v0.1 — 2026-05-24.** Not yet reviewed by counsel. This document is being authored for review by an AU fintech lawyer before public publication. See Phase 47 in `docs/IMPLEMENTATION_PLAN.md` and Q-HOOK-AFSL in the Open Questions table. Do not publish this version to production users without legal sign-off.

# Privacy Policy

**Effective from:** 2026-05-24

This Privacy Policy explains how **ReNew Group Pty Ltd** (ACN [TO BE INSERTED]), trading as **Monitrax**, handles your personal information when you use the Monitrax service ("we", "us", "our").

We are bound by the **Australian Privacy Principles (APPs)** in the **Privacy Act 1988 (Cth)**. Where we handle Consumer Data Right (CDR) data, we are also bound by the **CDR Privacy Safeguards** in the **Competition and Consumer Act 2010 (Cth)** and the **CDR Rules**.

---

## 1. What personal information we collect

Depending on how you use Monitrax, we may collect:

**Account information**
- Name, email address, mobile number
- Password (stored as a one-way hash; we never see your plaintext password — authentication is handled by Google Identity Platform / Firebase Auth)
- Date of account creation, last login time, login IP
- Multi-factor authentication enrolment

**Financial information you enter**
- Properties, loans, accounts, investments, super, assets, income, expenses, transactions
- Entity structures (companies, trusts, SMSFs) and ownership relationships
- Tax File Number (TFN) **only if you choose to provide it** and only at-rest encrypted (see section 5)
- Documents you upload (receipts, statements, trust deeds, etc.)

**Bank data via Open Banking (when enabled)**
- When you choose to connect a bank account, financial data is shared with us through the Consumer Data Right regime via our accredited data partner (currently Basiq). This includes account names, account numbers (truncated), balances, transactions, and connection metadata. CDR data is governed by the CDR Privacy Safeguards in addition to this Policy.

**Information generated automatically**
- Audit log of significant actions you take in the service (sign-in, settings changes, data exports, consent events) — see CLAUDE.md §13.3
- Device/browser type, IP address (hashed when associated with consent records)
- Page activity within the app (for diagnostics and product improvement)

**Communications you send us**
- Support requests, in-app feedback, conversation threads with professionals routed through Monitrax

We do not collect health information, racial or ethnic origin, religious beliefs, sexual orientation, or other sensitive information beyond what is required to operate the service.

---

## 2. Why we collect it

We collect personal information to:

1. Provide the Monitrax service — show you your data, run calculations, generate insights
2. Create and maintain your account, authenticate you, and keep the service secure
3. Process payments for paid subscriptions (via Stripe)
4. Comply with legal obligations (financial recordkeeping, AML/CTF where applicable, tax reporting)
5. Respond to your support requests
6. Send transactional communications (security alerts, billing notices, important service updates)
7. Send marketing communications **only if you explicitly opt in** (see section 7)
8. Improve the service in aggregate, de-identified form

We will not use your personal information for purposes you have not been told about or for purposes you would not reasonably expect.

---

## 3. Who we share it with

We share personal information only with parties who help us provide the service or where we are legally required:

**Service providers (data processors)**
- **Google Cloud Platform** — hosting, Cloud SQL database, identity (Firebase Auth), storage. Data is stored in the `australia-southeast1` (Sydney) region; see section 6.
- **Vercel** — front-end hosting and deployment. Servers are configured to the Sydney region where supported.
- **Basiq** — accredited data recipient for Open Banking (CDR data). Activated only when you choose to connect a bank.
- **Stripe** — payment processing for paid subscriptions.
- **SendGrid / Resend** — transactional and marketing email delivery.
- **Anthropic / Google (Gemini)** — AI processing for features like the AI tax advisor and onboarding agent. We send only the minimum data required for the feature; we never send raw transaction-level CDR data to an AI provider beyond what is necessary to answer a specific question you asked.

**Professionals you choose to engage**
- If you submit a request to a professional via our marketplace, we share only the information necessary to enable the engagement, with your explicit consent at the moment of submission.

**Authorities**
- We may disclose personal information where required by Australian law (court order, subpoena, regulatory request) or to protect the safety, rights, or property of users or the public.

**We do not sell your personal information.**

---

## 4. CDR data — additional protections

When you connect a bank to Monitrax through the Consumer Data Right (CDR) regime:

- The connection is governed by a **separate, explicit, time-limited CDR consent** captured at the moment of connection — different from your acceptance of these documents at signup.
- Each consent specifies the data types collected, the use, and the duration.
- You can withdraw a CDR consent at any time from your account settings; when you do, the associated CDR data is deleted or de-identified within 24 hours as required by the **CDR Privacy Safeguards** and our **CDR Data Lifecycle** process.
- We do not de-identify or use CDR data for purposes outside the scope of your consent.
- CDR data is never included in audit log metadata or error responses (CLAUDE.md §13.3).

See our **CDR Data Retention Schedule**, **CDR Data Minimisation Policy**, and **CDR Complaints Policy** for the operational detail.

---

## 5. How we store and protect personal information

**At rest:**
- Cloud SQL database in `australia-southeast1` (Sydney), with TLS 1.2+ on every connection.
- Workload Identity Federation + IAM database authentication — the application never holds a long-lived database password; per-connection credentials are minted on each request (CLAUDE.md §13.6).
- TFN, where you choose to provide it, is encrypted with an envelope cipher in addition to disk-level encryption.
- File uploads stored in Google Cloud Storage with signed-URL access (default 5-minute expiry).

**In transit:**
- TLS on every connection between you, our service, and our processors.

**Access controls:**
- Role-based access control on internal admin functions. Every administrative action is audit-logged.
- Multi-factor authentication available to you, and required for some sensitive actions in the future.
- 30-minute inactivity auto-logout.

**Breach notification:**
We comply with the **Notifiable Data Breaches** scheme (Part IIIC of the Privacy Act). If an eligible data breach occurs, we will notify the OAIC and affected individuals as soon as practicable.

---

## 6. Where your data is stored — overseas disclosures

Your personal information is primarily stored and processed in **Australia** (GCP `australia-southeast1`, Sydney region).

Some service providers may process limited personal information outside Australia in the course of providing their services to us:

- **Stripe** — payment processing may involve servers in the United States
- **Anthropic / Google (Gemini)** — AI processing may be routed through United States data centres for the specific AI request you initiate
- **SendGrid / Resend** — transactional email may be processed in the United States

We take reasonable steps to ensure these providers comply with the APPs or substantially similar protection. By using the service you consent to these limited overseas disclosures for the purposes described.

---

## 7. Marketing communications

We will only send you marketing communications if you have explicitly opted in. Opt-in is captured separately from your acceptance of these documents at signup; the default is OFF.

Every marketing email contains a one-click unsubscribe link as required by the **Spam Act 2003 (Cth)**. You can also change your preferences at any time from your account settings.

Transactional communications (security alerts, billing notices, important service updates) are not marketing and continue to be sent regardless of your marketing preference — these are necessary to operate the service.

---

## 8. Your rights — access, correction, deletion

Under the Privacy Act and these Terms, you can:

- **Access** the personal information we hold about you (APP 12)
- **Correct** information that is inaccurate, out-of-date, incomplete, or misleading (APP 13)
- **Export** your data from the app at any time (account settings)
- **Delete** your account — this triggers a 30-day cancellable grace period, after which your CDR data and personal information are deleted or de-identified per our **CDR Data Lifecycle** process and the right-to-erasure protocol (CLAUDE.md §13.2)

To exercise any of these rights, contact us at **privacy@monitrax.com.au**. We will respond within 30 days.

Some information may need to be retained after deletion to comply with legal obligations (for example, tax-recordkeeping under the Income Tax Assessment Act, or transaction records for AML purposes). Retained information is the minimum required and access is restricted.

---

## 9. Cookies and tracking

Monitrax uses essential cookies to keep you signed in and to remember your settings. We do not use third-party advertising cookies or cross-site tracking.

You can clear cookies in your browser at any time. If you do, you will need to sign in again.

---

## 10. Children

Monitrax is not directed at children under 18. If you believe a child has provided personal information to us, contact us at **privacy@monitrax.com.au** and we will delete the information.

---

## 11. Changes to this Policy

We may update this Policy from time to time. When we make a material change:

- We will notify you by email and in-app on next login;
- The new version applies from the effective date at the top;
- You will be asked to re-acknowledge the change on next login.

---

## 12. Complaints

If you believe we have breached the APPs, the CDR Privacy Safeguards, or this Policy, please contact us first at **privacy@monitrax.com.au**. We will acknowledge within 5 business days and aim to resolve within 30 days.

If you are not satisfied with our response you may refer the matter to the **Office of the Australian Information Commissioner (OAIC)** at [oaic.gov.au](https://www.oaic.gov.au) (Privacy Act and CDR matters), or the **Australian Financial Complaints Authority (AFCA)** at [afca.org.au](https://www.afca.org.au) where the complaint relates to a financial service or product.

---

## 13. Contact

**Privacy Officer**
ReNew Group Pty Ltd
ACN: [TO BE INSERTED]
Email: privacy@monitrax.com.au
Postal: [TO BE INSERTED]

---

*Version v0.1-draft-2026-05-24. Pending counsel review.*
