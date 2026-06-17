'use client';

/**
 * Phase 50 — Document attach button.
 *
 * A compact icon button that attaches a document/photo to one or more entities
 * (e.g. an expense + its asset). Clicking it opens the native file picker (which
 * on mobile offers Take Photo / Photo Library / Choose File). Uploads go to
 * `/api/documents/upload` with the entity link field(s) — plain store+link, no
 * AI dependency, so it works regardless of OCR availability.
 *
 * Used on per-expense rows so a receipt attaches directly to that transaction.
 *
 * @see components/documents/DocumentsSection.tsx (the full per-item panel)
 */

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DocumentCategory,
  LinkedEntityType,
  SUPPORTED_MIME_TYPES,
} from '@/lib/documents/types';
import { Paperclip, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINK_FIELD: Partial<Record<LinkedEntityType, string>> = {
  [LinkedEntityType.PROPERTY]: 'propertyId',
  [LinkedEntityType.INVESTMENT_ACCOUNT]: 'investmentAccountId',
  [LinkedEntityType.INVESTMENT_HOLDING]: 'investmentHoldingId',
  [LinkedEntityType.ASSET]: 'assetId',
  [LinkedEntityType.LOAN]: 'loanId',
  [LinkedEntityType.INCOME]: 'incomeId',
  [LinkedEntityType.EXPENSE]: 'expenseId',
  [LinkedEntityType.ACCOUNT]: 'accountId',
  [LinkedEntityType.OFFSET_ACCOUNT]: 'offsetAccountId',
  [LinkedEntityType.TRANSACTION]: 'transactionId',
};

const ACCEPT = (SUPPORTED_MIME_TYPES as readonly string[]).join(',');

export interface DocumentAttachButtonProps {
  /** One or more entities to link the uploaded document to. */
  links: { entityType: LinkedEntityType; entityId: string }[];
  defaultCategory?: DocumentCategory;
  /** Called after a successful upload (e.g. to refresh a list). */
  onUploaded?: () => void;
  title?: string;
  /** Optional text label beside the icon. */
  label?: string;
  className?: string;
}

export function DocumentAttachButton({
  links,
  defaultCategory = DocumentCategory.RECEIPT,
  onUploaded,
  title = 'Attach document',
  label,
  className,
}: DocumentAttachButtonProps) {
  const { token } = useAuth();
  const [state, setState] = useState<'idle' | 'uploading' | 'done'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !token) return;
      setState('uploading');
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('mimeType', file.type);
          fd.append('category', defaultCategory);
          for (const link of links) {
            const field = LINK_FIELD[link.entityType];
            if (field) fd.append(field, link.entityId);
          }
          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        }
        setState('done');
        onUploaded?.();
        setTimeout(() => setState('idle'), 2000);
      } catch {
        setState('idle');
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [token, links, defaultCategory, onUploaded],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'uploading'}
        title={title}
        className={cn('gap-1.5', className)}
      >
        {state === 'uploading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === 'done' ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        {label && <span className="text-xs">{label}</span>}
      </Button>
    </>
  );
}
