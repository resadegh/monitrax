'use client';

import { useEffect, useState } from 'react';
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
import { BarChart3, Plus, Edit2, Trash2, Eye, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Percent, Link2 } from 'lucide-react';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';

interface InvestmentAccount {
  id: string;
  name: string;
  currency?: string;
}

interface Transaction {
  id: string;
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'SPLIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  price: number;
  units: number;
  fees?: number;
  notes?: string;
}

interface InvestmentHolding {
  id: string;
  investmentAccountId: string;
  ticker: string;
  units: number;
  averagePrice: number;
  frankingPercentage: number | null;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  investmentAccount?: { id: string; name: string; currency?: string };
  transactions?: Transaction[];
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

export default function HoldingsPage() {
  const { token } = useAuth();
  const { openLinkedEntity } = useCrossModuleNavigation();

  // CMNF navigation handler for LinkedDataPanel
  const handleLinkedEntityNavigate = (entity: GRDCSLinkedEntity) => {
    setShowDetailDialog(false);
    openLinkedEntity(entity);
  };

  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<InvestmentHolding | null>(null);
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
        const result = await response.json();
        setHoldings(result.data || result);
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
        const result = await response.json();
        setAccounts(result.data || result);
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

  const handleViewDetails = (holding: InvestmentHolding) => {
    setSelectedHolding(holding);
    setShowDetailDialog(true);
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

  const formatCurrency = (amount: number, currency: string = 'AUD') =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getHoldingTypeBadge = (type: InvestmentHolding['type']) => {
    switch (type) {
      case 'SHARE':
        return <Badge variant="default">Share</Badge>;
      case 'ETF':
        return <Badge variant="secondary">ETF</Badge>;
      case 'MANAGED_FUND':
        return <Badge variant="outline">Managed Fund</Badge>;
      case 'CRYPTO':
        return <Badge className="bg-orange-100 text-orange-800">Crypto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getTransactionIcon = (type: Transaction['type']) => {
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

  const totalValue = holdings.reduce((sum, h) => sum + h.units * h.averagePrice, 0);

  // Calculate portfolio allocation percentage
  const calculateAllocation = (holding: InvestmentHolding) => {
    if (totalValue <= 0) return 0;
    return ((holding.units * holding.averagePrice) / totalValue) * 100;
  };

  // Group holdings by type for summary
  const holdingsByType = holdings.reduce((acc, h) => {
    const value = h.units * h.averagePrice;
    acc[h.type] = (acc[h.type] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <PageHeader
        title="Investment Holdings"
        description={`Manage your holdings • ${holdings.length} position(s) • Total: ${formatCurrency(totalValue)}`}
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
          {holdings.map((holding) => {
            const value = holding.units * holding.averagePrice;
            const allocation = calculateAllocation(holding);
            const currency = holding.investmentAccount?.currency || 'AUD';

            return (
              <Card key={holding.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(holding)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        {holding.ticker}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {getHoldingTypeBadge(holding.type)}
                        {holding.frankingPercentage !== null && (
                          <Badge variant="outline" className="text-green-600">
                            {holding.frankingPercentage}% franked
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(holding)}>
                        <Eye className="h-4 w-4" />
                      </Button>
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
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Market Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(value, currency)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Units</p>
                      <p className="font-medium">{holding.units.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Avg Price</p>
                      <p className="font-medium">{formatCurrency(holding.averagePrice, currency)}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Portfolio</span>
                      <span>{allocation.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(allocation, 100)}%` }}
                      />
                    </div>
                  </div>

                  {holding.investmentAccount && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">{holding.investmentAccount.name}</p>
                    </div>
                  )}

                  {holding.transactions && holding.transactions.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {holding.transactions.length} transaction(s)
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

            <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="frankingPercentage">Franking % (Optional - AU shares)</Label>
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

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {selectedHolding?.ticker}
            </DialogTitle>
            <DialogDescription>
              Holding details and transaction history
            </DialogDescription>
          </DialogHeader>

          {selectedHolding && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="linked" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Market Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatCurrency(selectedHolding.units * selectedHolding.averagePrice, selectedHolding.investmentAccount?.currency)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Allocation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{calculateAllocation(selectedHolding).toFixed(1)}%</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Units Held</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{selectedHolding.units.toLocaleString()}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Average Price</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatCurrency(selectedHolding.averagePrice, selectedHolding.investmentAccount?.currency)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Holding Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedHolding.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account</span>
                      <span className="font-medium">{selectedHolding.investmentAccount?.name || '-'}</span>
                    </div>
                    {selectedHolding.frankingPercentage !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Franking Percentage</span>
                        <span className="font-medium text-green-600">{selectedHolding.frankingPercentage}%</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transactions</span>
                      <span className="font-medium">{selectedHolding.transactions?.length || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                {selectedHolding.frankingPercentage !== null && selectedHolding.frankingPercentage > 0 && (
                  <Card className="bg-green-50 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Franking Credits (Australian Tax)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        This holding has {selectedHolding.frankingPercentage}% franking credits attached to dividends.
                        Franking credits can reduce your tax liability or result in a refund.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4 pt-4">
                {selectedHolding.transactions && selectedHolding.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {selectedHolding.transactions.map((tx) => (
                      <Card key={tx.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-3">
                              {getTransactionIcon(tx.type)}
                              <div>
                                <p className="font-medium">{tx.type.replace('_', ' ')}</p>
                                <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${tx.type === 'BUY' || tx.type === 'TRANSFER_IN' ? 'text-green-600' : tx.type === 'SELL' || tx.type === 'TRANSFER_OUT' ? 'text-red-600' : ''}`}>
                                {formatCurrency(tx.price * tx.units, selectedHolding.investmentAccount?.currency)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tx.units.toLocaleString()} @ {formatCurrency(tx.price, selectedHolding.investmentAccount?.currency)}
                              </p>
                              {tx.fees && (
                                <p className="text-xs text-muted-foreground">
                                  Fees: {formatCurrency(tx.fees, selectedHolding.investmentAccount?.currency)}
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
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions for this holding</p>
                    <p className="text-sm">Add transactions from the Transactions page</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="linked" className="mt-4">
                <LinkedDataPanel
                  linkedEntities={selectedHolding._links?.related || []}
                  missingLinks={selectedHolding._meta?.missingLinks || []}
                  entityType="investmentHolding"
                  entityName={selectedHolding.ticker}
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
            <Button onClick={() => { setShowDetailDialog(false); if (selectedHolding) handleEdit(selectedHolding); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Holding
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
