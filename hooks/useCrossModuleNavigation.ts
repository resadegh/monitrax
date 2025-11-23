'use client';

/**
 * CMNF Navigation Hook
 * Phase 8 Task 10.8 - Cross-Module Navigation Framework
 *
 * Provides navigation functions for cross-module entity traversal.
 */

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GRDCSEntityType, GRDCSLinkedEntity } from '@/lib/grdcs';
import { useNavigationContext, NavStackItem } from '@/contexts/NavigationContext';
import { ROUTE_MAP, getEntityHref, getEntityTypeDisplayName } from '@/lib/navigation/routeMap';

export interface NavigateOptions {
  tab?: string;
  replace?: boolean;
  fromLinkage?: boolean;
}

export interface CrossModuleNavigation {
  navigateToEntity: (type: GRDCSEntityType, id: string, name: string, options?: NavigateOptions) => void;
  openLinkedEntity: (entity: GRDCSLinkedEntity, options?: NavigateOptions) => void;
  goBack: () => void;
  restoreContext: () => void;
  canGoBack: boolean;
  breadcrumb: Array<{ type: GRDCSEntityType; id: string; label: string; href: string }>;
  currentEntity: NavStackItem | null;
  activeTab: string | null;
}

export function useCrossModuleNavigation(): CrossModuleNavigation {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    push,
    pop,
    reset,
    getBreadcrumb,
    canGoBack: checkCanGoBack,
    getCurrentEntity,
    setActiveTab,
  } = useNavigationContext();

  /**
   * Navigate to an entity by type and id
   */
  const navigateToEntity = useCallback(
    (type: GRDCSEntityType, id: string, name: string, options?: NavigateOptions) => {
      const config = ROUTE_MAP[type];
      const href = getEntityHref(type, id);
      const tab = options?.tab || config.defaultTab;

      const navItem: NavStackItem = {
        type,
        id,
        label: name || `${getEntityTypeDisplayName(type)} ${id.slice(0, 8)}`,
        href,
        tab,
      };

      if (options?.replace) {
        // Replace current entity in stack (for tab changes)
        push(navItem);
      } else {
        push(navItem);
      }

      // Navigate using Next.js router (no full page reload)
      router.push(href, { scroll: false });
    },
    [push, router]
  );

  /**
   * Open a linked entity from GRDCS data
   */
  const openLinkedEntity = useCallback(
    (entity: GRDCSLinkedEntity, options?: NavigateOptions) => {
      const config = ROUTE_MAP[entity.type];
      const tab = options?.tab || config.defaultTab;

      const navItem: NavStackItem = {
        type: entity.type,
        id: entity.id,
        label: entity.name,
        href: entity.href,
        tab,
      };

      push(navItem);

      // Navigate using the href from GRDCS (single source of truth)
      router.push(entity.href, { scroll: false });
    },
    [push, router]
  );

  /**
   * Go back to previous entity in navigation stack
   */
  const goBack = useCallback(() => {
    const previous = pop();
    if (previous) {
      router.push(previous.href, { scroll: false });
    }
  }, [pop, router]);

  /**
   * Restore navigation context (e.g., after page refresh)
   */
  const restoreContext = useCallback(() => {
    // Try to restore from URL params
    const id = searchParams.get('id');
    if (id) {
      // Context would be restored from URL - this is a placeholder
      // In practice, the entity detail components handle their own state
    }
  }, [searchParams]);

  return {
    navigateToEntity,
    openLinkedEntity,
    goBack,
    restoreContext,
    canGoBack: checkCanGoBack(),
    breadcrumb: getBreadcrumb(),
    currentEntity: getCurrentEntity(),
    activeTab: state.activeTab,
  };
}
