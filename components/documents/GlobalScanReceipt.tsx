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
 *   - result + "What is this for?" selector band (asset/property attribution):
 *                    `20c36c03c45c41ceaa6e3d070c40ba60`
 *                    (§18.2.1 backfill — artefact `.stitch/designs/scan-link-asset/`)
 *   Artefacts: `.stitch/designs/phase49-scan-receipt/`.
 *
 * "What is this for?" (2026-06-17): the result screen lets the user attach the
 * scanned receipt to one of their assets/properties. On confirm it (a) creates
 * the expense with the chosen assetId/propertyId and (b) links the saved
 * document to that entity via POST /api/documents/[id]/link, so both file under
 * the item instead of generic Expenses. Default stays "Just an expense".
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
  Car,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/formatters';
import { classifyConfidence } from '@/lib/documents/intelligence/confidencePolicy';
import { RenewalReminderCard } from '@/components/documents/RenewalReminderCard';

type Stage = 'capture' | 'analyzing' | 'result' | 'renewal' | 'success' | 'error';

interface FieldMapping {
  value: unknown;
  confidence: number;
  source?: string;
}

interface Recognition {
  documentId?: string;
  documentType?: string;
  // Flattened {field: value} for the preview + the expense payload.
  values: Record<string, unknown>;
  overallConfidence: number;
}

/** An asset or property the scanned receipt can be attached to. */
interface LinkTarget {
  type: 'ASSET' | 'PROPERTY';
  id: string;
  name: string;
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

/** D.5a — a usable ISO `YYYY-MM-DD` the AI returned for a renewal/expiry date. */
function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function GlobalScanReceipt() {
  const router = useRouter();
  const { token } = useAuth();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('capture');
  const [canCapture, setCanCapture] = useState(false);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // "What is this for?" — link the receipt (expense + document) to an asset or
  // property so it files under that item instead of generic Expenses.
  const [linkTargets, setLinkTargets] = useState<LinkTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<LinkTarget | null>(null);
  // D.4 learned routing (suggest-only): when the AI recognises a vendor we've
  // filed before, we PRE-SELECT the entity the user usually picks. `suggested`
  // marks it so the UI can show a quiet "Suggested" cue. The user always
  // confirms and can change the selection — this is a hint, never an auto-apply.
  const [suggestedTargetId, setSuggestedTargetId] = useState<string | null>(null);

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

  // Load the user's assets + properties once the sheet opens, so the result
  // screen can offer "What is this for?". Non-fatal: if it fails, the selector
  // simply shows only "Just an expense" (today's behaviour).
  useEffect(() => {
    if (!open || !token) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/documents/entities', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          assets?: { id: string; name: string }[];
          properties?: { id: string; name: string }[];
        };
        if (!active) return;
        const assets: LinkTarget[] = (data.assets ?? []).map((a) => ({
          type: 'ASSET',
          id: a.id,
          name: a.name,
        }));
        const properties: LinkTarget[] = (data.properties ?? []).map((p) => ({
          type: 'PROPERTY',
          id: p.id,
          name: p.name,
        }));
        setLinkTargets([...assets, ...properties]);
      } catch {
        /* non-fatal — the selector falls back to "Just an expense" only */
      }
    })();
    return () => {
      active = false;
    };
  }, [open, token]);

  // D.4 — once we have a recognised vendor AND the user's link targets loaded,
  // ask the learned-routing service which entity they usually pick for this
  // vendor and PRE-SELECT it (suggest-only — the confirm button + the pills
  // still let them change or clear it). No-op when there's no memory.
  useEffect(() => {
    if (stage !== 'result' || !recognition || !token || linkTargets.length === 0) return;
    const vendor = pick(
      ['vendor', 'vendorName', 'payee', 'merchant', 'name'],
      undefined,
      recognition.values
    );
    if (typeof vendor !== 'string' || !vendor.trim()) return;

    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/documents/vendor-hint?vendor=${encodeURIComponent(vendor)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          hint?: { entityType: string; entityId: string } | null;
        };
        if (!active || !data.hint) return;
        const match = linkTargets.find(
          (t) => t.type === data.hint!.entityType && t.id === data.hint!.entityId
        );
        if (!match) return;
        setSuggestedTargetId(match.id);
        // Pre-select only if the user hasn't already picked something.
        setSelectedTarget((current) => current ?? match);
      } catch {
        /* non-fatal — no suggestion, the selector just defaults to "Just an expense" */
      }
    })();
    return () => {
      active = false;
    };
  }, [stage, recognition, token, linkTargets]);

  const reset = useCallback(() => {
    setStage('capture');
    setRecognition(null);
    setSavedDocId(null);
    setErrorMsg(null);
    setSubmitting(false);
    setSelectedTarget(null);
    setSuggestedTargetId(null);
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

      // Recognise + store in ONE call via the proven form-autofill path
      // (`/api/documents/analyze-for-form`). This endpoint OCRs the in-hand
      // upload directly (Vision) + maps to expense fields with Gemini, then
      // files the document in My Vault as a RECEIPT. We use it here instead of
      // the upload→/analyze two-step because the latter 500s in prod when it
      // re-reads the stored file (Phase A fix — see CHANGELOG 2026-06-16).
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('formType', 'expense');

        const res = await fetch('/api/documents/analyze-for-form', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await res.json();

        if (json?.documentId) setSavedDocId(json.documentId as string);

        if (!res.ok || !json?.success || !json?.fieldMappings) {
          // Recognition didn't return usable fields — but the document is
          // typically still saved to the Vault. Degrade gracefully (no loss).
          setStage('success');
          return;
        }

        // Flatten {field: {value, confidence}} → {field: value} + overall confidence.
        const fm = json.fieldMappings as Record<string, FieldMapping>;
        const values: Record<string, unknown> = {};
        for (const [k, m] of Object.entries(fm)) values[k] = m?.value;

        const keyConf = ['vendor', 'amount', 'date']
          .map((k) => fm[k]?.confidence)
          .filter((c): c is number => typeof c === 'number');
        const overallConfidence = keyConf.length
          ? keyConf.reduce((a, b) => a + b, 0) / keyConf.length
          : 0.6;

        setRecognition({
          documentId: json.documentId as string | undefined,
          documentType: json.documentType as string | undefined,
          values,
          overallConfidence,
        });
        setStage('result');
      } catch {
        setStage('error');
        setErrorMsg('Something went wrong reading that. Please try again.');
      }
    },
    [token]
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

  const preview = useMemo(() => {
    if (!recognition) return null;
    const v = recognition.values;
    const title =
      (pick(['vendor', 'vendorName', 'payee', 'merchant', 'name'], undefined, v) as string) || 'Receipt';
    const amount = asNumber(pick(['amount', 'total', 'totalAmount', 'amountDue'], undefined, v));
    const gst = asNumber(pick(['gst', 'gstAmount', 'tax'], undefined, v));
    const date = pick(['date', 'issueDate', 'transactionDate'], undefined, v) as string | undefined;
    const category = pick(['category'], undefined, v) as string | undefined;
    // D.5a — a renewal/expiry date the AI found on a policy/registration/warranty
    // (distinct from the document `date`). Drives the RenewalReminderCard.
    const renewalDate = pick(
      ['expiryDate', 'policyEnd', 'renewalDate', 'expiry'],
      undefined,
      v
    ) as string | undefined;
    return { title, amount, gst, date, category, renewalDate };
  }, [recognition]);

  const confidence = recognition?.overallConfidence ?? 0;
  // D.3: confidence band + label come from the single confidencePolicy SSOT.
  const confidenceVerdict = classifyConfidence(confidence);
  const confidenceLabel = confidenceVerdict.label;
  const confidenceTone =
    confidenceVerdict.tone === 'emerald'
      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25'
      : confidenceVerdict.tone === 'amber'
        ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25'
        : 'bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25';

  const primaryLabel = 'Add expense';

  const handleConfirm = useCallback(async () => {
    if (!recognition || !preview) {
      setStage('success');
      return;
    }
    setSubmitting(true);
    try {
      // Create the expense from the recognised fields. Frequency defaults to
      // MONTHLY (the engine's existing receipt convention — tracked as the
      // Q-SCAN-FREQ open question). Phase B replaces this with the
      // attach-to-existing-item / transaction-match flow.
      const v = recognition.values;
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: preview.title,
          vendorName: preview.title,
          amount: preview.amount ?? 0,
          frequency: 'MONTHLY',
          category: typeof v.category === 'string' ? v.category : 'OTHER',
          isTaxDeductible: v.taxDeductible === true,
          sourceType: 'GENERAL',
          // Attach the expense to the chosen asset/property (the API accepts
          // assetId/propertyId and validates ownership).
          ...(selectedTarget?.type === 'ASSET' ? { assetId: selectedTarget.id } : {}),
          ...(selectedTarget?.type === 'PROPERTY' ? { propertyId: selectedTarget.id } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) {
        setErrorMsg(json?.error || 'We could not add that. It is still in your Vault.');
        setStage('error');
        return;
      }

      // File the scanned document under the chosen asset/property too, so it
      // lands in that item's Vault folder rather than generic Expenses.
      // Best-effort: the expense already saved, so a link failure shouldn't
      // block the success state (the doc is still safe in the Vault).
      if (selectedTarget && savedDocId) {
        try {
          await fetch(`/api/documents/${savedDocId}/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ entityType: selectedTarget.type, entityId: selectedTarget.id }),
          });
        } catch {
          /* non-fatal — expense is linked; the doc just stays in its folder */
        }
      }
      // D.5a — if the AI also found a renewal/expiry date (policy/rego/warranty),
      // offer a reminder before finishing. Otherwise we're done.
      setStage(isIsoDate(preview.renewalDate) ? 'renewal' : 'success');
    } catch {
      setErrorMsg('Something went wrong. Your receipt is safe in your Vault.');
      setStage('error');
    } finally {
      setSubmitting(false);
    }
  }, [recognition, preview, token, selectedTarget, savedDocId]);

  // D.5a — create a custom reminder from the (possibly user-edited) renewal
  // date. CREATE-only via the existing /api/reminders/custom endpoint — no
  // existing row is mutated (§12.11-safe). The reminder engine surfaces it.
  const handleSetReminder = useCallback(
    async (dateISO: string) => {
      if (!isIsoDate(dateISO)) {
        setStage('success');
        return;
      }
      setSubmitting(true);
      try {
        const subject = preview?.title || 'Policy';
        const title = selectedTarget
          ? `${selectedTarget.name} — renewal`.slice(0, 120)
          : `${subject} renewal`.slice(0, 120);
        await fetch('/api/reminders/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title,
            dueDate: new Date(`${dateISO}T00:00:00`).toISOString(),
            note: `Spotted on a scanned document${subject ? ` (${subject})` : ''}.`.slice(0, 500),
          }),
        });
      } catch {
        /* non-fatal — the document is safe; the user can add a reminder manually */
      } finally {
        setSubmitting(false);
        setStage('success');
      }
    },
    [preview, selectedTarget, token]
  );

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

                {/* What is this for? — link the receipt to an asset/property so
                    both the expense and the document file under that item. */}
                {linkTargets.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                      What is this for?
                      {suggestedTargetId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-300">
                          <Sparkles className="h-2.5 w-2.5" />
                          Suggested for you
                        </span>
                      )}
                    </p>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <TargetPill
                        active={selectedTarget === null}
                        onClick={() => setSelectedTarget(null)}
                        icon={<Receipt className="h-3.5 w-3.5" />}
                        label="Just an expense"
                      />
                      {linkTargets.map((t) => (
                        <TargetPill
                          key={`${t.type}-${t.id}`}
                          active={selectedTarget?.type === t.type && selectedTarget?.id === t.id}
                          suggested={suggestedTargetId === t.id}
                          onClick={() => setSelectedTarget(t)}
                          icon={
                            t.type === 'ASSET' ? (
                              <Car className="h-3.5 w-3.5" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5" />
                            )
                          }
                          label={t.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

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

            {/* ---- RENEWAL (D.5a) ---- */}
            {stage === 'renewal' && preview && isIsoDate(preview.renewalDate) && (
              <div className="py-2">
                <RenewalReminderCard
                  renewalDate={preview.renewalDate}
                  subjectLabel={preview.title}
                  entityName={selectedTarget?.name ?? null}
                  submitting={submitting}
                  onConfirm={handleSetReminder}
                  onSkip={() => setStage('success')}
                />
              </div>
            )}

            {/* ---- SUCCESS ---- */}
            {stage === 'success' && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-[16px] font-semibold text-foreground">
                  {recognition ? 'Done — added for you' : 'Saved to your Vault'}
                </p>
                <p className="max-w-[18rem] text-[13px] text-muted-foreground">
                  {recognition
                    ? 'Your receipt is filed in My Vault and the expense is added.'
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

/** Selectable chip for the "What is this for?" row. Selected = sky→indigo
 * brand fill (matches the in-app glass vocabulary); unselected = quiet glass.
 * `suggested` (D.4 learned routing) gives an unselected pill a sky ring so the
 * AI's pre-selection reads as a gentle hint, not a commitment. */
function TargetPill({
  active,
  suggested = false,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  suggested?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
        active
          ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25'
          : suggested
            ? 'border border-sky-400/40 bg-sky-500/[0.06] text-foreground ring-1 ring-sky-400/30 backdrop-blur active:scale-[0.98]'
            : 'border border-foreground/10 bg-background/50 text-foreground backdrop-blur active:scale-[0.98]'
      )}
    >
      {icon}
      <span className="max-w-[10rem] truncate">{label}</span>
    </button>
  );
}

export default GlobalScanReceipt;
