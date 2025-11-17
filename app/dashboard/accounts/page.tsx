'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface Account {
  id: string;
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  currentBalance: number;
  interestRate?: number;
}

export default function AccountsPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    type: 'TRANSACTIONAL',
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
        setAccounts(await response.json());
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
        }),
      });

      if (response.ok) {
        await loadAccounts();
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', type: 'TRANSACTIONAL', currentBalance: 0, interestRate: 0 });
      }
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
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
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Accounts</h1>
            <p className="text-gray-600 mt-1">Total Balance: {formatCurrency(totalBalance)}</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Account
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit' : 'Add'} Account</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Everyday Account"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'] })}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TRANSACTIONAL">Transactional</option>
                  <option value="SAVINGS">Savings</option>
                  <option value="OFFSET">Offset</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                <input
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="10000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interest Rate (% p.a.) - Optional
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.interestRate ? formData.interestRate : ''}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="2.5"
                />
              </div>

              <div className="col-span-2 flex gap-4">
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  {editingId ? 'Update' : 'Add'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-300 rounded-md">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No accounts added yet</p>
            <button onClick={() => setShowForm(true)} className="text-indigo-600 hover:text-indigo-700 font-medium">
              Add your first account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{account.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                      account.type === 'OFFSET' ? 'bg-green-100 text-green-800' :
                      account.type === 'SAVINGS' ? 'bg-blue-100 text-blue-800' :
                      account.type === 'CREDIT_CARD' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {account.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setFormData({ ...account, interestRate: account.interestRate ? account.interestRate * 100 : 0 }); setEditingId(account.id); setShowForm(true); }}
                      className="text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Balance</p>
                  <p className={`text-2xl font-bold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(account.currentBalance)}
                  </p>
                </div>

                {account.interestRate && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">Interest Rate</p>
                    <p className="font-medium">{(account.interestRate * 100).toFixed(2)}% p.a.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
