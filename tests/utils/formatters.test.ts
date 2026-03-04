/**
 * FORMATTERS UTILITY TESTS
 * Comprehensive tests for the centralized formatting utilities
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPercentage,
  formatPercentageValue,
  formatNumber,
  formatCompact,
  formatBytes,
  formatDuration,
  truncate,
  formatPhoneNumber,
  formatABN,
} from '@/lib/utils/formatters';

// =============================================================================
// FORMAT CURRENCY TESTS
// =============================================================================

describe('formatCurrency', () => {
  describe('basic formatting', () => {
    it('formats positive amounts without cents by default', () => {
      expect(formatCurrency(1234)).toBe('$1,234');
    });

    it('formats negative amounts', () => {
      expect(formatCurrency(-1234)).toBe('-$1,234');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('rounds to nearest dollar by default', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235');
      expect(formatCurrency(1234.44)).toBe('$1,234');
    });
  });

  describe('with showCents option', () => {
    it('shows cents when enabled', () => {
      expect(formatCurrency(1234.56, { showCents: true })).toBe('$1,234.56');
    });

    it('shows two decimal places even for whole numbers', () => {
      expect(formatCurrency(1234, { showCents: true })).toBe('$1,234.00');
    });

    it('handles very small amounts', () => {
      expect(formatCurrency(0.01, { showCents: true })).toBe('$0.01');
    });
  });

  describe('with abbreviate option', () => {
    it('abbreviates millions', () => {
      expect(formatCurrency(1500000, { abbreviate: true })).toBe('$1.5M');
    });

    it('abbreviates billions as millions', () => {
      expect(formatCurrency(1500000000, { abbreviate: true })).toBe('$1500.0M');
    });

    it('abbreviates thousands', () => {
      expect(formatCurrency(15000, { abbreviate: true })).toBe('$15K');
    });

    it('does not abbreviate small amounts', () => {
      expect(formatCurrency(999, { abbreviate: true })).toBe('$999');
    });

    it('handles negative abbreviated values', () => {
      expect(formatCurrency(-1500000, { abbreviate: true })).toBe('$-1.5M');
    });
  });

  describe('edge cases', () => {
    it('handles very large numbers', () => {
      expect(formatCurrency(999999999999)).toBe('$999,999,999,999');
    });

    it('handles very small negative numbers', () => {
      expect(formatCurrency(-0.01, { showCents: true })).toBe('-$0.01');
    });

    it('handles NaN gracefully', () => {
      const result = formatCurrency(NaN);
      expect(result).toBe('$NaN');
    });

    it('handles Infinity', () => {
      const result = formatCurrency(Infinity);
      expect(result).toBe('$∞');
    });
  });

  describe('common use cases in the app', () => {
    // These test cases match the patterns found in duplicate implementations

    it('formats property values', () => {
      expect(formatCurrency(850000)).toBe('$850,000');
      expect(formatCurrency(1250000)).toBe('$1,250,000');
    });

    it('formats loan balances', () => {
      expect(formatCurrency(450000)).toBe('$450,000');
      expect(formatCurrency(320000)).toBe('$320,000');
    });

    it('formats income amounts', () => {
      expect(formatCurrency(120000)).toBe('$120,000');
      expect(formatCurrency(85000)).toBe('$85,000');
    });

    it('formats expense amounts', () => {
      expect(formatCurrency(2500)).toBe('$2,500');
      expect(formatCurrency(150)).toBe('$150');
    });

    it('formats net worth summaries (abbreviated)', () => {
      expect(formatCurrency(2500000, { abbreviate: true })).toBe('$2.5M');
      expect(formatCurrency(750000, { abbreviate: true })).toBe('$750K');
    });
  });
});

// =============================================================================
// FORMAT PERCENTAGE TESTS
// =============================================================================

describe('formatPercentage', () => {
  it('converts decimal to percentage', () => {
    expect(formatPercentage(0.0625)).toBe('6.25%');
  });

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });

  it('handles 100%', () => {
    expect(formatPercentage(1)).toBe('100.00%');
  });

  it('handles values over 100%', () => {
    expect(formatPercentage(1.5)).toBe('150.00%');
  });

  it('handles negative values', () => {
    expect(formatPercentage(-0.05)).toBe('-5.00%');
  });

  it('shows sign when requested', () => {
    expect(formatPercentage(0.05, { showSign: true })).toBe('+5.00%');
    expect(formatPercentage(-0.05, { showSign: true })).toBe('-5.00%');
  });

  it('respects decimal places option', () => {
    expect(formatPercentage(0.12345, { decimals: 1 })).toBe('12.3%');
    expect(formatPercentage(0.12345, { decimals: 3 })).toBe('12.345%');
  });
});

describe('formatPercentageValue', () => {
  it('formats percentage values directly', () => {
    expect(formatPercentageValue(6.25)).toBe('6.25%');
  });

  it('handles interest rates', () => {
    expect(formatPercentageValue(5.99)).toBe('5.99%');
    expect(formatPercentageValue(6.49)).toBe('6.49%');
  });
});

// =============================================================================
// FORMAT NUMBER TESTS
// =============================================================================

describe('formatNumber', () => {
  it('formats with thousand separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('handles decimals option', () => {
    expect(formatNumber(1234.567, { decimals: 2 })).toBe('1,234.57');
  });

  it('abbreviates large numbers', () => {
    expect(formatNumber(1500000, { abbreviate: true })).toBe('1.5M');
    expect(formatNumber(15000, { abbreviate: true })).toBe('15.0K');
  });
});

describe('formatCompact', () => {
  it('formats numbers in compact notation', () => {
    const result = formatCompact(1500000);
    expect(result).toMatch(/1\.5M/);
  });
});

// =============================================================================
// FORMAT BYTES TESTS
// =============================================================================

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('handles zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
});

// =============================================================================
// FORMAT DURATION TESTS
// =============================================================================

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3700000)).toBe('1h 1m');
  });
});

// =============================================================================
// STRING UTILITIES TESTS
// =============================================================================

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('does not truncate short strings', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('uses custom suffix', () => {
    expect(truncate('Hello World', 8, '…')).toBe('Hello W…');
  });
});

// =============================================================================
// AUSTRALIAN FORMAT TESTS
// =============================================================================

describe('formatPhoneNumber', () => {
  it('formats mobile numbers', () => {
    expect(formatPhoneNumber('0412345678')).toBe('0412 345 678');
  });

  it('formats landline numbers', () => {
    expect(formatPhoneNumber('0212345678')).toBe('(02) 1234 5678');
  });

  it('handles already formatted numbers', () => {
    expect(formatPhoneNumber('0412 345 678')).toBe('0412 345 678');
  });
});

describe('formatABN', () => {
  it('formats 11-digit ABN', () => {
    expect(formatABN('12345678901')).toBe('12 345 678 901');
  });

  it('returns invalid ABN unchanged', () => {
    expect(formatABN('1234')).toBe('1234');
  });
});
