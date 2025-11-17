'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Receipt,
  TrendingDown,
  Target,
  DollarSign,
  Clock,
  AlertCircle,
  Info,
  Calculator
} from 'lucide-react';

interface DebtPlanSettings {
  strategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';
  surplusPerPeriod: number;
  surplusFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  emergencyBuffer: number;
  respectFixedCaps: boolean;
  rolloverRepayments: boolean;
}

interface LoanResult {
  loanId: string;
  loanName: string;
  baselinePayoffDate: string;
  strategyPayoffDate: string;
  interestSavedVsBaseline: number;
  monthsSaved: number;
}

interface PlanResult {
  totalInterestSavedVsBaseline: number;
  totalMonthsSaved: number;
  loans: LoanResult[];
}

export default function DebtPlannerPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<DebtPlanSettings>({
    strategy: 'TAX_AWARE_MINIMUM_INTEREST',
    surplusPerPeriod: 1000,
    surplusFrequency: 'MONTHLY',
    emergencyBuffer: 5000,
    respectFixedCaps: true,
    rolloverRepayments: true,
  });
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const runPlan = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/calculate/debt-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to calculate debt plan');
      }

      const result = await response.json();
      setPlanResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate debt plan');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
    });
  };

  const strategyDescriptions = {
    TAX_AWARE_MINIMUM_INTEREST: {
      name: 'Tax-Aware Strategy',
      description: 'Prioritize non-tax-deductible debt (home loans) over tax-deductible debt (investment loans) to minimize total interest cost after tax benefits.',
      icon: Receipt,
    },
    AVALANCHE: {
      name: 'Avalanche Strategy',
      description: 'Pay off loans with the highest interest rates first to minimize total interest cost.',
      icon: TrendingDown,
    },
    SNOWBALL: {
      name: 'Snowball Strategy',
      description: 'Pay off loans with the smallest balances first for psychological wins and motivation.',
      icon: Target,
    },
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Debt Planner"
        description="Optimize your debt repayment strategy and see how much you can save"
      />

      <div className="space-y-6">
        {/* Strategy Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Your Strategy</CardTitle>
            <CardDescription>Choose a debt repayment approach that works for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(strategyDescriptions).map(([key, info]) => {
                const Icon = info.icon;
                const isSelected = settings.strategy === key;
                return (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSettings({ ...settings, strategy: key as DebtPlanSettings['strategy'] })}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-2 ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base mb-1">{info.name}</CardTitle>
                          <CardDescription className="text-xs">{info.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Settings Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set your repayment parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="surplusPerPeriod">Extra Payment Amount</Label>
                <Input
                  id="surplusPerPeriod"
                  type="number"
                  value={settings.surplusPerPeriod}
                  onChange={(e) => setSettings({ ...settings, surplusPerPeriod: Number(e.target.value) })}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">
                  Additional amount you can pay towards debt each period
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="surplusFrequency">Payment Frequency</Label>
                <Select
                  value={settings.surplusFrequency}
                  onValueChange={(value) => setSettings({ ...settings, surplusFrequency: value as DebtPlanSettings['surplusFrequency'] })}
                >
                  <SelectTrigger id="surplusFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyBuffer">Emergency Buffer</Label>
                <Input
                  id="emergencyBuffer"
                  type="number"
                  value={settings.emergencyBuffer}
                  onChange={(e) => setSettings({ ...settings, emergencyBuffer: Number(e.target.value) })}
                  placeholder="5000"
                />
                <p className="text-xs text-muted-foreground">
                  Reserve amount to keep in accounts for emergencies
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="respectFixedCaps" className="cursor-pointer">
                    Respect fixed loan payment caps
                  </Label>
                  <Switch
                    id="respectFixedCaps"
                    checked={settings.respectFixedCaps}
                    onCheckedChange={(checked) => setSettings({ ...settings, respectFixedCaps: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="rolloverRepayments" className="cursor-pointer">
                    Roll over payments when loans are paid off
                  </Label>
                  <Switch
                    id="rolloverRepayments"
                    checked={settings.rolloverRepayments}
                    onCheckedChange={(checked) => setSettings({ ...settings, rolloverRepayments: checked })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-4">
              <Button onClick={runPlan} disabled={isLoading} size="lg" className="gap-2">
                <Calculator className="h-4 w-4" />
                {isLoading ? 'Calculating...' : 'Calculate Debt Plan'}
              </Button>
              {planResult && (
                <p className="text-sm text-muted-foreground">
                  Last calculated using {strategyDescriptions[settings.strategy].name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
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

        {/* Results Display */}
        {planResult && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                title="Total Interest Saved"
                value={formatCurrency(planResult.totalInterestSavedVsBaseline)}
                description="Compared to minimum payments only"
                icon={DollarSign}
              />
              <StatCard
                title="Time Saved"
                value={`${planResult.totalMonthsSaved} months`}
                description={`${(planResult.totalMonthsSaved / 12).toFixed(1)} years earlier`}
                icon={Clock}
              />
            </div>

            {/* Loan Details */}
            <Card>
              <CardHeader>
                <CardTitle>Loan Payoff Details</CardTitle>
                <CardDescription>Projected payoff dates and savings for each loan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {planResult.loans.map((loan) => (
                  <Card key={loan.loanId} className="border-muted">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-4">{loan.loanName}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Baseline Payoff</p>
                          <p className="font-medium">{formatDate(loan.baselinePayoffDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Strategy Payoff</p>
                          <p className="font-medium text-green-600">{formatDate(loan.strategyPayoffDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Savings</p>
                          <p className="font-medium text-green-600">
                            {formatCurrency(loan.interestSavedVsBaseline)}
                          </p>
                          <p className="text-xs text-green-600">
                            {loan.monthsSaved} months earlier
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* Strategy Info */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-start gap-3">
                  {(() => {
                    const Icon = strategyDescriptions[settings.strategy].icon;
                    return <Icon className="h-6 w-6 text-primary mt-1" />;
                  })()}
                  <div className="flex-1">
                    <CardTitle>{strategyDescriptions[settings.strategy].name}</CardTitle>
                    <CardDescription className="mt-2">
                      {strategyDescriptions[settings.strategy].description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Extra Payment:</span>{' '}
                    {formatCurrency(settings.surplusPerPeriod)} {settings.surplusFrequency.toLowerCase()}
                  </p>
                  <p>
                    <span className="font-medium">Emergency Buffer:</span>{' '}
                    {formatCurrency(settings.emergencyBuffer)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Getting Started Message */}
        {!planResult && !isLoading && !error && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <CardTitle className="text-blue-900">How to use the Debt Planner</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Choose your preferred debt repayment strategy</li>
                <li>Enter how much extra you can pay towards your debts</li>
                <li>Set your emergency buffer amount</li>
                <li>Click "Calculate Debt Plan" to see your personalized payoff plan</li>
                <li>Compare the savings between strategies to find the best approach</li>
              </ol>
              <Separator className="my-4" />
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Make sure you've added your loans before running the debt planner.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
