/**
 * Create Expense from Recurring Payment Dialog
 * Phase 29 - Expense Linking
 *
 * Pre-fills expense form with data from a detected recurring payment.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  Home,
  Landmark,
  Briefcase,
  Building2,
  Sparkles,
} from 'lucide-react';
import { suggestCategory, mapPatternToFrequency } from '@/lib/recurring/expenseMatcher';
import type { RecurringPayment } from '@/types/recurring';

interface Property {
  id: string;
  name: string;
}

interface Loan {
  id: string;
  name: string;
}

interface InvestmentAccount {
  id: string;
  name: string;
  platform: string | null;
}

interface Asset {
  id: string;
  name: string;
  type: string;
}

type ExpenseCategory = 'HOUSING' | 'RENT' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SUBSCRIPTION' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'OTHER';
type ExpenseFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
type ExpenseSourceType = 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';

interface CreateExpenseFromRecurringProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringPayment: RecurringPayment | null;
  token: string;
  onSuccess?: () => void;
}

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'SUBSCRIPTION', label: 'Subscription' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'RATES', label: 'Rates' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'FOOD', label: 'Food' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'STRATA', label: 'Strata' },
  { value: 'LAND_TAX', label: 'Land Tax' },
  { value: 'LOAN_INTEREST', label: 'Loan Interest' },
  { value: 'OTHER', label: 'Other' },
];

export function CreateExpenseFromRecurring({
  open,
  onOpenChange,
  recurringPayment,
  token,
  onSuccess,
}: CreateExpenseFromRecurringProps) {
  const [formData, setFormData] = useState({
    name: '',
    vendorName: '',
    category: 'OTHER' as ExpenseCategory,
    sourceType: 'GENERAL' as ExpenseSourceType,
    amount: 0,
    frequency: 'MONTHLY' as ExpenseFrequency,
    isEssential: true,
    isTaxDeductible: false,
    propertyId: null as string | null,
    loanId: null as string | null,
    investmentAccountId: null as string | null,
    assetId: null as string | null,
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedCategoryUsed, setSuggestedCategoryUsed] = useState(false);

  // Pre-fill form when recurring payment changes
  useEffect(() => {
    if (recurringPayment) {
      const suggested = suggestCategory(recurringPayment.merchantStandardised) as ExpenseCategory;
      const frequency = mapPatternToFrequency(recurringPayment.pattern);

      setFormData({
        name: recurringPayment.merchantStandardised,
        vendorName: recurringPayment.merchantStandardised,
        category: suggested,
        sourceType: 'GENERAL',
        amount: recurringPayment.expectedAmount,
        frequency: frequency,
        isEssential: true,
        isTaxDeductible: false,
        propertyId: null,
        loanId: null,
        investmentAccountId: null,
        assetId: null,
      });
      setSuggestedCategoryUsed(suggested !== 'OTHER');
    }
  }, [recurringPayment]);

  // Load related entities
  useEffect(() => {
    if (open && token) {
      loadRelatedData();
    }
  }, [open, token]);

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

  const handleSourceTypeChange = (value: ExpenseSourceType) => {
    setFormData({
      ...formData,
      sourceType: value,
      propertyId: null,
      loanId: null,
      investmentAccountId: null,
      assetId: null,
      isTaxDeductible: value === 'PROPERTY' || value === 'LOAN',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringPayment) return;

    setIsLoading(true);
    try {
      // Create expense and link to recurring payment in one request
      const response = await fetch(`/api/recurring-payments/${recurringPayment.id}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          createExpense: true,
          name: formData.name,
          vendorName: formData.vendorName,
          category: formData.category,
          sourceType: formData.sourceType,
          amount: formData.amount,
          frequency: formData.frequency,
          isEssential: formData.isEssential,
          isTaxDeductible: formData.isTaxDeductible,
          propertyId: formData.sourceType === 'PROPERTY' ? formData.propertyId : null,
          loanId: formData.sourceType === 'LOAN' ? formData.loanId : null,
          investmentAccountId: formData.sourceType === 'INVESTMENT' ? formData.investmentAccountId : null,
          assetId: formData.sourceType === 'ASSET' ? formData.assetId : null,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        console.error('Failed to create expense:', error);
        alert(error.error || 'Failed to create expense');
      }
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!recurringPayment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Expense from Recurring Payment</DialogTitle>
          <DialogDescription>
            Add this detected recurring payment to your tracked expenses.
          </DialogDescription>
        </DialogHeader>

        {/* Pre-filled Info Banner */}
        <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium text-blue-800">Pre-filled from detected payment</span>
            <p className="text-blue-600 mt-0.5">
              {recurringPayment.merchantStandardised} - ${recurringPayment.expectedAmount.toFixed(2)} {recurringPayment.pattern.toLowerCase()}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Expense name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendorName">Vendor/Payee</Label>
              <Input
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Vendor name"
              />
            </div>
          </div>

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

          {/* Entity Selectors */}
          {formData.sourceType === 'PROPERTY' && properties.length > 0 && (
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
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.sourceType === 'LOAN' && loans.length > 0 && (
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
                  {loans.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {loan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.sourceType === 'INVESTMENT' && investmentAccounts.length > 0 && (
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
                  {investmentAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.sourceType === 'ASSET' && assets.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assetId">Linked Asset</Label>
              <Select
                value={formData.assetId || ''}
                onValueChange={(value) => setFormData({ ...formData, assetId: value || null })}
              >
                <SelectTrigger id="assetId">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="category">Category</Label>
                {suggestedCategoryUsed && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Suggested
                  </Badge>
                )}
              </div>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as ExpenseCategory })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
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
                <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                <SelectItem value="ANNUAL">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isEssential"
                checked={formData.isEssential}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isEssential: checked as boolean })
                }
              />
              <Label htmlFor="isEssential" className="text-sm font-normal cursor-pointer">
                This is an essential expense
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isTaxDeductible"
                checked={formData.isTaxDeductible}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isTaxDeductible: checked as boolean })
                }
              />
              <Label htmlFor="isTaxDeductible" className="text-sm font-normal cursor-pointer">
                This expense is tax deductible
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create & Link Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
