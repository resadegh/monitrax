'use client';

/**
 * AddReminderDialog — create a custom reminder (Phase 21.5 R1 PR2b).
 *
 * Presentational + form-only. Persistence goes through the shared
 * `useReminders().createCustom` (passed in as `onCreate`) — this dialog never
 * talks to the API directly (CLAUDE.md §12.3). On success it confirms the saved
 * date inline, so a far-future reminder (which won't appear in the "coming up"
 * feed until it nears its window) still gives the user clear feedback that it
 * saved — behaviour-psychology §0: never leave the user wondering.
 *
 * Launched from `<NotificationBell>` ("+ New reminder").
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2 } from 'lucide-react';
import type { CustomReminderInput } from '@/hooks/useReminders';

export interface AddReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CustomReminderInput) => Promise<boolean>;
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function AddReminderDialog({ open, onOpenChange, onCreate }: AddReminderDialogProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDueDate('');
    setNote('');
    setError(null);
    setSaving(false);
    setSavedFor(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError('Add a title and a date.');
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await onCreate({ title: title.trim(), dueDate, note: note.trim() || undefined });
    setSaving(false);
    if (ok) {
      setSavedFor(dueDate);
    } else {
      setError('Could not save the reminder. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New reminder</DialogTitle>
          <DialogDescription>
            We&apos;ll surface it in your reminders as the date approaches.
          </DialogDescription>
        </DialogHeader>

        {savedFor ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">Reminder set</p>
              <p className="mt-1 text-xs text-muted-foreground">for {formatDate(savedFor)}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => reset()}>
                Add another
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reminder-title">What&apos;s the reminder?</Label>
              <Input
                id="reminder-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Call the accountant about FY26"
                maxLength={120}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-date">Date</Label>
              <Input
                id="reminder-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-note">Note (optional)</Label>
              <Textarea
                id="reminder-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything you want to remember"
                maxLength={500}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Set reminder'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
