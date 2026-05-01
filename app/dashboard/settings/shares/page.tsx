'use client';

/**
 * Phase 38 PR 3 — Manage Shares page.
 *
 * Lists every SharePackage the user has created, active and inactive.
 * Active shares: shows view counter + revoke button. Inactive shares:
 * shows the reason (revoked / expired) + creation date.
 *
 * All data via existing GET /api/share + DELETE /api/share/:id.
 * Apple-typography to match the rest of Phase 38.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  Copy,
  Check,
  Trash2,
  Eye,
  Send,
  ShieldOff,
  Clock,
  RefreshCw,
} from 'lucide-react';

const APPLE_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface ShareRow {
  id: string;
  token: string;
  shareUrl: string;
  purpose: string;
  contentType: string;
  contentLabel: string | null;
  contentRefs: { documentIds?: string[] } | null;
  deliveryMethod: string;
  recipientName: string | null;
  recipientEmail: string | null;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

const PURPOSE_LABEL: Record<string, string> = {
  TAX_RETURN: 'Tax return',
  LOAN_APPLICATION: 'Loan application',
  INSURANCE_CLAIM: 'Insurance claim',
  ADVISER_REVIEW: 'Adviser review',
  OTHER: 'Other',
};

export default function ManageSharesPage() {
  const { token } = useAuth();
  const reduced = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<ShareRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/share?includeInactive=${includeInactive}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load shares');
      const data = await res.json();
      setShares(Array.isArray(data?.shares) ? data.shares : []);
    } catch (e) {
      console.error('[ManageShares] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [token, includeInactive]);

  useEffect(() => {
    void fetchShares();
  }, [fetchShares]);

  const handleCopy = async (s: ShareRow) => {
    try {
      await navigator.clipboard.writeText(s.shareUrl);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !token) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/share/${revokeTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Revoke failed');
      setRevokeTarget(null);
      await fetchShares();
    } catch (e) {
      console.error('[ManageShares] revoke error', e);
    } finally {
      setRevoking(false);
    }
  };

  const activeCount = shares.filter((s) => s.isActive).length;

  return (
    <>
      <div className="space-y-6">
        {/* Hero — Apple typography */}
        <div className="relative isolate overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-card/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 1.4, ease: APPLE_EASE }}
            style={{
              background:
                'radial-gradient(circle at 18% 0%, rgba(139,92,246,0.06), transparent 60%), radial-gradient(circle at 82% 100%, rgba(16,185,129,0.05), transparent 55%)',
            }}
          />
          <div className="p-6 sm:p-8 md:p-10">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 mb-4">
                  Settings · Shares
                </p>
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.7, ease: APPLE_EASE }
                  }
                  className="text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.04em] tabular-nums leading-none text-foreground"
                >
                  {activeCount}
                  <span className="text-2xl sm:text-3xl text-muted-foreground/60 ml-3 align-baseline">
                    active share{activeCount === 1 ? '' : 's'}
                  </span>
                </motion.div>
                <motion.p
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.6, ease: APPLE_EASE, delay: 0.18 }
                  }
                  className="mt-5 text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-xl"
                >
                  Every link you've issued — copy, revoke, or check who's viewed each one.
                </motion.p>
              </div>
              <Button
                variant="outline"
                onClick={() => fetchShares()}
                disabled={loading}
                className="rounded-xl shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIncludeInactive(false)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              !includeInactive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Active only
          </button>
          <button
            onClick={() => setIncludeInactive(true)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              includeInactive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shares.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <Send className="h-5 w-5" />
            </div>
            <h3 className="text-base font-medium tracking-[-0.01em] mb-1">
              No shares yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              When you send documents to your accountant from My Vault, they'll appear here
              so you can revoke or extend access.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shares.map((s, idx) => {
              const docCount = s.contentRefs?.documentIds?.length ?? 0;
              const expiresDate = new Date(s.expiresAt);
              const expired = !s.revokedAt && expiresDate.getTime() <= Date.now();
              const tone = s.revokedAt
                ? 'rose'
                : expired
                  ? 'amber'
                  : 'emerald';
              const statusLabel = s.revokedAt
                ? 'Revoked'
                : expired
                  ? 'Expired'
                  : 'Active';
              return (
                <motion.li
                  key={s.id}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.4, ease: APPLE_EASE, delay: idx * 0.04 }
                  }
                  className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`border-0 font-medium ${
                            tone === 'emerald'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : tone === 'amber'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {statusLabel}
                        </Badge>
                        <span className="text-sm font-medium tracking-[-0.01em]">
                          {PURPOSE_LABEL[s.purpose] ?? s.purpose}
                        </span>
                        {s.recipientName && (
                          <span className="text-sm text-muted-foreground">
                            · for {s.recipientName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {docCount} document{docCount === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {s.viewCount} view{s.viewCount === 1 ? '' : 's'}
                          {s.lastViewedAt && (
                            <>
                              {' '}
                              ·{' '}
                              {new Date(s.lastViewedAt).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {s.revokedAt ? (
                            <>
                              Revoked{' '}
                              {new Date(s.revokedAt).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </>
                          ) : (
                            <>
                              {expired ? 'Expired' : 'Expires'}{' '}
                              {expiresDate.toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </>
                          )}
                        </span>
                      </div>
                      {s.isActive && (
                        <div className="font-mono text-[11px] text-muted-foreground/80 break-all">
                          {s.shareUrl}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.isActive && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(s)}
                            className="h-9"
                          >
                            {copiedId === s.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 mr-1.5" />
                                Copy link
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRevokeTarget(s)}
                            className="h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-rose-500" />
              Revoke this share?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              The link will stop working immediately. Anyone holding it will see a
              "no longer active" message instead of your documents.
              {revokeTarget?.viewCount ? (
                <span className="block mt-2 text-amber-700 dark:text-amber-400">
                  Note: this share has been viewed {revokeTarget.viewCount} time
                  {revokeTarget.viewCount === 1 ? '' : 's'}. Revoking won't undo
                  past views.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Keep active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Revoke now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
