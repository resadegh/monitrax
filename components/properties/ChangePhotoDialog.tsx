'use client';

/**
 * CHANGE BACKGROUND PHOTO DIALOG — Phase 45.2.5 (CLAUDE.md §18.7.4
 * Cremorne pattern, Asset Spotlight detail page).
 *
 * Lets the user upload a custom photo for a property's detail-page hero
 * canvas, or revert to the default Cremorne apartment decor.
 *
 * Stitch source: project 1859462351962811110, screen 5e16be2e04c246f4a269d8c65b32349e
 *   (desktop light) + dark / mobile / mobile-dark siblings at
 *   .stitch/designs/phase45.2.5/change-photo-dialog{,-dark,-mobile,-mobile-dark}-v1.{html,png}.
 *
 * Composition (§18.7.2):
 *   - Backdrop: foreground/40 light + black/60 dark, with backdrop-blur so
 *     the underlying Asset Spotlight page is visible but de-emphasised.
 *   - Dialog: bg-card backdrop-blur-xl + 1px hairline + three-tier shadow
 *     + 1px inner-top white highlight + 3px sky→indigo top-accent strip
 *     (matches the Properties sub-palette).
 *   - Desktop: centred 640×~580 modal with rounded-[24px] corners.
 *   - Mobile: docks as a bottom sheet (top-only rounded-[28px], grab handle)
 *     with stacked full-width CTAs (touch-target priority — primary above
 *     secondary).
 *
 * Behaviour:
 *   - File picker (click to browse + drag-and-drop). MIME + size validated
 *     client-side BEFORE the POST goes out, with the same error copy the
 *     API returns for parity.
 *   - On success: parent re-fetches the property + the hero-image endpoint.
 *   - "Reset to default" link visible only when the property already has a
 *     custom photo (DELETE call → fallback decor on reload).
 *
 * Behaviour-psychology lens (§0): the copy never shames ("Upload your
 * photo" → "Drag a photo here, or click to browse"), the empty state is
 * the achievable next action, and the reset CTA is named "Reset to default"
 * rather than "Remove" to signal the path is always reversible.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, UploadCloud, X } from 'lucide-react';

interface ChangePhotoDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  token: string | null;
  hasCurrentImage: boolean;
  onSaved: () => void;
}

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ALLOWED_MIMES.includes(file.type)) {
    return 'Unsupported file type. Use JPEG, PNG or WEBP.';
  }
  if (file.size <= 0) return 'Empty file.';
  if (file.size > MAX_BYTES) {
    return `File too large. Maximum size is ${MAX_BYTES / 1024 / 1024}MB.`;
  }
  return null;
}

export default function ChangePhotoDialog({
  open,
  onClose,
  propertyId,
  token,
  hasCurrentImage,
  onSaved,
}: ChangePhotoDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the dialog opens — guarantees a fresh canvas
  // and avoids stale previews lingering between sessions.
  useEffect(() => {
    if (open) {
      setFile(null);
      setPreviewUrl(null);
      setDragOver(false);
      setError(null);
      setSaving(false);
      setResetting(false);
    }
  }, [open]);

  // Manage the preview Blob URL lifecycle — revoke on file swap + unmount
  // to keep the renderer from leaking memory on long sessions.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escape-key dismissal — modal-standard a11y. Click-outside is handled
  // by the backdrop element below.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !resetting) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, saving, resetting]);

  const handleFile = useCallback((picked: File | null) => {
    if (!picked) return;
    const err = validateFile(picked);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(picked);
  }, []);

  const handleSave = useCallback(async () => {
    if (!file || !token) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`/api/properties/${propertyId}/hero-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setError(body?.error ?? 'Upload failed. Please try again.');
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Upload failed. Please check your connection and try again.');
      setSaving(false);
    }
  }, [file, token, propertyId, onSaved, onClose]);

  const handleReset = useCallback(async () => {
    if (!token) return;
    setResetting(true);
    setError(null);
    try {
      const r = await fetch(`/api/properties/${propertyId}/hero-image`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setError(body?.error ?? 'Reset failed. Please try again.');
        setResetting(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Reset failed. Please check your connection and try again.');
      setResetting(false);
    }
  }, [token, propertyId, onSaved, onClose]);

  if (!open) return null;

  const busy = saving || resetting;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop — click to dismiss */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={busy ? undefined : onClose}
        disabled={busy}
        className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-[8px] dark:bg-black/60"
      />

      {/* Dialog / bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-photo-title"
        className="
          relative w-full max-w-[640px]
          overflow-hidden border border-foreground/10 bg-card/85 backdrop-blur-2xl
          shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_64px_rgba(15,23,42,0.14)]
          dark:border-foreground/20
          dark:shadow-[0_2px_4px_rgba(0,0,0,0.40),inset_0_1px_0_0_rgba(255,255,255,0.04)]
          rounded-t-[28px] sm:rounded-[24px]
          mx-0 sm:mx-4
          max-h-[90vh] overflow-y-auto
        "
      >
        {/* Mobile-only grab handle */}
        <div aria-hidden className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-foreground/15" />
        </div>

        {/* 3px sky→indigo top-accent strip */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500 sm:rounded-t-[24px]"
        />
        {/* 1px inner-top white highlight — the curved-glass cue */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
        />

        <div className="relative p-5 sm:p-8">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30">
                <Camera className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-[11px] font-bold uppercase tracking-[0.16em] text-transparent">
                  Property hero
                </p>
                <h2
                  id="change-photo-title"
                  className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
                >
                  Change background photo
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Your apartment&rsquo;s lived reality on its detail page.
          </p>

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragOver) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) handleFile(dropped);
            }}
            disabled={busy}
            className={`
              mt-6 flex w-full flex-col items-center justify-center gap-3
              rounded-[18px] border-[1.5px] border-dashed
              px-5 py-9 text-center transition-all
              sm:py-12
              ${
                dragOver
                  ? 'border-sky-500 bg-sky-500/10 scale-[1.005]'
                  : 'border-sky-500/40 bg-sky-50/30 dark:bg-sky-500/[0.06]'
              }
              hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-500/[0.08]
              disabled:opacity-60
            `}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-44 w-full rounded-[14px] object-cover sm:max-h-56"
              />
            ) : (
              <UploadCloud
                className="h-10 w-10 text-sky-500 dark:text-sky-300 sm:h-12 sm:w-12"
                strokeWidth={1.5}
              />
            )}
            <p className="text-sm text-foreground">
              {file ? file.name : (
                <>
                  <span className="hidden sm:inline">Drag a photo here, or click to browse</span>
                  <span className="sm:hidden">Tap to choose a photo, or drag from Files</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WEBP &middot; Max 5MB
              <span className="hidden sm:inline"> &middot; 16:9 landscape works best</span>
            </p>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIMES.join(',')}
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300"
            >
              {error}
            </p>
          )}

          {/* Reset link — only when a custom photo is already on the property */}
          {hasCurrentImage && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="text-xs font-semibold text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-300"
              >
                {resetting ? 'Resetting…' : 'Reset to default'}
              </button>
            </div>
          )}

          {/* Footer divider + CTAs */}
          <div className="mt-7 border-t border-foreground/8 pt-5 dark:border-foreground/15">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50 sm:h-10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!file || busy}
                className="
                  inline-flex h-11 items-center justify-center rounded-xl px-5
                  bg-gradient-to-r from-sky-500 to-indigo-600 text-sm font-semibold text-white
                  shadow-md shadow-sky-500/30
                  transition-all hover:shadow-lg hover:shadow-sky-500/40
                  disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none
                  sm:h-10
                "
              >
                {saving ? 'Saving…' : 'Save photo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
