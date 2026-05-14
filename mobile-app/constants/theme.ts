import { Platform } from 'react-native';

export const Brand = {
  navy: '#0B1220',
  emerald: '#16A34A',
  emeraldLight: '#22C55E',
  amber: '#F59E0B',
  amberLight: '#FBBF24',
  red: '#DC2626',
  redLight: '#EF4444',
  sky: '#0EA5E9',
};

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSunken: '#F8FAFC',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    tint: Brand.emerald,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: Brand.emerald,
    tabBar: '#FFFFFF',
    positive: Brand.emerald,
    negative: '#64748B',
    warning: Brand.amber,
    critical: Brand.red,
  },
  dark: {
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#475569',
    background: '#020617',
    surface: '#0F172A',
    surfaceSunken: '#020617',
    border: '#1E293B',
    borderStrong: '#334155',
    tint: Brand.emeraldLight,
    icon: '#94A3B8',
    tabIconDefault: '#475569',
    tabIconSelected: Brand.emeraldLight,
    tabBar: Brand.navy,
    positive: Brand.emeraldLight,
    negative: '#94A3B8',
    warning: Brand.amberLight,
    critical: Brand.redLight,
  },
};

export const Severity = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#F59E0B',
  low: '#3B82F6',
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
});
