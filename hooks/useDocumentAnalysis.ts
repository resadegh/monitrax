/**
 * Phase 26: Document Analysis Hook
 *
 * React hook for interacting with the Document Intelligence Engine.
 * Provides functions to analyze documents and confirm extracted data.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { SuggestedActionType } from '@/lib/documents/intelligence';

// ============================================================================
// Types
// ============================================================================

export interface AnalysisState {
  id: string;
  documentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  documentType: string;
  typeConfidence: number;
  overallConfidence: number;
  extractedData: Record<string, unknown>;
  lowConfidenceFields: string[];
  suggestedActions: SuggestedAction[];
  userVerified: boolean;
  analyzedAt?: Date;
  errorMessage?: string;
}

export interface SuggestedAction {
  action: SuggestedActionType;
  label: string;
  description?: string;
  prefilled: Record<string, unknown>;
  confidence: number;
}

export interface UseDocumentAnalysisReturn {
  // State
  analysis: AnalysisState | null;
  isAnalyzing: boolean;
  isConfirming: boolean;
  error: string | null;

  // Actions
  analyzeDocument: (documentId: string, forceReanalyze?: boolean) => Promise<AnalysisState | null>;
  getAnalysis: (documentId: string) => Promise<AnalysisState | null>;
  confirmAction: (
    analysisId: string,
    action: SuggestedActionType,
    data: Record<string, unknown>,
    corrections?: Record<string, boolean>
  ) => Promise<{ type: string; id: string; data: Record<string, unknown> } | null>;
  clearError: () => void;
  clearAnalysis: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDocumentAnalysis(): UseDocumentAnalysisReturn {
  const { token } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Analyze a document
   */
  const analyzeDocument = useCallback(
    async (documentId: string, forceReanalyze = false): Promise<AnalysisState | null> => {
      if (!token) {
        setError('Not authenticated');
        return null;
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        const response = await fetch('/api/documents/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentId, forceReanalyze }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Analysis failed');
        }

        const analysisState: AnalysisState = data.analysis;
        setAnalysis(analysisState);
        return analysisState;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        setError(message);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [token]
  );

  /**
   * Get existing analysis for a document
   */
  const getAnalysis = useCallback(
    async (documentId: string): Promise<AnalysisState | null> => {
      if (!token) {
        setError('Not authenticated');
        return null;
      }

      try {
        const response = await fetch(
          `/api/documents/analyze?documentId=${encodeURIComponent(documentId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to get analysis');
        }

        if (data.analysis) {
          setAnalysis(data.analysis);
          return data.analysis;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get analysis';
        setError(message);
        return null;
      }
    },
    [token]
  );

  /**
   * Confirm extracted data and create entity
   */
  const confirmAction = useCallback(
    async (
      analysisId: string,
      action: SuggestedActionType,
      data: Record<string, unknown>,
      corrections?: Record<string, boolean>
    ): Promise<{ type: string; id: string; data: Record<string, unknown> } | null> => {
      if (!token) {
        setError('Not authenticated');
        return null;
      }

      setIsConfirming(true);
      setError(null);

      try {
        const response = await fetch('/api/documents/analyze/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ analysisId, action, data, corrections }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Confirmation failed');
        }

        // Update analysis state to reflect verification
        if (analysis && analysis.id === analysisId) {
          setAnalysis({
            ...analysis,
            userVerified: true,
          });
        }

        return result.entity;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Confirmation failed';
        setError(message);
        return null;
      } finally {
        setIsConfirming(false);
      }
    },
    [token, analysis]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  return {
    analysis,
    isAnalyzing,
    isConfirming,
    error,
    analyzeDocument,
    getAnalysis,
    confirmAction,
    clearError,
    clearAnalysis,
  };
}
