'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface TaxResult {
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxPayable: number;
  effectiveRate: number;
  breakdown: {
    income: { name: string; amount: number; taxable: boolean }[];
    deductions: { name: string; amount: number }[];
  };
}

export default function TaxPage() {
  const { token } = useAuth();
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      calculateTax();
    }
  }, [token]);

  const calculateTax = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/calculate/tax', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to calculate tax');
      }

      const result = await response.json();
      setTaxResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate tax');
    } finally {
      setIsLoading(false);
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
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Tax Calculator</h1>
            <p className="text-gray-600 mt-1">Australian Tax Year 2024-2025</p>
          </div>
          <button
            onClick={calculateTax}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Calculating...' : 'Recalculate'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isLoading && !taxResult && (
          <div className="text-center py-12">
            <p className="text-gray-600">Calculating tax...</p>
          </div>
        )}

        {taxResult && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Total Income</h3>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(taxResult.totalIncome)}</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Deductions</h3>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(taxResult.totalDeductions)}</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Taxable Income</h3>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(taxResult.taxableIncome)}</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-red-800 mb-2">Tax Payable</h3>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(taxResult.taxPayable)}</p>
                <p className="text-sm text-red-600 mt-1">{formatPercent(taxResult.effectiveRate)} effective rate</p>
              </div>
            </div>

            {/* Tax Brackets Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Australian Tax Brackets 2024-2025</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Income Range</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Tax Rate</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Tax on Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="px-4 py-3">$0 - $18,200</td>
                      <td className="px-4 py-3">0%</td>
                      <td className="px-4 py-3">Nil</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">$18,201 - $45,000</td>
                      <td className="px-4 py-3">19%</td>
                      <td className="px-4 py-3">19c for each $1 over $18,200</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">$45,001 - $135,000</td>
                      <td className="px-4 py-3">30%</td>
                      <td className="px-4 py-3">$5,092 plus 30c for each $1 over $45,000</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">$135,001 - $190,000</td>
                      <td className="px-4 py-3">37%</td>
                      <td className="px-4 py-3">$32,092 plus 37c for each $1 over $135,000</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">$190,001+</td>
                      <td className="px-4 py-3">45%</td>
                      <td className="px-4 py-3">$52,442 plus 45c for each $1 over $190,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Income Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Income Breakdown</h2>
                {taxResult.breakdown.income.length === 0 ? (
                  <p className="text-gray-600 text-sm">No income sources added yet</p>
                ) : (
                  <div className="space-y-3">
                    {taxResult.breakdown.income.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center pb-3 border-b last:border-0">
                        <div>
                          <p className="font-medium text-gray-800">{item.name}</p>
                          {!item.taxable && (
                            <span className="text-xs text-gray-500">(Tax-free)</span>
                          )}
                        </div>
                        <p className="font-medium">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                      <p className="font-bold text-gray-800">Total</p>
                      <p className="font-bold">{formatCurrency(taxResult.totalIncome)}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Tax Deductions</h2>
                {taxResult.breakdown.deductions.length === 0 ? (
                  <p className="text-gray-600 text-sm">No deductible expenses found</p>
                ) : (
                  <div className="space-y-3">
                    {taxResult.breakdown.deductions.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center pb-3 border-b last:border-0">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="font-medium text-green-600">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                      <p className="font-bold text-gray-800">Total</p>
                      <p className="font-bold text-green-600">{formatCurrency(taxResult.totalDeductions)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Note */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-bold text-yellow-900 mb-2">Important Note</h3>
              <p className="text-sm text-yellow-800">
                This is an estimate based on your recorded income and expenses. It does not account for Medicare levy,
                LITO (Low Income Tax Offset), SAPTO, or other tax offsets. Please consult with a tax professional for
                accurate tax planning and lodgment.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
