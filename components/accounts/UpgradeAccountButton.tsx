/**
 * Phase 12 PR 3c.2 — UpgradeAccountButton.
 *
 * Surfaces the upgrade path for accounts whose balance is currently
 * MANUAL or USER_VERIFIED — i.e. the user is the source of truth, not
 * a synced feed. Two routes:
 *
 *   - Connect via Basiq → live Open Banking sync (`balanceSource = BASIQ`)
 *   - Upload statement   → file import (`balanceSource = IMPORT`)
 *
 * Both routes are existing surfaces on `/dashboard/balances`; this
 * primitive just deep-links to them via the `?action=` query handler
 * already wired up there. No new flow logic.
 *
 * For BASIQ and IMPORT sources, the button renders nothing — those
 * accounts are already on a fresher tier. The chip already tells the
 * user how recent their balance is.
 *
 * Per CLAUDE.md §0:
 *   - architect lens — no parallel routes; reuses the existing
 *     `connect-basiq` + `import` deep-link handlers.
 *   - financial-adviser lens — neutral framing ("Keep your balance
 *     fresh"), no shaming of manual entry; emerald accent for Basiq
 *     (the freshest tier).
 *   - behaviour-psychologist lens — the button is a soft suggestion,
 *     not a forcing function. Users with cash / crypto / foreign
 *     accounts who genuinely need MANUAL can ignore it.
 *   - designer lens — restraint. A small row inside the Account
 *     Details card, not a banner or modal.
 *
 * Per CLAUDE.md §12.2 — `BasiqGateContext` is the single SSOT for
 * whether Basiq is enabled. When off, the Basiq button is hidden
 * (the Import path stays visible).
 */

'use client';

import Link from 'next/link';
import { Zap, Upload } from 'lucide-react';
import { useBasiqEnabled } from '@/lib/featureFlags/BasiqGateContext';

type UpgradableSource = 'MANUAL' | 'USER_VERIFIED';

interface UpgradeAccountButtonProps {
  balanceSource?: string | null;
  /**
   * Optional caller-side close hook. Most callers will fire this so
   * the dialog containing the button closes before the page-level
   * `?action=` handler fires. When omitted, the link still works —
   * the dialog just stays open until the user manually closes it.
   */
  onBeforeNavigate?: () => void;
  /** Visual variant. `compact` strips icons and shortens labels. */
  size?: 'default' | 'compact';
}

/**
 * Render nothing for sources that are already auto-fed (BASIQ, IMPORT)
 * or unknown.
 */
function isUpgradable(source: string | null | undefined): source is UpgradableSource {
  return source === 'MANUAL' || source === 'USER_VERIFIED';
}

export function UpgradeAccountButton({
  balanceSource,
  onBeforeNavigate,
  size = 'default',
}: UpgradeAccountButtonProps) {
  const basiqEnabled = useBasiqEnabled();
  if (!isUpgradable(balanceSource)) return null;

  const sizing =
    size === 'compact'
      ? 'text-[11px] px-2 py-1 gap-1'
      : 'text-xs px-2.5 py-1.5 gap-1.5';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {basiqEnabled && (
        <Link
          href="/dashboard/balances?action=connect-basiq"
          onClick={onBeforeNavigate}
          className={`inline-flex items-center rounded-md bg-emerald-600 hover:bg-emerald-700 font-medium text-white transition-colors ${sizing}`}
        >
          {size !== 'compact' && <Zap aria-hidden className="h-3 w-3" />}
          Connect via Basiq
        </Link>
      )}
      <Link
        href="/dashboard/balances?action=import"
        onClick={onBeforeNavigate}
        className={`inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition-colors ${sizing}`}
      >
        {size !== 'compact' && <Upload aria-hidden className="h-3 w-3" />}
        Upload statement
      </Link>
    </div>
  );
}
