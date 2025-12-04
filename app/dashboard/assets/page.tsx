'use client';

import { Suspense, useEffect, useState } from 'react';
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
import {
  Car, Plus, Edit2, Trash2, TrendingUp, TrendingDown,
  DollarSign, Calendar, Package, Laptop, Sofa, Wrench,
  Gem, LayoutGrid, List, Eye, Receipt, History, Settings
} from 'lucide-react';

type AssetType = 'VEHICLE' | 'ELECTRONICS' | 'FURNITURE' | 'EQUIPMENT' | 'COLLECTIBLE' | 'OTHER';
type AssetStatus = 'ACTIVE' | 'SOLD' | 'WRITTEN_OFF';
type VehicleFuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'LPG' | 'OTHER';
type ViewMode = 'tiles' | 'list';

interface AssetExpense {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
}

interface AssetValueHistory {
  id: string;
  value: number;
  valuedAt: string;
  source: string | null;
  notes: string | null;
}

interface AssetServiceRecord {
  id: string;
  serviceDate: string;
  serviceType: string;
  description: string;
  provider: string | null;
  cost: number;
  odometerReading: number | null;
}

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  description: string | null;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
  salePrice: number | null;
  saleDate: string | null;
  // Vehicle-specific
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleRegistration: string | null;
  vehicleFuelType: VehicleFuelType | null;
  vehicleOdometer: number | null;
  vehicleVin: string | null;
  // Depreciation
  depreciationMethod: string | null;
  depreciationRate: number | null;
  usefulLifeYears: number | null;
  residualValue: number | null;
  // Other
  imageUrl: string | null;
  serialNumber: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
  // Related data
  expenses?: AssetExpense[];
  valueHistory?: AssetValueHistory[];
  serviceRecords?: AssetServiceRecord[];
  // Computed
  _computed?: {
    annualExpenses: number;
    totalExpenses: number;
    depreciation: number;
    depreciationPercent: number;
    totalCostOfOwnership: number;
    yearsSincePurchase: number;
    costPerKm?: number;
  };
}

interface AssetFormData {
  name: string;
  type: AssetType;
  description: string;
  purchasePrice: string;
  purchaseDate: string;
  currentValue: string;
  // Vehicle-specific
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleRegistration: string;
  vehicleFuelType: VehicleFuelType | '';
  vehicleOdometer: string;
  // Other
  serialNumber: string;
  notes: string;
}

const assetTypeIcons: Record<AssetType, React.ReactNode> = {
  VEHICLE: <Car className="h-5 w-5" />,
  ELECTRONICS: <Laptop className="h-5 w-5" />,
  FURNITURE: <Sofa className="h-5 w-5" />,
  EQUIPMENT: <Wrench className="h-5 w-5" />,
  COLLECTIBLE: <Gem className="h-5 w-5" />,
  OTHER: <Package className="h-5 w-5" />,
};

const assetTypeLabels: Record<AssetType, string> = {
  VEHICLE: 'Vehicle',
  ELECTRONICS: 'Electronics',
  FURNITURE: 'Furniture',
  EQUIPMENT: 'Equipment',
  COLLECTIBLE: 'Collectible',
  OTHER: 'Other',
};

const statusColors: Record<AssetStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  SOLD: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  WRITTEN_OFF: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function AssetsPageContent() {
  const { token } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');
  const [summary, setSummary] = useState<{
    totalCount: number;
    activeCount: number;
    totalValue: number;
    byType: Record<string, { count: number; totalValue: number }>;
  } | null>(null);

  const [formData, setFormData] = useState<AssetFormData>({
    name: '',
    type: 'VEHICLE',
    description: '',
    purchasePrice: '',
    purchaseDate: '',
    currentValue: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleRegistration: '',
    vehicleFuelType: '',
    vehicleOdometer: '',
    serialNumber: '',
    notes: '',
  });

  useEffect(() => {
    if (token) {
      loadAssets();
    }
  }, [token]);

  const loadAssets = async () => {
    try {
      const response = await fetch('/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setAssets(result.data || []);
        setSummary(result.summary || null);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAssetDetail = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const asset = await response.json();
        setSelectedAsset(asset);
      }
    } catch (error) {
      console.error('Error loading asset detail:', error);
    }
  };

  const handleViewDetail = async (asset: Asset) => {
    await loadAssetDetail(asset.id);
    setShowDetailDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'VEHICLE',
      description: '',
      purchasePrice: '',
      purchaseDate: '',
      currentValue: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      vehicleRegistration: '',
      vehicleFuelType: '',
      vehicleOdometer: '',
      serialNumber: '',
      notes: '',
    });
    setEditingId(null);
  };

  const handleEdit = (asset: Asset) => {
    setFormData({
      name: asset.name,
      type: asset.type,
      description: asset.description || '',
      purchasePrice: asset.purchasePrice.toString(),
      purchaseDate: asset.purchaseDate.split('T')[0],
      currentValue: asset.currentValue.toString(),
      vehicleMake: asset.vehicleMake || '',
      vehicleModel: asset.vehicleModel || '',
      vehicleYear: asset.vehicleYear?.toString() || '',
      vehicleRegistration: asset.vehicleRegistration || '',
      vehicleFuelType: asset.vehicleFuelType || '',
      vehicleOdometer: asset.vehicleOdometer?.toString() || '',
      serialNumber: asset.serialNumber || '',
      notes: asset.notes || '',
    });
    setEditingId(asset.id);
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/assets/${editingId}` : '/api/assets';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          purchasePrice: parseFloat(formData.purchasePrice),
          currentValue: parseFloat(formData.currentValue),
          vehicleYear: formData.vehicleYear ? parseInt(formData.vehicleYear) : null,
          vehicleOdometer: formData.vehicleOdometer ? parseInt(formData.vehicleOdometer) : null,
          vehicleFuelType: formData.vehicleFuelType || null,
        }),
      });

      if (response.ok) {
        loadAssets();
        setShowDialog(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving asset:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        loadAssets();
        setShowDetailDialog(false);
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderAssetCard = (asset: Asset) => {
    const computed = asset._computed || {
      annualExpenses: 0,
      depreciation: 0,
      depreciationPercent: 0,
    };

    return (
      <Card key={asset.id} className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {assetTypeIcons[asset.type]}
              </div>
              <div>
                <CardTitle className="text-lg">{asset.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {assetTypeLabels[asset.type]}
                  {asset.type === 'VEHICLE' && asset.vehicleYear && (
                    <span>
                      {asset.vehicleMake} {asset.vehicleModel} {asset.vehicleYear}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Badge className={statusColors[asset.status]}>{asset.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Purchase Price</p>
              <p className="text-lg font-semibold">{formatCurrency(asset.purchasePrice)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-lg font-semibold">{formatCurrency(asset.currentValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Depreciation</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                {computed.depreciation > 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                )}
                {formatCurrency(Math.abs(computed.depreciation))}
                <span className="text-sm text-muted-foreground">
                  ({computed.depreciationPercent.toFixed(1)}%)
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual Costs</p>
              <p className="text-lg font-semibold">{formatCurrency(computed.annualExpenses)}/yr</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleViewDetail(asset)}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEdit(asset)}>
              <Edit2 className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderListView = () => (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left font-medium">Asset</th>
            <th className="p-3 text-left font-medium">Type</th>
            <th className="p-3 text-right font-medium">Purchase</th>
            <th className="p-3 text-right font-medium">Current</th>
            <th className="p-3 text-right font-medium">Change</th>
            <th className="p-3 text-center font-medium">Status</th>
            <th className="p-3 text-center font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const computed = asset._computed || { depreciation: 0, depreciationPercent: 0 };
            return (
              <tr key={asset.id} className="border-b hover:bg-muted/50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {assetTypeIcons[asset.type]}
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      {asset.type === 'VEHICLE' && asset.vehicleMake && (
                        <p className="text-sm text-muted-foreground">
                          {asset.vehicleMake} {asset.vehicleModel}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3">{assetTypeLabels[asset.type]}</td>
                <td className="p-3 text-right">{formatCurrency(asset.purchasePrice)}</td>
                <td className="p-3 text-right">{formatCurrency(asset.currentValue)}</td>
                <td className="p-3 text-right">
                  <span className={computed.depreciation > 0 ? 'text-red-500' : 'text-green-500'}>
                    {computed.depreciation > 0 ? '-' : '+'}
                    {formatCurrency(Math.abs(computed.depreciation))}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <Badge className={statusColors[asset.status]}>{asset.status}</Badge>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetail(asset)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(asset)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(asset.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Assets"
          description="Track your personal assets, vehicles, and their costs"
          action={
            <Button onClick={() => { resetForm(); setShowDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Asset
            </Button>
          }
        />

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.activeCount}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalCount - summary.activeCount} sold/written off
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {summary.byType['VEHICLE']?.count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(summary.byType['VEHICLE']?.totalValue || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Other Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {Object.entries(summary.byType)
                    .filter(([type]) => type !== 'VEHICLE')
                    .reduce((sum, [, data]) => sum + data.count, 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex justify-end">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === 'tiles' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('tiles')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Assets List */}
        {assets.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No assets yet"
            description="Add your first asset to start tracking your personal property"
            action={{
              label: 'Add Asset',
              onClick: () => { resetForm(); setShowDialog(true); }
            }}
          />
        ) : viewMode === 'tiles' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(renderAssetCard)}
          </div>
        ) : (
          renderListView()
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update the asset details' : 'Enter the details for your new asset'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Toyota Camry 2021"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Asset Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: AssetType) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(assetTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            {assetTypeIcons[value as AssetType]}
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Purchase Price *</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="35000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase Date *</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentValue">Current Value *</Label>
                <Input
                  id="currentValue"
                  type="number"
                  value={formData.currentValue}
                  onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                  placeholder="28000"
                  required
                />
              </div>

              {/* Vehicle-specific fields */}
              {formData.type === 'VEHICLE' && (
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Car className="h-4 w-4" /> Vehicle Details
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleMake">Make</Label>
                      <Input
                        id="vehicleMake"
                        value={formData.vehicleMake}
                        onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                        placeholder="Toyota"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleModel">Model</Label>
                      <Input
                        id="vehicleModel"
                        value={formData.vehicleModel}
                        onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                        placeholder="Camry"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleYear">Year</Label>
                      <Input
                        id="vehicleYear"
                        type="number"
                        value={formData.vehicleYear}
                        onChange={(e) => setFormData({ ...formData, vehicleYear: e.target.value })}
                        placeholder="2021"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleRegistration">Registration</Label>
                      <Input
                        id="vehicleRegistration"
                        value={formData.vehicleRegistration}
                        onChange={(e) =>
                          setFormData({ ...formData, vehicleRegistration: e.target.value })
                        }
                        placeholder="ABC123"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleFuelType">Fuel Type</Label>
                      <Select
                        value={formData.vehicleFuelType}
                        onValueChange={(value: VehicleFuelType) =>
                          setFormData({ ...formData, vehicleFuelType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select fuel type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PETROL">Petrol</SelectItem>
                          <SelectItem value="DIESEL">Diesel</SelectItem>
                          <SelectItem value="ELECTRIC">Electric</SelectItem>
                          <SelectItem value="HYBRID">Hybrid</SelectItem>
                          <SelectItem value="LPG">LPG</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleOdometer">Current Odometer (km)</Label>
                    <Input
                      id="vehicleOdometer"
                      type="number"
                      value={formData.vehicleOdometer}
                      onChange={(e) =>
                        setFormData({ ...formData, vehicleOdometer: e.target.value })
                      }
                      placeholder="45000"
                    />
                  </div>
                </div>
              )}

              {/* Non-vehicle fields */}
              {formData.type !== 'VEHICLE' && (
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="Optional serial number"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingId ? 'Update' : 'Create'} Asset</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedAsset && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary">
                        {assetTypeIcons[selectedAsset.type]}
                      </div>
                      <div>
                        <DialogTitle className="text-xl">{selectedAsset.name}</DialogTitle>
                        <DialogDescription>
                          {assetTypeLabels[selectedAsset.type]}
                          {selectedAsset.type === 'VEHICLE' && selectedAsset.vehicleMake && (
                            <> - {selectedAsset.vehicleMake} {selectedAsset.vehicleModel} {selectedAsset.vehicleYear}</>
                          )}
                        </DialogDescription>
                      </div>
                    </div>
                    <Badge className={statusColors[selectedAsset.status]}>
                      {selectedAsset.status}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-4 gap-4 py-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Purchase Price</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(selectedAsset.purchasePrice)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedAsset.purchaseDate)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(selectedAsset.currentValue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedAsset.valuationDate)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Depreciation</p>
                      <p className="text-xl font-bold flex items-center gap-1">
                        {(selectedAsset._computed?.depreciation || 0) > 0 ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                        {formatCurrency(Math.abs(selectedAsset._computed?.depreciation || 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedAsset._computed?.depreciationPercent || 0).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(selectedAsset._computed?.totalCostOfOwnership || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(selectedAsset._computed?.annualExpenses || 0)}/year
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="expenses">
                  <TabsList>
                    <TabsTrigger value="expenses">
                      <Receipt className="h-4 w-4 mr-1" /> Expenses
                    </TabsTrigger>
                    {selectedAsset.type === 'VEHICLE' && (
                      <TabsTrigger value="services">
                        <Wrench className="h-4 w-4 mr-1" /> Services
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="history">
                      <History className="h-4 w-4 mr-1" /> Value History
                    </TabsTrigger>
                    <TabsTrigger value="details">
                      <Settings className="h-4 w-4 mr-1" /> Details
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="expenses" className="mt-4">
                    {selectedAsset.expenses && selectedAsset.expenses.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAsset.expenses.map((expense) => (
                          <div
                            key={expense.id}
                            className="flex justify-between items-center p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{expense.name}</p>
                              <p className="text-sm text-muted-foreground">{expense.category}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(expense.amount)}</p>
                              <p className="text-sm text-muted-foreground">{expense.frequency}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No expenses linked to this asset
                      </p>
                    )}
                  </TabsContent>

                  {selectedAsset.type === 'VEHICLE' && (
                    <TabsContent value="services" className="mt-4">
                      {selectedAsset.serviceRecords && selectedAsset.serviceRecords.length > 0 ? (
                        <div className="space-y-2">
                          {selectedAsset.serviceRecords.map((service) => (
                            <div
                              key={service.id}
                              className="flex justify-between items-center p-3 border rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{service.description}</p>
                                <p className="text-sm text-muted-foreground">
                                  {service.serviceType} - {service.provider || 'No provider'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(service.cost)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(service.serviceDate)}
                                  {service.odometerReading && ` @ ${service.odometerReading.toLocaleString()} km`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          No service records
                        </p>
                      )}
                    </TabsContent>
                  )}

                  <TabsContent value="history" className="mt-4">
                    {selectedAsset.valueHistory && selectedAsset.valueHistory.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAsset.valueHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex justify-between items-center p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{formatCurrency(entry.value)}</p>
                              <p className="text-sm text-muted-foreground">
                                {entry.notes || 'Value update'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">{formatDate(entry.valuedAt)}</p>
                              <p className="text-xs text-muted-foreground">{entry.source}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No value history
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {selectedAsset.type === 'VEHICLE' && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Registration</p>
                            <p className="font-medium">
                              {selectedAsset.vehicleRegistration || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Odometer</p>
                            <p className="font-medium">
                              {selectedAsset.vehicleOdometer?.toLocaleString() || '-'} km
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Fuel Type</p>
                            <p className="font-medium">
                              {selectedAsset.vehicleFuelType || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cost per km</p>
                            <p className="font-medium">
                              {selectedAsset._computed?.costPerKm
                                ? `$${selectedAsset._computed.costPerKm.toFixed(2)}`
                                : '-'}
                            </p>
                          </div>
                        </>
                      )}
                      {selectedAsset.serialNumber && (
                        <div>
                          <p className="text-sm text-muted-foreground">Serial Number</p>
                          <p className="font-medium">{selectedAsset.serialNumber}</p>
                        </div>
                      )}
                      {selectedAsset.notes && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Notes</p>
                          <p className="font-medium">{selectedAsset.notes}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selectedAsset.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDetailDialog(false);
                        handleEdit(selectedAsset);
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default function AssetsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DashboardLayout>
      }
    >
      <AssetsPageContent />
    </Suspense>
  );
}
