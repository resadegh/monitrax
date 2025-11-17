'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  TrendingDown,
  Calculator,
  Receipt,
  AlertCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface TaxResult {
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxPayable: number;
  effectiveRate: number;
  breakdown: {
    income: { name: string; amount: number; taxable: boolean }[];
    deductions: { name: string; amount: number }[];
  };
}

export default function TaxPage() {
  const { token } = useAuth();
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      calculateTax();
    }
  }, [token]);

  const calculateTax = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/calculate/tax', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to calculate tax');
      }

      const result = await response.json();
      setTaxResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate tax');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Tax Calculator"
        description="Australian Tax Year 2024-2025"
        action={
          <Button onClick={calculateTax} disabled={isLoading} className="gap-2">
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

        {isLoading && !taxResult && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Calculating tax...</p>
            </div>
          </div>
        )}

        {taxResult && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Income"
                value={formatCurrency(taxResult.totalIncome)}
                icon={DollarSign}
              />
              <StatCard
                title="Deductions"
                value={formatCurrency(taxResult.totalDeductions)}
                icon={TrendingDown}
              />
              <StatCard
                title="Taxable Income"
                value={formatCurrency(taxResult.taxableIncome)}
                icon={Calculator}
              />
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tax Payable</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(taxResult.taxPayable)}</div>
                  <p className="text-xs text-red-600 mt-1">{formatPercent(taxResult.effectiveRate)} effective rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Tax Brackets Info */}
            <Card>
              <CardHeader>
                <CardTitle>Australian Tax Brackets 2024-2025</CardTitle>
                <CardDescription>Current income tax rates for residents</CardDescription>
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
                      <TableRow>
                        <TableCell>$0 - $18,200</TableCell>
                        <TableCell>0%</TableCell>
                        <TableCell>Nil</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>$18,201 - $45,000</TableCell>
                        <TableCell>19%</TableCell>
                        <TableCell>19c for each $1 over $18,200</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>$45,001 - $135,000</TableCell>
                        <TableCell>30%</TableCell>
                        <TableCell>$5,092 plus 30c for each $1 over $45,000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>$135,001 - $190,000</TableCell>
                        <TableCell>37%</TableCell>
                        <TableCell>$32,092 plus 37c for each $1 over $135,000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>$190,001+</TableCell>
                        <TableCell>45%</TableCell>
                        <TableCell>$52,442 plus 45c for each $1 over $190,000</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Income Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Income Breakdown</CardTitle>
                  <CardDescription>All income sources for the year</CardDescription>
                </CardHeader>
                <CardContent>
                  {taxResult.breakdown.income.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No income sources added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {taxResult.breakdown.income.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center pb-3 border-b last:border-0">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {!item.taxable && (
                              <span className="text-xs text-muted-foreground">(Tax-free)</span>
                            )}
                          </div>
                          <p className="font-medium">{formatCurrency(item.amount)}</p>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between items-center pt-1">
                        <p className="font-bold">Total</p>
                        <p className="font-bold">{formatCurrency(taxResult.totalIncome)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tax Deductions</CardTitle>
                  <CardDescription>Tax-deductible expenses</CardDescription>
                </CardHeader>
                <CardContent>
                  {taxResult.breakdown.deductions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deductible expenses found</p>
                  ) : (
                    <div className="space-y-3">
                      {taxResult.breakdown.deductions.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center pb-3 border-b last:border-0">
                          <p className="font-medium">{item.name}</p>
                          <p className="font-medium text-green-600">{formatCurrency(item.amount)}</p>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between items-center pt-1">
                        <p className="font-bold">Total</p>
                        <p className="font-bold text-green-600">{formatCurrency(taxResult.totalDeductions)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Note */}
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <CardTitle className="text-yellow-900">Important Note</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-yellow-800">
                  This is an estimate based on your recorded income and expenses. It does not account for Medicare levy,
                  LITO (Low Income Tax Offset), SAPTO, or other tax offsets. Please consult with a tax professional for
                  accurate tax planning and lodgment.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
