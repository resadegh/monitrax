/**
 * Phase 47 — Signup consent capture endpoint.
 *
 * POST /api/auth/consent
 *
 * Called by the registration flow IMMEDIATELY after a successful Firebase
 * Auth signup (email/password OR OAuth). Captures the user's acceptance of
 * the bundled mandatory documents (Terms / Privacy / AFSL) + their optional
 * marketing opt-in.
 *
 * Auth: bearer token (Firebase ID token) — uses the existing withAuth
 * middleware. The User row must already exist (Firebase signup completes
 * BEFORE this POST fires).
 *
 * Side effects:
 *   - 3 UserConsent rows inserted for the mandatory bundle (TOS / Privacy /
 *     AFSL), each pinned to the current document version from `lib/legal/content.ts`.
 *   - 1 UserConsent row inserted for MARKETING_COMMUNICATIONS if `marketingOptIn = true`.
 *   - 3 audit-log rows (CONSENT_TERMS_ACCEPTED / CONSENT_PRIVACY_ACCEPTED /
 *     CONSENT_AFSL_ACKNOWLEDGED), + 1 for marketing if applicable.
 *
 * Idempotency: if the user already has an ACTIVE consent row at the current
 * version for a given document type, that row is NOT duplicated; the API
 * returns 200 with a marker. This lets the registration flow re-call safely
 * after a network blip.
 *
 * Privacy: IP address stored as SHA-256 hash; user-agent truncated to 500 chars.
 *
 * CLAUDE.md §12.11 destructive-write checklist: N/A — all operations are
 * CREATE only against a new table; no existing rows are touched.
 *
 * CLAUDE.md §13.3: audit metadata contains documentType + documentVersion +
 * consentSource only — no PII beyond the principalId on the AuditLog row.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/db';
import { getCurrentDocumentVersion } from '@/lib/legal/content';
import { createAuditLog } from '@/lib/security/auditLog';
import { extractRequestMeta } from '@/lib/audit/logger';
import { emitFriendliesEvent } from '@/lib/webhooks/n8n';

// Acceptable consent sources for THIS endpoint. SETTINGS_UPDATE and
// VERSION_REACCEPT are also valid `ConsentSource` enum values but they're
// captured via different (lower-friction) routes — keeping this endpoint
// narrowly scoped to signup-style flows + the migration modal.
const SIGNUP_CONSENT_SOURCES = ['SIGNUP', 'OAUTH_SIGNUP', 'EXISTING_USER_MIGRATION'] as const;

const BodySchema = z.object({
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service to proceed.' }),
  }),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy to proceed.' }),
  }),
  afslAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the AFSL, Credit and Tax Boundary Disclosure to proceed.' }),
  }),
  marketingOptIn: z.boolean().default(false),
  consentSource: z.enum(SIGNUP_CONSENT_SOURCES).default('SIGNUP'),
});

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    const userId = authReq.user!.userId;

    let body: z.infer<typeof BodySchema>;
    try {
      const json = await request.json();
      body = BodySchema.parse(json);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONSENT_PAYLOAD',
            message: err instanceof z.ZodError ? err.errors[0]?.message : 'Invalid request body',
          },
        },
        { status: 400 }
      );
    }

    const meta = extractRequestMeta(request);
    const ipAddressHash = meta.ip && meta.ip !== 'unknown' ? hashIp(meta.ip) : undefined;
    const userAgent = meta.userAgent ? meta.userAgent.slice(0, 500) : undefined;

    const tosVersion = getCurrentDocumentVersion('TERMS_OF_SERVICE');
    const privacyVersion = getCurrentDocumentVersion('PRIVACY_POLICY');
    const afslVersion = getCurrentDocumentVersion('AFSL_BOUNDARY_DISCLOSURE');

    // Idempotency check — does the user already have a current-version
    // accepted row for each mandatory type? If so, skip the insert.
    const existing = await prisma.userConsent.findMany({
      where: {
        userId,
        documentType: { in: ['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'AFSL_BOUNDARY_DISCLOSURE'] },
        revokedAt: null,
      },
      select: { documentType: true, documentVersion: true },
    });

    const alreadyAccepted = (type: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'AFSL_BOUNDARY_DISCLOSURE', version: string) =>
      existing.some((r) => r.documentType === type && r.documentVersion === version);

    const created: string[] = [];

    if (!alreadyAccepted('TERMS_OF_SERVICE', tosVersion)) {
      await prisma.userConsent.create({
        data: {
          userId,
          documentType: 'TERMS_OF_SERVICE',
          documentVersion: tosVersion,
          consentSource: body.consentSource,
          ipAddressHash,
          userAgent,
        },
      });
      await createAuditLog({
        userId,
        action: 'CONSENT_TERMS_ACCEPTED',
        entityType: 'UserConsent',
        ipAddress: meta.ip,
        userAgent,
        metadata: { documentVersion: tosVersion, consentSource: body.consentSource },
      }).catch(() => undefined);
      created.push('TERMS_OF_SERVICE');
    }

    if (!alreadyAccepted('PRIVACY_POLICY', privacyVersion)) {
      await prisma.userConsent.create({
        data: {
          userId,
          documentType: 'PRIVACY_POLICY',
          documentVersion: privacyVersion,
          consentSource: body.consentSource,
          ipAddressHash,
          userAgent,
        },
      });
      await createAuditLog({
        userId,
        action: 'CONSENT_PRIVACY_ACCEPTED',
        entityType: 'UserConsent',
        ipAddress: meta.ip,
        userAgent,
        metadata: { documentVersion: privacyVersion, consentSource: body.consentSource },
      }).catch(() => undefined);
      created.push('PRIVACY_POLICY');
    }

    if (!alreadyAccepted('AFSL_BOUNDARY_DISCLOSURE', afslVersion)) {
      await prisma.userConsent.create({
        data: {
          userId,
          documentType: 'AFSL_BOUNDARY_DISCLOSURE',
          documentVersion: afslVersion,
          consentSource: body.consentSource,
          ipAddressHash,
          userAgent,
        },
      });
      await createAuditLog({
        userId,
        action: 'CONSENT_AFSL_ACKNOWLEDGED',
        entityType: 'UserConsent',
        ipAddress: meta.ip,
        userAgent,
        metadata: { documentVersion: afslVersion, consentSource: body.consentSource },
      }).catch(() => undefined);
      created.push('AFSL_BOUNDARY_DISCLOSURE');
    }

    if (body.marketingOptIn) {
      const marketingVersion = getCurrentDocumentVersion('MARKETING_COMMUNICATIONS');
      const existingMarketing = await prisma.userConsent.findFirst({
        where: {
          userId,
          documentType: 'MARKETING_COMMUNICATIONS',
          revokedAt: null,
        },
      });
      if (!existingMarketing) {
        await prisma.userConsent.create({
          data: {
            userId,
            documentType: 'MARKETING_COMMUNICATIONS',
            documentVersion: marketingVersion,
            consentSource: body.consentSource,
            ipAddressHash,
            userAgent,
          },
        });
        await createAuditLog({
          userId,
          action: 'CONSENT_MARKETING_OPTED_IN',
          entityType: 'UserConsent',
          ipAddress: meta.ip,
          userAgent,
          metadata: { documentVersion: marketingVersion, consentSource: body.consentSource },
        }).catch(() => undefined);
        created.push('MARKETING_COMMUNICATIONS');
      }
    }

    // Phase 47.66 — Emit user.signup to n8n friendlies-tracker workflow on
    // the actual signup flows only (NOT existing-user migration prompts).
    // Fire-and-forget; never blocks the API response. The n8n workflow
    // looks up the email against Airtable Contacts, and if tagged `friendly`,
    // advances Friendly stage Invited → Signed up + writes an Activity row.
    if (
      (body.consentSource === 'SIGNUP' || body.consentSource === 'OAUTH_SIGNUP') &&
      created.includes('TERMS_OF_SERVICE') // only on first signup, not re-acceptance
    ) {
      const userEmail = authReq.user?.email;
      if (userEmail) {
        // Awaited (not fire-and-forget) — Vercel serverless functions kill
        // the process when the response returns, which silently drops
        // in-flight fetches. The helper's 4s timeout caps the worst-case
        // response latency; typical case is sub-second because n8n's
        // responseMode is 'onReceived' (returns 200 immediately, processes
        // async).
        await emitFriendliesEvent({
          event: 'user.signup',
          userId,
          email: userEmail,
          timestamp: new Date().toISOString(),
          metadata: { consentSource: body.consentSource },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { created, versions: { tos: tosVersion, privacy: privacyVersion, afsl: afslVersion } },
    });
  });
}
