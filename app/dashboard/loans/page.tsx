'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface Loan {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT' | 'PERSONAL' | 'CREDIT_CARD';
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  propertyId?: string;
  offsetAccountId?: string;
  property?: { name: string };
  offsetAccount?: { name: string; balance: number };
}

interface Property {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export default function LoansPage() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Loan>>({
    name: '',
    type: 'HOME',
    principal: 0,
    interestRateAnnual: 0,
    rateType: 'VARIABLE',
    isInterestOnly: false,
    termMonthsRemaining: 360,
    minRepayment: 0,
    repaymentFrequency: 'MONTHLY',
    propertyId: undefined,
    offsetAccountId: undefined,
  });

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    try {
      const [loansRes, propertiesRes, accountsRes] = await Promise.all([
        fetch('/api/loans', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/properties', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (loansRes.ok) setLoans(await loansRes.json());
      if (propertiesRes.ok) setProperties(await propertiesRes.json());
      if (accountsRes.ok) {
        const allAccounts = await accountsRes.json();
        // Filter to show only OFFSET accounts
        setAccounts(allAccounts.filter((a: Account) => a.type === 'OFFSET'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingId ? `/api/loans/${editingId}` : '/api/loans';
    const method = editingId ? 'PUT' : 'POST';

    // Clean up the data
    const submitData = {
      ...formData,
      principal: Number(formData.principal),
      interestRateAnnual: Number(formData.interestRateAnnual),
      termMonthsRemaining: Number(formData.termMonthsRemaining),
      minRepayment: Number(formData.minRepayment),
      propertyId: formData.propertyId || null,
      offsetAccountId: formData.offsetAccountId || null,
    };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        await loadData();
        setShowForm(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving loan:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'HOME',
      principal: 0,
      interestRateAnnual: 0,
      rateType: 'VARIABLE',
      isInterestOnly: false,
      termMonthsRemaining: 360,
      minRepayment: 0,
      repaymentFrequency: 'MONTHLY',
      propertyId: undefined,
      offsetAccountId: undefined,
    });
  };

  const handleEdit = (loan: Loan) => {
    setFormData({
      name: loan.name,
      type: loan.type,
      principal: loan.principal,
      interestRateAnnual: loan.interestRateAnnual,
      rateType: loan.rateType,
      isInterestOnly: loan.isInterestOnly,
      termMonthsRemaining: loan.termMonthsRemaining,
      minRepayment: loan.minRepayment,
      repaymentFrequency: loan.repaymentFrequency,
      propertyId: loan.propertyId,
      offsetAccountId: loan.offsetAccountId,
    });
    setEditingId(loan.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loan?')) return;

    try {
      const response = await fetch(`/api/loans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Loans</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              resetForm();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Add Loan
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingId ? 'Edit Loan' : 'Add New Loan'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Home Loan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Loan['type'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="HOME">Home Loan</option>
                  <option value="INVESTMENT">Investment Loan</option>
                  <option value="PERSONAL">Personal Loan</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Principal Balance</label>
                <input
                  type="number"
                  value={formData.principal}
                  onChange={(e) => setFormData({ ...formData, principal: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="400000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData.interestRateAnnual || 0) * 100}
                  onChange={(e) => setFormData({ ...formData, interestRateAnnual: Number(e.target.value) / 100 })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="6.25"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                <select
                  value={formData.rateType}
                  onChange={(e) => setFormData({ ...formData, rateType: e.target.value as 'FIXED' | 'VARIABLE' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="VARIABLE">Variable</option>
                  <option value="FIXED">Fixed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                <select
                  value={formData.isInterestOnly ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, isInterestOnly: e.target.value === 'true' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="false">Principal & Interest</option>
                  <option value="true">Interest Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term Remaining (months)</label>
                <input
                  type="number"
                  value={formData.termMonthsRemaining}
                  onChange={(e) => setFormData({ ...formData, termMonthsRemaining: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Repayment</label>
                <input
                  type="number"
                  value={formData.minRepayment}
                  onChange={(e) => setFormData({ ...formData, minRepayment: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="2500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Frequency</label>
                <select
                  value={formData.repaymentFrequency}
                  onChange={(e) => setFormData({ ...formData, repaymentFrequency: e.target.value as Loan['repaymentFrequency'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="FORTNIGHTLY">Fortnightly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Property (Optional)</label>
                <select
                  value={formData.propertyId || ''}
                  onChange={(e) => setFormData({ ...formData, propertyId: e.target.value || undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>{prop.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offset Account (Optional)</label>
                <select
                  value={formData.offsetAccountId || ''}
                  onChange={(e) => setFormData({ ...formData, offsetAccountId: e.target.value || undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Add'} Loan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loans List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading loans...</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No loans added yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Add your first loan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loans.map((loan) => (
              <div key={loan.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{loan.name}</h3>
                    <p className="text-sm text-gray-600">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        loan.type === 'HOME' ? 'bg-blue-100 text-blue-800' :
                        loan.type === 'INVESTMENT' ? 'bg-green-100 text-green-800' :
                        loan.type === 'PERSONAL' ? 'bg-purple-100 text-purple-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {loan.type}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(loan)}
                      className="text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="font-bold text-lg">{formatCurrency(loan.principal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest Rate</p>
                    <p className="font-bold text-lg">{formatPercent(loan.interestRateAnnual)}</p>
                    <p className="text-xs text-gray-500">{loan.rateType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Min Repayment</p>
                    <p className="font-medium">{formatCurrency(loan.minRepayment)}</p>
                    <p className="text-xs text-gray-500">{loan.repaymentFrequency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Term Remaining</p>
                    <p className="font-medium">{loan.termMonthsRemaining} months</p>
                    <p className="text-xs text-gray-500">{(loan.termMonthsRemaining / 12).toFixed(1)} years</p>
                  </div>
                </div>

                {(loan.property || loan.offsetAccount) && (
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    {loan.property && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 mr-2">🏠 Property:</span>
                        <span className="font-medium">{loan.property.name}</span>
                      </div>
                    )}
                    {loan.offsetAccount && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 mr-2">💰 Offset:</span>
                        <span className="font-medium">
                          {loan.offsetAccount.name} ({formatCurrency(loan.offsetAccount.balance)})
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      loan.isInterestOnly ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {loan.isInterestOnly ? 'Interest Only' : 'Principal & Interest'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
