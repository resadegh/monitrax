/**
 * Phase 26: Document Intelligence Engine
 *
 * Central orchestrator for document analysis. This engine:
 * 1. Integrates with the Document Management Engine (Phase 25) for storage
 * 2. Uses Google Cloud Vision for OCR text extraction
 * 3. Routes documents to appropriate analyzers based on type
 * 4. Stores analysis results in DocumentAnalysis model
 *
 * Architecture:
 * - OCR: Google Cloud Vision API
 * - Tier 1 (Receipts, Invoices): Pattern-based analyzers
 * - Tier 3 (Contracts, Policies): AI-powered (OpenAI integration from lib/ai)
 */

import { prisma } from '@/lib/db';
import { DocumentAnalysisType, DocumentAnalysisStatus } from '@prisma/client';
import { getVisionService } from './services/visionService';
import { classifyDocument, classifyByFilename } from './classifiers/documentClassifier';
import { analyzeReceipt } from './analyzers/receiptAnalyzer';
import { analyzeInvoice } from './analyzers/invoiceAnalyzer';
import { analyzeDocumentWithAI, isAIAnalysisAvailable } from './analyzers/aiDocumentAnalyzer';
import {
  AnalysisResult,
  AnalysisRequest,
  AnalysisResponse,
  SuggestedAction,
} from './types';
import { getGoogleCloudStorageProvider } from '../storage/googleCloudStorageProvider';
import { StorageProviderType } from '../types';

// ============================================================================
// Configuration
// ============================================================================

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
];

const SUPPORTED_PDF_TYPE = 'application/pdf';

// Document types that use pattern-based analysis (Tier 1 & 2)
const PATTERN_ANALYZED_TYPES: DocumentAnalysisType[] = [
  'RECEIPT',
  'INVOICE',
  'UTILITY_BILL',
  'RATE_NOTICE',
  'BANK_STATEMENT',
];

// Document types that require AI analysis (Tier 3)
const AI_ANALYZED_TYPES: DocumentAnalysisType[] = [
  'LOAN_CONTRACT',
  'LOAN_STATEMENT',
  'INSURANCE_POLICY',
  'LEASE_AGREEMENT',
  'VALUATION_REPORT',
  'TAX_DOCUMENT',
];

// ============================================================================
// Document Intelligence Engine
// ============================================================================

export class DocumentIntelligenceEngine {
  private static instance: DocumentIntelligenceEngine;

  private constructor() {}

  static getInstance(): DocumentIntelligenceEngine {
    if (!DocumentIntelligenceEngine.instance) {
      DocumentIntelligenceEngine.instance = new DocumentIntelligenceEngine();
    }
    return DocumentIntelligenceEngine.instance;
  }

  /**
   * Check if the Vision API is available for OCR
   */
  isVisionAvailable(): boolean {
    return getVisionService().isAvailable();
  }

  /**
   * Check if AI analysis is available for complex documents
   */
  isAIAvailable(): boolean {
    return isAIAnalysisAvailable();
  }

  /**
   * Analyze an already-uploaded document
   */
  async analyzeDocument(request: AnalysisRequest): Promise<AnalysisResponse> {
    const { documentId, forceReanalyze = false } = request;

    console.log('[DIE] Starting analysis for document:', documentId);

    try {
      // Step 1: Fetch document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { analysis: true },
      });

      if (!document) {
        return { success: false, error: 'Document not found' };
      }

      // Step 2: Check if already analyzed (unless force reanalyze)
      if (document.analysis && !forceReanalyze) {
        if (document.analysis.status === 'COMPLETED') {
          console.log('[DIE] Returning existing analysis');
          return this.formatAnalysisResponse(document.analysis);
        }
        if (document.analysis.status === 'PROCESSING') {
          return { success: false, error: 'Analysis already in progress' };
        }
      }

      // Step 3: Create or update analysis record with PROCESSING status
      const analysis = await prisma.documentAnalysis.upsert({
        where: { documentId },
        create: {
          documentId,
          status: 'PROCESSING',
        },
        update: {
          status: 'PROCESSING',
          errorMessage: null,
        },
      });

      // Step 4: Get document content
      const fileBuffer = await this.getDocumentContent(document);
      if (!fileBuffer) {
        await this.updateAnalysisFailed(analysis.id, 'Could not retrieve document content');
        return { success: false, error: 'Could not retrieve document content' };
      }

      // Step 5: Perform OCR if needed
      let text = '';
      let ocrConfidence = 0;

      if (this.isImageOrPDF(document.mimeType)) {
        if (!this.isVisionAvailable()) {
          await this.updateAnalysisFailed(analysis.id, 'Vision API not configured');
          return { success: false, error: 'Vision API not configured for OCR' };
        }

        console.log('[DIE] Performing OCR...');
        const ocrResult = await getVisionService().detectText(fileBuffer);

        if (!ocrResult.success) {
          await this.updateAnalysisFailed(analysis.id, ocrResult.error || 'OCR failed');
          return { success: false, error: ocrResult.error || 'OCR failed' };
        }

        text = ocrResult.text || '';
        ocrConfidence = ocrResult.confidence || 0;
        console.log('[DIE] OCR complete, text length:', text.length);
      }

      // Step 6: Classify document type
      const filenameHint = classifyByFilename(document.originalFilename);
      const classification = classifyDocument(text);

      // Use filename hint if text classification is uncertain
      const documentType =
        classification.confidence > 0.5
          ? classification.documentType
          : filenameHint.suggestedType || classification.documentType;

      const typeConfidence = Math.max(
        classification.confidence,
        filenameHint.confidence
      );

      console.log('[DIE] Document classified as:', documentType, 'confidence:', typeConfidence);

      // Step 7: Run appropriate analyzer
      let analysisResult: AnalysisResult;

      if (PATTERN_ANALYZED_TYPES.includes(documentType)) {
        analysisResult = await this.runPatternAnalyzer(documentType, text, document.originalFilename);
      } else if (AI_ANALYZED_TYPES.includes(documentType) && this.isAIAvailable()) {
        analysisResult = await analyzeDocumentWithAI({
          documentType,
          text,
          filename: document.originalFilename,
        });
      } else {
        // Generic analysis for unknown types
        analysisResult = this.createGenericAnalysis(documentType, text, typeConfidence);
      }

      // Step 8: Update analysis record with results
      const updatedAnalysis = await prisma.documentAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'COMPLETED',
          analyzedAt: new Date(),
          analyzerVersion: analysisResult.analyzerVersion,
          processingTimeMs: analysisResult.processingTimeMs,
          documentType,
          typeConfidence,
          extractedData: analysisResult.extractedData as object,
          rawText: analysisResult.rawText?.substring(0, 50000) || null,  // Limit stored text
          overallConfidence: analysisResult.overallConfidence,
          lowConfidenceFields: analysisResult.lowConfidenceFields,
          suggestedActions: analysisResult.suggestedActions as unknown as object,
        },
      });

      console.log('[DIE] Analysis complete:', {
        documentType,
        confidence: analysisResult.overallConfidence,
        actionsCount: analysisResult.suggestedActions.length,
      });

      return this.formatAnalysisResponse(updatedAnalysis);
    } catch (error) {
      console.error('[DIE] Analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  }

  /**
   * Run pattern-based analyzer for Tier 1/2 documents
   */
  private async runPatternAnalyzer(
    documentType: DocumentAnalysisType,
    text: string,
    filename: string
  ): Promise<AnalysisResult> {
    switch (documentType) {
      case 'RECEIPT':
        return analyzeReceipt(text, filename);
      case 'INVOICE':
        return analyzeInvoice(text, filename);
      // Add more analyzers as implemented
      case 'UTILITY_BILL':
      case 'RATE_NOTICE':
      case 'BANK_STATEMENT':
        // For now, fall back to receipt/invoice patterns
        // These can be specialized later
        return analyzeReceipt(text, filename);
      default:
        return this.createGenericAnalysis(documentType, text, 0.5);
    }
  }

  /**
   * Create a generic analysis result for unrecognized documents
   */
  private createGenericAnalysis(
    documentType: DocumentAnalysisType,
    text: string,
    typeConfidence: number
  ): AnalysisResult {
    return {
      documentType,
      typeConfidence,
      extractedData: {},
      rawText: text,
      overallConfidence: typeConfidence * 0.5,
      lowConfidenceFields: [],
      suggestedActions: [],
      analyzerVersion: 'generic-v1',
      processingTimeMs: 0,
    };
  }

  /**
   * Get document content from storage
   */
  private async getDocumentContent(document: {
    storageProvider: string;
    storagePath: string;
    fileContent: Buffer | null;
  }): Promise<Buffer | null> {
    // If content is stored in database
    if (document.fileContent) {
      return document.fileContent;
    }

    // If stored in GCS
    if (document.storageProvider === StorageProviderType.GOOGLE_CLOUD_STORAGE) {
      try {
        const gcs = getGoogleCloudStorageProvider();
        await gcs.initialize();
        return await gcs.downloadFile(document.storagePath);
      } catch (error) {
        console.error('[DIE] Failed to download from GCS:', error);
        return null;
      }
    }

    // Local drive storage - can't retrieve content server-side
    if (document.storageProvider === StorageProviderType.LOCAL_DRIVE) {
      console.warn('[DIE] Cannot analyze LOCAL_DRIVE documents server-side');
      return null;
    }

    return null;
  }

  /**
   * Check if MIME type is an image or PDF
   */
  private isImageOrPDF(mimeType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.includes(mimeType) || mimeType === SUPPORTED_PDF_TYPE;
  }

  /**
   * Update analysis record as failed
   */
  private async updateAnalysisFailed(analysisId: string, error: string): Promise<void> {
    await prisma.documentAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'FAILED',
        errorMessage: error,
      },
    });
  }

  /**
   * Format analysis for API response
   */
  private formatAnalysisResponse(analysis: {
    id: string;
    documentId: string;
    status: DocumentAnalysisStatus;
    documentType: DocumentAnalysisType;
    typeConfidence: number;
    overallConfidence: number;
    extractedData: unknown;
    lowConfidenceFields: string[];
    suggestedActions: unknown;
    rawText: string | null;
    analyzedAt: Date | null;
    userVerified: boolean;
    errorMessage: string | null;
  }): AnalysisResponse {
    if (analysis.status === 'FAILED') {
      return {
        success: false,
        error: analysis.errorMessage || 'Analysis failed',
      };
    }

    return {
      success: true,
      analysis: {
        id: analysis.id,
        documentId: analysis.documentId,
        documentType: analysis.documentType,
        typeConfidence: analysis.typeConfidence,
        overallConfidence: analysis.overallConfidence,
        extractedData: analysis.extractedData as Record<string, unknown>,
        lowConfidenceFields: analysis.lowConfidenceFields,
        suggestedActions: (analysis.suggestedActions || []) as SuggestedAction[],
        rawText: analysis.rawText || undefined,
        status: analysis.status,
        analyzedAt: analysis.analyzedAt || undefined,
        userVerified: analysis.userVerified,
      },
    };
  }

  /**
   * Get analysis status for a document
   */
  async getAnalysisStatus(documentId: string): Promise<{
    exists: boolean;
    status?: DocumentAnalysisStatus;
    analysisId?: string;
  }> {
    const analysis = await prisma.documentAnalysis.findUnique({
      where: { documentId },
      select: { id: true, status: true },
    });

    if (!analysis) {
      return { exists: false };
    }

    return {
      exists: true,
      status: analysis.status,
      analysisId: analysis.id,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export function getDocumentIntelligenceEngine(): DocumentIntelligenceEngine {
  return DocumentIntelligenceEngine.getInstance();
}
