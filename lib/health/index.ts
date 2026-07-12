/**
 * FINANCIAL HEALTH ENGINE
 * Phase 12 - Holistic Financial Assessment
 *
 * Exports all health engine functionality.
 */

// Types
export * from './types';

// Layer 1: Metric Aggregation
export * from './metricAggregation';

// Layer 2: Category Scoring
export * from './categoryScoring';

// Layer 3: Aggregate Health Engine
export * from './aggregateEngine';

// Canonical FinancialHealthInput builder (MON-030 §12.2.1 — one source, was
// duplicated in the financial-health + insights routes).
export * from './buildHealthInput';

// Risk Modelling System
export * from './riskModelling';
