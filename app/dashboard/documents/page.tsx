'use client';

/**
 * Phase 19 & 26: Documents Library Page
 * Document management with folder structure navigation and AI analysis
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Upload,
  Search,
  HardDrive,
  RefreshCw,
  Plus,
  Grid,
  List,
  FolderTree as FolderTreeIcon,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from 'lucide-react';
import {
  DocumentUploadDropzone,
  FolderTree,
  DocumentBreadcrumb,
  DocumentFolderView,
} from '@/components/documents';
import { DocumentCategory } from '@/lib/documents/types';
import { StatCard } from '@/components/StatCard';

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
  const [enableAIAnalysis, setEnableAIAnalysis] = useState(true); // Phase 26: Auto-analyze uploads

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '100');

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

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

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

      // Count by entity type
      doc.links.forEach((link) => {
        counts[`entity:${link.entityType}`] = (counts[`entity:${link.entityType}`] || 0) + 1;
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
      return documents.filter((doc) =>
        doc.links.some((link) => link.entityType === pathParts[1])
      );
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
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
              title="Documents"
              description="Manage all your financial documents in one place"
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Documents"
                value={total}
                icon={FileText}
                variant="blue"
              />
              <StatCard
                title="Storage Used"
                value={formatStorageSize(totalSize)}
                icon={HardDrive}
                variant="purple"
              />
              <StatCard
                title="Categories"
                value={categoryCount}
                icon={FolderTreeIcon}
                variant="green"
              />
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <Button
                    onClick={() => setShowUpload(!showUpload)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            </div>

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
