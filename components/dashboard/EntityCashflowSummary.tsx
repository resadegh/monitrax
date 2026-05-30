'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditorialCard, Eyebrow } from '@/components/editorial';
import Link from 'next/link';
import {
  Building2,
  BarChart3,
  Landmark,
  Car,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Receipt,
  Briefcase,
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

// Standalone income (excludes rental/investment income which are tracked in their respective entities)
export interface IncomeCashflow {
  id: string;
  name: string;
  type: string; // SALARY, BUSINESS, OTHER
  grossMonthly: number;
  netMonthly: number; // After tax
  isRecurring: boolean;
}

// Standalone expenses (excludes property/asset-linked expenses which are tracked in their respective entities)
export interface ExpenseCashflow {
  id: string;
  name: string;
  category: string;
  monthlyAmount: number;
  isTaxDeductible: boolean;
  isEssential: boolean;
}

export interface EntityCashflowData {
  properties: PropertyCashflow[];
  investments: InvestmentCashflow[];
  loans: LoanCashflow[];
  assets: AssetCashflow[];
  income: IncomeCashflow[]; // Standalone income (salary, business, other - NOT rental/dividends)
  expenses: ExpenseCashflow[]; // Standalone expenses (NOT property/asset-linked)
  summary: {
    propertiesNet: number;        // Already includes property-linked loan repayments
    investmentsNet: number;
    loansNet: number;             // Total of all loans (for display in Loans tab)
    standaloneLoansCost: number;  // Only loans NOT linked to properties (car, personal, etc.)
    assetsNet: number;
    incomeNet: number;            // Standalone income (salary, business, other)
    expensesNet: number;          // Standalone expenses (living costs, subscriptions, etc.)
    totalEntityCashflow: number;  // incomeNet + propertiesNet + investmentsNet - standaloneLoansCost + assetsNet - expensesNet
  };
}

interface EntityCashflowSummaryProps {
  data: EntityCashflowData;
  onEntityClick?: (entityType: string, entityId: string) => void;
}

// Helper to format cashflow value with color
function CashflowValue({ value, size = 'default' }: { value: number; size?: 'default' | 'large' }) {
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-editorial-emerald' : 'text-editorial-amber';
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
          ? 'bg-editorial-emerald/5 border-editorial-emerald/30'
          : 'bg-editorial-amber/5 border-editorial-amber/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${isPositive ? 'bg-editorial-emerald/10' : 'bg-editorial-amber/10'}`}>
            <Icon className={`h-4 w-4 ${isPositive ? 'text-editorial-emerald' : 'text-editorial-amber'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
            {subtitle && <p className="text-xs text-editorial-slate truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CashflowValue value={cashflow} />
          {details && (
            <button
              onClick={handleExpandClick}
              className="p-1 hover:bg-editorial-warm rounded"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-editorial-slate" />
              ) : (
                <ChevronDown className="h-4 w-4 text-editorial-slate" />
              )}
            </button>
          )}
          {href && (
            <Link href={href} onClick={(e) => e.stopPropagation()}>
              <button className="p-1 hover:bg-editorial-warm rounded" aria-label="View details">
                <ChevronRight className="h-4 w-4 text-editorial-slate" />
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
  const { properties, investments, loans, assets, income, expenses, summary } = data;

  // Calculate entity counts
  const positiveProperties = properties.filter(p => p.isPositive).length;
  const positiveInvestments = investments.filter(i => i.isPositive).length;
  const essentialExpenses = expenses?.filter(e => e.isEssential).length || 0;

  const hasEntities = properties.length > 0 || investments.length > 0 || loans.length > 0 || assets.length > 0 || (income && income.length > 0) || (expenses && expenses.length > 0);

  if (!hasEntities) {
    return (
      <EditorialCard hover aria-label="Cashflow by entity">
        <Eyebrow>Cashflow by Entity</Eyebrow>
        <div className="mt-6 py-4 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-editorial-slate/50" />
          <p className="text-[13px] text-editorial-slate">
            Add properties, investments, or loans to see entity-level cashflow.
          </p>
        </div>
      </EditorialCard>
    );
  }

  const totalTone = summary.totalEntityCashflow >= 0 ? 'emerald' : 'amber';

  return (
    <EditorialCard hover aria-label="Cashflow by entity">
      <header className="flex items-center justify-between">
        <Eyebrow>Cashflow by Entity</Eyebrow>
        <span
          className={
            totalTone === 'emerald'
              ? 'rounded-md bg-editorial-emerald/10 px-2 py-0.5 text-[12px] font-medium tabular-nums-data text-editorial-emerald'
              : 'rounded-md bg-editorial-amber/10 px-2 py-0.5 text-[12px] font-medium tabular-nums-data text-editorial-amber'
          }
        >
          {summary.totalEntityCashflow >= 0 ? '+' : ''}
          {formatCurrency(summary.totalEntityCashflow)}/mo
        </span>
      </header>
      <div className="mt-4">
        <Tabs defaultValue="income" className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="income" className="text-xs px-1 py-1.5">
              <Briefcase className="h-3 w-3 mr-0.5" />
              <span className="hidden sm:inline">Income</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs px-1 py-1.5">
              <Receipt className="h-3 w-3 mr-0.5" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="properties" className="text-xs px-1 py-1.5">
              <Building2 className="h-3 w-3 mr-0.5" />
              <span className="hidden sm:inline">Properties</span>
            </TabsTrigger>
            <TabsTrigger value="investments" className="text-xs px-1 py-1.5">
              <BarChart3 className="h-3 w-3 mr-0.5" />
              <span className="hidden sm:inline">Invest</span>
            </TabsTrigger>
            <TabsTrigger value="loans" className="text-xs px-1 py-1.5">
              <Landmark className="h-3 w-3 mr-0.5" />
              <span className="hidden sm:inline">Loans</span>
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-xs px-1 py-1.5">
              <Car className="h-3 w-3 mr-0.5" />
              <span className="hidden sm:inline">Assets</span>
            </TabsTrigger>
          </TabsList>

          {/* Income Tab - Standalone income (salary, business, other) */}
          <TabsContent value="income" className="mt-4 space-y-3">
            {income && income.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-editorial-slate">
                    {income.filter(i => i.isRecurring).length} recurring source{income.filter(i => i.isRecurring).length !== 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold">
                    Net: <CashflowValue value={summary.incomeNet || 0} />
                  </span>
                </div>
                <p className="text-xs text-editorial-slate bg-editorial-warm p-2 rounded">
                  Rental income is shown under Properties. Investment income (dividends/distributions) is shown under Investments.
                </p>
                {income.map((inc) => (
                  <EntityRow
                    key={inc.id}
                    icon={Briefcase}
                    name={inc.name}
                    subtitle={inc.type}
                    cashflow={inc.netMonthly}
                    href={`/dashboard/income`}
                    details={
                      <>
                        <div className="flex justify-between">
                          <span className="text-editorial-slate">Gross Monthly</span>
                          <span className="text-editorial-emerald">+{formatCurrency(inc.grossMonthly)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-editorial-slate">Net (after tax)</span>
                          <span className="text-editorial-emerald">+{formatCurrency(inc.netMonthly)}</span>
                        </div>
                        {inc.isRecurring && (
                          <Badge variant="outline" className="mt-1 text-xs">Recurring</Badge>
                        )}
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-editorial-slate">
                <p>No standalone income sources added yet</p>
                <p className="text-xs mt-1">Rental and investment income are tracked in their respective tabs</p>
              </div>
            )}
          </TabsContent>

          {/* Expenses Tab - Standalone expenses grouped by category */}
          <TabsContent value="expenses" className="mt-4 space-y-3">
            {expenses && expenses.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-editorial-slate">
                    {expenses.length} categor{expenses.length !== 1 ? 'ies' : 'y'}
                  </span>
                  <span className="font-semibold">
                    Total: <CashflowValue value={-(summary.expensesNet || 0)} />
                  </span>
                </div>
                <p className="text-xs text-editorial-slate bg-editorial-warm p-2 rounded">
                  Property expenses are under Properties. Asset costs are under Assets.
                </p>
                {expenses.map((expense) => (
                  <EntityRow
                    key={expense.id}
                    icon={Receipt}
                    name={expense.name}
                    cashflow={-expense.monthlyAmount}
                    href={`/dashboard/expenses`}
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-editorial-slate">
                <p>No standalone expenses added yet</p>
                <p className="text-xs mt-1">Property and asset expenses are tracked in their respective tabs</p>
              </div>
            )}
          </TabsContent>

          {/* Properties Tab */}
          <TabsContent value="properties" className="mt-4 space-y-3">
            {properties.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-editorial-slate">
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
                          <span className="text-editorial-slate">Rental Income</span>
                          <span className="text-editorial-emerald">+{formatCurrency(property.monthlyIncome)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-editorial-slate">Expenses</span>
                          <span className="text-editorial-amber">-{formatCurrency(property.monthlyExpenses)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-editorial-slate">Loan Repayments</span>
                          <span className="text-editorial-amber">-{formatCurrency(property.monthlyLoanRepayments)}</span>
                        </div>
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-editorial-slate">
                No properties added yet
              </div>
            )}
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="mt-4 space-y-3">
            {investments.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-editorial-slate">
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
                          <span className="text-editorial-slate">Dividends</span>
                          <span className="text-editorial-emerald">+{formatCurrency(investment.monthlyDividends)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-editorial-slate">Distributions</span>
                          <span className="text-editorial-emerald">+{formatCurrency(investment.monthlyDistributions)}</span>
                        </div>
                        {investment.monthlyExpenses > 0 && (
                          <div className="flex justify-between">
                            <span className="text-editorial-slate">Fees/Expenses</span>
                            <span className="text-editorial-amber">-{formatCurrency(investment.monthlyExpenses)}</span>
                          </div>
                        )}
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-editorial-slate">
                No investment accounts added yet
              </div>
            )}
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans" className="mt-4 space-y-3">
            {loans.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-editorial-slate">
                    {loans.filter(l => l.isDeductible).length} tax-deductible
                  </span>
                </div>
                {/* Note about property loans */}
                {loans.some(l => l.isPropertyLinked) && (
                  <p className="text-xs text-editorial-slate bg-editorial-warm p-2 rounded">
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
                    href={`/dashboard/balances`}
                    details={
                      <>
                        <div className="flex justify-between">
                          <span className="text-editorial-slate">Monthly Repayment</span>
                          <span className="text-editorial-amber">-{formatCurrency(loan.monthlyRepayment)}</span>
                        </div>
                        {loan.isDeductible && loan.taxBenefit > 0 && (
                          <div className="flex justify-between">
                            <span className="text-editorial-slate">Tax Benefit (est.)</span>
                            <span className="text-editorial-emerald">+{formatCurrency(loan.taxBenefit)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium">
                          <span>Net Impact</span>
                          <span className="text-editorial-amber">-{formatCurrency(loan.netCashflowImpact)}</span>
                        </div>
                        {loan.isPropertyLinked && (
                          <p className="text-xs text-editorial-slate mt-2 italic">
                            Already counted in property cashflow
                          </p>
                        )}
                      </>
                    }
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-4 text-sm text-editorial-slate">
                No loans added yet
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-4 space-y-3">
            {assets.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-editorial-slate">
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
              <div className="text-center py-4 text-sm text-editorial-slate">
                No personal assets with running costs
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(summary.incomeNet || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-editorial-slate">Income (salary, etc.)</span>
                <CashflowValue value={summary.incomeNet || 0} />
              </div>
            )}
            {(summary.expensesNet || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-editorial-slate">Expenses (living costs)</span>
                <CashflowValue value={-(summary.expensesNet || 0)} />
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-editorial-slate">Properties (incl. loans)</span>
              <CashflowValue value={summary.propertiesNet} />
            </div>
            <div className="flex justify-between">
              <span className="text-editorial-slate">Investments</span>
              <CashflowValue value={summary.investmentsNet} />
            </div>
            {summary.standaloneLoansCost > 0 && (
              <div className="flex justify-between">
                <span className="text-editorial-slate">Standalone Loans</span>
                <CashflowValue value={-summary.standaloneLoansCost} />
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-editorial-slate">Assets (running costs)</span>
              <CashflowValue value={summary.assetsNet} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="font-medium">Net Cashflow</span>
            <CashflowValue value={summary.totalEntityCashflow} size="large" />
          </div>
        </div>
      </div>
    </EditorialCard>
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
    name: string;
    type: string;
    investmentAccountId?: string | null;
    grossAnnual: number;
    netAnnual: number;
    isRecurring?: boolean;
  }>,
  allExpenses: Array<{
    id: string;
    name: string;
    category: string;
    annualAmount: number;
    propertyId?: string | null;
    assetId?: string | null;
    isTaxDeductible?: boolean;
    isEssential?: boolean;
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

  // Calculate standalone income cashflows
  // Exclude: RENTAL/RENT (already in properties), DIVIDEND/DISTRIBUTION (already in investments)
  const excludedIncomeTypes = ['RENTAL', 'RENT', 'DIVIDEND', 'DISTRIBUTION'];
  const incomeCashflows: IncomeCashflow[] = income
    .filter((i) => !excludedIncomeTypes.includes(i.type))
    .map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      grossMonthly: i.grossAnnual / 12,
      netMonthly: i.netAnnual / 12,
      isRecurring: i.isRecurring ?? true,
    }));

  // Calculate standalone expense cashflows - GROUP BY CATEGORY
  // Exclude: expenses linked to properties or assets (already counted in those cashflows)
  const standaloneExpenses = (allExpenses || []).filter((e) => !e.propertyId && !e.assetId);

  // Group expenses by category
  const expensesByCategory = standaloneExpenses.reduce((acc, e) => {
    const cat = e.category || 'OTHER';
    if (!acc[cat]) {
      acc[cat] = {
        category: cat,
        totalAnnual: 0,
        count: 0,
        hasTaxDeductible: false,
        hasEssential: false,
      };
    }
    acc[cat].totalAnnual += e.annualAmount;
    acc[cat].count += 1;
    if (e.isTaxDeductible) acc[cat].hasTaxDeductible = true;
    if (e.isEssential) acc[cat].hasEssential = true;
    return acc;
  }, {} as Record<string, { category: string; totalAnnual: number; count: number; hasTaxDeductible: boolean; hasEssential: boolean }>);

  // Convert to array sorted by amount
  const expenseCashflows: ExpenseCashflow[] = Object.values(expensesByCategory)
    .sort((a, b) => b.totalAnnual - a.totalAnnual)
    .map((group, idx) => ({
      id: `cat-${idx}`,
      name: group.category.replace(/_/g, ' '),
      category: group.category,
      monthlyAmount: group.totalAnnual / 12,
      isTaxDeductible: group.hasTaxDeductible,
      isEssential: group.hasEssential,
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

  // Standalone income (salary, business, other - NOT rental/dividends)
  const incomeNet = incomeCashflows.reduce((sum, i) => sum + i.netMonthly, 0);

  // Standalone expenses (living costs, subscriptions - NOT property/asset expenses)
  const expensesNet = expenseCashflows.reduce((sum, e) => sum + e.monthlyAmount, 0);

  // Total: Full cashflow picture
  // incomeNet = salary + business + other income (not rental/dividends)
  // propertiesNet = rental income - property expenses - property loan repayments
  // investmentsNet = dividends + distributions
  // standaloneLoansCost = car loans, personal loans, etc. (not in property cashflow)
  // assetsNet = vehicle running costs, etc.
  // expensesNet = groceries, utilities, subscriptions, etc. (not linked to property/asset)
  const totalEntityCashflow = incomeNet + propertiesNet + investmentsNet - standaloneLoansCost + assetsNet - expensesNet;

  return {
    properties: propertyCashflows,
    investments: investmentCashflows,
    loans: loanCashflows,
    assets: assetCashflows,
    income: incomeCashflows,
    expenses: expenseCashflows,
    summary: {
      propertiesNet,
      investmentsNet,
      loansNet,
      standaloneLoansCost,
      assetsNet,
      incomeNet,
      expensesNet,
      totalEntityCashflow,
    },
  };
}
