'use client';

import { useEffect, useState } from 'react';
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
import { ArrowUpDown, Plus, Edit2, Trash2 } from 'lucide-react';

interface InvestmentAccount {
  id: string;
  name: string;
}

interface InvestmentHolding {
  id: string;
  ticker: string;
  investmentAccountId: string;
}

interface InvestmentTransaction {
  id: string;
  investmentAccountId: string;
  holdingId: string | null;
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'DRP';
  price: number;
  units: number;
  fees: number | null;
  notes: string | null;
  investmentAccount?: { id: string; name: string };
  holding?: { id: string; ticker: string } | null;
}

export default function TransactionsPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InvestmentTransaction>>({
    investmentAccountId: '',
    holdingId: null,
    date: new Date().toISOString().split('T')[0],
    type: 'BUY',
    price: 0,
    units: 0,
    fees: null,
    notes: '',
  });

  useEffect(() => {
    if (token) {
      loadTransactions();
      loadAccounts();
      loadHoldings();
    }
  }, [token]);

  const loadTransactions = async () => {
    try {
      const response = await fetch('/api/investments/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setTransactions(await response.json());
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/investments/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setAccounts(await response.json());
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadHoldings = async () => {
    try {
      const response = await fetch('/api/investments/holdings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setHoldings(await response.json());
      }
    } catch (error) {
      console.error('Error loading holdings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/investments/transactions/${editingId}` : '/api/investments/transactions';
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
          price: Number(formData.price),
          units: Number(formData.units),
          fees: formData.fees ? Number(formData.fees) : null,
          holdingId: formData.holdingId || null,
        }),
      });

      if (response.ok) {
        await loadTransactions();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      investmentAccountId: accounts[0]?.id || '',
      holdingId: null,
      date: new Date().toISOString().split('T')[0],
      type: 'BUY',
      price: 0,
      units: 0,
      fees: null,
      notes: '',
    });
  };

  const handleEdit = (transaction: InvestmentTransaction) => {
    setFormData({
      investmentAccountId: transaction.investmentAccountId,
      holdingId: transaction.holdingId,
      date: new Date(transaction.date).toISOString().split('T')[0],
      type: transaction.type,
      price: transaction.price,
      units: transaction.units,
      fees: transaction.fees,
      notes: transaction.notes || '',
    });
    setEditingId(transaction.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await fetch(`/api/investments/transactions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getTransactionTypeBadge = (type: InvestmentTransaction['type']) => {
    switch (type) {
      case 'BUY':
        return <Badge variant="default">Buy</Badge>;
      case 'SELL':
        return <Badge variant="destructive">Sell</Badge>;
      case 'DIVIDEND':
        return <Badge variant="secondary">Dividend</Badge>;
      case 'DISTRIBUTION':
        return <Badge variant="secondary">Distribution</Badge>;
      case 'DRP':
        return <Badge variant="outline">DRP</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const filteredHoldings = holdings.filter(
    (h) => !formData.investmentAccountId || h.investmentAccountId === formData.investmentAccountId
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Investment Transactions"
        description={`Track your buy/sell activity • ${transactions.length} transaction(s)`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }} disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ArrowUpDown}
          title="No transactions yet"
          description={accounts.length === 0 ? "Add an investment account first." : "Record your first buy or sell transaction."}
          action={{
            label: accounts.length === 0 ? 'Add Account First' : 'Add Transaction',
            onClick: () => { if (accounts.length > 0) { setShowDialog(true); resetForm(); } },
          }}
        />
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {transaction.holding?.ticker || 'N/A'}
                        {getTransactionTypeBadge(transaction.type)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{formatDate(transaction.date)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(transaction)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Units</p>
                    <p className="font-medium">{transaction.units.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium">{formatCurrency(transaction.price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-medium">{formatCurrency(transaction.price * transaction.units)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fees</p>
                    <p className="font-medium">{transaction.fees ? formatCurrency(transaction.fees) : '-'}</p>
                  </div>
                </div>
                {transaction.notes && (
                  <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{transaction.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the transaction details below.' : 'Record a new investment transaction.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="investmentAccountId">Investment Account</Label>
              <Select
                value={formData.investmentAccountId}
                onValueChange={(value) => setFormData({ ...formData, investmentAccountId: value, holdingId: null })}
              >
                <SelectTrigger id="investmentAccountId">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="holdingId">Holding (Optional)</Label>
              <Select
                value={formData.holdingId || ''}
                onValueChange={(value) => setFormData({ ...formData, holdingId: value || null })}
              >
                <SelectTrigger id="holdingId">
                  <SelectValue placeholder="Select holding" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredHoldings.map((holding) => (
                    <SelectItem key={holding.id} value={holding.id}>{holding.ticker}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as InvestmentTransaction['type'] })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                    <SelectItem value="DIVIDEND">Dividend</SelectItem>
                    <SelectItem value="DISTRIBUTION">Distribution</SelectItem>
                    <SelectItem value="DRP">DRP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="units">Units</Label>
                <Input
                  id="units"
                  type="number"
                  step="0.0001"
                  value={formData.units}
                  onChange={(e) => setFormData({ ...formData, units: Number(e.target.value) })}
                  placeholder="100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  placeholder="50.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fees">Fees ($) - Optional</Label>
              <Input
                id="fees"
                type="number"
                step="0.01"
                value={formData.fees ?? ''}
                onChange={(e) => setFormData({ ...formData, fees: e.target.value ? Number(e.target.value) : null })}
                placeholder="9.50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Transaction' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
