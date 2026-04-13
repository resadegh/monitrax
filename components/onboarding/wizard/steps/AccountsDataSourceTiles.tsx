'use client';

/**
 * AccountsDataSourceTiles — Phase 12 PR 3b
 *
 * Three-tier data source picker rendered at the top of AccountsStep.
 *
 *   Tier 1 — Basiq (Recommended): connect a bank via Open Banking
 *   Tier 2 — Import: upload a CSV/OFX/QIF transaction file
 *   Tier 3 — Manual: type balances directly (de-ranked fallback)
 *
 * Each tile is a self-contained button. The parent (AccountsStep)
 * wires up the onClick handlers that kick off each flow. This
 * component intentionally has zero business logic — it's purely
 * presentational so it can be dropped anywhere.
 *
 * See: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md §3 row F
 */

import React from 'react';
import {
  Landmark,
  FileSpreadsheet,
  Pencil,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface AccountsDataSourceTilesProps {
  /** Disable Basiq tile while the consent redirect is in progress. */
  basiqLoading?: boolean;
  /** Disable Import tile while the import dialog is open. */
  importOpen?: boolean;
  /** Triggered when the user picks the Basiq tile. */
  onPickBasiq: () => void;
  /** Triggered when the user picks the Import tile. */
  onPickImport: () => void;
  /** Triggered when the user picks the Manual tile. */
  onPickManual: () => void;
}

export function AccountsDataSourceTiles({
  basiqLoading,
  importOpen,
  onPickBasiq,
  onPickImport,
  onPickManual,
}: AccountsDataSourceTilesProps) {
  return (
    <div className="space-y-3">
      {/* Tier 1 — Basiq (Recommended) */}
      <button
        type="button"
        onClick={onPickBasiq}
        disabled={basiqLoading}
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-5 text-left shadow-[0_10px_30px_-12px_rgba(99,102,241,0.35)] transition-all hover:shadow-[0_14px_38px_-10px_rgba(99,102,241,0.5)] disabled:opacity-60 disabled:cursor-not-allowed dark:border-blue-800/40 dark:from-blue-900/30 dark:via-indigo-900/20 dark:to-violet-900/20"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 blur-3xl" />

        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-[0_8px_20px_-6px_rgba(99,102,241,0.55)]">
          {basiqLoading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Landmark className="h-7 w-7" />
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Connect your bank
            </h4>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-2.5 w-2.5" />
              Recommended
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Via secure Open Banking. Always up to date. Takes ~30 seconds.
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-500">
            <ShieldCheck className="h-3 w-3" />
            Bank-level encryption · CDR-compliant
          </div>
        </div>

        <ArrowRight className="relative h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white/90 px-3 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:bg-slate-900/90">
            or
          </span>
        </div>
      </div>

      {/* Tier 2 — Import file */}
      <button
        type="button"
        onClick={onPickImport}
        disabled={importOpen}
        className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white/60 p-4 text-left transition-all hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/70 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-400">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Upload a transaction file
          </h4>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            CSV, OFX or QIF from your bank&apos;s export. We&apos;ll keep your balance
            accurate from each upload.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
      </button>

      {/* Tier 3 — Manual */}
      <button
        type="button"
        onClick={onPickManual}
        className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white/40 p-3.5 text-left transition-all hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-slate-600 dark:hover:bg-slate-800/60"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Pencil className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Enter manually
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">
            Best for cash, crypto, foreign or unsupported accounts. Balance will need manual updates.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
      </button>
    </div>
  );
}

export default AccountsDataSourceTiles;
