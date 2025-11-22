/**
 * Monitrax Investment Cost Base Engine
 * Phase 4 - Cost Base Tracking for Tax Purposes
 *
 * Implements FIFO, LIFO, and Average cost methods per Australian tax rules.
 * Default for Australian investors is typically AVG for shares.
 */

// =============================================================================
// TYPES
// =============================================================================

export type CostMethod = 'FIFO' | 'LIFO' | 'AVG';

export interface PurchaseLot {
  id: string;
  date: Date;
  units: number;
  pricePerUnit: number;
  fees: number;
  remainingUnits: number; // Units not yet sold
}

export interface SaleTransaction {
  date: Date;
  units: number;
  pricePerUnit: number;
  fees: number;
}

export interface CostBaseResult {
  totalCostBase: number;
  averageCostPerUnit: number;
  lots: PurchaseLot[];
  totalUnits: number;
}

export interface SaleResult {
  proceeds: number;
  costBase: number;
  capitalGain: number;
  capitalLoss: number;
  lotsUsed: Array<{
    lotId: string;
    unitsUsed: number;
    costUsed: number;
    holdingPeriodDays: number;
    eligibleForDiscount: boolean;
  }>;
  discountableGain: number;
  nonDiscountableGain: number;
}

export interface UnrealisedGain {
  totalUnrealisedGain: number;
  totalUnrealisedLoss: number;
  netUnrealisedGain: number;
  unrealisedGainByLot: Array<{
    lotId: string;
    units: number;
    costBase: number;
    currentValue: number;
    gain: number;
    holdingPeriodDays: number;
    eligibleForDiscount: boolean;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const CGT_DISCOUNT_HOLDING_DAYS = 365;
export const CGT_DISCOUNT_RATE = 0.5;

// =============================================================================
// AVERAGE COST METHOD (Default for AU)
// =============================================================================

/**
 * Calculate cost base using average cost method.
 * Most common method for Australian share investors.
 *
 * @param lots - Array of purchase lots
 * @returns Cost base result
 */
export function calculateAverageCostBase(lots: PurchaseLot[]): CostBaseResult {
  if (lots.length === 0) {
    return {
      totalCostBase: 0,
      averageCostPerUnit: 0,
      lots: [],
      totalUnits: 0
    };
  }

  let totalCost = 0;
  let totalUnits = 0;

  for (const lot of lots) {
    const lotCost = (lot.remainingUnits * lot.pricePerUnit) + (lot.fees * (lot.remainingUnits / lot.units));
    totalCost += lotCost;
    totalUnits += lot.remainingUnits;
  }

  return {
    totalCostBase: totalCost,
    averageCostPerUnit: totalUnits > 0 ? totalCost / totalUnits : 0,
    lots,
    totalUnits
  };
}

/**
 * Process a sale using average cost method.
 *
 * @param lots - Array of purchase lots
 * @param sale - Sale transaction
 * @returns Sale result with updated lots
 */
export function processSaleAverageCost(
  lots: PurchaseLot[],
  sale: SaleTransaction
): { result: SaleResult; updatedLots: PurchaseLot[] } {
  const costBase = calculateAverageCostBase(lots);
  const unitsToSell = sale.units;

  if (unitsToSell > costBase.totalUnits) {
    throw new Error('Cannot sell more units than held');
  }

  const costOfSoldUnits = unitsToSell * costBase.averageCostPerUnit;
  const proceeds = (sale.pricePerUnit * sale.units) - sale.fees;
  const capitalGain = Math.max(0, proceeds - costOfSoldUnits);
  const capitalLoss = Math.max(0, costOfSoldUnits - proceeds);

  // For average method, we proportionally reduce all lots
  const reductionRatio = unitsToSell / costBase.totalUnits;
  const updatedLots = lots.map(lot => ({
    ...lot,
    remainingUnits: lot.remainingUnits * (1 - reductionRatio)
  })).filter(lot => lot.remainingUnits > 0.0001);

  // Calculate holding period based on weighted average acquisition date
  const weightedDays = lots.reduce((sum, lot) => {
    const days = Math.floor((sale.date.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));
    return sum + (days * lot.remainingUnits);
  }, 0) / costBase.totalUnits;

  const eligibleForDiscount = weightedDays >= CGT_DISCOUNT_HOLDING_DAYS;

  return {
    result: {
      proceeds,
      costBase: costOfSoldUnits,
      capitalGain,
      capitalLoss,
      lotsUsed: [{
        lotId: 'AVG',
        unitsUsed: unitsToSell,
        costUsed: costOfSoldUnits,
        holdingPeriodDays: Math.floor(weightedDays),
        eligibleForDiscount
      }],
      discountableGain: eligibleForDiscount ? capitalGain : 0,
      nonDiscountableGain: eligibleForDiscount ? 0 : capitalGain
    },
    updatedLots
  };
}

// =============================================================================
// FIFO (First In, First Out)
// =============================================================================

/**
 * Process a sale using FIFO method.
 * Sells oldest shares first.
 *
 * @param lots - Array of purchase lots (should be sorted by date ascending)
 * @param sale - Sale transaction
 * @returns Sale result with updated lots
 */
export function processSaleFIFO(
  lots: PurchaseLot[],
  sale: SaleTransaction
): { result: SaleResult; updatedLots: PurchaseLot[] } {
  const sortedLots = [...lots].sort((a, b) => a.date.getTime() - b.date.getTime());
  let remainingToSell = sale.units;
  let totalCostBase = 0;
  const lotsUsed: SaleResult['lotsUsed'] = [];
  const updatedLots: PurchaseLot[] = [];

  for (const lot of sortedLots) {
    if (remainingToSell <= 0) {
      updatedLots.push(lot);
      continue;
    }

    const unitsFromThisLot = Math.min(lot.remainingUnits, remainingToSell);
    const feesPerUnit = lot.fees / lot.units;
    const costFromThisLot = (unitsFromThisLot * lot.pricePerUnit) + (unitsFromThisLot * feesPerUnit);

    totalCostBase += costFromThisLot;
    remainingToSell -= unitsFromThisLot;

    const holdingDays = Math.floor((sale.date.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));

    lotsUsed.push({
      lotId: lot.id,
      unitsUsed: unitsFromThisLot,
      costUsed: costFromThisLot,
      holdingPeriodDays: holdingDays,
      eligibleForDiscount: holdingDays >= CGT_DISCOUNT_HOLDING_DAYS
    });

    const remainingInLot = lot.remainingUnits - unitsFromThisLot;
    if (remainingInLot > 0.0001) {
      updatedLots.push({
        ...lot,
        remainingUnits: remainingInLot
      });
    }
  }

  if (remainingToSell > 0.0001) {
    throw new Error('Cannot sell more units than held');
  }

  const proceeds = (sale.pricePerUnit * sale.units) - sale.fees;
  const capitalGain = Math.max(0, proceeds - totalCostBase);
  const capitalLoss = Math.max(0, totalCostBase - proceeds);

  // Calculate discountable vs non-discountable gain
  let discountableGain = 0;
  let nonDiscountableGain = 0;

  if (capitalGain > 0) {
    const totalUnitsUsed = lotsUsed.reduce((sum, l) => sum + l.unitsUsed, 0);
    for (const lotUsed of lotsUsed) {
      const proportionOfGain = capitalGain * (lotUsed.unitsUsed / totalUnitsUsed);
      if (lotUsed.eligibleForDiscount) {
        discountableGain += proportionOfGain;
      } else {
        nonDiscountableGain += proportionOfGain;
      }
    }
  }

  return {
    result: {
      proceeds,
      costBase: totalCostBase,
      capitalGain,
      capitalLoss,
      lotsUsed,
      discountableGain,
      nonDiscountableGain
    },
    updatedLots
  };
}

// =============================================================================
// LIFO (Last In, First Out)
// =============================================================================

/**
 * Process a sale using LIFO method.
 * Sells newest shares first.
 *
 * @param lots - Array of purchase lots
 * @param sale - Sale transaction
 * @returns Sale result with updated lots
 */
export function processSaleLIFO(
  lots: PurchaseLot[],
  sale: SaleTransaction
): { result: SaleResult; updatedLots: PurchaseLot[] } {
  // Same as FIFO but sort descending by date
  const sortedLots = [...lots].sort((a, b) => b.date.getTime() - a.date.getTime());
  let remainingToSell = sale.units;
  let totalCostBase = 0;
  const lotsUsed: SaleResult['lotsUsed'] = [];
  const updatedLots: PurchaseLot[] = [];

  for (const lot of sortedLots) {
    if (remainingToSell <= 0) {
      updatedLots.push(lot);
      continue;
    }

    const unitsFromThisLot = Math.min(lot.remainingUnits, remainingToSell);
    const feesPerUnit = lot.fees / lot.units;
    const costFromThisLot = (unitsFromThisLot * lot.pricePerUnit) + (unitsFromThisLot * feesPerUnit);

    totalCostBase += costFromThisLot;
    remainingToSell -= unitsFromThisLot;

    const holdingDays = Math.floor((sale.date.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));

    lotsUsed.push({
      lotId: lot.id,
      unitsUsed: unitsFromThisLot,
      costUsed: costFromThisLot,
      holdingPeriodDays: holdingDays,
      eligibleForDiscount: holdingDays >= CGT_DISCOUNT_HOLDING_DAYS
    });

    const remainingInLot = lot.remainingUnits - unitsFromThisLot;
    if (remainingInLot > 0.0001) {
      updatedLots.push({
        ...lot,
        remainingUnits: remainingInLot
      });
    }
  }

  if (remainingToSell > 0.0001) {
    throw new Error('Cannot sell more units than held');
  }

  const proceeds = (sale.pricePerUnit * sale.units) - sale.fees;
  const capitalGain = Math.max(0, proceeds - totalCostBase);
  const capitalLoss = Math.max(0, totalCostBase - proceeds);

  // Calculate discountable vs non-discountable gain
  let discountableGain = 0;
  let nonDiscountableGain = 0;

  if (capitalGain > 0) {
    const totalUnitsUsed = lotsUsed.reduce((sum, l) => sum + l.unitsUsed, 0);
    for (const lotUsed of lotsUsed) {
      const proportionOfGain = capitalGain * (lotUsed.unitsUsed / totalUnitsUsed);
      if (lotUsed.eligibleForDiscount) {
        discountableGain += proportionOfGain;
      } else {
        nonDiscountableGain += proportionOfGain;
      }
    }
  }

  // Re-sort updated lots by date for consistency
  updatedLots.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    result: {
      proceeds,
      costBase: totalCostBase,
      capitalGain,
      capitalLoss,
      lotsUsed,
      discountableGain,
      nonDiscountableGain
    },
    updatedLots
  };
}

// =============================================================================
// UNIFIED SALE PROCESSOR
// =============================================================================

/**
 * Process a sale using specified cost method.
 *
 * @param lots - Array of purchase lots
 * @param sale - Sale transaction
 * @param method - Cost method to use
 * @returns Sale result with updated lots
 */
export function processSale(
  lots: PurchaseLot[],
  sale: SaleTransaction,
  method: CostMethod = 'AVG'
): { result: SaleResult; updatedLots: PurchaseLot[] } {
  switch (method) {
    case 'FIFO':
      return processSaleFIFO(lots, sale);
    case 'LIFO':
      return processSaleLIFO(lots, sale);
    case 'AVG':
    default:
      return processSaleAverageCost(lots, sale);
  }
}

// =============================================================================
// UNREALISED GAINS CALCULATION
// =============================================================================

/**
 * Calculate unrealised gains for current holdings.
 *
 * @param lots - Array of purchase lots
 * @param currentPricePerUnit - Current market price per unit
 * @returns Unrealised gain breakdown
 */
export function calculateUnrealisedGains(
  lots: PurchaseLot[],
  currentPricePerUnit: number
): UnrealisedGain {
  const today = new Date();
  let totalUnrealisedGain = 0;
  let totalUnrealisedLoss = 0;
  const unrealisedGainByLot: UnrealisedGain['unrealisedGainByLot'] = [];

  for (const lot of lots) {
    if (lot.remainingUnits <= 0) continue;

    const feesPerUnit = lot.fees / lot.units;
    const costBase = (lot.remainingUnits * lot.pricePerUnit) + (lot.remainingUnits * feesPerUnit);
    const currentValue = lot.remainingUnits * currentPricePerUnit;
    const gain = currentValue - costBase;
    const holdingDays = Math.floor((today.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));

    if (gain > 0) {
      totalUnrealisedGain += gain;
    } else {
      totalUnrealisedLoss += Math.abs(gain);
    }

    unrealisedGainByLot.push({
      lotId: lot.id,
      units: lot.remainingUnits,
      costBase,
      currentValue,
      gain,
      holdingPeriodDays: holdingDays,
      eligibleForDiscount: holdingDays >= CGT_DISCOUNT_HOLDING_DAYS
    });
  }

  return {
    totalUnrealisedGain,
    totalUnrealisedLoss,
    netUnrealisedGain: totalUnrealisedGain - totalUnrealisedLoss,
    unrealisedGainByLot
  };
}

/**
 * Add a new purchase lot.
 *
 * @param existingLots - Existing purchase lots
 * @param purchase - New purchase details
 * @returns Updated lots array
 */
export function addPurchaseLot(
  existingLots: PurchaseLot[],
  purchase: Omit<PurchaseLot, 'remainingUnits'>
): PurchaseLot[] {
  return [
    ...existingLots,
    {
      ...purchase,
      remainingUnits: purchase.units
    }
  ];
}
