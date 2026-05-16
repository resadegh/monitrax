/**
 * Phase 41E.2 — Knowledge pack shape + status field tests.
 *
 * Asserts:
 *   - Every measure has an entry (closed discriminant coverage).
 *   - Every entry has all required fields.
 *   - Status values match the closed `ReformStatus` discriminant.
 *   - At Phase 41E.2 ship time: M1-M3 + M5 + M7-M9 are 'announced';
 *     M4 is 'exposure-draft' (Treasury published 10 Apr 2026);
 *     M6 is 'assented' (already law).
 *   - Citations are non-empty for every entry.
 */

import { describe, it, expect } from 'vitest';
import {
  REFORM_KNOWLEDGE_PACK,
  getReformKnowledgeEntry,
  getAllReformKnowledgeEntries,
  getStatusLabel,
  type ReformStatus,
} from '@/lib/ai/tax-advisor/knowledge/reform-2026-27';
import type { ReformMeasure } from '@/lib/tax-engine/config/reformConstants';

const ALL_MEASURES: ReformMeasure[] = [
  'NEGATIVE_GEARING_NEW_BUILDS_ONLY',
  'CGT_INDEXATION_PLUS_MIN_RATE',
  'TRUST_MINIMUM_TAX',
  'FOREIGN_RESIDENT_CGT',
  'LOSS_REFUNDABILITY',
  'FOREIGN_PURCHASE_BAN',
  'VC_CAPS_LIFTED',
  'EV_FBT_PHASED',
  'DYNAMIC_PAYG',
];

const VALID_STATUSES: ReformStatus[] = ['announced', 'exposure-draft', 'bill', 'assented'];

describe('Phase 41E.2 — REFORM_KNOWLEDGE_PACK shape', () => {
  it('has an entry for every measure (closed discriminant)', () => {
    for (const m of ALL_MEASURES) {
      expect(REFORM_KNOWLEDGE_PACK[m]).toBeDefined();
    }
  });

  it('every entry has all required fields populated', () => {
    for (const m of ALL_MEASURES) {
      const entry = REFORM_KNOWLEDGE_PACK[m];
      expect(entry.measure).toBe(m);
      expect(entry.title.length).toBeGreaterThan(10);
      expect(entry.summary.length).toBeGreaterThan(20);
      expect(VALID_STATUSES).toContain(entry.status);
      expect(entry.commencementText.length).toBeGreaterThan(5);
      expect(entry.userImpactText.length).toBeGreaterThan(20);
      expect(entry.citations.length).toBeGreaterThan(0);
      expect(entry.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Every citation must have a label + URL.
      for (const cit of entry.citations) {
        expect(cit.label.length).toBeGreaterThan(5);
        expect(cit.url).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('Phase 41E.2 — initial regulatory status (PR #765 ship time)', () => {
  it('M1 (negative gearing) is announced', () => {
    expect(REFORM_KNOWLEDGE_PACK.NEGATIVE_GEARING_NEW_BUILDS_ONLY.status).toBe('announced');
  });

  it('M2 (CGT indexation + 30% floor) is announced', () => {
    expect(REFORM_KNOWLEDGE_PACK.CGT_INDEXATION_PLUS_MIN_RATE.status).toBe('announced');
  });

  it('M3 (discretionary-trust 30% min) is announced', () => {
    expect(REFORM_KNOWLEDGE_PACK.TRUST_MINIMUM_TAX.status).toBe('announced');
  });

  it('M4 (foreign-resident CGT) is exposure-draft (Treasury published 10 Apr 2026)', () => {
    expect(REFORM_KNOWLEDGE_PACK.FOREIGN_RESIDENT_CGT.status).toBe('exposure-draft');
  });

  it('M5 (loss refundability) is announced', () => {
    expect(REFORM_KNOWLEDGE_PACK.LOSS_REFUNDABILITY.status).toBe('announced');
  });

  it('M6 (foreign-purchase ban) is assented (already law, just extended)', () => {
    expect(REFORM_KNOWLEDGE_PACK.FOREIGN_PURCHASE_BAN.status).toBe('assented');
  });

  it('M7-M9 are announced', () => {
    expect(REFORM_KNOWLEDGE_PACK.VC_CAPS_LIFTED.status).toBe('announced');
    expect(REFORM_KNOWLEDGE_PACK.EV_FBT_PHASED.status).toBe('announced');
    expect(REFORM_KNOWLEDGE_PACK.DYNAMIC_PAYG.status).toBe('announced');
  });
});

describe('Phase 41E.2 — grandfathering coverage', () => {
  it('M1 + M2 + M8 entries describe contract-date / novation-date grandfathering', () => {
    expect(REFORM_KNOWLEDGE_PACK.NEGATIVE_GEARING_NEW_BUILDS_ONLY.grandfatheringText).toMatch(/contract/i);
    expect(REFORM_KNOWLEDGE_PACK.NEGATIVE_GEARING_NEW_BUILDS_ONLY.grandfatheringText).toMatch(/12 May 2026/);
    expect(REFORM_KNOWLEDGE_PACK.CGT_INDEXATION_PLUS_MIN_RATE.grandfatheringText).toMatch(/contract/i);
    expect(REFORM_KNOWLEDGE_PACK.EV_FBT_PHASED.grandfatheringText).toMatch(/novat/i);
  });

  it('M3 + M5 + M6 + M7 + M9 have no grandfathering (FY-based commencement)', () => {
    expect(REFORM_KNOWLEDGE_PACK.TRUST_MINIMUM_TAX.grandfatheringText).toBe('');
    expect(REFORM_KNOWLEDGE_PACK.LOSS_REFUNDABILITY.grandfatheringText).toBe('');
    expect(REFORM_KNOWLEDGE_PACK.FOREIGN_PURCHASE_BAN.grandfatheringText).toBe('');
    expect(REFORM_KNOWLEDGE_PACK.VC_CAPS_LIFTED.grandfatheringText).toBe('');
    expect(REFORM_KNOWLEDGE_PACK.DYNAMIC_PAYG.grandfatheringText).toBe('');
  });
});

describe('Phase 41E.2 — helpers', () => {
  it('getReformKnowledgeEntry returns the entry for valid measures', () => {
    const entry = getReformKnowledgeEntry('TRUST_MINIMUM_TAX');
    expect(entry.measure).toBe('TRUST_MINIMUM_TAX');
    expect(entry.title).toMatch(/discretionary/i);
  });

  it('getAllReformKnowledgeEntries returns 9 entries in M1→M9 order', () => {
    const entries = getAllReformKnowledgeEntries();
    expect(entries).toHaveLength(9);
    expect(entries[0].measure).toBe('NEGATIVE_GEARING_NEW_BUILDS_ONLY');
    expect(entries[1].measure).toBe('CGT_INDEXATION_PLUS_MIN_RATE');
    expect(entries[2].measure).toBe('TRUST_MINIMUM_TAX');
    expect(entries[8].measure).toBe('DYNAMIC_PAYG');
  });

  it('getStatusLabel returns plain-English for each status', () => {
    expect(getStatusLabel('announced')).toMatch(/Budget/);
    expect(getStatusLabel('exposure-draft')).toMatch(/Treasury/);
    expect(getStatusLabel('bill')).toMatch(/Parliament/);
    expect(getStatusLabel('assented')).toMatch(/Royal Assent/);
  });
});
