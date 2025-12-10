/**
 * Phase 26: Analysis Preview Card
 *
 * Displays the results of document analysis including:
 * - Document type classification
 * - Extracted data with confidence indicators
 * - Suggested actions
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ExtractedField {
  value: unknown;
  confidence: number;
  source?: string;
}

interface SuggestedAction {
  action: string;
  label: string;
  description?: string;
  prefilled: Record<string, unknown>;
  confidence: number;
}

interface AnalysisPreviewCardProps {
  documentType: string;
  typeConfidence: number;
  overallConfidence: number;
  extractedData: Record<string, unknown>;
  lowConfidenceFields: string[];
  suggestedActions: SuggestedAction[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  userVerified?: boolean;
  onAction?: (action: SuggestedAction) => void;
  onReanalyze?: () => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getConfidenceBadge(confidence: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (confidence >= 0.9) return { label: 'High', variant: 'default' };
  if (confidence >= 0.7) return { label: 'Medium', variant: 'secondary' };
  return { label: 'Low', variant: 'destructive' };
}

function formatDocumentType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Format as currency if looks like money
    if (value > 0 && value < 10000000) {
      return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toString();
  }
  if (typeof value === 'string') {
    // Check if it's a date
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(value).toLocaleDateString('en-AU');
    }
    return value;
  }
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// Component
// ============================================================================

export function AnalysisPreviewCard({
  documentType,
  typeConfidence,
  overallConfidence,
  extractedData,
  lowConfidenceFields,
  suggestedActions,
  status,
  userVerified,
  onAction,
  onReanalyze,
  className,
}: AnalysisPreviewCardProps) {
  // Loading state
  if (status === 'PENDING' || status === 'PROCESSING') {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">
            {status === 'PENDING' ? 'Waiting to analyze...' : 'Analyzing document...'}
          </span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (status === 'FAILED') {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-destructive mr-2" />
            <span className="text-destructive">Analysis failed</span>
          </div>
          {onReanalyze && (
            <Button variant="outline" size="sm" onClick={onReanalyze}>
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const confidenceBadge = getConfidenceBadge(overallConfidence);

  // Extract displayable fields (those with value and confidence)
  const displayFields = Object.entries(extractedData)
    .filter(([_, field]) => {
      if (!field || typeof field !== 'object') return false;
      const f = field as ExtractedField;
      return 'value' in f && f.value !== null && f.value !== undefined;
    })
    .slice(0, 8);  // Limit to 8 fields for preview

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {formatDocumentType(documentType)}
            </CardTitle>
            <CardDescription className="mt-1">
              <span className={cn('font-medium', getConfidenceColor(typeConfidence))}>
                {Math.round(typeConfidence * 100)}% confident
              </span>
              {' in document type detection'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {userVerified && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            )}
            <Badge variant={confidenceBadge.variant}>
              {confidenceBadge.label} Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Extracted Fields */}
        {displayFields.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Extracted Data</h4>
            <div className="grid grid-cols-2 gap-2">
              {displayFields.map(([key, field]) => {
                const f = field as ExtractedField;
                const isLowConfidence = lowConfidenceFields.includes(key);

                return (
                  <div
                    key={key}
                    className={cn(
                      'p-2 rounded-md bg-muted/50',
                      isLowConfidence && 'border border-yellow-500/50'
                    )}
                  >
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {formatFieldName(key)}
                      {isLowConfidence && (
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm font-medium truncate">
                      {formatFieldValue(f.value)}
                    </div>
                    <div className={cn('text-xs', getConfidenceColor(f.confidence))}>
                      {Math.round(f.confidence * 100)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Low Confidence Warning */}
        {lowConfidenceFields.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-700 dark:text-yellow-400">
              <span className="font-medium">Review needed:</span> Some fields have low confidence.
              Please verify before confirming.
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              Suggested Actions
            </h4>
            <div className="flex flex-wrap gap-2">
              {suggestedActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => onAction?.(action)}
                  className="gap-1"
                  disabled={userVerified}
                >
                  {action.label}
                  <span className={cn('text-xs', getConfidenceColor(action.confidence))}>
                    ({Math.round(action.confidence * 100)}%)
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Reanalyze Button */}
        {onReanalyze && !userVerified && (
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={onReanalyze}>
              Reanalyze Document
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
