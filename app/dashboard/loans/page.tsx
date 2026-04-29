'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Landmark, Plus, Edit2, Trash2, Home as HomeIcon, Wallet, Calendar, TrendingDown, Eye, Receipt, DollarSign, Percent, Building, Link2, Lightbulb, LayoutGrid, List, Car, CreditCard, GraduationCap, Briefcase } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import EntityStrategyTab from '@/components/strategy/EntityStrategyTab';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
// FormDocumentUpload + FieldMapping are now used inside the shared
// LoanFormDialog component (Phase 1b extraction). They're not
// referenced directly here anymore — kept off the import list.
import {
  LoanFormDialog,
  type LoanFormValues,
} from '@/components/loans/LoanFormDialog';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
  vendorName?: string;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

interface Loan {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT' | 'CAR' | 'PERSONAL' | 'LINE_OF_CREDIT' | 'STUDENT' | 'BUSINESS';
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  fixedExpiry?: string;
  extraRepaymentCap?: number;
  propertyId?: string;
  offsetAccountId?: string;
  linkedAssetId?: string;
  linkedAccountId?: string;
  property?: { id: string; name: string; currentValue: number; address?: string };
  offsetAccount?: { id: string; name: string; currentBalance: number; institution?: string };
  linkedAsset?: Asset;
  linkedAccount?: { id: string; name: string; currentBalance: number; type?: string };
  expenses?: Expense[];
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

interface Property {
  id: string;
  name: string;
  currentValue: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  institution?: string;
}

type ViewMode = 'tiles' | 'list';

function LoansPageContent() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openLinkedEntity } = useCrossModuleNavigation();
  // Tracks whether we've already auto-opened the detail dialog for the
  // `?focus=<id>` deep-link, so a state update in the dialog (e.g.
  // editing the loan) doesn't reopen it on every render.
  const hasAutoOpenedFocusRef = useRef<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // `showDialog` opens the shared LoanFormDialog (Phase 1b). The
  // dialog manages its own form state, document upload state, and
  // submit handler internally — this page only tracks open/closed
  // and which row is being edited.
  const [showDialog, setShowDialog] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanFormValues | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false);
    openLinkedEntity(entity);
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Deep-link from /dashboard/loans/[id] (and any `?focus=<id>` URL):
  // when the loans array finishes loading, find the focused loan and
  // auto-open the detail dialog for it. Strip the `focus` query param
  // afterward so a refresh doesn't reopen the dialog on every load.
  useEffect(() => {
    const focusId = searchParams?.get('focus');
    if (!focusId) return;
    if (isLoading) return; // wait for loans to arrive
    if (hasAutoOpenedFocusRef.current === focusId) return; // already handled

    const target = loans.find((l) => l.id === focusId);
    if (target) {
      hasAutoOpenedFocusRef.current = focusId;
      setSelectedLoan(target);
      setShowDetailDialog(true);
    } else {
      // Loan not found (deleted, wrong id, or not yet visible) — flip
      // the ref anyway so we don't keep retrying every render.
      hasAutoOpenedFocusRef.current = focusId;
    }

    // Strip ?focus= from the URL without adding history. `router.replace`
    // re-renders this component but `hasAutoOpenedFocusRef` already holds
    // the focusId, so the guard above prevents an infinite open loop.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('focus');
    const queryString = params.toString();
    router.replace(`/dashboard/loans${queryString ? `?${queryString}` : ''}`);
  }, [loans, isLoading, searchParams, router]);

  const loadData = async () => {
    try {
      const [loansRes, propertiesRes, accountsRes, assetsRes] = await Promise.all([
        fetch('/api/loans', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/properties', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/assets', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (loansRes.ok) {
        const result = await loansRes.json();
        setLoans(result.data || result);
      }
      if (propertiesRes.ok) {
        const result = await propertiesRes.json();
        setProperties(result.data || result);
      }
      if (accountsRes.ok) {
        const result = await accountsRes.json();
        const accountsList = result.data || result;
        // Keep all accounts for linkedAccount (LINE_OF_CREDIT)
        setAllAccounts(accountsList);
        // Filter to show only OFFSET accounts for offset linking
        setAccounts(accountsList.filter((a: Account) => a.type === 'OFFSET'));
      }
      if (assetsRes.ok) {
        const result = await assetsRes.json();
        const assetsList = result.data || result;
        // Filter to show only VEHICLE assets for car loan linking
        setAssets(assetsList.filter((a: Asset) => a.type === 'VEHICLE'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  // Phase 1b: form submit + reset are handled inside the shared
  // LoanFormDialog. This page only opens the dialog (in create
  // or edit mode) and reloads the list when it reports a save.
  const handleEdit = (loan: Loan) => {
    setEditingLoan({
      id: loan.id,
      name: loan.name,
      type: loan.type,
      principal: loan.principal,
      interestRateAnnual: loan.interestRateAnnual,
      rateType: loan.rateType,
      isInterestOnly: loan.isInterestOnly,
      termMonthsRemaining: loan.termMonthsRemaining,
      minRepayment: loan.minRepayment,
      repaymentFrequency: loan.repaymentFrequency,
      fixedExpiry: loan.fixedExpiry,
      extraRepaymentCap: loan.extraRepaymentCap,
      propertyId: loan.propertyId,
      offsetAccountId: loan.offsetAccountId,
      linkedAssetId: loan.linkedAssetId,
      linkedAccountId: loan.linkedAccountId,
    });
    setShowDialog(true);
  };

  const handleViewDetails = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowDetailDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loan?')) return;

    try {
      const response = await fetch(`/api/loans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
    }
  };

  // formatCurrency imported from lib/utils/formatters

  const formatPercent = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const convertToAnnual = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52;
      case 'FORTNIGHTLY': return amount * 26;
      case 'MONTHLY': return amount * 12;
      case 'ANNUAL': return amount;
      default: return amount * 12;
    }
  };

  // Calculate effective balance (principal minus offset)
  const calculateEffectiveBalance = (loan: Loan) => {
    const offsetBalance = loan.offsetAccount?.currentBalance || 0;
    return Math.max(0, loan.principal - offsetBalance);
  };

  // Calculate annual interest cost
  const calculateAnnualInterest = (loan: Loan) => {
    const effectiveBalance = calculateEffectiveBalance(loan);
    return effectiveBalance * loan.interestRateAnnual;
  };

  // Calculate LVR if property is linked
  const calculateLVR = (loan: Loan) => {
    if (!loan.property?.currentValue || loan.property.currentValue <= 0) return null;
    return (loan.principal / loan.property.currentValue) * 100;
  };

  // Calculate total linked expenses
  const calculateLinkedExpenses = (loan: Loan) => {
    if (!loan.expenses || loan.expenses.length === 0) return 0;
    return loan.expenses.reduce((sum, e) => sum + convertToAnnual(e.amount, e.frequency), 0);
  };

  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalEffectiveBalance = loans.reduce((sum, l) => sum + calculateEffectiveBalance(l), 0);
  const totalAnnualInterest = loans.reduce((sum, l) => sum + calculateAnnualInterest(l), 0);

  const getLoanTypeBadge = (type: Loan['type']) => {
    switch (type) {
      case 'HOME':
        return <Badge variant="default">Home Loan</Badge>;
      case 'INVESTMENT':
        return <Badge variant="secondary">Investment</Badge>;
      case 'CAR':
        return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Car Loan</Badge>;
      case 'PERSONAL':
        return <Badge className="bg-purple-500 text-white hover:bg-purple-600">Personal</Badge>;
      case 'LINE_OF_CREDIT':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Line of Credit</Badge>;
      case 'STUDENT':
        return <Badge className="bg-cyan-500 text-white hover:bg-cyan-600">Student</Badge>;
      case 'BUSINESS':
        return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Business</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Loans"
        description={`Manage your loans and debts • Total debt: ${formatCurrency(totalPrincipal)}`}
        action={
          <Button onClick={() => { setEditingLoan(null); setShowDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Loan
          </Button>
        }
      />

      {/* View Mode Toggle */}
      {loans.length > 0 && !isLoading && (
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
            <p className="text-sm text-muted-foreground">Loading loans...</p>
          </div>
        </div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Start by adding your first loan to track repayments and interest costs."
          action={{
            label: 'Add Loan',
            onClick: () => { setEditingLoan(null); setShowDialog(true); },
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
                    <th className="px-4 py-3">Loan</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Repayment</th>
                    <th className="px-4 py-3 text-right">Annual Interest</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loans.map((loan) => {
                    const annualInterest = calculateAnnualInterest(loan);
                    return (
                      <tr
                        key={loan.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleViewDetails(loan)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{loan.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {loan.rateType} • {loan.isInterestOnly ? 'IO' : 'P&I'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getLoanTypeBadge(loan.type)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(loan.principal)}</td>
                        <td className="px-4 py-3 text-right">{formatPercent(loan.interestRateAnnual)}</td>
                        <td className="px-4 py-3 text-right">
                          <div>{formatCurrency(loan.minRepayment)}</div>
                          <div className="text-xs text-muted-foreground">{loan.repaymentFrequency.toLowerCase()}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">{formatCurrency(annualInterest)}</td>
                        <td className="px-4 py-3">
                          {loan.property ? (
                            <div className="flex items-center gap-1 text-sm">
                              <HomeIcon className="h-3 w-3" />
                              {loan.property.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(loan)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(loan)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(loan.id)}>
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
                    <td colSpan={2} className="px-4 py-3">Total ({loans.length} loans)</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totalPrincipal)}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totalAnnualInterest)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Tiles View */
        <div className="grid gap-6 md:grid-cols-2">
          {loans.map((loan) => {
            const effectiveBalance = calculateEffectiveBalance(loan);
            const annualInterest = calculateAnnualInterest(loan);
            const lvr = calculateLVR(loan);
            const linkedExpenses = loan.expenses?.length || 0;

            return (
              <Card key={loan.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(loan)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-muted-foreground" />
                        {loan.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getLoanTypeBadge(loan.type)}
                        <Badge variant={loan.isInterestOnly ? 'outline' : 'secondary'}>
                          {loan.isInterestOnly ? 'Interest Only' : 'P&I'}
                        </Badge>
                        <Badge variant="outline">{loan.rateType}</Badge>
                        {loan.rateType === 'FIXED' && loan.fixedExpiry && (
                          <Badge variant="outline" className="text-orange-600">
                            Fixed until {formatDate(loan.fixedExpiry)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(loan)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(loan)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(loan.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Balance</p>
                      <p className="text-xl font-bold">{formatCurrency(loan.principal)}</p>
                      {loan.offsetAccount && effectiveBalance < loan.principal && (
                        <p className="text-xs text-green-600">Effective: {formatCurrency(effectiveBalance)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                      <p className="text-xl font-bold">{formatPercent(loan.interestRateAnnual)}</p>
                      <p className="text-xs text-muted-foreground">~{formatCurrency(annualInterest)}/yr</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Min Repayment</p>
                      <p className="font-semibold">{formatCurrency(loan.minRepayment)}</p>
                      <p className="text-xs text-muted-foreground">{loan.repaymentFrequency.toLowerCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Term Remaining</p>
                      <p className="font-semibold">{loan.termMonthsRemaining} months</p>
                      <p className="text-xs text-muted-foreground">{(loan.termMonthsRemaining / 12).toFixed(1)} years</p>
                    </div>
                  </div>

                  {lvr !== null && (
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>LVR</span>
                        <span className={lvr > 80 ? 'text-orange-600 font-medium' : ''}>{lvr.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${lvr > 80 ? 'bg-orange-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(lvr, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-2">
                    {loan.property && (
                      <div className="flex items-center gap-2 text-sm">
                        <HomeIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Property:</span>
                        <span className="font-medium">{loan.property.name}</span>
                      </div>
                    )}
                    {loan.offsetAccount && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">Offset:</span>
                        <span className="font-medium text-green-600">
                          {loan.offsetAccount.name} ({formatCurrency(loan.offsetAccount.currentBalance)})
                        </span>
                      </div>
                    )}
                    {loan.linkedAsset && (
                      <div className="flex items-center gap-2 text-sm">
                        <Car className="h-4 w-4 text-blue-600" />
                        <span className="text-muted-foreground">Vehicle:</span>
                        <span className="font-medium text-blue-600">
                          {loan.linkedAsset.name} ({formatCurrency(loan.linkedAsset.currentValue)})
                        </span>
                      </div>
                    )}
                    {loan.linkedAccount && (
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-amber-600" />
                        <span className="text-muted-foreground">Account:</span>
                        <span className="font-medium text-amber-600">
                          {loan.linkedAccount.name} ({formatCurrency(loan.linkedAccount.currentBalance)})
                        </span>
                      </div>
                    )}
                    {linkedExpenses > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Linked Expenses:</span>
                        <span className="font-medium">{linkedExpenses}</span>
                      </div>
                    )}
                    {!loan.property && !loan.offsetAccount && !loan.linkedAsset && !loan.linkedAccount && linkedExpenses === 0 && (
                      <p className="text-xs text-muted-foreground">Click to view details</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {/* Phase 1b: shared LoanFormDialog used here AND on /dashboard/balances */}
      <LoanFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editing={editingLoan}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        offsetAccounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, currentBalance: a.currentBalance }))}
        allAccounts={allAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type, currentBalance: a.currentBalance }))}
        assets={assets.map((a) => ({ id: a.id, name: a.name, currentValue: a.currentValue, vehicleMake: a.vehicleMake, vehicleModel: a.vehicleModel }))}
        onSaved={() => { void loadData(); }}
      />

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              {selectedLoan?.name}
            </DialogTitle>
            <DialogDescription>
              Loan details and linked data
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="property">Property</TabsTrigger>
                <TabsTrigger value="offset">Offset</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="strategy" className="gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Strategy
                </TabsTrigger>
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Principal Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(selectedLoan.principal)}</p>
                      {selectedLoan.offsetAccount && (
                        <p className="text-sm text-green-600">
                          Effective: {formatCurrency(calculateEffectiveBalance(selectedLoan))}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Interest Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatPercent(selectedLoan.interestRateAnnual)}</p>
                      <p className="text-sm text-muted-foreground">{selectedLoan.rateType}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Annual Interest Cost</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(calculateAnnualInterest(selectedLoan))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ~{formatCurrency(calculateAnnualInterest(selectedLoan) / 12)}/month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Term Remaining</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{selectedLoan.termMonthsRemaining} months</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedLoan.termMonthsRemaining / 12).toFixed(1)} years
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Loan Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{
                        selectedLoan.type === 'HOME' ? 'Home Loan' :
                        selectedLoan.type === 'INVESTMENT' ? 'Investment Loan' :
                        selectedLoan.type === 'CAR' ? 'Car Loan' :
                        selectedLoan.type === 'PERSONAL' ? 'Personal Loan' :
                        selectedLoan.type === 'LINE_OF_CREDIT' ? 'Line of Credit' :
                        selectedLoan.type === 'STUDENT' ? 'Student / HECS-HELP' :
                        selectedLoan.type === 'BUSINESS' ? 'Business Loan' :
                        selectedLoan.type
                      }</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Repayment Type</span>
                      <span className="font-medium">{selectedLoan.isInterestOnly ? 'Interest Only' : 'Principal & Interest'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min Repayment</span>
                      <span className="font-medium">
                        {formatCurrency(selectedLoan.minRepayment)} {selectedLoan.repaymentFrequency.toLowerCase()}
                      </span>
                    </div>
                    {selectedLoan.rateType === 'FIXED' && selectedLoan.fixedExpiry && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fixed Rate Expiry</span>
                        <span className="font-medium">{formatDate(selectedLoan.fixedExpiry)}</span>
                      </div>
                    )}
                    {selectedLoan.extraRepaymentCap && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Extra Repayment Cap</span>
                        <span className="font-medium">{formatCurrency(selectedLoan.extraRepaymentCap)}/year</span>
                      </div>
                    )}
                    {calculateLVR(selectedLoan) !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LVR</span>
                        <span className={`font-medium ${calculateLVR(selectedLoan)! > 80 ? 'text-orange-600' : ''}`}>
                          {calculateLVR(selectedLoan)!.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="property" className="space-y-4 pt-4">
                {selectedLoan.property ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {selectedLoan.property.name}
                      </CardTitle>
                      {selectedLoan.property.address && (
                        <CardDescription>{selectedLoan.property.address}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Property Value</p>
                          <p className="text-xl font-bold">{formatCurrency(selectedLoan.property.currentValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Equity</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(selectedLoan.property.currentValue - selectedLoan.principal)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>LVR</span>
                          <span>{calculateLVR(selectedLoan)?.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${(calculateLVR(selectedLoan) || 0) > 80 ? 'bg-orange-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(calculateLVR(selectedLoan) || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <HomeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No property linked to this loan</p>
                    <p className="text-sm">Edit the loan to link a property</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="offset" className="space-y-4 pt-4">
                {selectedLoan.offsetAccount ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                        {selectedLoan.offsetAccount.name}
                      </CardTitle>
                      {selectedLoan.offsetAccount.institution && (
                        <CardDescription>{selectedLoan.offsetAccount.institution}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Offset Balance</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(selectedLoan.offsetAccount.currentBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Interest Savings</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(selectedLoan.offsetAccount.currentBalance * selectedLoan.interestRateAnnual)}/yr
                          </p>
                        </div>
                      </div>
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-muted-foreground">Principal Balance</p>
                              <p className="font-semibold">{formatCurrency(selectedLoan.principal)}</p>
                            </div>
                            <span className="text-2xl text-green-600">−</span>
                            <div>
                              <p className="text-sm text-muted-foreground">Offset Balance</p>
                              <p className="font-semibold text-green-600">{formatCurrency(selectedLoan.offsetAccount.currentBalance)}</p>
                            </div>
                            <span className="text-2xl">=</span>
                            <div>
                              <p className="text-sm text-muted-foreground">Effective Balance</p>
                              <p className="font-semibold">{formatCurrency(calculateEffectiveBalance(selectedLoan))}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No offset account linked to this loan</p>
                    <p className="text-sm">Edit the loan to link an offset account</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4 pt-4">
                {selectedLoan.expenses && selectedLoan.expenses.length > 0 ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Linked Expenses Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                            <p className="text-xl font-bold">{selectedLoan.expenses.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Annual Total</p>
                            <p className="text-xl font-bold text-red-600">
                              {formatCurrency(calculateLinkedExpenses(selectedLoan))}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="space-y-2">
                      {selectedLoan.expenses.map((expense) => (
                        <Card key={expense.id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{expense.name}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline">{expense.category}</Badge>
                                  {expense.isTaxDeductible && (
                                    <Badge variant="secondary" className="text-green-600">Tax Deductible</Badge>
                                  )}
                                </div>
                                {expense.vendorName && (
                                  <p className="text-xs text-muted-foreground mt-1">{expense.vendorName}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                                <p className="text-xs text-muted-foreground">{expense.frequency.toLowerCase()}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No expenses linked to this loan</p>
                    <p className="text-sm">Link expenses from the Expenses page</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="strategy" className="mt-4">
                <EntityStrategyTab
                  entityType="loan"
                  entityId={selectedLoan.id}
                  entityName={selectedLoan.name}
                />
              </TabsContent>

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedLoan._links?.related || []}
                  missingLinks={selectedLoan._meta?.missingLinks || []}
                  entityType="loan"
                  entityName={selectedLoan.name}
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
            <Button onClick={() => { setShowDetailDialog(false); if (selectedLoan) handleEdit(selectedLoan); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Loan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function LoansPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <LoansPageContent />
    </Suspense>
  );
}
