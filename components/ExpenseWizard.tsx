'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Zap, Plus, Trash2, Home, Car, Utensils, Wifi, Shield, Dumbbell, Tv, Building2,
  Droplets, Flame, Phone, CreditCard, Receipt, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';

interface Property {
  id: string;
  name: string;
  type: string;
}

interface ExpenseTemplateRow {
  id: string;
  name: string;
  category: string;
  amount: string;
  frequency: string;
  propertyId: string | null;
  isTaxDeductible: boolean;
  isEssential: boolean;
  isCustom?: boolean;
  groupId?: string;
}

interface ExpenseGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  expanded: boolean;
}

const CATEGORIES = [
  { value: 'HOUSING', label: 'Housing' },
  { value: 'RATES', label: 'Rates' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'FOOD', label: 'Food' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'STRATA', label: 'Strata' },
  { value: 'LAND_TAX', label: 'Land Tax' },
  { value: 'OTHER', label: 'Other' },
];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

// Default expense templates grouped by category
const getDefaultTemplates = (properties: Property[]): ExpenseTemplateRow[] => {
  const templates: ExpenseTemplateRow[] = [
    // Living Essentials
    { id: 'groceries', name: 'Groceries', category: 'FOOD', amount: '', frequency: 'WEEKLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'living' },
    { id: 'electricity', name: 'Electricity', category: 'UTILITIES', amount: '', frequency: 'QUARTERLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'living' },
    { id: 'gas', name: 'Gas', category: 'UTILITIES', amount: '', frequency: 'QUARTERLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'living' },
    { id: 'water', name: 'Water', category: 'UTILITIES', amount: '', frequency: 'QUARTERLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'living' },
    { id: 'internet', name: 'Internet', category: 'UTILITIES', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'living' },
    { id: 'mobile', name: 'Mobile Phone', category: 'UTILITIES', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'living' },

    // Insurance & Protection
    { id: 'health-insurance', name: 'Health Insurance', category: 'INSURANCE', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'insurance' },
    { id: 'car-insurance', name: 'Car Insurance', category: 'INSURANCE', amount: '', frequency: 'ANNUAL', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'insurance' },
    { id: 'home-contents', name: 'Home & Contents Insurance', category: 'INSURANCE', amount: '', frequency: 'ANNUAL', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'insurance' },
    { id: 'life-insurance', name: 'Life Insurance', category: 'INSURANCE', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: false, groupId: 'insurance' },

    // Transport
    { id: 'fuel', name: 'Fuel', category: 'TRANSPORT', amount: '', frequency: 'WEEKLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'transport' },
    { id: 'car-rego', name: 'Car Registration', category: 'TRANSPORT', amount: '', frequency: 'ANNUAL', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'transport' },
    { id: 'public-transport', name: 'Public Transport', category: 'TRANSPORT', amount: '', frequency: 'WEEKLY', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'transport' },
    { id: 'car-service', name: 'Car Service/Maintenance', category: 'TRANSPORT', amount: '', frequency: 'ANNUAL', propertyId: null, isTaxDeductible: false, isEssential: true, groupId: 'transport' },

    // Lifestyle
    { id: 'streaming', name: 'Streaming Services', category: 'ENTERTAINMENT', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: false, groupId: 'lifestyle' },
    { id: 'gym', name: 'Gym Membership', category: 'PERSONAL', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: false, groupId: 'lifestyle' },
    { id: 'subscriptions', name: 'Subscriptions', category: 'ENTERTAINMENT', amount: '', frequency: 'MONTHLY', propertyId: null, isTaxDeductible: false, isEssential: false, groupId: 'lifestyle' },
    { id: 'dining-out', name: 'Dining Out', category: 'FOOD', amount: '', frequency: 'WEEKLY', propertyId: null, isTaxDeductible: false, isEssential: false, groupId: 'lifestyle' },
  ];

  // Add property-specific templates for each property
  properties.forEach((property, index) => {
    templates.push(
      { id: `council-rates-${property.id}`, name: 'Council Rates', category: 'RATES', amount: '', frequency: 'QUARTERLY', propertyId: property.id, isTaxDeductible: true, isEssential: true, groupId: `property-${property.id}` },
      { id: `water-rates-${property.id}`, name: 'Water Rates', category: 'RATES', amount: '', frequency: 'QUARTERLY', propertyId: property.id, isTaxDeductible: true, isEssential: true, groupId: `property-${property.id}` },
      { id: `strata-${property.id}`, name: 'Strata/Body Corp', category: 'STRATA', amount: '', frequency: 'QUARTERLY', propertyId: property.id, isTaxDeductible: true, isEssential: true, groupId: `property-${property.id}` },
      { id: `landlord-insurance-${property.id}`, name: 'Landlord Insurance', category: 'INSURANCE', amount: '', frequency: 'ANNUAL', propertyId: property.id, isTaxDeductible: true, isEssential: true, groupId: `property-${property.id}` },
      { id: `property-mgmt-${property.id}`, name: 'Property Management', category: 'MAINTENANCE', amount: '', frequency: 'MONTHLY', propertyId: property.id, isTaxDeductible: true, isEssential: true, groupId: `property-${property.id}` },
      { id: `land-tax-${property.id}`, name: 'Land Tax', category: 'LAND_TAX', amount: '', frequency: 'ANNUAL', propertyId: property.id, isTaxDeductible: true, isEssential: true, groupId: `property-${property.id}` },
    );
  });

  return templates;
};

const getGroups = (properties: Property[]): ExpenseGroup[] => {
  const groups: ExpenseGroup[] = [
    { id: 'living', name: 'Living Essentials', icon: <Home className="h-4 w-4" />, expanded: true },
    { id: 'insurance', name: 'Insurance & Protection', icon: <Shield className="h-4 w-4" />, expanded: true },
    { id: 'transport', name: 'Transport', icon: <Car className="h-4 w-4" />, expanded: true },
    { id: 'lifestyle', name: 'Lifestyle', icon: <Tv className="h-4 w-4" />, expanded: false },
  ];

  // Add property groups
  properties.forEach(property => {
    groups.push({
      id: `property-${property.id}`,
      name: property.name,
      icon: <Building2 className="h-4 w-4" />,
      expanded: true,
    });
  });

  return groups;
};

interface ExpenseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  token: string;
  onSuccess: () => void;
}

export function ExpenseWizard({ open, onOpenChange, properties, token, onSuccess }: ExpenseWizardProps) {
  const [rows, setRows] = useState<ExpenseTemplateRow[]>([]);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [customCounter, setCustomCounter] = useState(0);

  // Initialize templates when dialog opens
  useEffect(() => {
    if (open) {
      setRows(getDefaultTemplates(properties));
      setGroups(getGroups(properties));
    }
  }, [open, properties]);

  const toggleGroup = (groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, expanded: !g.expanded } : g
    ));
  };

  const updateRow = (id: string, field: keyof ExpenseTemplateRow, value: any) => {
    setRows(prev => prev.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const addCustomRow = (groupId: string) => {
    const newRow: ExpenseTemplateRow = {
      id: `custom-${customCounter}`,
      name: '',
      category: 'OTHER',
      amount: '',
      frequency: 'MONTHLY',
      propertyId: groupId.startsWith('property-') ? groupId.replace('property-', '') : null,
      isTaxDeductible: groupId.startsWith('property-'),
      isEssential: true,
      isCustom: true,
      groupId,
    };
    setRows(prev => [...prev, newRow]);
    setCustomCounter(prev => prev + 1);
  };

  // Calculate summary
  const summary = useMemo(() => {
    const filledRows = rows.filter(r => r.amount && parseFloat(r.amount) > 0);
    let totalMonthly = 0;

    filledRows.forEach(row => {
      const amount = parseFloat(row.amount);
      switch (row.frequency) {
        case 'WEEKLY': totalMonthly += amount * 52 / 12; break;
        case 'FORTNIGHTLY': totalMonthly += amount * 26 / 12; break;
        case 'MONTHLY': totalMonthly += amount; break;
        case 'QUARTERLY': totalMonthly += amount * 4 / 12; break;
        case 'ANNUAL': totalMonthly += amount / 12; break;
      }
    });

    return {
      count: filledRows.length,
      totalMonthly,
      totalAnnual: totalMonthly * 12,
    };
  }, [rows]);

  const handleSave = async () => {
    const expensesToCreate = rows
      .filter(r => r.name && r.amount && parseFloat(r.amount) > 0)
      .map(r => ({
        name: r.name,
        category: r.category,
        amount: parseFloat(r.amount),
        frequency: r.frequency,
        propertyId: r.propertyId,
        isTaxDeductible: r.isTaxDeductible,
        isEssential: r.isEssential,
        sourceType: r.propertyId ? 'PROPERTY' : 'GENERAL',
      }));

    if (expensesToCreate.length === 0) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/expenses/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expenses: expensesToCreate }),
      });

      if (response.ok) {
        onSuccess();
        onOpenChange(false);
      } else {
        const error = await response.json();
        console.error('Failed to create expenses:', error);
      }
    } catch (error) {
      console.error('Error creating expenses:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            Quick Add Expenses
          </DialogTitle>
          <DialogDescription>
            Enter amounts for common expenses. Only rows with amounts will be created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="py-4 space-y-4">
            {groups.map(group => {
              const groupRows = rows.filter(r => r.groupId === group.id);
              if (groupRows.length === 0) return null;

              const groupTotal = groupRows
                .filter(r => r.amount && parseFloat(r.amount) > 0)
                .reduce((sum, r) => {
                  const amt = parseFloat(r.amount);
                  switch (r.frequency) {
                    case 'WEEKLY': return sum + amt * 52 / 12;
                    case 'FORTNIGHTLY': return sum + amt * 26 / 12;
                    case 'MONTHLY': return sum + amt;
                    case 'QUARTERLY': return sum + amt * 4 / 12;
                    case 'ANNUAL': return sum + amt / 12;
                    default: return sum;
                  }
                }, 0);

              return (
                <div key={group.id} className="border rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{group.icon}</span>
                      <span className="font-medium">{group.name}</span>
                      {group.id.startsWith('property-') && (
                        <Badge variant="secondary" className="text-xs">Property</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {groupTotal > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(groupTotal)}/mo
                        </span>
                      )}
                      {group.expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Group Content */}
                  {group.expanded && (
                    <div className="p-3 space-y-2">
                      {/* Header row */}
                      <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
                        <div className="col-span-4">Expense</div>
                        <div className="col-span-2">Category</div>
                        <div className="col-span-2">Amount</div>
                        <div className="col-span-2">Frequency</div>
                        <div className="col-span-1 text-center">Deduct</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Expense rows */}
                      {groupRows.map(row => (
                        <div
                          key={row.id}
                          className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          {/* Name */}
                          <div className="col-span-4">
                            {row.isCustom ? (
                              <Input
                                value={row.name}
                                onChange={e => updateRow(row.id, 'name', e.target.value)}
                                placeholder="Expense name"
                                className="h-9"
                              />
                            ) : (
                              <span className="text-sm font-medium">{row.name}</span>
                            )}
                          </div>

                          {/* Category */}
                          <div className="col-span-2">
                            {row.isCustom ? (
                              <Select
                                value={row.category}
                                onValueChange={v => updateRow(row.id, 'category', v)}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>
                                      {c.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {CATEGORIES.find(c => c.value === row.category)?.label || row.category}
                              </Badge>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="col-span-2">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input
                                type="number"
                                value={row.amount}
                                onChange={e => updateRow(row.id, 'amount', e.target.value)}
                                placeholder="0"
                                className="h-9 pl-7 text-right"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>

                          {/* Frequency */}
                          <div className="col-span-2">
                            <Select
                              value={row.frequency}
                              onValueChange={v => updateRow(row.id, 'frequency', v)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCIES.map(f => (
                                  <SelectItem key={f.value} value={f.value}>
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Tax Deductible */}
                          <div className="col-span-1 flex justify-center">
                            <Checkbox
                              checked={row.isTaxDeductible}
                              onCheckedChange={v => updateRow(row.id, 'isTaxDeductible', v)}
                            />
                          </div>

                          {/* Delete */}
                          <div className="col-span-1 flex justify-center">
                            {row.isCustom && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeRow(row.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add custom row button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-muted-foreground hover:text-foreground"
                        onClick={() => addCustomRow(group.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Expense
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with summary */}
        <div className="border-t px-6 py-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {summary.count > 0 ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Expenses to add</p>
                    <p className="text-lg font-semibold">{summary.count}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly total</p>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(summary.totalMonthly)}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-sm text-muted-foreground">Annual total</p>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(summary.totalAnnual)}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter amounts to add expenses
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || summary.count === 0}
                className="min-w-[140px]"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Add {summary.count} Expense{summary.count !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
