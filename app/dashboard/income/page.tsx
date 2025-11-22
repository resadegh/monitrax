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
import { DollarSign, Plus, Edit2, Trash2, TrendingUp, Calendar, Home, Briefcase, Building2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Property {
  id: string;
  name: string;
  type: string;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  platform: string | null;
}

interface Income {
  id: string;
  name: string;
  type: 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';
  sourceType: 'GENERAL' | 'PROPERTY' | 'INVESTMENT';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
  isTaxable: boolean;
  propertyId: string | null;
  investmentAccountId: string | null;
  property?: Property | null;
  investmentAccount?: InvestmentAccount | null;
}

type IncomeFormData = {
  name: string;
  type: Income['type'];
  sourceType: Income['sourceType'];
  amount: number;
  frequency: Income['frequency'];
  isTaxable: boolean;
  propertyId: string | null;
  investmentAccountId: string | null;
};

export default function IncomePage() {
  const { token } = useAuth();
  const [income, setIncome] = useState<Income[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<IncomeFormData>({
    name: '',
    type: 'SALARY',
    sourceType: 'GENERAL',
    amount: 0,
    frequency: 'MONTHLY',
    isTaxable: true,
    propertyId: null,
    investmentAccountId: null,
  });

  useEffect(() => {
    if (token) {
      loadIncome();
      loadProperties();
      loadInvestmentAccounts();
    }
  }, [token]);

  const loadIncome = async () => {
    try {
      const response = await fetch('/api/income', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setIncome(await response.json());
      }
    } catch (error) {
      console.error('Error loading income:', error);
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
    const url = editingId ? `/api/income/${editingId}` : '/api/income';
    const method = editingId ? 'PUT' : 'POST';

    // Clear unrelated foreign keys based on sourceType
    const submitData = {
      ...formData,
      amount: Number(formData.amount),
      propertyId: formData.sourceType === 'PROPERTY' ? formData.propertyId : null,
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
        await loadIncome();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving income:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 0,
      frequency: 'MONTHLY',
      isTaxable: true,
      propertyId: null,
      investmentAccountId: null,
    });
  };

  const handleEdit = (item: Income) => {
    setFormData({
      name: item.name,
      type: item.type,
      sourceType: item.sourceType || 'GENERAL',
      amount: item.amount,
      frequency: item.frequency,
      isTaxable: item.isTaxable,
      propertyId: item.propertyId,
      investmentAccountId: item.investmentAccountId,
    });
    setEditingId(item.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income source?')) return;

    try {
      await fetch(`/api/income/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadIncome();
    } catch (error) {
      console.error('Error deleting income:', error);
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

  const totalMonthly = income.reduce((sum, i) => sum + convertToMonthly(i.amount, i.frequency), 0);

  const getIncomeTypeBadge = (type: Income['type']) => {
    switch (type) {
      case 'SALARY':
        return <Badge variant="default">Salary</Badge>;
      case 'RENT':
      case 'RENTAL':
        return <Badge variant="secondary">Rental</Badge>;
      case 'INVESTMENT':
        return <Badge variant="outline">Investment</Badge>;
      default:
        return <Badge variant="outline">Other</Badge>;
    }
  };

  const getSourceTypeIcon = (sourceType: Income['sourceType']) => {
    switch (sourceType) {
      case 'PROPERTY':
        return <Home className="h-4 w-4 text-blue-500" />;
      case 'INVESTMENT':
        return <Briefcase className="h-4 w-4 text-purple-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-green-500" />;
    }
  };

  const getSourceLabel = (item: Income) => {
    if (item.sourceType === 'PROPERTY' && item.property) {
      return item.property.name;
    }
    if (item.sourceType === 'INVESTMENT' && item.investmentAccount) {
      return item.investmentAccount.name;
    }
    return 'General';
  };

  // Auto-set income type based on source type selection
  const handleSourceTypeChange = (value: Income['sourceType']) => {
    const updates: Partial<IncomeFormData> = { sourceType: value };

    if (value === 'PROPERTY') {
      updates.type = 'RENT';
      updates.investmentAccountId = null;
    } else if (value === 'INVESTMENT') {
      updates.type = 'INVESTMENT';
      updates.propertyId = null;
    } else {
      updates.propertyId = null;
      updates.investmentAccountId = null;
    }

    setFormData({ ...formData, ...updates });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Income"
        description={`Manage your income sources • Total monthly: ${formatCurrency(totalMonthly)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Income
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading income...</p>
          </div>
        </div>
      ) : income.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No income sources yet"
          description="Start by adding your first income source to track your earnings and cash flow."
          action={{
            label: 'Add Income',
            onClick: () => { setShowDialog(true); resetForm(); },
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {income.map((item) => {
            const monthlyAmount = convertToMonthly(item.amount, item.frequency);

            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        {item.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getIncomeTypeBadge(item.type)}
                        {!item.isTaxable && (
                          <Badge variant="outline">Tax-free</Badge>
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
                    <p className="text-xl font-bold text-green-600">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {item.frequency.toLowerCase()}
                    </p>
                  </div>

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
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Income' : 'Add New Income'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the income details below.' : 'Enter the details for your new income source.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Salary"
                required
              />
            </div>

            {/* Source Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="sourceType">Income Source</Label>
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
                      <DollarSign className="h-4 w-4 text-green-500" />
                      General Income
                    </div>
                  </SelectItem>
                  <SelectItem value="PROPERTY">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-blue-500" />
                      Property Income
                    </div>
                  </SelectItem>
                  <SelectItem value="INVESTMENT">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-purple-500" />
                      Investment Income
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
                    Add properties first to link rental income.
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
                    Add investment accounts first to link investment income.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as Income['type'] })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALARY">Salary</SelectItem>
                    <SelectItem value="RENT">Rental Income</SelectItem>
                    <SelectItem value="INVESTMENT">Investment Income</SelectItem>
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
                  placeholder="5000"
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
                onValueChange={(value) => setFormData({ ...formData, frequency: value as Income['frequency'] })}
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isTaxable"
                checked={formData.isTaxable}
                onCheckedChange={(checked) => setFormData({ ...formData, isTaxable: checked as boolean })}
              />
              <Label htmlFor="isTaxable" className="text-sm font-normal cursor-pointer">
                This income is taxable
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Income' : 'Add Income'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
