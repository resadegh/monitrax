'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Home, Landmark, Briefcase, Building2, DollarSign,
  Upload, FileText, X, Paperclip, Sparkles
} from 'lucide-react';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { DocumentCategory, LinkedEntityType } from '@/lib/documents/types';
import {
  getExpenseCategoryOptions,
  getDefaultExpenseCategory,
  type AssetType as CategoryAssetType,
  type ExpenseSourceType,
} from '@/lib/categoryFilters';
import { FormDocumentUpload, FieldMapping } from '@/components/documents';
import { formatCurrency } from '@/lib/utils/formatters';

// Types
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

type ExpenseCategory = 'HOUSING' | 'RENT' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SUBSCRIPTION' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'OTHER';
type ExpenseFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
type ExpenseSourceTypeValue = 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';

export interface Expense {
  id: string;
  name: string;
  vendorName: string | null;
  category: ExpenseCategory;
  sourceType: ExpenseSourceTypeValue;
  amount: number;
  frequency: ExpenseFrequency;
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
}

type ExpenseFormData = {
  name: string;
  vendorName: string;
  category: ExpenseCategory;
  sourceType: ExpenseSourceTypeValue;
  amount: number;
  frequency: ExpenseFrequency;
  isEssential: boolean;
  isTaxDeductible: boolean;
  propertyId: string | null;
  loanId: string | null;
  investmentAccountId: string | null;
  assetId: string | null;
};

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null; // For editing
  defaultPropertyId?: string | null; // Pre-select property when adding from property section
  token: string;
  onSuccess?: () => void;
}

const initialFormData: ExpenseFormData = {
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
};

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  defaultPropertyId,
  token,
  onSuccess,
}: ExpenseDialogProps) {
  const documentUpload = useDocumentUpload();

  const [formData, setFormData] = useState<ExpenseFormData>(initialFormData);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedDocumentId, setAttachedDocumentId] = useState<string | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);

  const isEditing = !!expense;

  // Handle auto-fill from document analysis
  const handleFieldsExtracted = useCallback((mappings: Record<string, FieldMapping>) => {
    const filledFields: string[] = [];
    const updates: Partial<ExpenseFormData> = {};

    // Map extracted fields to form data
    if (mappings.vendor?.value && !formData.vendorName) {
      updates.vendorName = String(mappings.vendor.value);
      filledFields.push('vendorName');
    }

    if (mappings.amount?.value && !formData.amount) {
      updates.amount = Number(mappings.amount.value);
      filledFields.push('amount');
    }

    if (mappings.description?.value && !formData.name) {
      updates.name = String(mappings.description.value);
      filledFields.push('name');
    }

    if (mappings.category?.value) {
      const categoryValue = String(mappings.category.value).toUpperCase();
      const validCategories = ['HOUSING', 'RATES', 'INSURANCE', 'MAINTENANCE', 'PERSONAL', 'UTILITIES', 'FOOD', 'TRANSPORT', 'ENTERTAINMENT', 'SUBSCRIPTION', 'STRATA', 'LAND_TAX', 'LOAN_INTEREST', 'REGISTRATION', 'MODIFICATIONS', 'OTHER'];
      if (validCategories.includes(categoryValue)) {
        updates.category = categoryValue as ExpenseCategory;
        filledFields.push('category');
      }
    }

    if (mappings.taxDeductible?.value !== undefined) {
      updates.isTaxDeductible = Boolean(mappings.taxDeductible.value);
      filledFields.push('isTaxDeductible');
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
      setAutoFilledFields(filledFields);
    }
  }, [formData.vendorName, formData.amount, formData.name]);

  // Load related data when dialog opens
  useEffect(() => {
    if (open && token) {
      loadRelatedData();
    }
  }, [open, token]);

  // Initialize form when dialog opens or expense changes
  useEffect(() => {
    if (open) {
      if (expense) {
        // Editing existing expense
        setFormData({
          name: expense.name,
          vendorName: expense.vendorName || '',
          category: expense.category,
          sourceType: expense.sourceType || 'GENERAL',
          amount: expense.amount,
          frequency: expense.frequency,
          isEssential: expense.isEssential,
          isTaxDeductible: expense.isTaxDeductible || false,
          propertyId: expense.propertyId,
          loanId: expense.loanId,
          investmentAccountId: expense.investmentAccountId,
          assetId: expense.assetId,
        });
      } else if (defaultPropertyId) {
        // Creating new expense with pre-selected property
        setFormData({
          ...initialFormData,
          sourceType: 'PROPERTY',
          propertyId: defaultPropertyId,
          isTaxDeductible: true,
          category: 'MAINTENANCE', // Default category for property expenses
        });
      } else {
        // Creating new expense from scratch
        setFormData(initialFormData);
      }
      setSelectedFile(null);
      setAttachedDocumentId(null);
      setAutoFilledFields([]);
    }
  }, [open, expense, defaultPropertyId]);

  const loadRelatedData = async () => {
    try {
      const [propsRes, loansRes, investRes, assetsRes] = await Promise.all([
        fetch('/api/properties', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/loans', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/investments/accounts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/assets', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (propsRes.ok) {
        const result = await propsRes.json();
        setProperties(result.data || result);
      }
      if (loansRes.ok) {
        const result = await loansRes.json();
        setLoans(result.data || result);
      }
      if (investRes.ok) {
        const result = await investRes.json();
        setInvestmentAccounts(result.data || result);
      }
      if (assetsRes.ok) {
        const result = await assetsRes.json();
        setAssets(result.data || result);
      }
    } catch (error) {
      console.error('Error loading related data:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Map expense category to document category
  const getDocumentCategory = (expenseCategory: string): DocumentCategory => {
    const categoryMap: Record<string, DocumentCategory> = {
      'INSURANCE': DocumentCategory.INSURANCE,
      'RATES': DocumentCategory.TAX,
      'LAND_TAX': DocumentCategory.TAX,
      'LOAN_INTEREST': DocumentCategory.MORTGAGE,
      'HOUSING': DocumentCategory.RECEIPT,
      'MAINTENANCE': DocumentCategory.RECEIPT,
      'PERSONAL': DocumentCategory.RECEIPT,
      'UTILITIES': DocumentCategory.STATEMENT,
      'FOOD': DocumentCategory.RECEIPT,
      'TRANSPORT': DocumentCategory.RECEIPT,
      'ENTERTAINMENT': DocumentCategory.RECEIPT,
      'STRATA': DocumentCategory.INVOICE,
      'REGISTRATION': DocumentCategory.RECEIPT,
      'MODIFICATIONS': DocumentCategory.RECEIPT,
      'OTHER': DocumentCategory.OTHER,
    };
    return categoryMap[expenseCategory] || DocumentCategory.RECEIPT;
  };

  const uploadReceiptFile = async (expenseId: string, file: File, expenseName?: string, expenseCategory?: string) => {
    setUploadingFile(true);
    try {
      const documentCategory = expenseCategory ? getDocumentCategory(expenseCategory) : DocumentCategory.RECEIPT;
      const result = await documentUpload.upload(file, {
        category: documentCategory,
        description: `${expenseCategory || 'Receipt'} - ${expenseName || 'expense'}`,
        links: [{ entityType: LinkedEntityType.EXPENSE, entityId: expenseId }],
        entityName: expenseName,
      });
      if (!result.success) {
        console.error('Failed to upload receipt:', result.error);
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const url = isEditing ? `/api/expenses/${expense.id}` : '/api/expenses';
    const method = isEditing ? 'PUT' : 'POST';

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
        const savedExpenseId = result.data?.id || result.id || expense?.id;

        // Link document if one was attached via FormDocumentUpload
        if (attachedDocumentId && savedExpenseId) {
          try {
            await fetch(`/api/documents/${attachedDocumentId}/link`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                entityType: 'EXPENSE',
                entityId: savedExpenseId,
              }),
            });
          } catch (linkError) {
            console.error('Failed to link document to expense:', linkError);
          }
        }

        // Legacy: Upload file if one was selected the old way
        if (selectedFile && savedExpenseId) {
          await uploadReceiptFile(savedExpenseId, selectedFile, formData.name, formData.category);
        }

        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setIsLoading(false);
    }
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

  // Handle source type change
  const handleSourceTypeChange = (value: ExpenseSourceTypeValue) => {
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

  // Handle asset selection
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the expense details below.' : 'Enter the details for your new expense.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Property Selector */}
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
            </div>
          )}

          {/* Loan Selector */}
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
            </div>
          )}

          {/* Investment Account Selector */}
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
            </div>
          )}

          {/* Asset Selector */}
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
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as ExpenseCategory })}
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
              onValueChange={(value) => setFormData({ ...formData, frequency: value as ExpenseFrequency })}
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

          {/* Smart Document Upload - Phase 26 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Smart Document Scan
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </Label>
              {autoFilledFields.length > 0 && (
                <span className="text-xs text-green-600">
                  {autoFilledFields.length} fields auto-filled
                </span>
              )}
            </div>
            <FormDocumentUpload
              formType="expense"
              propertyId={formData.propertyId || undefined}
              onFieldsExtracted={handleFieldsExtracted}
              onDocumentAttached={setAttachedDocumentId}
              disabled={isLoading}
            />
            {autoFilledFields.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Review the auto-filled values above and adjust if needed.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || uploadingFile}>
              {uploadingFile ? 'Uploading...' : isLoading ? 'Saving...' : isEditing ? 'Update Expense' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
