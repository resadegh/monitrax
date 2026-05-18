'use client';

/**
 * Phase 33 / Tech Debt #19 — Admin "Create Feature Flag" modal.
 *
 * Discovered 2026-05-17: the `+Create Flag` button in
 * `app/admin/feature-flags/page.tsx` toggled `showModal` state but
 * no modal was actually rendered. Auto-seed via `vercel-build`
 * (PR #780, 2026-05-17) covers the canonical case (flag rows from
 * `prisma/seed-feature-flags.ts` auto-appear on every deploy);
 * this modal is the escape hatch for ad-hoc operator-created flags.
 *
 * Posts to existing `POST /api/admin/feature-flags` (already shipped).
 * Validates key format `^[A-Z][A-Z0-9_]*$` client-side; server
 * re-validates + checks uniqueness.
 */

import { useState, useEffect } from 'react';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Input } from '@/components/admin/ui/AdminForm';

interface CreateFlagModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create — parent should refetch the flag list. */
  onCreated: () => void;
}

interface CreateFlagFormState {
  key: string;
  name: string;
  description: string;
}

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const KEY_HELP = 'UPPER_SNAKE_CASE — letters, digits, underscores. Must start with a letter.';

export function CreateFlagModal({ open, onClose, onCreated }: CreateFlagModalProps) {
  const [form, setForm] = useState<CreateFlagFormState>({ key: '', name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the modal re-opens.
  useEffect(() => {
    if (open) {
      setForm({ key: '', name: '', description: '' });
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // ESC-to-close + click-outside-to-close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const keyValid = form.key.length === 0 || KEY_PATTERN.test(form.key);
  const canSubmit =
    !submitting &&
    form.key.length > 0 &&
    form.name.length > 0 &&
    KEY_PATTERN.test(form.key);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          enabled: false, // default OFF — operator flips after creation
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.error?.message ||
          (res.status === 400 ? 'Invalid input or flag key already exists.' : `Server error (${res.status})`);
        setError(msg);
        setSubmitting(false);
        return;
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error('Create flag error:', err);
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-flag-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 p-5"
      >
        <h2 id="create-flag-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Create feature flag
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          For canonical flags use `prisma/seed-feature-flags.ts` instead — auto-deployed and re-runnable. This modal is the
          escape hatch for ad-hoc flags.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="flag-key" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Key (required)
            </label>
            <Input
              id="flag-key"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })}
              placeholder="MY_NEW_FEATURE"
              aria-invalid={!keyValid}
            />
            {form.key.length > 0 && !keyValid && (
              <p className="mt-1 text-xs text-rose-600">Key must match {KEY_HELP}</p>
            )}
            {form.key.length === 0 && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{KEY_HELP}</p>
            )}
          </div>

          <div>
            <label htmlFor="flag-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Display name (required)
            </label>
            <Input
              id="flag-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My new feature"
            />
          </div>

          <div>
            <label htmlFor="flag-description" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description (optional)
            </label>
            <textarea
              id="flag-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this flag controls + why it exists."
              rows={3}
              className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-900">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <AdminButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create flag'}
          </AdminButton>
        </div>

        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
          New flag created with <code>enabled: false</code>. Toggle in the list after creation.
        </p>
      </form>
    </div>
  );
}
