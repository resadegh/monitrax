/**
 * Phase 41i.4 — Alerting service for calc audit findings.
 *
 * Dispatches notifications to Slack + email when findings cross
 * the configured severity threshold. Per HR-3, alerts are
 * **admin-side only** — they go to the on-call admin distribution
 * list / channel, never to end users.
 *
 * **Channel selection:**
 *   - Slack: `SLACK_CALC_AUDIT_WEBHOOK_URL` env var. Plain webhook
 *     POST with structured JSON. No-op when unset.
 *   - Email: `SENDGRID_API_KEY` + `MONITRAX_CALC_AUDIT_ALERT_EMAIL`
 *     env vars. Reuses the SendGrid pattern from
 *     `lib/email/conversationEmail.ts`. No-op when either unset.
 *
 * **Threshold:** defaults to `HIGH` — only HIGH + CRITICAL findings
 * fire alerts. Override via `CALC_AUDIT_ALERT_THRESHOLD` env var
 * (`'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`).
 *
 * **Trigger events:**
 *   - **Finding created** with severity ≥ threshold → fires
 *   - **Finding transitioned to FIX_REQUIRED** → fires (escalation)
 *
 * **Fire-and-forget**: per CLAUDE.md §12.10 — alert delivery
 * failures must NEVER block the underlying audit operation. The
 * caller `await`s `recordAlert(...)` but each channel's promise
 * is wrapped in `.catch(() => {})` so a Slack outage doesn't
 * cascade.
 */

import 'server-only';
import type { CalcAuditFinding, CalcAuditFindingSeverity } from '@prisma/client';

// ---------- Severity threshold ----------

const SEVERITY_RANK: Record<CalcAuditFindingSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const VALID_THRESHOLDS: CalcAuditFindingSeverity[] = [
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

/**
 * Resolve the configured threshold from env. Defaults to `HIGH`.
 * Invalid values fall back to the default rather than throwing —
 * misconfiguration must not break the audit pipeline.
 */
export function resolveThreshold(): CalcAuditFindingSeverity {
  const raw = process.env.CALC_AUDIT_ALERT_THRESHOLD;
  if (raw && (VALID_THRESHOLDS as string[]).includes(raw)) {
    return raw as CalcAuditFindingSeverity;
  }
  return 'HIGH';
}

/**
 * `true` if the finding's severity meets or exceeds the configured
 * alert threshold.
 */
export function meetsThreshold(
  severity: CalcAuditFindingSeverity,
  threshold: CalcAuditFindingSeverity = resolveThreshold(),
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[threshold];
}

// ---------- Trigger types ----------

export type AlertTrigger = 'CREATED' | 'ESCALATED_TO_FIX_REQUIRED';

interface AlertContext {
  trigger: AlertTrigger;
  finding: CalcAuditFinding;
}

// ---------- Channel: Slack ----------

interface SlackPayload {
  text: string;
  blocks?: Array<{
    type: 'header' | 'section' | 'divider';
    text?: { type: 'plain_text' | 'mrkdwn'; text: string };
    fields?: Array<{ type: 'mrkdwn'; text: string }>;
  }>;
}

async function postToSlack(payload: SlackPayload): Promise<{ delivered: boolean }> {
  const url = process.env.SLACK_CALC_AUDIT_WEBHOOK_URL;
  if (!url) {
    return { delivered: false };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { delivered: res.ok };
  } catch {
    return { delivered: false };
  }
}

function buildSlackPayload(ctx: AlertContext): SlackPayload {
  const { finding, trigger } = ctx;
  const triggerLabel =
    trigger === 'ESCALATED_TO_FIX_REQUIRED'
      ? 'Escalated to FIX_REQUIRED'
      : 'New finding';
  const severityEmoji =
    finding.severity === 'CRITICAL'
      ? ':rotating_light:'
      : finding.severity === 'HIGH'
      ? ':warning:'
      : ':grey_exclamation:';

  return {
    text: `${severityEmoji} Calc audit ${triggerLabel}: ${finding.engineName} — ${finding.summary}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} Calc audit ${triggerLabel}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Engine:*\n${finding.engineName}` },
          {
            type: 'mrkdwn',
            text: `*Fixture:*\n${finding.fixtureName ?? '—'}`,
          },
          { type: 'mrkdwn', text: `*Severity:*\n${finding.severity}` },
          { type: 'mrkdwn', text: `*Source:*\n${finding.source}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Summary:*\n${finding.summary}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Finding id:* \`${finding.id}\` · Detected ${finding.detectedAt.toISOString()}`,
        },
      },
    ],
  };
}

// ---------- Channel: Email ----------

const EMAIL_FROM_NAME = 'Monitrax Calc Audit';
const EMAIL_FROM_ADDRESS =
  process.env.MONITRAX_CALC_AUDIT_FROM_ADDRESS ?? 'audit-alerts@monitrax.com.au';

async function sendEmailAlert(ctx: AlertContext): Promise<{ delivered: boolean }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.MONITRAX_CALC_AUDIT_ALERT_EMAIL;
  if (!apiKey || !to) {
    return { delivered: false };
  }
  const { finding, trigger } = ctx;
  const triggerLabel =
    trigger === 'ESCALATED_TO_FIX_REQUIRED'
      ? 'Escalated to FIX_REQUIRED'
      : 'New finding';

  const subject = `[Calc audit · ${finding.severity}] ${triggerLabel}: ${finding.engineName}`;
  const body = buildEmailBody(ctx);

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    return { delivered: res.ok };
  } catch {
    return { delivered: false };
  }
}

function buildEmailBody(ctx: AlertContext): string {
  const { finding, trigger } = ctx;
  const triggerLabel =
    trigger === 'ESCALATED_TO_FIX_REQUIRED'
      ? 'A finding has been escalated to FIX_REQUIRED.'
      : 'A new finding has been recorded.';

  return [
    triggerLabel,
    '',
    `Engine:    ${finding.engineName}`,
    `Fixture:   ${finding.fixtureName ?? '—'}`,
    `Severity:  ${finding.severity}`,
    `Source:    ${finding.source}`,
    `Detected:  ${finding.detectedAt.toISOString()}`,
    `Finding:   ${finding.id}`,
    '',
    'Summary:',
    finding.summary,
    '',
    finding.failedAssertions
      ? `Failed assertions:\n${(finding.failedAssertions as unknown as string[]).map((a) => `  - ${a}`).join('\n')}`
      : '',
    '',
    'View in admin portal: /admin/calc-audit',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ---------- Public surface ----------

export interface RecordAlertOutcome {
  /** `true` if the finding met threshold and at least one channel attempted delivery. */
  attempted: boolean;
  /** Per-channel delivery status. */
  slack: { configured: boolean; delivered: boolean };
  email: { configured: boolean; delivered: boolean };
}

/**
 * Send alerts for a finding event. Always returns an outcome —
 * never throws. Caller can ignore the return value (fire-and-forget)
 * or log it for observability.
 */
export async function recordAlert(
  ctx: AlertContext,
): Promise<RecordAlertOutcome> {
  const threshold = resolveThreshold();
  if (!meetsThreshold(ctx.finding.severity, threshold)) {
    return {
      attempted: false,
      slack: { configured: false, delivered: false },
      email: { configured: false, delivered: false },
    };
  }

  const slackConfigured = !!process.env.SLACK_CALC_AUDIT_WEBHOOK_URL;
  const emailConfigured =
    !!process.env.SENDGRID_API_KEY && !!process.env.MONITRAX_CALC_AUDIT_ALERT_EMAIL;

  const [slackResult, emailResult] = await Promise.all([
    slackConfigured
      ? postToSlack(buildSlackPayload(ctx)).catch(() => ({ delivered: false }))
      : Promise.resolve({ delivered: false }),
    emailConfigured
      ? sendEmailAlert(ctx).catch(() => ({ delivered: false }))
      : Promise.resolve({ delivered: false }),
  ]);

  return {
    attempted: true,
    slack: { configured: slackConfigured, delivered: slackResult.delivered },
    email: { configured: emailConfigured, delivered: emailResult.delivered },
  };
}

// Exposed for tests.
export { buildSlackPayload, buildEmailBody };
