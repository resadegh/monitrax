'use client';

/**
 * Phase 38 PR 3 — Public Share Pass recipient page.
 *
 * Reza directive (2026-05-01): minimal share-only aesthetic — no app
 * shell, no sidebar, no nav. Just logo + content + downloads. The
 * minimalism is itself a trust signal — "this is a secure-share tool,
 * not a leaked dashboard".
 *
 * Auth: NONE. The token in the URL IS the credential. The /api/share/
 * [token] endpoint validates expiry + revocation on every load and
 * audit-logs the access under the OWNER's userId.
 *
 * Layout (mobile-first; accountants check email on phones):
 *   ┌──────────────────────────────┐
 *   │ Monitrax logo (small, top)   │
 *   ├──────────────────────────────┤
 *   │ Hero — "From {owner}" +      │
 *   │ purpose, expiry, view count  │
 *   ├──────────────────────────────┤
 *   │ Download all (ZIP) — primary │
 *   ├──────────────────────────────┤
 *   │ Per-document list with       │
 *   │ Open + size/type             │
 *   ├──────────────────────────────┤
 *   │ Watermark line + footer      │
 *   └──────────────────────────────┘
 */

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  Wallet,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const APPLE_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface ShareDocumentSummary {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: string;
  uploadedAt: string;
}

interface ShareData {
  id: string;
  ownerName: string;
  purpose: string;
  contentType: string;
  contentLabel: string | null;
  recipientName: string | null;
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  watermarkText: string | null;
  documents: ShareDocumentSummary[];
}

const PURPOSE_LABEL: Record<string, string> = {
  TAX_RETURN: 'Tax return',
  LOAN_APPLICATION: 'Loan application',
  INSURANCE_CLAIM: 'Insurance claim',
  ADVISER_REVIEW: 'Adviser review',
  OTHER: 'Personal records',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const reduced = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/share/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? 'This share link is no longer available.');
          setErrorStatus(res.status);
          setShare(null);
        } else {
          setShare(data);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load the share. Please try again later.');
          setErrorStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const downloadHref = `/api/share/${encodeURIComponent(token)}/download`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Minimal header — logo only, no app chrome */}
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium tracking-[-0.01em]">Monitrax</span>
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
            Secure share
          </span>
          <Lock className="h-3 w-3 text-muted-foreground/70 ml-auto" aria-hidden />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <ShareErrorPanel message={error} status={errorStatus} />
        ) : share ? (
          <>
            {/* Hero */}
            <motion.section
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, ease: APPLE_EASE }}
              className="space-y-4"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                {PURPOSE_LABEL[share.purpose] ?? 'Shared package'}
                {share.recipientName ? ` · for ${share.recipientName}` : ''}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-[-0.04em] leading-[1.1] text-foreground">
                {share.documents.length}
                <span className="text-2xl sm:text-3xl text-muted-foreground/60 ml-3 align-baseline">
                  {share.documents.length === 1 ? 'document' : 'documents'}
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-xl">
                Sent by <span className="font-medium text-foreground">{share.ownerName}</span>
                {share.contentLabel ? ` · ${share.contentLabel}` : ''}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Created{' '}
                  {new Date(share.createdAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span>
                  Access until{' '}
                  <span className="font-medium text-foreground">
                    {new Date(share.expiresAt).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </span>
                <span>{share.viewCount} view{share.viewCount === 1 ? '' : 's'}</span>
              </div>
            </motion.section>

            {/* Download all — primary action */}
            <motion.section
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.55, ease: APPLE_EASE, delay: 0.12 }
              }
            >
              <a
                href={downloadHref}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] transition-colors p-5 sm:p-6"
              >
                <div className="min-w-0">
                  <div className="text-base font-medium tracking-[-0.01em]">
                    Download all as ZIP
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Organised{' '}
                    {share.contentLabel ? `for ${share.contentLabel.toLowerCase()}` : 'by financial year'}{' '}
                    — ready for your records.
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 group-hover:scale-[1.04] transition-transform">
                  <Download className="h-5 w-5" />
                </div>
              </a>
            </motion.section>

            {/* Per-document list */}
            <motion.section
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.55, ease: APPLE_EASE, delay: 0.2 }
              }
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                  Documents in this share
                </h2>
              </div>
              <ul className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md divide-y divide-border/40">
                {share.documents.map((doc, idx) => (
                  <motion.li
                    key={doc.id}
                    initial={reduced ? false : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 0.35, ease: APPLE_EASE, delay: 0.25 + idx * 0.03 }
                    }
                  >
                    <a
                      href={`/api/share/${encodeURIComponent(token)}/file/${encodeURIComponent(doc.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground shrink-0">
                        {isImage(doc.mimeType) ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {doc.originalFilename}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {doc.category} · {formatBytes(doc.size)} ·{' '}
                          {new Date(doc.uploadedAt).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </a>
                  </motion.li>
                ))}
                {share.documents.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No documents available — they may have been removed.
                  </li>
                )}
              </ul>
            </motion.section>

            {/* Watermark + footer */}
            <footer className="pt-6 mt-8 border-t border-border/40 space-y-2 text-center text-[11px] text-muted-foreground/70">
              {share.watermarkText && (
                <div className="font-medium tracking-wide">{share.watermarkText}</div>
              )}
              <div>
                Shared securely via{' '}
                <Link href="/" className="underline-offset-2 hover:underline">
                  Monitrax
                </Link>
                . Every access to this link is audit-logged.
              </div>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}

function ShareErrorPanel({ message, status }: { message: string; status: number | null }) {
  // 410 Gone → revoked or expired (not the recipient's fault); 404 → bad token
  const isGone = status === 410;
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md p-8 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-medium tracking-[-0.01em]">
        {isGone ? 'This link is no longer active' : 'Share not found'}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
        {message}
      </p>
      <p className="text-xs text-muted-foreground pt-2">
        Please ask the sender to issue a new link.
      </p>
    </div>
  );
}
