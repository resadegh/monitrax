/**
 * Practice-side filled-silhouette glyphs.
 *
 * Companion file to `components/wealth/wealthGlyphs.tsx` — same design
 * rules, different domain. These are the watermark glyphs for Org
 * Portal practice tiles (active clients, open requests, conversations).
 *
 * Design rules (verbatim from wealthGlyphs.tsx):
 *   • Filled paths only. fill='currentColor'. No strokes.
 *   • Single closed silhouette per glyph.
 *   • viewBox: 0 0 120 120 (consistent scale across glyphs).
 *   • preserveAspectRatio: xMaxYMid meet (right-anchored bleed).
 *   • Composition fills 80–95% of the viewBox so the watermark
 *     reads from the tile's right edge.
 *
 * Usage:
 *   <MetricTile tone="sky" watermark={<ClientsGlyph />} />
 *   The MetricTile wrapper handles opacity (0.06 → 0.12 hover) and
 *   colour inheritance via currentColor.
 */

import type { SVGProps } from 'react';

const baseProps: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 120 120',
  preserveAspectRatio: 'xMaxYMid meet',
  fill: 'currentColor',
  className: 'h-full w-full',
  'aria-hidden': true,
};

/**
 * Briefcase silhouette — Active Clients tile.
 * Solid case body with handle cutout suggested by negative space.
 */
export function ClientsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      {/* Handle */}
      <path d="M44 18c0-4 3-7 7-7h18c4 0 7 3 7 7v10h-8v-8c0-1-1-2-2-2H54c-1 0-2 1-2 2v8h-8V18z" />
      {/* Case body — solid rectangle with rounded corners */}
      <path d="M14 36c0-4 3-7 7-7h78c4 0 7 3 7 7v60c0 4-3 7-7 7H21c-4 0-7-3-7-7V36z" />
    </svg>
  );
}

/**
 * Inbox silhouette — Open Requests tile.
 * Tray with stacked indicator on top.
 */
export function RequestsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      {/* Top stack indicator */}
      <path d="M30 12h60v6H30zM26 22h68v6H26z" />
      {/* Tray body */}
      <path d="M14 36c0-4 3-7 7-7h78c4 0 7 3 7 7v54c0 4-3 7-7 7H21c-4 0-7-3-7-7V36zm12 8v18l16-2 6 8h24l6-8 16 2V44H26z" />
    </svg>
  );
}

/**
 * Speech-bubble silhouette — Conversations tile.
 * Rounded bubble with tail.
 */
export function ConversationsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 20c0-4 3-7 7-7h70c4 0 7 3 7 7v52c0 4-3 7-7 7H56l-22 22V79H25c-4 0-7-3-7-7V20z" />
    </svg>
  );
}

/**
 * Bar-chart silhouette — Practice analytics / TRAIL stage tile.
 * Three ascending bars suggesting growth.
 */
export function AnalyticsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 102h84v6H18z" />
      <path d="M22 78h16v22H22zM50 56h16v44H50zM78 30h16v70H78z" />
    </svg>
  );
}

/**
 * Heartbeat silhouette — Average client Health tile.
 * Stylised pulse line as a thick filled stroke.
 */
export function HealthGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M14 60h22l8-22 12 44 10-32 10 16h28v8H72l-6-10-12 36-14-50-6 18H14z" />
    </svg>
  );
}
