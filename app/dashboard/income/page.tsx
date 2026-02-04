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
  ChevronUp,
  ArrowDownToLine
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { toAnnual } from '@/lib/utils/frequencies';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { getNetAnnualIncome, getNetMonthlyIncome } from '@/lib/income/netIncomeCalculator';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import {
  getIncomeTypeOptions,
  getDefaultIncomeType,
  type IncomeSourceType,
  type IncomeType as IncomeTypeEnum,
} from '@/lib/categoryFilters';
import { ListFilter, incomeFilterConfigs } from '@/components/ListFilter';
import { FormDocumentUpload, FieldMapping } from '@/components/documents';

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
  // Phase 30: Budget vs Actual
  budgetAmount?: number;              // Budget = entry.amount
  actualFromTransactions?: number | null;  // Total actual from ALL linked transactions
  currentMonthActual?: number | null; // Actual from current month only
  monthlyAverageActual?: number | null; // Monthly average calculated from transaction history
  transactionCount?: number;          // Total number of linked transactions
  currentMonthTransactionCount?: number; // Transactions this month only
  hasTransactions?: boolean;          // Whether any transactions are linked
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
  const [attachedDocumentId, setAttachedDocumentId] = useState<string | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);

  // Variance to Expense state
  const [showVarianceExpenseDialog, setShowVarianceExpenseDialog] = useState(false);
  const [varianceExpenseIncome, setVarianceExpenseIncome] = useState<Income | null>(null);
  const [varianceExpenseAmount, setVarianceExpenseAmount] = useState(0);
  const [expenseCategories, setExpenseCategories] = useState<Array<{
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
  }>>([]);
  const [varianceExpenseForm, setVarianceExpenseForm] = useState({
    name: '',
    category: 'MAINTENANCE',
    customCategoryName: '',
    isCreatingCustom: false,
  });

  // Handle auto-fill from document analysis
  const handleFieldsExtracted = (mappings: Record<string, FieldMapping>) => {
    const filledFields: string[] = [];
    const updates: Partial<IncomeFormData> = {};

    // Map extracted fields to form data
    if (mappings.source?.value && !formData.name) {
      updates.name = String(mappings.source.value);
      filledFields.push('name');
    }

    if (mappings.amount?.value && !formData.amount) {
      updates.amount = Number(mappings.amount.value);
      filledFields.push('amount');
    }

    if (mappings.date?.value) {
      // Could be used for filtering or context
      filledFields.push('date');
    }

    if (mappings.frequency?.value) {
      const frequencyValue = String(mappings.frequency.value).toUpperCase();
      const validFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
      if (validFrequencies.includes(frequencyValue)) {
        updates.frequency = frequencyValue as Income['frequency'];
        filledFields.push('frequency');
      }
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
      setAutoFilledFields(filledFields);
    }
  };

  useEffect(() => {
    if (token) {
      loadIncome();
      loadProperties();
      loadInvestmentAccounts();
      loadExpenseCategories();
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

  const loadExpenseCategories = async () => {
    try {
      const response = await fetch('/api/categories?type=EXPENSE', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setExpenseCategories(result.data || []);
      }
    } catch (error) {
      console.error('Error loading expense categories:', error);
    }
  };

  // Open variance expense dialog
  const handleOpenVarianceExpense = (item: Income, variance: number) => {
    const propertyName = item.property?.name || 'Property';
    const currentMonth = new Date().toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
    setVarianceExpenseIncome(item);
    setVarianceExpenseAmount(Math.abs(variance));
    setVarianceExpenseForm({
      name: `Management Fee - ${propertyName} - ${currentMonth}`,
      category: 'MAINTENANCE',
      customCategoryName: '',
      isCreatingCustom: false,
    });
    setShowVarianceExpenseDialog(true);
  };

  // Create expense from variance
  const handleCreateVarianceExpense = async () => {
    if (!varianceExpenseIncome || !token) return;

    try {
      let categoryToUse = varianceExpenseForm.category;
      let customCategoryId: string | null = null;

      // If creating a custom category, create it first
      if (varianceExpenseForm.isCreatingCustom && varianceExpenseForm.customCategoryName) {
        const categoryResponse = await fetch('/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: varianceExpenseForm.customCategoryName,
            type: 'EXPENSE',
          }),
        });

        if (categoryResponse.ok) {
          const categoryResult = await categoryResponse.json();
          customCategoryId = categoryResult.data?.id;
          categoryToUse = 'OTHER'; // Use OTHER as the system category when custom is selected
          // Reload categories for future use
          loadExpenseCategories();
        } else {
          console.error('Failed to create custom category');
          return;
        }
      }

      // Create the expense
      const expenseData = {
        name: varianceExpenseForm.name,
        category: categoryToUse,
        customCategoryId,
        amount: varianceExpenseAmount,
        frequency: 'MONTHLY',
        sourceType: 'PROPERTY',
        propertyId: varianceExpenseIncome.propertyId,
        isTaxDeductible: true,
        isEssential: false,
        isRecurring: false, // One-time expense for this variance
      };

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(expenseData),
      });

      if (response.ok) {
        setShowVarianceExpenseDialog(false);
        setVarianceExpenseIncome(null);
        // Show success or navigate to expenses
        alert(`Expense "${varianceExpenseForm.name}" created successfully for ${formatCurrency(varianceExpenseAmount)}`);
      } else {
        console.error('Failed to create expense');
      }
    } catch (error) {
      console.error('Error creating variance expense:', error);
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
        const result = await response.json();
        const savedIncomeId = result.data?.id || result.id || editingId;

        // Link document if one was attached via FormDocumentUpload
        if (attachedDocumentId && savedIncomeId) {
          try {
            await fetch(`/api/documents/${attachedDocumentId}/link`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                entityType: 'INCOME',
                entityId: savedIncomeId,
              }),
            });
          } catch (linkError) {
            console.error('Error linking document to income:', linkError);
          }
        }

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
    setAttachedDocumentId(null);
    setAutoFilledFields([]);
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

  // formatCurrency imported from lib/utils/formatters
  // Frequency conversions use centralized toAnnual from lib/utils/frequencies
  const convertToMonthly = (amount: number, frequency: string) =>
    toAnnual(amount, frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL') / 12;

  const convertToAnnual = (amount: number, frequency: string) =>
    toAnnual(amount, frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');

  // Get effective (after-tax) amounts using shared calculator
  // This ensures income page and dashboard always show identical values
  const getEffectiveAnnualAmount = (item: Income): number => getNetAnnualIncome(item);
  const getEffectiveMonthlyAmount = (item: Income): number => getNetMonthlyIncome(item);

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
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3 text-right">Budget</th>
                    <th className="px-4 py-3 text-right">Net Monthly</th>
                    <th className="px-4 py-3 text-right">Actual Monthly</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredIncome.map((item) => {
                    // Use effective (after-tax for salary) amounts
                    const effectiveMonthly = getEffectiveMonthlyAmount(item);
                    const isSalaryWithTax = item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount;
                    // Phase 30: Budget vs Actual - use monthly average for comparison
                    const hasActual = item.hasTransactions && item.transactionCount && item.transactionCount > 0;
                    const actualMonthly = item.monthlyAverageActual || 0;
                    // Variance = Actual - Net Monthly (positive = above budget, negative = below)
                    const variance = hasActual ? actualMonthly - effectiveMonthly : 0;
                    const variancePercent = hasActual && effectiveMonthly > 0
                      ? (variance / effectiveMonthly) * 100
                      : 0;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleViewDetails(item)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {getIncomeTypeBadge(item.type)}
                            {item.property && (
                              <span className="text-blue-500">{item.property.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{item.frequency.toLowerCase()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{formatCurrency(item.amount)}</span>
                          {isSalaryWithTax && <span className="text-xs text-muted-foreground block">gross</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(effectiveMonthly)}</td>
                        <td className="px-4 py-3 text-right">
                          {hasActual ? (
                            <div>
                              <span className="font-medium text-green-600">
                                {formatCurrency(actualMonthly)}
                              </span>
                              <span className="text-xs text-muted-foreground block">
                                {item.transactionCount} txns
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No txns</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {hasActual ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                <span className="font-medium">
                                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                                </span>
                                <span className="text-xs block">
                                  {variance >= 0 ? '+' : ''}{variancePercent.toFixed(0)}%
                                </span>
                              </div>
                              {/* Show "Assign to Expense" button for negative variance on property income */}
                              {variance < 0 && item.propertyId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Assign variance to property expense"
                                  onClick={() => handleOpenVarianceExpense(item, variance)}
                                >
                                  <ArrowDownToLine className="h-4 w-4 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
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
                    <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalNetMonthly)}</td>
                    <td colSpan={3}></td>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-muted/50 rounded-lg text-xs">
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
                        <div className="col-span-3">Name</div>
                        <div className="col-span-1">Frequency</div>
                        <div className="col-span-2 text-right">Budget</div>
                        <div className="col-span-2 text-right">Net Monthly</div>
                        <div className="col-span-2 text-right">Actual Monthly</div>
                        <div className="col-span-1 text-right">Variance</div>
                        <div className="col-span-1 text-right">Actions</div>
                      </div>

                      {/* Income rows */}
                      {group.incomes.map((item) => {
                        // Use effective (after-tax for salary) amount
                        const effectiveMonthly = getEffectiveMonthlyAmount(item);
                        const isSalaryWithTax = item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount;
                        // Phase 30: Budget vs Actual - use monthly average
                        const hasActual = item.hasTransactions && item.transactionCount && item.transactionCount > 0;
                        const actualMonthly = item.monthlyAverageActual || 0;
                        // Variance = Actual - Net Monthly
                        const variance = hasActual ? actualMonthly - effectiveMonthly : 0;
                        const variancePercent = hasActual && effectiveMonthly > 0
                          ? (variance / effectiveMonthly) * 100
                          : 0;
                        return (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors items-center"
                          >
                            <div className="col-span-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{item.name}</span>
                                {item.frankingPercentage && item.frankingPercentage > 0 && (
                                  <span title={`${item.frankingPercentage}% Franked`}>
                                    <Percent className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                  </span>
                                )}
                              </div>
                              {viewMode === 'type' && item.property && (
                                <p className="text-xs text-blue-500 truncate">{item.property.name}</p>
                              )}
                              {viewMode === 'type' && item.investmentAccount && (
                                <p className="text-xs text-purple-500 truncate">{item.investmentAccount.name}</p>
                              )}
                            </div>
                            <div className="col-span-1">
                              <span className="text-sm capitalize">{item.frequency.toLowerCase()}</span>
                            </div>
                            <div className="col-span-2 text-right">
                              <span className="font-medium">{formatCurrency(item.amount)}</span>
                              {isSalaryWithTax && <span className="text-xs text-muted-foreground block">gross</span>}
                            </div>
                            <div className="col-span-2 text-right">
                              <span className="text-sm font-medium">{formatCurrency(effectiveMonthly)}</span>
                            </div>
                            <div className="col-span-2 text-right">
                              {hasActual ? (
                                <div>
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(actualMonthly)}
                                  </span>
                                  <span className="text-xs text-muted-foreground block">
                                    {item.transactionCount} txns
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No txns</span>
                              )}
                            </div>
                            <div className="col-span-1 text-right flex items-center justify-end gap-1">
                              {hasActual ? (
                                <>
                                  <span className={`text-sm font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {variance >= 0 ? '+' : ''}{variancePercent.toFixed(0)}%
                                  </span>
                                  {/* Show "Assign to Expense" button for negative variance on property income */}
                                  {variance < 0 && item.propertyId && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      title="Assign variance to property expense"
                                      onClick={(e) => { e.stopPropagation(); handleOpenVarianceExpense(item, variance); }}
                                    >
                                      <ArrowDownToLine className="h-3 w-3 text-orange-500" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                            <div className="col-span-1 flex justify-end gap-1">
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
            {/* Document Auto-Fill */}
            <FormDocumentUpload
              formType="income"
              propertyId={formData.propertyId || undefined}
              onFieldsExtracted={handleFieldsExtracted}
              onDocumentAttached={setAttachedDocumentId}
              disabled={isLoading}
            />
            {autoFilledFields.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Auto-filled {autoFilledFields.length} field(s). Review and adjust if needed.
              </p>
            )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        step="any"
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
                      step="any"
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Variance to Expense Dialog */}
      <Dialog open={showVarianceExpenseDialog} onOpenChange={setShowVarianceExpenseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-orange-500" />
              Assign Variance to Property Expense
            </DialogTitle>
            <DialogDescription>
              Create a tax-deductible expense from the income variance for {varianceExpenseIncome?.property?.name || 'this property'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Summary */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Property</p>
                    <p className="font-medium">{varianceExpenseIncome?.property?.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Variance Amount</p>
                    <p className="font-medium text-red-600">{formatCurrency(varianceExpenseAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expense Name */}
            <div className="space-y-2">
              <Label htmlFor="varianceExpenseName">Expense Name</Label>
              <Input
                id="varianceExpenseName"
                value={varianceExpenseForm.name}
                onChange={(e) => setVarianceExpenseForm({ ...varianceExpenseForm, name: e.target.value })}
                placeholder="e.g., Management Fee - Property Name"
              />
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="varianceExpenseCategory">Category</Label>
              {!varianceExpenseForm.isCreatingCustom ? (
                <div className="space-y-2">
                  <Select
                    value={varianceExpenseForm.category}
                    onValueChange={(value) => {
                      if (value === 'CREATE_CUSTOM') {
                        setVarianceExpenseForm({ ...varianceExpenseForm, isCreatingCustom: true });
                      } else {
                        setVarianceExpenseForm({ ...varianceExpenseForm, category: value });
                      }
                    }}
                  >
                    <SelectTrigger id="varianceExpenseCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Common property expense categories */}
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="INSURANCE">Insurance</SelectItem>
                      <SelectItem value="RATES">Rates & Taxes</SelectItem>
                      <SelectItem value="STRATA">Strata / Body Corporate</SelectItem>
                      <SelectItem value="LAND_TAX">Land Tax</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <Separator className="my-1" />
                      {/* Custom categories */}
                      {expenseCategories
                        .filter(cat => !cat.isSystem)
                        .map(cat => (
                          <SelectItem key={cat.id} value={cat.code}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      <Separator className="my-1" />
                      <SelectItem value="CREATE_CUSTOM">
                        <span className="flex items-center gap-2 text-blue-600">
                          <Plus className="h-3 w-3" />
                          Create Custom Category
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={varianceExpenseForm.customCategoryName}
                    onChange={(e) => setVarianceExpenseForm({ ...varianceExpenseForm, customCategoryName: e.target.value })}
                    placeholder="Enter custom category name"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVarianceExpenseForm({ ...varianceExpenseForm, isCreatingCustom: false, customCategoryName: '' })}
                  >
                    Cancel - use existing category
                  </Button>
                </div>
              )}
            </div>

            {/* Tax Deductible Notice */}
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <Info className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">
                This expense will be automatically marked as <strong>tax deductible</strong> and linked to the property.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowVarianceExpenseDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateVarianceExpense}
              disabled={!varianceExpenseForm.name || (varianceExpenseForm.isCreatingCustom && !varianceExpenseForm.customCategoryName)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Expense
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
