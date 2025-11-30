'use client';

/**
 * Phase 19: Documents Library Page
 * Global document management interface with filtering, search, and upload
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Upload,
  Search,
  Filter,
  HardDrive,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { DocumentUploadDropzone, DocumentList } from '@/components/documents';
import { DocumentCategory } from '@/lib/documents/types';
import { StatCard } from '@/components/StatCard';

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
}

interface DocumentsResponse {
  documents: DocumentListItem[];
  total: number;
  hasMore: boolean;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'CONTRACT', label: 'Contracts' },
  { value: 'STATEMENT', label: 'Statements' },
  { value: 'RECEIPT', label: 'Receipts' },
  { value: 'TAX', label: 'Tax Documents' },
  { value: 'PDS', label: 'Product Disclosure' },
  { value: 'VALUATION', label: 'Valuations' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'MORTGAGE', label: 'Mortgage' },
  { value: 'LEASE', label: 'Lease' },
  { value: 'INVOICE', label: 'Invoices' },
  { value: 'OTHER', label: 'Other' },
];

export default function DocumentsLibraryPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      params.set('limit', '50');

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
  }, [token, searchQuery, categoryFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

  // Handle upload
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
    if (description) formData.append('description', description);
    if (tags?.length) formData.append('tags', tags.join(','));

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
    setRefreshKey(k => k + 1);
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
      setDocuments(docs => docs.filter(d => d.id !== id));
      setTotal(t => t - 1);
    }
  };

  // Calculate stats
  const totalSize = documents.reduce((sum, d) => sum + d.size, 0);
  const categoryCount = new Set(documents.map(d => d.category)).size;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
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
            icon={Filter}
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
            <CardContent>
              <DocumentUploadDropzone
                onUpload={handleUpload}
                defaultCategory="OTHER"
              />
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setRefreshKey(k => k + 1)}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>All Documents</span>
              {total > 0 && (
                <Badge variant="secondary">{total} document{total !== 1 ? 's' : ''}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentList
              documents={documents as Parameters<typeof DocumentList>[0]['documents']}
              onView={handleView}
              onDelete={handleDelete}
              loading={isLoading}
              emptyMessage={
                searchQuery || categoryFilter !== 'all'
                  ? 'No documents match your filters'
                  : 'No documents uploaded yet. Click "Upload Document" to get started.'
              }
            />
          </CardContent>
        </Card>
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
