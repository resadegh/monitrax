'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Wallet, Plus, Edit2, Trash2, Percent, Eye, Landmark, ArrowUpRight, ArrowDownRight, Building, Link2, LayoutGrid, List, RefreshCw, Unplug, ExternalLink, Upload } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
// SSOT (CLAUDE.md §12.2): use the existing canonical primitive
// `calculateEffectivePrincipal` from lib/utils/calculations.ts.
// Interest-savings math is preserved EXACTLY as the legacy code had
// it (per user direction: existing calculations are correct).
// Removing the previous local `calculateEffectiveLoanBalance` helper
// here was a SSOT cleanup — it was structurally identical to the
// canonical `calculateEffectivePrincipal(principal, offsetBalance)`.
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import { TransactionImportDialog } from '@/components/bank/TransactionImportDialog';
import { TransactionReviewPanel } from '@/components/bank/TransactionReviewPanel';
import { AccountDetailDialog } from '@/components/accounts/AccountDetailDialog';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

interface BasiqConnection {
  id: string;
  institutionName: string;
  institutionLogo?: string;
  status: 'ACTIVE' | 'PENDING' | 'RECONNECT' | 'DISABLED' | 'ERROR';
  lastSyncedAt?: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currentBalance: number;
  }>;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  // Match the shared AccountDetailDialog's `category?: string | null`
  // so the two types interop structurally without casts.
  category?: string | null;
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
  // Allow `null` from the server response (Prisma returns null for
  // missing optional strings). The shared AccountDetailDialog also
  // accepts `string | null | undefined` so the two types interop
  // structurally without casts.
  institution?: string | null;
  currentBalance: number;
  interestRate?: number | null;
  transactions?: Transaction[];
  linkedLoan?: LinkedLoan | null;
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
  const router = useRouter();
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

  // Basiq Open Banking state
  const [basiqConnections, setBasiqConnections] = useState<BasiqConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);

  // Transaction pagination in account detail dialog
  const [txPage, setTxPage] = useState(1);
  const TX_PER_PAGE = 20;

  // Phase 29: Import and review state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [reviewAccountId, setReviewAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadAccounts();
      loadBasiqConnections();
    }
  }, [token]);

  const loadBasiqConnections = async () => {
    try {
      const response = await fetch('/api/basiq/connections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setBasiqConnections(result.data || []);
      }
    } catch (error) {
      console.error('Error loading Basiq connections:', error);
    }
  };

  const handleConnectBank = async () => {
    setIsConnecting(true);

    try {
      // Connect using profile mobile from user settings
      const response = await fetch('/api/basiq/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const result = await response.json();
        // Open Basiq consent URL in new window
        window.open(result.data.consentUrl, '_blank', 'width=600,height=700');
        // Show message to user
        alert('A new window has opened for you to connect your bank. After connecting, click "Sync" to import your accounts.');
      } else {
        const error = await response.json();
        // If mobile is required, redirect to profile settings
        if (error.error?.code === 'MOBILE_REQUIRED') {
          const shouldRedirect = confirm(
            'To connect your bank, you need to add your Australian mobile number to your profile.\n\nClick OK to go to Profile Settings.'
          );
          if (shouldRedirect) {
            router.push('/dashboard/settings/profile');
          }
        } else {
          alert(`Failed to connect bank: ${error.error?.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error connecting bank:', error);
      alert('Failed to connect bank. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncConnection = async (connectionId?: string) => {
    setSyncingConnectionId(connectionId || 'all');
    setIsSyncing(true);
    try {
      const response = await fetch('/api/basiq/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connectionId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Synced ${result.data.accountsSynced} accounts and ${result.data.transactionsSynced} transactions`);
        // Reload accounts and connections
        await Promise.all([loadAccounts(), loadBasiqConnections()]);
      } else {
        const error = await response.json();
        alert(`Sync failed: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync. Please try again.');
    } finally {
      setIsSyncing(false);
      setSyncingConnectionId(null);
    }
  };

  const handleDisconnectBank = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this bank? Your synced accounts will remain but will no longer update automatically.')) {
      return;
    }

    try {
      const response = await fetch(`/api/basiq/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadBasiqConnections();
        await loadAccounts();
      } else {
        const error = await response.json();
        alert(`Failed to disconnect: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

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
    setTxPage(1); // Reset pagination when viewing a new account
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

  // formatCurrency imported from lib/utils/formatters
  // Full decimal currency formatting for transaction amounts
  const formatCurrencyFull = (amount: number) => formatCurrency(amount, { showCents: true });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Calculate interest savings for offset accounts.
  // Preserved EXACTLY from the legacy implementation — per user
  // direction (2026-04-29) the existing calculations on legacy and
  // current pages are correct, so this Phase 1 is purely visual /
  // flow with no calculation changes.
  const calculateInterestSavings = (account: Account) => {
    if (account.type !== 'OFFSET' || !account.linkedLoan) return 0;
    return account.currentBalance * account.linkedLoan.interestRateAnnual;
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleConnectBank} disabled={isConnecting}>
              {isConnecting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building className="mr-2 h-4 w-4" />
              )}
              Connect Bank
            </Button>
            <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Button>
          </div>
        }
      />

      {/* Connected Banks Section */}
      {basiqConnections.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4" />
                Connected Banks
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSyncConnection()}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing && syncingConnectionId === 'all' ? 'animate-spin' : ''}`} />
                Sync All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {basiqConnections.filter(c => c.status !== 'DISABLED').map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                >
                  {connection.institutionLogo ? (
                    <img
                      src={connection.institutionLogo}
                      alt={connection.institutionName}
                      className="h-8 w-8 rounded"
                    />
                  ) : (
                    <Building className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{connection.institutionName}</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={connection.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={connection.status === 'ACTIVE' ? 'bg-green-600' : ''}
                      >
                        {connection.status}
                      </Badge>
                      {connection.lastSyncedAt && (
                        <span className="text-xs text-muted-foreground">
                          Synced {new Date(connection.lastSyncedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSyncConnection(connection.id)}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing && syncingConnectionId === connection.id ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDisconnectBank(connection.id)}
                    >
                      <Unplug className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {basiqConnections.some(c => c.accounts.length > 0) && (
              <p className="text-xs text-muted-foreground mt-3">
                {basiqConnections.reduce((sum, c) => sum + c.accounts.length, 0)} accounts synced from connected banks
              </p>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Phase 1 of accounts-page retirement: shared AccountDetailDialog used here AND on /dashboard/balances */}
      <AccountDetailDialog
        account={selectedAccount}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        onEdit={handleEdit}
        onImportClick={() => setShowImportDialog(true)}
        onLinkedEntityNavigate={handleLinkedEntityNavigate}
      />

      {/* Phase 29: Import Dialog - supports both account-specific and main page import */}
      <TransactionImportDialog
        accountId={selectedAccount?.id}
        accountName={selectedAccount?.name}
        accounts={accounts.map(a => ({ id: a.id, name: a.name, type: a.type, institution: a.institution ?? undefined }))}
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={(batchId, accountId, needsReview) => {
          setShowImportDialog(false);
          if (needsReview) {
            setReviewBatchId(batchId);
            setReviewAccountId(accountId);
            setShowReviewPanel(true);
          } else {
            // Reload accounts to show new data
            loadAccounts();
          }
        }}
        onAccountCreated={() => {
          // Reload accounts list when new account created
          loadAccounts();
        }}
      />

      {/* Phase 29: Review Panel Dialog */}
      {reviewBatchId && reviewAccountId && (
        <Dialog open={showReviewPanel} onOpenChange={setShowReviewPanel}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <TransactionReviewPanel
              accountId={reviewAccountId}
              batchId={reviewBatchId}
              onComplete={() => {
                setShowReviewPanel(false);
                setReviewBatchId(null);
                setReviewAccountId(null);
                loadAccounts();
              }}
              onCancel={() => {
                setShowReviewPanel(false);
                setReviewBatchId(null);
                setReviewAccountId(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
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
