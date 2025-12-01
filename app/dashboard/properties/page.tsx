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
  ChevronRight, Percent, PiggyBank, FileText, Eye, Link2, Lightbulb
} from 'lucide-react';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import EntityStrategyTab from '@/components/strategy/EntityStrategyTab';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

interface Loan {
  id: string;
  name: string;
  principal: number;
  interestRateAnnual: number;
  rateType: string;
  isInterestOnly: boolean;
  minRepayment: number;
  repaymentFrequency: string;
}

interface Income {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
}

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
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
  type: 'HOME' | 'INVESTMENT';
  address: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
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
  type: 'HOME' | 'INVESTMENT';
  address: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
};

function PropertiesPageContent() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false); // Close current dialog
    openLinkedEntity(entity);
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
    });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const convertToAnnual = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52;
      case 'FORTNIGHTLY': return amount * 26;
      case 'MONTHLY': return amount * 12;
      case 'QUARTERLY': return amount * 4;
      case 'ANNUAL': return amount;
      default: return amount * 12;
    }
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

  const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalEquity = properties.reduce((sum, p) => sum + calculateEquity(p), 0);

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
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {properties.map((property) => {
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
                        <Home className="h-5 w-5 text-muted-foreground" />
                        {property.name}
                      </CardTitle>
                      <Badge variant={property.type === 'HOME' ? 'default' : 'secondary'}>
                        {property.type === 'HOME' ? 'Primary Residence' : 'Investment'}
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
                  {/* Value Section */}
                  <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
                  onValueChange={(value) => setFormData({ ...formData, type: value as 'HOME' | 'INVESTMENT' })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOME">Primary Residence</SelectItem>
                    <SelectItem value="INVESTMENT">Investment Property</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, Sydney NSW 2000"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-2 gap-4">
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
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Annual Income</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedProperty.income?.reduce((sum, inc) =>
                            sum + convertToAnnual(inc.amount, inc.frequency), 0) || 0)}
                        </p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Annual Expenses</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(selectedProperty.expenses?.reduce((sum, exp) =>
                            sum + convertToAnnual(exp.amount, exp.frequency), 0) || 0)}
                        </p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Annual Loan Repayments</p>
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(calculateAnnualLoanRepayments(selectedProperty))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Interest: {formatCurrency(calculateAnnualInterest(selectedProperty))}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${calculateCashflow(selectedProperty) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                        <p className="text-xs text-muted-foreground">Net Cashflow</p>
                        <p className={`text-lg font-bold ${calculateCashflow(selectedProperty) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(calculateCashflow(selectedProperty))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">per year</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Income
                      </h4>
                      {selectedProperty.income && selectedProperty.income.length > 0 ? (
                        <div className="space-y-2">
                          {selectedProperty.income.map((inc) => (
                            <div key={inc.id} className="flex justify-between p-3 bg-green-50 rounded-lg">
                              <span>{inc.name}</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(inc.amount)}/{inc.frequency.toLowerCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No income linked.</p>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        Expenses
                      </h4>
                      {selectedProperty.expenses && selectedProperty.expenses.length > 0 ? (
                        <div className="space-y-2">
                          {selectedProperty.expenses.map((exp) => (
                            <div key={exp.id} className="flex justify-between p-3 bg-red-50 rounded-lg">
                              <div>
                                <span>{exp.name}</span>
                                {exp.isTaxDeductible && (
                                  <Badge variant="outline" className="ml-2 text-xs">Deductible</Badge>
                                )}
                              </div>
                              <span className="font-medium text-red-600">
                                {formatCurrency(exp.amount)}/{exp.frequency.toLowerCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No expenses linked.</p>
                      )}
                    </div>

                    {/* Loan Repayments Section */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-orange-600" />
                        Loan Repayments
                      </h4>
                      {selectedProperty.loans && selectedProperty.loans.length > 0 ? (
                        <div className="space-y-2">
                          {selectedProperty.loans.map((loan) => (
                            <div key={loan.id} className="flex justify-between p-3 bg-orange-50 rounded-lg">
                              <div>
                                <span>{loan.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {loan.isInterestOnly ? 'Interest Only' : 'P&I'} • {(loan.interestRateAnnual * 100).toFixed(2)}%
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-medium text-orange-600">
                                  {formatCurrency(loan.minRepayment || 0)}/{(loan.repaymentFrequency || 'monthly').toLowerCase()}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(convertToAnnual(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY'))}/yr
                                </p>
                              </div>
                            </div>
                          ))}
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
