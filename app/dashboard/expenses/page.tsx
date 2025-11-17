'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface Expense {
  id: string;
  name: string;
  category: 'HOUSING' | 'TRANSPORT' | 'FOOD' | 'UTILITIES' | 'INSURANCE' | 'ENTERTAINMENT' | 'OTHER';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUALLY';
  isEssential: boolean;
}

export default function ExpensesPage() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    name: '',
    category: 'OTHER',
    amount: 0,
    frequency: 'MONTHLY',
    isEssential: true,
  });

  useEffect(() => {
    if (token) loadExpenses();
  }, [token]);

  const loadExpenses = async () => {
    try {
      const response = await fetch('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setExpenses(await response.json());
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, amount: Number(formData.amount) }),
      });

      if (response.ok) {
        await loadExpenses();
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', category: 'OTHER', amount: 0, frequency: 'MONTHLY', isEssential: true });
      }
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const convertToMonthly = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'WEEKLY': return amount * 52 / 12;
      case 'FORTNIGHTLY': return amount * 26 / 12;
      case 'MONTHLY': return amount;
      case 'ANNUALLY': return amount / 12;
      default: return amount;
    }
  };

  const totalMonthly = expenses.reduce((sum, e) => sum + convertToMonthly(e.amount, e.frequency), 0);

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Expenses</h1>
            <p className="text-gray-600 mt-1">Total Monthly: {formatCurrency(totalMonthly)}</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Expense
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit' : 'Add'} Expense</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Expense['category'] })}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="HOUSING">Housing</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="FOOD">Food</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="ENTERTAINMENT">Entertainment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Expense['frequency'] })}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="FORTNIGHTLY">Fortnightly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isEssential}
                  onChange={(e) => setFormData({ ...formData, isEssential: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Essential Expense</label>
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
        ) : expenses.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No expenses added yet</p>
            <button onClick={() => setShowForm(true)} className="text-indigo-600 hover:text-indigo-700 font-medium">
              Add your first expense
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monthly</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                        {item.category}
                      </span>
                      {!item.isEssential && <span className="ml-2 text-xs text-gray-500">(Non-essential)</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">{formatCurrency(item.amount)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.frequency}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium">
                      {formatCurrency(convertToMonthly(item.amount, item.frequency))}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <button
                        onClick={() => { setFormData(item); setEditingId(item.id); setShowForm(true); }}
                        className="text-indigo-600 hover:text-indigo-700 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
