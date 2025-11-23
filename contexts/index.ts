/**
 * Contexts Module
 * Exports all React contexts
 */

export {
  NavigationProvider,
  useNavigationContext,
} from './NavigationContext';

export type {
  NavStackItem,
  BreadcrumbItem,
  LastEntity,
  NavigationState,
  NavigationContextValue,
} from './NavigationContext';
