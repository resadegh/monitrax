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
import { BarChart3, Plus, Edit2, Trash2 } from 'lucide-react';

interface InvestmentAccount {
  id: string;
  name: string;
}

interface InvestmentHolding {
  id: string;
  investmentAccountId: string;
  ticker: string;
  units: number;
  averagePrice: number;
  frankingPercentage: number | null;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  investmentAccount?: { id: string; name: string };
}

export default function HoldingsPage() {
  const { token } = useAuth();
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InvestmentHolding>>({
    investmentAccountId: '',
    ticker: '',
    units: 0,
    averagePrice: 0,
    frankingPercentage: null,
    type: 'SHARE',
  });

  useEffect(() => {
    if (token) {
      loadHoldings();
      loadAccounts();
    }
  }, [token]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/investments/holdings/${editingId}` : '/api/investments/holdings';
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
          units: Number(formData.units),
          averagePrice: Number(formData.averagePrice),
          frankingPercentage: formData.frankingPercentage ? Number(formData.frankingPercentage) : null,
        }),
      });

      if (response.ok) {
        await loadHoldings();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving holding:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      investmentAccountId: accounts[0]?.id || '',
      ticker: '',
      units: 0,
      averagePrice: 0,
      frankingPercentage: null,
      type: 'SHARE',
    });
  };

  const handleEdit = (holding: InvestmentHolding) => {
    setFormData({
      investmentAccountId: holding.investmentAccountId,
      ticker: holding.ticker,
      units: holding.units,
      averagePrice: holding.averagePrice,
      frankingPercentage: holding.frankingPercentage,
      type: holding.type,
    });
    setEditingId(holding.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holding?')) return;

    try {
      await fetch(`/api/investments/holdings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadHoldings();
    } catch (error) {
      console.error('Error deleting holding:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(amount);

  const getHoldingTypeBadge = (type: InvestmentHolding['type']) => {
    switch (type) {
      case 'SHARE':
        return <Badge variant="default">Share</Badge>;
      case 'ETF':
        return <Badge variant="secondary">ETF</Badge>;
      case 'MANAGED_FUND':
        return <Badge variant="outline">Managed Fund</Badge>;
      case 'CRYPTO':
        return <Badge variant="destructive">Crypto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalValue = holdings.reduce((sum, h) => sum + h.units * h.averagePrice, 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="Investment Holdings"
        description={`Manage your holdings • Total cost base: ${formatCurrency(totalValue)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }} disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Holding
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading holdings...</p>
          </div>
        </div>
      ) : holdings.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No holdings yet"
          description={accounts.length === 0 ? "Add an investment account first to track holdings." : "Start by adding your first holding to track your portfolio."}
          action={{
            label: accounts.length === 0 ? 'Add Account First' : 'Add Holding',
            onClick: () => { if (accounts.length > 0) { setShowDialog(true); resetForm(); } },
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {holdings.map((holding) => (
            <Card key={holding.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      {holding.ticker}
                    </CardTitle>
                    {getHoldingTypeBadge(holding.type)}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(holding)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(holding.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Units</p>
                    <p className="font-medium">{holding.units.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg Price</p>
                    <p className="font-medium">{formatCurrency(holding.averagePrice)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cost Base</p>
                  <p className="text-lg font-bold">{formatCurrency(holding.units * holding.averagePrice)}</p>
                </div>
                {holding.frankingPercentage !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Franking %</p>
                    <p className="font-medium">{holding.frankingPercentage}%</p>
                  </div>
                )}
                {holding.investmentAccount && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">{holding.investmentAccount.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Holding' : 'Add Holding'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the holding details below.' : 'Enter the details for your new holding.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="investmentAccountId">Investment Account</Label>
              <Select
                value={formData.investmentAccountId}
                onValueChange={(value) => setFormData({ ...formData, investmentAccountId: value })}
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
              <Label htmlFor="ticker">Ticker Symbol</Label>
              <Input
                id="ticker"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                placeholder="e.g., VAS, BHP"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Holding Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as InvestmentHolding['type'] })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHARE">Share</SelectItem>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="MANAGED_FUND">Managed Fund</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                </SelectContent>
              </Select>
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
                <Label htmlFor="averagePrice">Average Price ($)</Label>
                <Input
                  id="averagePrice"
                  type="number"
                  step="0.01"
                  value={formData.averagePrice}
                  onChange={(e) => setFormData({ ...formData, averagePrice: Number(e.target.value) })}
                  placeholder="50.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frankingPercentage">Franking % (Optional)</Label>
              <Input
                id="frankingPercentage"
                type="number"
                step="1"
                min="0"
                max="100"
                value={formData.frankingPercentage ?? ''}
                onChange={(e) => setFormData({ ...formData, frankingPercentage: e.target.value ? Number(e.target.value) : null })}
                placeholder="100"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Holding' : 'Add Holding'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
