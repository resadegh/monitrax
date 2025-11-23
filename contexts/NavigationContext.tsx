'use client';

/**
 * CMNF Navigation Context
 * Phase 8 Task 10.8 - Cross-Module Navigation Framework
 *
 * Provides global navigation state for cross-module entity traversal.
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { GRDCSEntityType, GRDCSLinkedEntity } from '@/lib/grdcs';

// =============================================================================
// TYPES
// =============================================================================

export interface NavStackItem {
  type: GRDCSEntityType;
  id: string;
  label: string;
  href: string;
  tab?: string;
}

export interface BreadcrumbItem {
  type: GRDCSEntityType;
  id: string;
  label: string;
  href: string;
}

export interface LastEntity {
  type: GRDCSEntityType;
  id: string;
  name: string;
}

export interface NavigationState {
  navStack: NavStackItem[];
  lastEntity: LastEntity | null;
  activeTab: string | null;
  lastRouteState: Record<string, unknown>;
}

type NavigationAction =
  | { type: 'PUSH'; payload: NavStackItem }
  | { type: 'POP' }
  | { type: 'RESET' }
  | { type: 'SET_TAB'; payload: string }
  | { type: 'SET_LAST_ENTITY'; payload: LastEntity }
  | { type: 'UPDATE_ROUTE_STATE'; payload: Record<string, unknown> }
  | { type: 'REPLACE_TOP'; payload: NavStackItem };

export interface NavigationContextValue {
  state: NavigationState;
  push: (item: NavStackItem) => void;
  pop: () => NavStackItem | undefined;
  reset: () => void;
  setActiveTab: (tab: string) => void;
  setLastEntity: (entity: LastEntity) => void;
  updateRouteState: (state: Record<string, unknown>) => void;
  replaceTop: (item: NavStackItem) => void;
  getBreadcrumb: () => BreadcrumbItem[];
  canGoBack: () => boolean;
  getCurrentEntity: () => NavStackItem | null;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: NavigationState = {
  navStack: [],
  lastEntity: null,
  activeTab: null,
  lastRouteState: {},
};

// =============================================================================
// REDUCER
// =============================================================================

function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'PUSH': {
      // Prevent duplicate consecutive entries
      const lastItem = state.navStack[state.navStack.length - 1];
      if (lastItem && lastItem.type === action.payload.type && lastItem.id === action.payload.id) {
        // Update tab if different
        if (lastItem.tab !== action.payload.tab) {
          const newStack = [...state.navStack];
          newStack[newStack.length - 1] = action.payload;
          return { ...state, navStack: newStack, activeTab: action.payload.tab || null };
        }
        return state;
      }
      // Prevent circular navigation (check if already in stack)
      const existingIndex = state.navStack.findIndex(
        item => item.type === action.payload.type && item.id === action.payload.id
      );
      if (existingIndex !== -1) {
        // Truncate stack to that point instead of adding duplicate
        return {
          ...state,
          navStack: state.navStack.slice(0, existingIndex + 1),
          activeTab: action.payload.tab || null,
        };
      }
      return {
        ...state,
        navStack: [...state.navStack, action.payload],
        activeTab: action.payload.tab || null,
      };
    }
    case 'POP': {
      if (state.navStack.length <= 1) {
        return { ...state, navStack: [], activeTab: null };
      }
      const newStack = state.navStack.slice(0, -1);
      const previousItem = newStack[newStack.length - 1];
      return {
        ...state,
        navStack: newStack,
        activeTab: previousItem?.tab || null,
      };
    }
    case 'RESET':
      return initialState;
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LAST_ENTITY':
      return { ...state, lastEntity: action.payload };
    case 'UPDATE_ROUTE_STATE':
      return { ...state, lastRouteState: { ...state.lastRouteState, ...action.payload } };
    case 'REPLACE_TOP': {
      if (state.navStack.length === 0) {
        return { ...state, navStack: [action.payload], activeTab: action.payload.tab || null };
      }
      const newStack = [...state.navStack];
      newStack[newStack.length - 1] = action.payload;
      return { ...state, navStack: newStack, activeTab: action.payload.tab || null };
    }
    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(navigationReducer, initialState);

  const push = useCallback((item: NavStackItem) => {
    dispatch({ type: 'PUSH', payload: item });
  }, []);

  const pop = useCallback((): NavStackItem | undefined => {
    const current = state.navStack[state.navStack.length - 1];
    dispatch({ type: 'POP' });
    return state.navStack[state.navStack.length - 2];
  }, [state.navStack]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_TAB', payload: tab });
  }, []);

  const setLastEntity = useCallback((entity: LastEntity) => {
    dispatch({ type: 'SET_LAST_ENTITY', payload: entity });
  }, []);

  const updateRouteState = useCallback((routeState: Record<string, unknown>) => {
    dispatch({ type: 'UPDATE_ROUTE_STATE', payload: routeState });
  }, []);

  const replaceTop = useCallback((item: NavStackItem) => {
    dispatch({ type: 'REPLACE_TOP', payload: item });
  }, []);

  const getBreadcrumb = useCallback((): BreadcrumbItem[] => {
    return state.navStack.map(item => ({
      type: item.type,
      id: item.id,
      label: item.label,
      href: item.href,
    }));
  }, [state.navStack]);

  const canGoBack = useCallback((): boolean => {
    return state.navStack.length > 1;
  }, [state.navStack]);

  const getCurrentEntity = useCallback((): NavStackItem | null => {
    return state.navStack[state.navStack.length - 1] || null;
  }, [state.navStack]);

  const value: NavigationContextValue = {
    state,
    push,
    pop,
    reset,
    setActiveTab,
    setLastEntity,
    updateRouteState,
    replaceTop,
    getBreadcrumb,
    canGoBack,
    getCurrentEntity,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useNavigationContext(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
}
