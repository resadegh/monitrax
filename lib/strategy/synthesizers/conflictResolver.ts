/**
 * CONFLICT RESOLVER
 * Phase 11 - Stage 4.2
 *
 * Detects conflicts between recommendations:
 * - Mutually exclusive actions
 * - Competing priorities
 * - Resource allocation conflicts
 */

import type { ConflictGroup } from '../core/types';

// =============================================================================
// TYPES
// =============================================================================

interface Recommendation {
  id: string;
  category: string;
  type: string;
  title: string;
  sbsScore: number;
  financialImpact: any;
  affectedEntities: any;
}

// =============================================================================
// CONFLICT DETECTION
// =============================================================================

/**
 * Detect conflicts between recommendations
 */
export function detectConflicts(
  recommendations: Recommendation[]
): ConflictGroup[] {
  const conflicts: ConflictGroup[] = [];

  // Check for mutually exclusive actions
  const exclusiveConflicts = detectMutuallyExclusive(recommendations);
  conflicts.push(...exclusiveConflicts);

  // Check for competing priorities
  const priorityConflicts = detectCompetingPriorities(recommendations);
  conflicts.push(...priorityConflicts);

  // Check for same-entity conflicts
  const entityConflicts = detectEntityConflicts(recommendations);
  conflicts.push(...entityConflicts);

  return conflicts;
}

// =============================================================================
// MUTUALLY EXCLUSIVE DETECTION
// =============================================================================

/**
 * Detect mutually exclusive recommendations
 * Example: "Sell property" vs "Refinance property"
 */
function detectMutuallyExclusive(
  recommendations: Recommendation[]
): ConflictGroup[] {
  const conflicts: ConflictGroup[] = [];

  const mutuallyExclusivePairs = [
    ['DEBT_REFINANCE', 'DEBT_EARLY_REPAY'],
    ['PROPERTY_LOW_YIELD', 'PROPERTY_LOW_GROWTH'], // Sell vs hold
    ['CASHFLOW_SURPLUS_ALLOCATION', 'DEBT_EARLY_REPAY'], // Invest vs pay debt
    ['CASHFLOW_EMERGENCY_LOW', 'INVESTMENT_REBALANCE'], // Build emergency vs invest
  ];

  for (const [type1, type2] of mutuallyExclusivePairs) {
    const recs1 = recommendations.filter((r) => r.type === type1);
    const recs2 = recommendations.filter((r) => r.type === type2);

    if (recs1.length > 0 && recs2.length > 0) {
      // Found conflict
      conflicts.push({
        id: `mutual-exclusive-${type1}-${type2}`,
        type: 'mutually_exclusive',
        recommendations: [...recs1, ...recs2] as any,
        tradeoffAnalysis: buildTradeoffAnalysis([...recs1, ...recs2]),
        suggestedResolution: suggestResolution([...recs1, ...recs2]),
      });
    }
  }

  return conflicts;
}

// =============================================================================
// COMPETING PRIORITIES
// =============================================================================

/**
 * Detect competing priorities for limited resources
 */
function detectCompetingPriorities(
  recommendations: Recommendation[]
): ConflictGroup[] {
  const conflicts: ConflictGroup[] = [];

  // Find all recommendations that require surplus allocation
  const surplusRequiring = recommendations.filter(
    (r) =>
      r.type === 'CASHFLOW_SURPLUS_ALLOCATION' ||
      r.type === 'DEBT_EARLY_REPAY' ||
      r.type === 'CASHFLOW_EMERGENCY_LOW' ||
      r.type === 'INVESTMENT_REBALANCE'
  );

  if (surplusRequiring.length > 1) {
    conflicts.push({
      id: `competing-surplus-${Date.now()}`,
      type: 'competing_priority',
      recommendations: surplusRequiring as any,
      tradeoffAnalysis: buildTradeoffAnalysis(surplusRequiring),
      suggestedResolution:
        'Prioritize by Strategic Benefit Score (SBS). Allocate surplus to highest-scoring recommendation first.',
    });
  }

  return conflicts;
}

// =============================================================================
// ENTITY CONFLICTS
// =============================================================================

/**
 * Detect recommendations affecting the same entity
 */
function detectEntityConflicts(
  recommendations: Recommendation[]
): ConflictGroup[] {
  const conflicts: ConflictGroup[] = [];

  // Group by affected entity
  const entityMap = new Map<string, Recommendation[]>();

  for (const rec of recommendations) {
    if (rec.affectedEntities && Array.isArray(rec.affectedEntities)) {
      for (const entity of rec.affectedEntities) {
        const key = `${entity.entityType}-${entity.entityId}`;
        if (!entityMap.has(key)) {
          entityMap.set(key, []);
        }
        entityMap.get(key)!.push(rec);
      }
    }
  }

  // Find entities with multiple recommendations
  for (const [entityKey, recs] of entityMap.entries()) {
    if (recs.length > 1) {
      conflicts.push({
        id: `entity-conflict-${entityKey}`,
        type: 'mutually_exclusive',
        recommendations: recs as any,
        tradeoffAnalysis: buildTradeoffAnalysis(recs),
        suggestedResolution: `Multiple recommendations for ${entityKey}. Choose highest SBS score or implement sequentially.`,
      });
    }
  }

  return conflicts;
}

// =============================================================================
// TRADEOFF ANALYSIS
// =============================================================================

/**
 * Build tradeoff analysis for conflicting recommendations
 */
function buildTradeoffAnalysis(recommendations: Recommendation[]): any[] {
  return recommendations.map((rec) => {
    const pros: string[] = [];
    const cons: string[] = [];

    // Analyze based on category
    if (rec.category === 'DEBT') {
      pros.push('Reduces debt burden');
      pros.push('Lowers interest costs');
      cons.push('Reduces available cash');
      cons.push('Opportunity cost of investing');
    } else if (rec.category === 'INVESTMENT') {
      pros.push('Builds long-term wealth');
      pros.push('Potential for higher returns');
      cons.push('Market risk');
      cons.push('Liquidity reduction');
    } else if (rec.category === 'CASHFLOW') {
      pros.push('Improves financial safety');
      pros.push('Reduces stress');
      cons.push('Lower returns than investing');
    }

    return {
      option: rec,
      pros,
      cons,
      financialImpact:
        rec.financialImpact?.monthlySavings ||
        rec.financialImpact?.totalSavings ||
        0,
    };
  });
}

/**
 * Suggest resolution for conflicts
 */
function suggestResolution(recommendations: Recommendation[]): string {
  // Sort by SBS score
  const sorted = [...recommendations].sort((a, b) => b.sbsScore - a.sbsScore);

  const highest = sorted[0];

  return `Recommendation: Proceed with "${highest.title}" (SBS: ${highest.sbsScore.toFixed(1)}) as it provides the highest strategic benefit. Other options can be considered subsequently.`;
}

// =============================================================================
// CONFLICT RESOLUTION HELPERS
// =============================================================================

/**
 * Resolve conflicts automatically based on SBS scores
 */
export function autoResolveConflicts(
  conflicts: ConflictGroup[]
): Map<string, string> {
  const resolutions = new Map<string, string>();

  for (const conflict of conflicts) {
    const sorted = [...conflict.recommendations].sort(
      (a: any, b: any) => b.sbsScore - a.sbsScore
    );

    resolutions.set(
      conflict.id,
      `Selected: ${sorted[0].title} (SBS: ${sorted[0].sbsScore.toFixed(1)})`
    );
  }

  return resolutions;
}

/**
 * Check if two recommendations conflict
 */
export function hasConflict(rec1: Recommendation, rec2: Recommendation): boolean {
  // Same entity
  if (rec1.affectedEntities && rec2.affectedEntities) {
    for (const e1 of rec1.affectedEntities) {
      for (const e2 of rec2.affectedEntities) {
        if (
          e1.entityType === e2.entityType &&
          e1.entityId === e2.entityId
        ) {
          return true;
        }
      }
    }
  }

  // Mutually exclusive types
  const exclusive = [
    ['DEBT_REFINANCE', 'DEBT_EARLY_REPAY'],
    ['PROPERTY_LOW_YIELD', 'PROPERTY_LOW_GROWTH'],
  ];

  for (const [type1, type2] of exclusive) {
    if (
      (rec1.type === type1 && rec2.type === type2) ||
      (rec1.type === type2 && rec2.type === type1)
    ) {
      return true;
    }
  }

  return false;
}
