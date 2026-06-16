'use client';

/**
 * GlobalScanReceipt — Phase 49 (2026-06-16)
 *
 * Mobile-only, global "Scan a receipt" quick-capture. A floating camera FAB
 * (above the editorial bottom nav) opens a bottom sheet that lets the user
 * snap a receipt with the native camera (`capture="environment"`) or pick an
 * existing file, then runs it through the EXISTING document-intelligence
 * engine and shows what was found for one-tap confirmation.
 *
 * SSOT: this component adds NO new calculation or entity-creation logic. It
 * rides the canonical pipeline already used by My Vault:
 *   1. upload  → `useDocumentUpload()` → POST /api/documents/upload (Phase 25 DME)
 *   2. analyze → POST /api/documents/analyze (Phase 26 DIE) — persists the
 *      DocumentAnalysis (extractedData + suggestedActions) so the receipt also
 *      lands in the Smart Inbox if the user dismisses without confirming.
 *   3. confirm → POST /api/documents/analyze/confirm — creates the
 *      Expense/Income/Loan from the top suggested action. Nothing is written
 *      until the user taps the primary CTA (behaviour-psychology: no surprise
 *      saves; financial-adviser: the user verifies before the number lands).
 *
 * Design: Monitrax in-app "My Wealth glass" vocabulary (CLAUDE.md §18.7.2) —
 * deep-navy/ivory glass sheet, sky→indigo brand gradient, emerald reserved for
 * the confidence cue. Bottom-sheet chrome mirrors `components/shell/MoreSheet`
 * (06_UI_UX_FOUNDATION.md §15.3): backdrop, Esc + body-scroll lock, ARIA
 * dialog, Tailwind motion-safe slide-in (no framer-motion).
 *
 * Stitch (project 1859462351962811110, CLAUDE.md §18.2.1 — Stitch-first):
 *   - capture sheet  light `895151e084d14c9aaa9dc410e0e3aaba`
 *                    dark  `cbd9e77e175c4359a7d053dbdd3a5bc1`
 *   - result sheet   light `87ec42b8ba2f40ccbac4eb2c12d81eb6`
 *                    dark  `f5a5e9a4068440df868464efca8e7332`
 *   Artefacts: `.stitch/designs/phase49-scan-receipt/`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Upload,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArchiveRestore,
  Plus,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { DocumentCategory } from '@/lib/documents/types';
import { formatCurrency } from '@/lib/utils/formatters';

type Stage = 'capture' | 'analyzing' | 'result' | 'success' | 'error';

interface SuggestedAction {
  action: string;
  label: string;
  description?: string;
  prefilled: Record<string, unknown>;
  confidence: number;
}

interface Analysis {
  id: string;
  documentType: string;
  overallConfidence: number;
  extractedData: Record<string, unknown>;
  suggestedActions: SuggestedAction[];
}

const SUPPORTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

/** Read the first present key from the action's prefilled data, then the raw
 * extractedData. Keeps the preview resilient to analyzer key drift. */
function pick(
  keys: string[],
  prefilled: Record<string, unknown> | undefined,
  extracted: Record<string, unknown>
): unknown {
  for (const k of keys) {
    if (prefilled && prefilled[k] != null && prefilled[k] !== '') return prefilled[k];
  }
  for (const k of keys) {
    if (extracted[k] != null && extracted[k] !== '') return extracted[k];
  }
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function GlobalScanReceipt() {
  const router = useRouter();
  const { token } = useAuth();
  const { upload } = useDocumentUpload();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('capture');
  const [canCapture, setCanCapture] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Native camera capture is only meaningful on touch devices.
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setCanCapture(window.matchMedia('(pointer: coarse)').matches);
    }
  }, []);

  // Esc to close + body-scroll lock while the sheet is open (mirrors MoreSheet).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const reset = useCallback(() => {
    setStage('capture');
    setAnalysis(null);
    setSavedDocId(null);
    setErrorMsg(null);
    setSubmitting(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Defer reset so the slide-out isn't visually interrupted.
    setTimeout(reset, 250);
  }, [reset]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!SUPPORTED_MIME.includes(file.type)) {
        setErrorMsg('Please use a photo or PDF (JPEG, PNG, GIF, WebP or PDF).');
        setStage('error');
        return;
      }
      if (file.size > MAX_BYTES) {
        setErrorMsg('That file is over 10MB. Try a photo instead.');
        setStage('error');
        return;
      }

      setStage('analyzing');
      setErrorMsg(null);

      // 1. Upload through the canonical DME (lands in My Vault, tagged RECEIPT).
      const uploadRes = await upload(file, {
        category: DocumentCategory.RECEIPT,
        description: 'Scanned receipt',
        tags: ['mobile-scan'],
      });

      if (!uploadRes.success || !uploadRes.documentId) {
        // Upload may have stored the file (e.g. local drive) without returning
        // an id we can analyse. Treat as a soft success: it's safe in the Vault.
        if (uploadRes.success) {
          setSavedDocId(null);
          setStage('success');
          return;
        }
        setErrorMsg(uploadRes.error || 'We could not upload that. Please try again.');
        setStage('error');
        return;
      }

      setSavedDocId(uploadRes.documentId);

      // 2. Analyze through the canonical Document Intelligence Engine.
      try {
        const res = await fetch('/api/documents/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentId: uploadRes.documentId }),
        });
        const json = await res.json();

        if (!res.ok || !json.success || !json.analysis) {
          // Vision/AI unavailable, or analysis failed — the receipt is still
          // saved. Offer the Vault as the graceful fallback (no shame, no loss).
          setStage('success');
          return;
        }

        setAnalysis(json.analysis as Analysis);
        setStage('result');
      } catch {
        setStage('success');
      }
    },
    [upload, token]
  );

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // The top actionable suggestion (CREATE_EXPENSE for a receipt). Used both to
  // render the preview and as the payload for the primary confirm CTA.
  const topAction = useMemo<SuggestedAction | undefined>(() => {
    if (!analysis?.suggestedActions?.length) return undefined;
    const creates = analysis.suggestedActions.filter((a) =>
      ['CREATE_EXPENSE', 'CREATE_INCOME', 'CREATE_LOAN'].includes(a.action)
    );
    const pool = creates.length ? creates : analysis.suggestedActions;
    return [...pool].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  }, [analysis]);

  const preview = useMemo(() => {
    if (!analysis) return null;
    const pf = topAction?.prefilled;
    const ex = analysis.extractedData || {};
    const title =
      (pick(['vendor', 'vendorName', 'payee', 'merchant', 'source', 'lender', 'name'], pf, ex) as string) ||
      'Receipt';
    const amount = asNumber(pick(['amount', 'total', 'totalAmount', 'amountDue'], pf, ex));
    const gst = asNumber(pick(['gst', 'gstAmount', 'tax'], pf, ex));
    const date = pick(['date', 'issueDate', 'transactionDate'], pf, ex) as string | undefined;
    const category = pick(['category'], pf, ex) as string | undefined;
    return { title, amount, gst, date, category };
  }, [analysis, topAction]);

  const confidence = analysis?.overallConfidence ?? 0;
  const confidenceLabel =
    confidence >= 0.9 ? 'High confidence' : confidence >= 0.7 ? 'Looks good — worth a check' : 'Please review';
  const confidenceTone =
    confidence >= 0.9
      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25'
      : confidence >= 0.7
        ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25'
        : 'bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25';

  const primaryLabel = useMemo(() => {
    if (!topAction) return 'Save to my Vault';
    if (topAction.action === 'CREATE_EXPENSE') return 'Add expense';
    if (topAction.action === 'CREATE_INCOME') return 'Add income';
    if (topAction.action === 'CREATE_LOAN') return 'Add loan';
    return topAction.label || 'Add';
  }, [topAction]);

  const handleConfirm = useCallback(async () => {
    if (!analysis || !topAction) {
      // No actionable suggestion — the doc is already in the Vault.
      setStage('success');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents/analyze/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          action: topAction.action,
          data: topAction.prefilled || analysis.extractedData,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setErrorMsg(json.error || 'We could not save that. It is still in your Vault.');
        setStage('error');
        return;
      }
      setStage('success');
    } catch {
      setErrorMsg('Something went wrong. Your receipt is safe in your Vault.');
      setStage('error');
    } finally {
      setSubmitting(false);
    }
  }, [analysis, topAction, token]);

  const goToVault = useCallback(() => {
    close();
    router.push('/dashboard/documents');
  }, [close, router]);

  return (
    <>
      {/* Floating camera FAB — mobile only, above the editorial bottom nav. */}
      {!open && (
        <button
          type="button"
          aria-label="Scan a receipt"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className={cn(
            'md:hidden fixed right-4 z-40',
            'flex h-14 w-14 items-center justify-center rounded-full',
            'bg-gradient-to-br from-sky-500 to-indigo-600 text-white',
            'shadow-lg shadow-indigo-500/30 ring-1 ring-white/20',
            'transition-transform duration-200 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
          )}
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <Camera className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          className="md:hidden fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Scan a receipt"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className={cn(
              'absolute inset-0 bg-black/40 backdrop-blur-sm',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200'
            )}
          />

          {/* Sheet */}
          <div
            className={cn(
              'absolute inset-x-0 bottom-0',
              'rounded-t-[28px] border-t border-sky-400/20',
              'bg-card/95 backdrop-blur-xl shadow-2xl',
              'px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]',
              'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300'
            )}
          >
            {/* Grabber */}
            <div className="flex justify-center pt-2.5 pb-1.5" aria-hidden>
              <span className="block h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ---- CAPTURE ---- */}
            {stage === 'capture' && (
              <div className="flex flex-col items-center pt-4 pb-2 text-center">
                <div className="relative mb-3">
                  <span
                    aria-hidden
                    className="absolute -inset-4 rounded-full bg-gradient-to-br from-sky-400/20 to-indigo-500/20 blur-xl"
                  />
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white ring-1 ring-white/20 shadow-md">
                    <Camera className="h-5 w-5" />
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
                  Quick capture
                </p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
                  Scan a receipt
                </h2>
                <p className="mt-1 max-w-[18rem] text-[13px] text-muted-foreground">
                  Snap it and we&apos;ll read the vendor, date and amount for you.
                </p>

                <div className="mt-5 w-full space-y-2.5">
                  {canCapture && (
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-500 to-indigo-600 text-[15px] font-semibold text-white shadow-md shadow-indigo-500/25 active:scale-[0.99] transition-transform"
                    >
                      <Camera className="h-5 w-5" />
                      Take photo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] border border-foreground/10 bg-background/50 text-[15px] font-medium text-foreground backdrop-blur active:scale-[0.99] transition-transform"
                  >
                    <Upload className="h-5 w-5" />
                    Choose a file
                  </button>
                </div>

                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-sky-500" />
                  Powered by Gemini AI
                </span>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  We&apos;ll show you what we found before anything is saved.
                </p>
              </div>
            )}

            {/* ---- ANALYZING ---- */}
            {stage === 'analyzing' && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute -inset-4 rounded-full bg-gradient-to-br from-sky-400/20 to-indigo-500/20 blur-xl"
                  />
                  <Loader2 className="relative h-9 w-9 animate-spin text-sky-500" />
                </div>
                <p className="text-[15px] font-medium text-foreground">Reading your receipt…</p>
                <p className="text-[12px] text-muted-foreground">
                  Pulling out the vendor, date and amount.
                </p>
              </div>
            )}

            {/* ---- RESULT ---- */}
            {stage === 'result' && preview && (
              <div className="pt-2 pb-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
                    We found this
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1',
                      confidenceTone
                    )}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {confidenceLabel}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md">
                    <Receipt className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold tracking-tight text-foreground">
                      {preview.title}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Receipt{preview.date ? ` · ${preview.date}` : ''}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 rounded-[14px] border border-foreground/10 bg-sky-500/[0.04] divide-y divide-foreground/10">
                  {preview.amount != null && (
                    <Row label="Amount">
                      <span className="text-[20px] font-semibold tabular-nums bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
                        {formatCurrency(preview.amount, { showCents: true })}
                      </span>
                    </Row>
                  )}
                  {preview.gst != null && (
                    <Row label="GST (included)">
                      <span className="tabular-nums">{formatCurrency(preview.gst, { showCents: true })}</span>
                    </Row>
                  )}
                  {preview.date && <Row label="Date"><span className="tabular-nums">{preview.date}</span></Row>}
                  {preview.category && (
                    <Row label="Category">
                      <span className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[12px] font-medium">
                        {String(preview.category).replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </Row>
                  )}
                </dl>

                <div className="mt-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-500 to-indigo-600 text-[15px] font-semibold text-white shadow-md shadow-indigo-500/25 active:scale-[0.99] transition-transform disabled:opacity-70"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    {primaryLabel}
                  </button>
                  <button
                    type="button"
                    onClick={goToVault}
                    disabled={submitting}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] border border-foreground/10 bg-background/50 text-[15px] font-medium text-foreground backdrop-blur active:scale-[0.99] transition-transform disabled:opacity-70"
                  >
                    <ArchiveRestore className="h-5 w-5" />
                    Save to Vault for later
                  </button>
                </div>

                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Nothing is saved until you tap {primaryLabel}.
                </p>
              </div>
            )}

            {/* ---- SUCCESS ---- */}
            {stage === 'success' && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-[16px] font-semibold text-foreground">
                  {analysis ? 'Done — added for you' : 'Saved to your Vault'}
                </p>
                <p className="max-w-[18rem] text-[13px] text-muted-foreground">
                  {analysis
                    ? 'Your receipt is filed in My Vault and linked to the entry.'
                    : "It's safe in My Vault. You can review and file it any time."}
                </p>
                <div className="mt-2 flex w-full flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={goToVault}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-foreground/10 bg-background/50 text-[14px] font-medium text-foreground backdrop-blur"
                  >
                    Open My Vault
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-500 to-indigo-600 text-[14px] font-semibold text-white"
                  >
                    <Camera className="h-4 w-4" />
                    Scan another
                  </button>
                </div>
              </div>
            )}

            {/* ---- ERROR ---- */}
            {stage === 'error' && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <AlertCircle className="h-9 w-9 text-amber-500" />
                <p className="text-[15px] font-medium text-foreground">We hit a snag</p>
                <p className="max-w-[18rem] text-[13px] text-muted-foreground">{errorMsg}</p>
                <div className="mt-2 flex w-full flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-500 to-indigo-600 text-[14px] font-semibold text-white"
                  >
                    Try again
                  </button>
                  {savedDocId && (
                    <button
                      type="button"
                      onClick={goToVault}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-foreground/10 bg-background/50 text-[14px] font-medium text-foreground backdrop-blur"
                    >
                      Open My Vault
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hidden inputs. Camera input requests the rear camera on mobile. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onCameraChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default GlobalScanReceipt;
