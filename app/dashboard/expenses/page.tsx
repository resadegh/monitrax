'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Edit2, Trash2, TrendingDown, Calendar, AlertCircle, Home, Briefcase, Building2, Landmark, DollarSign, Receipt, Store } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Property {
  id: string;
  name: string;
  type: string;
}

interface Loan {
  id: string;
  name: string;
  type: string;
  principal: number;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  platform: string | null;
}

interface Expense {
  id: string;
  name: string;
  vendorName: string | null;
  category: 'HOUSING' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'OTHER';
  sourceType: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
  isEssential: boolean;
  isTaxDeductible: boolean;
  propertyId: string | null;
  loanId: string | null;
  investmentAccountId: string | null;
  property?: Property | null;
  loan?: Loan | null;
  investmentAccount?: InvestmentAccount | null;
}

type ExpenseFormData = {
  name: string;
  vendorName: string;
  category: Expense['category'];
  sourceType: Expense['sourceType'];
  amount: number;
  frequency: Expense['frequency'];
  isEssential: boolean;
  isTaxDeductible: boolean;
  propertyId: string | null;
  loanId: string | null;
  investmentAccountId: string | null;
};

export default function ExpensesPage() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>({
    name: '',
    vendorName: '',
    category: 'OTHER',
    sourceType: 'GENERAL',
    amount: 0,
    frequency: 'MONTHLY',
    isEssential: true,
    isTaxDeductible: false,
    propertyId: null,
    loanId: null,
    investmentAccountId: null,
  });

  useEffect(() => {
    if (token) {
      loadExpenses();
      loadProperties();
      loadLoans();
      loadInvestmentAccounts();
    }
  }, [token]);

  const loadExpenses = async () => {
    try {
      const response = await fetch('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setExpenses(await response.json());
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const response = await fetch('/api/properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setProperties(await response.json());
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const loadLoans = async () => {
    try {
      const response = await fetch('/api/loans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setLoans(await response.json());
      }
    } catch (error) {
      console.error('Error loading loans:', error);
    }
  };

  const loadInvestmentAccounts = async () => {
    try {
      const response = await fetch('/api/investments/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setInvestmentAccounts(await response.json());
      }
    } catch (error) {
      console.error('Error loading investment accounts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
    const method = editingId ? 'PUT' : 'POST';

    // Clear unrelated foreign keys based on sourceType
    const submitData = {
      ...formData,
      amount: Number(formData.amount),
      vendorName: formData.vendorName || null,
      propertyId: formData.sourceType === 'PROPERTY' ? formData.propertyId : null,
      loanId: formData.sourceType === 'LOAN' ? formData.loanId : null,
      investmentAccountId: formData.sourceType === 'INVESTMENT' ? formData.investmentAccountId : null,
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
        await loadExpenses();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      vendorName: '',
      category: 'OTHER',
      sourceType: 'GENERAL',
      amount: 0,
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: false,
      propertyId: null,
      loanId: null,
      investmentAccountId: null,
    });
  };

  const handleEdit = (item: Expense) => {
    setFormData({
      name: item.name,
      vendorName: item.vendorName || '',
      category: item.category,
      sourceType: item.sourceType || 'GENERAL',
      amount: item.amount,
      frequency: item.frequency,
      isEssential: item.isEssential,
      isTaxDeductible: item.isTaxDeductible || false,
      propertyId: item.propertyId,
      loanId: item.loanId,
      investmentAccountId: item.investmentAccountId,
    });
    setEditingId(item.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const convertToMonthly = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52 / 12;
      case 'FORTNIGHTLY': return amount * 26 / 12;
      case 'MONTHLY': return amount;
      case 'ANNUAL': return amount / 12;
      default: return amount;
    }
  };

  const totalMonthly = expenses.reduce((sum, e) => sum + convertToMonthly(e.amount, e.frequency), 0);

  const getCategoryBadge = (category: Expense['category']) => {
    const variants: Record<Expense['category'], { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      HOUSING: { variant: 'default', label: 'Housing' },
      RATES: { variant: 'secondary', label: 'Rates' },
      INSURANCE: { variant: 'default', label: 'Insurance' },
      MAINTENANCE: { variant: 'secondary', label: 'Maintenance' },
      PERSONAL: { variant: 'outline', label: 'Personal' },
      UTILITIES: { variant: 'secondary', label: 'Utilities' },
      FOOD: { variant: 'outline', label: 'Food' },
      TRANSPORT: { variant: 'secondary', label: 'Transport' },
      ENTERTAINMENT: { variant: 'outline', label: 'Entertainment' },
      STRATA: { variant: 'default', label: 'Strata' },
      LAND_TAX: { variant: 'destructive', label: 'Land Tax' },
      LOAN_INTEREST: { variant: 'destructive', label: 'Loan Interest' },
      OTHER: { variant: 'outline', label: 'Other' },
    };

    const { variant, label } = variants[category] || { variant: 'outline', label: category };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getSourceTypeIcon = (sourceType: Expense['sourceType']) => {
    switch (sourceType) {
      case 'PROPERTY':
        return <Home className="h-4 w-4 text-blue-500" />;
      case 'LOAN':
        return <Landmark className="h-4 w-4 text-orange-500" />;
      case 'INVESTMENT':
        return <Briefcase className="h-4 w-4 text-purple-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSourceLabel = (item: Expense) => {
    if (item.sourceType === 'PROPERTY' && item.property) {
      return item.property.name;
    }
    if (item.sourceType === 'LOAN' && item.loan) {
      return item.loan.name;
    }
    if (item.sourceType === 'INVESTMENT' && item.investmentAccount) {
      return item.investmentAccount.name;
    }
    return 'General';
  };

  // Auto-set defaults based on source type selection
  const handleSourceTypeChange = (value: Expense['sourceType']) => {
    const updates: Partial<ExpenseFormData> = { sourceType: value };

    // Clear all foreign keys first
    updates.propertyId = null;
    updates.loanId = null;
    updates.investmentAccountId = null;

    // Set tax deductible based on source type
    if (value === 'PROPERTY') {
      updates.isTaxDeductible = true;
    } else if (value === 'LOAN') {
      updates.category = 'LOAN_INTEREST';
      updates.isTaxDeductible = true;
    }

    setFormData({ ...formData, ...updates });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Expenses"
        description={`Manage your expenses • Total monthly: ${formatCurrency(totalMonthly)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading expenses...</p>
          </div>
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No expenses yet"
          description="Start by adding your first expense to track your spending and budget."
          action={{
            label: 'Add Expense',
            onClick: () => { setShowDialog(true); resetForm(); },
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {expenses.map((item) => {
            const monthlyAmount = convertToMonthly(item.amount, item.frequency);

            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-muted-foreground" />
                        {item.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getCategoryBadge(item.category)}
                        {!item.isEssential && (
                          <Badge variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Non-essential
                          </Badge>
                        )}
                        {item.isTaxDeductible && (
                          <Badge variant="secondary">
                            <Receipt className="h-3 w-3 mr-1" />
                            Deductible
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Amount</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {item.frequency.toLowerCase()}
                    </p>
                  </div>

                  {/* Vendor Name Display */}
                  {item.vendorName && (
                    <div className="flex items-center gap-2 text-sm">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{item.vendorName}</span>
                    </div>
                  )}

                  {/* Source Type Display */}
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    {getSourceTypeIcon(item.sourceType || 'GENERAL')}
                    <div>
                      <p className="text-xs text-muted-foreground">Source</p>
                      <p className="text-sm font-medium">{getSourceLabel(item)}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Equivalent</p>
                        <p className="font-semibold">{formatCurrency(monthlyAmount)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the expense details below.' : 'Enter the details for your new expense.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Council Rates"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendorName">Vendor/Payee</Label>
                <Input
                  id="vendorName"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  placeholder="e.g., City Council"
                />
              </div>
            </div>

            {/* Source Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="sourceType">Expense Source</Label>
              <Select
                value={formData.sourceType}
                onValueChange={handleSourceTypeChange}
              >
                <SelectTrigger id="sourceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      General Expense
                    </div>
                  </SelectItem>
                  <SelectItem value="PROPERTY">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-blue-500" />
                      Property Expense
                    </div>
                  </SelectItem>
                  <SelectItem value="LOAN">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-orange-500" />
                      Loan Expense
                    </div>
                  </SelectItem>
                  <SelectItem value="INVESTMENT">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-purple-500" />
                      Investment Expense
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Property Selector - shown when sourceType is PROPERTY */}
            {formData.sourceType === 'PROPERTY' && (
              <div className="space-y-2">
                <Label htmlFor="propertyId">Linked Property</Label>
                <Select
                  value={formData.propertyId || ''}
                  onValueChange={(value) => setFormData({ ...formData, propertyId: value || null })}
                >
                  <SelectTrigger id="propertyId">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.length === 0 ? (
                      <SelectItem value="" disabled>No properties available</SelectItem>
                    ) : (
                      properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {property.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {properties.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add properties first to link property expenses.
                  </p>
                )}
              </div>
            )}

            {/* Loan Selector - shown when sourceType is LOAN */}
            {formData.sourceType === 'LOAN' && (
              <div className="space-y-2">
                <Label htmlFor="loanId">Linked Loan</Label>
                <Select
                  value={formData.loanId || ''}
                  onValueChange={(value) => setFormData({ ...formData, loanId: value || null })}
                >
                  <SelectTrigger id="loanId">
                    <SelectValue placeholder="Select a loan" />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.length === 0 ? (
                      <SelectItem value="" disabled>No loans available</SelectItem>
                    ) : (
                      loans.map((loan) => (
                        <SelectItem key={loan.id} value={loan.id}>
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4" />
                            {loan.name}
                            <span className="text-xs text-muted-foreground">
                              ({formatCurrency(loan.principal)})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {loans.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add loans first to link loan expenses.
                  </p>
                )}
              </div>
            )}

            {/* Investment Account Selector - shown when sourceType is INVESTMENT */}
            {formData.sourceType === 'INVESTMENT' && (
              <div className="space-y-2">
                <Label htmlFor="investmentAccountId">Linked Investment Account</Label>
                <Select
                  value={formData.investmentAccountId || ''}
                  onValueChange={(value) => setFormData({ ...formData, investmentAccountId: value || null })}
                >
                  <SelectTrigger id="investmentAccountId">
                    <SelectValue placeholder="Select an investment account" />
                  </SelectTrigger>
                  <SelectContent>
                    {investmentAccounts.length === 0 ? (
                      <SelectItem value="" disabled>No investment accounts available</SelectItem>
                    ) : (
                      investmentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            {account.name}
                            {account.platform && (
                              <span className="text-xs text-muted-foreground">({account.platform})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {investmentAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add investment accounts first to link investment expenses.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as Expense['category'] })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOUSING">Housing</SelectItem>
                    <SelectItem value="RATES">Rates</SelectItem>
                    <SelectItem value="INSURANCE">Insurance</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="PERSONAL">Personal</SelectItem>
                    <SelectItem value="UTILITIES">Utilities</SelectItem>
                    <SelectItem value="FOOD">Food</SelectItem>
                    <SelectItem value="TRANSPORT">Transport</SelectItem>
                    <SelectItem value="ENTERTAINMENT">Entertainment</SelectItem>
                    <SelectItem value="STRATA">Strata</SelectItem>
                    <SelectItem value="LAND_TAX">Land Tax</SelectItem>
                    <SelectItem value="LOAN_INTEREST">Loan Interest</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  placeholder="500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value as Expense['frequency'] })}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="ANNUAL">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isEssential"
                  checked={formData.isEssential}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEssential: checked as boolean })}
                />
                <Label htmlFor="isEssential" className="text-sm font-normal cursor-pointer">
                  This is an essential expense
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isTaxDeductible"
                  checked={formData.isTaxDeductible}
                  onCheckedChange={(checked) => setFormData({ ...formData, isTaxDeductible: checked as boolean })}
                />
                <Label htmlFor="isTaxDeductible" className="text-sm font-normal cursor-pointer">
                  This expense is tax deductible
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Expense' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
