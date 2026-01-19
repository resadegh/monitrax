/**
 * Phase 32: Portal Components Index
 *
 * MODULAR ARCHITECTURE:
 * All portal components are organized into independent modules.
 * Each module can be imported individually or all at once.
 *
 * Structure:
 * - /ui          → Reusable UI primitives (cards, tables, forms, buttons)
 * - /layout      → Layout components (sidebar, navigation)
 * - /clients     → Client management components
 * - /team        → Team/staff management components
 * - /settings    → Organization settings components
 * - /integrations→ Accounting integration components
 * - /consent     → Consent flow components
 *
 * Usage:
 * ```tsx
 * // Import specific components
 * import { ClientList, ClientDetail } from '@/components/portal/clients';
 * import { PortalCard, PortalButton } from '@/components/portal/ui';
 *
 * // Or import from main index
 * import { ClientList, PortalCard } from '@/components/portal';
 * ```
 */

// Feature Gate
export { PortalFeatureGate, FeatureUnavailable, ComingSoon, PortalAccessDenied } from './PortalFeatureGate';

// UI Components
export * from './ui';

// Layout Components
export { PortalSidebar, NavIcons } from './layout/PortalSidebar';

// Client Components
export * from './clients';

// Team Components
export * from './team';

// Settings Components
export * from './settings';

// Integration Components
export * from './integrations';

// Consent Components
export * from './consent';
