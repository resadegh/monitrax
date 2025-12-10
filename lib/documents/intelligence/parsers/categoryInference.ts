/**
 * Phase 26: Expense Category Inference
 *
 * Automatically infer expense categories based on document content,
 * vendor names, and other extracted data.
 */

// ExpenseCategory enum (matches Prisma schema)
// Defined locally to avoid dependency on Prisma client regeneration timing
type ExpenseCategory =
  | 'HOUSING'
  | 'RATES'
  | 'INSURANCE'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'UTILITIES'
  | 'FOOD'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'STRATA'
  | 'LAND_TAX'
  | 'LOAN_INTEREST'
  | 'REGISTRATION'
  | 'MODIFICATIONS'
  | 'OTHER';

// ============================================================================
// Category Inference Rules
// ============================================================================

interface CategoryRule {
  category: ExpenseCategory;
  keywords: string[];
  vendors?: string[];
  documentTypes?: string[];  // DocumentAnalysisType values
  priority: number;
}

/**
 * Rules for inferring expense categories from document content
 * Higher priority rules are checked first
 */
const CATEGORY_RULES: CategoryRule[] = [
  // High priority - specific document types
  {
    category: 'RATES',
    keywords: ['rate notice', 'council rates', 'property rates', 'land rates', 'general rates'],
    documentTypes: ['RATE_NOTICE'],
    priority: 100,
  },
  {
    category: 'LAND_TAX',
    keywords: ['land tax', 'land value', 'revenue nsw', 'state revenue', 'sro vic', 'osr'],
    priority: 100,
  },
  {
    category: 'INSURANCE',
    keywords: ['insurance', 'policy', 'premium', 'cover', 'underwriting', 'insurer'],
    vendors: ['allianz', 'suncorp', 'qbe', 'nrma', 'aami', 'youi', 'bupa', 'medibank', 'nib'],
    documentTypes: ['INSURANCE_POLICY'],
    priority: 95,
  },
  {
    category: 'STRATA',
    keywords: ['strata', 'body corporate', 'owners corporation', 'strata levy', 'admin fund', 'capital works fund'],
    priority: 95,
  },
  {
    category: 'LOAN_INTEREST',
    keywords: ['interest charged', 'loan interest', 'mortgage interest', 'home loan', 'investment loan'],
    documentTypes: ['LOAN_STATEMENT', 'LOAN_CONTRACT'],
    priority: 90,
  },
  // Medium priority - common expense types
  {
    category: 'UTILITIES',
    keywords: ['electricity', 'gas', 'water', 'energy', 'power', 'usage', 'consumption', 'kwh', 'mj'],
    vendors: ['origin', 'agl', 'energyaustralia', 'alinta', 'simply energy', 'red energy', 'lumo', 'sydney water', 'yarra valley water'],
    documentTypes: ['UTILITY_BILL'],
    priority: 85,
  },
  {
    category: 'MAINTENANCE',
    keywords: ['repair', 'maintenance', 'fix', 'service', 'plumber', 'electrician', 'handyman', 'hardware', 'paint', 'tools'],
    vendors: ['bunnings', 'mitre 10', 'home timber', 'reece', 'tradelink'],
    priority: 80,
  },
  {
    category: 'HOUSING',
    keywords: ['rent', 'rental', 'accommodation', 'property management', 'letting fee', 'lease'],
    priority: 75,
  },
  // Lower priority - general categories
  {
    category: 'TRANSPORT',
    keywords: ['fuel', 'petrol', 'diesel', 'parking', 'toll', 'rego', 'registration', 'service', 'mechanic', 'tyres'],
    vendors: ['bp', 'shell', 'caltex', 'ampol', 'united', 'seven eleven', '7-eleven'],
    priority: 70,
  },
  {
    category: 'FOOD',
    keywords: ['grocery', 'groceries', 'food', 'supermarket', 'cafe', 'restaurant', 'takeaway'],
    vendors: ['woolworths', 'coles', 'aldi', 'iga', 'harris farm', 'costco'],
    priority: 65,
  },
  {
    category: 'ENTERTAINMENT',
    keywords: ['entertainment', 'streaming', 'subscription', 'movie', 'cinema', 'netflix', 'spotify', 'gym'],
    priority: 60,
  },
  {
    category: 'PERSONAL',
    keywords: ['personal', 'health', 'medical', 'pharmacy', 'doctor', 'dentist', 'chemist'],
    vendors: ['chemist warehouse', 'priceline', 'terry white'],
    priority: 55,
  },
  {
    category: 'REGISTRATION',
    keywords: ['vehicle registration', 'motor registry', 'rta', 'roads maritime', 'vicroads', 'transport'],
    priority: 50,
  },
  {
    category: 'MODIFICATIONS',
    keywords: ['upgrade', 'modification', 'custom', 'aftermarket', 'accessories'],
    priority: 45,
  },
];

// ============================================================================
// Vendor Normalisation
// ============================================================================

/**
 * Known vendor aliases and their canonical names
 */
const VENDOR_ALIASES: Record<string, string> = {
  'bunnings warehouse': 'Bunnings',
  'bunnings': 'Bunnings',
  'woolworths': 'Woolworths',
  'woolworths group': 'Woolworths',
  'coles supermarkets': 'Coles',
  'coles': 'Coles',
  'aldi stores': 'Aldi',
  'aldi': 'Aldi',
  'bp australia': 'BP',
  'bp': 'BP',
  'shell australia': 'Shell',
  'shell': 'Shell',
  'origin energy': 'Origin Energy',
  'agl energy': 'AGL',
  'agl': 'AGL',
  'sydney water corp': 'Sydney Water',
  'sydney water': 'Sydney Water',
};

/**
 * Normalise vendor name
 */
export function normaliseVendor(vendor: string): string {
  const lower = vendor.toLowerCase().trim();

  // Check for known aliases
  for (const [alias, canonical] of Object.entries(VENDOR_ALIASES)) {
    if (lower.includes(alias)) {
      return canonical;
    }
  }

  // Title case the original
  return vendor
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// Category Inference
// ============================================================================

export interface CategoryInferenceResult {
  category: ExpenseCategory;
  confidence: number;
  matchedKeywords: string[];
  matchedVendor?: string;
  reason: string;
}

/**
 * Infer expense category from document content
 */
export function inferExpenseCategory(
  content: {
    text?: string;
    vendor?: string;
    documentType?: string;
  }
): CategoryInferenceResult {
  const { text = '', vendor = '', documentType } = content;
  const textLower = text.toLowerCase();
  const vendorLower = vendor.toLowerCase();

  let bestMatch: CategoryInferenceResult | null = null;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    const matchedKeywords: string[] = [];
    let matchedVendor: string | undefined;

    // Check document type match (highest weight)
    if (documentType && rule.documentTypes?.includes(documentType)) {
      score += 50;
    }

    // Check vendor match (high weight)
    if (rule.vendors) {
      for (const v of rule.vendors) {
        if (vendorLower.includes(v.toLowerCase())) {
          score += 30;
          matchedVendor = v;
          break;
        }
      }
    }

    // Check keyword matches (medium weight)
    for (const keyword of rule.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        score += 10;
        matchedKeywords.push(keyword);
      }
      // Also check vendor field for keywords
      if (vendorLower.includes(keyword.toLowerCase())) {
        score += 15;
        matchedKeywords.push(keyword);
      }
    }

    // Apply priority as a tiebreaker
    score += rule.priority / 10;

    // Calculate confidence (normalize to 0-1)
    const confidence = Math.min(score / 100, 1);

    if (!bestMatch || confidence > bestMatch.confidence) {
      const reasons: string[] = [];
      if (matchedVendor) reasons.push(`vendor matches '${matchedVendor}'`);
      if (matchedKeywords.length > 0) reasons.push(`keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
      if (documentType && rule.documentTypes?.includes(documentType)) {
        reasons.push(`document type is ${documentType}`);
      }

      bestMatch = {
        category: rule.category,
        confidence,
        matchedKeywords: [...new Set(matchedKeywords)],
        matchedVendor,
        reason: reasons.join('; ') || 'Default inference',
      };
    }
  }

  // Default to OTHER if no good match
  if (!bestMatch || bestMatch.confidence < 0.3) {
    return {
      category: 'OTHER',
      confidence: 0.3,
      matchedKeywords: [],
      reason: 'No strong category match found',
    };
  }

  return bestMatch;
}

// ============================================================================
// Tax Deductibility Inference
// ============================================================================

/**
 * Categories that are typically tax-deductible for investment properties
 */
const INVESTMENT_DEDUCTIBLE_CATEGORIES: ExpenseCategory[] = [
  'RATES',
  'INSURANCE',
  'MAINTENANCE',
  'STRATA',
  'LAND_TAX',
  'LOAN_INTEREST',
  'UTILITIES',  // Only if paid by landlord
];

/**
 * Infer if an expense is likely tax-deductible
 */
export function inferTaxDeductibility(
  category: ExpenseCategory,
  isPropertyLinked: boolean,
  isInvestmentProperty: boolean
): { deductible: boolean; confidence: number; reason: string } {
  // If linked to an investment property, check category
  if (isPropertyLinked && isInvestmentProperty) {
    if (INVESTMENT_DEDUCTIBLE_CATEGORIES.includes(category)) {
      return {
        deductible: true,
        confidence: 0.85,
        reason: `${category} is typically deductible for investment properties`,
      };
    }
  }

  // Some categories are always non-deductible for personal use
  const nonDeductible: ExpenseCategory[] = ['PERSONAL', 'FOOD', 'ENTERTAINMENT'];
  if (nonDeductible.includes(category)) {
    return {
      deductible: false,
      confidence: 0.9,
      reason: `${category} is generally not tax-deductible`,
    };
  }

  // Default to uncertain
  return {
    deductible: false,
    confidence: 0.5,
    reason: 'Unable to determine tax deductibility - manual review recommended',
  };
}

// ============================================================================
// Essential vs Discretionary Inference
// ============================================================================

/**
 * Categories that are typically essential expenses
 */
const ESSENTIAL_CATEGORIES: ExpenseCategory[] = [
  'HOUSING',
  'UTILITIES',
  'FOOD',
  'TRANSPORT',
  'INSURANCE',
  'RATES',
  'REGISTRATION',
];

/**
 * Infer if an expense is essential or discretionary
 */
export function inferIsEssential(category: ExpenseCategory): boolean {
  return ESSENTIAL_CATEGORIES.includes(category);
}
