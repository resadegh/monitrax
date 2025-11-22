'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Landmark, Plus, Edit2, Trash2, Home as HomeIcon, Wallet, Calendar, TrendingDown, Eye, Receipt, DollarSign, Percent, Building, Link2 } from 'lucide-react';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
  vendorName?: string;
}

interface Loan {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT';
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  fixedExpiry?: string;
  extraRepaymentCap?: number;
  propertyId?: string;
  offsetAccountId?: string;
  property?: { id: string; name: string; currentValue: number; address?: string };
  offsetAccount?: { id: string; name: string; currentBalance: number; institution?: string };
  expenses?: Expense[];
  // GRDCS fields
  _links?: {
    self: string;
    related: GRDCSLinkedEntity[];
  };
  _meta?: {
    linkedCount: number;
    missingLinks: GRDCSMissingLink[];
  };
}

interface Property {
  id: string;
  name: string;
  currentValue: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  institution?: string;
}

export default function LoansPage() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Loan>>({
    name: '',
    type: 'HOME',
    principal: 0,
    interestRateAnnual: 0,
    rateType: 'VARIABLE',
    isInterestOnly: false,
    termMonthsRemaining: 360,
    minRepayment: 0,
    repaymentFrequency: 'MONTHLY',
    fixedExpiry: undefined,
    extraRepaymentCap: undefined,
    propertyId: undefined,
    offsetAccountId: undefined,
  });

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    try {
      const [loansRes, propertiesRes, accountsRes] = await Promise.all([
        fetch('/api/loans', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/properties', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (loansRes.ok) {
        const result = await loansRes.json();
        setLoans(result.data || result);
      }
      if (propertiesRes.ok) {
        const result = await propertiesRes.json();
        setProperties(result.data || result);
      }
      if (accountsRes.ok) {
        const result = await accountsRes.json();
        const allAccounts = result.data || result;
        // Filter to show only OFFSET accounts
        setAccounts(allAccounts.filter((a: Account) => a.type === 'OFFSET'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingId ? `/api/loans/${editingId}` : '/api/loans';
    const method = editingId ? 'PUT' : 'POST';

    // Clean up the data
    const submitData = {
      ...formData,
      principal: Number(formData.principal),
      interestRateAnnual: Number(formData.interestRateAnnual),
      termMonthsRemaining: Number(formData.termMonthsRemaining),
      minRepayment: Number(formData.minRepayment),
      fixedExpiry: formData.fixedExpiry || null,
      extraRepaymentCap: formData.extraRepaymentCap ? Number(formData.extraRepaymentCap) : null,
      propertyId: formData.propertyId || null,
      offsetAccountId: formData.offsetAccountId || null,
    };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        await loadData();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving loan:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'HOME',
      principal: 0,
      interestRateAnnual: 0,
      rateType: 'VARIABLE',
      isInterestOnly: false,
      termMonthsRemaining: 360,
      minRepayment: 0,
      repaymentFrequency: 'MONTHLY',
      fixedExpiry: undefined,
      extraRepaymentCap: undefined,
      propertyId: undefined,
      offsetAccountId: undefined,
    });
  };

  const handleEdit = (loan: Loan) => {
    setFormData({
      name: loan.name,
      type: loan.type,
      principal: loan.principal,
      interestRateAnnual: loan.interestRateAnnual,
      rateType: loan.rateType,
      isInterestOnly: loan.isInterestOnly,
      termMonthsRemaining: loan.termMonthsRemaining,
      minRepayment: loan.minRepayment,
      repaymentFrequency: loan.repaymentFrequency,
      fixedExpiry: loan.fixedExpiry,
      extraRepaymentCap: loan.extraRepaymentCap,
      propertyId: loan.propertyId,
      offsetAccountId: loan.offsetAccountId,
    });
    setEditingId(loan.id);
    setShowDialog(true);
  };

  const handleViewDetails = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowDetailDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loan?')) return;

    try {
      const response = await fetch(`/api/loans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const convertToAnnual = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52;
      case 'FORTNIGHTLY': return amount * 26;
      case 'MONTHLY': return amount * 12;
      case 'ANNUAL': return amount;
      default: return amount * 12;
    }
  };

  // Calculate effective balance (principal minus offset)
  const calculateEffectiveBalance = (loan: Loan) => {
    const offsetBalance = loan.offsetAccount?.currentBalance || 0;
    return Math.max(0, loan.principal - offsetBalance);
  };

  // Calculate annual interest cost
  const calculateAnnualInterest = (loan: Loan) => {
    const effectiveBalance = calculateEffectiveBalance(loan);
    return effectiveBalance * loan.interestRateAnnual;
  };

  // Calculate LVR if property is linked
  const calculateLVR = (loan: Loan) => {
    if (!loan.property?.currentValue || loan.property.currentValue <= 0) return null;
    return (loan.principal / loan.property.currentValue) * 100;
  };

  // Calculate total linked expenses
  const calculateLinkedExpenses = (loan: Loan) => {
    if (!loan.expenses || loan.expenses.length === 0) return 0;
    return loan.expenses.reduce((sum, e) => sum + convertToAnnual(e.amount, e.frequency), 0);
  };

  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalEffectiveBalance = loans.reduce((sum, l) => sum + calculateEffectiveBalance(l), 0);
  const totalAnnualInterest = loans.reduce((sum, l) => sum + calculateAnnualInterest(l), 0);

  const getLoanTypeBadge = (type: Loan['type']) => {
    switch (type) {
      case 'HOME':
        return <Badge variant="default">Home Loan</Badge>;
      case 'INVESTMENT':
        return <Badge variant="secondary">Investment</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Loans"
        description={`Manage your loans and debts • Total debt: ${formatCurrency(totalPrincipal)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Loan
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading loans...</p>
          </div>
        </div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Start by adding your first loan to track repayments and interest costs."
          action={{
            label: 'Add Loan',
            onClick: () => { setShowDialog(true); resetForm(); },
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {loans.map((loan) => {
            const effectiveBalance = calculateEffectiveBalance(loan);
            const annualInterest = calculateAnnualInterest(loan);
            const lvr = calculateLVR(loan);
            const linkedExpenses = loan.expenses?.length || 0;

            return (
              <Card key={loan.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(loan)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-muted-foreground" />
                        {loan.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getLoanTypeBadge(loan.type)}
                        <Badge variant={loan.isInterestOnly ? 'outline' : 'secondary'}>
                          {loan.isInterestOnly ? 'Interest Only' : 'P&I'}
                        </Badge>
                        <Badge variant="outline">{loan.rateType}</Badge>
                        {loan.rateType === 'FIXED' && loan.fixedExpiry && (
                          <Badge variant="outline" className="text-orange-600">
                            Fixed until {formatDate(loan.fixedExpiry)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(loan)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(loan)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(loan.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Balance</p>
                      <p className="text-xl font-bold">{formatCurrency(loan.principal)}</p>
                      {loan.offsetAccount && effectiveBalance < loan.principal && (
                        <p className="text-xs text-green-600">Effective: {formatCurrency(effectiveBalance)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                      <p className="text-xl font-bold">{formatPercent(loan.interestRateAnnual)}</p>
                      <p className="text-xs text-muted-foreground">~{formatCurrency(annualInterest)}/yr</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Min Repayment</p>
                      <p className="font-semibold">{formatCurrency(loan.minRepayment)}</p>
                      <p className="text-xs text-muted-foreground">{loan.repaymentFrequency.toLowerCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Term Remaining</p>
                      <p className="font-semibold">{loan.termMonthsRemaining} months</p>
                      <p className="text-xs text-muted-foreground">{(loan.termMonthsRemaining / 12).toFixed(1)} years</p>
                    </div>
                  </div>

                  {lvr !== null && (
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>LVR</span>
                        <span className={lvr > 80 ? 'text-orange-600 font-medium' : ''}>{lvr.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${lvr > 80 ? 'bg-orange-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(lvr, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-2">
                    {loan.property && (
                      <div className="flex items-center gap-2 text-sm">
                        <HomeIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Property:</span>
                        <span className="font-medium">{loan.property.name}</span>
                      </div>
                    )}
                    {loan.offsetAccount && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">Offset:</span>
                        <span className="font-medium text-green-600">
                          {loan.offsetAccount.name} ({formatCurrency(loan.offsetAccount.currentBalance)})
                        </span>
                      </div>
                    )}
                    {linkedExpenses > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Linked Expenses:</span>
                        <span className="font-medium">{linkedExpenses}</span>
                      </div>
                    )}
                    {!loan.property && !loan.offsetAccount && linkedExpenses === 0 && (
                      <p className="text-xs text-muted-foreground">Click to view details</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Loan' : 'Add New Loan'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the loan details below.' : 'Enter the details for your new loan.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Loan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Home Loan"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as Loan['type'] })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOME">Home Loan</SelectItem>
                    <SelectItem value="INVESTMENT">Investment Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="principal">Principal Balance</Label>
                <Input
                  id="principal"
                  type="number"
                  value={formData.principal}
                  onChange={(e) => setFormData({ ...formData, principal: Number(e.target.value) })}
                  placeholder="400000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRateAnnual">Annual Interest Rate (%)</Label>
                <Input
                  id="interestRateAnnual"
                  type="number"
                  step="0.01"
                  value={(formData.interestRateAnnual || 0) * 100}
                  onChange={(e) => setFormData({ ...formData, interestRateAnnual: Number(e.target.value) / 100 })}
                  placeholder="6.25"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rateType">Rate Type</Label>
                <Select
                  value={formData.rateType}
                  onValueChange={(value) => setFormData({ ...formData, rateType: value as 'FIXED' | 'VARIABLE' })}
                >
                  <SelectTrigger id="rateType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VARIABLE">Variable</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isInterestOnly">Loan Type</Label>
                <Select
                  value={formData.isInterestOnly ? 'true' : 'false'}
                  onValueChange={(value) => setFormData({ ...formData, isInterestOnly: value === 'true' })}
                >
                  <SelectTrigger id="isInterestOnly">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Principal & Interest</SelectItem>
                    <SelectItem value="true">Interest Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.rateType === 'FIXED' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fixedExpiry">Fixed Rate Expiry</Label>
                  <Input
                    id="fixedExpiry"
                    type="date"
                    value={formData.fixedExpiry ? formData.fixedExpiry.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, fixedExpiry: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extraRepaymentCap">Extra Repayment Cap (Annual)</Label>
                  <Input
                    id="extraRepaymentCap"
                    type="number"
                    value={formData.extraRepaymentCap || ''}
                    onChange={(e) => setFormData({ ...formData, extraRepaymentCap: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="e.g., 10000"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="termMonthsRemaining">Term Remaining (months)</Label>
                <Input
                  id="termMonthsRemaining"
                  type="number"
                  value={formData.termMonthsRemaining}
                  onChange={(e) => setFormData({ ...formData, termMonthsRemaining: Number(e.target.value) })}
                  placeholder="300"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minRepayment">Minimum Repayment</Label>
                <Input
                  id="minRepayment"
                  type="number"
                  value={formData.minRepayment}
                  onChange={(e) => setFormData({ ...formData, minRepayment: Number(e.target.value) })}
                  placeholder="2500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repaymentFrequency">Repayment Frequency</Label>
              <Select
                value={formData.repaymentFrequency}
                onValueChange={(value) => setFormData({ ...formData, repaymentFrequency: value as Loan['repaymentFrequency'] })}
              >
                <SelectTrigger id="repaymentFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyId">Linked Property (Optional)</Label>
                <Select
                  value={formData.propertyId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, propertyId: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger id="propertyId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="offsetAccountId">Offset Account (Optional)</Label>
                <Select
                  value={formData.offsetAccountId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, offsetAccountId: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger id="offsetAccountId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.currentBalance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Loan' : 'Add Loan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              {selectedLoan?.name}
            </DialogTitle>
            <DialogDescription>
              Loan details and linked data
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="property">Property</TabsTrigger>
                <TabsTrigger value="offset">Offset</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Principal Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(selectedLoan.principal)}</p>
                      {selectedLoan.offsetAccount && (
                        <p className="text-sm text-green-600">
                          Effective: {formatCurrency(calculateEffectiveBalance(selectedLoan))}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Interest Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatPercent(selectedLoan.interestRateAnnual)}</p>
                      <p className="text-sm text-muted-foreground">{selectedLoan.rateType}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Annual Interest Cost</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(calculateAnnualInterest(selectedLoan))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ~{formatCurrency(calculateAnnualInterest(selectedLoan) / 12)}/month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Term Remaining</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{selectedLoan.termMonthsRemaining} months</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedLoan.termMonthsRemaining / 12).toFixed(1)} years
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
                      <span className="font-medium">{selectedLoan.type === 'HOME' ? 'Home Loan' : 'Investment Loan'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Repayment Type</span>
                      <span className="font-medium">{selectedLoan.isInterestOnly ? 'Interest Only' : 'Principal & Interest'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min Repayment</span>
                      <span className="font-medium">
                        {formatCurrency(selectedLoan.minRepayment)} {selectedLoan.repaymentFrequency.toLowerCase()}
                      </span>
                    </div>
                    {selectedLoan.rateType === 'FIXED' && selectedLoan.fixedExpiry && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fixed Rate Expiry</span>
                        <span className="font-medium">{formatDate(selectedLoan.fixedExpiry)}</span>
                      </div>
                    )}
                    {selectedLoan.extraRepaymentCap && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Extra Repayment Cap</span>
                        <span className="font-medium">{formatCurrency(selectedLoan.extraRepaymentCap)}/year</span>
                      </div>
                    )}
                    {calculateLVR(selectedLoan) !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LVR</span>
                        <span className={`font-medium ${calculateLVR(selectedLoan)! > 80 ? 'text-orange-600' : ''}`}>
                          {calculateLVR(selectedLoan)!.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="property" className="space-y-4 pt-4">
                {selectedLoan.property ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {selectedLoan.property.name}
                      </CardTitle>
                      {selectedLoan.property.address && (
                        <CardDescription>{selectedLoan.property.address}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Property Value</p>
                          <p className="text-xl font-bold">{formatCurrency(selectedLoan.property.currentValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Equity</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(selectedLoan.property.currentValue - selectedLoan.principal)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>LVR</span>
                          <span>{calculateLVR(selectedLoan)?.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${(calculateLVR(selectedLoan) || 0) > 80 ? 'bg-orange-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(calculateLVR(selectedLoan) || 0, 100)}%` }}
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
                {selectedLoan.offsetAccount ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                        {selectedLoan.offsetAccount.name}
                      </CardTitle>
                      {selectedLoan.offsetAccount.institution && (
                        <CardDescription>{selectedLoan.offsetAccount.institution}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Offset Balance</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(selectedLoan.offsetAccount.currentBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Interest Savings</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(selectedLoan.offsetAccount.currentBalance * selectedLoan.interestRateAnnual)}/yr
                          </p>
                        </div>
                      </div>
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-muted-foreground">Principal Balance</p>
                              <p className="font-semibold">{formatCurrency(selectedLoan.principal)}</p>
                            </div>
                            <span className="text-2xl text-green-600">−</span>
                            <div>
                              <p className="text-sm text-muted-foreground">Offset Balance</p>
                              <p className="font-semibold text-green-600">{formatCurrency(selectedLoan.offsetAccount.currentBalance)}</p>
                            </div>
                            <span className="text-2xl">=</span>
                            <div>
                              <p className="text-sm text-muted-foreground">Effective Balance</p>
                              <p className="font-semibold">{formatCurrency(calculateEffectiveBalance(selectedLoan))}</p>
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
                    <p className="text-sm">Edit the loan to link an offset account</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4 pt-4">
                {selectedLoan.expenses && selectedLoan.expenses.length > 0 ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Linked Expenses Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                            <p className="text-xl font-bold">{selectedLoan.expenses.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Annual Total</p>
                            <p className="text-xl font-bold text-red-600">
                              {formatCurrency(calculateLinkedExpenses(selectedLoan))}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="space-y-2">
                      {selectedLoan.expenses.map((expense) => (
                        <Card key={expense.id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{expense.name}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline">{expense.category}</Badge>
                                  {expense.isTaxDeductible && (
                                    <Badge variant="secondary" className="text-green-600">Tax Deductible</Badge>
                                  )}
                                </div>
                                {expense.vendorName && (
                                  <p className="text-xs text-muted-foreground mt-1">{expense.vendorName}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                                <p className="text-xs text-muted-foreground">{expense.frequency.toLowerCase()}</p>
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

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedLoan._links?.related || []}
                  missingLinks={selectedLoan._meta?.missingLinks || []}
                  entityType="loan"
                  entityName={selectedLoan.name}
                  showHealthScore={true}
                />
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowDetailDialog(false); if (selectedLoan) handleEdit(selectedLoan); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Loan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
