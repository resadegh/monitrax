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
import {
  Home, Plus, Edit2, Trash2, TrendingUp, TrendingDown,
  Landmark, DollarSign, Receipt, Calendar, Building2,
  ChevronRight, Percent, PiggyBank, FileText, Eye, Link2, Lightbulb,
  LayoutGrid, List, KeyRound, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/utils/formatters';
import { toAnnual } from '@/lib/utils/frequencies';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import EntityStrategyTab from '@/components/strategy/EntityStrategyTab';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import { ListFilter, propertyFilterConfigs } from '@/components/ListFilter';
import { ExpenseDialog } from '@/components/ExpenseDialog';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { PropertyMap } from '@/components/google-maps';

interface Loan {
  id: string;
  name: string;
  principal: number;
  interestRateAnnual: number;
  rateType: string;
  isInterestOnly: boolean;
  minRepayment: number;
  repaymentFrequency: string;
  // Budget vs Actual fields
  budgetAmount?: number;
  actualFromTransactions?: number | null;
  currentMonthActual?: number | null;
  monthlyAverageActual?: number | null;
  transactionCount?: number;
  hasTransactions?: boolean;
}

interface Income {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  // Budget vs Actual fields
  budgetAmount?: number;
  actualFromTransactions?: number | null;
  currentMonthActual?: number | null;
  monthlyAverageActual?: number | null;
  transactionCount?: number;
  hasTransactions?: boolean;
}

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
  // Budget vs Actual fields
  budgetAmount?: number;
  actualFromTransactions?: number | null;
  currentMonthActual?: number | null;
  monthlyAverageActual?: number | null;
  transactionCount?: number;
  hasTransactions?: boolean;
}

interface DepreciationSchedule {
  id: string;
  category: string;
  assetName: string;
  cost: number;
  rate: number;
  method: string;
}

interface Property {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  address: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
  // Location data (Google Maps)
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  loans?: Loan[];
  income?: Income[];
  expenses?: Expense[];
  depreciationSchedules?: DepreciationSchedule[];
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

type PropertyFormData = {
  name: string;
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  address: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
  // Location data
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  // Rental property fields
  rentAmount?: number;
  rentFrequency?: string;
};

type ViewMode = 'tiles' | 'list';

function PropertiesPageContent() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [expensePropertyId, setExpensePropertyId] = useState<string | null>(null);
  // Budget vs Actual: Toggle between monthly and annual view
  const [financialViewMode, setFinancialViewMode] = useState<'monthly' | 'annual'>('monthly');

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false); // Close current dialog
    openLinkedEntity(entity);
  };

  // Handler for adding expense from property section
  const handleAddExpenseForProperty = (propertyId: string) => {
    setExpensePropertyId(propertyId);
    setShowExpenseDialog(true);
  };

  // Callback when expense is added successfully
  const handleExpenseSuccess = async () => {
    // Reload the property detail to show the new expense
    if (selectedProperty) {
      await loadPropertyDetail(selectedProperty.id);
    }
  };
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    type: 'HOME',
    address: '',
    purchasePrice: 0,
    purchaseDate: '',
    currentValue: 0,
    valuationDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (token) {
      loadProperties();
    }
  }, [token]);

  const loadProperties = async () => {
    try {
      const response = await fetch('/api/properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        // Handle GRDCS format: { data: [...], _meta: {...} }
        const data = result.data || result;
        setProperties(data);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPropertyDetail = async (propertyId: string) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedProperty(data);
        setShowDetailDialog(true);
      }
    } catch (error) {
      console.error('Error loading property detail:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingId ? `/api/properties/${editingId}` : '/api/properties';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          purchasePrice: Number(formData.purchasePrice),
          currentValue: Number(formData.currentValue),
        }),
      });

      if (response.ok) {
        await loadProperties();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving property:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'HOME',
      address: '',
      purchasePrice: 0,
      purchaseDate: '',
      currentValue: 0,
      valuationDate: new Date().toISOString().split('T')[0],
      latitude: undefined,
      longitude: undefined,
      googlePlaceId: undefined,
      suburb: undefined,
      state: undefined,
      postcode: undefined,
      rentAmount: undefined,
      rentFrequency: 'WEEKLY',
    });
  };

  // Handle address selection from autocomplete
  const handleAddressSelect = (address: {
    formatted_address: string;
    suburb?: string;
    state?: string;
    stateShort?: string;
    postcode?: string;
    lat?: number;
    lng?: number;
  }) => {
    setFormData((prev) => ({
      ...prev,
      address: address.formatted_address,
      latitude: address.lat,
      longitude: address.lng,
      suburb: address.suburb,
      state: address.stateShort || address.state,
      postcode: address.postcode,
    }));
  };

  const handleEdit = (property: Property) => {
    setFormData({
      name: property.name,
      type: property.type,
      address: property.address || '',
      purchasePrice: property.purchasePrice,
      purchaseDate: property.purchaseDate.split('T')[0],
      currentValue: property.currentValue,
      valuationDate: property.valuationDate.split('T')[0],
      latitude: property.latitude,
      longitude: property.longitude,
      googlePlaceId: property.googlePlaceId,
      suburb: property.suburb,
      state: property.state,
      postcode: property.postcode,
    });
    setEditingId(property.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property? This will also remove linked data.')) return;

    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadProperties();
      }
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  // Use centralized utilities - formatCurrency from lib/utils/formatters, toAnnual from lib/utils/frequencies
  const convertToAnnual = (amount: number, frequency: string) =>
    toAnnual(amount, frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');

  // Convert amount to monthly based on frequency
  const convertToMonthly = (amount: number, frequency: string) => {
    const freqMultipliers: Record<string, number> = {
      WEEKLY: 52 / 12,
      FORTNIGHTLY: 26 / 12,
      MONTHLY: 1,
      QUARTERLY: 1 / 3,
      ANNUAL: 1 / 12,
    };
    return amount * (freqMultipliers[frequency] || 1);
  };

  // Normalize amount based on current view mode (monthly/annual)
  const normalizeAmount = (amount: number, frequency: string) => {
    const monthly = convertToMonthly(amount, frequency);
    return financialViewMode === 'annual' ? monthly * 12 : monthly;
  };

  // Get normalized actual (already in monthly from API)
  const normalizeActual = (monthlyActual: number | null | undefined) => {
    if (monthlyActual === null || monthlyActual === undefined) return null;
    return financialViewMode === 'annual' ? monthlyActual * 12 : monthlyActual;
  };

  // Calculate variance between actual and budget
  const calculateVariance = (budget: number, actual: number | null | undefined) => {
    if (actual === null || actual === undefined) return { amount: null, percent: null };
    const diff = actual - budget;
    const percent = budget > 0 ? (diff / budget) * 100 : 0;
    return { amount: diff, percent };
  };

  const calculateGain = (property: Property) => {
    const gain = property.currentValue - property.purchasePrice;
    const percentage = property.purchasePrice > 0 ? (gain / property.purchasePrice) * 100 : 0;
    return { gain, percentage };
  };

  const calculateLVR = (property: Property) => {
    const totalLoans = property.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
    if (property.currentValue <= 0) return 0;
    return (totalLoans / property.currentValue) * 100;
  };

  const calculateEquity = (property: Property) => {
    const totalLoans = property.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
    return property.currentValue - totalLoans;
  };

  const calculateRentalYield = (property: Property) => {
    const annualRent = property.income?.reduce((sum, inc) => {
      if (inc.type === 'RENT' || inc.type === 'RENTAL') {
        return sum + convertToAnnual(inc.amount, inc.frequency);
      }
      return sum;
    }, 0) || 0;

    if (property.currentValue <= 0) return 0;
    return (annualRent / property.currentValue) * 100;
  };

  const calculateCashflow = (property: Property) => {
    const annualIncome = property.income?.reduce((sum, inc) =>
      sum + convertToAnnual(inc.amount, inc.frequency), 0) || 0;
    const annualExpenses = property.expenses?.reduce((sum, exp) =>
      sum + convertToAnnual(exp.amount, exp.frequency), 0) || 0;
    // Use actual loan repayments instead of just interest
    const annualLoanRepayments = property.loans?.reduce((sum, loan) =>
      sum + convertToAnnual(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY'), 0) || 0;

    return annualIncome - annualExpenses - annualLoanRepayments;
  };

  const calculateAnnualLoanRepayments = (property: Property) => {
    return property.loans?.reduce((sum, loan) =>
      sum + convertToAnnual(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY'), 0) || 0;
  };

  const calculateAnnualInterest = (property: Property) => {
    return property.loans?.reduce((sum, loan) =>
      sum + (loan.principal * loan.interestRateAnnual), 0) || 0;
  };

  // Exclude RENTAL properties from value/equity calculations (they're not owned)
  const ownedProperties = properties.filter(p => p.type !== 'RENTAL');
  const totalValue = ownedProperties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalEquity = ownedProperties.reduce((sum, p) => sum + calculateEquity(p), 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="Properties"
        description={`Manage your property portfolio • Total value: ${formatCurrency(totalValue)} • Equity: ${formatCurrency(totalEquity)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        }
      />

      {/* Search and Filter */}
      {properties.length > 0 && (
        <ListFilter
          data={properties}
          searchFields={['name', 'address']}
          searchPlaceholder="Search properties..."
          filters={propertyFilterConfigs}
          onFilteredData={setFilteredProperties}
          className="mb-4"
        />
      )}

      {/* View Mode Toggle */}
      {properties.length > 0 && !isLoading && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">View:</span>
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'tiles' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => setViewMode('tiles')}
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
            <p className="text-sm text-muted-foreground">Loading properties...</p>
          </div>
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Start by adding your first property to track its value and growth over time."
          action={{
            label: 'Add Property',
            onClick: () => { setShowDialog(true); resetForm(); },
          }}
        />
      ) : viewMode === 'list' ? (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Current Value</th>
                    <th className="px-4 py-3 text-right">Purchase Price</th>
                    <th className="px-4 py-3 text-right">Equity</th>
                    <th className="px-4 py-3 text-right">LVR</th>
                    <th className="px-4 py-3 text-right">Gain</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProperties.map((property) => {
                    const { gain, percentage } = calculateGain(property);
                    const lvr = calculateLVR(property);
                    const equity = calculateEquity(property);
                    return (
                      <tr
                        key={property.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => loadPropertyDetail(property.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{property.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{property.address}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={property.type === 'HOME' ? 'default' : property.type === 'RENTAL' ? 'outline' : 'secondary'}>
                            {property.type === 'HOME' ? 'Home' : property.type === 'RENTAL' ? 'Rental' : 'Investment'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(property.currentValue)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(property.purchasePrice)}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(equity)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={lvr > 80 ? 'text-red-600' : lvr > 60 ? 'text-yellow-600' : 'text-green-600'}>
                            {lvr.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={gain >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {gain >= 0 ? '+' : ''}{percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => loadPropertyDetail(property.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(property)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(property.id)}>
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
                    <td colSpan={2} className="px-4 py-3">Total ({properties.length} properties)</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totalValue)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(properties.reduce((sum, p) => sum + p.purchasePrice, 0))}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalEquity)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Tiles View */
        <div className="grid gap-6 md:grid-cols-2">
          {filteredProperties.map((property) => {
            const { gain, percentage } = calculateGain(property);
            const isPositiveGain = gain >= 0;
            const lvr = calculateLVR(property);
            const equity = calculateEquity(property);
            const rentalYield = calculateRentalYield(property);
            const cashflow = calculateCashflow(property);
            const loansCount = property.loans?.length || 0;
            const incomeCount = property.income?.length || 0;
            const expenseCount = property.expenses?.length || 0;
            const depreciationCount = property.depreciationSchedules?.length || 0;

            return (
              <Card key={property.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {property.type === 'RENTAL' ? (
                          <KeyRound className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Home className="h-5 w-5 text-muted-foreground" />
                        )}
                        {property.name}
                      </CardTitle>
                      <Badge variant={property.type === 'HOME' ? 'default' : property.type === 'RENTAL' ? 'outline' : 'secondary'}>
                        {property.type === 'HOME' ? 'Primary Residence' : property.type === 'RENTAL' ? 'Rental' : 'Investment'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => loadPropertyDetail(property.id)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(property)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(property.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="pt-2">
                    {property.address}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Rental Property Content */}
                  {property.type === 'RENTAL' ? (
                    <>
                      {/* Rent Expense Summary */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <KeyRound className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-900">Rental Property</span>
                        </div>
                        {expenseCount > 0 ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Rent & Expenses</p>
                            <p className="text-xl font-bold text-red-600">
                              {formatCurrency(property.expenses?.reduce((sum, exp) =>
                                sum + convertToAnnual(exp.amount, exp.frequency), 0) || 0)}/yr
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-blue-700">
                            Add rent expense from the expenses section
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Value Section - for owned properties */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                          <p className="text-xl font-bold">{formatCurrency(property.currentValue)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Purchased: {formatCurrency(property.purchasePrice)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Equity</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(equity)}</p>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* LVR */}
                        <div className="p-2 bg-muted/50 rounded-lg text-center">
                          <Percent className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">LVR</p>
                          <p className={`text-sm font-semibold ${lvr > 80 ? 'text-red-600' : lvr > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {lvr.toFixed(1)}%
                          </p>
                        </div>

                        {/* Capital Gain */}
                        <div className="p-2 bg-muted/50 rounded-lg text-center">
                          {isPositiveGain ? (
                            <TrendingUp className="h-4 w-4 mx-auto text-green-600 mb-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mx-auto text-red-600 mb-1" />
                          )}
                          <p className="text-xs text-muted-foreground">Gain</p>
                          <p className={`text-sm font-semibold ${isPositiveGain ? 'text-green-600' : 'text-red-600'}`}>
                            {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
                          </p>
                        </div>

                        {/* Rental Yield (for investment) */}
                        {property.type === 'INVESTMENT' && (
                          <div className="p-2 bg-muted/50 rounded-lg text-center">
                            <PiggyBank className="h-4 w-4 mx-auto text-purple-500 mb-1" />
                            <p className="text-xs text-muted-foreground">Yield</p>
                            <p className="text-sm font-semibold text-purple-600">
                              {rentalYield.toFixed(2)}%
                            </p>
                          </div>
                        )}

                        {/* Cashflow (for investment) */}
                        {property.type === 'INVESTMENT' && (
                          <div className="p-2 bg-muted/50 rounded-lg text-center col-span-3">
                            <p className="text-xs text-muted-foreground">Annual Cashflow</p>
                            <p className={`text-sm font-semibold ${cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(cashflow)}/yr
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Linked Data Summary */}
                  <div className="pt-3 border-t">
                    <div className="flex flex-wrap gap-2">
                      {loansCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Landmark className="h-3 w-3 mr-1" />
                          {loansCount} Loan{loansCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {incomeCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {incomeCount} Income
                        </Badge>
                      )}
                      {expenseCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Receipt className="h-3 w-3 mr-1" />
                          {expenseCount} Expense{expenseCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {depreciationCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {depreciationCount} Depreciation
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* View Details Button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => loadPropertyDetail(property.id)}
                  >
                    View Full Details
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Property Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the property details below.' : 'Enter the details for your new property.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Residence"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => {
                    const newType = value as 'HOME' | 'INVESTMENT' | 'RENTAL';
                    setFormData({
                      ...formData,
                      type: newType,
                      // Reset purchase fields for rental
                      purchasePrice: newType === 'RENTAL' ? 0 : formData.purchasePrice,
                      currentValue: newType === 'RENTAL' ? 0 : formData.currentValue,
                    });
                  }}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOME">Primary Residence</SelectItem>
                    <SelectItem value="INVESTMENT">Investment Property</SelectItem>
                    <SelectItem value="RENTAL">Rental (I&apos;m Renting)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.type === 'RENTAL' && (
                  <p className="text-xs text-muted-foreground">
                    Track your rental property and rent expenses
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                id="address"
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                onAddressSelect={handleAddressSelect}
                placeholder="Start typing an address..."
              />
              {formData.suburb && formData.state && (
                <p className="text-xs text-muted-foreground">
                  {formData.suburb}, {formData.state} {formData.postcode}
                </p>
              )}
            </div>

            {/* Rental property fields */}
            {formData.type === 'RENTAL' && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rentAmount">Rent Amount</Label>
                    <Input
                      id="rentAmount"
                      type="number"
                      value={formData.rentAmount || ''}
                      onChange={(e) => setFormData({ ...formData, rentAmount: Number(e.target.value) })}
                      placeholder="500"
                      min="0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rentFrequency">Payment Frequency</Label>
                    <Select
                      value={formData.rentFrequency || 'WEEKLY'}
                      onValueChange={(value) => setFormData({ ...formData, rentFrequency: value })}
                    >
                      <SelectTrigger id="rentFrequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formData.rentAmount && formData.rentAmount > 0 && (
                  <p className="text-sm text-blue-700">
                    Annual rent: ${((formData.rentAmount || 0) *
                      (formData.rentFrequency === 'WEEKLY' ? 52 : formData.rentFrequency === 'FORTNIGHTLY' ? 26 : 12)
                    ).toLocaleString()}/year (will be added as a recurring expense)
                  </p>
                )}
              </div>
            )}

            {/* Owned property fields - only for HOME and INVESTMENT */}
            {formData.type !== 'RENTAL' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                      placeholder="500000"
                      min="0"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentValue">Current Value</Label>
                    <Input
                      id="currentValue"
                      type="number"
                      value={formData.currentValue}
                      onChange={(e) => setFormData({ ...formData, currentValue: Number(e.target.value) })}
                      placeholder="600000"
                      min="0"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valuationDate">Valuation Date</Label>
                    <Input
                      id="valuationDate"
                      type="date"
                      value={formData.valuationDate}
                      onChange={(e) => setFormData({ ...formData, valuationDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Property' : 'Add Property'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Property Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {selectedProperty && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedProperty.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedProperty.address}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Details</TabsTrigger>
                  <TabsTrigger value="cashflow">Financials</TabsTrigger>
                  <TabsTrigger value="loans">Loans</TabsTrigger>
                  <TabsTrigger value="strategy">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    Strategy
                  </TabsTrigger>
                  <TabsTrigger value="linked">
                    <Link2 className="h-3 w-3 mr-1" />
                    Linked
                  </TabsTrigger>
                  <TabsTrigger value="depreciation">Depr.</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Purchase Price</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedProperty.purchasePrice)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedProperty.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedProperty.currentValue)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedProperty.valuationDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Equity</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(calculateEquity(selectedProperty))}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">LVR</p>
                      <p className="text-xl font-bold">
                        {calculateLVR(selectedProperty).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {selectedProperty.type === 'INVESTMENT' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Rental Yield</p>
                        <p className="text-xl font-bold text-purple-600">
                          {calculateRentalYield(selectedProperty).toFixed(2)}%
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Annual Cashflow</p>
                        <p className={`text-xl font-bold ${calculateCashflow(selectedProperty) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(calculateCashflow(selectedProperty))}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Property Location Map */}
                  {(selectedProperty.latitude && selectedProperty.longitude) || selectedProperty.address ? (
                    <div className="pt-4">
                      <p className="text-sm font-medium mb-2">Location</p>
                      <PropertyMap
                        latitude={selectedProperty.latitude}
                        longitude={selectedProperty.longitude}
                        address={selectedProperty.address}
                        propertyName={selectedProperty.name}
                        height="200px"
                      />
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="loans" className="mt-4">
                  {selectedProperty.loans && selectedProperty.loans.length > 0 ? (
                    <div className="space-y-3">
                      {selectedProperty.loans.map((loan) => (
                        <div key={loan.id} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{loan.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {loan.rateType} • {loan.isInterestOnly ? 'Interest Only' : 'P&I'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(loan.principal)}</p>
                              <p className="text-sm text-muted-foreground">
                                {(loan.interestRateAnnual * 100).toFixed(2)}% p.a.
                              </p>
                            </div>
                          </div>
                          {/* Repayment Info */}
                          <div className="mt-3 pt-3 border-t flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Repayment</span>
                            <div className="text-right">
                              <p className="font-medium text-orange-600">
                                {formatCurrency(loan.minRepayment || 0)}/{(loan.repaymentFrequency || 'monthly').toLowerCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(convertToAnnual(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY'))}/year
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {/* Total Loan Repayments */}
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Annual Repayments</span>
                          <span className="font-bold text-orange-600">
                            {formatCurrency(calculateAnnualLoanRepayments(selectedProperty))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No loans linked to this property.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="cashflow" className="mt-4">
                  <div className="space-y-4">
                    {/* View Mode Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">View:</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${financialViewMode === 'monthly' ? 'font-medium' : 'text-muted-foreground'}`}>Monthly</span>
                        <Switch
                          checked={financialViewMode === 'annual'}
                          onCheckedChange={(checked) => setFinancialViewMode(checked ? 'annual' : 'monthly')}
                        />
                        <span className={`text-sm ${financialViewMode === 'annual' ? 'font-medium' : 'text-muted-foreground'}`}>Annual</span>
                      </div>
                    </div>

                    {/* Summary Cards with Budget vs Actual */}
                    {(() => {
                      // Calculate totals for Budget (from entries) and Actual (from transactions)
                      const incomeBudget = selectedProperty.income?.reduce((sum, inc) =>
                        sum + normalizeAmount(inc.amount, inc.frequency), 0) || 0;
                      const incomeActual = selectedProperty.income?.reduce((sum, inc) =>
                        sum + (normalizeActual(inc.monthlyAverageActual) || 0), 0) || 0;
                      const hasIncomeActuals = selectedProperty.income?.some(inc => inc.hasTransactions);

                      const expenseBudget = selectedProperty.expenses?.reduce((sum, exp) =>
                        sum + normalizeAmount(exp.amount, exp.frequency), 0) || 0;
                      const expenseActual = selectedProperty.expenses?.reduce((sum, exp) =>
                        sum + (normalizeActual(exp.monthlyAverageActual) || 0), 0) || 0;
                      const hasExpenseActuals = selectedProperty.expenses?.some(exp => exp.hasTransactions);

                      const loanBudget = selectedProperty.loans?.reduce((sum, loan) =>
                        sum + normalizeAmount(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY'), 0) || 0;
                      const loanActual = selectedProperty.loans?.reduce((sum, loan) =>
                        sum + (normalizeActual(loan.monthlyAverageActual) || 0), 0) || 0;
                      const hasLoanActuals = selectedProperty.loans?.some(loan => loan.hasTransactions);

                      const cashflowBudget = incomeBudget - expenseBudget - loanBudget;
                      const cashflowActual = hasIncomeActuals || hasExpenseActuals || hasLoanActuals
                        ? incomeActual - expenseActual - loanActual
                        : null;

                      const periodLabel = financialViewMode === 'annual' ? '/yr' : '/mo';

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Income */}
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Income {periodLabel}</p>
                            <div className="flex justify-between items-baseline">
                              <div>
                                <p className="text-xs text-muted-foreground">Budget</p>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(incomeBudget)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Actual</p>
                                <p className={`text-lg font-bold ${hasIncomeActuals ? 'text-green-600' : 'text-muted-foreground'}`}>
                                  {hasIncomeActuals ? formatCurrency(incomeActual) : '—'}
                                </p>
                              </div>
                            </div>
                            {hasIncomeActuals && (
                              <div className={`text-xs mt-1 flex items-center gap-1 ${incomeActual >= incomeBudget ? 'text-green-600' : 'text-red-600'}`}>
                                {incomeActual >= incomeBudget ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {formatCurrency(incomeActual - incomeBudget)} ({((incomeActual - incomeBudget) / incomeBudget * 100).toFixed(0)}%)
                              </div>
                            )}
                          </div>

                          {/* Expenses */}
                          <div className="p-3 bg-red-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Expenses {periodLabel}</p>
                            <div className="flex justify-between items-baseline">
                              <div>
                                <p className="text-xs text-muted-foreground">Budget</p>
                                <p className="text-lg font-bold text-red-600">{formatCurrency(expenseBudget)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Actual</p>
                                <p className={`text-lg font-bold ${hasExpenseActuals ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {hasExpenseActuals ? formatCurrency(expenseActual) : '—'}
                                </p>
                              </div>
                            </div>
                            {hasExpenseActuals && (
                              <div className={`text-xs mt-1 flex items-center gap-1 ${expenseActual <= expenseBudget ? 'text-green-600' : 'text-red-600'}`}>
                                {expenseActual <= expenseBudget ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                {formatCurrency(expenseActual - expenseBudget)} ({((expenseActual - expenseBudget) / expenseBudget * 100).toFixed(0)}%)
                              </div>
                            )}
                          </div>

                          {/* Loan Repayments */}
                          <div className="p-3 bg-orange-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Loan Repayments {periodLabel}</p>
                            <div className="flex justify-between items-baseline">
                              <div>
                                <p className="text-xs text-muted-foreground">Budget</p>
                                <p className="text-lg font-bold text-orange-600">{formatCurrency(loanBudget)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Actual</p>
                                <p className={`text-lg font-bold ${hasLoanActuals ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                  {hasLoanActuals ? formatCurrency(loanActual) : '—'}
                                </p>
                              </div>
                            </div>
                            {hasLoanActuals && (
                              <div className={`text-xs mt-1 flex items-center gap-1 ${loanActual <= loanBudget ? 'text-green-600' : 'text-red-600'}`}>
                                {loanActual <= loanBudget ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                {formatCurrency(loanActual - loanBudget)} ({loanBudget > 0 ? ((loanActual - loanBudget) / loanBudget * 100).toFixed(0) : 0}%)
                              </div>
                            )}
                          </div>

                          {/* Net Cashflow */}
                          <div className={`p-3 rounded-lg ${cashflowBudget >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                            <p className="text-xs text-muted-foreground">Net Cashflow {periodLabel}</p>
                            <div className="flex justify-between items-baseline">
                              <div>
                                <p className="text-xs text-muted-foreground">Budget</p>
                                <p className={`text-lg font-bold ${cashflowBudget >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {formatCurrency(cashflowBudget)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Actual</p>
                                <p className={`text-lg font-bold ${cashflowActual !== null ? (cashflowActual >= 0 ? 'text-green-700' : 'text-red-700') : 'text-muted-foreground'}`}>
                                  {cashflowActual !== null ? formatCurrency(cashflowActual) : '—'}
                                </p>
                              </div>
                            </div>
                            {cashflowActual !== null && (
                              <div className={`text-xs mt-1 flex items-center gap-1 ${cashflowActual >= cashflowBudget ? 'text-green-600' : 'text-red-600'}`}>
                                {cashflowActual >= cashflowBudget ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {formatCurrency(cashflowActual - cashflowBudget)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Income Section */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Income
                      </h4>
                      {selectedProperty.income && selectedProperty.income.length > 0 ? (
                        <div className="space-y-1">
                          {/* Column Headers */}
                          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2 text-right">Budget</div>
                            <div className="col-span-3 text-right">Actual</div>
                            <div className="col-span-3 text-right">Variance</div>
                          </div>
                          {selectedProperty.income.map((inc) => {
                            const budget = normalizeAmount(inc.amount, inc.frequency);
                            const actual = normalizeActual(inc.monthlyAverageActual);
                            const variance = calculateVariance(budget, actual);
                            return (
                              <div key={inc.id} className="grid grid-cols-12 gap-2 px-3 py-2 bg-green-50 rounded-lg items-center">
                                <div className="col-span-4 truncate">{inc.name}</div>
                                <div className="col-span-2 text-right font-medium text-green-600">
                                  {formatCurrency(budget)}
                                </div>
                                <div className="col-span-3 text-right">
                                  {inc.hasTransactions ? (
                                    <div>
                                      <span className="font-medium text-green-600">{formatCurrency(actual || 0)}</span>
                                      <span className="text-xs text-muted-foreground block">{inc.transactionCount} txns</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div className="col-span-3 text-right">
                                  {variance.amount !== null ? (
                                    <div className={variance.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      <div className="flex items-center justify-end gap-1">
                                        {variance.amount >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                        <span className="font-medium">{variance.amount >= 0 ? '+' : ''}{formatCurrency(variance.amount)}</span>
                                      </div>
                                      <span className="text-xs">({variance.amount >= 0 ? '+' : ''}{variance.percent?.toFixed(0)}%)</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No income linked.</p>
                      )}
                    </div>

                    {/* Expenses Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          Expenses
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddExpenseForProperty(selectedProperty.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Expense
                        </Button>
                      </div>
                      {selectedProperty.expenses && selectedProperty.expenses.length > 0 ? (
                        <div className="space-y-1">
                          {/* Column Headers */}
                          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2 text-right">Budget</div>
                            <div className="col-span-3 text-right">Actual</div>
                            <div className="col-span-3 text-right">Variance</div>
                          </div>
                          {selectedProperty.expenses.map((exp) => {
                            const budget = normalizeAmount(exp.amount, exp.frequency);
                            const actual = normalizeActual(exp.monthlyAverageActual);
                            const variance = calculateVariance(budget, actual);
                            // For expenses, negative variance (spending less) is good
                            const isGoodVariance = variance.amount !== null && variance.amount <= 0;
                            return (
                              <div key={exp.id} className="grid grid-cols-12 gap-2 px-3 py-2 bg-red-50 rounded-lg items-center">
                                <div className="col-span-4">
                                  <span className="truncate block">{exp.name}</span>
                                  {exp.isTaxDeductible && (
                                    <Badge variant="outline" className="text-xs mt-1">Deductible</Badge>
                                  )}
                                </div>
                                <div className="col-span-2 text-right font-medium text-red-600">
                                  {formatCurrency(budget)}
                                </div>
                                <div className="col-span-3 text-right">
                                  {exp.hasTransactions ? (
                                    <div>
                                      <span className="font-medium text-red-600">{formatCurrency(actual || 0)}</span>
                                      <span className="text-xs text-muted-foreground block">{exp.transactionCount} txns</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div className="col-span-3 text-right">
                                  {variance.amount !== null ? (
                                    <div className={isGoodVariance ? 'text-green-600' : 'text-red-600'}>
                                      <div className="flex items-center justify-end gap-1">
                                        {isGoodVariance ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                        <span className="font-medium">{variance.amount >= 0 ? '+' : ''}{formatCurrency(variance.amount)}</span>
                                      </div>
                                      <span className="text-xs">({variance.amount >= 0 ? '+' : ''}{variance.percent?.toFixed(0)}%)</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No expenses linked. Click &quot;Add Expense&quot; to add one.</p>
                      )}
                    </div>

                    {/* Loan Repayments Section */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-orange-600" />
                        Loan Repayments
                      </h4>
                      {selectedProperty.loans && selectedProperty.loans.length > 0 ? (
                        <div className="space-y-1">
                          {/* Column Headers */}
                          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2 text-right">Budget</div>
                            <div className="col-span-3 text-right">Actual</div>
                            <div className="col-span-3 text-right">Variance</div>
                          </div>
                          {selectedProperty.loans.map((loan) => {
                            const budget = normalizeAmount(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY');
                            const actual = normalizeActual(loan.monthlyAverageActual);
                            const variance = calculateVariance(budget, actual);
                            // For loans, negative variance (paying less) might be good or bad depending on context
                            const isGoodVariance = variance.amount !== null && variance.amount <= 0;
                            return (
                              <div key={loan.id} className="grid grid-cols-12 gap-2 px-3 py-2 bg-orange-50 rounded-lg items-center">
                                <div className="col-span-4">
                                  <span className="truncate block">{loan.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {loan.isInterestOnly ? 'IO' : 'P&I'} • {(loan.interestRateAnnual * 100).toFixed(2)}%
                                  </span>
                                </div>
                                <div className="col-span-2 text-right font-medium text-orange-600">
                                  {formatCurrency(budget)}
                                </div>
                                <div className="col-span-3 text-right">
                                  {loan.hasTransactions ? (
                                    <div>
                                      <span className="font-medium text-orange-600">{formatCurrency(actual || 0)}</span>
                                      <span className="text-xs text-muted-foreground block">{loan.transactionCount} txns</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div className="col-span-3 text-right">
                                  {variance.amount !== null ? (
                                    <div className={isGoodVariance ? 'text-green-600' : 'text-red-600'}>
                                      <div className="flex items-center justify-end gap-1">
                                        {isGoodVariance ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                        <span className="font-medium">{variance.amount >= 0 ? '+' : ''}{formatCurrency(variance.amount)}</span>
                                      </div>
                                      <span className="text-xs">({variance.amount >= 0 ? '+' : ''}{variance.percent?.toFixed(0)}%)</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No loans linked.</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="depreciation" className="mt-4">
                  {selectedProperty.depreciationSchedules && selectedProperty.depreciationSchedules.length > 0 ? (
                    <div className="space-y-3">
                      {selectedProperty.depreciationSchedules.map((dep) => (
                        <div key={dep.id} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{dep.assetName}</p>
                              <p className="text-sm text-muted-foreground">
                                {dep.category} • {dep.method}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(dep.cost)}</p>
                              <p className="text-sm text-muted-foreground">
                                {(dep.rate * 100).toFixed(2)}% p.a.
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No depreciation schedules.</p>
                      <p className="text-sm text-muted-foreground">
                        Add depreciation schedules via the Depreciation page.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="strategy" className="mt-4">
                  <EntityStrategyTab
                    entityType="property"
                    entityId={selectedProperty.id}
                    entityName={selectedProperty.name}
                  />
                </TabsContent>

                <TabsContent value="linked" className="mt-4">
                  <LinkedDataPanel
                    linkedEntities={selectedProperty._links?.related || []}
                    missingLinks={selectedProperty._meta?.missingLinks || []}
                    entityType="property"
                    entityName={selectedProperty.name}
                    showHealthScore={true}
                    onNavigate={handleLinkedEntityNavigate}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Expense Dialog - Reusable component for adding expenses */}
      <ExpenseDialog
        open={showExpenseDialog}
        onOpenChange={(open) => {
          setShowExpenseDialog(open);
          if (!open) setExpensePropertyId(null);
        }}
        defaultPropertyId={expensePropertyId}
        token={token || ''}
        onSuccess={handleExpenseSuccess}
      />
    </DashboardLayout>
  );
}

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function PropertiesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <PropertiesPageContent />
    </Suspense>
  );
}
