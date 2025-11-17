'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface Property {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT';
  address: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
}

export default function PropertiesPage() {
  const { token } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Property>>({
    name: '',
    type: 'HOME',
    address: '',
    purchasePrice: 0,
    purchaseDate: '',
    currentValue: 0,
    valuationDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (token) {
      loadProperties();
    }
  }, [token]);

  const loadProperties = async () => {
    try {
      const response = await fetch('/api/properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProperties(data);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingId ? `/api/properties/${editingId}` : '/api/properties';
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
          purchasePrice: Number(formData.purchasePrice),
          currentValue: Number(formData.currentValue),
        }),
      });

      if (response.ok) {
        await loadProperties();
        setShowForm(false);
        setEditingId(null);
        setFormData({
          name: '',
          type: 'HOME',
          address: '',
          purchasePrice: 0,
          purchaseDate: '',
          currentValue: 0,
          valuationDate: new Date().toISOString().split('T')[0],
        });
      }
    } catch (error) {
      console.error('Error saving property:', error);
    }
  };

  const handleEdit = (property: Property) => {
    setFormData({
      name: property.name,
      type: property.type,
      address: property.address,
      purchasePrice: property.purchasePrice,
      purchaseDate: property.purchaseDate.split('T')[0],
      currentValue: property.currentValue,
      valuationDate: property.valuationDate.split('T')[0],
    });
    setEditingId(property.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadProperties();
      }
    } catch (error) {
      console.error('Error deleting property:', error);
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

  const calculateEquity = (property: Property) => {
    return property.currentValue - (property.purchasePrice || 0);
  };

  const calculateGain = (property: Property) => {
    const gain = property.currentValue - property.purchasePrice;
    const percentage = (gain / property.purchasePrice) * 100;
    return { gain, percentage };
  };

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Properties</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({
                name: '',
                type: 'HOME',
                address: '',
                purchasePrice: 0,
                purchaseDate: '',
                currentValue: 0,
                valuationDate: new Date().toISOString().split('T')[0],
              });
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Add Property
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingId ? 'Edit Property' : 'Add New Property'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Main Residence"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'HOME' | 'INVESTMENT' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="HOME">Home</option>
                  <option value="INVESTMENT">Investment</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="123 Main St, Sydney NSW 2000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                <input
                  type="number"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="500000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Value</label>
                <input
                  type="number"
                  value={formData.currentValue}
                  onChange={(e) => setFormData({ ...formData, currentValue: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="600000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Date</label>
                <input
                  type="date"
                  value={formData.valuationDate}
                  onChange={(e) => setFormData({ ...formData, valuationDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-2 flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Add'} Property
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

        {/* Properties List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading properties...</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No properties added yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Add your first property
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {properties.map((property) => {
              const { gain, percentage } = calculateGain(property);
              return (
                <div key={property.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{property.name}</h3>
                      <p className="text-sm text-gray-600">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          property.type === 'HOME' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {property.type}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(property)}
                        className="text-indigo-600 hover:text-indigo-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(property.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{property.address}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Purchase Price</p>
                      <p className="font-medium">{formatCurrency(property.purchasePrice)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(property.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Current Value</p>
                      <p className="font-medium">{formatCurrency(property.currentValue)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(property.valuationDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Capital Gain</span>
                      <div className="text-right">
                        <p className={`font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(gain)}
                        </p>
                        <p className={`text-xs ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {percentage >= 0 ? '+' : ''}{percentage.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
