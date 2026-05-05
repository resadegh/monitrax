'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  TrendingDown,
  Calculator,
  Receipt,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Percent,
  PiggyBank,
  Lightbulb,
  FileText,
  Building2,
  Briefcase,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { BoundaryFootnote } from '@/components/tax/BoundaryFootnote';
import type { AuthorityCitation } from '@/lib/tax-engine/types';

/**
 * Authority citations applied to the figures rendered on this page.
 * Phase 20 produces federal individual tax (Div 1-6 + s4-10), Medicare
 * (Health Insurance Levy Act 1982 §3, §8), LITO (Div 126-H), SAPTO
 * (Div 126-L), franking offset (Div 207). When 41e.1+ ship, the per-
 * entity dispatch will surface its own citations from the API response;
 * this static list documents the household-level baseline.
 */
const TAX_PAGE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 'Div 1-6', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 'Div 126-H (LITO)', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 'Div 207 (Franking)', lastReviewed: '2026-05-05' },
];

interface TaxRecommendation {
  id: string;
  type: 'SAVINGS' | 'OPTIMIZATION' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TaxRecommendation {
  id: string;
  type: 'SAVINGS' | 'OPTIMIZATION' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TaxPositionResponse {
  success: boolean;
  financialYear: string;
  isCurrent: boolean;
  summary: {
    totalIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    taxPayable: number;
    paygWithheld: number;
    estimatedRefund: number;
    isRefund: boolean;
    effectiveRate: number;
    marginalRate: number;
  };
  income: {
    salary: number;
    rental: number;
    dividends: number;
    interest: number;
    capitalGains: number;
    other: number;
    total: number;
    frankingCredits: number;
  };
  deductions: {
    workRelated: number;
    property: number;
    investment: number;
    depreciation: number;
    other: number;
    total: number;
  };
  tax: {
    assessableIncome: number;
    taxableIncome: number;
    taxOnIncome: number;
    medicareLevy: number;
    medicareSurcharge: number;
    grossTax: number;
    offsets: {
      lito: number;
      sapto: number;
      frankingCredits: number;
      foreignTax: number;
      other: number;
      total: number;
    };
    netTax: number;
    effectiveRate: number;
    marginalRate: number;
  };
  super: {
    concessional: number;
    nonConcessional: number;
  };
  warnings: string[];
  recommendations: TaxRecommendation[];
  metadata: {
    incomeCount: number;
    expenseCount: number;
    depreciationCount: number;
    calculatedAt: string;
  };
}

export default function TaxPage() {
  const { token } = useAuth();
  const [taxPosition, setTaxPosition] = useState<TaxPositionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Canonical FY config — single source of truth for label, brackets,
  // SG rate (PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md §10.1).
  const taxConfig = getCurrentTaxYearConfig();

  useEffect(() => {
    if (token) {
      fetchTaxPosition();
    }
  }, [token]);

  const fetchTaxPosition = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tax/position', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to calculate tax position');
      }

      const result = await response.json();
      setTaxPosition(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate tax position');
    } finally {
      setIsLoading(false);
    }
  };

  // formatCurrency imported from lib/utils/formatters

  const formatPercent = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Tax Position"
        description={taxPosition ? `Financial Year ${taxPosition.financialYear}` : 'Australian Tax Calculator'}
        action={
          <Button onClick={fetchTaxPosition} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Calculating...' : 'Recalculate'}
          </Button>
        }
      />

      <div className="space-y-6">
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Error</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/90">{error}</p>
            </CardContent>
          </Card>
        )}

        {isLoading && !taxPosition && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Calculating tax position...</p>
            </div>
          </div>
        )}

        {taxPosition && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="deductions">Deductions</TabsTrigger>
              <TabsTrigger value="super">Super</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Income"
                  value={formatCurrency(taxPosition.summary.totalIncome)}
                  icon={DollarSign}
                  variant="green"
                  description={`${taxPosition.metadata.incomeCount} sources`}
                />
                <StatCard
                  title="Total Deductions"
                  value={formatCurrency(taxPosition.summary.totalDeductions)}
                  icon={TrendingDown}
                  variant="teal"
                  description={`${taxPosition.metadata.expenseCount} expenses`}
                />
                <StatCard
                  title="Taxable Income"
                  value={formatCurrency(taxPosition.summary.taxableIncome)}
                  icon={Calculator}
                  variant="blue"
                />
                <Card className={`border-l-4 ${taxPosition.summary.isRefund ? 'border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/50 dark:to-slate-800' : 'border-l-red-500 bg-gradient-to-br from-red-50 to-white dark:from-red-950/50 dark:to-slate-800'} hover:shadow-lg transition-all duration-300`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {taxPosition.summary.isRefund ? 'Estimated Refund' : 'Tax Owing'}
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${taxPosition.summary.isRefund ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                        {taxPosition.summary.isRefund ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Receipt className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${taxPosition.summary.isRefund ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {formatCurrency(Math.abs(taxPosition.summary.estimatedRefund))}
                    </div>
                    <p className={`text-xs mt-1 ${taxPosition.summary.isRefund ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      PAYG withheld: {formatCurrency(taxPosition.summary.paygWithheld)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tax Rates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Tax Rates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Effective Tax Rate</span>
                        <span className="font-medium">{formatPercent(taxPosition.tax.effectiveRate)}</span>
                      </div>
                      <Progress value={taxPosition.tax.effectiveRate} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Marginal Tax Rate</span>
                        <span className="font-medium">{formatPercent(taxPosition.tax.marginalRate)}</span>
                      </div>
                      <Progress value={taxPosition.tax.marginalRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Tax Calculation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax on Income</span>
                        <span>{formatCurrency(taxPosition.tax.taxOnIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground inline-flex items-center gap-1">
                          Medicare Levy
                          <HelpTooltip term="medicare-levy" />
                        </span>
                        <span>{formatCurrency(taxPosition.tax.medicareLevy)}</span>
                      </div>
                      {taxPosition.tax.medicareSurcharge > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Medicare Surcharge</span>
                          <span>{formatCurrency(taxPosition.tax.medicareSurcharge)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Gross Tax</span>
                        <span>{formatCurrency(taxPosition.tax.grossTax)}</span>
                      </div>
                      {taxPosition.tax.offsets.total > 0 && (
                        <>
                          <div className="flex justify-between text-emerald-600">
                            <span>Tax Offsets</span>
                            <span>-{formatCurrency(taxPosition.tax.offsets.total)}</span>
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>Net Tax Payable</span>
                        <span>{formatCurrency(taxPosition.tax.netTax)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tax Offsets Detail */}
              {taxPosition.tax.offsets.total > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-emerald-600" />
                      Tax Offsets Applied
                    </CardTitle>
                    <CardDescription>Reductions to your tax payable</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {taxPosition.tax.offsets.lito > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                          <p className="text-xs text-muted-foreground">LITO</p>
                          <p className="text-lg font-semibold text-emerald-600">{formatCurrency(taxPosition.tax.offsets.lito)}</p>
                        </div>
                      )}
                      {taxPosition.tax.offsets.frankingCredits > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                          <p className="text-xs text-muted-foreground">Franking Credits</p>
                          <p className="text-lg font-semibold text-emerald-600">{formatCurrency(taxPosition.tax.offsets.frankingCredits)}</p>
                        </div>
                      )}
                      {taxPosition.tax.offsets.sapto > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                          <p className="text-xs text-muted-foreground">SAPTO</p>
                          <p className="text-lg font-semibold text-emerald-600">{formatCurrency(taxPosition.tax.offsets.sapto)}</p>
                        </div>
                      )}
                      {taxPosition.tax.offsets.foreignTax > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                          <p className="text-xs text-muted-foreground">Foreign Tax</p>
                          <p className="text-lg font-semibold text-emerald-600">{formatCurrency(taxPosition.tax.offsets.foreignTax)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Warnings and Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {taxPosition.warnings.length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-5 w-5" />
                        Warnings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {taxPosition.warnings.map((warning, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {taxPosition.recommendations.length > 0 && (
                  <Card className="border-sky-200 dark:border-sky-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                        <Lightbulb className="h-5 w-5" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {taxPosition.recommendations.map((rec) => (
                          <li key={rec.id} className="flex items-start gap-2 text-sm">
                            <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
                            <div>
                              <p className="font-medium text-sky-700 dark:text-sky-400">{rec.title}</p>
                              <p className="text-sky-600/80 dark:text-sky-400/80">{rec.description}</p>
                              {rec.potentialSavings && rec.potentialSavings > 0 && (
                                <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                                  Potential savings: {formatCurrency(rec.potentialSavings)}
                                </p>
                              )}
                              {rec.action && (
                                <p className="text-muted-foreground mt-1 text-xs">{rec.action}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Tax Brackets Reference — rendered from canonical FY config (PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md §6.5 H-4) */}
              <Card>
                <CardHeader>
                  <CardTitle>Australian Tax Brackets {taxConfig.label}</CardTitle>
                  <CardDescription>Current income tax rates for residents (Stage 3 tax cuts applied)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Income Range</TableHead>
                          <TableHead>Tax Rate</TableHead>
                          <TableHead>Tax on Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxConfig.brackets.map((bracket, idx) => {
                          const min = bracket.min;
                          const max = bracket.max;
                          const inBracket =
                            taxPosition.summary.taxableIncome >= min &&
                            (max === null || taxPosition.summary.taxableIncome <= max);
                          const rangeLabel =
                            max === null
                              ? `$${min.toLocaleString()}+`
                              : `$${min.toLocaleString()} - $${max.toLocaleString()}`;
                          const ratePercent = Math.round(bracket.rate * 100);
                          const taxOnRange =
                            bracket.rate === 0
                              ? 'Nil'
                              : idx === 1
                              ? `${(bracket.rate * 100).toFixed(0)}c for each $1 over $${(min - 1).toLocaleString()}`
                              : `$${bracket.baseAmount.toLocaleString()} plus ${(bracket.rate * 100).toFixed(0)}c for each $1 over $${(min - 1).toLocaleString()}`;
                          return (
                            <TableRow
                              key={`${min}-${max ?? 'top'}`}
                              className={inBracket ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}
                            >
                              <TableCell>{rangeLabel}</TableCell>
                              <TableCell><Badge variant="outline">{ratePercent}%</Badge></TableCell>
                              <TableCell>{taxOnRange}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Your current bracket is highlighted. Plus {(taxConfig.medicareRate * 100).toFixed(0)}% Medicare Levy on taxable income.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Income Tab */}
            <TabsContent value="income" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Salary</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(taxPosition.income.salary)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Rental</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(taxPosition.income.rental)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Dividends</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(taxPosition.income.dividends)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Interest</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(taxPosition.income.interest)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Capital Gains</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(taxPosition.income.capitalGains)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Other</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(taxPosition.income.other)}</p>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Income Summary</CardTitle>
                  <CardDescription>Breakdown of all income sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {taxPosition.income.salary > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Salary & Wages</span>
                          <span className="font-medium">{formatCurrency(taxPosition.income.salary)}</span>
                        </div>
                        <Progress value={(taxPosition.income.salary / taxPosition.income.total) * 100} className="h-2" />
                      </div>
                    )}
                    {taxPosition.income.rental > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Rental Income</span>
                          <span className="font-medium">{formatCurrency(taxPosition.income.rental)}</span>
                        </div>
                        <Progress value={(taxPosition.income.rental / taxPosition.income.total) * 100} className="h-2" />
                      </div>
                    )}
                    {taxPosition.income.dividends > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Dividends {taxPosition.income.frankingCredits > 0 && `(+${formatCurrency(taxPosition.income.frankingCredits)} franking)`}</span>
                          <span className="font-medium">{formatCurrency(taxPosition.income.dividends)}</span>
                        </div>
                        <Progress value={(taxPosition.income.dividends / taxPosition.income.total) * 100} className="h-2" />
                      </div>
                    )}
                    {taxPosition.income.interest > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Interest</span>
                          <span className="font-medium">{formatCurrency(taxPosition.income.interest)}</span>
                        </div>
                        <Progress value={(taxPosition.income.interest / taxPosition.income.total) * 100} className="h-2" />
                      </div>
                    )}
                    {taxPosition.income.capitalGains > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Capital Gains</span>
                          <span className="font-medium">{formatCurrency(taxPosition.income.capitalGains)}</span>
                        </div>
                        <Progress value={(taxPosition.income.capitalGains / taxPosition.income.total) * 100} className="h-2" />
                      </div>
                    )}
                    {taxPosition.income.other > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Other Income</span>
                          <span className="font-medium">{formatCurrency(taxPosition.income.other)}</span>
                        </div>
                        <Progress value={(taxPosition.income.other / taxPosition.income.total) * 100} className="h-2" />
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total Income</span>
                      <span>{formatCurrency(taxPosition.income.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deductions Tab */}
            <TabsContent value="deductions" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-teal-600" />
                    <span className="text-xs text-muted-foreground">Work Related</span>
                  </div>
                  <p className="text-lg font-semibold text-teal-600">{formatCurrency(taxPosition.deductions.workRelated)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-teal-600" />
                    <span className="text-xs text-muted-foreground">Property</span>
                  </div>
                  <p className="text-lg font-semibold text-teal-600">{formatCurrency(taxPosition.deductions.property)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-teal-600" />
                    <span className="text-xs text-muted-foreground">Investment</span>
                  </div>
                  <p className="text-lg font-semibold text-teal-600">{formatCurrency(taxPosition.deductions.investment)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-teal-600" />
                    <span className="text-xs text-muted-foreground">Depreciation</span>
                  </div>
                  <p className="text-lg font-semibold text-teal-600">{formatCurrency(taxPosition.deductions.depreciation)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-4 w-4 text-teal-600" />
                    <span className="text-xs text-muted-foreground">Other</span>
                  </div>
                  <p className="text-lg font-semibold text-teal-600">{formatCurrency(taxPosition.deductions.other)}</p>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Deduction Summary</CardTitle>
                  <CardDescription>Tax-deductible expenses by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {taxPosition.deductions.workRelated > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Work-Related Expenses</span>
                          <span className="font-medium text-teal-600">{formatCurrency(taxPosition.deductions.workRelated)}</span>
                        </div>
                        <Progress value={(taxPosition.deductions.workRelated / taxPosition.deductions.total) * 100} className="h-2 bg-muted [&>div]:bg-teal-500" />
                      </div>
                    )}
                    {taxPosition.deductions.property > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Property Expenses</span>
                          <span className="font-medium text-teal-600">{formatCurrency(taxPosition.deductions.property)}</span>
                        </div>
                        <Progress value={(taxPosition.deductions.property / taxPosition.deductions.total) * 100} className="h-2 bg-muted [&>div]:bg-teal-500" />
                      </div>
                    )}
                    {taxPosition.deductions.investment > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Investment Expenses</span>
                          <span className="font-medium text-teal-600">{formatCurrency(taxPosition.deductions.investment)}</span>
                        </div>
                        <Progress value={(taxPosition.deductions.investment / taxPosition.deductions.total) * 100} className="h-2 bg-muted [&>div]:bg-teal-500" />
                      </div>
                    )}
                    {taxPosition.deductions.depreciation > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Depreciation</span>
                          <span className="font-medium text-teal-600">{formatCurrency(taxPosition.deductions.depreciation)}</span>
                        </div>
                        <Progress value={(taxPosition.deductions.depreciation / taxPosition.deductions.total) * 100} className="h-2 bg-muted [&>div]:bg-teal-500" />
                      </div>
                    )}
                    {taxPosition.deductions.other > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Other Deductions</span>
                          <span className="font-medium text-teal-600">{formatCurrency(taxPosition.deductions.other)}</span>
                        </div>
                        <Progress value={(taxPosition.deductions.other / taxPosition.deductions.total) * 100} className="h-2 bg-muted [&>div]:bg-teal-500" />
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total Deductions</span>
                      <span className="text-teal-600">{formatCurrency(taxPosition.deductions.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tax savings at {formatPercent(taxPosition.tax.marginalRate)} marginal rate: {formatCurrency(taxPosition.deductions.total * (taxPosition.tax.marginalRate / 100))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Super Tab */}
            <TabsContent value="super" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PiggyBank className="h-5 w-5" />
                      Superannuation Contributions
                    </CardTitle>
                    <CardDescription>Year-to-date contribution summary</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="inline-flex items-center gap-1">
                          Concessional (Pre-tax)
                          <HelpTooltip term="concessional-cap" />
                        </span>
                        <span className="font-medium">{formatCurrency(taxPosition.super.concessional)}</span>
                      </div>
                      <Progress value={(taxPosition.super.concessional / taxConfig.concessionalCap) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(taxConfig.concessionalCap - taxPosition.super.concessional)} remaining of {formatCurrency(taxConfig.concessionalCap)} cap
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="inline-flex items-center gap-1">
                          Non-Concessional (After-tax)
                          <HelpTooltip term="non-concessional-cap" />
                        </span>
                        <span className="font-medium">{formatCurrency(taxPosition.super.nonConcessional)}</span>
                      </div>
                      <Progress value={(taxPosition.super.nonConcessional / taxConfig.nonConcessionalCap) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(taxConfig.nonConcessionalCap - taxPosition.super.nonConcessional)} remaining of {formatCurrency(taxConfig.nonConcessionalCap)} cap
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Super Contribution Caps {taxConfig.label}</CardTitle>
                    <CardDescription>Annual contribution limits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-medium">Concessional Cap</p>
                        <p className="text-2xl font-bold">{formatCurrency(taxConfig.concessionalCap)}</p>
                        <p className="text-xs text-muted-foreground">SG + salary sacrifice + personal deductible</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-medium">Non-Concessional Cap</p>
                        <p className="text-2xl font-bold">{formatCurrency(taxConfig.nonConcessionalCap)}</p>
                        <p className="text-xs text-muted-foreground">After-tax contributions</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-medium">Super Guarantee Rate</p>
                        <p className="text-2xl font-bold">{(taxConfig.superGuaranteeRate * 100).toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Employer mandatory contribution</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {taxPosition.tax.marginalRate >= 30 && (
                <Card className="border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                      <Lightbulb className="h-5 w-5" />
                      Salary Sacrifice Opportunity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-sky-700 dark:text-sky-400 mb-2">
                      At your {formatPercent(taxPosition.tax.marginalRate)} marginal rate, salary sacrificing into super saves {formatPercent(taxPosition.tax.marginalRate - taxConfig.superContributionsTaxRate * 100)} compared to taking income.
                    </p>
                    <p className="text-sm text-sky-700 dark:text-sky-400">
                      Remaining concessional cap: {formatCurrency(taxConfig.concessionalCap - taxPosition.super.concessional)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* AFSL / TPB / NCCP boundary footnote (Phase 41e.0 slice D).
            Replaces the old free-text Disclaimer with the canonical
            renderer — one source of truth for legal copy across every
            tax-shaped surface. */}
        <Card className="border-muted bg-muted/30">
          <CardContent className="pt-4">
            <BoundaryFootnote
              fyLabel={taxConfig.label}
              citations={TAX_PAGE_CITATIONS}
              calculatedAt={taxPosition?.metadata.calculatedAt}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
