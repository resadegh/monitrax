/**
 * Phase 0 / email-in hardening — tests for the inbound-webhook
 * verification primitives.
 *
 * These are the only thing between "real client reply" and "anyone who
 * guessed the `+conv-<slug>@` pattern injecting into an adviser↔client
 * thread", so the conditions are pinned hard. Env-driven branches are
 * exercised by mutating `process.env` per-test (restored in
 * afterEach).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  verifyInboundSecret,
  verifyDkimSpf,
  isDkimSpfStrict,
  isSenderAllowed,
  getAllowedInboundDomains,
  extractFromAddress,
  emailDomain,
  checkInboundRateLimit,
  INBOUND_RATE_LIMIT_PER_HOUR,
} from '@/lib/email/inboundSecurity';

const ENV_KEYS = [
  'INBOUND_EMAIL_SECRET',
  'INBOUND_EMAIL_REQUIRE_DKIM_SPF',
  'INBOUND_EMAIL_ALLOWED_DOMAINS',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('verifyInboundSecret', () => {
  it('passes in dev when no secret is configured', () => {
    expect(verifyInboundSecret(undefined, false).ok).toBe(true);
    expect(verifyInboundSecret('anything', false).ok).toBe(true);
  });

  it('fails in production when no secret is configured (misconfiguration)', () => {
    const r = verifyInboundSecret('anything', true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('secret_not_configured');
  });

  it('passes when the provided secret matches the configured one', () => {
    process.env.INBOUND_EMAIL_SECRET = 's3cr3t-value';
    expect(verifyInboundSecret('s3cr3t-value', true).ok).toBe(true);
    expect(verifyInboundSecret('s3cr3t-value', false).ok).toBe(true);
  });

  it('fails on mismatch or missing secret when one is configured', () => {
    process.env.INBOUND_EMAIL_SECRET = 's3cr3t-value';
    expect(verifyInboundSecret('wrong', true).ok).toBe(false);
    expect(verifyInboundSecret('wrong', true).reason).toBe('bad_secret');
    expect(verifyInboundSecret(undefined, true).ok).toBe(false);
    expect(verifyInboundSecret('', false).ok).toBe(false);
  });
});

describe('verifyDkimSpf', () => {
  it('is non-strict by default — always ok, echoes raw values', () => {
    expect(isDkimSpfStrict()).toBe(false);
    const r = verifyDkimSpf('fail', '{@x.com : fail}');
    expect(r.ok).toBe(true);
    expect(r.spf).toBe('fail');
    expect(r.dkim).toBe('{@x.com : fail}');
  });

  it('in strict mode requires SPF=pass AND a pass in dkim', () => {
    process.env.INBOUND_EMAIL_REQUIRE_DKIM_SPF = 'true';
    expect(isDkimSpfStrict()).toBe(true);

    expect(verifyDkimSpf('pass', '{@example.com : pass}').ok).toBe(true);
    expect(verifyDkimSpf(' PASS ', '  {@example.com : PASS}  ').ok).toBe(true);

    const noSpf = verifyDkimSpf('softfail', '{@example.com : pass}');
    expect(noSpf.ok).toBe(false);
    expect(noSpf.reason).toBe('spf_not_pass');

    const noDkim = verifyDkimSpf('pass', 'none');
    expect(noDkim.ok).toBe(false);
    expect(noDkim.reason).toBe('dkim_not_pass');

    const missing = verifyDkimSpf(undefined, undefined);
    expect(missing.ok).toBe(false);
  });

  it('strict mode does not false-positive on a substring like "passport"', () => {
    process.env.INBOUND_EMAIL_REQUIRE_DKIM_SPF = 'true';
    const r = verifyDkimSpf('pass', '{@passport.example.com : fail}');
    // domain happens to contain "pass" but the result is "fail"
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('dkim_not_pass');
  });
});

describe('extractFromAddress / emailDomain', () => {
  it('extracts from "Name <email>" and bare forms, lower-cased', () => {
    expect(extractFromAddress('Sarah Kim <Sarah.Kim@Example.COM>')).toBe('sarah.kim@example.com');
    expect(extractFromAddress('  bare@Domain.io  ')).toBe('bare@domain.io');
  });

  it('emailDomain returns the part after the last @', () => {
    expect(emailDomain('a@b.com')).toBe('b.com');
    expect(emailDomain('weird@sub.dom@final.io')).toBe('final.io');
    expect(emailDomain('nodomain@')).toBe('');
    expect(emailDomain('noatsign')).toBe('');
  });
});

describe('getAllowedInboundDomains', () => {
  it('is empty by default', () => {
    expect(getAllowedInboundDomains().size).toBe(0);
  });

  it('parses a comma-separated list, trimming + lower-casing', () => {
    process.env.INBOUND_EMAIL_ALLOWED_DOMAINS = ' Practice.com , trustedbroker.io ,, ';
    const set = getAllowedInboundDomains();
    expect(set.has('practice.com')).toBe(true);
    expect(set.has('trustedbroker.io')).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe('isSenderAllowed', () => {
  it('passes on exact (case-insensitive) match with the consumer email', () => {
    expect(isSenderAllowed('sarah.kim@example.com', 'Sarah.Kim@Example.com').ok).toBe(true);
  });

  it('fails when the from does not match and no allowlist is configured', () => {
    const r = isSenderAllowed('attacker@evil.com', 'sarah.kim@example.com');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('sender_mismatch');
  });

  it('passes when the sender domain is in the configured allowlist', () => {
    process.env.INBOUND_EMAIL_ALLOWED_DOMAINS = 'practice.com';
    expect(isSenderAllowed('assistant@practice.com', 'sarah.kim@example.com').ok).toBe(true);
  });

  it('fails when the conversation has no consumer email', () => {
    const r = isSenderAllowed('sarah.kim@example.com', null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_consumer_email');
  });
});

describe('checkInboundRateLimit', () => {
  it('passes below the limit', () => {
    expect(checkInboundRateLimit(0).ok).toBe(true);
    expect(checkInboundRateLimit(INBOUND_RATE_LIMIT_PER_HOUR - 1).ok).toBe(true);
  });

  it('fails at or above the limit', () => {
    const r = checkInboundRateLimit(INBOUND_RATE_LIMIT_PER_HOUR);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('rate_limited');
    expect(checkInboundRateLimit(INBOUND_RATE_LIMIT_PER_HOUR + 5).ok).toBe(false);
  });
});
