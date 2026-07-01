/**
 * Anthropic kill-switch (Reza 2026-07-01) — Monitrax runs Gemini-only.
 *
 * `isAnthropicConfigured()` is the SINGLE lever every Claude call site checks
 * (onboarding extract, onboarding companion, feedback triage, anomaly narrator).
 * These tests pin the fail-CLOSED semantics: no Claude call can fire unless
 * `ANTHROPIC_ENABLED === 'true'` AND a key is present. Default (flag unset) is
 * OFF even with the key set, so the spend stops on ship without an env change.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAnthropicConfigured } from '@/lib/ai/anthropic';

const KEY = 'ANTHROPIC_API_KEY';
const ENABLED = 'ANTHROPIC_ENABLED';

describe('isAnthropicConfigured — fail-closed kill-switch', () => {
  let prevKey: string | undefined;
  let prevEnabled: string | undefined;

  beforeEach(() => {
    prevKey = process.env[KEY];
    prevEnabled = process.env[ENABLED];
    delete process.env[KEY];
    delete process.env[ENABLED];
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env[KEY];
    else process.env[KEY] = prevKey;
    if (prevEnabled === undefined) delete process.env[ENABLED];
    else process.env[ENABLED] = prevEnabled;
  });

  it('OFF by default — key present but no enable flag → disabled (the kill-switch)', () => {
    process.env[KEY] = 'sk-ant-test';
    expect(isAnthropicConfigured()).toBe(false);
  });

  it('OFF when neither is set', () => {
    expect(isAnthropicConfigured()).toBe(false);
  });

  it('OFF when enabled but no key (nothing to call)', () => {
    process.env[ENABLED] = 'true';
    expect(isAnthropicConfigured()).toBe(false);
  });

  it('OFF when the enable flag is any value other than the exact string "true"', () => {
    process.env[KEY] = 'sk-ant-test';
    for (const v of ['1', 'yes', 'TRUE', 'on', '']) {
      process.env[ENABLED] = v;
      expect(isAnthropicConfigured()).toBe(false);
    }
  });

  it('ON only when explicitly enabled AND keyed (the deliberate re-enable path)', () => {
    process.env[KEY] = 'sk-ant-test';
    process.env[ENABLED] = 'true';
    expect(isAnthropicConfigured()).toBe(true);
  });
});
