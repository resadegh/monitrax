'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Plus, Edit2, Trash2, TrendingDown, Calendar, AlertCircle, Home, Briefcase, Building2, Landmark, DollarSign, Receipt, Store, Eye, Link2, Upload, Paperclip, FileText, X, ChevronDown, ChevronUp, Grid3X3, FolderOpen, LayoutGrid, Zap, List } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import { DocumentCategory, LinkedEntityType } from '@/lib/documents/types';
import { ExpenseWizard } from '@/components/ExpenseWizard';
import {
  getExpenseCategoryOptions,
  getDefaultExpenseCategory,
  isValidExpenseCategory,
  type AssetType as CategoryAssetType,
  type ExpenseSourceType,
  type ExpenseCategory,
} from '@/lib/categoryFilters';
import { ListFilter, expenseFilterConfigs } from '@/components/ListFilter';

type ViewMode = 'category' | 'property' | 'all' | 'list';

interface ExpenseGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  expenses: Expense[];
  totalMonthly: number;
  count: number;
}

interface AttachedDocument {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: string;
  uploadedAt: string;
}

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
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  interestRateAnnual: number;
  isInterestOnly: boolean;
  property?: { id: string; name: string } | null;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  platform: string | null;
}

interface Asset {
  id: string;
  name: string;
  type: string;
}

interface Expense {
  id: string;
  name: string;
  vendorName: string | null;
  category: 'HOUSING' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'OTHER';
  sourceType: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  isEssential: boolean;
  isTaxDeductible: boolean;
  propertyId: string | null;
  loanId: string | null;
  investmentAccountId: string | null;
  assetId: string | null;
  property?: Property | null;
  loan?: Loan | null;
  investmentAccount?: InvestmentAccount | null;
  asset?: Asset | null;
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
  assetId: string | null;
};

function ExpensesPageContent() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false);
    openLinkedEntity(entity);
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
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
    assetId: null,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showWizard, setShowWizard] = useState(false);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (token) {
      loadExpenses();
      loadProperties();
      loadLoans();
      loadInvestmentAccounts();
      loadAssets();
    }
  }, [token]);

  const loadExpenses = async () => {
    try {
      const response = await fetch('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setExpenses(result.data || result);
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
        const result = await response.json();
        setProperties(result.data || result);
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
        const result = await response.json();
        setLoans(result.data || result);
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
        const result = await response.json();
        setInvestmentAccounts(result.data || result);
      }
    } catch (error) {
      console.error('Error loading investment accounts:', error);
    }
  };

  const loadAssets = async () => {
    try {
      const response = await fetch('/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setAssets(result.data || result);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  const loadAttachedDocuments = async (expenseId: string) => {
    try {
      const response = await fetch(`/api/documents?entityType=EXPENSE&entityId=${expenseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setAttachedDocuments(result.documents || []);
      }
    } catch (error) {
      console.error('Error loading attached documents:', error);
      setAttachedDocuments([]);
    }
  };

  const uploadReceiptFile = async (expenseId: string, file: File) => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', DocumentCategory.RECEIPT);
      formData.append('description', `Receipt for ${formData.get('name') || 'expense'}`);
      formData.append('links', JSON.stringify([
        { entityType: LinkedEntityType.EXPENSE, entityId: expenseId }
      ]));

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        setSelectedFile(null);
        // Reload documents if viewing details
        if (selectedExpense?.id === expenseId) {
          await loadAttachedDocuments(expenseId);
        }
      } else {
        const error = await response.json();
        console.error('Failed to upload receipt:', error);
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleViewDetails = (item: Expense) => {
    setSelectedExpense(item);
    setShowDetailDialog(true);
    loadAttachedDocuments(item.id);
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
      assetId: formData.sourceType === 'ASSET' ? formData.assetId : null,
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
        const result = await response.json();
        const savedExpenseId = result.data?.id || result.id || editingId;

        // Upload file if one was selected
        if (selectedFile && savedExpenseId) {
          await uploadReceiptFile(savedExpenseId, selectedFile);
        }

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
      assetId: null,
    });
    setSelectedFile(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      assetId: item.assetId,
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
      case 'QUARTERLY': return amount * 4 / 12;
      case 'ANNUAL': return amount / 12;
      default: return amount;
    }
  };

  // Convert loan repayment to monthly
  const convertLoanRepaymentToMonthly = (amount: number, frequency: Loan['repaymentFrequency']): number => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52 / 12;
      case 'FORTNIGHTLY': return amount * 26 / 12;
      case 'MONTHLY': return amount;
      default: return amount;
    }
  };

  const totalMonthly = filteredExpenses.reduce((sum, e) => sum + convertToMonthly(e.amount, e.frequency), 0);
  const allTotalMonthly = expenses.reduce((sum, e) => sum + convertToMonthly(e.amount, e.frequency), 0);

  // Calculate total loan repayments (monthly)
  const totalLoanRepaymentsMonthly = loans.reduce((sum, loan) =>
    sum + convertLoanRepaymentToMonthly(loan.minRepayment, loan.repaymentFrequency), 0
  );

  // Total outgoings = expenses + loan repayments
  const totalOutgoingsMonthly = totalMonthly + totalLoanRepaymentsMonthly;
  const allTotalOutgoingsMonthly = allTotalMonthly + totalLoanRepaymentsMonthly;

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

  // Category info with icons and colors
  const categoryInfo: Record<Expense['category'], { label: string; icon: React.ReactNode; color: string }> = {
    HOUSING: { label: 'Housing', icon: <Home className="h-5 w-5" />, color: 'text-blue-500' },
    RATES: { label: 'Rates', icon: <Building2 className="h-5 w-5" />, color: 'text-amber-500' },
    INSURANCE: { label: 'Insurance', icon: <Receipt className="h-5 w-5" />, color: 'text-green-500' },
    MAINTENANCE: { label: 'Maintenance', icon: <TrendingDown className="h-5 w-5" />, color: 'text-orange-500' },
    PERSONAL: { label: 'Personal', icon: <DollarSign className="h-5 w-5" />, color: 'text-purple-500' },
    UTILITIES: { label: 'Utilities', icon: <Landmark className="h-5 w-5" />, color: 'text-cyan-500' },
    FOOD: { label: 'Food', icon: <Store className="h-5 w-5" />, color: 'text-rose-500' },
    TRANSPORT: { label: 'Transport', icon: <Briefcase className="h-5 w-5" />, color: 'text-indigo-500' },
    ENTERTAINMENT: { label: 'Entertainment', icon: <CreditCard className="h-5 w-5" />, color: 'text-pink-500' },
    STRATA: { label: 'Strata', icon: <Building2 className="h-5 w-5" />, color: 'text-teal-500' },
    LAND_TAX: { label: 'Land Tax', icon: <Landmark className="h-5 w-5" />, color: 'text-red-500' },
    LOAN_INTEREST: { label: 'Loan Interest', icon: <Landmark className="h-5 w-5" />, color: 'text-red-600' },
    REGISTRATION: { label: 'Registration', icon: <FileText className="h-5 w-5" />, color: 'text-sky-500' },
    MODIFICATIONS: { label: 'Modifications', icon: <TrendingDown className="h-5 w-5" />, color: 'text-violet-500' },
    OTHER: { label: 'Other', icon: <CreditCard className="h-5 w-5" />, color: 'text-gray-500' },
  };

  // Group expenses by category
  const groupByCategory = (): ExpenseGroup[] => {
    const groups: Record<string, Expense[]> = {};
    filteredExpenses.forEach(exp => {
      if (!groups[exp.category]) {
        groups[exp.category] = [];
      }
      groups[exp.category].push(exp);
    });

    return Object.entries(groups).map(([category, exps]) => {
      const info = categoryInfo[category as Expense['category']] || categoryInfo.OTHER;
      const totalMonthly = exps.reduce((sum, e) => sum + convertToMonthly(e.amount, e.frequency), 0);
      return {
        id: `category-${category}`,
        name: info.label,
        icon: <span className={info.color}>{info.icon}</span>,
        expenses: exps,
        totalMonthly,
        count: exps.length,
      };
    }).sort((a, b) => b.totalMonthly - a.totalMonthly);
  };

  // Group expenses by property (or General for non-property expenses)
  const groupByProperty = (): ExpenseGroup[] => {
    const groups: Record<string, { name: string; expenses: Expense[] }> = {
      general: { name: 'General Expenses', expenses: [] },
    };

    // Add property groups
    properties.forEach(prop => {
      groups[`property-${prop.id}`] = { name: prop.name, expenses: [] };
    });

    // Distribute expenses
    filteredExpenses.forEach(exp => {
      if (exp.sourceType === 'PROPERTY' && exp.propertyId) {
        const key = `property-${exp.propertyId}`;
        if (groups[key]) {
          groups[key].expenses.push(exp);
        } else {
          groups.general.expenses.push(exp);
        }
      } else {
        groups.general.expenses.push(exp);
      }
    });

    return Object.entries(groups)
      .filter(([_, group]) => group.expenses.length > 0)
      .map(([key, group]) => {
        const totalMonthly = group.expenses.reduce((sum, e) => sum + convertToMonthly(e.amount, e.frequency), 0);
        const isProperty = key.startsWith('property-');
        return {
          id: key,
          name: group.name,
          icon: isProperty
            ? <Home className="h-5 w-5 text-blue-500" />
            : <DollarSign className="h-5 w-5 text-gray-500" />,
          expenses: group.expenses,
          totalMonthly,
          count: group.expenses.length,
        };
      })
      .sort((a, b) => b.totalMonthly - a.totalMonthly);
  };

  const expenseGroups = viewMode === 'category' ? groupByCategory() : viewMode === 'property' ? groupByProperty() : [];

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
      REGISTRATION: { variant: 'default', label: 'Registration' },
      MODIFICATIONS: { variant: 'secondary', label: 'Modifications' },
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
      case 'ASSET':
        return <Building2 className="h-4 w-4 text-green-500" />;
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
    if (item.sourceType === 'ASSET' && item.asset) {
      return item.asset.name;
    }
    return 'General';
  };

  // Get the selected asset type for category filtering
  const getSelectedAssetType = (): CategoryAssetType | null => {
    if (formData.sourceType !== 'ASSET' || !formData.assetId) return null;
    const selectedAsset = assets.find(a => a.id === formData.assetId);
    return selectedAsset?.type as CategoryAssetType || null;
  };

  // Get filtered category options based on source type and asset type
  const filteredCategoryOptions = useMemo(() => {
    const assetType = getSelectedAssetType();
    return getExpenseCategoryOptions(formData.sourceType as ExpenseSourceType, assetType);
  }, [formData.sourceType, formData.assetId, assets]);

  // Auto-set defaults based on source type selection
  const handleSourceTypeChange = (value: Expense['sourceType']) => {
    const updates: Partial<ExpenseFormData> = { sourceType: value };

    // Clear all foreign keys first
    updates.propertyId = null;
    updates.loanId = null;
    updates.investmentAccountId = null;
    updates.assetId = null;

    // Set default category and tax deductibility based on source type
    updates.category = getDefaultExpenseCategory(value as ExpenseSourceType);

    if (value === 'PROPERTY') {
      updates.isTaxDeductible = true;
    } else if (value === 'LOAN') {
      updates.isTaxDeductible = true;
    } else if (value === 'GENERAL') {
      updates.isTaxDeductible = false;
    }

    setFormData({ ...formData, ...updates });
  };

  // Handle asset selection - update category based on asset type
  const handleAssetChange = (assetId: string | null) => {
    const selectedAsset = assetId ? assets.find(a => a.id === assetId) : null;
    const assetType = selectedAsset?.type as CategoryAssetType || null;
    const newCategory = getDefaultExpenseCategory('ASSET', assetType);

    setFormData({
      ...formData,
      assetId: assetId || null,
      category: newCategory,
    });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Expenses"
        description={`Manage your expenses • Total outgoings: ${formatCurrency(allTotalOutgoingsMonthly)}/month`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowWizard(true)}>
              <Zap className="mr-2 h-4 w-4" />
              Quick Add
            </Button>
            <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </div>
        }
      />

      {/* Search and Filter */}
      {expenses.length > 0 && (
        <ListFilter
          data={expenses}
          searchFields={['name', 'vendorName']}
          searchPlaceholder="Search expenses..."
          filters={expenseFilterConfigs}
          onFilteredData={setFilteredExpenses}
          className="mb-4"
        />
      )}

      {/* View Mode Selector */}
      {expenses.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">Group by:</span>
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'category' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('category')}
            >
              <FolderOpen className="h-4 w-4" />
              Category
            </Button>
            <Button
              variant={viewMode === 'property' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('property')}
            >
              <Home className="h-4 w-4" />
              Property
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

      {/* Outgoings Summary */}
      {(expenses.length > 0 || loans.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Regular Expenses */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Regular Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalMonthly)}</p>
                  <p className="text-xs text-muted-foreground">{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500/20" />
              </div>
            </CardContent>
          </Card>

          {/* Loan Repayments */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Loan Repayments</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalLoanRepaymentsMonthly)}</p>
                  <p className="text-xs text-muted-foreground">{loans.length} loan{loans.length !== 1 ? 's' : ''}</p>
                </div>
                <Landmark className="h-8 w-8 text-orange-500/20" />
              </div>
            </CardContent>
          </Card>

          {/* Total Outgoings */}
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Outgoings</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(totalOutgoingsMonthly)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(totalOutgoingsMonthly * 12)}/year</p>
                </div>
                <DollarSign className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loan Repayments Detail */}
      {loans.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-5 w-5 text-orange-500" />
              Loan Repayments
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {loans.map((loan) => {
                const monthlyRepayment = convertLoanRepaymentToMonthly(loan.minRepayment, loan.repaymentFrequency);
                return (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Landmark className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">{loan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {loan.property?.name || loan.type} • {loan.isInterestOnly ? 'Interest only' : 'P&I'} • {loan.interestRateAnnual}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{formatCurrency(monthlyRepayment)}/mo</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(loan.minRepayment)}/{loan.repaymentFrequency.toLowerCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 mt-2 border-t">
                <p className="font-medium text-muted-foreground">Total Loan Repayments</p>
                <p className="font-bold text-orange-600">{formatCurrency(totalLoanRepaymentsMonthly)}/mo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
      ) : viewMode === 'list' ? (
        /* List view - compact table format */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3 text-right">Monthly</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredExpenses.map((item) => {
                    const monthlyAmount = convertToMonthly(item.amount, item.frequency);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleViewDetails(item)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.name}</div>
                          {item.vendorName && (
                            <div className="text-xs text-muted-foreground">{item.vendorName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">{getCategoryBadge(item.category)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getSourceTypeIcon(item.sourceType || 'GENERAL')}
                            <span className="text-sm">{getSourceLabel(item)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{item.frequency.toLowerCase()}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(monthlyAmount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {item.isTaxDeductible && (
                              <span title="Tax deductible">
                                <Receipt className="h-4 w-4 text-green-500" />
                              </span>
                            )}
                            {!item.isEssential && (
                              <span title="Non-essential">
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              </span>
                            )}
                          </div>
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
                    <td colSpan={5} className="px-4 py-3 text-right">Total Monthly:</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totalMonthly)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'all' ? (
        /* All expenses view - individual tiles */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredExpenses.map((item) => {
            const monthlyAmount = convertToMonthly(item.amount, item.frequency);

            return (
              <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(item)}>
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
      ) : (
        /* Grouped view - expandable group tiles */
        <div className="space-y-4">
          {expenseGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const deductibleCount = group.expenses.filter(e => e.isTaxDeductible).length;
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
                          {group.count} expense{group.count !== 1 ? 's' : ''}
                          {deductibleCount > 0 && (
                            <span className="ml-2 text-green-600">
                              • {deductibleCount} tax deductible
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-red-600">{formatCurrency(group.totalMonthly)}</p>
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
                        <div className="col-span-2">Monthly</div>
                        <div className="col-span-2 text-right">Actions</div>
                      </div>

                      {/* Expense rows */}
                      {group.expenses.map((item) => {
                        const monthlyAmount = convertToMonthly(item.amount, item.frequency);
                        return (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors items-center"
                          >
                            <div className="col-span-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{item.name}</span>
                                {item.isTaxDeductible && (
                                  <span title="Tax deductible">
                                    <Receipt className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  </span>
                                )}
                                {!item.isEssential && (
                                  <span title="Non-essential">
                                    <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                  </span>
                                )}
                              </div>
                              {item.vendorName && (
                                <p className="text-xs text-muted-foreground truncate">{item.vendorName}</p>
                              )}
                              {viewMode === 'category' && item.property && (
                                <p className="text-xs text-blue-500 truncate">{item.property.name}</p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-sm capitalize">{item.frequency.toLowerCase()}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-sm">{formatCurrency(monthlyAmount)}</span>
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
                  <SelectItem value="ASSET">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-green-500" />
                      Asset Expense
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

            {/* Asset Selector - shown when sourceType is ASSET */}
            {formData.sourceType === 'ASSET' && (
              <div className="space-y-2">
                <Label htmlFor="assetId">Linked Asset</Label>
                <Select
                  value={formData.assetId || ''}
                  onValueChange={(value) => handleAssetChange(value || null)}
                >
                  <SelectTrigger id="assetId">
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.length === 0 ? (
                      <SelectItem value="" disabled>No assets available</SelectItem>
                    ) : (
                      assets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {asset.name}
                            <span className="text-xs text-muted-foreground">({asset.type})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {assets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add assets first to link asset expenses.
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
                    {filteredCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.sourceType !== 'GENERAL' && (
                  <p className="text-xs text-muted-foreground">
                    Showing categories relevant to {formData.sourceType.toLowerCase()} expenses
                    {formData.sourceType === 'ASSET' && formData.assetId && (
                      <> ({assets.find(a => a.id === formData.assetId)?.type?.toLowerCase()})</>
                    )}
                  </p>
                )}
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
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
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

            {/* Receipt Upload Section */}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attach Receipt (optional)
              </Label>
              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload receipt or invoice
                    </span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Supported: Images, PDF, Word documents
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploadingFile}>
                {uploadingFile ? 'Uploading...' : editingId ? 'Update Expense' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              {selectedExpense?.name}
            </DialogTitle>
            <DialogDescription>
              Expense details and linked data
            </DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents" className="gap-1">
                  <Paperclip className="h-3 w-3" />
                  Receipts {attachedDocuments.length > 0 && `(${attachedDocuments.length})`}
                </TabsTrigger>
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Amount</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedExpense.amount)}</p>
                      <p className="text-sm text-muted-foreground capitalize">{selectedExpense.frequency.toLowerCase()}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Equivalent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(convertToMonthly(selectedExpense.amount, selectedExpense.frequency))}</p>
                      <p className="text-sm text-muted-foreground">per month</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Annual Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(convertToMonthly(selectedExpense.amount, selectedExpense.frequency) * 12)}</p>
                      <p className="text-sm text-muted-foreground">per year</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getCategoryBadge(selectedExpense.category)}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Expense Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source</span>
                      <div className="flex items-center gap-2">
                        {getSourceTypeIcon(selectedExpense.sourceType || 'GENERAL')}
                        <span className="font-medium">{getSourceLabel(selectedExpense)}</span>
                      </div>
                    </div>
                    {selectedExpense.vendorName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vendor</span>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedExpense.vendorName}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency</span>
                      <span className="font-medium capitalize">{selectedExpense.frequency.toLowerCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Essential</span>
                      <span className="font-medium">{selectedExpense.isEssential ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Deductible</span>
                      <span className={`font-medium ${selectedExpense.isTaxDeductible ? 'text-green-600' : ''}`}>
                        {selectedExpense.isTaxDeductible ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {selectedExpense.property && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Home className="h-4 w-4 text-blue-500" />
                        Linked Property
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedExpense.property.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{selectedExpense.property.type?.toLowerCase() || 'Property'}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedExpense.loan && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Landmark className="h-4 w-4 text-orange-500" />
                        Linked Loan
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedExpense.loan.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(selectedExpense.loan.principal)} principal</p>
                    </CardContent>
                  </Card>
                )}

                {selectedExpense.investmentAccount && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-purple-500" />
                        Linked Investment Account
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedExpense.investmentAccount.name}</p>
                      {selectedExpense.investmentAccount.platform && (
                        <p className="text-sm text-muted-foreground">{selectedExpense.investmentAccount.platform}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-4 space-y-4">
                {attachedDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <Paperclip className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No receipts attached</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Edit this expense to attach a receipt
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachedDocuments.map((doc) => (
                      <Card key={doc.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.originalFilename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.size)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Quick upload while viewing */}
                <div className="border-t pt-4">
                  <Label className="text-sm text-muted-foreground mb-2 block">Add another receipt</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && selectedExpense) {
                          await uploadReceiptFile(selectedExpense.id, file);
                          e.target.value = '';
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploadingFile}
                    />
                    <div className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                      {uploadingFile ? (
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Upload receipt</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedExpense._links?.related || []}
                  missingLinks={selectedExpense._meta?.missingLinks || []}
                  entityType="expense"
                  entityName={selectedExpense.name}
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
            <Button onClick={() => { setShowDetailDialog(false); if (selectedExpense) handleEdit(selectedExpense); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Wizard */}
      <ExpenseWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        properties={properties}
        token={token || ''}
        onSuccess={loadExpenses}
      />
    </DashboardLayout>
  );
}

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <ExpensesPageContent />
    </Suspense>
  );
}
