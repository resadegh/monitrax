'use client';

import { useEffect, useState } from 'react';

/**
 * useIsMobile — true when the viewport width is below the Tailwind
 * `md` breakpoint (768px). Updates on viewport resize.
 *
 * Used by tile components that opt into a different scroll behaviour
 * on mobile (e.g. sticky-stack scroll) but keep the standard grid
 * layout on desktop. SSR-safe — returns `false` on the first render
 * and updates after the client hydrates.
 *
 * Pattern source: components/properties/PropertyTile.tsx (Phase 39
 * mobile sticky-stack scroll pattern).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}
