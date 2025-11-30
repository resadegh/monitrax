'use client';

import { Suspense, useEffect, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  Calendar,
  Home,
  Briefcase,
  Building2,
  Eye,
  Link2,
  Calculator,
  PiggyBank,
  Info,
  Percent
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

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
  // Phase 20 Salary fields
  salaryType?: 'GROSS' | 'NET' | null;
  payFrequency?: string | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  paygWithholding?: number | null;
  superGuaranteeRate?: number | null;
  superGuaranteeAmount?: number | null;
  salarySacrifice?: number | null;
  // Phase 20 Investment fields
  frankingPercentage?: number | null;
  frankingCredits?: number | null;
  taxCategory?: string | null;
  taxableAmount?: number | null;
  taxNotes?: string | null;
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

type IncomeFormData = {
  name: string;
  type: Income['type'];
  sourceType: Income['sourceType'];
  amount: number;
  frequency: Income['frequency'];
  isTaxable: boolean;
  propertyId: string | null;
  investmentAccountId: string | null;
  // Phase 20 fields
  salaryType: 'GROSS' | 'NET' | null;
  payFrequency: string | null;
  salarySacrifice: number | null;
  frankingPercentage: number | null;
};

function IncomePageContent() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false);
    openLinkedEntity(entity);
  };

  const [income, setIncome] = useState<Income[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
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
    salaryType: 'GROSS',
    payFrequency: null,
    salarySacrifice: null,
    frankingPercentage: null,
  });

  // Calculated salary values (preview)
  const [salaryPreview, setSalaryPreview] = useState<{
    grossAmount: number;
    netAmount: number;
    paygWithholding: number;
    superGuarantee: number;
  } | null>(null);

  useEffect(() => {
    if (token) {
      loadIncome();
      loadProperties();
      loadInvestmentAccounts();
    }
  }, [token]);

  // Calculate salary preview when relevant fields change
  useEffect(() => {
    if (formData.type === 'SALARY' && formData.amount > 0 && formData.salaryType) {
      calculateSalaryPreview();
    } else {
      setSalaryPreview(null);
    }
  }, [formData.type, formData.amount, formData.frequency, formData.salaryType, formData.salarySacrifice]);

  const calculateSalaryPreview = async () => {
    if (!token || formData.amount <= 0) return;

    try {
      const annualAmount = convertToAnnual(formData.amount, formData.frequency);
      const response = await fetch('/api/tax/salary/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: annualAmount,
          salaryType: formData.salaryType,
          salarySacrifice: formData.salarySacrifice || 0,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSalaryPreview({
          grossAmount: result.grossSalary || annualAmount,
          netAmount: result.netSalary || annualAmount,
          paygWithholding: result.paygWithholding || 0,
          superGuarantee: result.superGuarantee || 0,
        });
      }
    } catch (error) {
      // If calculation fails, show basic estimates
      const annualAmount = convertToAnnual(formData.amount, formData.frequency);
      const estimatedTax = annualAmount * 0.30; // Rough 30% estimate
      const sg = annualAmount * 0.115; // 11.5% SG
      setSalaryPreview({
        grossAmount: formData.salaryType === 'GROSS' ? annualAmount : annualAmount / 0.7,
        netAmount: formData.salaryType === 'NET' ? annualAmount : annualAmount * 0.7,
        paygWithholding: estimatedTax,
        superGuarantee: sg,
      });
    }
  };

  const loadIncome = async () => {
    try {
      const response = await fetch('/api/income', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setIncome(result.data || result);
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
        const result = await response.json();
        setProperties(result.data || result);
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
        const result = await response.json();
        setInvestmentAccounts(result.data || result);
      }
    } catch (error) {
      console.error('Error loading investment accounts:', error);
    }
  };

  const handleViewDetails = (item: Income) => {
    setSelectedIncome(item);
    setShowDetailDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/income/${editingId}` : '/api/income';
    const method = editingId ? 'PUT' : 'POST';

    // Build submit data with Phase 20 fields
    const submitData: Record<string, unknown> = {
      name: formData.name,
      type: formData.type,
      sourceType: formData.sourceType,
      amount: Number(formData.amount),
      frequency: formData.frequency,
      isTaxable: formData.isTaxable,
      propertyId: formData.sourceType === 'PROPERTY' ? formData.propertyId : null,
      investmentAccountId: formData.sourceType === 'INVESTMENT' ? formData.investmentAccountId : null,
    };

    // Add salary-specific fields
    if (formData.type === 'SALARY') {
      submitData.salaryType = formData.salaryType;
      submitData.payFrequency = formData.payFrequency || formData.frequency;
      submitData.salarySacrifice = formData.salarySacrifice;
      // Calculated values will be computed on the backend
      if (salaryPreview) {
        submitData.grossAmount = salaryPreview.grossAmount;
        submitData.netAmount = salaryPreview.netAmount;
        submitData.paygWithholding = salaryPreview.paygWithholding;
        submitData.superGuaranteeAmount = salaryPreview.superGuarantee;
        submitData.superGuaranteeRate = 0.115; // 11.5% for 2024-25
      }
    }

    // Add investment-specific fields
    if (formData.type === 'INVESTMENT' && formData.sourceType === 'INVESTMENT') {
      submitData.frankingPercentage = formData.frankingPercentage;
      if (formData.frankingPercentage) {
        // Calculate franking credits
        const grossedUpDividend = formData.amount / (1 - (formData.frankingPercentage / 100) * 0.30);
        submitData.frankingCredits = grossedUpDividend - formData.amount;
      }
    }

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
      salaryType: 'GROSS',
      payFrequency: null,
      salarySacrifice: null,
      frankingPercentage: null,
    });
    setSalaryPreview(null);
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
      salaryType: item.salaryType || 'GROSS',
      payFrequency: item.payFrequency || null,
      salarySacrifice: item.salarySacrifice || null,
      frankingPercentage: item.frankingPercentage || null,
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

  const convertToAnnual = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52;
      case 'FORTNIGHTLY': return amount * 26;
      case 'MONTHLY': return amount * 12;
      case 'ANNUAL': return amount;
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
      updates.salaryType = null;
      updates.salarySacrifice = null;
    } else if (value === 'INVESTMENT') {
      updates.type = 'INVESTMENT';
      updates.propertyId = null;
      updates.salaryType = null;
      updates.salarySacrifice = null;
    } else {
      updates.propertyId = null;
      updates.investmentAccountId = null;
    }

    setFormData({ ...formData, ...updates });
  };

  // Handle type change
  const handleTypeChange = (value: Income['type']) => {
    const updates: Partial<IncomeFormData> = { type: value };

    if (value === 'SALARY') {
      updates.salaryType = 'GROSS';
      updates.sourceType = 'GENERAL';
      updates.propertyId = null;
      updates.investmentAccountId = null;
      updates.frankingPercentage = null;
    } else if (value === 'RENT') {
      updates.sourceType = 'PROPERTY';
      updates.salaryType = null;
      updates.salarySacrifice = null;
      updates.frankingPercentage = null;
    } else if (value === 'INVESTMENT') {
      updates.sourceType = 'INVESTMENT';
      updates.salaryType = null;
      updates.salarySacrifice = null;
    } else {
      updates.salaryType = null;
      updates.salarySacrifice = null;
      updates.frankingPercentage = null;
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
            const annualAmount = convertToAnnual(item.amount, item.frequency);

            return (
              <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(item)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        {item.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getIncomeTypeBadge(item.type)}
                        {item.type === 'SALARY' && item.salaryType && (
                          <Badge variant="outline" className="text-xs">{item.salaryType}</Badge>
                        )}
                        {item.frankingPercentage && item.frankingPercentage > 0 && (
                          <Badge variant="outline" className="text-xs text-emerald-600">{item.frankingPercentage}% Franked</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
                    <p className="text-xs text-muted-foreground mb-1">
                      {item.type === 'SALARY' && item.salaryType === 'NET' ? 'Net Amount' : 'Amount'}
                    </p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {item.frequency.toLowerCase()}
                    </p>
                  </div>

                  {/* Salary-specific info */}
                  {item.type === 'SALARY' && (item.paygWithholding || item.superGuaranteeAmount) && (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-lg text-xs">
                      {item.grossAmount && item.salaryType === 'NET' && (
                        <div>
                          <p className="text-muted-foreground">Gross</p>
                          <p className="font-medium">{formatCurrency(item.grossAmount)}/yr</p>
                        </div>
                      )}
                      {item.paygWithholding && (
                        <div>
                          <p className="text-muted-foreground">PAYG</p>
                          <p className="font-medium">{formatCurrency(item.paygWithholding)}/yr</p>
                        </div>
                      )}
                      {item.superGuaranteeAmount && (
                        <div>
                          <p className="text-muted-foreground">Super (SG)</p>
                          <p className="font-medium">{formatCurrency(item.superGuaranteeAmount)}/yr</p>
                        </div>
                      )}
                      {item.salarySacrifice && item.salarySacrifice > 0 && (
                        <div>
                          <p className="text-muted-foreground">Sacrifice</p>
                          <p className="font-medium">{formatCurrency(item.salarySacrifice)}/yr</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Franking credits for dividends */}
                  {item.frankingCredits && item.frankingCredits > 0 && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Franking Credits: {formatCurrency(item.frankingCredits)}
                      </p>
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
                        <p className="text-xs text-muted-foreground">Annual</p>
                        <p className="font-semibold">{formatCurrency(annualAmount)}</p>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Income Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALARY">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Salary/Wages
                      </div>
                    </SelectItem>
                    <SelectItem value="RENT">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Rental Income
                      </div>
                    </SelectItem>
                    <SelectItem value="INVESTMENT">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Investment/Dividends
                      </div>
                    </SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Payment Frequency</Label>
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
            </div>

            {/* Salary-specific fields */}
            {formData.type === 'SALARY' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Salary Details</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="salaryType">Amount Type</Label>
                      <Select
                        value={formData.salaryType || 'GROSS'}
                        onValueChange={(value) => setFormData({ ...formData, salaryType: value as 'GROSS' | 'NET' })}
                      >
                        <SelectTrigger id="salaryType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GROSS">Gross (Before Tax)</SelectItem>
                          <SelectItem value="NET">Net (After Tax)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.salaryType === 'GROSS'
                          ? 'Enter your salary before tax deductions'
                          : 'Enter your take-home pay after tax'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">{formData.salaryType === 'GROSS' ? 'Gross' : 'Net'} Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        placeholder={formData.salaryType === 'GROSS' ? '85000' : '65000'}
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salarySacrifice">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-4 w-4" />
                        Salary Sacrifice (Annual)
                      </div>
                    </Label>
                    <Input
                      id="salarySacrifice"
                      type="number"
                      value={formData.salarySacrifice || ''}
                      onChange={(e) => setFormData({ ...formData, salarySacrifice: e.target.value ? Number(e.target.value) : null })}
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pre-tax contributions to superannuation beyond employer SG
                    </p>
                  </div>

                  {/* Salary Preview */}
                  {salaryPreview && (
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Estimated Annual Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Gross Salary</p>
                            <p className="font-semibold">{formatCurrency(salaryPreview.grossAmount)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">PAYG Withholding</p>
                            <p className="font-semibold text-red-600">{formatCurrency(salaryPreview.paygWithholding)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Salary</p>
                            <p className="font-semibold text-green-600">{formatCurrency(salaryPreview.netAmount)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Super Guarantee (11.5%)</p>
                            <p className="font-semibold text-blue-600">{formatCurrency(salaryPreview.superGuarantee)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}

            {/* Property Income Source */}
            {formData.type === 'RENT' && (
              <>
                <Separator />
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

                  <div className="space-y-2 pt-2">
                    <Label htmlFor="rentAmount">Weekly Rent Amount</Label>
                    <Input
                      id="rentAmount"
                      type="number"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value), frequency: 'WEEKLY' })}
                      placeholder="500"
                      min="0"
                      step="10"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Investment Income Source */}
            {formData.type === 'INVESTMENT' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="investmentAccountId">Linked Investment Account</Label>
                    <Select
                      value={formData.investmentAccountId || ''}
                      onValueChange={(value) => setFormData({ ...formData, investmentAccountId: value || null })}
                    >
                      <SelectTrigger id="investmentAccountId">
                        <SelectValue placeholder="Select an investment account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.length === 0 ? (
                          <SelectItem value="" disabled>No investment accounts available</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="">None</SelectItem>
                            {investmentAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <div className="flex items-center gap-2">
                                  <Briefcase className="h-4 w-4" />
                                  {account.name}
                                  {account.platform && (
                                    <span className="text-xs text-muted-foreground">({account.platform})</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="investmentAmount">Dividend/Distribution Amount</Label>
                      <Input
                        id="investmentAmount"
                        type="number"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        placeholder="1000"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="frankingPercentage">
                        <div className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Franking Percentage
                        </div>
                      </Label>
                      <Input
                        id="frankingPercentage"
                        type="number"
                        value={formData.frankingPercentage || ''}
                        onChange={(e) => setFormData({ ...formData, frankingPercentage: e.target.value ? Number(e.target.value) : null })}
                        placeholder="100"
                        min="0"
                        max="100"
                        step="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Australian franked dividends (0-100%)
                      </p>
                    </div>
                  </div>

                  {formData.frankingPercentage && formData.frankingPercentage > 0 && formData.amount > 0 && (
                    <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                          <Info className="h-4 w-4" />
                          <span>
                            Franking credits: {formatCurrency(formData.amount * (formData.frankingPercentage / 100) * 0.30 / 0.70)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}

            {/* Other income - simple form */}
            {formData.type === 'OTHER' && (
              <div className="space-y-2">
                <Label htmlFor="otherAmount">Amount</Label>
                <Input
                  id="otherAmount"
                  type="number"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  placeholder="1000"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            )}

            {/* Tax status - only show for non-salary income */}
            {formData.type !== 'SALARY' && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="isTaxable"
                  checked={formData.isTaxable}
                  onCheckedChange={(checked) => setFormData({ ...formData, isTaxable: checked as boolean })}
                />
                <Label htmlFor="isTaxable" className="text-sm font-normal cursor-pointer">
                  This income is taxable
                </Label>
              </div>
            )}

            {formData.type === 'SALARY' && (
              <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                Salary income is automatically taxable. PAYG withholding is calculated based on ATO tax tables.
              </p>
            )}

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

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {selectedIncome?.name}
            </DialogTitle>
            <DialogDescription>
              Income details and linked data
            </DialogDescription>
          </DialogHeader>

          {selectedIncome && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 pt-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {selectedIncome.type === 'SALARY' && selectedIncome.salaryType === 'NET' ? 'Net Amount' : 'Amount'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedIncome.amount)}</p>
                      <p className="text-sm text-muted-foreground capitalize">{selectedIncome.frequency.toLowerCase()}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Annual Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(convertToAnnual(selectedIncome.amount, selectedIncome.frequency))}</p>
                      <p className="text-sm text-muted-foreground">per year</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Salary-specific details */}
                {selectedIncome.type === 'SALARY' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Salary Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedIncome.grossAmount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gross Annual Salary</span>
                            <span className="font-medium">{formatCurrency(selectedIncome.grossAmount)}</span>
                          </div>
                        )}
                        {selectedIncome.paygWithholding && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">PAYG Withholding</span>
                            <span className="font-medium text-red-600">-{formatCurrency(selectedIncome.paygWithholding)}</span>
                          </div>
                        )}
                        {selectedIncome.netAmount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Net Annual Salary</span>
                            <span className="font-medium text-green-600">{formatCurrency(selectedIncome.netAmount)}</span>
                          </div>
                        )}
                        <Separator />
                        {selectedIncome.superGuaranteeAmount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Super Guarantee ({((selectedIncome.superGuaranteeRate || 0.115) * 100).toFixed(1)}%)</span>
                            <span className="font-medium text-blue-600">{formatCurrency(selectedIncome.superGuaranteeAmount)}</span>
                          </div>
                        )}
                        {selectedIncome.salarySacrifice && selectedIncome.salarySacrifice > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Salary Sacrifice</span>
                            <span className="font-medium text-blue-600">{formatCurrency(selectedIncome.salarySacrifice)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Dividend-specific details */}
                {selectedIncome.type === 'INVESTMENT' && selectedIncome.frankingCredits && selectedIncome.frankingCredits > 0 && (
                  <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Percent className="h-4 w-4" />
                        Franking Credits
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Franking Percentage</span>
                          <span className="font-medium">{selectedIncome.frankingPercentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Franking Credits</span>
                          <span className="font-medium text-emerald-600">{formatCurrency(selectedIncome.frankingCredits)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Grossed-up Dividend</span>
                          <span>{formatCurrency(selectedIncome.amount + selectedIncome.frankingCredits)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* General details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Income Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{getIncomeTypeBadge(selectedIncome.type)}</span>
                    </div>
                    {selectedIncome.type === 'SALARY' && selectedIncome.salaryType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Salary Type</span>
                        <Badge variant="outline">{selectedIncome.salaryType}</Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source</span>
                      <div className="flex items-center gap-2">
                        {getSourceTypeIcon(selectedIncome.sourceType || 'GENERAL')}
                        <span className="font-medium">{getSourceLabel(selectedIncome)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency</span>
                      <span className="font-medium capitalize">{selectedIncome.frequency.toLowerCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Status</span>
                      {selectedIncome.isTaxable ? (
                        <Badge variant="secondary">Taxable</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">Tax-free</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {selectedIncome.property && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Home className="h-4 w-4 text-blue-500" />
                        Linked Property
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedIncome.property.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{selectedIncome.property.type?.toLowerCase() || 'Property'}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedIncome.investmentAccount && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-purple-500" />
                        Linked Investment Account
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedIncome.investmentAccount.name}</p>
                      {selectedIncome.investmentAccount.platform && (
                        <p className="text-sm text-muted-foreground">{selectedIncome.investmentAccount.platform}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedIncome._links?.related || []}
                  missingLinks={selectedIncome._meta?.missingLinks || []}
                  entityType="income"
                  entityName={selectedIncome.name}
                  showHealthScore={true}
                  onNavigate={handleLinkedEntityNavigate}
                />
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowDetailDialog(false); if (selectedIncome) handleEdit(selectedIncome); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Income
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function IncomePage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <IncomePageContent />
    </Suspense>
  );
}
