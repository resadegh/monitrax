/**
 * Phase 50 D.3 — confidencePolicy SSOT unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyConfidence,
  CONFIDENCE_AUTO_THRESHOLD,
  CONFIDENCE_CONFIRM_THRESHOLD,
} from '@/lib/documents/intelligence/confidencePolicy';

describe('classifyConfidence', () => {
  it('bands by threshold: AUTO ≥ 0.9, CONFIRM ≥ 0.7, ASK below', () => {
    expect(classifyConfidence(0.95).band).toBe('AUTO');
    expect(classifyConfidence(0.9).band).toBe('AUTO');
    expect(classifyConfidence(0.8).band).toBe('CONFIRM');
    expect(classifyConfidence(0.7).band).toBe('CONFIRM');
    expect(classifyConfidence(0.69).band).toBe('ASK');
    expect(classifyConfidence(0).band).toBe('ASK');
  });

  it('exposes label + tone per band', () => {
    expect(classifyConfidence(0.95)).toMatchObject({ band: 'AUTO', label: 'High confidence', tone: 'emerald' });
    expect(classifyConfidence(0.75)).toMatchObject({ band: 'CONFIRM', tone: 'amber' });
    expect(classifyConfidence(0.5)).toMatchObject({ band: 'ASK', tone: 'slate' });
  });

  it('downgrades AUTO → CONFIRM for early TRAIL stages (earned autonomy)', () => {
    expect(classifyConfidence(0.95, { trailStage: 'TRACK' }).band).toBe('CONFIRM');
    expect(classifyConfidence(0.95, { trailStage: 'REDUCE' }).band).toBe('CONFIRM');
    expect(classifyConfidence(0.95, { trailStage: 'INVEST' }).band).toBe('AUTO');
    expect(classifyConfidence(0.95, { trailStage: 'LIVE' }).band).toBe('AUTO');
  });

  it('never promotes a lower band via the stage modifier', () => {
    expect(classifyConfidence(0.8, { trailStage: 'LIVE' }).band).toBe('CONFIRM');
    expect(classifyConfidence(0.5, { trailStage: 'LIVE' }).band).toBe('ASK');
  });

  it('handles non-finite confidence as 0 (ASK)', () => {
    expect(classifyConfidence(NaN).band).toBe('ASK');
  });

  it('exports the canonical thresholds', () => {
    expect(CONFIDENCE_AUTO_THRESHOLD).toBe(0.9);
    expect(CONFIDENCE_CONFIRM_THRESHOLD).toBe(0.7);
  });
});
