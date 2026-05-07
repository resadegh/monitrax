/**
 * Phase 42 PR6.5 — Tests for swipe-gesture constants + invariants.
 *
 * The hook itself is integration-tested via the Activity surface;
 * this file pins the constants that the parent components rely on
 * (so a regression in threshold tuning surfaces here, not in
 * production friction).
 */

import { describe, it, expect } from 'vitest';
import {
  SWIPE_THRESHOLD_PX,
  TAP_MAX_DRIFT_PX,
  LONG_PRESS_MS,
  DOUBLE_TAP_WINDOW_MS,
  HAPTIC_PULSE_MS,
} from '../../hooks/useSwipeGesture';

describe('swipe gesture constants', () => {
  it('SWIPE_THRESHOLD_PX is 40px (matches spec §6.3)', () => {
    expect(SWIPE_THRESHOLD_PX).toBe(40);
  });
  it('TAP_MAX_DRIFT_PX is small (≤ 10px) so accidental taps don\'t cancel', () => {
    expect(TAP_MAX_DRIFT_PX).toBeLessThanOrEqual(10);
    expect(TAP_MAX_DRIFT_PX).toBeGreaterThan(0);
  });
  it('LONG_PRESS_MS is 300ms (matches spec §6.3)', () => {
    expect(LONG_PRESS_MS).toBe(300);
  });
  it('DOUBLE_TAP_WINDOW_MS is 300ms (matches spec §6.3)', () => {
    expect(DOUBLE_TAP_WINDOW_MS).toBe(300);
  });
  it('HAPTIC_PULSE_MS is short (≤ 30ms) so haptics feel like feedback, not noise', () => {
    expect(HAPTIC_PULSE_MS).toBeLessThanOrEqual(30);
    expect(HAPTIC_PULSE_MS).toBeGreaterThan(0);
  });
  it('Tap-vs-swipe boundary is well-separated (threshold > drift)', () => {
    // A user dragging less than TAP_MAX_DRIFT_PX is firmly in tap territory;
    // dragging more than SWIPE_THRESHOLD_PX is firmly in swipe territory.
    // The gap between them is the "ambiguous" zone where the gesture
    // springs back. Reviewer rule: if these collapse, accidental swipes spike.
    expect(SWIPE_THRESHOLD_PX).toBeGreaterThan(TAP_MAX_DRIFT_PX * 4);
  });
});
