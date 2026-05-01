'use client';

/**
 * Phase 38 PR 3 — "Send to accountant" modal.
 *
 * Wraps the existing /api/documents/export endpoint (for direct ZIP
 * download) and the new /api/share endpoint (for shareable link).
 * Designed as a generic Share Pass UI so future content types
 * (Reports, property summaries, net-worth statements) reuse the same
 * shell — only the content-selection block changes.
 *
 * Reza directives (2026-05-01):
 *   • Default expiry 30 days
 *   • Recipient page: minimal share-only aesthetic (no app shell)
 *   • Option C now (LINK / DOWNLOAD), Option E (Xero/MYOB) future
 *
 * No new design tokens — extends Phase 37 / 38 PR 1 grammar
 * (glassmorphic surfaces, Apple typography, framer-motion).
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Link as LinkIcon,
  Download,
  Copy,
  Check,
  Shield,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';

const APPLE_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type Purpose =
  | 'TAX_RETURN'
  | 'LOAN_APPLICATION'
  | 'INSURANCE_CLAIM'
  | 'ADVISER_REVIEW'
  | 'OTHER';

type ExportStructure = 'financial-year-first' | 'entity-first' | 'category-first';

interface SendToAccountantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All documents in the user's vault — the modal filters by FY locally. */
  documentIds: string[];
  /** Optional human-readable summary, e.g. "FY 2024–25 documents". */
  contentLabel?: string;
}

interface CreatedShareInfo {
  id: string;
  shareUrl: string;
  expiresAt: string; // ISO
}

const PURPOSE_OPTIONS: { value: Purpose; label: string }[] = [
  { value: 'TAX_RETURN', label: 'Tax return' },
  { value: 'LOAN_APPLICATION', label: 'Loan application' },
  { value: 'INSURANCE_CLAIM', label: 'Insurance claim' },
  { value: 'ADVISER_REVIEW', label: 'Adviser review' },
  { value: 'OTHER', label: 'Other' },
];

const EXPIRY_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days (recommended)' },
  { value: 90, label: '90 days' },
];

export function SendToAccountantDialog({
  open,
  onOpenChange,
  documentIds,
  contentLabel,
}: SendToAccountantDialogProps) {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('TAX_RETURN');
  const [structure, setStructure] = useState<ExportStructure>('financial-year-first');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);

  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedShareInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const docCount = documentIds.length;
  const hasContent = docCount > 0;

  const expiresLabel = useMemo(() => {
    if (!created) return null;
    return new Date(created.expiresAt).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [created]);

  const reset = () => {
    setCreated(null);
    setError(null);
    setCopied(false);
  };

  const handleCreateLink = async () => {
    if (!hasContent || !token) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType: 'DOCUMENT_BUNDLE',
          documentIds,
          structure,
          purpose,
          expiresInDays,
          recipientName: recipientName.trim() || undefined,
          recipientEmail: recipientEmail.trim() || undefined,
          contentLabel,
          deliveryMethod: 'LINK',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to create share');
      }
      setCreated({ id: data.id, shareUrl: data.shareUrl, expiresAt: data.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create share');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!hasContent || !token) return;
    setDownloading(true);
    setError(null);
    try {
      // Reuses the EXISTING /api/documents/export endpoint — same engine
      // the toolbar dropdown already calls. Triggers a browser download
      // for the owner without creating a public share row.
      const res = await fetch('/api/documents/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentIds, structure }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitrax-documents.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail in some browsers/contexts — fall back
      // to manual selection by focusing the input.
      const input = document.getElementById('share-link-input') as HTMLInputElement | null;
      input?.select();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl tracking-[-0.01em]">
            <Send className="h-5 w-5 text-primary" />
            Send to your accountant
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {hasContent
              ? `Share ${docCount} document${docCount === 1 ? '' : 's'} via a secure link or download a ZIP.`
              : 'Select documents in the folder view first, then come back here.'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          {!created ? (
            <motion.div
              key="form"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.35, ease: APPLE_EASE }}
              className="space-y-5 pt-2"
            >
              {/* Purpose */}
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                  Purpose
                </Label>
                <Select value={purpose} onValueChange={(v) => setPurpose(v as Purpose)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="recipient-name"
                    className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80"
                  >
                    Recipient name <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
                  </Label>
                  <Input
                    id="recipient-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Mark from BDO"
                    className="h-10"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="recipient-email"
                    className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80"
                  >
                    Email <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
                  </Label>
                  <Input
                    id="recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="mark@bdo.com.au"
                    className="h-10"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Expiry + Structure */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                    Access expires in
                  </Label>
                  <Select
                    value={String(expiresInDays)}
                    onValueChange={(v) => setExpiresInDays(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                    Folder layout
                  </Label>
                  <Select
                    value={structure}
                    onValueChange={(v) => setStructure(v as ExportStructure)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="financial-year-first">By financial year</SelectItem>
                      <SelectItem value="entity-first">By entity</SelectItem>
                      <SelectItem value="category-first">By category</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 font-medium"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Audit-logged
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-0 font-medium"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Watermarked
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-background/60 border border-border/50 font-medium"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Revocable any time
                </Badge>
              </div>

              {error && (
                <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadZip}
                  disabled={!hasContent || downloading || creating}
                  className="flex-1 h-10"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download ZIP
                </Button>
                <Button
                  onClick={handleCreateLink}
                  disabled={!hasContent || creating || downloading}
                  className="flex-1 h-10 bg-primary hover:bg-primary/90"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4 mr-2" />
                  )}
                  Generate secure link
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.35, ease: APPLE_EASE }}
              className="space-y-5 pt-2"
            >
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium tracking-[-0.01em]">
                    Link ready
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Copy and send to your accountant.
                  {expiresLabel ? ` Expires ${expiresLabel}.` : ''}
                </p>
                <div className="flex gap-2">
                  <Input
                    id="share-link-input"
                    readOnly
                    value={created.shareUrl}
                    className="font-mono text-xs h-9"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button onClick={handleCopy} variant="outline" size="sm" className="h-9 shrink-0">
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                You can revoke this link any time from{' '}
                <span className="font-medium">Settings → Shares</span>. Every view is
                audit-logged.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    reset();
                  }}
                  className="flex-1 h-10"
                >
                  Send another
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-10 bg-primary hover:bg-primary/90"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
