/**
 * Monitrax Formatters Utility
 * Consistent formatting for currency, percentages, dates, and numbers
 */

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  showCents?: boolean;
  abbreviate?: boolean;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  options?: CurrencyFormatOptions
): string {
  const {
    currency = 'AUD',
    locale = 'en-AU',
    showCents = false,
    abbreviate = false,
  } = options || {};

  // Handle abbreviation for large numbers
  if (abbreviate) {
    if (Math.abs(amount) >= 1_000_000) {
      const abbreviated = amount / 1_000_000;
      return `$${abbreviated.toFixed(1)}M`;
    }
    if (Math.abs(amount) >= 1_000) {
      const abbreviated = amount / 1_000;
      return `$${abbreviated.toFixed(0)}K`;
    }
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

export interface PercentageFormatOptions {
  decimals?: number;
  showSign?: boolean;
  locale?: string;
}

/**
 * Format a decimal as a percentage string
 * @param value - The decimal value (e.g., 0.0625 for 6.25%)
 */
export function formatPercentage(
  value: number,
  options?: PercentageFormatOptions
): string {
  const { decimals = 2, showSign = false, locale = 'en-AU' } = options || {};

  const percentValue = value * 100;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(percentValue));

  const sign = showSign && percentValue > 0 ? '+' : percentValue < 0 ? '-' : '';
  return `${sign}${formatted}%`;
}

/**
 * Format a percentage that's already in percentage form (e.g., 6.25 for 6.25%)
 */
export function formatPercentageValue(
  value: number,
  options?: PercentageFormatOptions
): string {
  const { decimals = 2, showSign = false, locale = 'en-AU' } = options || {};

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  const sign = showSign && value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatted}%`;
}

export type DateFormat = 'short' | 'medium' | 'long' | 'relative' | 'iso';

/**
 * Format a date string or Date object
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: DateFormat = 'short'
): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '-';

  if (format === 'iso') {
    return d.toISOString().split('T')[0];
  }

  if (format === 'relative') {
    return formatRelativeDate(d);
  }

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: format === 'long' ? 'long' : format === 'medium' ? 'short' : 'numeric',
    year: 'numeric',
  };

  return d.toLocaleDateString('en-AU', options);
}

/**
 * Format a date relative to now
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'Last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return 'Last month';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export interface NumberFormatOptions {
  abbreviate?: boolean;
  decimals?: number;
  locale?: string;
}

/**
 * Format a number with locale-specific separators
 */
export function formatNumber(
  value: number,
  options?: NumberFormatOptions
): string {
  const { abbreviate = false, decimals = 0, locale = 'en-AU' } = options || {};

  if (abbreviate) {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as a compact representation
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3600_000) / 60_000)}m`;
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Format a phone number (Australian format)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  // Mobile: 04XX XXX XXX
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Landline: (0X) XXXX XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * Format an ABN (Australian Business Number)
 */
export function formatABN(abn: string): string {
  const cleaned = abn.replace(/\D/g, '');
  if (cleaned.length !== 11) return abn;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
}
