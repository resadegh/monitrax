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
import { Landmark, Plus, Edit2, Trash2, Home as HomeIcon, Wallet, Calendar, TrendingDown } from 'lucide-react';

interface Loan {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT' | 'PERSONAL' | 'CREDIT_CARD';
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  propertyId?: string;
  offsetAccountId?: string;
  property?: { name: string };
  offsetAccount?: { name: string; currentBalance: number };
}

interface Property {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

export default function LoansPage() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
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

      if (loansRes.ok) setLoans(await loansRes.json());
      if (propertiesRes.ok) setProperties(await propertiesRes.json());
      if (accountsRes.ok) {
        const allAccounts = await accountsRes.json();
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
      propertyId: loan.propertyId,
      offsetAccountId: loan.offsetAccountId,
    });
    setEditingId(loan.id);
    setShowDialog(true);
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

  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);

  const getLoanTypeBadge = (type: Loan['type']) => {
    switch (type) {
      case 'HOME':
        return <Badge variant="default">Home Loan</Badge>;
      case 'INVESTMENT':
        return <Badge variant="secondary">Investment</Badge>;
      case 'PERSONAL':
        return <Badge variant="outline">Personal</Badge>;
      default:
        return <Badge variant="destructive">Credit Card</Badge>;
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
          {loans.map((loan) => (
            <Card key={loan.id}>
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
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                    <p className="text-xl font-bold">{formatPercent(loan.interestRateAnnual)}</p>
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

                {(loan.property || loan.offsetAccount) && (
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
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Offset:</span>
                        <span className="font-medium">
                          {loan.offsetAccount.name} ({formatCurrency(loan.offsetAccount.currentBalance)})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
                    <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                    <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
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
    </DashboardLayout>
  );
}
