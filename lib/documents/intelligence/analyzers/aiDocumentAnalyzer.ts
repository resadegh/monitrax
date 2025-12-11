/**
 * Phase 26: AI-Powered Document Analyzer
 *
 * Uses the existing OpenAI integration (from lib/ai) for complex documents
 * that require AI understanding:
 * - Contracts
 * - Policies
 * - Lease agreements
 * - Complex financial documents
 *
 * This extends the pattern-based analyzers for Tier 3 documents.
 */

import {
  isOpenAIConfigured,
  generateJSONCompletion,
  AI_MODELS,
  truncateToTokenLimit,
} from '@/lib/ai';
import {
  AnalysisResult,
  SuggestedAction,
  LoanDocumentExtraction,
  InsurancePolicyExtraction,
  LeaseAgreementExtraction,
  DocumentAnalysisType,
} from '../types';

// ============================================================================
// System Prompts for Document Analysis
// ============================================================================

const DOCUMENT_ANALYSIS_SYSTEM_PROMPT = `You are an expert Australian financial document analyzer. Your task is to extract structured data from documents with high accuracy.

IMPORTANT RULES:
1. All monetary values should be in AUD (Australian Dollars)
2. All dates should be in ISO format (YYYY-MM-DD)
3. Australian Business Numbers (ABN) should be formatted as XX XXX XXX XXX
4. If you're not confident about a field, set its confidence to a lower value (0.0-1.0)
5. Only extract information that is explicitly stated in the document
6. Do not make assumptions or infer values that aren't clearly stated

For each extracted field, provide:
- value: The extracted value
- confidence: Your confidence in the extraction (0.0 to 1.0)
- source: Always "ai"`;

const LOAN_CONTRACT_PROMPT = `Extract loan contract details from the following document.

Required fields (if present):
- lender: Name of the lending institution
- loanType: Type of loan (HOME_LOAN, INVESTMENT_LOAN, PERSONAL, CAR, or OTHER)
- principalAmount: The loan principal amount
- interestRate: Annual interest rate as a decimal (e.g., 0.0625 for 6.25%)
- rateType: VARIABLE or FIXED
- loanTerm: Loan term in months
- repaymentType: PRINCIPAL_AND_INTEREST or INTEREST_ONLY
- repaymentFrequency: WEEKLY, FORTNIGHTLY, or MONTHLY
- repaymentAmount: Regular repayment amount
- settlementDate: Settlement/start date
- propertyAddress: Address of secured property (if applicable)
- accountNumber: Loan account number
- bsb: BSB number

Respond with a JSON object following this schema:
{
  "lender": { "value": string, "confidence": number, "source": "ai" },
  "loanType": { "value": string, "confidence": number, "source": "ai" },
  "principalAmount": { "value": number, "confidence": number, "source": "ai" },
  "interestRate": { "value": number, "confidence": number, "source": "ai" },
  "rateType": { "value": string, "confidence": number, "source": "ai" },
  // ... other fields as applicable
}`;

const INSURANCE_POLICY_PROMPT = `Extract insurance policy details from the following document.

Required fields (if present):
- insurer: Name of the insurance company
- policyNumber: Policy number
- policyType: BUILDING, CONTENTS, LANDLORD, CAR, HEALTH, LIFE, or OTHER
- premium: Annual or monthly premium amount
- premiumFrequency: MONTHLY or ANNUAL
- coverAmount: Total coverage amount
- excessAmount: Excess/deductible amount
- policyStart: Policy start date
- policyEnd: Policy end/renewal date
- insuredProperty: Address of insured property
- insuredItems: List of specifically insured items

Respond with a JSON object following this schema:
{
  "insurer": { "value": string, "confidence": number, "source": "ai" },
  "policyNumber": { "value": string, "confidence": number, "source": "ai" },
  "policyType": { "value": string, "confidence": number, "source": "ai" },
  // ... other fields as applicable
}`;

const LEASE_AGREEMENT_PROMPT = `Extract residential lease/tenancy agreement details from the following document.

Required fields (if present):
- landlord: Name of the landlord/property owner
- tenant: Name(s) of the tenant(s)
- propertyAddress: Address of the rental property
- rentAmount: Weekly or monthly rent amount
- rentFrequency: WEEKLY, FORTNIGHTLY, or MONTHLY
- leaseStart: Lease start date
- leaseEnd: Lease end date
- bond: Bond/security deposit amount

Respond with a JSON object following this schema:
{
  "landlord": { "value": string, "confidence": number, "source": "ai" },
  "tenant": { "value": string, "confidence": number, "source": "ai" },
  "propertyAddress": { "value": string, "confidence": number, "source": "ai" },
  "rentAmount": { "value": number, "confidence": number, "source": "ai" },
  // ... other fields as applicable
}`;

// ============================================================================
// AI Document Analyzer
// ============================================================================

export interface AIAnalyzerOptions {
  documentType: DocumentAnalysisType;
  text: string;
  filename?: string;
}

/**
 * Check if AI analysis is available (OpenAI configured)
 */
export function isAIAnalysisAvailable(): boolean {
  return isOpenAIConfigured();
}

/**
 * Analyze a document using OpenAI for complex understanding
 */
export async function analyzeDocumentWithAI(
  options: AIAnalyzerOptions
): Promise<AnalysisResult> {
  const { documentType, text, filename } = options;
  const startTime = Date.now();

  if (!isOpenAIConfigured()) {
    return {
      documentType,
      typeConfidence: 0,
      extractedData: {},
      rawText: text,
      overallConfidence: 0,
      lowConfidenceFields: [],
      suggestedActions: [],
      analyzerVersion: 'ai-unavailable',
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Select the appropriate prompt based on document type
  let userPrompt: string;
  switch (documentType) {
    case 'LOAN_CONTRACT':
    case 'LOAN_STATEMENT':
      userPrompt = LOAN_CONTRACT_PROMPT;
      break;
    case 'INSURANCE_POLICY':
      userPrompt = INSURANCE_POLICY_PROMPT;
      break;
    case 'LEASE_AGREEMENT':
      userPrompt = LEASE_AGREEMENT_PROMPT;
      break;
    default:
      // Generic extraction for unknown types
      userPrompt = `Extract any relevant financial information from this document.
Include vendor names, amounts, dates, and any identifying numbers.`;
  }

  // Truncate text to fit within token limits
  const truncatedText = truncateToTokenLimit(text, 8000);

  try {
    const result = await generateJSONCompletion<Record<string, unknown>>({
      model: AI_MODELS.QUICK_RESPONSE,  // Use cost-effective model
      systemPrompt: DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
      userPrompt: `${userPrompt}\n\nDocument text:\n${truncatedText}`,
      maxTokens: 2000,
      temperature: 0.3,  // Lower temperature for more consistent extraction
    });

    const extractedData = result.data;

    // Calculate overall confidence from extracted fields
    let totalConfidence = 0;
    let fieldCount = 0;
    const lowConfidenceFields: string[] = [];

    for (const [key, field] of Object.entries(extractedData)) {
      if (field && typeof field === 'object' && 'confidence' in field) {
        const conf = (field as { confidence: number }).confidence;
        totalConfidence += conf;
        fieldCount++;
        if (conf < 0.7) {
          lowConfidenceFields.push(key);
        }
      }
    }

    const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    // Build suggested actions based on document type
    const suggestedActions = buildSuggestedActions(documentType, extractedData);

    return {
      documentType,
      typeConfidence: 0.85,  // AI classification confidence
      extractedData,
      rawText: text,
      overallConfidence,
      lowConfidenceFields,
      suggestedActions,
      analyzerVersion: 'ai-gpt4o-mini-v1',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[AIAnalyzer] Analysis failed:', error);
    return {
      documentType,
      typeConfidence: 0,
      extractedData: {},
      rawText: text,
      overallConfidence: 0,
      lowConfidenceFields: [],
      suggestedActions: [],
      analyzerVersion: 'ai-error',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Build suggested actions based on extracted data
 */
function buildSuggestedActions(
  documentType: DocumentAnalysisType,
  extractedData: Record<string, unknown>
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  switch (documentType) {
    case 'LOAN_CONTRACT':
    case 'LOAN_STATEMENT': {
      const data = extractedData as Partial<{
        lender: { value: string; confidence: number };
        principalAmount: { value: number; confidence: number };
        interestRate: { value: number; confidence: number };
      }>;

      if (data.lender?.value && data.principalAmount?.value) {
        actions.push({
          action: 'CREATE_LOAN',
          label: 'Create Loan Record',
          description: `Create a loan with ${data.lender.value}`,
          prefilled: {
            name: `${data.lender.value} Loan`,
            principal: data.principalAmount.value,
            interestRate: data.interestRate?.value,
          },
          confidence: Math.min(
            data.lender.confidence,
            data.principalAmount.confidence
          ),
        });
      }
      break;
    }

    case 'INSURANCE_POLICY': {
      const data = extractedData as Partial<{
        insurer: { value: string; confidence: number };
        premium: { value: number; confidence: number };
        premiumFrequency: { value: string; confidence: number };
        policyEnd: { value: string; confidence: number };
      }>;

      if (data.insurer?.value && data.premium?.value) {
        actions.push({
          action: 'CREATE_EXPENSE',
          label: 'Create Insurance Expense',
          description: `Create recurring expense for ${data.insurer.value} premium`,
          prefilled: {
            vendor: data.insurer.value,
            amount: data.premium.value,
            category: 'INSURANCE',
            frequency: data.premiumFrequency?.value === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL',
          },
          confidence: Math.min(
            data.insurer.confidence,
            data.premium.confidence
          ),
        });

        if (data.policyEnd?.value) {
          actions.push({
            action: 'SET_REMINDER',
            label: 'Set Renewal Reminder',
            description: `Set reminder for policy renewal on ${data.policyEnd.value}`,
            prefilled: {
              date: data.policyEnd.value,
              description: `${data.insurer.value} policy renewal`,
            },
            confidence: data.policyEnd.confidence * 0.8,
          });
        }
      }
      break;
    }

    case 'LEASE_AGREEMENT': {
      const data = extractedData as Partial<{
        landlord: { value: string; confidence: number };
        tenant: { value: string; confidence: number };
        rentAmount: { value: number; confidence: number };
        rentFrequency: { value: string; confidence: number };
        propertyAddress: { value: string; confidence: number };
      }>;

      if (data.rentAmount?.value) {
        actions.push({
          action: 'CREATE_INCOME',
          label: 'Create Rental Income',
          description: `Create rental income of $${data.rentAmount.value}`,
          prefilled: {
            name: `Rent from ${data.tenant?.value || 'Tenant'}`,
            amount: data.rentAmount.value,
            type: 'RENTAL',
            frequency: data.rentFrequency?.value || 'WEEKLY',
          },
          confidence: data.rentAmount.confidence,
        });

        if (data.propertyAddress?.value) {
          actions.push({
            action: 'LINK_TO_PROPERTY',
            label: 'Link to Property',
            description: `Link this lease to property at ${data.propertyAddress.value}`,
            prefilled: {
              address: data.propertyAddress.value,
            },
            confidence: data.propertyAddress.confidence * 0.7,
          });
        }
      }
      break;
    }
  }

  return actions;
}

/**
 * Get an explanation of extracted data using AI
 */
export async function explainExtraction(
  documentType: DocumentAnalysisType,
  extractedData: Record<string, unknown>,
  userQuestion: string
): Promise<string> {
  if (!isOpenAIConfigured()) {
    return 'AI explanation is not available. Please ensure OpenAI API is configured.';
  }

  try {
    const result = await generateJSONCompletion<{ explanation: string }>({
      model: AI_MODELS.QUICK_RESPONSE,
      systemPrompt: `You are a helpful assistant explaining document extraction results to Australian users.
Be concise and focus on practical implications.`,
      userPrompt: `Document type: ${documentType}
Extracted data: ${JSON.stringify(extractedData, null, 2)}

User question: ${userQuestion}

Provide a brief, helpful explanation.`,
      maxTokens: 500,
      temperature: 0.7,
    });

    return result.data.explanation || 'Unable to generate explanation.';
  } catch (error) {
    console.error('[AIAnalyzer] Explanation failed:', error);
    return 'Unable to generate explanation at this time.';
  }
}
