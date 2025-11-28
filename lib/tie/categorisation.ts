/**
 * TRANSACTION INTELLIGENCE ENGINE (TIE) - CATEGORISATION ENGINE
 * Phase 13 - Transactional Intelligence
 *
 * Hybrid categorisation system:
 * 1. Rules-based layer (fast, deterministic)
 * 2. AI/LLM layer (accurate, requires API) - stubbed for future
 * 3. User correction learning loop
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.2 Component 2
 */

import {
  UnifiedTransaction,
  MerchantMapping,
  CATEGORY_HIERARCHY,
  ALL_CATEGORIES,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface CategorisationResult {
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  confidence: number; // 0-1
  source: 'RULE' | 'AI' | 'USER' | 'FALLBACK';
  ruleMatched?: string;
}

export interface CategorisationRule {
  id: string;
  name: string;
  priority: number; // Higher = checked first
  matcher: (tx: UnifiedTransaction) => boolean;
  category: {
    level1: string;
    level2?: string;
    subcategory?: string;
  };
}

// =============================================================================
// CATEGORISATION RULES
// =============================================================================

/**
 * Rules are checked in priority order (highest first).
 * First matching rule wins.
 */
const CATEGORISATION_RULES: CategorisationRule[] = [
  // =========================================================================
  // HIGH PRIORITY - Specific merchants
  // =========================================================================

  // Supermarkets
  {
    id: 'grocery_woolworths',
    name: 'Woolworths Supermarket',
    priority: 100,
    matcher: (tx) =>
      /woolworths|woolies/i.test(tx.merchantStandardised || tx.description) &&
      !/woolworths\s*(petrol|fuel|metro)/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Groceries' },
  },
  {
    id: 'grocery_coles',
    name: 'Coles Supermarket',
    priority: 100,
    matcher: (tx) =>
      /\bcoles\b/i.test(tx.merchantStandardised || tx.description) &&
      !/coles\s*(express|fuel)/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Groceries' },
  },
  {
    id: 'grocery_aldi',
    name: 'ALDI',
    priority: 100,
    matcher: (tx) => /\baldi\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Groceries' },
  },
  {
    id: 'grocery_iga',
    name: 'IGA',
    priority: 100,
    matcher: (tx) => /\biga\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Groceries' },
  },

  // Fast Food
  {
    id: 'fastfood_mcdonalds',
    name: 'McDonald\'s',
    priority: 100,
    matcher: (tx) => /mcdonald|maccas/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Fast Food' },
  },
  {
    id: 'fastfood_kfc',
    name: 'KFC',
    priority: 100,
    matcher: (tx) => /\bkfc\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Fast Food' },
  },
  {
    id: 'fastfood_hungryjacks',
    name: 'Hungry Jack\'s',
    priority: 100,
    matcher: (tx) => /hungry\s*jack/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Fast Food' },
  },
  {
    id: 'fastfood_subway',
    name: 'Subway',
    priority: 100,
    matcher: (tx) => /\bsubway\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Fast Food' },
  },

  // Coffee
  {
    id: 'coffee_starbucks',
    name: 'Starbucks',
    priority: 100,
    matcher: (tx) => /starbucks/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  },

  // Food Delivery
  {
    id: 'delivery_ubereats',
    name: 'Uber Eats',
    priority: 100,
    matcher: (tx) => /uber\s*eats/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Food Delivery' },
  },
  {
    id: 'delivery_doordash',
    name: 'DoorDash',
    priority: 100,
    matcher: (tx) => /doordash/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Food Delivery' },
  },
  {
    id: 'delivery_menulog',
    name: 'Menulog',
    priority: 100,
    matcher: (tx) => /menulog/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Food & Dining', level2: 'Food Delivery' },
  },

  // Fuel
  {
    id: 'fuel_bp',
    name: 'BP',
    priority: 100,
    matcher: (tx) => /\bbp\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Fuel' },
  },
  {
    id: 'fuel_shell',
    name: 'Shell',
    priority: 100,
    matcher: (tx) => /\bshell\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Fuel' },
  },
  {
    id: 'fuel_caltex',
    name: 'Caltex',
    priority: 100,
    matcher: (tx) => /caltex|ampol/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Fuel' },
  },
  {
    id: 'fuel_7eleven',
    name: '7-Eleven Fuel',
    priority: 100,
    matcher: (tx) => /7.?eleven/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Fuel' },
  },

  // Rideshare
  {
    id: 'rideshare_uber',
    name: 'Uber',
    priority: 100,
    matcher: (tx) =>
      /\buber\b/i.test(tx.merchantStandardised || tx.description) &&
      !/uber\s*eats/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Rideshare' },
  },
  {
    id: 'rideshare_didi',
    name: 'DiDi',
    priority: 100,
    matcher: (tx) => /\bdidi\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Rideshare' },
  },

  // Streaming Services
  {
    id: 'streaming_netflix',
    name: 'Netflix',
    priority: 100,
    matcher: (tx) => /netflix/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Entertainment', level2: 'Streaming Services' },
  },
  {
    id: 'streaming_spotify',
    name: 'Spotify',
    priority: 100,
    matcher: (tx) => /spotify/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Entertainment', level2: 'Streaming Services' },
  },
  {
    id: 'streaming_disney',
    name: 'Disney+',
    priority: 100,
    matcher: (tx) => /disney/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Entertainment', level2: 'Streaming Services' },
  },
  {
    id: 'streaming_stan',
    name: 'Stan',
    priority: 100,
    matcher: (tx) => /\bstan\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Entertainment', level2: 'Streaming Services' },
  },
  {
    id: 'streaming_amazon',
    name: 'Amazon Prime',
    priority: 100,
    matcher: (tx) => /amazon\s*(prime|video)/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Entertainment', level2: 'Streaming Services' },
  },

  // Retail
  {
    id: 'retail_kmart',
    name: 'Kmart',
    priority: 100,
    matcher: (tx) => /\bkmart\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Shopping', level2: 'Department Stores' },
  },
  {
    id: 'retail_target',
    name: 'Target',
    priority: 100,
    matcher: (tx) => /\btarget\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Shopping', level2: 'Department Stores' },
  },
  {
    id: 'retail_bigw',
    name: 'Big W',
    priority: 100,
    matcher: (tx) => /big\s*w/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Shopping', level2: 'Department Stores' },
  },
  {
    id: 'retail_jbhifi',
    name: 'JB Hi-Fi',
    priority: 100,
    matcher: (tx) => /jb\s*hi.?fi/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Shopping', level2: 'Electronics' },
  },
  {
    id: 'retail_bunnings',
    name: 'Bunnings',
    priority: 100,
    matcher: (tx) => /bunnings/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Shopping', level2: 'Home & Garden' },
  },
  {
    id: 'retail_amazon',
    name: 'Amazon',
    priority: 90,
    matcher: (tx) =>
      /\bamazon\b/i.test(tx.merchantStandardised || tx.description) &&
      !/amazon\s*(prime|video)/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Shopping', level2: 'Online Shopping' },
  },

  // Telcos
  {
    id: 'telco_telstra',
    name: 'Telstra',
    priority: 100,
    matcher: (tx) => /telstra/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  },
  {
    id: 'telco_optus',
    name: 'Optus',
    priority: 100,
    matcher: (tx) => /optus/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  },
  {
    id: 'telco_vodafone',
    name: 'Vodafone',
    priority: 100,
    matcher: (tx) => /vodafone/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  },

  // Health Insurance
  {
    id: 'health_medibank',
    name: 'Medibank',
    priority: 100,
    matcher: (tx) => /medibank/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Health Insurance' },
  },
  {
    id: 'health_bupa',
    name: 'Bupa',
    priority: 100,
    matcher: (tx) => /\bbupa\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Health Insurance' },
  },
  {
    id: 'health_hcf',
    name: 'HCF',
    priority: 100,
    matcher: (tx) => /\bhcf\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Health Insurance' },
  },

  // Pharmacy
  {
    id: 'health_chemistwarehouse',
    name: 'Chemist Warehouse',
    priority: 100,
    matcher: (tx) => /chemist\s*warehouse/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Pharmacy' },
  },
  {
    id: 'health_priceline',
    name: 'Priceline Pharmacy',
    priority: 100,
    matcher: (tx) => /priceline/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Pharmacy' },
  },

  // Fitness
  {
    id: 'fitness_anytime',
    name: 'Anytime Fitness',
    priority: 100,
    matcher: (tx) => /anytime\s*fitness/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Fitness & Gym' },
  },
  {
    id: 'fitness_f45',
    name: 'F45',
    priority: 100,
    matcher: (tx) => /\bf45\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Health', level2: 'Fitness & Gym' },
  },

  // =========================================================================
  // MEDIUM PRIORITY - Pattern-based rules
  // =========================================================================

  // Utilities patterns
  {
    id: 'utility_electricity',
    name: 'Electricity',
    priority: 80,
    matcher: (tx) =>
      /(energy|power|electricity|agl|origin\s*energy|ergon|ausgrid)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Bills & Utilities', level2: 'Electricity' },
  },
  {
    id: 'utility_gas',
    name: 'Gas',
    priority: 80,
    matcher: (tx) =>
      /\b(gas|alinta)\b/i.test(tx.merchantStandardised || tx.description) &&
      !/fuel|petrol/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Bills & Utilities', level2: 'Gas' },
  },
  {
    id: 'utility_water',
    name: 'Water',
    priority: 80,
    matcher: (tx) =>
      /(water\s*corp|sydney\s*water|sa\s*water|urban\s*utilities)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Bills & Utilities', level2: 'Water' },
  },
  {
    id: 'utility_internet',
    name: 'Internet',
    priority: 80,
    matcher: (tx) =>
      /(nbn|tpg|iinet|aussie\s*broadband|internode)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Bills & Utilities', level2: 'Internet' },
  },

  // Insurance patterns
  {
    id: 'insurance_car',
    name: 'Car Insurance',
    priority: 80,
    matcher: (tx) =>
      /(nrma|racq|rac|racv|allianz|suncorp|aami|budget\s*direct)/i.test(
        tx.merchantStandardised || tx.description
      ) && /insurance|motor|car/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Registration & Insurance' },
  },
  {
    id: 'insurance_home',
    name: 'Home Insurance',
    priority: 80,
    matcher: (tx) =>
      /(nrma|allianz|suncorp|aami|budget\s*direct)/i.test(
        tx.merchantStandardised || tx.description
      ) && /home|contents|building/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Housing', level2: 'Home Insurance' },
  },

  // Public Transport
  {
    id: 'transport_opal',
    name: 'Opal Card',
    priority: 80,
    matcher: (tx) => /opal/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Public Transport' },
  },
  {
    id: 'transport_myki',
    name: 'Myki',
    priority: 80,
    matcher: (tx) => /myki/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Public Transport' },
  },
  {
    id: 'transport_gocard',
    name: 'Go Card',
    priority: 80,
    matcher: (tx) => /go\s*card/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transport', level2: 'Public Transport' },
  },

  // ATM
  {
    id: 'atm_withdrawal',
    name: 'ATM Withdrawal',
    priority: 80,
    matcher: (tx) =>
      /\batm\b|cash\s*withdrawal/i.test(tx.merchantStandardised || tx.description) &&
      tx.direction === 'OUT',
    category: { level1: 'Cash & ATM', level2: 'ATM Withdrawal' },
  },

  // Transfers
  {
    id: 'transfer_bpay',
    name: 'BPAY',
    priority: 80,
    matcher: (tx) => /\bbpay\b/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transfers', level2: 'BPAY' },
  },
  {
    id: 'transfer_internal',
    name: 'Internal Transfer',
    priority: 80,
    matcher: (tx) =>
      /(transfer|tfr|trf)\s*(to|from|between)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Transfers', level2: 'Internal Transfer' },
  },
  {
    id: 'transfer_osko',
    name: 'Osko/PayID',
    priority: 80,
    matcher: (tx) => /\bosko\b|payid/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Transfers', level2: 'Pay Someone' },
  },

  // Interest/Fees
  {
    id: 'financial_interest',
    name: 'Interest Payment',
    priority: 80,
    matcher: (tx) =>
      /interest\s*(payment|charged|debit)/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Financial', level2: 'Interest Payments' },
  },
  {
    id: 'financial_bankfee',
    name: 'Bank Fee',
    priority: 80,
    matcher: (tx) =>
      /(bank|account|monthly|annual)\s*fee/i.test(tx.merchantStandardised || tx.description),
    category: { level1: 'Financial', level2: 'Bank Fees' },
  },

  // Income patterns
  {
    id: 'income_salary',
    name: 'Salary',
    priority: 80,
    matcher: (tx) =>
      /salary|wages|payroll/i.test(tx.merchantStandardised || tx.description) &&
      tx.direction === 'IN',
    category: { level1: 'Income', level2: 'Salary' },
  },
  {
    id: 'income_dividend',
    name: 'Dividend',
    priority: 80,
    matcher: (tx) =>
      /dividend|distribution/i.test(tx.merchantStandardised || tx.description) &&
      tx.direction === 'IN',
    category: { level1: 'Income', level2: 'Dividends' },
  },
  {
    id: 'income_interest',
    name: 'Interest Earned',
    priority: 80,
    matcher: (tx) =>
      /interest\s*(earned|credit|received)/i.test(tx.merchantStandardised || tx.description) &&
      tx.direction === 'IN',
    category: { level1: 'Income', level2: 'Interest Earned' },
  },
  {
    id: 'income_centrelink',
    name: 'Government Benefits',
    priority: 80,
    matcher: (tx) =>
      /centrelink|services\s*australia/i.test(tx.merchantStandardised || tx.description) &&
      tx.direction === 'IN',
    category: { level1: 'Income', level2: 'Government Benefits' },
  },

  // =========================================================================
  // LOW PRIORITY - Generic patterns
  // =========================================================================

  {
    id: 'generic_restaurant',
    name: 'Restaurant',
    priority: 50,
    matcher: (tx) =>
      /(restaurant|bistro|grill|diner|cafe|eatery)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Food & Dining', level2: 'Restaurants' },
  },
  {
    id: 'generic_bar',
    name: 'Bar/Pub',
    priority: 50,
    matcher: (tx) =>
      /\b(bar|pub|tavern|hotel|brewery|bottleshop|liquor)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  },
  {
    id: 'generic_parking',
    name: 'Parking',
    priority: 50,
    matcher: (tx) =>
      /(parking|car\s*park|wilson\s*parking|secure\s*parking)/i.test(
        tx.merchantStandardised || tx.description
      ),
    category: { level1: 'Transport', level2: 'Parking' },
  },
];

// Sort rules by priority (highest first)
const SORTED_RULES = [...CATEGORISATION_RULES].sort((a, b) => b.priority - a.priority);

// =============================================================================
// RULES-BASED CATEGORISATION
// =============================================================================

/**
 * Categorise a transaction using rules
 */
export function categoriseByRules(tx: UnifiedTransaction): CategorisationResult | null {
  for (const rule of SORTED_RULES) {
    try {
      if (rule.matcher(tx)) {
        return {
          categoryLevel1: rule.category.level1,
          categoryLevel2: rule.category.level2 || null,
          subcategory: rule.category.subcategory || null,
          confidence: 0.9, // Rules have high confidence
          source: 'RULE',
          ruleMatched: rule.id,
        };
      }
    } catch {
      // Skip failed matchers
      continue;
    }
  }

  return null;
}

// =============================================================================
// MERCHANT MAPPING CATEGORISATION
// =============================================================================

/**
 * Categorise using merchant mappings (user corrections + global)
 */
export function categoriseByMerchantMapping(
  tx: UnifiedTransaction,
  mappings: MerchantMapping[]
): CategorisationResult | null {
  const merchantToMatch = tx.merchantStandardised || tx.merchantRaw || tx.description;
  if (!merchantToMatch) return null;

  const normalised = merchantToMatch.toLowerCase().trim();

  // Find best matching mapping (user-specific takes priority)
  const userMapping = mappings.find(
    (m) =>
      m.userId === tx.userId &&
      m.merchantRaw.toLowerCase() === normalised
  );

  if (userMapping) {
    return {
      categoryLevel1: userMapping.categoryLevel1,
      categoryLevel2: userMapping.categoryLevel2,
      subcategory: userMapping.subcategory,
      confidence: userMapping.confidence,
      source: 'USER',
    };
  }

  // Check global mappings
  const globalMapping = mappings.find(
    (m) =>
      m.userId === null &&
      m.merchantRaw.toLowerCase() === normalised
  );

  if (globalMapping) {
    return {
      categoryLevel1: globalMapping.categoryLevel1,
      categoryLevel2: globalMapping.categoryLevel2,
      subcategory: globalMapping.subcategory,
      confidence: globalMapping.confidence * 0.9, // Slightly lower confidence for global
      source: 'RULE',
    };
  }

  return null;
}

// =============================================================================
// AI CATEGORISATION (STUB - OpenAI Integration Point)
// =============================================================================

/**
 * AI-based categorisation using OpenAI
 * Currently stubbed - returns null
 *
 * To enable:
 * 1. Set OPENAI_API_KEY environment variable
 * 2. Implement the actual API call
 */
export interface AICategorizationConfig {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_AI_CONFIG: AICategorizationConfig = {
  enabled: false,
  model: 'gpt-4o-mini',
  maxTokens: 100,
};

/**
 * Categorise using AI/LLM
 * @returns null when AI is disabled or fails
 */
export async function categoriseByAI(
  tx: UnifiedTransaction,
  config: AICategorizationConfig = DEFAULT_AI_CONFIG
): Promise<CategorisationResult | null> {
  // Check if AI is enabled
  if (!config.enabled) {
    return null;
  }

  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('AI categorisation enabled but OPENAI_API_KEY not set');
    return null;
  }

  // Build prompt
  const prompt = buildCategorizationPrompt(tx);

  try {
    // TODO: Implement actual OpenAI API call when ready
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     model: config.model,
    //     messages: [{ role: 'user', content: prompt }],
    //     max_tokens: config.maxTokens,
    //     temperature: 0.3,
    //   }),
    // });
    //
    // const data = await response.json();
    // const result = parseAIResponse(data.choices[0].message.content);
    // return result;

    // STUB: Return null until implemented
    return null;
  } catch (error) {
    console.error('AI categorisation failed:', error);
    return null;
  }
}

/**
 * Build the prompt for AI categorisation
 */
function buildCategorizationPrompt(tx: UnifiedTransaction): string {
  const categories = Object.keys(CATEGORY_HIERARCHY).join(', ');

  return `Categorise this Australian bank transaction:

Description: ${tx.description}
Merchant: ${tx.merchantStandardised || tx.merchantRaw || 'Unknown'}
Amount: $${tx.amount.toFixed(2)} ${tx.direction === 'OUT' ? '(debit)' : '(credit)'}
Date: ${tx.date.toISOString().split('T')[0]}

Available categories: ${categories}

Respond in JSON format:
{
  "categoryLevel1": "Category Name",
  "categoryLevel2": "Subcategory Name or null",
  "confidence": 0.0-1.0
}`;
}

// =============================================================================
// HYBRID CATEGORISATION ENGINE
// =============================================================================

/**
 * Main categorisation function - hybrid approach
 *
 * Priority order:
 * 1. User corrections (merchant mappings)
 * 2. Rules-based matching
 * 3. AI classification (if enabled)
 * 4. Fallback to uncategorised
 */
export async function categoriseTransaction(
  tx: UnifiedTransaction,
  options: {
    merchantMappings?: MerchantMapping[];
    aiConfig?: AICategorizationConfig;
  } = {}
): Promise<CategorisationResult> {
  // 1. Try merchant mappings first (includes user corrections)
  if (options.merchantMappings && options.merchantMappings.length > 0) {
    const mappingResult = categoriseByMerchantMapping(tx, options.merchantMappings);
    if (mappingResult) {
      return mappingResult;
    }
  }

  // 2. Try rules-based categorisation
  const rulesResult = categoriseByRules(tx);
  if (rulesResult) {
    return rulesResult;
  }

  // 3. Try AI categorisation (if enabled)
  if (options.aiConfig?.enabled) {
    const aiResult = await categoriseByAI(tx, options.aiConfig);
    if (aiResult) {
      return aiResult;
    }
  }

  // 4. Fallback
  return {
    categoryLevel1: 'Other',
    categoryLevel2: 'Uncategorised',
    subcategory: null,
    confidence: 0.1,
    source: 'FALLBACK',
  };
}

/**
 * Batch categorise multiple transactions
 */
export async function categoriseTransactionBatch(
  transactions: UnifiedTransaction[],
  options: {
    merchantMappings?: MerchantMapping[];
    aiConfig?: AICategorizationConfig;
  } = {}
): Promise<Map<string, CategorisationResult>> {
  const results = new Map<string, CategorisationResult>();

  for (const tx of transactions) {
    const result = await categoriseTransaction(tx, options);
    results.set(tx.id, result);
  }

  return results;
}

// =============================================================================
// USER CORRECTION LEARNING
// =============================================================================

/**
 * Create a merchant mapping from user correction
 */
export function createMerchantMappingFromCorrection(
  tx: UnifiedTransaction,
  correction: {
    categoryLevel1: string;
    categoryLevel2?: string;
    subcategory?: string;
  }
): Omit<MerchantMapping, 'id' | 'createdAt' | 'updatedAt'> {
  const merchantRaw = tx.merchantStandardised || tx.merchantRaw || tx.description;

  return {
    userId: tx.userId,
    merchantRaw: merchantRaw.toLowerCase().trim(),
    merchantStandardised: tx.merchantStandardised || merchantRaw,
    merchantCategoryCode: tx.merchantCategoryCode,
    categoryLevel1: correction.categoryLevel1,
    categoryLevel2: correction.categoryLevel2 || null,
    subcategory: correction.subcategory || null,
    confidence: 1.0,
    source: 'USER',
    usageCount: 1,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  CATEGORISATION_RULES,
  SORTED_RULES,
  DEFAULT_AI_CONFIG,
};
