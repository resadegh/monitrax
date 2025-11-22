'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowUpDown, Plus, Edit2, Trash2, Eye, TrendingUp, TrendingDown,
  DollarSign, Receipt, Wallet, BarChart3, Calendar, FileText, Briefcase
} from 'lucide-react';

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  platform: string | null;
  currency: string;
}

interface InvestmentHolding {
  id: string;
  ticker: string;
  units: number;
  averagePrice: number;
  frankingPercentage: number | null;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  investmentAccountId: string;
  investmentAccount?: InvestmentAccount;
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
  createdAt: string;
  updatedAt: string;
  investmentAccount?: InvestmentAccount;
  holding?: InvestmentHolding | null;
}

export default function TransactionsPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<InvestmentTransaction | null>(null);
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
      if (selectedTransaction?.id === id) {
        setShowDetailDialog(false);
        setSelectedTransaction(null);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleViewDetails = (transaction: InvestmentTransaction) => {
    setSelectedTransaction(transaction);
    setShowDetailDialog(true);
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

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getTransactionTypeBadge = (type: InvestmentTransaction['type']) => {
    switch (type) {
      case 'BUY':
        return <Badge className="bg-green-600 hover:bg-green-700">Buy</Badge>;
      case 'SELL':
        return <Badge variant="destructive">Sell</Badge>;
      case 'DIVIDEND':
        return <Badge className="bg-blue-600 hover:bg-blue-700">Dividend</Badge>;
      case 'DISTRIBUTION':
        return <Badge className="bg-purple-600 hover:bg-purple-700">Distribution</Badge>;
      case 'DRP':
        return <Badge variant="outline">DRP</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
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
        return <Badge className="bg-orange-600 hover:bg-orange-700">Crypto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const filteredHoldings = holdings.filter(
    (h) => !formData.investmentAccountId || h.investmentAccountId === formData.investmentAccountId
  );

  // Calculate summary statistics
  const stats = transactions.reduce(
    (acc, t) => {
      const value = t.price * t.units;
      const fees = t.fees || 0;

      if (t.type === 'BUY') {
        acc.totalBuys += value;
        acc.buyCount++;
      } else if (t.type === 'SELL') {
        acc.totalSells += value;
        acc.sellCount++;
      } else if (t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION') {
        acc.totalDividends += value;
        acc.dividendCount++;
      } else if (t.type === 'DRP') {
        acc.drpCount++;
      }
      acc.totalFees += fees;
      return acc;
    },
    { totalBuys: 0, totalSells: 0, totalDividends: 0, totalFees: 0, buyCount: 0, sellCount: 0, dividendCount: 0, drpCount: 0 }
  );

  const calculateTransactionTotal = (t: InvestmentTransaction) => {
    const grossValue = t.price * t.units;
    const fees = t.fees || 0;

    if (t.type === 'BUY') {
      return grossValue + fees; // Total cost for buys
    } else if (t.type === 'SELL') {
      return grossValue - fees; // Net proceeds for sells
    }
    return grossValue; // For dividends/distributions
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Investment Transactions"
        description={`Track your buy/sell activity and dividends`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }} disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        }
      />

      {/* Summary Statistics */}
      {transactions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <StatCard
            title="Total Purchases"
            value={formatCurrency(stats.totalBuys)}
            description={`${stats.buyCount} buy transaction${stats.buyCount !== 1 ? 's' : ''}`}
            variant="green"
          />
          <StatCard
            title="Total Sales"
            value={formatCurrency(stats.totalSells)}
            description={`${stats.sellCount} sell transaction${stats.sellCount !== 1 ? 's' : ''}`}
            variant="orange"
          />
          <StatCard
            title="Dividends Received"
            value={formatCurrency(stats.totalDividends)}
            description={`${stats.dividendCount} payment${stats.dividendCount !== 1 ? 's' : ''}`}
            variant="blue"
          />
          <StatCard
            title="Total Fees Paid"
            value={formatCurrency(stats.totalFees)}
            description={`Across all transactions`}
            variant="purple"
          />
        </div>
      )}

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
          {transactions.map((transaction) => {
            const totalValue = calculateTransactionTotal(transaction);
            const isBuy = transaction.type === 'BUY';
            const isSell = transaction.type === 'SELL';
            const isIncome = transaction.type === 'DIVIDEND' || transaction.type === 'DISTRIBUTION';

            return (
              <Card
                key={transaction.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewDetails(transaction)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isBuy ? 'bg-green-100 dark:bg-green-900/30' :
                        isSell ? 'bg-red-100 dark:bg-red-900/30' :
                        isIncome ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        {isBuy ? <TrendingUp className="h-5 w-5 text-green-600" /> :
                         isSell ? <TrendingDown className="h-5 w-5 text-red-600" /> :
                         isIncome ? <DollarSign className="h-5 w-5 text-blue-600" /> :
                         <ArrowUpDown className="h-5 w-5 text-gray-600" />}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {transaction.holding?.ticker || 'Cash Transaction'}
                          {getTransactionTypeBadge(transaction.type)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(transaction.date)} • {transaction.investmentAccount?.name || 'Unknown Account'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(transaction)}>
                        <Eye className="h-4 w-4" />
                      </Button>
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
                      <p className="font-medium">{transaction.units.toLocaleString('en-AU', { maximumFractionDigits: 4 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-medium">{formatCurrency(transaction.price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fees</p>
                      <p className="font-medium">{transaction.fees ? formatCurrency(transaction.fees) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {isBuy ? 'Total Cost' : isSell ? 'Net Proceeds' : 'Value'}
                      </p>
                      <p className={`font-semibold ${
                        isBuy ? 'text-green-600' :
                        isSell ? 'text-red-600' :
                        isIncome ? 'text-blue-600' : ''
                      }`}>
                        {formatCurrency(totalValue)}
                      </p>
                    </div>
                  </div>
                  {transaction.notes && (
                    <p className="text-sm text-muted-foreground mt-2 pt-2 border-t truncate">
                      {transaction.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog with Tabs */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTransaction?.holding?.ticker || 'Transaction'}
              {selectedTransaction && getTransactionTypeBadge(selectedTransaction.type)}
            </DialogTitle>
            <DialogDescription>
              {selectedTransaction && formatDate(selectedTransaction.date)}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="holding" disabled={!selectedTransaction.holding}>Holding</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Transaction Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Gross Value</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(selectedTransaction.price * selectedTransaction.units)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {selectedTransaction.type === 'BUY' ? 'Total Cost (incl. fees)' :
                       selectedTransaction.type === 'SELL' ? 'Net Proceeds (after fees)' : 'Net Value'}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(calculateTransactionTotal(selectedTransaction))}
                    </p>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> Transaction Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Transaction Type</p>
                      <div>{getTransactionTypeBadge(selectedTransaction.type)}</div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium">{formatDate(selectedTransaction.date)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Units</p>
                      <p className="font-medium">
                        {selectedTransaction.units.toLocaleString('en-AU', { maximumFractionDigits: 6 })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Price per Unit</p>
                      <p className="font-medium">{formatCurrency(selectedTransaction.price)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Brokerage/Fees</p>
                      <p className="font-medium">
                        {selectedTransaction.fees ? formatCurrency(selectedTransaction.fees) : 'None'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Fee Impact</p>
                      <p className="font-medium text-amber-600">
                        {selectedTransaction.fees && selectedTransaction.price * selectedTransaction.units > 0
                          ? `${((selectedTransaction.fees / (selectedTransaction.price * selectedTransaction.units)) * 100).toFixed(2)}%`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedTransaction.notes && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Notes
                    </h4>
                    <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      {selectedTransaction.notes}
                    </p>
                  </div>
                )}

                {/* CGT Relevance for Sell Transactions */}
                {selectedTransaction.type === 'SELL' && selectedTransaction.holding && (
                  <div className="space-y-2 p-4 border rounded-lg border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                    <h4 className="font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <DollarSign className="h-4 w-4" /> CGT Considerations
                    </h4>
                    <p className="text-sm text-amber-600 dark:text-amber-300">
                      This sell transaction may trigger a Capital Gains Tax event.
                      Consider the holding period for 50% CGT discount eligibility (12+ months).
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Sale Proceeds</p>
                        <p className="font-medium">{formatCurrency(selectedTransaction.price * selectedTransaction.units)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Estimated Cost Base</p>
                        <p className="font-medium">
                          {formatCurrency(selectedTransaction.holding.averagePrice * selectedTransaction.units)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="pt-4 border-t text-xs text-muted-foreground">
                  <p>Created: {formatDateTime(selectedTransaction.createdAt)}</p>
                  <p>Updated: {formatDateTime(selectedTransaction.updatedAt)}</p>
                </div>
              </TabsContent>

              <TabsContent value="holding" className="space-y-4 mt-4">
                {selectedTransaction.holding ? (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <BarChart3 className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-lg">{selectedTransaction.holding.ticker}</p>
                        <div className="flex gap-2">
                          {getHoldingTypeBadge(selectedTransaction.holding.type)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Current Units</p>
                        <p className="font-medium">
                          {selectedTransaction.holding.units.toLocaleString('en-AU', { maximumFractionDigits: 4 })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Average Price</p>
                        <p className="font-medium">{formatCurrency(selectedTransaction.holding.averagePrice)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Cost Base</p>
                        <p className="font-medium">
                          {formatCurrency(selectedTransaction.holding.units * selectedTransaction.holding.averagePrice)}
                        </p>
                      </div>
                      {selectedTransaction.holding.frankingPercentage !== null && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Franking %</p>
                          <p className="font-medium">{selectedTransaction.holding.frankingPercentage}%</p>
                        </div>
                      )}
                    </div>

                    {/* Transaction vs Holding Comparison */}
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">This Transaction vs Holding</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Transaction Price</p>
                          <p className="font-medium">{formatCurrency(selectedTransaction.price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Holding Avg Price</p>
                          <p className="font-medium">{formatCurrency(selectedTransaction.holding.averagePrice)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Price Difference</p>
                          <p className={`font-medium ${
                            selectedTransaction.price > selectedTransaction.holding.averagePrice
                              ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(selectedTransaction.price - selectedTransaction.holding.averagePrice)}
                            {' '}
                            ({selectedTransaction.price > selectedTransaction.holding.averagePrice ? '+' : ''}
                            {(((selectedTransaction.price - selectedTransaction.holding.averagePrice) / selectedTransaction.holding.averagePrice) * 100).toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No holding linked to this transaction</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="account" className="space-y-4 mt-4">
                {selectedTransaction.investmentAccount ? (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <Briefcase className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-lg">{selectedTransaction.investmentAccount.name}</p>
                        <Badge variant="outline">{selectedTransaction.investmentAccount.type}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Account Type</p>
                        <p className="font-medium">{selectedTransaction.investmentAccount.type}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Platform</p>
                        <p className="font-medium">{selectedTransaction.investmentAccount.platform || 'Not specified'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Currency</p>
                        <p className="font-medium">{selectedTransaction.investmentAccount.currency}</p>
                      </div>
                    </div>

                    {/* Account Transaction Summary */}
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Account Activity Summary</h4>
                      <div className="space-y-2">
                        {(() => {
                          const accountTxns = transactions.filter(
                            t => t.investmentAccountId === selectedTransaction.investmentAccountId
                          );
                          const buys = accountTxns.filter(t => t.type === 'BUY');
                          const sells = accountTxns.filter(t => t.type === 'SELL');
                          const dividends = accountTxns.filter(t => t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION');

                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Transactions</span>
                                <span className="font-medium">{accountTxns.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Buy Orders</span>
                                <span className="font-medium text-green-600">{buys.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Sell Orders</span>
                                <span className="font-medium text-red-600">{sells.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Dividend Payments</span>
                                <span className="font-medium text-blue-600">{dividends.length}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Account information not available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedTransaction) {
                  handleEdit(selectedTransaction);
                  setShowDetailDialog(false);
                }
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
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

            {/* Live calculation preview */}
            {formData.units && formData.price && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Value:</span>
                  <span className="font-medium">{formatCurrency((formData.units || 0) * (formData.price || 0))}</span>
                </div>
                {formData.fees && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formData.type === 'BUY' ? 'Total Cost:' : 'Net Proceeds:'}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(
                        formData.type === 'BUY'
                          ? (formData.units || 0) * (formData.price || 0) + (formData.fees || 0)
                          : (formData.units || 0) * (formData.price || 0) - (formData.fees || 0)
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

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
