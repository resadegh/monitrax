'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import {
  Building2,
  BarChart3,
  Landmark,
  Car,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Wallet,
  DollarSign,
  Receipt,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// Entity types for cashflow tracking
export interface PropertyCashflow {
  id: string;
  name: string;
  type: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  netCashflow: number;
  isPositive: boolean;
}

export interface InvestmentCashflow {
  id: string;
  name: string;
  type: string;
  monthlyDividends: number;
  monthlyDistributions: number;
  monthlyExpenses: number;
  netCashflow: number;
  isPositive: boolean;
}

export interface LoanCashflow {
  id: string;
  name: string;
  type: string;
  monthlyRepayment: number;
  taxBenefit: number; // Monthly tax savings if deductible
  netCashflowImpact: number; // repayment - tax benefit
  isDeductible: boolean;
  isPropertyLinked: boolean; // HOME/INVESTMENT loans are linked to properties
  propertyName?: string | null;
}

export interface AssetCashflow {
  id: string;
  name: string;
  type: string;
  monthlyRunningCost: number; // Rego, insurance, fuel, maintenance
}

export interface EntityCashflowData {
  properties: PropertyCashflow[];
  investments: InvestmentCashflow[];
  loans: LoanCashflow[];
  assets: AssetCashflow[];
  summary: {
    propertiesNet: number;        // Already includes property-linked loan repayments
    investmentsNet: number;
    loansNet: number;             // Total of all loans (for display in Loans tab)
    standaloneLoansCost: number;  // Only loans NOT linked to properties (car, personal, etc.)
    assetsNet: number;
    totalEntityCashflow: number;  // propertiesNet + investmentsNet - standaloneLoansCost + assetsNet
  };
}

interface EntityCashflowSummaryProps {
  data: EntityCashflowData;
  onEntityClick?: (entityType: string, entityId: string) => void;
}

// Helper to format cashflow value with color
function CashflowValue({ value, size = 'default' }: { value: number; size?: 'default' | 'large' }) {
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const sizeClass = size === 'large' ? 'text-lg font-bold' : 'text-sm font-semibold';

  return (
    <span className={`${colorClass} ${sizeClass}`}>
      {isPositive ? '+' : ''}{formatCurrency(value)}
    </span>
  );
}

// Entity row component
function EntityRow({
  icon: Icon,
  name,
  subtitle,
  cashflow,
  details,
  href,
  onClick,
}: {
  icon: any;
  name: string;
  subtitle?: string;
  cashflow: number;
  details?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = cashflow >= 0;

  // Handle expand toggle - separate from navigation
  const handleExpandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
  };

  // Handle navigation - only when clicking on the row (not expand button)
  const handleRowClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isPositive
          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900'
          : 'bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${isPositive ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
            <Icon className={`h-4 w-4 ${isPositive ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CashflowValue value={cashflow} />
          {details && (
            <button
              onClick={handleExpandClick}
              className="p-1 hover:bg-muted rounded"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          {href && (
            <Link href={href} onClick={(e) => e.stopPropagation()}>
              <button className="p-1 hover:bg-muted rounded" aria-label="View details">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </Link>
          )}
        </div>
      </div>
      {expanded && details && (
        <div className="mt-3 pt-3 border-t border-dashed text-xs space-y-1">
          {details}
        </div>
      )}
    </div>
  );
}

export function EntityCashflowSummary({ data, onEntityClick }: EntityCashflowSummaryProps) {
  const { properties, investments, loans, assets, summary } = data;

  // Calculate entity counts
  const positiveProperties = properties.filter(p => p.isPositive).length;
  const positiveInvestments = investments.filter(i => i.isPositive).length;

  const hasEntities = properties.length > 0 || investments.length > 0 || loans.length > 0 || assets.length > 0;

  if (!hasEntities) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            Cashflow by Entity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Add properties, investments, or loans to see entity-level cashflow
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Cashflow by Entity
          </div>
          <Badge variant="outline" className={summary.totalEntityCashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
            {summary.totalEntityCashflow >= 0 ? '+' : ''}{formatCurrency(summary.totalEntityCashflow)}/mo
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="properties" className="text-xs px-2 py-1.5">
              <Building2 className="h-3 w-3 mr-1" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="investments" className="text-xs px-2 py-1.5">
              <BarChart3 className="h-3 w-3 mr-1" />
              Investments
            </TabsTrigger>
            <TabsTrigger value="loans" className="text-xs px-2 py-1.5">
              <Landmark className="h-3 w-3 mr-1" />
              Loans
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-xs px-2 py-1.5">
              <Car className="h-3 w-3 mr-1" />
              Assets
            </TabsTrigger>
          </TabsList>

          {/* Properties Tab */}
          <TabsContent value="properties" className="mt-4 space-y-3">
            {properties.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {positiveProperties}/{properties.length} positive cashflow
                  </span>
                  <span className="font-semibold">
                    Net: <CashflowValue value={summary.propertiesNet} />
                  </span>
                </div>
                {properties.map((property) => (
                  <EntityRow
                    key={property.id}
                    icon={Building2}
                    name={property.name}
                    subtitle={property.type}
                    cashflow={property.netCashflow}
                    href={`/dashboard/properties`}
                    details={
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rental Income</span>
                          <span className="text-green-600">+{formatCurrency(property.monthlyIncome)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expenses</span>
                          <span className="text-red-600">-{formatCurrency(property.monthlyExpenses)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Loan Repayments</span>
                          <span className="text-red-600">-{formatCurrency(property.monthlyLoanRepayments)}</span>
                        </div>
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No properties added yet
              </div>
            )}
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="mt-4 space-y-3">
            {investments.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {positiveInvestments}/{investments.length} generating income
                  </span>
                  <span className="font-semibold">
                    Net: <CashflowValue value={summary.investmentsNet} />
                  </span>
                </div>
                {investments.map((investment) => (
                  <EntityRow
                    key={investment.id}
                    icon={BarChart3}
                    name={investment.name}
                    subtitle={investment.type}
                    cashflow={investment.netCashflow}
                    href={`/dashboard/investments/accounts`}
                    details={
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dividends</span>
                          <span className="text-green-600">+{formatCurrency(investment.monthlyDividends)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Distributions</span>
                          <span className="text-green-600">+{formatCurrency(investment.monthlyDistributions)}</span>
                        </div>
                        {investment.monthlyExpenses > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fees/Expenses</span>
                            <span className="text-red-600">-{formatCurrency(investment.monthlyExpenses)}</span>
                          </div>
                        )}
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No investment accounts added yet
              </div>
            )}
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans" className="mt-4 space-y-3">
            {loans.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {loans.filter(l => l.isDeductible).length} tax-deductible
                  </span>
                </div>
                {/* Note about property loans */}
                {loans.some(l => l.isPropertyLinked) && (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    Note: Property loan repayments are already included in property cashflow above.
                  </p>
                )}
                {loans.map((loan) => (
                  <EntityRow
                    key={loan.id}
                    icon={Landmark}
                    name={loan.name}
                    subtitle={
                      loan.isPropertyLinked
                        ? `${loan.type} · ${loan.propertyName || 'Property'} (in property cashflow)`
                        : loan.type
                    }
                    cashflow={-loan.netCashflowImpact}
                    href={`/dashboard/loans`}
                    details={
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly Repayment</span>
                          <span className="text-red-600">-{formatCurrency(loan.monthlyRepayment)}</span>
                        </div>
                        {loan.isDeductible && loan.taxBenefit > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax Benefit (est.)</span>
                            <span className="text-green-600">+{formatCurrency(loan.taxBenefit)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium">
                          <span>Net Impact</span>
                          <span className="text-red-600">-{formatCurrency(loan.netCashflowImpact)}</span>
                        </div>
                        {loan.isPropertyLinked && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Already counted in property cashflow
                          </p>
                        )}
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No loans added yet
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-4 space-y-3">
            {assets.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    Running costs for {assets.length} asset{assets.length !== 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold">
                    Net: <CashflowValue value={summary.assetsNet} />
                  </span>
                </div>
                {assets.map((asset) => (
                  <EntityRow
                    key={asset.id}
                    icon={Car}
                    name={asset.name}
                    subtitle={asset.type}
                    cashflow={-asset.monthlyRunningCost}
                    href={`/dashboard/assets`}
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No personal assets with running costs
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Properties (incl. loans)</span>
              <CashflowValue value={summary.propertiesNet} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Investments</span>
              <CashflowValue value={summary.investmentsNet} />
            </div>
            {summary.standaloneLoansCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Standalone Loans</span>
                <CashflowValue value={-summary.standaloneLoansCost} />
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assets (running costs)</span>
              <CashflowValue value={summary.assetsNet} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="font-medium">Total Entity Cashflow</span>
            <CashflowValue value={summary.totalEntityCashflow} size="large" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to calculate entity cashflow from snapshot data
export function calculateEntityCashflow(
  properties: Array<{
    id: string;
    name: string;
    type: string;
    cashflow: {
      annualIncome?: number;
      annualExpenses?: number;
      annualLoanRepayments?: number;
      monthlyNet: number;
    };
  }>,
  investmentAccounts: Array<{
    id: string;
    name: string;
    type: string;
    totalValue: number;
  }>,
  loans: Array<{
    id: string;
    name: string;
    type: string;
    principal: number;
    interestRate: number;
    annualRepayment?: number;
    propertyName?: string | null;
  }>,
  assets: Array<{
    id: string;
    name: string;
    type: string;
    expenses?: {
      monthlyTotal: number;
    };
  }>,
  income: Array<{
    id: string;
    type: string;
    investmentAccountId?: string | null;
    netAnnual: number;
  }>,
  marginalTaxRate: number = 0.37
): EntityCashflowData {
  // Calculate property cashflows
  const propertyCashflows: PropertyCashflow[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    monthlyIncome: (p.cashflow.annualIncome || 0) / 12,
    monthlyExpenses: (p.cashflow.annualExpenses || 0) / 12,
    monthlyLoanRepayments: (p.cashflow.annualLoanRepayments || 0) / 12,
    netCashflow: p.cashflow.monthlyNet,
    isPositive: p.cashflow.monthlyNet >= 0,
  }));

  // Calculate investment cashflows (from linked income)
  const investmentCashflows: InvestmentCashflow[] = investmentAccounts.map((acc) => {
    // Find income linked to this investment account
    const linkedIncome = income.filter(
      (i) => i.investmentAccountId === acc.id && (i.type === 'DIVIDEND' || i.type === 'DISTRIBUTION')
    );
    const monthlyDividends = linkedIncome
      .filter((i) => i.type === 'DIVIDEND')
      .reduce((sum, i) => sum + i.netAnnual / 12, 0);
    const monthlyDistributions = linkedIncome
      .filter((i) => i.type === 'DISTRIBUTION')
      .reduce((sum, i) => sum + i.netAnnual / 12, 0);

    const netCashflow = monthlyDividends + monthlyDistributions;

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      monthlyDividends,
      monthlyDistributions,
      monthlyExpenses: 0, // TODO: Link investment-related expenses
      netCashflow,
      isPositive: netCashflow >= 0,
    };
  });

  // Calculate loan cashflows
  // Track which loans are linked to properties (their repayments are already in property cashflow)
  const loanCashflows: LoanCashflow[] = loans.map((loan) => {
    const monthlyRepayment = (loan.annualRepayment || 0) / 12;
    const isDeductible = loan.type === 'INVESTMENT' || loan.type === 'BUSINESS';
    const isPropertyLinked = loan.type === 'HOME' || loan.type === 'INVESTMENT';

    // Estimate tax benefit: interest portion × marginal tax rate
    // Simplified: assume ~60% of repayment is interest for newer loans
    const estimatedInterestPortion = loan.principal * (loan.interestRate / 100) / 12;
    const taxBenefit = isDeductible ? estimatedInterestPortion * marginalTaxRate : 0;

    return {
      id: loan.id,
      name: loan.name,
      type: loan.type,
      monthlyRepayment,
      taxBenefit,
      netCashflowImpact: monthlyRepayment - taxBenefit,
      isDeductible,
      propertyName: loan.propertyName,
      isPropertyLinked, // Track if this loan is already counted in property cashflow
    };
  });

  // Calculate asset cashflows
  const assetCashflows: AssetCashflow[] = assets
    .filter((a) => a.expenses && a.expenses.monthlyTotal > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      monthlyRunningCost: a.expenses?.monthlyTotal || 0,
    }));

  // Calculate summary
  const propertiesNet = propertyCashflows.reduce((sum, p) => sum + p.netCashflow, 0);
  const investmentsNet = investmentCashflows.reduce((sum, i) => sum + i.netCashflow, 0);

  // All loans (for display in Loans tab)
  const loansNet = -loanCashflows.reduce((sum, l) => sum + l.netCashflowImpact, 0);

  // Only standalone loans (NOT property-linked) - these are NOT already counted in property cashflow
  // Standalone loans: CAR, PERSONAL, LINE_OF_CREDIT, STUDENT, BUSINESS (non-property)
  const standaloneLoansCost = loanCashflows
    .filter((l) => !l.isPropertyLinked)
    .reduce((sum, l) => sum + l.netCashflowImpact, 0);

  const assetsNet = -assetCashflows.reduce((sum, a) => sum + a.monthlyRunningCost, 0);

  // Total: Properties already include their loan repayments, so we only add standalone loans separately
  // propertiesNet = rental income - expenses - property loan repayments
  // standaloneLoansCost = car loans, personal loans, etc. (not in property cashflow)
  const totalEntityCashflow = propertiesNet + investmentsNet - standaloneLoansCost + assetsNet;

  return {
    properties: propertyCashflows,
    investments: investmentCashflows,
    loans: loanCashflows,
    assets: assetCashflows,
    summary: {
      propertiesNet,
      investmentsNet,
      loansNet,
      standaloneLoansCost,
      assetsNet,
      totalEntityCashflow,
    },
  };
}
