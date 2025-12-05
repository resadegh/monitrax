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
import { Wallet, Plus, Edit2, Trash2, Percent, Eye, Landmark, ArrowUpRight, ArrowDownRight, Building, Link2, LayoutGrid, List } from 'lucide-react';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category?: string;
}

interface LinkedLoan {
  id: string;
  name: string;
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
}

interface Account {
  id: string;
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  institution?: string;
  currentBalance: number;
  interestRate?: number;
  transactions?: Transaction[];
  linkedLoan?: LinkedLoan;
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

type ViewMode = 'tiles' | 'list';

function AccountsPageContent() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false);
    openLinkedEntity(entity);
  };

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    type: 'TRANSACTIONAL',
    institution: '',
    currentBalance: 0,
    interestRate: 0,
  });

  useEffect(() => {
    if (token) loadAccounts();
  }, [token]);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setAccounts(result.data || result);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/accounts/${editingId}` : '/api/accounts';
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
          currentBalance: Number(formData.currentBalance),
          interestRate: formData.interestRate ? Number(formData.interestRate) / 100 : null,
          institution: formData.institution || null,
        }),
      });

      if (response.ok) {
        await loadAccounts();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'TRANSACTIONAL',
      institution: '',
      currentBalance: 0,
      interestRate: 0,
    });
  };

  const handleEdit = (account: Account) => {
    setFormData({
      name: account.name,
      type: account.type,
      institution: account.institution || '',
      currentBalance: account.currentBalance,
      interestRate: account.interestRate ? account.interestRate * 100 : 0,
    });
    setEditingId(account.id);
    setShowDialog(true);
  };

  const handleViewDetails = (account: Account) => {
    setSelectedAccount(account);
    setShowDetailDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Calculate interest savings for offset accounts
  const calculateInterestSavings = (account: Account) => {
    if (account.type !== 'OFFSET' || !account.linkedLoan) return 0;
    return account.currentBalance * account.linkedLoan.interestRateAnnual;
  };

  // Calculate effective loan balance
  const calculateEffectiveLoanBalance = (account: Account) => {
    if (!account.linkedLoan) return 0;
    return Math.max(0, account.linkedLoan.principal - account.currentBalance);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalSavingsInterest = accounts
    .filter(a => a.type === 'SAVINGS' && a.interestRate)
    .reduce((sum, a) => sum + (a.currentBalance * (a.interestRate || 0)), 0);
  const totalOffsetSavings = accounts
    .filter(a => a.type === 'OFFSET' && a.linkedLoan)
    .reduce((sum, a) => sum + calculateInterestSavings(a), 0);

  const getAccountTypeBadge = (type: Account['type']) => {
    switch (type) {
      case 'OFFSET':
        return <Badge variant="default" className="bg-green-600">Offset</Badge>;
      case 'SAVINGS':
        return <Badge variant="secondary">Savings</Badge>;
      case 'CREDIT_CARD':
        return <Badge variant="destructive">Credit Card</Badge>;
      default:
        return <Badge variant="outline">Transactional</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Accounts"
        description={`Manage your bank accounts • Total balance: ${formatCurrency(totalBalance)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        }
      />

      {/* View Mode Toggle */}
      {accounts.length > 0 && !isLoading && (
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
            <p className="text-sm text-muted-foreground">Loading accounts...</p>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Start by adding your first bank account to track your balances and finances."
          action={{
            label: 'Add Account',
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
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Interest Rate</th>
                    <th className="px-4 py-3">Linked Loan</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accounts.map((account) => {
                    const interestSavings = calculateInterestSavings(account);
                    return (
                      <tr
                        key={account.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleViewDetails(account)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{account.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getAccountTypeBadge(account.type)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{account.institution || '-'}</td>
                        <td className={`px-4 py-3 text-right font-medium ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(account.currentBalance)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {account.interestRate ? `${(account.interestRate * 100).toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {account.linkedLoan ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Landmark className="h-3 w-3" />
                              <span>{account.linkedLoan.name}</span>
                              {interestSavings > 0 && (
                                <span className="text-xs text-green-600">({formatCurrency(interestSavings)}/yr)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(account)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(account)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(account.id)}>
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
                    <td colSpan={3} className="px-4 py-3">Total ({accounts.length} accounts)</td>
                    <td className={`px-4 py-3 text-right ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(totalBalance)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Tiles View */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const interestSavings = calculateInterestSavings(account);
            const hasLinkedLoan = account.type === 'OFFSET' && account.linkedLoan;

            return (
              <Card key={account.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(account)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                        {account.name}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getAccountTypeBadge(account.type)}
                        {account.institution && (
                          <Badge variant="outline">{account.institution}</Badge>
                        )}
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
                    <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                    <p className={`text-2xl font-bold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.currentBalance)}
                    </p>
                  </div>

                  {account.interestRate && account.type !== 'OFFSET' && (
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Interest Rate</p>
                        <p className="font-medium">{(account.interestRate * 100).toFixed(2)}% p.a.</p>
                      </div>
                    </div>
                  )}

                  {hasLinkedLoan && (
                    <div className="pt-4 border-t space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Landmark className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">Linked to:</span>
                        <span className="font-medium">{account.linkedLoan!.name}</span>
                      </div>
                      {interestSavings > 0 && (
                        <p className="text-sm text-green-600 font-medium">
                          Saving ~{formatCurrency(interestSavings)}/yr in interest
                        </p>
                      )}
                    </div>
                  )}

                  {account.transactions && account.transactions.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        {account.transactions.length} transaction(s)
                      </p>
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
            <DialogTitle>{editingId ? 'Edit Account' : 'Add New Account'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the account details below.' : 'Enter the details for your new account.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Everyday Account"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Account Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as Account['type'] })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                    <SelectItem value="SAVINGS">Savings</SelectItem>
                    <SelectItem value="OFFSET">Offset</SelectItem>
                    <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={formData.institution || ''}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  placeholder="e.g., CBA, Westpac"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentBalance">Current Balance</Label>
                <Input
                  id="currentBalance"
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, currentBalance: Number(e.target.value) })}
                  placeholder="10000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">Interest Rate (% p.a.)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  value={formData.interestRate || ''}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="2.5"
                />
              </div>
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>
              Account details and transactions
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className={`grid w-full ${selectedAccount.type === 'OFFSET' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                {selectedAccount.type === 'OFFSET' && (
                  <TabsTrigger value="offset">Offset Details</TabsTrigger>
                )}
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${selectedAccount.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(selectedAccount.currentBalance)}
                      </p>
                    </CardContent>
                  </Card>

                  {selectedAccount.interestRate && selectedAccount.type !== 'OFFSET' && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Interest Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{(selectedAccount.interestRate * 100).toFixed(2)}%</p>
                        <p className="text-sm text-muted-foreground">p.a.</p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedAccount.type === 'OFFSET' && selectedAccount.linkedLoan && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Interest Savings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(calculateInterestSavings(selectedAccount))}
                        </p>
                        <p className="text-sm text-muted-foreground">per year</p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedAccount.type === 'SAVINGS' && selectedAccount.interestRate && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Annual Interest</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(selectedAccount.currentBalance * selectedAccount.interestRate)}
                        </p>
                        <p className="text-sm text-muted-foreground">estimated</p>
                      </CardContent>
                    </Card>
                  )}
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
                    {selectedAccount.institution && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Institution</span>
                        <span className="font-medium">{selectedAccount.institution}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transactions</span>
                      <span className="font-medium">{selectedAccount.transactions?.length || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4 pt-4">
                {selectedAccount.transactions && selectedAccount.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAccount.transactions.slice(0, 15).map((tx) => (
                      <Card key={tx.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-3">
                              {tx.type === 'CREDIT' ? (
                                <ArrowDownRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-red-600" />
                              )}
                              <div>
                                <p className="font-medium">{tx.description}</p>
                                <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                                {tx.category && (
                                  <Badge variant="outline" className="mt-1">{tx.category}</Badge>
                                )}
                              </div>
                            </div>
                            <p className={`font-semibold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {selectedAccount.transactions.length > 15 && (
                      <p className="text-center text-sm text-muted-foreground">
                        Showing 15 of {selectedAccount.transactions.length} transactions
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowUpRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions recorded</p>
                    <p className="text-sm">Transaction history will appear here</p>
                  </div>
                )}
              </TabsContent>

              {selectedAccount.type === 'OFFSET' && (
                <TabsContent value="offset" className="space-y-4 pt-4">
                  {selectedAccount.linkedLoan ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Landmark className="h-5 w-5" />
                            {selectedAccount.linkedLoan.name}
                          </CardTitle>
                          <CardDescription>Linked loan details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Loan Principal</p>
                              <p className="text-xl font-bold">{formatCurrency(selectedAccount.linkedLoan.principal)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                              <p className="text-xl font-bold">{(selectedAccount.linkedLoan.interestRateAnnual * 100).toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Rate Type</p>
                              <Badge variant="outline">{selectedAccount.linkedLoan.rateType}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Repayment Type</p>
                              <Badge variant="outline">
                                {selectedAccount.linkedLoan.isInterestOnly ? 'Interest Only' : 'P&I'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-green-50 border-green-200">
                        <CardHeader>
                          <CardTitle className="text-sm text-green-800">Offset Calculation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-muted-foreground">Loan Principal</p>
                              <p className="font-semibold">{formatCurrency(selectedAccount.linkedLoan.principal)}</p>
                            </div>
                            <span className="text-2xl text-green-600">−</span>
                            <div>
                              <p className="text-sm text-muted-foreground">Offset Balance</p>
                              <p className="font-semibold text-green-600">{formatCurrency(selectedAccount.currentBalance)}</p>
                            </div>
                            <span className="text-2xl">=</span>
                            <div>
                              <p className="text-sm text-muted-foreground">Effective Balance</p>
                              <p className="font-semibold">{formatCurrency(calculateEffectiveLoanBalance(selectedAccount))}</p>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-green-200">
                            <div className="flex justify-between">
                              <span className="text-green-800">Annual Interest Savings</span>
                              <span className="font-bold text-green-600">{formatCurrency(calculateInterestSavings(selectedAccount))}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Monthly Savings</span>
                              <span className="font-medium text-green-600">{formatCurrency(calculateInterestSavings(selectedAccount) / 12)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No loan linked to this offset account</p>
                      <p className="text-sm">Link this account to a loan from the Loans page</p>
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedAccount._links?.related || []}
                  missingLinks={selectedAccount._meta?.missingLinks || []}
                  entityType="account"
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
export default function AccountsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <AccountsPageContent />
    </Suspense>
  );
}
