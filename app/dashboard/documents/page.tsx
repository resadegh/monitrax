'use client';

/**
 * Phase 19 & 26: Documents Library Page (rebranded "My Vault" Phase 38 PR 1)
 * Document management with folder structure navigation and AI analysis.
 *
 * Phase 38 PR 1 (2026-05-01 evening) — visual uplift:
 *   • Replaced PageHeader + 4-StatCard row with an Apple-typography hero
 *     matching Phase 37 grammar (glassmorphic 28px card, font-light hero
 *     number with tracking-[-0.04em], muted supporting copy, sequenced
 *     framer-motion entrance, full prefers-reduced-motion).
 *   • Added Smart Inbox section that surfaces docs awaiting user review
 *     (DocumentAnalysis.status === 'COMPLETED' && userVerified === false)
 *     so the Phase 26 AI suggestions are visible without hunting through
 *     folders.
 *
 * NO backend changes. NO new APIs. Same `/api/documents`, same
 * `/api/documents/analyze`, same FolderTree/Breadcrumb/FolderView.
 * Pure presentation layer.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Search,
  RefreshCw,
  Plus,
  Grid,
  List,
  FolderTree as FolderTreeIcon,
  PanelLeftClose,
  PanelLeft,
  Download,
  ChevronDown,
  Calendar,
  Building2,
  Sparkles,
  Inbox,
  ChevronDown as ChevronDownIcon,
  ExternalLink,
  Check,
  Loader2,
  Send,
} from 'lucide-react';
import {
  DocumentUploadDropzone,
  FolderTree,
  DocumentBreadcrumb,
  DocumentFolderView,
} from '@/components/documents';
import { SendToAccountantDialog } from '@/components/documents/SendToAccountantDialog';
import { DocumentCategory } from '@/lib/documents/types';

// Phase 38 PR 1 — design tokens lifted from Home TRAIL banner v3 +
// Phase 37 heroes (TrailStageIndicator.tsx, CashflowHero, DebtFreedomHero).
// Zero new design tokens, zero new dependencies.
const APPLE_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

/**
 * Australian financial year label.
 * AU FY runs July 1 → June 30. If today is on/after 1 July, the current
 * FY starts in the current calendar year; otherwise it started last year.
 * Output: "FY 2024–25" (uses U+2013 en-dash, typographically correct).
 */
function getCurrentAUFinancialYearLabel(now = new Date()): { label: string; startISO: string; endISO: string } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 6 === July
  const fyStartYear = month >= 6 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  return {
    label: `FY ${fyStartYear}–${String(fyEndYear).slice(2)}`,
    startISO: `${fyStartYear}-07-01T00:00:00.000Z`,
    endISO: `${fyEndYear}-07-01T00:00:00.000Z`,
  };
}

/**
 * Phase 38 PR 2 — Smart Inbox helpers.
 *
 * Extract a one-line summary of what the AI found in a document, suitable
 * for a compact list-row preview. Pulls vendor / amount / date / period
 * from `extractedData` based on the document type. Returns a short string
 * the user can scan in <500ms (Apple-Health-style row density).
 *
 * Tolerant of missing keys — never throws, always returns a string.
 */
function summariseExtractedData(
  documentType: string,
  extractedData: Record<string, unknown> | null
): string {
  if (!extractedData) return formatDocumentTypeLabel(documentType);
  const get = (key: string): string | null => {
    const v = extractedData[key];
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && v !== null && 'value' in v) {
      const inner = (v as { value: unknown }).value;
      return inner == null ? null : String(inner);
    }
    return null;
  };

  const vendor = get('vendor') ?? get('payee') ?? get('issuer') ?? get('lender');
  const amount = get('amount') ?? get('totalAmount') ?? get('total') ?? get('balance');
  const date = get('date') ?? get('issueDate') ?? get('statementDate');
  const period = get('period') ?? get('financialYear');

  const formattedAmount = amount && !Number.isNaN(Number(amount))
    ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(Number(amount))
    : amount;

  const parts = [vendor, formattedAmount, period, date].filter((p): p is string => !!p);
  if (parts.length === 0) return formatDocumentTypeLabel(documentType);
  return parts.slice(0, 3).join(' · ');
}

function formatDocumentTypeLabel(t: string): string {
  return t
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** Confidence dot colour — green ≥0.9, amber ≥0.7, otherwise rose. */
function confidenceTone(c: number): string {
  if (c >= 0.9) return 'bg-emerald-500';
  if (c >= 0.7) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * Action-type labels used on the Smart Inbox confirm button.
 * Matches the SuggestedActionType enum from the existing Phase 26
 * intelligence engine. Falls back to a Title-cased version of the
 * raw action key for any value we haven't explicitly mapped yet.
 */
function formatActionLabel(action: string): string {
  switch (action) {
    case 'create_expense':
      return 'Create expense';
    case 'create_income':
      return 'Create income';
    case 'create_loan':
      return 'Create loan';
    case 'create_property':
      return 'Create property';
    case 'link_to_property':
      return 'Link to property';
    case 'link_to_loan':
      return 'Link to loan';
    case 'verify_only':
      return 'Confirm tags';
    default: {
      const cleaned = action.replace(/_/g, ' ');
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserEntities } from '@/components/documents/FolderTree';

type ExportStructure = 'financial-year-first' | 'entity-first' | 'category-first';

// Phase 26: Analysis summary interface
interface AnalysisSummary {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  documentType: string;
  typeConfidence: number;
  overallConfidence: number;
  extractedData: Record<string, unknown> | null;
  suggestedActions: Array<{
    type: string;
    confidence: number;
    description: string;
  }> | null;
  userVerified: boolean;
  createdEntityType: string | null;
  createdEntityId: string | null;
}

interface DocumentListItem {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  description: string | null;
  tags: string[];
  uploadedAt: string;
  links: {
    entityType: string;
    entityId: string;
    entityName?: string;
    parentId?: string;
    parentName?: string;
    parentType?: string;
  }[];
  analysis: AnalysisSummary | null; // Phase 26
}

interface DocumentsResponse {
  documents: DocumentListItem[];
  total: number;
  hasMore: boolean;
}

export default function DocumentsLibraryPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPath, setCurrentPath] = useState('/');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSidebar, setShowSidebar] = useState(true);
  const [entities, setEntities] = useState<UserEntities | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [enableAIAnalysis, setEnableAIAnalysis] = useState(true); // Phase 26: Auto-analyze uploads

  // Fetch documents with entity names
  const fetchDocuments = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '100');
      params.set('includeEntityNames', 'true');

      const res = await fetch(`/api/documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch documents');

      const data: DocumentsResponse = await res.json();
      setDocuments(data.documents);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, searchQuery]);

  // Fetch user entities for folder tree
  const fetchEntities = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch('/api/documents/entities', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (err) {
      console.error('Error fetching entities:', err);
    }
  }, [token]);

  // Phase 38 PR 4: fetch expense isTaxDeductible flags so we can bucket
  // documents in the FolderTree's "By Tax Status" lens. Uses the existing
  // /api/expenses endpoint — no new API. Tolerant of variations in
  // response envelope (`expenses`, `data`, or bare array).
  const fetchExpenseTax = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const list: Array<{ id: string; isTaxDeductible?: boolean }> = Array.isArray(json)
        ? json
        : (json?.expenses ?? json?.data ?? []);
      const map = new Map<string, boolean>();
      for (const e of list) {
        if (e?.id && typeof e.isTaxDeductible === 'boolean') {
          map.set(e.id, e.isTaxDeductible);
        }
      }
      setExpenseTaxMap(map);
    } catch (err) {
      console.error('[Documents] expense tax fetch failed:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchDocuments();
    fetchEntities();
    fetchExpenseTax();
  }, [fetchDocuments, fetchEntities, fetchExpenseTax, refreshKey]);

  /**
   * Phase 38 PR 4 — derive a document's tax-status bucket.
   *
   *   • DEDUCTIBLE     — at least one EXPENSE link where isTaxDeductible === true
   *   • NON_DEDUCTIBLE — at least one EXPENSE link where isTaxDeductible === false
   *                       AND no DEDUCTIBLE expense link
   *   • UNTAGGED       — no EXPENSE link, OR expense link(s) without a known flag
   *
   * Tolerant of partial data — if a doc has expense links we don't have
   * tax data for yet (e.g. expense was created after the page mounted),
   * it falls into UNTAGGED rather than throwing.
   */
  const getDocumentTaxStatus = useCallback(
    (doc: DocumentListItem): 'DEDUCTIBLE' | 'NON_DEDUCTIBLE' | 'UNTAGGED' => {
      let anyDeductible = false;
      let anyNonDeductible = false;
      for (const link of doc.links) {
        if (link.entityType !== 'EXPENSE') continue;
        const flag = expenseTaxMap.get(link.entityId);
        if (flag === true) anyDeductible = true;
        else if (flag === false) anyNonDeductible = true;
      }
      if (anyDeductible) return 'DEDUCTIBLE';
      if (anyNonDeductible) return 'NON_DEDUCTIBLE';
      return 'UNTAGGED';
    },
    [expenseTaxMap]
  );

  // Calculate document counts for folder tree
  const documentCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    documents.forEach((doc) => {
      // Count by category
      counts[doc.category] = (counts[doc.category] || 0) + 1;

      // Count by fiscal year (Australian: July-June)
      const uploadDate = new Date(doc.uploadedAt);
      const month = uploadDate.getMonth(); // 0-11
      const year = uploadDate.getFullYear();
      const fiscalYear = month >= 6 ? year : year - 1; // July onwards = current year, else previous
      counts[`fy:${fiscalYear}`] = (counts[`fy:${fiscalYear}`] || 0) + 1;

      // Count by entity type AND specific entity ID
      doc.links.forEach((link) => {
        // Count by entity type (for parent folder count)
        counts[`entity:${link.entityType}`] = (counts[`entity:${link.entityType}`] || 0) + 1;
        // Count by specific entity ID (for individual entity counts)
        counts[`entity:${link.entityType}:${link.entityId}`] = (counts[`entity:${link.entityType}:${link.entityId}`] || 0) + 1;
      });

      // Phase 38 PR 4 — tax-status bucket counts (DEDUCTIBLE / NON_DEDUCTIBLE / UNTAGGED)
      const taxStatus = getDocumentTaxStatus(doc);
      counts[`tax:${taxStatus}`] = (counts[`tax:${taxStatus}`] || 0) + 1;
    });

    return counts;
  }, [documents]);

  // Filter documents based on current path
  const filteredDocuments = useMemo(() => {
    if (currentPath === '/') {
      return documents;
    }

    const pathParts = currentPath.split('/').filter(Boolean);

    if (pathParts[0] === 'categories' && pathParts[1]) {
      return documents.filter((doc) => doc.category === pathParts[1]);
    }

    if (pathParts[0] === 'fiscal-year' && pathParts[1]) {
      const targetFY = parseInt(pathParts[1]);
      return documents.filter((doc) => {
        const uploadDate = new Date(doc.uploadedAt);
        const month = uploadDate.getMonth();
        const year = uploadDate.getFullYear();
        const docFY = month >= 6 ? year : year - 1;
        return docFY === targetFY;
      });
    }

    if (pathParts[0] === 'entities' && pathParts[1]) {
      const entityType = pathParts[1];
      const entityId = pathParts[2];

      if (entityId) {
        // Specific entity (e.g., /entities/PROPERTY/abc-123)
        return documents.filter((doc) =>
          doc.links.some((link) => link.entityType === entityType && link.entityId === entityId)
        );
      } else {
        // Entity type (e.g., /entities/PROPERTY)
        return documents.filter((doc) =>
          doc.links.some((link) => link.entityType === entityType)
        );
      }
    }

    // Phase 38 PR 4 — Tax-status lens. Path: /tax-status/{DEDUCTIBLE|NON_DEDUCTIBLE|UNTAGGED}
    if (pathParts[0] === 'tax-status' && pathParts[1]) {
      const target = pathParts[1] as 'DEDUCTIBLE' | 'NON_DEDUCTIBLE' | 'UNTAGGED';
      return documents.filter((doc) => getDocumentTaxStatus(doc) === target);
    }

    return documents;
  }, [documents, currentPath, getDocumentTaxStatus]);

  // Get sub-folders for current path
  const subFolders = useMemo(() => {
    const pathParts = currentPath.split('/').filter(Boolean);

    // Root level - no sub-folders shown (use tree instead)
    if (currentPath === '/' || pathParts.length === 0) {
      return [];
    }

    // Categories folder
    if (pathParts[0] === 'categories' && pathParts.length === 1) {
      return Object.values(DocumentCategory).map((cat) => ({
        name: getCategoryName(cat),
        path: `/categories/${cat}`,
        count: documentCounts[cat] || 0,
      }));
    }

    return [];
  }, [currentPath, documentCounts]);

  // Handle upload (Phase 26: includes AI analysis option)
  const handleUpload = async (
    file: File,
    category: DocumentCategory,
    description?: string,
    tags?: string[]
  ) => {
    if (!token) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    // Send MIME type explicitly (Vercel/Next.js can lose file.type)
    formData.append('mimeType', file.type);
    if (description) formData.append('description', description);
    if (tags?.length) formData.append('tags', tags.join(','));

    // Phase 26: Include analyze flag for AI document analysis
    if (enableAIAnalysis) {
      formData.append('analyze', 'true');
    }

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Upload failed');
    }

    // Refresh list
    setRefreshKey((k) => k + 1);
    setShowUpload(false);
  };

  // Handle view (get signed URL)
  const handleView = async (id: string) => {
    if (!token) return null;

    const res = await fetch(`/api/documents/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return { signedUrl: data.signedUrl };
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!token) return;

    const res = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      setTotal((t) => t - 1);
    }
  };

  // Handle export
  const handleExport = async (structure: ExportStructure) => {
    if (!token || filteredDocuments.length === 0) return;

    setIsExporting(true);
    try {
      const res = await fetch('/api/documents/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: currentPath,
          structure,
          includeSubFolders: true,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Export failed');
      }

      // Download the ZIP file
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = 'Monitrax_Documents.zip';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Phase 26: Handle analyze existing document
  const handleAnalyze = async (id: string) => {
    if (!token) return;

    const res = await fetch('/api/documents/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId: id }),
    });

    if (res.ok) {
      // Refresh to get updated analysis
      setRefreshKey((k) => k + 1);
    }
  };

  // Phase 26: Handle confirm analysis action
  const handleConfirmAnalysis = async (
    analysisId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<boolean> => {
    if (!token) return false;

    const res = await fetch('/api/documents/analyze/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ analysisId, action, data }),
    });

    if (res.ok) {
      // Refresh to get updated status
      setRefreshKey((k) => k + 1);
    }

    return res.ok;
  };

  // Calculate stats
  const totalSize = documents.reduce((sum, d) => sum + d.size, 0);
  const categoryCount = new Set(documents.map((d) => d.category)).size;
  // Phase 26: Count analyzed documents
  const analyzedCount = documents.filter((d) => d.analysis?.status === 'COMPLETED').length;
  const pendingAnalysisCount = documents.filter((d) => d.analysis && d.analysis.status !== 'COMPLETED' && d.analysis.status !== 'FAILED').length;

  // Phase 38 PR 3: "Send to accountant" modal state.
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Phase 38 PR 4: tax-status lens.
  // Map<expenseId, isTaxDeductible> derived from /api/expenses on mount.
  // Used to bucket each document into DEDUCTIBLE / NON_DEDUCTIBLE / UNTAGGED
  // for the FolderTree's "By Tax Status" filter. No new endpoint —
  // /api/expenses already returns isTaxDeductible per row.
  const [expenseTaxMap, setExpenseTaxMap] = useState<Map<string, boolean>>(new Map());

  // Phase 38 PR 1: hero + Smart Inbox derivations. All client-side over
  // the existing /api/documents response — no new endpoint, no new query.
  const fy = useMemo(() => getCurrentAUFinancialYearLabel(), []);
  const thisFyCount = useMemo(
    () =>
      documents.filter((d) => {
        const t = new Date(d.uploadedAt).getTime();
        return t >= new Date(fy.startISO).getTime() && t < new Date(fy.endISO).getTime();
      }).length,
    [documents, fy]
  );
  // Smart Inbox: docs the AI has finished analysing but the user hasn't
  // verified yet. These are the one-tap accept/edit candidates surfaced
  // by the existing AnalysisPreviewCard component (Phase 26).
  const awaitingReview = useMemo(
    () =>
      documents.filter(
        (d) => d.analysis?.status === 'COMPLETED' && d.analysis?.userVerified === false
      ),
    [documents]
  );
  const awaitingReviewCount = awaitingReview.length;

  // Apple-voice supporting sentence — confident, factual, action-forward.
  // Doesn't repeat the hero number; conveys meaning + next step.
  const heroSentence = useMemo(() => {
    if (total === 0) {
      return 'Drop your first receipt or statement above — your accountant will thank you later.';
    }
    if (awaitingReviewCount > 0) {
      return `${awaitingReviewCount} ${
        awaitingReviewCount === 1 ? 'document is' : 'documents are'
      } waiting for a quick tag — your inbox is below.`;
    }
    return 'Everything filed and ready for your accountant — beautifully organised.';
  }, [total, awaitingReviewCount]);

  const reduced = useReducedMotion();

  // Phase 38 PR 2 — Smart Inbox expansion + per-row pending state.
  // Default expanded when there's stuff to do — Apple's "inbox zero"
  // pattern (Mail, Reminders): if there's something for you, show it.
  const [inboxExpanded, setInboxExpanded] = useState(true);
  // Track which row is mid-confirm so we can disable the buttons +
  // show a spinner without blocking the rest of the inbox.
  const [confirmingRowId, setConfirmingRowId] = useState<string | null>(null);

  // One-tap confirm — calls the EXISTING /api/documents/analyze/confirm
  // endpoint (the same one the FolderView already uses). Picks the
  // highest-confidence suggested action; if there isn't one, the row
  // hides the Confirm button and only shows Open.
  const handleInboxConfirm = useCallback(
    async (doc: DocumentListItem) => {
      if (!doc.analysis || confirmingRowId) return;
      const top = (doc.analysis.suggestedActions ?? [])
        .slice()
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      if (!top) return;
      setConfirmingRowId(doc.id);
      try {
        // The confirm endpoint expects `data` (the prefilled payload).
        // Phase 26 stores the payload on the analysis as `extractedData`
        // — we pass it through verbatim. The endpoint validates server-
        // side, so user-corrected fields are still safe to update.
        await handleConfirmAnalysis(doc.analysis.id, top.type, doc.analysis.extractedData ?? {});
      } finally {
        setConfirmingRowId(null);
      }
    },
    [confirmingRowId, handleConfirmAnalysis]
  );

  // Open the source file in a new tab — calls the EXISTING signed-URL
  // endpoint (15-min expiry per documentService.ts).
  const handleInboxOpen = useCallback(
    async (doc: DocumentListItem) => {
      const result = await handleView(doc.id);
      if (result?.signedUrl) {
        window.open(result.signedUrl, '_blank', 'noopener');
      }
    },
    [handleView]
  );

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Folder Tree */}
        {showSidebar && (
          <aside className="w-64 border-r border-border/40 bg-card/30 backdrop-blur-md p-4 overflow-y-auto hidden lg:block">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                Folders
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setShowSidebar(false)}
                title="Hide folders"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <FolderTree
              currentPath={currentPath}
              onNavigate={setCurrentPath}
              documentCounts={documentCounts}
              entities={entities || undefined}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Phase 38 PR 1 — Apple-typography hero. Replaces the
                PageHeader + 4-StatCard row. Same source data
                (`documents` from /api/documents) — zero new API calls. */}
            <div className="relative isolate overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-card/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              {/* Atmospheric mesh gradient — calm violet + emerald;
                  evokes "vault" (security + steady growth). */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduced ? { duration: 0 } : { duration: 1.4, ease: APPLE_EASE }}
                style={{
                  background:
                    'radial-gradient(circle at 18% 0%, rgba(139,92,246,0.08), transparent 60%), radial-gradient(circle at 82% 100%, rgba(16,185,129,0.06), transparent 55%)',
                }}
              />
              <div className="p-6 sm:p-8 md:p-10">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 mb-4">
                      My Vault · {fy.label}
                    </p>

                    {/* Hero number — total docs in the current FY */}
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduced ? { duration: 0 } : { duration: 0.7, ease: APPLE_EASE }
                      }
                      className="text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.04em] tabular-nums leading-none text-foreground"
                    >
                      {thisFyCount}
                      <span className="text-2xl sm:text-3xl md:text-4xl text-muted-foreground/60 font-light ml-3 align-baseline">
                        {thisFyCount === 1 ? 'document' : 'documents'}
                      </span>
                    </motion.div>

                    {/* Supporting sentence — muted, refined, empowering */}
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
                      {heroSentence}
                    </motion.p>
                  </div>

                  {/* Primary actions — Upload + Send to accountant.
                      Apple-pill styling so they don't compete with the
                      hero number. Send button disabled until docs exist. */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => setShowSendDialog(true)}
                      disabled={total === 0}
                      className="inline-flex items-center gap-2 rounded-xl border-border/60 bg-background/60 backdrop-blur-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
                      title="Send a secure share link to your accountant"
                    >
                      <Send className="h-4 w-4" />
                      Send to accountant
                    </Button>
                    <Button
                      onClick={() => setShowUpload(!showUpload)}
                      className="inline-flex items-center gap-2 rounded-xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      <Plus className="h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                </div>

                {/* Stats footer — total · storage · categories · awaiting
                    review. Smaller, neutral weight, supporting role.
                    Same numbers; restyled to match Phase 37 grammar. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 pt-6 border-t border-border/40">
                  {[
                    { label: 'Total', value: total, hint: 'all-time' },
                    { label: 'Storage', value: formatStorageSize(totalSize), hint: 'used' },
                    { label: 'Categories', value: categoryCount, hint: 'in use' },
                    {
                      label: 'Awaiting review',
                      value: awaitingReviewCount,
                      hint: awaitingReviewCount > 0 ? 'tap below' : 'all caught up',
                      tone: awaitingReviewCount > 0 ? 'attention' : 'neutral',
                    },
                  ].map((stat, idx) => (
                    <motion.div
                      key={stat.label}
                      initial={reduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { duration: 0.5, ease: APPLE_EASE, delay: 0.22 + idx * 0.05 }
                      }
                      className="flex flex-col gap-1.5"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                        {stat.label}
                      </div>
                      <div
                        className={`text-xl sm:text-2xl font-medium tabular-nums tracking-[-0.02em] ${
                          stat.tone === 'attention'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-foreground'
                        }`}
                      >
                        {stat.value}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{stat.hint}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Phase 38 PR 2 — SMART INBOX (expanded).
                Surfaces docs where Phase 26 AI has finished analysing but
                the user hasn't verified yet (analysis.status='COMPLETED'
                && userVerified=false). Each row offers one-tap confirm
                (uses the EXISTING /api/documents/analyze/confirm endpoint
                via handleConfirmAnalysis — the same one the FolderView
                already uses) and Open (uses the EXISTING signed-URL
                handleView). Zero new APIs, zero new components. */}
            {awaitingReviewCount > 0 && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.55, ease: APPLE_EASE, delay: 0.4 }
                }
                className="relative isolate overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-md"
              >
                {/* Header — clickable to expand/collapse */}
                <button
                  type="button"
                  onClick={() => setInboxExpanded((v) => !v)}
                  className="w-full p-5 sm:p-6 flex items-center gap-4 text-left hover:bg-amber-500/[0.03] transition-colors"
                  aria-expanded={inboxExpanded}
                  aria-controls="smart-inbox-list"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base sm:text-lg font-medium tracking-[-0.01em]">
                        Smart Inbox
                      </h3>
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 font-medium text-[11px]"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI ready
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-background/60 border-border/50 font-medium text-[11px] tabular-nums"
                      >
                        {awaitingReviewCount}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {awaitingReviewCount === 1
                        ? "We've extracted the tags for 1 document — confirm or open below."
                        : `We've extracted the tags for ${awaitingReviewCount} documents — confirm or open below.`}
                    </p>
                  </div>
                  <motion.div
                    animate={{ rotate: inboxExpanded ? 180 : 0 }}
                    transition={reduced ? { duration: 0 } : { duration: 0.3, ease: APPLE_EASE }}
                    className="shrink-0 text-muted-foreground"
                  >
                    <ChevronDownIcon className="h-5 w-5" />
                  </motion.div>
                </button>

                {/* Expanded list — one row per pending doc */}
                <AnimatePresence initial={false}>
                  {inboxExpanded && (
                    <motion.div
                      id="smart-inbox-list"
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { duration: 0.45, ease: APPLE_EASE }
                      }
                      className="overflow-hidden"
                    >
                      <div className="border-t border-amber-500/15 px-2 sm:px-3 pb-3">
                        {awaitingReview.map((doc, idx) => {
                          const a = doc.analysis!;
                          const summary = summariseExtractedData(
                            a.documentType,
                            a.extractedData
                          );
                          const topAction = (a.suggestedActions ?? [])
                            .slice()
                            .sort((x, y) => (y.confidence ?? 0) - (x.confidence ?? 0))[0];
                          const confirmLabel = topAction
                            ? formatActionLabel(topAction.type)
                            : null;
                          const isConfirming = confirmingRowId === doc.id;

                          return (
                            <motion.div
                              key={doc.id}
                              initial={reduced ? false : { opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={
                                reduced
                                  ? { duration: 0 }
                                  : { duration: 0.35, ease: APPLE_EASE, delay: idx * 0.04 }
                              }
                              className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-3 py-3 mt-1 rounded-xl hover:bg-background/60 transition-colors"
                            >
                              {/* Confidence dot + filename + summary */}
                              <div className="min-w-0 flex-1 flex items-start gap-3">
                                <div
                                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${confidenceTone(a.overallConfidence)}`}
                                  title={`Confidence ${(a.overallConfidence * 100).toFixed(0)}%`}
                                  aria-label={`Confidence ${(a.overallConfidence * 100).toFixed(0)} percent`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-medium uppercase tracking-[0.12em] border-border/50 bg-background/40"
                                    >
                                      {formatDocumentTypeLabel(a.documentType)}
                                    </Badge>
                                    <span className="text-sm font-medium tracking-[-0.01em] truncate">
                                      {summary}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                                    {doc.originalFilename}
                                  </p>
                                </div>
                              </div>

                              {/* Action row */}
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleInboxOpen(doc)}
                                  className="h-8 text-[12px] gap-1.5 text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Open
                                </Button>
                                {confirmLabel && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleInboxConfirm(doc)}
                                    disabled={isConfirming}
                                    className="h-8 text-[12px] gap-1.5 bg-amber-600 hover:bg-amber-600/90 text-white"
                                  >
                                    {isConfirming ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    {isConfirming ? 'Saving' : confirmLabel}
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Upload Section */}
            {showUpload && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.45, ease: APPLE_EASE }
                }
                className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-medium tracking-[-0.01em]">
                    Upload documents
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {/* AI Analysis toggle — refined glass row */}
                  <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label
                        htmlFor="ai-analysis"
                        className="text-sm font-medium tracking-[-0.01em]"
                      >
                        AI auto-tagging
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {enableAIAnalysis ? 'On' : 'Off'}
                      </span>
                      <Switch
                        id="ai-analysis"
                        checked={enableAIAnalysis}
                        onCheckedChange={setEnableAIAnalysis}
                      />
                    </div>
                  </div>
                  {enableAIAnalysis && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Each upload will be analysed for vendor, amount, date, and category
                      — review and confirm in the Smart Inbox above.
                    </p>
                  )}
                  <DocumentUploadDropzone
                    onUpload={handleUpload}
                    defaultCategory={DocumentCategory.OTHER}
                  />
                </div>
              </motion.div>
            )}

            {/* Phase 38 PR 3 — Toolbar (refined). Replaced the dated
                Card chrome with a glass surface that matches the hero +
                Smart Inbox grammar. Same controls, refined typography. */}
            <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Sidebar toggle (desktop) */}
                {!showSidebar && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSidebar(true)}
                    className="hidden lg:flex h-10 w-10 rounded-xl border-border/60 bg-background/60"
                    title="Show folders"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                )}

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                  <Input
                    placeholder="Search documents…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 rounded-xl bg-background/60 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/50"
                  />
                </div>

                {/* View mode segmented control */}
                <div className="inline-flex items-center rounded-xl border border-border/60 bg-background/40 p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex h-8 w-9 items-center justify-center rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label="Grid view"
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex h-8 w-9 items-center justify-center rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  disabled={isLoading}
                  className="h-10 w-10 rounded-xl border-border/60 bg-background/60"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                  />
                </Button>

                {/* Export Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isExporting || filteredDocuments.length === 0}
                      className="h-10 rounded-xl border-border/60 bg-background/60"
                    >
                      {isExporting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Export
                      <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <DropdownMenuItem onClick={() => handleExport('financial-year-first')}>
                      <Calendar className="h-4 w-4 mr-2" />
                      By financial year
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('entity-first')}>
                      <Building2 className="h-4 w-4 mr-2" />
                      By entity
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('category-first')}>
                      <FolderTreeIcon className="h-4 w-4 mr-2" />
                      By category
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Phase 38 PR 3 — Folder header (breadcrumb + count) and
                folder view. Replaced Card chrome with glass surface that
                matches the rest of the page. */}
            <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/40">
                <DocumentBreadcrumb path={currentPath} onNavigate={setCurrentPath} />
                {filteredDocuments.length > 0 && (
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70 tabular-nums">
                    {filteredDocuments.length}{' '}
                    {filteredDocuments.length === 1 ? 'document' : 'documents'}
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-5">
                <DocumentFolderView
                  documents={filteredDocuments}
                  subFolders={subFolders}
                  onView={handleView}
                  onDelete={handleDelete}
                  onNavigateFolder={setCurrentPath}
                  onAnalyze={handleAnalyze}
                  onConfirmAnalysis={handleConfirmAnalysis}
                  loading={isLoading}
                  viewMode={viewMode}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Phase 38 PR 3 — Send to accountant modal.
          Defaults to the full visible doc set (filteredDocuments) so the
          owner can scope by current folder/search before invoking. */}
      <SendToAccountantDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        documentIds={filteredDocuments.map((d) => d.id)}
        contentLabel={
          currentPath && currentPath !== '/'
            ? `Documents in ${currentPath}`
            : `${fy.label} documents`
        }
      />
    </DashboardLayout>
  );
}

function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getCategoryName(category: DocumentCategory): string {
  const names: Record<string, string> = {
    CONTRACT: 'Contracts',
    STATEMENT: 'Statements',
    RECEIPT: 'Receipts',
    TAX: 'Tax Documents',
    PDS: 'Product Disclosures',
    VALUATION: 'Valuations',
    INSURANCE: 'Insurance',
    MORTGAGE: 'Mortgage',
    LEASE: 'Leases',
    INVOICE: 'Invoices',
    OTHER: 'Other',
  };
  return names[category] || category;
}
