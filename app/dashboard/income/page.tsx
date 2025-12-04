'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
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
  Percent,
  FolderOpen,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import {
  getIncomeTypeOptions,
  getDefaultIncomeType,
  type IncomeSourceType,
  type IncomeType as IncomeTypeEnum,
} from '@/lib/categoryFilters';
import { ListFilter, incomeFilterConfigs } from '@/components/ListFilter';

type ViewMode = 'type' | 'source' | 'all' | 'list';

interface IncomeGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  incomes: Income[];
  totalMonthly: number;
  count: number;
}

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
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
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
  const [viewMode, setViewMode] = useState<ViewMode>('type');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filteredIncome, setFilteredIncome] = useState<Income[]>([]);

  useEffect(() => {
    if (token) {
      loadIncome();
      loadProperties();
      loadInvestmentAccounts();
    }
  }, [token]);

  // Initialize filtered income when income changes
  useEffect(() => {
    setFilteredIncome(income);
  }, [income]);

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
      const response = await fetch('/api/tax/salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: annualAmount,
          salaryType: formData.salaryType,
          payFrequency: 'ANNUALLY',
          salarySacrifice: formData.salarySacrifice || 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // API returns nested under 'result'
        const result = data.result;
        setSalaryPreview({
          grossAmount: result?.grossSalary || annualAmount,
          netAmount: result?.netSalary || annualAmount,
          paygWithholding: result?.tax?.total || 0,
          superGuarantee: result?.super?.guarantee || 0,
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
      case 'QUARTERLY': return amount * 4 / 12;
      case 'ANNUAL': return amount / 12;
      default: return amount;
    }
  };

  const convertToAnnual = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52;
      case 'FORTNIGHTLY': return amount * 26;
      case 'MONTHLY': return amount * 12;
      case 'QUARTERLY': return amount * 4;
      case 'ANNUAL': return amount;
      default: return amount;
    }
  };

  // Get effective (after-tax) annual amount for an income item
  // For SALARY with GROSS type: use netAmount (already tax-adjusted)
  // For other income: use the raw amount
  const getEffectiveAnnualAmount = (item: Income): number => {
    if (item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount) {
      // netAmount is already annual and after-tax
      return item.netAmount;
    }
    // For NET salary or other income types, convert amount to annual
    return convertToAnnual(item.amount, item.frequency);
  };

  // Get effective monthly amount (after-tax for salaries)
  const getEffectiveMonthlyAmount = (item: Income): number => {
    return getEffectiveAnnualAmount(item) / 12;
  };

  // Calculate totals - use after-tax amounts for salaries
  const totalNetMonthly = filteredIncome.reduce((sum, i) => sum + getEffectiveMonthlyAmount(i), 0);
  const totalGrossMonthly = filteredIncome.reduce((sum, i) => sum + convertToMonthly(i.amount, i.frequency), 0);
  const allTotalNetMonthly = income.reduce((sum, i) => sum + getEffectiveMonthlyAmount(i), 0);

  // Use net monthly for display (matches dashboard)
  const totalMonthly = totalNetMonthly;

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
  // Get filtered income type options based on source type
  const filteredIncomeTypeOptions = useMemo(() => {
    return getIncomeTypeOptions(formData.sourceType as IncomeSourceType);
  }, [formData.sourceType]);

  const handleSourceTypeChange = (value: Income['sourceType']) => {
    const updates: Partial<IncomeFormData> = { sourceType: value };

    // Set default income type based on source type
    updates.type = getDefaultIncomeType(value as IncomeSourceType);

    if (value === 'PROPERTY') {
      updates.investmentAccountId = null;
      updates.salaryType = null;
      updates.salarySacrifice = null;
    } else if (value === 'INVESTMENT') {
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

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Type info with icons and colors
  const typeInfo: Record<Income['type'], { label: string; icon: React.ReactNode; color: string }> = {
    SALARY: { label: 'Salary/Wages', icon: <Briefcase className="h-5 w-5" />, color: 'text-blue-500' },
    RENT: { label: 'Rental', icon: <Home className="h-5 w-5" />, color: 'text-amber-500' },
    RENTAL: { label: 'Rental', icon: <Home className="h-5 w-5" />, color: 'text-amber-500' },
    INVESTMENT: { label: 'Investment', icon: <TrendingUp className="h-5 w-5" />, color: 'text-purple-500' },
    OTHER: { label: 'Other', icon: <DollarSign className="h-5 w-5" />, color: 'text-gray-500' },
  };

  // Group income by type
  const groupByType = (): IncomeGroup[] => {
    const groups: Record<string, Income[]> = {};
    filteredIncome.forEach(inc => {
      const type = inc.type === 'RENTAL' ? 'RENT' : inc.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(inc);
    });

    return Object.entries(groups).map(([type, incs]) => {
      const info = typeInfo[type as Income['type']] || typeInfo.OTHER;
      // Use after-tax amounts for salaries
      const totalMonthly = incs.reduce((sum, i) => sum + getEffectiveMonthlyAmount(i), 0);
      return {
        id: `type-${type}`,
        name: info.label,
        icon: <span className={info.color}>{info.icon}</span>,
        incomes: incs,
        totalMonthly,
        count: incs.length,
      };
    }).sort((a, b) => b.totalMonthly - a.totalMonthly);
  };

  // Group income by source
  const groupBySource = (): IncomeGroup[] => {
    const groups: Record<string, { name: string; icon: React.ReactNode; incomes: Income[] }> = {
      general: { name: 'General Income', icon: <DollarSign className="h-5 w-5 text-green-500" />, incomes: [] },
    };

    // Add property groups
    properties.forEach(prop => {
      groups[`property-${prop.id}`] = {
        name: prop.name,
        icon: <Home className="h-5 w-5 text-blue-500" />,
        incomes: []
      };
    });

    // Add investment account groups
    investmentAccounts.forEach(acc => {
      groups[`investment-${acc.id}`] = {
        name: acc.name,
        icon: <Briefcase className="h-5 w-5 text-purple-500" />,
        incomes: []
      };
    });

    // Distribute incomes
    filteredIncome.forEach(inc => {
      if (inc.sourceType === 'PROPERTY' && inc.propertyId) {
        const key = `property-${inc.propertyId}`;
        if (groups[key]) {
          groups[key].incomes.push(inc);
        } else {
          groups.general.incomes.push(inc);
        }
      } else if (inc.sourceType === 'INVESTMENT' && inc.investmentAccountId) {
        const key = `investment-${inc.investmentAccountId}`;
        if (groups[key]) {
          groups[key].incomes.push(inc);
        } else {
          groups.general.incomes.push(inc);
        }
      } else {
        groups.general.incomes.push(inc);
      }
    });

    return Object.entries(groups)
      .filter(([_, group]) => group.incomes.length > 0)
      .map(([key, group]) => {
        // Use after-tax amounts for salaries
        const totalMonthly = group.incomes.reduce((sum, i) => sum + getEffectiveMonthlyAmount(i), 0);
        return {
          id: key,
          name: group.name,
          icon: group.icon,
          incomes: group.incomes,
          totalMonthly,
          count: group.incomes.length,
        };
      })
      .sort((a, b) => b.totalMonthly - a.totalMonthly);
  };

  const incomeGroups = viewMode === 'type' ? groupByType() : viewMode === 'source' ? groupBySource() : [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Income"
        description={`Manage your income sources • Net monthly: ${formatCurrency(allTotalNetMonthly)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Income
          </Button>
        }
      />

      {/* Search and Filter */}
      {income.length > 0 && (
        <ListFilter
          data={income}
          searchFields={['name']}
          searchPlaceholder="Search income..."
          filters={incomeFilterConfigs}
          onFilteredData={setFilteredIncome}
          className="mb-4"
        />
      )}

      {/* View Mode Selector */}
      {income.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">Group by:</span>
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'type' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('type')}
            >
              <FolderOpen className="h-4 w-4" />
              Type
            </Button>
            <Button
              variant={viewMode === 'source' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('source')}
            >
              <Building2 className="h-4 w-4" />
              Source
            </Button>
            <Button
              variant={viewMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('all')}
            >
              <LayoutGrid className="h-4 w-4" />
              Tiles
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>
      )}

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
      ) : viewMode === 'list' ? (
        /* List view - compact table format */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3 text-right">Net Monthly</th>
                    <th className="px-4 py-3 text-right">Net Annual</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredIncome.map((item) => {
                    // Use effective (after-tax for salary) amounts
                    const effectiveMonthly = getEffectiveMonthlyAmount(item);
                    const effectiveAnnual = getEffectiveAnnualAmount(item);
                    const isSalaryWithTax = item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleViewDetails(item)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.name}</div>
                          {item.frankingPercentage && item.frankingPercentage > 0 && (
                            <div className="text-xs text-emerald-600">{item.frankingPercentage}% Franked</div>
                          )}
                          {isSalaryWithTax && (
                            <div className="text-xs text-muted-foreground">After tax</div>
                          )}
                        </td>
                        <td className="px-4 py-3">{getIncomeTypeBadge(item.type)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getSourceTypeIcon(item.sourceType || 'GENERAL')}
                            <span className="text-sm">{getSourceLabel(item)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">
                          {formatCurrency(item.amount)}
                          {isSalaryWithTax && <span className="text-xs text-muted-foreground block">gross</span>}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{item.frequency.toLowerCase()}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(effectiveMonthly)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(effectiveAnnual)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(item)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30 border-t">
                  <tr className="font-medium">
                    <td colSpan={5} className="px-4 py-3 text-right">Net Total:</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalNetMonthly)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalNetMonthly * 12)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'all' ? (
        /* Tiles view - individual cards */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredIncome.map((item) => {
            // Use effective (after-tax for salary) amounts
            const effectiveAnnual = getEffectiveAnnualAmount(item);
            const isSalaryWithTax = item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount;

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
                      {isSalaryWithTax ? 'Gross Amount' : item.type === 'SALARY' && item.salaryType === 'NET' ? 'Net Amount' : 'Amount'}
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
                        <p className="text-xs text-muted-foreground">{isSalaryWithTax ? 'Net Annual' : 'Annual'}</p>
                        <p className="font-semibold">{formatCurrency(effectiveAnnual)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Grouped view - expandable groups (type or source) */
        <div className="space-y-4">
          {incomeGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const annualTotal = group.totalMonthly * 12;

            return (
              <Card key={group.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleGroupExpanded(group.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {group.icon}
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {group.count} income source{group.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">{formatCurrency(group.totalMonthly)}</p>
                        <p className="text-xs text-muted-foreground">per month • {formatCurrency(annualTotal)}/yr</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t pt-4">
                    <div className="space-y-2">
                      {/* Table header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                        <div className="col-span-4">Name</div>
                        <div className="col-span-2">Amount</div>
                        <div className="col-span-2">Frequency</div>
                        <div className="col-span-2">Net Monthly</div>
                        <div className="col-span-2 text-right">Actions</div>
                      </div>

                      {/* Income rows */}
                      {group.incomes.map((item) => {
                        // Use effective (after-tax for salary) amount
                        const effectiveMonthly = getEffectiveMonthlyAmount(item);
                        const isSalaryWithTax = item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount;
                        return (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors items-center"
                          >
                            <div className="col-span-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{item.name}</span>
                                {item.frankingPercentage && item.frankingPercentage > 0 && (
                                  <span title={`${item.frankingPercentage}% Franked`}>
                                    <Percent className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                  </span>
                                )}
                                {isSalaryWithTax && (
                                  <span className="text-xs text-muted-foreground">(after tax)</span>
                                )}
                              </div>
                              {viewMode === 'type' && item.property && (
                                <p className="text-xs text-blue-500 truncate">{item.property.name}</p>
                              )}
                              {viewMode === 'type' && item.investmentAccount && (
                                <p className="text-xs text-purple-500 truncate">{item.investmentAccount.name}</p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium text-green-600">{formatCurrency(item.amount)}</span>
                              {isSalaryWithTax && <span className="text-xs text-muted-foreground block">gross</span>}
                            </div>
                            <div className="col-span-2">
                              <span className="text-sm capitalize">{item.frequency.toLowerCase()}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-sm">{formatCurrency(effectiveMonthly)}</span>
                            </div>
                            <div className="col-span-2 flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
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
                    {filteredIncomeTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.value === 'SALARY' && <Briefcase className="h-4 w-4" />}
                          {option.value === 'RENT' && <Home className="h-4 w-4" />}
                          {option.value === 'RENTAL' && <Home className="h-4 w-4" />}
                          {option.value === 'INVESTMENT' && <TrendingUp className="h-4 w-4" />}
                          {option.value === 'OTHER' && <DollarSign className="h-4 w-4" />}
                          {option.value === 'SALARY' ? 'Salary/Wages' :
                           option.value === 'RENT' ? 'Rental Income' :
                           option.value === 'RENTAL' ? 'Rental Income' :
                           option.value === 'INVESTMENT' ? 'Investment/Dividends' :
                           option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.sourceType !== 'GENERAL' && (
                  <p className="text-xs text-muted-foreground">
                    Showing types relevant to {formData.sourceType.toLowerCase()} income
                  </p>
                )}
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
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
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
