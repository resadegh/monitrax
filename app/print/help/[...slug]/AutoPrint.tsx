'use client';

/**
 * Phase 33c — auto-print bootstrap for the help PDF view.
 *
 * Triggers `window.print()` once the article has rendered + fonts have
 * settled (`document.fonts.ready` when available, otherwise next frame).
 * Also wires the visible "Open print dialog" link in the toolbar so the
 * user can re-trigger the dialog after dismissing it without having to
 * remember the keyboard shortcut.
 *
 * Deliberately small + dependency-free — this component runs only on
 * the client and adds no behaviour to the server-rendered HTML, so the
 * page still renders fine with JS disabled (the user just prints from
 * the browser menu).
 */

import { useEffect } from 'react';

export function AutoPrint() {
  useEffect(() => {
    let cancelled = false;

    const triggerPrint = () => {
      if (cancelled) return;
      try {
        window.print();
      } catch {
        // Some embedded contexts (sandboxed iframes) reject print() — the
        // user can still trigger it from the browser menu, so swallow.
      }
    };

    const fontsApi = (document as Document & {
      fonts?: { ready?: Promise<unknown> };
    }).fonts;
    const fontsReady =
      fontsApi && typeof fontsApi.ready?.then === 'function'
        ? fontsApi.ready
        : Promise.resolve();

    fontsReady.then(() => {
      requestAnimationFrame(() => {
        // Tiny delay so the toolbar paints before the modal — the user
        // sees the document briefly, then the print sheet, which is less
        // jarring than an instant modal on a blank-feeling page.
        setTimeout(triggerPrint, 80);
      });
    });

    const handleTriggerClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const trigger = target.closest('[data-print-trigger]');
      if (!trigger) return;
      event.preventDefault();
      triggerPrint();
    };
    document.addEventListener('click', handleTriggerClick);

    return () => {
      cancelled = true;
      document.removeEventListener('click', handleTriggerClick);
    };
  }, []);

  return null;
}
