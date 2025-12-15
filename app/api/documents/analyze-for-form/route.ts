/**
 * Phase 26.6: Form Auto-Fill API
 *
 * POST /api/documents/analyze-for-form
 * Analyzes a document and returns field mappings for a specific form type.
 *
 * Flow:
 * 1. Upload document to GCS
 * 2. Vision API performs OCR (for images) or unpdf extracts text (for PDFs)
 * 3. Gemini AI (preferred) or OpenAI maps extracted text to form fields
 * 4. Return field mappings with confidence scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getVisionService } from '@/lib/documents/intelligence/services/visionService';
import { uploadDocument } from '@/lib/documents';
import { DocumentCategory, SUPPORTED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/documents/types';
import { isOpenAIConfigured, generateJSONCompletion, truncateToTokenLimit } from '@/lib/ai';
import { isGeminiConfigured, generateGeminiJSONCompletion, listAvailableModels, testGeminiDirectAPI } from '@/lib/ai/gemini';
import {
  extractABN,
  extractGST,
  extractDates,
  extractCurrencyValues,
  parseAustralianCurrency,
} from '@/lib/documents/intelligence/parsers/australian';
import { classifyDocument } from '@/lib/documents/intelligence/classifiers/documentClassifier';

// PDF parsing function using unpdf (designed for serverless/edge)
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('[PDF] Starting extraction with unpdf, buffer size:', buffer.length);

  try {
    // Use unpdf which is specifically designed for serverless environments
    // It uses WebAssembly and doesn't require canvas/DOM APIs
    const { extractText } = await import('unpdf');

    const { text, totalPages } = await extractText(buffer, { mergePages: true });

    console.log('[PDF] Extraction complete, pages:', totalPages);
    console.log('[PDF] Total extracted text length:', text?.length || 0);

    return text?.trim() || '';
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[PDF] Extraction error:', errorMsg);
    throw new Error(`PDF extraction failed: ${errorMsg}`);
  }
}

// ============================================================================
// Types
// ============================================================================

type FormType = 'expense' | 'income' | 'loan' | 'property';

interface FormFieldDefinition {
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  label: string;
  options?: string[];
}

interface FieldMapping {
  value: unknown;
  confidence: number;
  source: 'ocr' | 'ai_inference' | 'ai_generated';
  reason?: string;
}

interface AnalyzeForFormResponse {
  success: boolean;
  documentId?: string;
  storageUrl?: string;
  fieldMappings?: Record<string, FieldMapping>;
  lowConfidenceFields?: string[];
  documentType?: string;
  rawText?: string;
  error?: string;
}

// ============================================================================
// OpenAI Prompts
// ============================================================================

const FORM_AUTOFILL_SYSTEM_PROMPT = `You are an expert at extracting data from Australian financial documents and mapping them to form fields.

Your task is to analyze OCR text from a document and extract values that match the provided form fields.

IMPORTANT RULES:
1. Only extract values you can clearly identify in the text
2. Provide confidence scores (0.0-1.0) based on how certain you are
3. Use "ocr" source when directly extracting from text
4. Use "ai_inference" source when deriving/inferring values
5. Include a brief "reason" for ai_inference values
6. Return values in the correct type for each field
7. For amounts, extract the main/total amount as a number (no $ symbol)
8. For vendor, extract the company or business name issuing the document

AUSTRALIAN SPECIFICS:
- Dates are typically DD/MM/YYYY format - convert to YYYY-MM-DD (ISO)
- GST is 10% in Australia - if not shown, calculate as total/11
- ABN format: XX XXX XXX XXX (11 digits)
- Currency is AUD ($ symbol means Australian dollars)

EXPENSE CATEGORY MAPPING:
- CTP, green slip, compulsory third party, motor vehicle insurance → INSURANCE
- Insurance, policy, premium, cover → INSURANCE
- Bunnings, hardware, paint, tools, repairs → MAINTENANCE
- Council, rates, property tax → RATES
- Electricity, gas, water, internet, phone → UTILITIES
- Strata, body corporate, levies → STRATA
- Real estate agent, property management → OTHER
- Land tax → LAND_TAX
- Loan interest, bank fees → LOAN_INTEREST
- Car rego, registration → REGISTRATION
- Netflix, Spotify, Disney+, streaming, subscription, membership, SaaS, software license → SUBSCRIPTION

Return a JSON object with this exact structure:
{
  "fieldMappings": {
    "vendor": { "value": "Company Name", "confidence": 0.9, "source": "ocr" },
    "amount": { "value": 123.45, "confidence": 0.95, "source": "ocr" },
    "description": { "value": "Brief description of what this is", "confidence": 0.8, "source": "ai_inference", "reason": "Derived from document content" },
    "category": { "value": "INSURANCE", "confidence": 0.9, "source": "ai_inference", "reason": "Document is a CTP insurance policy" },
    "taxDeductible": { "value": false, "confidence": 0.7, "source": "ai_inference", "reason": "Personal vehicle insurance is not typically tax deductible" }
  }
}

Only include fields where you found or can infer relevant data.`;

function buildUserPrompt(
  formType: FormType,
  formFields: Record<string, FormFieldDefinition>,
  ocrText: string,
  propertyContext?: string
): string {
  const fieldDescriptions = Object.entries(formFields)
    .map(([name, def]) => {
      let desc = `- ${name} (${def.type}): ${def.label}`;
      if (def.options) {
        desc += ` [Options: ${def.options.join(', ')}]`;
      }
      return desc;
    })
    .join('\n');

  let prompt = `FORM TYPE: ${formType}

AVAILABLE FORM FIELDS:
${fieldDescriptions}

${propertyContext ? `CONTEXT: This expense is for an investment property, so it may be tax deductible.\n\n` : ''}
DOCUMENT TEXT (from OCR):
"""
${ocrText}
"""

Extract all relevant values from the document text and map them to the form fields. Return the JSON response.`;

  return prompt;
}

// ============================================================================
// Default Form Fields
// ============================================================================

const DEFAULT_EXPENSE_FIELDS: Record<string, FormFieldDefinition> = {
  vendor: { type: 'string', label: 'Vendor/Payee Name' },
  amount: { type: 'number', label: 'Total Amount (AUD)' },
  date: { type: 'date', label: 'Date (YYYY-MM-DD)' },
  category: {
    type: 'enum',
    label: 'Expense Category',
    options: [
      'HOUSING', 'RATES', 'INSURANCE', 'MAINTENANCE', 'PERSONAL',
      'UTILITIES', 'FOOD', 'TRANSPORT', 'ENTERTAINMENT', 'SUBSCRIPTION',
      'STRATA', 'LAND_TAX', 'LOAN_INTEREST', 'REGISTRATION', 'MODIFICATIONS', 'OTHER'
    ],
  },
  description: { type: 'string', label: 'Description' },
  taxDeductible: { type: 'boolean', label: 'Is Tax Deductible' },
  gst: { type: 'number', label: 'GST Amount (AUD)' },
};

const DEFAULT_INCOME_FIELDS: Record<string, FormFieldDefinition> = {
  source: { type: 'string', label: 'Income Source' },
  amount: { type: 'number', label: 'Amount (AUD)' },
  date: { type: 'date', label: 'Date (YYYY-MM-DD)' },
  description: { type: 'string', label: 'Description' },
  frequency: {
    type: 'enum',
    label: 'Frequency',
    options: ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'],
  },
};

const DEFAULT_LOAN_FIELDS: Record<string, FormFieldDefinition> = {
  lender: { type: 'string', label: 'Lender Name' },
  principalAmount: { type: 'number', label: 'Principal Amount (AUD)' },
  interestRate: { type: 'number', label: 'Interest Rate (%)' },
  loanTerm: { type: 'number', label: 'Loan Term (months)' },
  repaymentAmount: { type: 'number', label: 'Repayment Amount (AUD)' },
  accountNumber: { type: 'string', label: 'Account Number' },
};

function getDefaultFormFields(formType: FormType): Record<string, FormFieldDefinition> {
  switch (formType) {
    case 'expense':
      return DEFAULT_EXPENSE_FIELDS;
    case 'income':
      return DEFAULT_INCOME_FIELDS;
    case 'loan':
      return DEFAULT_LOAN_FIELDS;
    default:
      return DEFAULT_EXPENSE_FIELDS;
  }
}

// ============================================================================
// Pattern-based extraction (fallback when OpenAI not available)
// ============================================================================

function extractFieldsWithPatterns(
  text: string,
  formType: FormType
): Record<string, FieldMapping> {
  const mappings: Record<string, FieldMapping> = {};

  // Extract ABN
  const abn = extractABN(text);
  if (abn) {
    mappings.abn = { value: abn.abn, confidence: abn.confidence, source: 'ocr' };
  }

  // Extract dates
  const dates = extractDates(text);
  if (dates.length > 0) {
    // Use the first date as the document date
    mappings.date = {
      value: dates[0].date,  // Already in ISO format YYYY-MM-DD
      confidence: dates[0].confidence,
      source: 'ocr',
    };
  }

  // Extract currency values
  const amounts = extractCurrencyValues(text);
  if (amounts.length > 0) {
    // Find the total (usually labeled) or largest amount
    const totalEntry = amounts.find(a => a.context === 'total') || amounts[0];
    const totalValue = totalEntry.value;
    mappings.amount = { value: totalValue, confidence: totalEntry.confidence, source: 'ocr' };

    // Extract GST
    const gstInfo = extractGST(text, totalValue);
    if (gstInfo && gstInfo.gst > 0) {
      mappings.gst = { value: gstInfo.gst, confidence: gstInfo.confidence, source: 'ocr' };
    }
  }

  // Extract vendor from first line (common pattern)
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 2 && firstLine.length < 50) {
      mappings.vendor = { value: firstLine, confidence: 0.70, source: 'ocr' };
    }
  }

  return mappings;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeForFormResponse>> {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const formType = (formData.get('formType') as FormType) || 'expense';
    const formFieldsStr = formData.get('formFields') as string | null;
    const propertyId = formData.get('propertyId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large' },
        { status: 400 }
      );
    }

    // Parse form fields or use defaults
    let formFields: Record<string, FormFieldDefinition>;
    try {
      formFields = formFieldsStr
        ? JSON.parse(formFieldsStr)
        : getDefaultFormFields(formType);
    } catch {
      formFields = getDefaultFormFields(formType);
    }

    console.log('[Form Auto-Fill] Processing document for form:', formType);

    // Step 1: Get file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isPDF = file.type === 'application/pdf';

    // Step 2: Extract text based on file type
    let ocrText = '';

    if (isPDF) {
      // For PDFs: Use unpdf to extract embedded text
      console.log('[Form Auto-Fill] Extracting text from PDF...');
      try {
        ocrText = await extractTextFromPDF(fileBuffer);
        console.log('[Form Auto-Fill] PDF text extracted, length:', ocrText.length);

        if (!ocrText.trim()) {
          // PDF has no extractable text (might be a scanned document)
          return NextResponse.json(
            {
              success: false,
              error: 'This PDF appears to be a scanned document with no extractable text. Please try uploading an image (JPG/PNG) of the document instead.',
            },
            { status: 400 }
          );
        }
      } catch (pdfError) {
        console.error('[Form Auto-Fill] PDF parsing error:', pdfError);
        return NextResponse.json(
          { success: false, error: 'Failed to read PDF file. Please ensure the PDF is not corrupted or try uploading an image instead.' },
          { status: 400 }
        );
      }
    } else {
      // For images: Use Vision API OCR
      const visionService = getVisionService();
      if (!visionService.isAvailable()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Document analysis is not available. Vision API not configured.',
          },
          { status: 503 }
        );
      }

      console.log('[Form Auto-Fill] Performing OCR on image...');
      const ocrResult = await visionService.detectText(fileBuffer);

      if (!ocrResult.success || !ocrResult.text) {
        return NextResponse.json(
          { success: false, error: ocrResult.error || 'OCR failed - no text detected' },
          { status: 500 }
        );
      }

      ocrText = ocrResult.text;
      console.log('[Form Auto-Fill] OCR complete, text length:', ocrText.length);
    }

    // Step 4: Classify document type
    const classification = classifyDocument(ocrText);
    console.log('[Form Auto-Fill] Document classified as:', classification.documentType);

    // Step 5: Upload document to storage
    let documentId: string | undefined;
    let storageUrl: string | undefined;

    try {
      // Map form type to document category
      const categoryMap: Record<FormType, DocumentCategory> = {
        expense: DocumentCategory.RECEIPT,
        income: DocumentCategory.STATEMENT,
        loan: DocumentCategory.MORTGAGE,
        property: DocumentCategory.VALUATION,
      };

      const uploadResult = await uploadDocument(user.id, {
        file,
        filename: file.name,
        mimeType: file.type,
        category: categoryMap[formType] || DocumentCategory.OTHER,
        description: `Auto-uploaded for ${formType} form`,
        tags: ['form-autofill', formType],
      });

      if (uploadResult.success && uploadResult.document) {
        documentId = uploadResult.document.id;
        storageUrl = uploadResult.signedUrl;
      }
    } catch (uploadError) {
      console.error('[Form Auto-Fill] Document upload failed:', uploadError);
      // Continue without document storage - we can still extract fields
    }

    // Step 6: Extract fields using AI (Gemini preferred, OpenAI fallback, then pattern matching)
    let fieldMappings: Record<string, FieldMapping>;
    const truncatedText = truncateToTokenLimit(ocrText, 3000);
    const userPrompt = buildUserPrompt(
      formType,
      formFields,
      truncatedText,
      propertyId ? 'investment property' : undefined
    );

    console.log('[Form Auto-Fill] OCR text preview:', truncatedText.substring(0, 500));

    if (isGeminiConfigured()) {
      // Use Gemini AI (preferred - cheaper and uses same Google account)
      console.log('[Form Auto-Fill] Using Google Gemini for field mapping...');

      // Run direct API test first to diagnose issues
      console.log('[Form Auto-Fill] Running Gemini API diagnostic test...');
      const testResult = await testGeminiDirectAPI();
      console.log('[Form Auto-Fill] Gemini test result:', JSON.stringify(testResult));

      if (!testResult.success) {
        console.error('[Form Auto-Fill] Gemini API test failed:', testResult.error);
        console.log('[Form Auto-Fill] Available models from test:', testResult.models?.join(', ') || 'none');
      }

      try {
        const aiResult = await generateGeminiJSONCompletion<{ fieldMappings: Record<string, FieldMapping> }>({
          systemPrompt: FORM_AUTOFILL_SYSTEM_PROMPT,
          userPrompt,
          temperature: 0.2,
        });

        console.log('[Form Auto-Fill] Gemini response:', JSON.stringify(aiResult.data, null, 2));

        if (aiResult && aiResult.data && aiResult.data.fieldMappings) {
          fieldMappings = aiResult.data.fieldMappings;
          console.log('[Form Auto-Fill] Gemini extraction complete, fields:', Object.keys(fieldMappings));
        } else {
          console.log('[Form Auto-Fill] Gemini returned no mappings, falling back to patterns');
          fieldMappings = extractFieldsWithPatterns(ocrText, formType);
        }
      } catch (aiError) {
        console.error('[Form Auto-Fill] Gemini extraction failed:', aiError);
        console.error('[Form Auto-Fill] Gemini error details:', aiError instanceof Error ? aiError.message : String(aiError));

        // Debug: List available models to help diagnose API key issues
        console.log('[Form Auto-Fill] Checking available Gemini models...');
        const availableModels = await listAvailableModels();
        console.log('[Form Auto-Fill] Available models:', availableModels.length > 0 ? availableModels.join(', ') : 'NONE - API key may be invalid');

        fieldMappings = extractFieldsWithPatterns(ocrText, formType);
      }
    } else if (isOpenAIConfigured()) {
      // Fallback to OpenAI if Gemini not configured
      console.log('[Form Auto-Fill] Using OpenAI for field mapping...');

      try {
        const aiResult = await generateJSONCompletion<{ fieldMappings: Record<string, FieldMapping> }>({
          systemPrompt: FORM_AUTOFILL_SYSTEM_PROMPT,
          userPrompt,
          temperature: 0.2,
        });

        console.log('[Form Auto-Fill] OpenAI response:', JSON.stringify(aiResult.data, null, 2));

        if (aiResult && aiResult.data && aiResult.data.fieldMappings) {
          fieldMappings = aiResult.data.fieldMappings;
          console.log('[Form Auto-Fill] OpenAI extraction complete, fields:', Object.keys(fieldMappings));
        } else {
          console.log('[Form Auto-Fill] OpenAI returned no mappings, falling back to patterns');
          fieldMappings = extractFieldsWithPatterns(ocrText, formType);
        }
      } catch (aiError) {
        console.error('[Form Auto-Fill] OpenAI extraction failed:', aiError);
        console.error('[Form Auto-Fill] OpenAI error details:', aiError instanceof Error ? aiError.message : String(aiError));
        fieldMappings = extractFieldsWithPatterns(ocrText, formType);
      }
    } else {
      console.log('[Form Auto-Fill] No AI configured, using pattern matching');
      fieldMappings = extractFieldsWithPatterns(ocrText, formType);
    }

    // Step 7: Identify low confidence fields
    const lowConfidenceFields = Object.entries(fieldMappings)
      .filter(([_, mapping]) => mapping.confidence < 0.8)
      .map(([field]) => field);

    // Step 8: Return response
    return NextResponse.json({
      success: true,
      documentId,
      storageUrl,
      fieldMappings,
      lowConfidenceFields,
      documentType: classification.documentType,
      rawText: ocrText.substring(0, 1000), // Truncate for response
    });
  } catch (error) {
    console.error('[Form Auto-Fill] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze document',
      },
      { status: 500 }
    );
  }
}
