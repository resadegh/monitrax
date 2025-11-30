/**
 * Phase 20: Income Taxability Rules Engine
 * Automatically determines the tax treatment of income based on ATO rules
 *
 * This engine removes the need for users to manually specify if income is taxable.
 * The system knows Australian tax law and applies it automatically.
 */

import { TaxabilityResult, IncomeContext } from '../types';

// Corporate tax rate for franking credit calculations
const CORPORATE_TAX_RATE = 0.30;

/**
 * Determine the taxability of income based on its type and context
 */
export function determineTaxability(context: IncomeContext): TaxabilityResult {
  const { incomeType, amount, frankingPercentage = 0 } = context;

  switch (incomeType.toUpperCase()) {
    // ==========================================================================
    // Employment Income - Generally Fully Taxable
    // ==========================================================================

    case 'SALARY':
      return {
        category: 'SALARY_WAGES',
        taxableAmount: amount,
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'Salary and wages are fully assessable income under section 6-5 of the ITAA 1997.',
        references: [
          'ITAA 1997 s6-5',
          'ATO: Income you must declare',
        ],
      };

    // ==========================================================================
    // Rental Income - Fully Taxable
    // ==========================================================================

    case 'RENT':
    case 'RENTAL':
      return {
        category: 'RENTAL',
        taxableAmount: amount,
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'Rental income from investment properties is fully assessable. You can claim deductions for expenses related to earning this income.',
        references: [
          'ITAA 1997 s6-5',
          'ATO: Rental properties and claiming expenses',
        ],
      };

    // ==========================================================================
    // Investment Income
    // ==========================================================================

    case 'DIVIDEND':
    case 'INVESTMENT':
      if (frankingPercentage > 0) {
        // Franked dividends - gross up and add franking credits
        const frankingCredits = calculateFrankingCredits(amount, frankingPercentage);
        const grossedUpAmount = amount + frankingCredits;

        return {
          category: 'DIVIDENDS_FRANKED',
          taxableAmount: grossedUpAmount, // Grossed-up amount is taxable
          exemptAmount: 0,
          frankingCredits,
          grossedUpAmount,
          explanation: `Franked dividends are taxed on the grossed-up amount (dividend + franking credits). The franking credits offset your tax payable. ${frankingPercentage}% franked = $${frankingCredits.toFixed(2)} credits.`,
          references: [
            'ITAA 1997 Division 207',
            'ATO: Dividends and franking credits',
          ],
        };
      }

      // Unfranked dividends
      return {
        category: 'DIVIDENDS_UNFRANKED',
        taxableAmount: amount,
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'Unfranked dividends are fully assessable income with no attached franking credits.',
        references: [
          'ATO: Dividends',
        ],
      };

    case 'INTEREST':
      return {
        category: 'INTEREST',
        taxableAmount: amount,
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'Interest income from bank accounts, term deposits, and bonds is fully assessable.',
        references: [
          'ITAA 1997 s6-5',
          'ATO: Interest income',
        ],
      };

    // ==========================================================================
    // Generally Exempt Income
    // ==========================================================================

    case 'GIFT':
      return {
        category: 'GIFTS',
        taxableAmount: 0,
        exemptAmount: amount,
        frankingCredits: 0,
        grossedUpAmount: 0,
        explanation: 'Gifts are generally not taxable in Australia. However, if the gift produces income (e.g., shares that pay dividends), that income is taxable.',
        references: [
          'ATO: Gifts and inheritances',
        ],
      };

    case 'INHERITANCE':
      return {
        category: 'INHERITANCE',
        taxableAmount: 0,
        exemptAmount: amount,
        frankingCredits: 0,
        grossedUpAmount: 0,
        explanation: 'Inheritances are not taxable income in Australia. However, you may have CGT obligations if you later sell inherited assets.',
        references: [
          'ITAA 1997 s118-60',
          'ATO: Inherited assets and CGT',
        ],
      };

    case 'INSURANCE':
    case 'INSURANCE_PAYOUT':
      return {
        category: 'INSURANCE_PAYOUT',
        taxableAmount: 0,
        exemptAmount: amount,
        frankingCredits: 0,
        grossedUpAmount: 0,
        explanation: 'Most personal insurance payouts (e.g., home insurance, car insurance) are not taxable. Income protection payments may be taxable.',
        references: [
          'ATO: Insurance payouts',
        ],
      };

    // ==========================================================================
    // Government Payments - Mixed Treatment
    // ==========================================================================

    case 'CENTRELINK':
    case 'GOVERNMENT':
      // Most Centrelink payments are taxable
      if (context.paymentType) {
        const exemptPayments = [
          'FAMILY_TAX_BENEFIT',
          'CHILD_CARE_SUBSIDY',
          'RENT_ASSISTANCE',
          'CRISIS_PAYMENT',
          'BEREAVEMENT_ALLOWANCE',
        ];

        if (exemptPayments.includes(context.paymentType.toUpperCase())) {
          return {
            category: 'GOVERNMENT_EXEMPT',
            taxableAmount: 0,
            exemptAmount: amount,
            frankingCredits: 0,
            grossedUpAmount: 0,
            explanation: `${context.paymentType} is a tax-exempt government payment.`,
            references: ['ATO: Government payments and allowances'],
          };
        }
      }

      // Default: most government payments are taxable
      return {
        category: 'GOVERNMENT_TAXABLE',
        taxableAmount: amount,
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'Most Centrelink and government payments are taxable, including JobSeeker, Age Pension, and Parenting Payment.',
        references: [
          'ATO: Government payments',
        ],
      };

    // ==========================================================================
    // Other Income
    // ==========================================================================

    case 'HOBBY':
      // Hobby income may or may not be taxable depending on profit intent
      return {
        category: 'HOBBY_INCOME',
        taxableAmount: amount, // Default to taxable - safer
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'Income from activities that resemble a business may be taxable. The ATO considers factors like profit intent, repetition, and organization. Consult a tax professional.',
        references: [
          'ATO: Hobby or business?',
        ],
      };

    case 'OTHER':
    default:
      // Default to taxable for safety
      return {
        category: 'SALARY_WAGES', // Use general taxable category
        taxableAmount: amount,
        exemptAmount: 0,
        frankingCredits: 0,
        grossedUpAmount: amount,
        explanation: 'This income has been categorized as assessable income. If you believe it should be exempt, please consult a tax professional.',
        references: [
          'ITAA 1997 s6-5',
        ],
      };
  }
}

/**
 * Calculate franking credits for a dividend
 *
 * Formula: Franking Credit = Dividend × (Franking % / 100) × (Corporate Tax Rate / (1 - Corporate Tax Rate))
 *
 * For 30% corporate tax rate:
 * Franking Credit = Dividend × (Franking % / 100) × (0.30 / 0.70)
 * Franking Credit = Dividend × (Franking % / 100) × 0.4286
 */
export function calculateFrankingCredits(
  dividendAmount: number,
  frankingPercentage: number
): number {
  if (frankingPercentage <= 0 || dividendAmount <= 0) {
    return 0;
  }

  const frankingFraction = frankingPercentage / 100;
  const creditMultiplier = CORPORATE_TAX_RATE / (1 - CORPORATE_TAX_RATE);

  return Math.round(dividendAmount * frankingFraction * creditMultiplier * 100) / 100;
}

/**
 * Get the tax category label for display
 */
export function getTaxCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    SALARY_WAGES: 'Salary & Wages',
    ALLOWANCES: 'Allowances',
    BONUSES: 'Bonuses',
    TERMINATION: 'Termination Payments',
    DIVIDENDS_FRANKED: 'Franked Dividends',
    DIVIDENDS_UNFRANKED: 'Unfranked Dividends',
    INTEREST: 'Interest Income',
    CAPITAL_GAINS: 'Capital Gains',
    RENTAL: 'Rental Income',
    GOVERNMENT_TAXABLE: 'Government Payments (Taxable)',
    GOVERNMENT_EXEMPT: 'Government Payments (Exempt)',
    GIFTS: 'Gifts',
    INHERITANCE: 'Inheritance',
    INSURANCE_PAYOUT: 'Insurance Payout',
    HOBBY_INCOME: 'Hobby Income',
    TAX_EXEMPT: 'Tax Exempt',
  };

  return labels[category] || category;
}

/**
 * Determine if a tax category is fully taxable
 */
export function isTaxableCategory(category: string): boolean {
  const exemptCategories = [
    'GIFTS',
    'INHERITANCE',
    'INSURANCE_PAYOUT',
    'GOVERNMENT_EXEMPT',
    'TAX_EXEMPT',
  ];

  return !exemptCategories.includes(category);
}

/**
 * Get tax treatment summary for an income item
 */
export function getTaxTreatmentSummary(context: IncomeContext): {
  isTaxable: boolean;
  taxableAmount: number;
  effectiveRate: string;
  shortExplanation: string;
} {
  const result = determineTaxability(context);

  return {
    isTaxable: result.taxableAmount > 0,
    taxableAmount: result.taxableAmount,
    effectiveRate: result.taxableAmount > 0
      ? result.frankingCredits > 0
        ? 'Grossed-up with franking credits'
        : '100% taxable'
      : 'Tax exempt',
    shortExplanation: result.explanation.split('.')[0] + '.',
  };
}
