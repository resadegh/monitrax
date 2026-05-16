'use client';

/**
 * Phase 41E.3 — Tax-treatment regime badge for a single property.
 *
 * Reusable presentational component. Takes the minimal per-property
 * inputs needed to derive the Phase 41E reform regime + renders a
 * small badge with the appropriate styling.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §12.1 (Property
 * detail row: "Tax treatment" badge — F per Measure 1 + 2) + §11.1
 * risk mitigation ("Tile says 'Grandfathered' / 'Post-reform — new
 * build' / 'Post-reform — restricted' / 'Acquisition date unknown'").
 *
 * Visual vocabulary (warm-words framing per CLAUDE.md §14):
 *   - Grandfathered → emerald (good news, you're protected)
 *   - New build (post-reform but still qualifies) → sky (informational)
 *   - Restricted (post-reform, neg-gearing denied) → slate (neutral —
 *     not red, not amber: this isn't a warning, it's a regime label)
 *   - Confirm contract date → amber (action needed — UI nudge)
 *   - Confirm new-build status → amber (action needed — UI nudge)
 *
 * **Why not red for "restricted":** restricted negative gearing is
 * a regime classification, not a problem the user should be alarmed
 * about. Red here would push users toward panic decisions (sell now!)
 * which is exactly the behaviour the AFSL boundary (D-2) is structured
 * to prevent. Slate is calm; the AI advisor surfaces the structural
 * impact with proper context.
 */

import { useMemo } from 'react';
import {
  deriveNegativeGearingRegime,
  type NegativeGearingRegime,
} from '@/lib/tax-engine/divisions/negativeGearingRegime';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

export interface TaxTreatmentBadgeProps {
  /** The Prisma `PropertyType` value. */
  propertyType: 'HOME' | 'INVESTMENT' | 'RENTAL';
  /** Property.acquisitionContractDate (ISO string or Date) — nullable. */
  acquisitionContractDate?: string | Date | null;
  /** Property.isNewBuild — nullable. */
  isNewBuild?: boolean | null;
  /**
   * Target FY string, e.g. `"2027-28"`. Defaults to the current FY
   * derived from today's date in AEST. Caller can override for
   * scenario surfaces (e.g. "what does this look like in FY 2028-29?").
   */
  financialYear?: string;
  /** Smaller variant for inline use (next to property name). */
  size?: 'sm' | 'md';
}

/**
 * Visual config per regime. Tone-coded for the behavioural-psychologist
 * lens — calm framing, never alarming.
 */
const REGIME_VISUAL: Record<
  NegativeGearingRegime,
  {
    label: string;
    shortLabel: string;
    bgClass: string;
    textClass: string;
    ringClass: string;
    description: string;
  }
> = {
  PRE_REFORM_GRANDFATHERED: {
    label: 'Grandfathered',
    shortLabel: 'Grandfathered',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    ringClass: 'ring-emerald-200 dark:ring-emerald-800',
    description:
      'Pre-reform rules apply indefinitely — your negative gearing and 50% CGT discount don\'t change.',
  },
  POST_REFORM_NEW_BUILD: {
    label: 'Post-reform — new build',
    shortLabel: 'New build',
    bgClass: 'bg-sky-50 dark:bg-sky-950/40',
    textClass: 'text-sky-700 dark:text-sky-300',
    ringClass: 'ring-sky-200 dark:ring-sky-800',
    description:
      'Qualifies as a new build — negative gearing still applies from FY 2027-28.',
  },
  POST_REFORM_RESTRICTED: {
    label: 'Post-reform — restricted',
    shortLabel: 'Restricted',
    bgClass: 'bg-slate-100 dark:bg-slate-800/60',
    textClass: 'text-slate-700 dark:text-slate-300',
    ringClass: 'ring-slate-200 dark:ring-slate-700',
    description:
      'Negative gearing is restricted from FY 2027-28. Existing 50% CGT discount on sale also changes for disposals from 1 Jul 2027.',
  },
  UC_PROPERTY_CONTRACT_DATE_UNKNOWN: {
    label: 'Confirm contract date',
    shortLabel: 'Confirm date',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    ringClass: 'ring-amber-200 dark:ring-amber-800',
    description:
      'Acquisition contract date is missing — we cannot determine your tax regime without it. Confirm in property settings.',
  },
  UC_NEW_BUILD_UNCONFIRMED: {
    label: 'Confirm new-build status',
    shortLabel: 'Confirm build',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    ringClass: 'ring-amber-200 dark:ring-amber-800',
    description:
      'Property contracted after 12 May 2026 — confirm whether it qualifies as a new build in property settings.',
  },
};

/**
 * Derive the current AU FY from the current date.
 * 1 Jul YYYY → FY YYYY-YY+1.
 */
function deriveCurrentFy(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  // AU FY runs 1 Jul – 30 Jun. After 1 Jul we're in the new FY.
  const leadingYear = month >= 7 ? year : year - 1;
  const trailingYear = (leadingYear + 1).toString().slice(-2);
  return `${leadingYear}-${trailingYear}`;
}

export function TaxTreatmentBadge(props: TaxTreatmentBadgeProps) {
  const fy = props.financialYear ?? deriveCurrentFy();
  const config = getTaxYearConfig(fy);

  const contractDate = useMemo(() => {
    if (!props.acquisitionContractDate) return null;
    if (props.acquisitionContractDate instanceof Date) return props.acquisitionContractDate;
    return new Date(props.acquisitionContractDate);
  }, [props.acquisitionContractDate]);

  const regime = deriveNegativeGearingRegime({
    propertyType: props.propertyType,
    contractDate,
    isNewBuild: props.isNewBuild ?? null,
    fy,
    config,
  });

  const visual = REGIME_VISUAL[regime];
  const isSmall = props.size === 'sm';

  return (
    <span
      title={visual.description}
      className={[
        'inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset',
        isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        'font-medium',
        visual.bgClass,
        visual.textClass,
        visual.ringClass,
      ].join(' ')}
      data-regime={regime}
      aria-label={`Tax treatment: ${visual.label}`}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {isSmall ? visual.shortLabel : visual.label}
    </span>
  );
}

/**
 * Helper exported for tests + the AI advisor narrator — the canonical
 * short label per regime, used in both the badge and the per-property
 * card narration so they always agree.
 */
export function getRegimeShortLabel(regime: NegativeGearingRegime): string {
  return REGIME_VISUAL[regime].shortLabel;
}

/**
 * Helper exported for tooltip / drill-in narration — the plain-English
 * description shown when the user hovers / focuses the badge.
 */
export function getRegimeDescription(regime: NegativeGearingRegime): string {
  return REGIME_VISUAL[regime].description;
}
