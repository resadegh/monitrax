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
import { motion, useReducedMotion } from 'framer-motion';
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
} from 'lucide-react';
import {
  DocumentUploadDropzone,
  FolderTree,
  DocumentBreadcrumb,
  DocumentFolderView,
} from '@/components/documents';
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

  useEffect(() => {
    fetchDocuments();
    fetchEntities();
  }, [fetchDocuments, fetchEntities, refreshKey]);

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

    return documents;
  }, [documents, currentPath]);

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

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Folder Tree */}
        {showSidebar && (
          <aside className="w-64 border-r bg-muted/30 p-4 overflow-y-auto hidden lg:block">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Folders
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowSidebar(false)}
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

                  {/* Primary action — Upload — styled as glass pill so it
                      doesn't compete with the hero number visually. */}
                  <Button
                    onClick={() => setShowUpload(!showUpload)}
                    className="inline-flex items-center gap-2 rounded-xl shadow-sm shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <Plus className="h-4 w-4" />
                    Upload document
                  </Button>
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

            {/* Phase 38 PR 1 — SMART INBOX. Surfaces docs the AI has
                analysed but the user hasn't verified yet. Uses the
                EXISTING documents data (analysis.status === 'COMPLETED'
                && userVerified === false) — no new endpoint. The full
                review-and-confirm flow is in PR 2; PR 1 surfaces the
                count + a clear CTA so users know action is available. */}
            {awaitingReviewCount > 0 && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.55, ease: APPLE_EASE, delay: 0.4 }
                }
                className="relative isolate overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-md"
              >
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
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
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {awaitingReviewCount === 1
                        ? "We've analysed 1 document — open it below to confirm the suggested tags."
                        : `We've analysed ${awaitingReviewCount} documents — open any one below to confirm the suggested tags.`}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Upload Section */}
            {showUpload && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Phase 26: AI Analysis Toggle */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label htmlFor="ai-analysis" className="text-sm font-medium">
                        AI Document Analysis
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        Phase 26
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {enableAIAnalysis ? 'Enabled' : 'Disabled'}
                      </span>
                      <Switch
                        id="ai-analysis"
                        checked={enableAIAnalysis}
                        onCheckedChange={setEnableAIAnalysis}
                      />
                    </div>
                  </div>
                  {enableAIAnalysis && (
                    <p className="text-xs text-muted-foreground">
                      Documents will be automatically analyzed to extract data like vendor, amount, date, and GST.
                      You can review and confirm extracted data to create expenses or income records.
                    </p>
                  )}
                  <DocumentUploadDropzone
                    onUpload={handleUpload}
                    defaultCategory={DocumentCategory.OTHER}
                  />
                </CardContent>
              </Card>
            )}

            {/* Toolbar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Sidebar toggle (mobile/tablet) */}
                  {!showSidebar && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSidebar(true)}
                      className="hidden lg:flex"
                    >
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* View mode toggle */}
                  <div className="flex items-center border rounded-md">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                      className="rounded-r-none"
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                      className="rounded-l-none"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Refresh */}
                  <Button
                    variant="outline"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    disabled={isLoading}
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
                      >
                        {isExporting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Export
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => handleExport('financial-year-first')}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        By Financial Year
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport('entity-first')}
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        By Entity
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport('category-first')}
                      >
                        <FolderTreeIcon className="h-4 w-4 mr-2" />
                        By Category
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            {/* Breadcrumb & Documents */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <DocumentBreadcrumb
                    path={currentPath}
                    onNavigate={setCurrentPath}
                  />
                  {filteredDocuments.length > 0 && (
                    <Badge variant="secondary">
                      {filteredDocuments.length} document
                      {filteredDocuments.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
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
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
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
