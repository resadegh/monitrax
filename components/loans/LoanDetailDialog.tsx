'use client';

/**
 * LoanDetailDialog — shared loan detail modal.
 *
 * Phase 36 Phase 2a — extracted from `/dashboard/loans/page.tsx` so the
 * same Overview / Property / Offset / Expenses / Strategy / Linked tab
 * structure can be opened from any page (currently used by
 * `/dashboard/loans` and `/dashboard/balances`).
 *
 * The dialog is pure presentation. Side-effects the parent must
 * handle through callbacks:
 *   - `onEdit`                 — open the edit form for this loan
 *   - `onDelete`               — confirm-and-delete this loan; when
 *                                omitted the Delete button is hidden
 *   - `onLinkedEntityNavigate` — handle GRDCS Linked-tab clicks
 *
 * Calculations:
 *   - Effective principal: `calculateEffectivePrincipal()` from the
 *     canonical SSOT (CLAUDE.md §12.2 / `lib/utils/calculations.ts`).
 *     Replaces the local `calculateEffectiveBalance()` that the
 *     legacy loans page used — same `Math.max(0, principal - offset)`
 *     math, single source of truth.
 *   - Annual interest cost: `effectivePrincipal × annualRate` —
 *     preserved EXACTLY as the legacy page had it.
 *   - LVR: `calculateLVR()` from canonical SSOT (returns 0-100; we
 *     guard the no-property case here so the dialog renders cleanly).
 *   - Linked-expense annualisation: `toAnnual()` from canonical
 *     `lib/utils/frequencies.ts` SSOT — replaces the local
 *     `convertToAnnual()` that the legacy page had.
 *
 * No data fetching inside the dialog. Caller passes the full loan
 * shape (including `_links`/`_meta` for the Linked tab and `expenses`
 * for the Expenses tab) so the dialog stays a pure render.
 */

import {
  Landmark,
  Edit2,
  Building,
  Wallet,
  Receipt,
  Lightbulb,
  Link2,
  Home as HomeIcon,
  Trash2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { resolveLoanMonthlyCost } from '@/lib/calculations/propertyCashflow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import Link from 'next/link';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { LoanRepaymentsTab } from '@/components/loans/LoanRepaymentsTab';
import EntityStrategyTab from '@/components/strategy/EntityStrategyTab';
import { useModuleEnabled } from '@/lib/featureFlags/ModuleGateContext';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { Percent, TrendingDown as TrendingDownIcon, ArrowRight as ArrowRightIcon } from 'lucide-react';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  calculateEffectivePrincipal,
  calculateLVR as calculateLVRSSOT,
} from '@/lib/utils/calculations';
import { toAnnual } from '@/lib/utils/frequencies';

// =============================================================================
// TYPES
// =============================================================================

export interface LoanDetailExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
  vendorName?: string;
}

export interface LoanDetail {
  id: string;
  name: string;
  type:
    | 'HOME'
    | 'INVESTMENT'
    | 'CAR'
    | 'PERSONAL'
    | 'LINE_OF_CREDIT'
    | 'STUDENT'
    | 'BUSINESS';
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  fixedExpiry?: string | null;
  extraRepaymentCap?: number | null;
  property?: {
    id: string;
    name: string;
    currentValue: number;
    address?: string | null;
  } | null;
  offsetAccount?: {
    id: string;
    name: string;
    currentBalance: number;
    institution?: string | null;
  } | null;
  expenses?: LoanDetailExpense[];
  /** VR-013 F1: THE canonical actuals-first monthly cost, computed server-side
   *  by /api/loans (linked repayments over the trailing-12-month window →
   *  declared → interest floor). The Overview card headlines this — the
   *  balance×rate figure below it is only the contractual estimate. */
  resolvedCost?: {
    monthly: number;
    monthlyInterest: number;
    usedActuals: boolean;
    flooredToInterest: boolean;
  } | null;
  _links?: {
    self: string;
    related: GRDCSLinkedEntity[];
  };
  _meta?: {
    linkedCount: number;
    missingLinks: GRDCSMissingLink[];
  };
}

interface LoanDetailDialogProps {
  loan: LoanDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user clicks "Edit Loan" in the footer. */
  onEdit?: (loan: LoanDetail) => void;
  /**
   * Called when the user confirms the delete action. Caller is
   * responsible for the API DELETE call and reloading its list.
   * When omitted the Delete button is hidden — useful for read-only
   * surfaces.
   */
  onDelete?: (loan: LoanDetail) => void | Promise<void>;
  /** GRDCS Linked tab navigation handler. */
  onLinkedEntityNavigate?: (entity: GRDCSLinkedEntity) => void;
  /**
   * Phase 51 follow-up — which tab to open on. Lets entry points (e.g. the
   * "Import statement" actions on the Balances page / loan edit form) deep-link
   * straight to the Repayments import. Defaults to 'overview'.
   */
  initialTab?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const LOAN_TYPE_LABEL: Record<LoanDetail['type'], string> = {
  HOME: 'Home Loan',
  INVESTMENT: 'Investment Loan',
  CAR: 'Car Loan',
  PERSONAL: 'Personal Loan',
  LINE_OF_CREDIT: 'Line of Credit',
  STUDENT: 'Student / HECS-HELP',
  BUSINESS: 'Business Loan',
};

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function effectivePrincipalFor(loan: LoanDetail): number {
  return calculateEffectivePrincipal(
    loan.principal,
    loan.offsetAccount?.currentBalance ?? 0
  );
}

function annualInterestFor(loan: LoanDetail): number {
  return effectivePrincipalFor(loan) * loan.interestRateAnnual;
}

/**
 * VR-013 F1: the canonical actuals-first monthly cost. Prefers the
 * server-resolved `resolvedCost` from /api/loans (fed with linked repayments
 * over the ONE trailing-12-month window); falls back to the pure client-side
 * declared→floor resolution only while that field is absent.
 */
function monthlyCostFor(loan: LoanDetail) {
  return loan.resolvedCost ?? resolveLoanMonthlyCost(loan);
}

/**
 * LVR with property-presence guard. Canonical
 * `calculateLVR(loanBalance, propertyValue)` returns 0 when
 * propertyValue is 0; we want a `null` so the caller can hide the
 * row entirely when no property is linked.
 */
function lvrFor(loan: LoanDetail): number | null {
  if (!loan.property?.currentValue || loan.property.currentValue <= 0) {
    return null;
  }
  return calculateLVRSSOT(loan.principal, loan.property.currentValue);
}

function totalLinkedExpensesAnnual(loan: LoanDetail): number {
  if (!loan.expenses || loan.expenses.length === 0) return 0;
  return loan.expenses.reduce(
    // toAnnual() handles WEEKLY / FORTNIGHTLY / MONTHLY / QUARTERLY /
    // ANNUAL identically to the legacy page's local helper.
    (sum, e) => sum + toAnnual(e.amount, e.frequency as Parameters<typeof toAnnual>[1]),
    0
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LoanDetailDialog({
  loan,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onLinkedEntityNavigate,
  initialTab,
}: LoanDetailDialogProps) {
  // PROD Simplification P1: the per-item Strategy tab is a MODULE_STRATEGY
  // surface (plan §2.2 "per-item tabs") — hidden until the flag is ON.
  const strategyModuleEnabled = useModuleEnabled('MODULE_STRATEGY');
  // Phase 51 follow-up — controlled tab so entry points can deep-link to
  // "repayments" (the statement import). Resets to the requested tab each time
  // the dialog opens; `defaultValue` alone wouldn't update on re-open.
  const [activeTab, setActiveTab] = useState(initialTab ?? 'overview');
  useEffect(() => {
    if (open) setActiveTab(initialTab ?? 'overview');
  }, [open, initialTab]);

  // Two-step delete: clicking Delete opens an AlertDialog; the
  // user must explicitly confirm before the parent's onDelete
  // fires. Mirrors the AccountDetailDialog pattern.
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const handleConfirmDelete = async () => {
    if (!loan || !onDelete) return;
    setDeletePending(true);
    try {
      await onDelete(loan);
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } finally {
      setDeletePending(false);
    }
  };

  const lvr = loan ? lvrFor(loan) : null;
  const linkedExpenseTotal = loan ? totalLinkedExpensesAnnual(loan) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              {loan?.name}
            </DialogTitle>
            <DialogDescription>Loan details and linked data</DialogDescription>
          </DialogHeader>

          {loan && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="property">Property</TabsTrigger>
                <TabsTrigger value="offset">Offset</TabsTrigger>
                <TabsTrigger value="repayments">Repayments</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                {strategyModuleEnabled && (
                  <TabsTrigger value="strategy" className="gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Strategy
                  </TabsTrigger>
                )}
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Principal Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatCurrency(loan.principal)}
                      </p>
                      {loan.offsetAccount && (
                        <p className="text-sm text-green-600">
                          Effective: {formatCurrency(effectivePrincipalFor(loan))}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Interest Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatPercent(loan.interestRateAnnual)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {loan.rateType}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Monthly Loan Cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* VR-013 F1: headline = the canonical actuals-first cost
                          (same number as property/expenses/cashflow). The
                          balance×rate figure is a contractual ESTIMATE only —
                          pre-fix it was headlined as the cost and diverged
                          from the actual linked repayments. */}
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(monthlyCostFor(loan).monthly)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {monthlyCostFor(loan).usedActuals
                          ? 'from linked repayments'
                          : monthlyCostFor(loan).flooredToInterest
                            ? 'interest floor (no repayment linked or set)'
                            : 'declared repayment'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Interest ~{formatCurrency(annualInterestFor(loan))}/yr — contractual estimate (balance × rate)
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Term Remaining
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {loan.termMonthsRemaining} months
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(loan.termMonthsRemaining / 12).toFixed(1)} years
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Loan Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">
                        {LOAN_TYPE_LABEL[loan.type] ?? loan.type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Repayment Type
                      </span>
                      <span className="font-medium">
                        {loan.isInterestOnly
                          ? 'Interest Only'
                          : 'Principal & Interest'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Min Repayment
                      </span>
                      <span className="font-medium">
                        {formatCurrency(loan.minRepayment)}{' '}
                        {loan.repaymentFrequency.toLowerCase()}
                      </span>
                    </div>
                    {loan.rateType === 'FIXED' && loan.fixedExpiry && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Fixed Rate Expiry
                        </span>
                        <span className="font-medium">
                          {formatDate(loan.fixedExpiry)}
                        </span>
                      </div>
                    )}
                    {loan.extraRepaymentCap != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Extra Repayment Cap
                        </span>
                        <span className="font-medium">
                          {formatCurrency(loan.extraRepaymentCap)}/year
                        </span>
                      </div>
                    )}
                    {lvr !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LVR</span>
                        <span
                          className={`font-medium ${
                            lvr > 80 ? 'text-orange-600' : ''
                          }`}
                        >
                          {lvr.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/*
                  Phase 45.1 — Contextual "What If?" affordances. Deep-links
                  into the lever-detail page with this loan pre-selected so
                  the user doesn't have to re-find it.
                */}
                <WhatIfLoanAffordances loanId={loan.id} loanName={loan.name} />
              </TabsContent>

              <TabsContent value="property" className="space-y-4 pt-4">
                {loan.property ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {loan.property.name}
                      </CardTitle>
                      {loan.property.address && (
                        <CardDescription>{loan.property.address}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Property Value
                          </p>
                          <p className="text-xl font-bold">
                            {formatCurrency(loan.property.currentValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Equity
                          </p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(
                              loan.property.currentValue - loan.principal
                            )}
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>LVR</span>
                          <span>{lvr?.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (lvr ?? 0) > 80 ? 'bg-orange-500' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(lvr ?? 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <HomeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No property linked to this loan</p>
                    <p className="text-sm">Edit the loan to link a property</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="offset" className="space-y-4 pt-4">
                {loan.offsetAccount ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                        {loan.offsetAccount.name}
                      </CardTitle>
                      {loan.offsetAccount.institution && (
                        <CardDescription>
                          {loan.offsetAccount.institution}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Offset Balance
                          </p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(loan.offsetAccount.currentBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Interest Savings
                          </p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(
                              loan.offsetAccount.currentBalance *
                                loan.interestRateAnnual
                            )}
                            /yr
                          </p>
                        </div>
                      </div>
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Principal Balance
                              </p>
                              <p className="font-semibold">
                                {formatCurrency(loan.principal)}
                              </p>
                            </div>
                            <span className="text-2xl text-green-600">−</span>
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Offset Balance
                              </p>
                              <p className="font-semibold text-green-600">
                                {formatCurrency(
                                  loan.offsetAccount.currentBalance
                                )}
                              </p>
                            </div>
                            <span className="text-2xl">=</span>
                            <div>
                              <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                                Effective Balance
                                <HelpTooltip term="effective-principal" />
                              </p>
                              <p className="font-semibold">
                                {formatCurrency(effectivePrincipalFor(loan))}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No offset account linked to this loan</p>
                    <p className="text-sm">
                      Edit the loan to link an offset account
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="repayments">
                <LoanRepaymentsTab loanId={loan.id} />
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4 pt-4">
                {loan.expenses && loan.expenses.length > 0 ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Linked Expenses Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Total Expenses
                            </p>
                            <p className="text-xl font-bold">
                              {loan.expenses.length}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Annual Total
                            </p>
                            <p className="text-xl font-bold text-red-600">
                              {formatCurrency(linkedExpenseTotal)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="space-y-2">
                      {loan.expenses.map((expense) => (
                        <Card key={expense.id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{expense.name}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline">
                                    {expense.category}
                                  </Badge>
                                  {expense.isTaxDeductible && (
                                    <Badge
                                      variant="secondary"
                                      className="text-green-600"
                                    >
                                      Tax Deductible
                                    </Badge>
                                  )}
                                </div>
                                {expense.vendorName && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {expense.vendorName}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatCurrency(expense.amount)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {expense.frequency.toLowerCase()}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No expenses linked to this loan</p>
                    <p className="text-sm">Link expenses from the Expenses page</p>
                  </div>
                )}
              </TabsContent>

              {strategyModuleEnabled && (
                <TabsContent value="strategy" className="mt-4">
                  <EntityStrategyTab
                    entityType="loan"
                    entityId={loan.id}
                    entityName={loan.name}
                  />
                </TabsContent>
              )}

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={loan._links?.related || []}
                  missingLinks={loan._meta?.missingLinks || []}
                  entityType="loan"
                  entityName={loan.name}
                  showHealthScore={true}
                  onNavigate={onLinkedEntityNavigate}
                />
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {onEdit && (
              <Button
                onClick={() => {
                  if (loan) onEdit(loan);
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Loan
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm-delete sub-dialog. Only rendered when onDelete is wired. */}
      {onDelete && (
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={(o) => {
            if (!deletePending) setDeleteConfirmOpen(o);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes <strong>{loan?.name}</strong> and any
                links to properties, offset accounts, expenses, or other
                entities. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleConfirmDelete();
                }}
                disabled={deletePending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletePending ? 'Deleting…' : 'Delete loan'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

// ============================================================================
// Phase 45.1 — Contextual "What If?" affordances on the loan dialog.
// ============================================================================

function WhatIfLoanAffordances({ loanId, loanName }: { loanId: string; loanName: string }) {
  return (
    <div className="rounded-[16px] border border-foreground/10 bg-card/70 p-5 backdrop-blur-xl">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-foreground/60">
        What if?
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        Model how a change to {loanName} would affect your 10-year picture.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href={`/dashboard/cfo/what-if/refinanceLoan?loanId=${encodeURIComponent(loanId)}`}
          className="group flex items-center gap-3 rounded-xl border border-foreground/10 bg-background/50 p-3 transition-all hover:border-amber-500/40 hover:bg-amber-500/5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-rose-400/20">
            <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
          </span>
          <span className="flex-1">
            <p className="text-sm font-medium text-foreground">Refinance this loan</p>
            <p className="text-xs text-muted-foreground">Drop your rate — see the 10-year shift</p>
          </span>
          <ArrowRightIcon className="h-4 w-4 text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60" strokeWidth={2} />
        </Link>
        <Link
          href={`/dashboard/cfo/what-if/payDownLoan?loanId=${encodeURIComponent(loanId)}`}
          className="group flex items-center gap-3 rounded-xl border border-foreground/10 bg-background/50 p-3 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400/20 to-blue-400/20">
            <TrendingDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
          </span>
          <span className="flex-1">
            <p className="text-sm font-medium text-foreground">Pay extra each month</p>
            <p className="text-xs text-muted-foreground">Accelerate your payoff date</p>
          </span>
          <ArrowRightIcon className="h-4 w-4 text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
