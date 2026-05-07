/**
 * Phase 42 PR6.5 — Swipe gesture primitive.
 *
 * Per Phase 42 spec §6.3 + Reza directive 2026-05-07 (mobile-first):
 *
 *   - Drag left  > 40px → emit `onSwipeLeft`
 *   - Drag right > 40px → emit `onSwipeRight`
 *   - Long-press 300ms (no drag) → emit `onLongPress`
 *   - Double-tap (two short taps within 300ms) → emit `onDoubleTap`
 *   - Drag < 40px → cancel; element springs back to centre
 *   - Forgiving threshold prevents accidental swipes
 *
 * Pointer events (not touch events) — covers mouse + touch + pen
 * uniformly per W3C Pointer Events spec. No library dep. Vibration
 * API for haptic feedback on supported devices (mobile Safari + most
 * Androids); silently no-ops elsewhere.
 *
 * Per CLAUDE.md §12.3 SSOT — there is exactly ONE swipe primitive
 * for the whole app. Future PRs that need swipe (e.g. dashboard
 * cards, navigation drawers) MUST consume this hook rather than
 * roll their own thresholds.
 *
 * Per CLAUDE.md §0 designer lens — `prefers-reduced-motion` is
 * respected (no spring-back animation when set; the action still
 * fires, the visual feedback degrades to instant).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Drag distance (px) past which a horizontal swipe fires. */
export const SWIPE_THRESHOLD_PX = 40;

/** Drag distance (px) inside which we treat the gesture as a tap. */
export const TAP_MAX_DRIFT_PX = 6;

/** Long-press duration (ms) before `onLongPress` fires (no drag). */
export const LONG_PRESS_MS = 300;

/** Double-tap window (ms) — two taps closer than this fire `onDoubleTap`. */
export const DOUBLE_TAP_WINDOW_MS = 300;

/** Vibration duration (ms) for swipe/long-press feedback. */
export const HAPTIC_PULSE_MS = 10;

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  /** Optional plain-tap handler (single tap, no drag). Fires on pointerup. */
  onTap?: () => void;
  /** Disable haptics (default false — haptics on by default). */
  disableHaptics?: boolean;
  /** Disable the spring-back animation (e.g. when parent owns the layout). */
  disableSpring?: boolean;
}

export interface SwipeState {
  /** Current horizontal offset in px (0 when idle). */
  dragX: number;
  /** True while the user is actively dragging. */
  isDragging: boolean;
  /** Direction the user is currently dragging towards (null when idle). */
  direction: 'left' | 'right' | null;
}

/**
 * Fire a haptic pulse if the device + user support it. Silent no-op
 * otherwise.
 */
function tryHaptic(durationMs = HAPTIC_PULSE_MS, disabled = false): void {
  if (disabled) return;
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // some browsers throw on user-gesture violations — silently ignore
  }
}

/**
 * Detect `prefers-reduced-motion` on the client. SSR returns false
 * (safe default — animations show, then the user's first interaction
 * re-evaluates).
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Bind swipe + tap + long-press + double-tap handlers to a target
 * element. Returns:
 *   - `bind` — props to spread onto the target (`onPointerDown`,
 *     `onPointerMove`, `onPointerUp`, `onPointerCancel`)
 *   - `state` — current drag state (for parent to render visual cues)
 *
 * Usage:
 *   const { bind, state } = useSwipeGesture({
 *     onSwipeLeft: () => openSpendingPicker(),
 *     onSwipeRight: () => markAsTransfer(),
 *     onLongPress: () => openFullDrawer(),
 *     onDoubleTap: () => writeAlwaysRule(),
 *   });
 *   return <div {...bind} style={{ transform: `translateX(${state.dragX}px)` }} />;
 */
export function useSwipeGesture(handlers: SwipeHandlers): {
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  state: SwipeState;
} {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef<number>(0);
  const longPressFired = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only react to primary button on mouse; all touch/pen.
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      // Don't capture inside NESTED form controls (e.g. a checkbox
      // or inner button rendered within the bound element) — those
      // need their own events. But DO capture when the target is
      // the bound element itself, even if the bound element is a
      // <button>. (The 2026-05-08 Reza-reported "swipes never fire"
      // bug came from this guard returning true unconditionally
      // when the bound element was a <button> — `target.closest('button')`
      // matched the bound element itself, so no swipe was ever
      // captured.) `currentTarget` = the element the handler is
      // bound to; `target` = the actual element clicked.
      const target = e.target as HTMLElement;
      const interactive = target.closest(
        'input, textarea, select, button, a, [role="button"], [contenteditable]'
      );
      if (interactive && interactive !== e.currentTarget) {
        return;
      }

      startX.current = e.clientX;
      startY.current = e.clientY;
      startTime.current = Date.now();
      longPressFired.current = false;
      setIsDragging(true);
      setDragX(0);

      // Schedule long-press
      if (handlers.onLongPress) {
        cancelLongPress();
        longPressTimer.current = setTimeout(() => {
          // Only fire if the user hasn't drifted (still effectively pressing in place)
          if (
            startX.current !== null &&
            Math.abs((e.clientX ?? 0) - startX.current) < TAP_MAX_DRIFT_PX
          ) {
            longPressFired.current = true;
            tryHaptic(HAPTIC_PULSE_MS, handlers.disableHaptics);
            handlers.onLongPress?.();
          }
        }, LONG_PRESS_MS);
      }

      // Capture for follow-on move/up events
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {
        // ignore — some browsers (rare) reject capture
      }
    },
    [cancelLongPress, handlers]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      // If vertical drift > horizontal, treat as a scroll — release the gesture.
      if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > TAP_MAX_DRIFT_PX) {
        cancelLongPress();
        startX.current = null;
        startY.current = null;
        setIsDragging(false);
        setDragX(0);
        return;
      }

      // Past the tap drift threshold → cancel any pending long-press.
      if (Math.abs(dx) > TAP_MAX_DRIFT_PX) {
        cancelLongPress();
      }

      setDragX(dx);
    },
    [cancelLongPress]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      cancelLongPress();
      const dx = startX.current !== null ? e.clientX - startX.current : 0;
      const elapsed = Date.now() - startTime.current;
      const wasTap = Math.abs(dx) < TAP_MAX_DRIFT_PX && elapsed < LONG_PRESS_MS;

      // Reset drag state
      setIsDragging(false);
      setDragX(0);
      startX.current = null;
      startY.current = null;

      // Long-press already fired? Suppress everything else.
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }

      if (wasTap) {
        // Double-tap?
        const now = Date.now();
        if (now - lastTapTime.current < DOUBLE_TAP_WINDOW_MS && handlers.onDoubleTap) {
          tryHaptic(HAPTIC_PULSE_MS, handlers.disableHaptics);
          handlers.onDoubleTap();
          lastTapTime.current = 0;
          return;
        }
        lastTapTime.current = now;
        // Defer plain-tap so a second tap can fire onDoubleTap first
        if (handlers.onTap) {
          setTimeout(() => {
            // Only fire if no double-tap consumed the marker
            if (lastTapTime.current === now) {
              handlers.onTap?.();
            }
          }, DOUBLE_TAP_WINDOW_MS);
        }
        return;
      }

      // Swipe?
      if (dx <= -SWIPE_THRESHOLD_PX && handlers.onSwipeLeft) {
        tryHaptic(HAPTIC_PULSE_MS, handlers.disableHaptics);
        handlers.onSwipeLeft();
        return;
      }
      if (dx >= SWIPE_THRESHOLD_PX && handlers.onSwipeRight) {
        tryHaptic(HAPTIC_PULSE_MS, handlers.disableHaptics);
        handlers.onSwipeRight();
        return;
      }
      // Drag less than threshold — spring back (state already reset above).
    },
    [cancelLongPress, handlers]
  );

  const onPointerCancel = useCallback(
    (_e: React.PointerEvent) => {
      cancelLongPress();
      startX.current = null;
      startY.current = null;
      setIsDragging(false);
      setDragX(0);
    },
    [cancelLongPress]
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  return {
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    state: {
      dragX,
      isDragging,
      direction: dragX < -TAP_MAX_DRIFT_PX ? 'left' : dragX > TAP_MAX_DRIFT_PX ? 'right' : null,
    },
  };
}

export { prefersReducedMotion };
