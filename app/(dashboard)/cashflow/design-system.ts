/**
 * CASHFLOW PAGE DESIGN SYSTEM
 * Premium financial command center styling
 *
 * Design Philosophy: Bloomberg Terminal meets Apple design
 * - Sophisticated, minimal, actionable
 * - Premium white space and elegant typography
 * - Every chart tells a story, every number drives a decision
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const colors = {
  // Primary
  navy: '#1a1f36',
  navyLight: '#2d3250',

  // Accent
  purple: '#6366f1',
  purpleLight: '#818cf8',
  purpleDark: '#4f46e5',

  // Status
  success: '#10b981',
  successLight: '#34d399',
  successDark: '#059669',

  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningDark: '#d97706',

  danger: '#ef4444',
  dangerLight: '#f87171',
  dangerDark: '#dc2626',

  // Neutrals
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Chart specific
  chartPrimary: '#6366f1',
  chartSecondary: '#10b981',
  chartTertiary: '#f59e0b',
  chartGradientStart: 'rgba(99, 102, 241, 0.3)',
  chartGradientEnd: 'rgba(99, 102, 241, 0.05)',

  // Inflow/Outflow
  inflow: '#10b981',
  inflowLight: 'rgba(16, 185, 129, 0.1)',
  outflow: '#ef4444',
  outflowLight: 'rgba(239, 68, 68, 0.1)',
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  // Font family (Inter is loaded via Tailwind)
  fontFamily: 'Inter, system-ui, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',

  // Font sizes
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },

  // Font weights
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  leading: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },
};

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
};

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  hover: '0 10px 25px -5px rgba(99, 102, 241, 0.15), 0 4px 10px -4px rgba(0, 0, 0, 0.1)',
  card: '0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)',
  cardHover: '0 4px 12px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.08)',
};

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const radius = {
  none: '0',
  sm: '0.25rem',   // 4px
  default: '0.5rem', // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.25rem',   // 20px
  full: '9999px',
};

// =============================================================================
// TRANSITIONS
// =============================================================================

export const transitions = {
  fast: '150ms ease-in-out',
  default: '200ms ease-in-out',
  slow: '300ms ease-in-out',

  // Specific transitions
  hover: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  chart: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  expand: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// =============================================================================
// BREAKPOINTS (matches Tailwind)
// =============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// =============================================================================
// Z-INDEX
// =============================================================================

export const zIndex = {
  base: '0',
  dropdown: '10',
  sticky: '20',
  fixed: '30',
  modal: '40',
  tooltip: '50',
};

// =============================================================================
// CHART CONFIGURATION
// =============================================================================

export const chartConfig = {
  // Line chart
  line: {
    strokeWidth: 2.5,
    dot: false,
    activeDot: {
      r: 6,
      strokeWidth: 2,
      fill: colors.white,
      stroke: colors.purple,
    },
  },

  // Area chart
  area: {
    strokeWidth: 2,
    fillOpacity: 0.1,
  },

  // Axes
  axis: {
    stroke: colors.gray200,
    fontSize: 12,
    fontFamily: typography.fontFamily,
    tickLine: false,
    axisLine: false,
  },

  // Grid
  grid: {
    stroke: colors.gray100,
    strokeDasharray: '3 3',
  },

  // Tooltip
  tooltip: {
    contentStyle: {
      backgroundColor: colors.white,
      border: `1px solid ${colors.gray200}`,
      borderRadius: radius.md,
      boxShadow: shadows.lg,
      padding: '12px 16px',
    },
    labelStyle: {
      color: colors.navy,
      fontWeight: typography.weights.semibold,
      marginBottom: 4,
    },
    itemStyle: {
      color: colors.gray600,
      fontSize: typography.sizes.sm,
    },
  },

  // Responsive container
  responsive: {
    width: '100%',
    height: 320,
    minHeight: 280,
  },
};

// =============================================================================
// COMPONENT CLASSES (Tailwind CSS)
// =============================================================================

export const componentClasses = {
  // Cards
  card: 'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md',
  cardHeader: 'px-6 py-4 border-b border-gray-100',
  cardBody: 'px-6 py-5',
  cardFooter: 'px-6 py-4 bg-gray-50 border-t border-gray-100',

  // Section headers
  sectionTitle: 'text-lg font-semibold text-gray-900',
  sectionSubtitle: 'text-sm text-gray-500 mt-1',

  // Metric displays
  metricValue: 'text-2xl font-bold text-gray-900 tabular-nums',
  metricLabel: 'text-sm font-medium text-gray-500',
  metricSmall: 'text-sm font-medium text-gray-600 tabular-nums',

  // Buttons
  buttonPrimary: 'inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  buttonSecondary: 'inline-flex items-center justify-center px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  buttonGhost: 'inline-flex items-center justify-center px-3 py-1.5 text-gray-600 font-medium rounded-md hover:bg-gray-100 transition-colors duration-200',

  // Status badges
  badgeSuccess: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
  badgeWarning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800',
  badgeDanger: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
  badgeInfo: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800',

  // List items
  listItem: 'flex items-center justify-between py-3 border-b border-gray-100 last:border-0',

  // Loading states
  skeleton: 'animate-pulse bg-gray-200 rounded',

  // Icons
  iconWrapper: 'flex items-center justify-center w-10 h-10 rounded-lg',
  iconWrapperSm: 'flex items-center justify-center w-8 h-8 rounded-lg',
};

// =============================================================================
// ANIMATION KEYFRAMES (for CSS)
// =============================================================================

export const animations = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  slideUp: {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  scaleIn: {
    from: { opacity: 0, transform: 'scale(0.95)' },
    to: { opacity: 1, transform: 'scale(1)' },
  },
  pulse: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency in AUD
 */
export function formatCurrency(amount: number, options?: { compact?: boolean }): string {
  if (options?.compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    case 'long':
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    default:
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

  return formatDate(d, 'short');
}

/**
 * Get color for amount (positive = success, negative = danger)
 */
export function getAmountColor(amount: number): string {
  if (amount > 0) return colors.success;
  if (amount < 0) return colors.danger;
  return colors.gray500;
}

/**
 * Get trend indicator
 */
export function getTrendIndicator(value: number, threshold: number = 0): 'up' | 'down' | 'neutral' {
  if (value > threshold) return 'up';
  if (value < -threshold) return 'down';
  return 'neutral';
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
