'use client';

/**
 * DocumentUploadAccelerator — Phase 12 Track G.5
 *
 * The optional "upload a document" accelerator on the Income & Expenses
 * step. The user drops in a payslip or a bill/receipt; the existing
 * Phase 26.6 endpoint `/api/documents/analyze-for-form` OCRs it and
 * returns field mappings, and `mapDocumentToIncome` /
 * `mapDocumentToExpense` turn that into a single pre-filled wizard row.
 *
 * Design rules (docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §6 G.5):
 *   - The FORM stays the system of record. The accelerator only ever
 *     APPENDS one pre-filled row — it never replaces or deletes. A bad
 *     extraction is non-destructive: at worst the user deletes the row.
 *   - Collapsed by default — an unobtrusive one-line affordance. The
 *     wizard works identically with it ignored.
 *   - Every failure path is gentle + the form below is untouched.
 *
 * Shown only on the `income-expenses` step (`isDocumentUploadStep`).
 * Reuses the canonical document-analysis engine — no new endpoint.
 */

import React, { useRef, useState } from 'react';
import { FileUp, Loader2, ChevronDown, Check, UploadCloud } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { MAX_FILE_SIZE } from '@/lib/documents/constants';
import { WizardData, WizardStepId } from './types';
import {
  mapDocumentToExpense,
  mapDocumentToIncome,
  type DocumentFieldMappings,
  type DocumentFormType,
} from '@/lib/onboarding/mapDocumentFields';

/** True when the document-upload accelerator should be offered on a step. */
export function isDocumentUploadStep(step: WizardStepId): boolean {
  return step === 'income-expenses';
}

// Mirrors the server's accepted set (lib/documents/types.ts) — only the
// formats the analyze-for-form route can actually OCR / text-extract.
const ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
// MON-193: THE shared limit (lib/documents/constants) — never a local mirror.
const MAX_BYTES = MAX_FILE_SIZE;
const MAX_MB = Math.round(MAX_FILE_SIZE / 1024 / 1024);

const DOC_TYPES: { id: DocumentFormType; label: string }[] = [
  { id: 'income', label: 'Payslip' },
  { id: 'expense', label: 'Bill or receipt' },
];

interface DocumentUploadAcceleratorProps {
  step: WizardStepId;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function DocumentUploadAccelerator({
  step,
  data,
  onUpdate,
}: DocumentUploadAcceleratorProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<DocumentFormType>('income');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isDocumentUploadStep(step)) return null;

  const handleFile = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setError(null);
    setResult(null);

    if (file.size > MAX_BYTES) {
      setError(`That file is over ${MAX_MB} MB — try a smaller scan or photo.`);
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('formType', docType);

      const res = await fetch('/api/documents/analyze-for-form', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        fieldMappings?: DocumentFieldMappings;
        error?: string;
      } | null;

      if (!res.ok || !json?.success || !json.fieldMappings) {
        setError(
          json?.error ||
            'Could not read that document — try a clearer photo, or just fill the form below.',
        );
        return;
      }

      const fields = json.fieldMappings;
      if (Object.keys(fields).length === 0) {
        setError(
          'I could not find anything to add — try a clearer scan, or fill the form below.',
        );
        return;
      }

      if (docType === 'income') {
        onUpdate({ income: [...data.income, mapDocumentToIncome(fields)] });
        setResult(
          'Added an income row below — please review the amount and frequency.',
        );
      } else {
        onUpdate({ expenses: [...data.expenses, mapDocumentToExpense(fields)] });
        setResult(
          'Added an expense row below — please review the amount and frequency.',
        );
      }
    } catch {
      setError('Something went wrong — the form below still works as normal.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/60 dark:border-slate-700/50 dark:bg-slate-900/40">
      {/* Collapsed trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        aria-expanded={open}
      >
        <FileUp className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
        <span className="flex-1">
          Have a payslip or bill handy? Upload it and I will fill the form.
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded uploader */}
      {open && (
        <div className="border-t border-slate-200/70 px-3.5 py-3 dark:border-slate-700/50">
          {/* Document-type toggle */}
          <div
            role="radiogroup"
            aria-label="Document type"
            className="mb-3 flex gap-1.5"
          >
            {DOC_TYPES.map((d) => {
              const active = docType === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setDocType(d.id);
                    setResult(null);
                    setError(null);
                  }}
                  disabled={busy}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Dropzone */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-5 text-center transition-colors ${
              dragOver
                ? 'border-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/20'
                : 'border-slate-300 bg-white/70 hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-800/50'
            } ${busy ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={(e) => void handleFile(e.target.files?.[0])}
              className="sr-only"
            />
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Reading your document…
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="h-5 w-5 text-indigo-500" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Drop a file here, or click to choose
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  PDF or photo, up to {MAX_MB} MB ·{' '}
                  {docType === 'income'
                    ? 'becomes an income row'
                    : 'becomes an expense row'}
                </span>
              </>
            )}
          </label>

          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            I will pre-fill one row — you stay in control and can edit anything.
          </p>

          {result && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
              <Check className="mt-0.5 h-3 w-3 flex-shrink-0" strokeWidth={3} />
              <span>{result}</span>
            </div>
          )}
          {error && (
            <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentUploadAccelerator;
