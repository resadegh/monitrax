'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadFailedState } from '@/components/ui/LoadFailedState';
import OwnershipPicker, {
  type OwnershipSelectionValue,
} from '@/components/ownership/OwnershipPicker';
import CorrectOwnershipDialog from '@/components/ownership/CorrectOwnershipDialog';
import OwnershipSummary from '@/components/ownership/OwnershipSummary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Car, Plus, Edit2, Trash2, TrendingUp, TrendingDown,
  DollarSign, Calendar, Package, Laptop, Sofa, Wrench,
  Gem, LayoutGrid, List, Eye, Receipt, History, Settings,
  Fuel, Shield, FileText, Zap, FolderOpen, Pencil
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { assetValueDirection, assetValueChangeMagnitudePercent } from '@/lib/assets/valueChange';
import { toAnnual } from '@/lib/utils/frequencies';
import { Checkbox } from '@/components/ui/checkbox';
import { ListFilter, assetFilterConfigs } from '@/components/ListFilter';
import { AssetsHero, type AssetsHeroSegment } from '@/components/assets/AssetsHero';
import { AssetTile } from '@/components/assets/AssetTile';
import { RenewalsCard } from '@/components/reminders/RenewalsCard';
import { DocumentsSection, DocumentAttachButton } from '@/components/documents';
import { LinkedEntityType, DocumentCategory } from '@/lib/documents/types';
import { RenewalChip } from '@/components/reminders/RenewalChip';
import {
  computeAssetRenewals,
  surfacedReminders,
  mostUrgentForEntity,
  type RenewalReminder,
} from '@/lib/reminders/reminderEngine';
import { cn } from '@/lib/utils';

/**
 * Polished glass KPI tile for the asset detail (Stitch redesign screen
 * 770abf40f2584174b52db63a4310a34a). §18.7.2 recipe: glass + hairline + 3px
 * gradient top-accent + tabular-nums value. `min-w-0` + `truncate` keep long
 * numbers inside the tile so the 2×2 mobile grid never overflows the dialog.
 */
function KpiTile({
  label,
  value,
  sub,
  accent,
  valueIcon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  valueIcon?: React.ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[14px] border border-foreground/10 bg-card/70 p-3.5 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <span className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', accent)} />
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-1 truncate text-[20px] font-semibold tabular-nums text-foreground">
        {valueIcon}
        <span className="truncate">{value}</span>
      </p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

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
  isTaxDeductible?: boolean;
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
  // Vehicle renewal dates (Phase 21.5)
  vehicleRegistrationExpiry: string | null;
  vehicleCtpProvider: string | null;
  vehicleCtpExpiry: string | null;
  vehicleInsuranceProvider: string | null;
  vehicleInsurancePolicyNumber: string | null;
  vehicleInsuranceExpiry: string | null;
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
  // Vehicle renewal dates (Phase 21.5) — date inputs ('YYYY-MM-DD') + text
  vehicleRegistrationExpiry: string;
  vehicleCtpProvider: string;
  vehicleCtpExpiry: string;
  vehicleInsuranceProvider: string;
  vehicleInsurancePolicyNumber: string;
  vehicleInsuranceExpiry: string;
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

// Expense templates based on asset type
interface ExpenseTemplate {
  name: string;
  category: string;
  frequency: string;
  isTaxDeductible: boolean;
  icon: React.ReactNode;
}

const assetExpenseTemplates: Record<AssetType, ExpenseTemplate[]> = {
  VEHICLE: [
    { name: 'Registration', category: 'TRANSPORT', frequency: 'ANNUAL', isTaxDeductible: false, icon: <FileText className="h-4 w-4" /> },
    { name: 'Insurance', category: 'INSURANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Shield className="h-4 w-4" /> },
    { name: 'Fuel', category: 'TRANSPORT', frequency: 'WEEKLY', isTaxDeductible: false, icon: <Fuel className="h-4 w-4" /> },
    { name: 'Tolls', category: 'TRANSPORT', frequency: 'MONTHLY', isTaxDeductible: false, icon: <DollarSign className="h-4 w-4" /> },
    { name: 'Service', category: 'MAINTENANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Wrench className="h-4 w-4" /> },
    { name: 'Tyres', category: 'MAINTENANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Car className="h-4 w-4" /> },
    { name: 'Parking', category: 'TRANSPORT', frequency: 'MONTHLY', isTaxDeductible: false, icon: <DollarSign className="h-4 w-4" /> },
    { name: 'Car Wash', category: 'MAINTENANCE', frequency: 'MONTHLY', isTaxDeductible: false, icon: <DollarSign className="h-4 w-4" /> },
  ],
  ELECTRONICS: [
    { name: 'Insurance', category: 'INSURANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Shield className="h-4 w-4" /> },
    { name: 'Subscription/License', category: 'OTHER', frequency: 'MONTHLY', isTaxDeductible: false, icon: <FileText className="h-4 w-4" /> },
    { name: 'Repairs', category: 'MAINTENANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Wrench className="h-4 w-4" /> },
    { name: 'Accessories', category: 'OTHER', frequency: 'ANNUAL', isTaxDeductible: false, icon: <DollarSign className="h-4 w-4" /> },
  ],
  FURNITURE: [
    { name: 'Insurance', category: 'INSURANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Shield className="h-4 w-4" /> },
    { name: 'Cleaning/Maintenance', category: 'MAINTENANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Wrench className="h-4 w-4" /> },
  ],
  EQUIPMENT: [
    { name: 'Insurance', category: 'INSURANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Shield className="h-4 w-4" /> },
    { name: 'Maintenance', category: 'MAINTENANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Wrench className="h-4 w-4" /> },
    { name: 'Consumables', category: 'OTHER', frequency: 'MONTHLY', isTaxDeductible: false, icon: <DollarSign className="h-4 w-4" /> },
  ],
  COLLECTIBLE: [
    { name: 'Insurance', category: 'INSURANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Shield className="h-4 w-4" /> },
    { name: 'Storage', category: 'HOUSING', frequency: 'MONTHLY', isTaxDeductible: false, icon: <DollarSign className="h-4 w-4" /> },
    { name: 'Appraisal', category: 'OTHER', frequency: 'ANNUAL', isTaxDeductible: false, icon: <FileText className="h-4 w-4" /> },
  ],
  OTHER: [
    { name: 'Insurance', category: 'INSURANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Shield className="h-4 w-4" /> },
    { name: 'Maintenance', category: 'MAINTENANCE', frequency: 'ANNUAL', isTaxDeductible: false, icon: <Wrench className="h-4 w-4" /> },
  ],
};

interface ExpenseFormData {
  name: string;
  category: string;
  amount: string;
  frequency: string;
  isTaxDeductible: boolean;
}

function AssetsPageContent() {
  const { token } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // M2.6 #5
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Phase 47 Stage A — ownership selection (create only).
  const [ownership, setOwnership] = useState<OwnershipSelectionValue>({ mode: 'sole' });
  // Phase 47 Stage A2 — correction flow on the edit path.
  const [correctOwnershipOpen, setCorrectOwnershipOpen] = useState(false);
  const [ownershipRefreshKey, setOwnershipRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseFormData, setExpenseFormData] = useState<ExpenseFormData>({
    name: '',
    category: 'OTHER',
    amount: '',
    frequency: 'MONTHLY',
    isTaxDeductible: false,
  });
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
    vehicleRegistrationExpiry: '',
    vehicleCtpProvider: '',
    vehicleCtpExpiry: '',
    vehicleInsuranceProvider: '',
    vehicleInsurancePolicyNumber: '',
    vehicleInsuranceExpiry: '',
    serialNumber: '',
    notes: '',
  });

  useEffect(() => {
    if (token) {
      loadAssets();
    }
  }, [token]);

  const loadAssets = async () => {
    // M2.6 #5: failed fetch → error state, never the empty state.
    setLoadError(false);
    try {
      const response = await fetch('/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setAssets(result.data || []);
        setSummary(result.summary || null);
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
      setLoadError(true);
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

  // Deep-link: `/dashboard/assets?view=<assetId>` opens that asset's detail
  // dialog directly. Assets have no per-id route (list + dialog), so this is how
  // a document's "Asset" link (and any other deep link) lands on the RIGHT asset
  // instead of the generic list. Runs once token + the param are available.
  const searchParams = useSearchParams();
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (token && viewId) {
      loadAssetDetail(viewId).then(() => setShowDetailDialog(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams]);

  const resetForm = () => {
    setOwnership({ mode: 'sole' });
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
      vehicleRegistrationExpiry: '',
      vehicleCtpProvider: '',
      vehicleCtpExpiry: '',
      vehicleInsuranceProvider: '',
      vehicleInsurancePolicyNumber: '',
      vehicleInsuranceExpiry: '',
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
      vehicleRegistrationExpiry: asset.vehicleRegistrationExpiry?.split('T')[0] || '',
      vehicleCtpProvider: asset.vehicleCtpProvider || '',
      vehicleCtpExpiry: asset.vehicleCtpExpiry?.split('T')[0] || '',
      vehicleInsuranceProvider: asset.vehicleInsuranceProvider || '',
      vehicleInsurancePolicyNumber: asset.vehicleInsurancePolicyNumber || '',
      vehicleInsuranceExpiry: asset.vehicleInsuranceExpiry?.split('T')[0] || '',
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
          // Phase 47 Stage A — ownership only applies at creation.
          ...(editingId ? {} : { ownership }),
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

  // Delete a single expense from the asset's Expenses tab. Manual, user-confirmed
  // (Reza decision 2026-06-17 — no auto-cascade from document deletion); this is
  // how duplicates get cleaned up. §12.11: single user-initiated delete by id.
  const handleDeleteExpense = async (expenseId: string, expenseName: string) => {
    if (!confirm(`Delete the expense "${expenseName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok && selectedAsset) {
        loadAssetDetail(selectedAsset.id);
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseFormData({
      name: '',
      category: 'OTHER',
      amount: '',
      frequency: 'MONTHLY',
      isTaxDeductible: false,
    });
  };

  /** Open the expense dialog pre-filled to edit an existing asset expense. */
  const openEditExpense = (expense: AssetExpense) => {
    setEditingExpenseId(expense.id);
    setExpenseFormData({
      name: expense.name,
      category: expense.category,
      amount: String(expense.amount),
      frequency: expense.frequency,
      isTaxDeductible: expense.isTaxDeductible ?? false,
    });
    setShowExpenseDialog(true);
  };

  const applyExpenseTemplate = (template: ExpenseTemplate) => {
    setExpenseFormData({
      name: template.name,
      category: template.category,
      amount: '',
      frequency: template.frequency,
      isTaxDeductible: template.isTaxDeductible,
    });
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      // Edit an existing expense (PUT) or create a new one (POST).
      const isEdit = !!editingExpenseId;
      const response = await fetch(
        isEdit ? `/api/expenses/${editingExpenseId}` : '/api/expenses',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: expenseFormData.name,
            category: expenseFormData.category,
            amount: parseFloat(expenseFormData.amount),
            frequency: expenseFormData.frequency,
            isTaxDeductible: expenseFormData.isTaxDeductible,
            isEssential: true,
            sourceType: 'ASSET',
            assetId: selectedAsset.id,
          }),
        },
      );

      if (response.ok) {
        // Reload asset details to show new expense
        await loadAssetDetail(selectedAsset.id);
        setShowExpenseDialog(false);
        resetExpenseForm();
      }
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  // formatCurrency imported from lib/utils/formatters

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                  {/* MON-041: the icon + $ sign already convey direction; show the
                      MAGNITUDE (an appreciating asset must not read as "-200%
                      depreciation"). ONE source: lib/assets/valueChange. */}
                  ({assetValueChangeMagnitudePercent(computed.depreciationPercent).toFixed(1)}%)
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
          {filteredAssets.map((asset) => {
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

  // Canonical reminder projection (SSOT — lib/reminders/reminderEngine.ts).
  // Computed from the assets already loaded; the per-tile chip reads the
  // most-urgent renewal for each asset. The aggregated RenewalsCard below
  // fetches the unified feed (assets + loans + bank-consent) separately.
  const assetReminders: RenewalReminder[] = computeAssetRenewals(assets);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Assets"
          description="What you own — vehicles, electronics, furniture, and more."
          action={
            <Button onClick={() => { resetForm(); setShowDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Asset
            </Button>
          }
        />

        {/* Premium hero summary — Stage I (Invest), warm sub-palette */}
        {summary && summary.totalCount > 0 && (() => {
          const HERO_SEGMENT_STYLE: Record<AssetType, { label: string; barClass: string; dotClass: string; chipClass: string }> = {
            VEHICLE: { label: 'Vehicles', barClass: 'bg-gradient-to-r from-amber-400 to-orange-500', dotClass: 'bg-amber-500', chipClass: 'text-amber-700 dark:text-amber-300' },
            ELECTRONICS: { label: 'Electronics', barClass: 'bg-gradient-to-r from-rose-400 to-pink-500', dotClass: 'bg-rose-500', chipClass: 'text-rose-700 dark:text-rose-300' },
            FURNITURE: { label: 'Furniture', barClass: 'bg-gradient-to-r from-stone-400 to-amber-500', dotClass: 'bg-stone-500', chipClass: 'text-stone-700 dark:text-stone-300' },
            EQUIPMENT: { label: 'Equipment', barClass: 'bg-gradient-to-r from-slate-400 to-zinc-500', dotClass: 'bg-slate-500', chipClass: 'text-slate-700 dark:text-slate-300' },
            COLLECTIBLE: { label: 'Collectibles', barClass: 'bg-gradient-to-r from-fuchsia-400 to-violet-500', dotClass: 'bg-fuchsia-500', chipClass: 'text-fuchsia-700 dark:text-fuchsia-300' },
            OTHER: { label: 'Other', barClass: 'bg-gradient-to-r from-orange-400 to-amber-500', dotClass: 'bg-orange-500', chipClass: 'text-orange-700 dark:text-orange-300' },
          };
          const segments: AssetsHeroSegment[] = [];
          for (const type of ['VEHICLE', 'ELECTRONICS', 'FURNITURE', 'EQUIPMENT', 'COLLECTIBLE', 'OTHER'] as const) {
            const data = summary.byType[type];
            if (!data || data.count === 0) continue;
            const style = HERO_SEGMENT_STYLE[type];
            segments.push({
              id: type,
              label: style.label,
              count: data.count,
              value: data.totalValue,
              barClass: style.barClass,
              dotClass: style.dotClass,
              chipClass: style.chipClass,
            });
          }
          const totalPurchaseCost = assets.reduce((sum, a) => sum + a.purchasePrice, 0);
          const totalAnnualCosts = assets.reduce((sum, a) => sum + (a._computed?.annualExpenses ?? 0), 0);
          return (
            <AssetsHero
              totalValue={summary.totalValue}
              activeCount={summary.activeCount}
              totalCount={summary.totalCount}
              totalPurchaseCost={totalPurchaseCost}
              totalAnnualCosts={totalAnnualCosts}
              segments={segments}
            />
          );
        })()}

        {/* Renewals & reminders (Phase 21.5) — self-hides when nothing is
            coming up. Aggregates vehicle rego/CTP/insurance, warranty, loan
            fixed-rate expiry + bank-consent expiry via the canonical engine. */}
        <RenewalsCard />

        {/* View Toggle */}
        {/* Search and Filter */}
        {assets.length > 0 && (
          <ListFilter
            data={assets}
            searchFields={['name', 'vehicleMake', 'vehicleModel', 'vehicleRegistration', 'serialNumber']}
            searchPlaceholder="Search assets..."
            filters={assetFilterConfigs}
            onFilteredData={setFilteredAssets}
            className="mb-4"
          />
        )}

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
        {loadError ? (
          <LoadFailedState what="your assets" onRetry={loadAssets} />
        ) : assets.length === 0 ? (
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
          /* Tiles — premium glassmorphic redesign (Phase 39.3, warm
             sub-palette). Mobile: block flow + sticky-stacking cards
             (matches the Properties tab, PRs #916/#918/#919) — see the
             className. */
          <div className="max-md:space-y-5 md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {filteredAssets.map((asset, idx) => {
              const computed = asset._computed || {
                annualExpenses: 0,
                depreciation: 0,
                depreciationPercent: 0,
              } as NonNullable<Asset['_computed']>;
              return (
                <div
                  key={asset.id}
                  className="max-md:sticky max-md:overflow-hidden max-md:rounded-[22px] max-md:bg-editorial-ivory max-md:shadow-[0_-6px_24px_-8px_rgba(0,0,0,0.45)]"
                  style={{ top: `calc(7.5rem + ${idx * 0.75}rem)` }}
                >
                <AssetTile
                  index={idx}
                  asset={{
                    id: asset.id,
                    name: asset.name,
                    type: asset.type,
                    status: asset.status,
                    vehicleSubtitle:
                      asset.type === 'VEHICLE'
                        ? [asset.vehicleMake, asset.vehicleModel, asset.vehicleYear]
                            .filter(Boolean)
                            .join(' ') || undefined
                        : undefined,
                    purchasePrice: asset.purchasePrice,
                    currentValue: asset.currentValue,
                    depreciation: computed.depreciation,
                    depreciationPercent: computed.depreciationPercent,
                    annualExpenses: computed.annualExpenses,
                    renewal: (() => {
                      const r = mostUrgentForEntity(assetReminders, asset.id);
                      return r
                        ? { urgency: r.urgency, daysUntilDue: r.daysUntilDue, label: r.label }
                        : undefined;
                    })(),
                  }}
                  onView={() => handleViewDetail(asset)}
                  onEdit={() => handleEdit(asset)}
                  onDelete={() => handleDelete(asset.id)}
                />
                </div>
              );
            })}
          </div>
        ) : (
          renderListView()
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update the asset details' : 'Enter the details for your new asset'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  {/* Renewals & reminders (Phase 21.5). Optional dates that
                      drive in-app renewal reminders. Provider / policy are
                      stored for context; the dates are what we remind on. */}
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Renewals &amp; reminders
                    </h5>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Add renewal dates and we&apos;ll remind you before they&apos;re due. All optional.
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="vehicleRegistrationExpiry">Registration renewal date</Label>
                      <Input
                        id="vehicleRegistrationExpiry"
                        type="date"
                        value={formData.vehicleRegistrationExpiry}
                        onChange={(e) =>
                          setFormData({ ...formData, vehicleRegistrationExpiry: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicleCtpProvider">CTP insurer</Label>
                        <Input
                          id="vehicleCtpProvider"
                          value={formData.vehicleCtpProvider}
                          onChange={(e) =>
                            setFormData({ ...formData, vehicleCtpProvider: e.target.value })
                          }
                          placeholder="e.g., NRMA, AAMI"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleCtpExpiry">CTP renewal date</Label>
                        <Input
                          id="vehicleCtpExpiry"
                          type="date"
                          value={formData.vehicleCtpExpiry}
                          onChange={(e) =>
                            setFormData({ ...formData, vehicleCtpExpiry: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicleInsuranceProvider">Comprehensive insurer</Label>
                        <Input
                          id="vehicleInsuranceProvider"
                          value={formData.vehicleInsuranceProvider}
                          onChange={(e) =>
                            setFormData({ ...formData, vehicleInsuranceProvider: e.target.value })
                          }
                          placeholder="e.g., Budget Direct"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleInsuranceExpiry">Comprehensive renewal date</Label>
                        <Input
                          id="vehicleInsuranceExpiry"
                          type="date"
                          value={formData.vehicleInsuranceExpiry}
                          onChange={(e) =>
                            setFormData({ ...formData, vehicleInsuranceExpiry: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicleInsurancePolicyNumber">Comprehensive policy number</Label>
                      <Input
                        id="vehicleInsurancePolicyNumber"
                        value={formData.vehicleInsurancePolicyNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, vehicleInsurancePolicyNumber: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>
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

              {/* Phase 47 Stage A — ownership picker (creation only). */}
              {!editingId && (
                <OwnershipPicker token={token} value={ownership} onChange={setOwnership} />
              )}
              {editingId && (
                <>
                  <OwnershipSummary
                    token={token}
                    objectType="asset"
                    objectId={editingId}
                    onCorrect={() => setCorrectOwnershipOpen(true)}
                    refreshKey={ownershipRefreshKey}
                  />
                  <CorrectOwnershipDialog
                    open={correctOwnershipOpen}
                    onOpenChange={setCorrectOwnershipOpen}
                    token={token}
                    objectType="asset"
                    objectId={editingId}
                    objectName={formData.name || 'This asset'}
                    onCorrected={() => {
                      setOwnershipRefreshKey(k => k + 1);
                      void loadAssets();
                    }}
                  />
                </>
              )}

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
          <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 [&>*]:min-w-0">
            {selectedAsset && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
                        {assetTypeIcons[selectedAsset.type]}
                      </div>
                      <div className="min-w-0">
                        <DialogTitle className="truncate text-xl">{selectedAsset.name}</DialogTitle>
                        <DialogDescription className="truncate">
                          {assetTypeLabels[selectedAsset.type]}
                          {selectedAsset.type === 'VEHICLE' && selectedAsset.vehicleMake && (
                            <> · {selectedAsset.vehicleMake} {selectedAsset.vehicleModel} {selectedAsset.vehicleYear}</>
                          )}
                        </DialogDescription>
                      </div>
                    </div>
                    <Badge className={cn('shrink-0', statusColors[selectedAsset.status])}>
                      {selectedAsset.status}
                    </Badge>
                  </div>
                </DialogHeader>

                {/* Polished glass KPI tiles — 2×2 on mobile, 4-across on sm+.
                    min-w-0 + truncate so long numbers never overflow the dialog
                    (Stitch redesign screen 770abf40f2584174b52db63a4310a34a). */}
                <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4 sm:gap-4">
                  {(() => {
                    const dep = selectedAsset._computed?.depreciation || 0;
                    const direction = assetValueDirection(dep); // MON-041 (one source)
                    const gained = direction !== 'depreciation'; // appreciation / unchanged
                    return (
                      <>
                        <KpiTile
                          accent="from-sky-400 to-indigo-500"
                          label="Purchase Price"
                          value={formatCurrency(selectedAsset.purchasePrice)}
                          sub={formatDate(selectedAsset.purchaseDate)}
                        />
                        <KpiTile
                          accent="from-sky-400 to-indigo-500"
                          label="Current Value"
                          value={formatCurrency(selectedAsset.currentValue)}
                          sub={formatDate(selectedAsset.valuationDate)}
                        />
                        <KpiTile
                          accent={gained ? 'from-emerald-400 to-teal-500' : 'from-rose-400 to-orange-500'}
                          // MON-041: an appreciating asset (currentValue ≥ purchase)
                          // is APPRECIATION, not "Depreciation -200%". Label by
                          // direction + show the magnitude % (icon/colour convey
                          // the sign) — ONE source: lib/assets/valueChange.
                          label={direction === 'appreciation' ? 'Appreciation' : direction === 'depreciation' ? 'Depreciation' : 'Value change'}
                          value={formatCurrency(Math.abs(dep))}
                          valueIcon={
                            gained ? (
                              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 shrink-0 text-rose-500" />
                            )
                          }
                          sub={`${assetValueChangeMagnitudePercent(selectedAsset._computed?.depreciationPercent || 0).toFixed(1)}%`}
                        />
                        <KpiTile
                          accent="from-violet-400 to-indigo-500"
                          label="Total Cost"
                          value={formatCurrency(selectedAsset._computed?.totalCostOfOwnership || 0)}
                          sub={`${formatCurrency(selectedAsset._computed?.annualExpenses || 0)}/year`}
                        />
                      </>
                    );
                  })()}
                </div>

                <Tabs defaultValue="expenses">
                  <TabsList className="flex w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    <TabsTrigger value="documents">
                      <FolderOpen className="h-4 w-4 mr-1" /> Documents
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="documents" className="mt-4">
                    <DocumentsSection
                      entityType={LinkedEntityType.ASSET}
                      entityId={selectedAsset.id}
                      entityLabel={selectedAsset.name}
                      defaultCategory={DocumentCategory.RECEIPT}
                      analyzeOnUpload
                      onExpenseAdded={() => loadAssetDetail(selectedAsset.id)}
                    />
                  </TabsContent>

                  <TabsContent value="expenses" className="mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-muted-foreground">
                        {selectedAsset.expenses?.length || 0} expense{(selectedAsset.expenses?.length || 0) !== 1 ? 's' : ''} linked
                      </p>
                      <Button
                        size="sm"
                        onClick={() => {
                          resetExpenseForm();
                          setShowExpenseDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Expense
                      </Button>
                    </div>
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
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(expense.amount)}</p>
                                <p className="text-sm text-muted-foreground">{expense.frequency}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditExpense(expense)}
                                title={`Edit ${expense.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <DocumentAttachButton
                                links={[
                                  { entityType: LinkedEntityType.EXPENSE, entityId: expense.id },
                                  { entityType: LinkedEntityType.ASSET, entityId: selectedAsset.id },
                                ]}
                                title={`Attach a document to ${expense.name}`}
                                onUploaded={() => loadAssetDetail(selectedAsset.id)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteExpense(expense.id, expense.name)}
                                title={`Delete ${expense.name}`}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">No expenses linked to this asset</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add common expenses like insurance, maintenance, or fuel
                        </p>
                      </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                          {/* Renewals & reminders (Phase 21.5). Dates always
                              shown; the urgency chip auto-appears when a
                              renewal is overdue / due-soon / upcoming. */}
                          {(() => {
                            const rows: Array<{
                              key: string;
                              label: string;
                              date: string | null;
                              provider?: string | null;
                              extra?: string | null;
                            }> = [
                              { key: 'rego', label: 'Registration renewal', date: selectedAsset.vehicleRegistrationExpiry },
                              { key: 'ctp', label: 'CTP renewal', date: selectedAsset.vehicleCtpExpiry, provider: selectedAsset.vehicleCtpProvider },
                              {
                                key: 'comp',
                                label: 'Comprehensive renewal',
                                date: selectedAsset.vehicleInsuranceExpiry,
                                provider: selectedAsset.vehicleInsuranceProvider,
                                extra: selectedAsset.vehicleInsurancePolicyNumber
                                  ? `Policy ${selectedAsset.vehicleInsurancePolicyNumber}`
                                  : null,
                              },
                            ];
                            const hasAny = rows.some((r) => r.date);
                            const detailReminders = surfacedReminders(
                              computeAssetRenewals([selectedAsset])
                            );
                            const findUrgency = (label: string) =>
                              detailReminders.find((d) => d.label.startsWith(label.split(' ')[0]));
                            return (
                              <div className="col-span-2 mt-2 rounded-lg border bg-muted/30 p-4">
                                <p className="text-sm font-medium flex items-center gap-2 mb-3">
                                  <Shield className="h-4 w-4" /> Renewals &amp; reminders
                                </p>
                                {hasAny ? (
                                  <div className="space-y-2">
                                    {rows
                                      .filter((r) => r.date)
                                      .map((r) => {
                                        const u = findUrgency(r.label);
                                        return (
                                          <div key={r.key} className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium">{r.label}</p>
                                              {(r.provider || r.extra) && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                  {[r.provider, r.extra].filter(Boolean).join(' · ')}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {u && (
                                                <RenewalChip urgency={u.urgency} daysUntilDue={u.daysUntilDue} />
                                              )}
                                              <span className="text-sm tabular-nums text-muted-foreground">
                                                {formatDate(r.date!)}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    Add registration, CTP or insurance renewal dates when editing and we&apos;ll remind you before they&apos;re due.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
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

        {/* Add Expense Dialog */}
        <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {editingExpenseId ? 'Edit Expense' : 'Add Expense'}
              </DialogTitle>
              <DialogDescription>
                {editingExpenseId ? 'Update this expense for' : 'Add an expense linked to'}{' '}
                {selectedAsset?.name}
              </DialogDescription>
            </DialogHeader>

            {selectedAsset && (
              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                {/* Quick Templates */}
                <div className="space-y-2">
                  <Label className="text-sm">Quick Templates</Label>
                  <div className="flex flex-wrap gap-2">
                    {assetExpenseTemplates[selectedAsset.type].map((template, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => applyExpenseTemplate(template)}
                      >
                        {template.icon}
                        <span className="ml-1">{template.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseName">Expense Name</Label>
                  <Input
                    id="expenseName"
                    value={expenseFormData.name}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, name: e.target.value })}
                    placeholder="e.g., Registration, Insurance, Fuel"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expenseAmount">Amount</Label>
                    <Input
                      id="expenseAmount"
                      type="number"
                      value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expenseFrequency">Frequency</Label>
                    <Select
                      value={expenseFormData.frequency}
                      onValueChange={(value) => setExpenseFormData({ ...expenseFormData, frequency: value })}
                    >
                      <SelectTrigger id="expenseFrequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                        <SelectItem value="ANNUAL">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseCategory">Category</Label>
                  <Select
                    value={expenseFormData.category}
                    onValueChange={(value) => setExpenseFormData({ ...expenseFormData, category: value })}
                  >
                    <SelectTrigger id="expenseCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRANSPORT">Transport</SelectItem>
                      <SelectItem value="INSURANCE">Insurance</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="UTILITIES">Utilities</SelectItem>
                      <SelectItem value="HOUSING">Housing</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isTaxDeductible"
                    checked={expenseFormData.isTaxDeductible}
                    onCheckedChange={(checked) => setExpenseFormData({ ...expenseFormData, isTaxDeductible: checked as boolean })}
                  />
                  <Label htmlFor="isTaxDeductible" className="text-sm font-normal cursor-pointer">
                    Tax deductible expense
                  </Label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowExpenseDialog(false);
                      resetExpenseForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingExpenseId ? 'Save changes' : 'Add Expense'}
                  </Button>
                </div>
              </form>
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
