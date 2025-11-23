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
import { TrendingUp, Plus, Edit2, Trash2, Eye, BarChart3, ArrowUpRight, ArrowDownRight, DollarSign, Receipt, Wallet, Link2 } from 'lucide-react';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

interface InvestmentHolding {
  id: string;
  ticker: string;
  units: number;
  averagePrice: number;
  frankingPercentage?: number;
  type: 'SHARES' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO' | 'BOND' | 'OTHER';
}

interface InvestmentTransaction {
  id: string;
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'SPLIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  price: number;
  units: number;
  fees?: number;
  notes?: string;
  holding?: { ticker: string };
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

interface InvestmentAccount {
  id: string;
  name: string;
  type: 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
  platform: string | null;
  currency: string;
  holdings?: InvestmentHolding[];
  transactions?: InvestmentTransaction[];
  incomes?: Income[];
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

function InvestmentAccountsPageContent() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false);
    openLinkedEntity(entity);
  };

  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InvestmentAccount | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InvestmentAccount>>({
    name: '',
    type: 'BROKERAGE',
    platform: '',
    currency: 'AUD',
  });

  useEffect(() => {
    if (token) loadAccounts();
  }, [token]);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/investments/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setAccounts(result.data || result);
      }
    } catch (error) {
      console.error('Error loading investment accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/investments/accounts/${editingId}` : '/api/investments/accounts';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadAccounts();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving investment account:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'BROKERAGE',
      platform: '',
      currency: 'AUD',
    });
  };

  const handleEdit = (account: InvestmentAccount) => {
    setFormData({
      name: account.name,
      type: account.type,
      platform: account.platform || '',
      currency: account.currency,
    });
    setEditingId(account.id);
    setShowDialog(true);
  };

  const handleViewDetails = (account: InvestmentAccount) => {
    setSelectedAccount(account);
    setShowDetailDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment account?')) return;

    try {
      await fetch(`/api/investments/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadAccounts();
    } catch (error) {
      console.error('Error deleting investment account:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'AUD') => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
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

  // Calculate total value of holdings in an account
  const calculateTotalValue = (account: InvestmentAccount) => {
    if (!account.holdings || account.holdings.length === 0) return 0;
    return account.holdings.reduce((sum, h) => sum + (h.units * h.averagePrice), 0);
  };

  // Calculate total cost basis
  const calculateCostBasis = (account: InvestmentAccount) => {
    if (!account.holdings || account.holdings.length === 0) return 0;
    return account.holdings.reduce((sum, h) => sum + (h.units * h.averagePrice), 0);
  };

  // Calculate linked income
  const calculateLinkedIncome = (account: InvestmentAccount) => {
    if (!account.incomes || account.incomes.length === 0) return 0;
    return account.incomes.reduce((sum, i) => sum + convertToAnnual(i.amount, i.frequency), 0);
  };

  // Calculate linked expenses
  const calculateLinkedExpenses = (account: InvestmentAccount) => {
    if (!account.expenses || account.expenses.length === 0) return 0;
    return account.expenses.reduce((sum, e) => sum + convertToAnnual(e.amount, e.frequency), 0);
  };

  // Calculate total portfolio value
  const totalPortfolioValue = accounts.reduce((sum, a) => sum + calculateTotalValue(a), 0);

  const getAccountTypeBadge = (type: InvestmentAccount['type']) => {
    switch (type) {
      case 'BROKERAGE':
        return <Badge variant="default">Brokerage</Badge>;
      case 'SUPERS':
        return <Badge variant="secondary">Super</Badge>;
      case 'FUND':
        return <Badge variant="outline">Fund</Badge>;
      case 'TRUST':
        return <Badge variant="outline">Trust</Badge>;
      case 'ETF_CRYPTO':
        return <Badge className="bg-purple-100 text-purple-800">ETF/Crypto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getHoldingTypeBadge = (type: InvestmentHolding['type']) => {
    switch (type) {
      case 'SHARES':
        return <Badge variant="default">Shares</Badge>;
      case 'ETF':
        return <Badge variant="secondary">ETF</Badge>;
      case 'MANAGED_FUND':
        return <Badge variant="outline">Managed Fund</Badge>;
      case 'CRYPTO':
        return <Badge className="bg-orange-100 text-orange-800">Crypto</Badge>;
      case 'BOND':
        return <Badge className="bg-blue-100 text-blue-800">Bond</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getTransactionIcon = (type: InvestmentTransaction['type']) => {
    switch (type) {
      case 'BUY':
      case 'TRANSFER_IN':
        return <ArrowDownRight className="h-4 w-4 text-green-600" />;
      case 'SELL':
      case 'TRANSFER_OUT':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'DIVIDEND':
      case 'DISTRIBUTION':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Investment Accounts"
        description={`Manage your investment accounts • ${accounts.length} account(s) • Total: ${formatCurrency(totalPortfolioValue)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading investment accounts...</p>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No investment accounts yet"
          description="Start by adding your first investment account to track your portfolio."
          action={{
            label: 'Add Investment Account',
            onClick: () => { setShowDialog(true); resetForm(); },
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const totalValue = calculateTotalValue(account);
            const holdingsCount = account.holdings?.length || 0;
            const transactionsCount = account.transactions?.length || 0;
            const linkedIncome = account.incomes?.length || 0;
            const linkedExpenses = account.expenses?.length || 0;

            return (
              <Card key={account.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(account)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        {account.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getAccountTypeBadge(account.type)}
                        <Badge variant="outline">{account.currency}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(account)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(account.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalValue, account.currency)}</p>
                  </div>

                  {account.platform && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Platform</p>
                      <p className="font-medium">{account.platform}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Holdings</p>
                      <p className="font-semibold">{holdingsCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                      <p className="font-semibold">{transactionsCount}</p>
                    </div>
                  </div>

                  {(linkedIncome > 0 || linkedExpenses > 0) && (
                    <div className="flex gap-4 text-sm pt-2 border-t">
                      {linkedIncome > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="h-3 w-3" />
                          <span>{linkedIncome} income</span>
                        </div>
                      )}
                      {linkedExpenses > 0 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <Receipt className="h-3 w-3" />
                          <span>{linkedExpenses} expense</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Investment Account' : 'Add Investment Account'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the account details below.' : 'Enter the details for your new investment account.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., CommSec Trading"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as InvestmentAccount['type'] })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BROKERAGE">Brokerage</SelectItem>
                  <SelectItem value="SUPERS">Superannuation</SelectItem>
                  <SelectItem value="FUND">Managed Fund</SelectItem>
                  <SelectItem value="TRUST">Trust</SelectItem>
                  <SelectItem value="ETF_CRYPTO">ETF/Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform (Optional)</Label>
              <Input
                id="platform"
                value={formData.platform || ''}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                placeholder="e.g., CommSec, SelfWealth"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Account' : 'Add Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>
              Account details, holdings, and transactions
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(calculateTotalValue(selectedAccount), selectedAccount.currency)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Holdings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{selectedAccount.holdings?.length || 0}</p>
                      <p className="text-sm text-muted-foreground">positions</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Annual Income</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(calculateLinkedIncome(selectedAccount), selectedAccount.currency)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Annual Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(calculateLinkedExpenses(selectedAccount), selectedAccount.currency)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedAccount.type}</span>
                    </div>
                    {selectedAccount.platform && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform</span>
                        <span className="font-medium">{selectedAccount.platform}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Currency</span>
                      <span className="font-medium">{selectedAccount.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transactions</span>
                      <span className="font-medium">{selectedAccount.transactions?.length || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="holdings" className="space-y-4 pt-4">
                {selectedAccount.holdings && selectedAccount.holdings.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAccount.holdings.map((holding) => {
                      const value = holding.units * holding.averagePrice;
                      return (
                        <Card key={holding.id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-lg">{holding.ticker}</p>
                                <div className="flex gap-2 mt-1">
                                  {getHoldingTypeBadge(holding.type)}
                                  {holding.frankingPercentage && (
                                    <Badge variant="outline" className="text-green-600">
                                      {holding.frankingPercentage}% franked
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(value, selectedAccount.currency)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {holding.units.toLocaleString()} @ {formatCurrency(holding.averagePrice, selectedAccount.currency)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No holdings in this account</p>
                    <p className="text-sm">Add holdings from the Holdings page</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4 pt-4">
                {selectedAccount.transactions && selectedAccount.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAccount.transactions.slice(0, 10).map((tx) => (
                      <Card key={tx.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-3">
                              {getTransactionIcon(tx.type)}
                              <div>
                                <p className="font-medium">{tx.type.replace('_', ' ')}</p>
                                <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                                {tx.holding && (
                                  <Badge variant="outline" className="mt-1">{tx.holding.ticker}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${tx.type === 'BUY' || tx.type === 'TRANSFER_IN' ? 'text-green-600' : tx.type === 'SELL' || tx.type === 'TRANSFER_OUT' ? 'text-red-600' : ''}`}>
                                {formatCurrency(tx.price * tx.units, selectedAccount.currency)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tx.units.toLocaleString()} @ {formatCurrency(tx.price, selectedAccount.currency)}
                              </p>
                              {tx.fees && (
                                <p className="text-xs text-muted-foreground">
                                  Fees: {formatCurrency(tx.fees, selectedAccount.currency)}
                                </p>
                              )}
                            </div>
                          </div>
                          {tx.notes && (
                            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{tx.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {selectedAccount.transactions.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground">
                        Showing 10 of {selectedAccount.transactions.length} transactions
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowUpRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">Add transactions from the Transactions page</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cashflow" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        Linked Income
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(calculateLinkedIncome(selectedAccount), selectedAccount.currency)}/yr
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedAccount.incomes?.length || 0} income source(s)</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-red-600" />
                        Linked Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(calculateLinkedExpenses(selectedAccount), selectedAccount.currency)}/yr
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedAccount.expenses?.length || 0} expense(s)</p>
                    </CardContent>
                  </Card>
                </div>

                {selectedAccount.incomes && selectedAccount.incomes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Income Sources</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedAccount.incomes.map((income) => (
                        <div key={income.id} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{income.name}</p>
                            <Badge variant="outline">{income.type}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">{formatCurrency(income.amount, selectedAccount.currency)}</p>
                            <p className="text-xs text-muted-foreground">{income.frequency.toLowerCase()}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedAccount.expenses && selectedAccount.expenses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Expenses</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedAccount.expenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{expense.name}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline">{expense.category}</Badge>
                              {expense.isTaxDeductible && (
                                <Badge variant="secondary" className="text-green-600">Tax Deductible</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600">{formatCurrency(expense.amount, selectedAccount.currency)}</p>
                            <p className="text-xs text-muted-foreground">{expense.frequency.toLowerCase()}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {(!selectedAccount.incomes || selectedAccount.incomes.length === 0) &&
                 (!selectedAccount.expenses || selectedAccount.expenses.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No income or expenses linked</p>
                    <p className="text-sm">Link from the Income or Expenses pages</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedAccount._links?.related || []}
                  missingLinks={selectedAccount._meta?.missingLinks || []}
                  entityType="investmentAccount"
                  entityName={selectedAccount.name}
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
            <Button onClick={() => { setShowDetailDialog(false); if (selectedAccount) handleEdit(selectedAccount); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function InvestmentAccountsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <InvestmentAccountsPageContent />
    </Suspense>
  );
}
