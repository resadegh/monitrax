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
import { TrendingUp, Plus, Edit2, Trash2 } from 'lucide-react';

interface InvestmentAccount {
  id: string;
  name: string;
  type: 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
  platform: string | null;
  currency: string;
  holdings?: { id: string }[];
}

export default function InvestmentAccountsPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
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
        setAccounts(await response.json());
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
        return <Badge variant="destructive">ETF/Crypto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Investment Accounts"
        description={`Manage your investment accounts • ${accounts.length} account(s)`}
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
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      {account.name}
                    </CardTitle>
                    {getAccountTypeBadge(account.type)}
                  </div>
                  <div className="flex gap-2">
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
                {account.platform && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Platform</p>
                    <p className="font-medium">{account.platform}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Currency</p>
                  <p className="font-medium">{account.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Holdings</p>
                  <p className="font-medium">{account.holdings?.length || 0} holding(s)</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </DashboardLayout>
  );
}
