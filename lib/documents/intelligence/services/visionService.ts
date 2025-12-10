/**
 * Phase 26: Google Cloud Vision API Integration
 *
 * Uses the same GCS service account credentials for Vision API access.
 * Provides OCR (text detection) and document type detection.
 */

import { ImageAnnotatorClient, protos } from '@google-cloud/vision';

// ============================================================================
// Types
// ============================================================================

export interface OCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  blocks?: TextBlock[];
  pages?: PageInfo[];
  error?: string;
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PageInfo {
  width: number;
  height: number;
  confidence: number;
}

export interface LabelResult {
  success: boolean;
  labels?: Array<{
    description: string;
    score: number;
    topicality: number;
  }>;
  error?: string;
}

// ============================================================================
// Vision Service
// ============================================================================

class VisionService {
  private client: ImageAnnotatorClient | null = null;
  private initialized = false;

  /**
   * Initialize the Vision API client using the same credentials as GCS
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[Vision] Initializing Google Cloud Vision API...');

    try {
      const projectId = process.env.GCS_PROJECT_ID;
      const serviceAccountKey = process.env.GCS_SERVICE_ACCOUNT_KEY;

      if (!projectId) {
        throw new Error('GCS_PROJECT_ID environment variable is not set');
      }

      if (serviceAccountKey) {
        // Parse base64-encoded service account key (same as GCS)
        const credentials = JSON.parse(
          Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
        );

        console.log('[Vision] Using service account:', credentials.client_email);

        this.client = new ImageAnnotatorClient({
          projectId,
          credentials,
        });
      } else {
        // Fall back to default credentials
        console.log('[Vision] Using default credentials');
        this.client = new ImageAnnotatorClient({
          projectId,
        });
      }

      this.initialized = true;
      console.log('[Vision] Initialized successfully');
    } catch (error) {
      console.error('[Vision] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if Vision API is available
   */
  isAvailable(): boolean {
    const projectId = process.env.GCS_PROJECT_ID;
    const serviceAccountKey = process.env.GCS_SERVICE_ACCOUNT_KEY;
    return !!(projectId && serviceAccountKey);
  }

  /**
   * Perform OCR on an image buffer
   * Uses document text detection for better accuracy on documents
   */
  async detectText(imageBuffer: Buffer, useDocumentMode = true): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Vision API client not initialized',
      };
    }

    try {
      const request: protos.google.cloud.vision.v1.IAnnotateImageRequest = {
        image: { content: imageBuffer.toString('base64') },
        features: [
          {
            type: useDocumentMode
              ? 'DOCUMENT_TEXT_DETECTION'
              : 'TEXT_DETECTION',
            maxResults: 1,
          },
        ],
      };

      const [response] = await this.client.annotateImage(request);

      if (!response || !response.fullTextAnnotation) {
        // Try with regular text detection if document mode failed
        if (useDocumentMode) {
          console.log('[Vision] No text found with document mode, trying regular mode');
          return this.detectText(imageBuffer, false);
        }

        return {
          success: true,
          text: '',
          confidence: 0,
          blocks: [],
        };
      }

      const fullText = response.fullTextAnnotation.text || '';
      const pages = response.fullTextAnnotation.pages || [];

      // Calculate overall confidence from page confidences
      let totalConfidence = 0;
      let blockCount = 0;
      const textBlocks: TextBlock[] = [];
      const pageInfos: PageInfo[] = [];

      for (const page of pages) {
        pageInfos.push({
          width: page.width || 0,
          height: page.height || 0,
          confidence: page.confidence || 0,
        });

        for (const block of page.blocks || []) {
          for (const paragraph of block.paragraphs || []) {
            const paragraphText = (paragraph.words || [])
              .map(word =>
                (word.symbols || []).map(s => s.text || '').join('')
              )
              .join(' ');

            const confidence = paragraph.confidence || 0;
            totalConfidence += confidence;
            blockCount++;

            if (paragraphText.trim()) {
              const vertices = paragraph.boundingBox?.vertices || [];
              const minX = Math.min(...vertices.map(v => v.x || 0));
              const minY = Math.min(...vertices.map(v => v.y || 0));
              const maxX = Math.max(...vertices.map(v => v.x || 0));
              const maxY = Math.max(...vertices.map(v => v.y || 0));

              textBlocks.push({
                text: paragraphText,
                confidence,
                boundingBox: vertices.length >= 4
                  ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
                  : undefined,
              });
            }
          }
        }
      }

      const avgConfidence = blockCount > 0 ? totalConfidence / blockCount : 0;

      return {
        success: true,
        text: fullText,
        confidence: avgConfidence,
        blocks: textBlocks,
        pages: pageInfos,
      };
    } catch (error) {
      console.error('[Vision] OCR error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OCR failed',
      };
    }
  }

  /**
   * Detect labels in an image (for document type classification)
   */
  async detectLabels(imageBuffer: Buffer): Promise<LabelResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Vision API client not initialized',
      };
    }

    try {
      const request: protos.google.cloud.vision.v1.IAnnotateImageRequest = {
        image: { content: imageBuffer.toString('base64') },
        features: [
          {
            type: 'LABEL_DETECTION',
            maxResults: 10,
          },
        ],
      };

      const [response] = await this.client.annotateImage(request);

      if (!response || !response.labelAnnotations) {
        return {
          success: true,
          labels: [],
        };
      }

      const labels = response.labelAnnotations.map(label => ({
        description: label.description || '',
        score: label.score || 0,
        topicality: label.topicality || 0,
      }));

      return {
        success: true,
        labels,
      };
    } catch (error) {
      console.error('[Vision] Label detection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Label detection failed',
      };
    }
  }

  /**
   * Detect safe search properties (useful for filtering inappropriate uploads)
   */
  async detectSafeSearch(imageBuffer: Buffer): Promise<{
    success: boolean;
    isSafe?: boolean;
    details?: Record<string, string>;
    error?: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Vision API client not initialized',
      };
    }

    try {
      const request: protos.google.cloud.vision.v1.IAnnotateImageRequest = {
        image: { content: imageBuffer.toString('base64') },
        features: [
          {
            type: 'SAFE_SEARCH_DETECTION',
          },
        ],
      };

      const [response] = await this.client.annotateImage(request);

      if (!response || !response.safeSearchAnnotation) {
        return {
          success: true,
          isSafe: true,
          details: {},
        };
      }

      const annotation = response.safeSearchAnnotation;
      const details = {
        adult: annotation.adult || 'UNKNOWN',
        violence: annotation.violence || 'UNKNOWN',
        medical: annotation.medical || 'UNKNOWN',
        spoof: annotation.spoof || 'UNKNOWN',
        racy: annotation.racy || 'UNKNOWN',
      };

      // Consider safe if all categories are VERY_UNLIKELY or UNLIKELY
      const unsafeValues = ['POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
      const isSafe = !Object.values(details).some(v =>
        unsafeValues.includes(v as string)
      );

      return {
        success: true,
        isSafe,
        details: details as Record<string, string>,
      };
    } catch (error) {
      console.error('[Vision] Safe search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Safe search detection failed',
      };
    }
  }

  /**
   * Perform full document analysis (OCR + labels)
   */
  async analyzeDocument(imageBuffer: Buffer): Promise<{
    success: boolean;
    text?: string;
    textConfidence?: number;
    labels?: Array<{ description: string; score: number }>;
    error?: string;
  }> {
    const [ocrResult, labelResult] = await Promise.all([
      this.detectText(imageBuffer, true),
      this.detectLabels(imageBuffer),
    ]);

    if (!ocrResult.success) {
      return {
        success: false,
        error: ocrResult.error,
      };
    }

    return {
      success: true,
      text: ocrResult.text,
      textConfidence: ocrResult.confidence,
      labels: labelResult.success ? labelResult.labels : [],
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let serviceInstance: VisionService | null = null;

export function getVisionService(): VisionService {
  if (!serviceInstance) {
    serviceInstance = new VisionService();
  }
  return serviceInstance;
}

export { VisionService };
