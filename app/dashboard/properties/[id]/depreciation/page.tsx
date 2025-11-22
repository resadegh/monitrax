'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Calculator, Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string | null;
}

interface DepreciationSchedule {
  id: string;
  propertyId: string;
  category: 'DIV40' | 'DIV43';
  assetName: string;
  cost: number;
  startDate: string;
  rate: number;
  method: 'PRIME_COST' | 'DIMINISHING_VALUE';
  notes: string | null;
}

export default function DepreciationPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [schedules, setSchedules] = useState<DepreciationSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<DepreciationSchedule>>({
    category: 'DIV40',
    assetName: '',
    cost: 0,
    startDate: new Date().toISOString().split('T')[0],
    rate: 10,
    method: 'DIMINISHING_VALUE',
    notes: '',
  });

  useEffect(() => {
    if (token && propertyId) {
      loadProperty();
      loadSchedules();
    }
  }, [token, propertyId]);

  const loadProperty = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setProperty(await response.json());
      }
    } catch (error) {
      console.error('Error loading property:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/depreciation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setSchedules(await response.json());
      }
    } catch (error) {
      console.error('Error loading depreciation schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId
      ? `/api/properties/${propertyId}/depreciation/${editingId}`
      : `/api/properties/${propertyId}/depreciation`;
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
          cost: Number(formData.cost),
          rate: Number(formData.rate),
        }),
      });

      if (response.ok) {
        await loadSchedules();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving depreciation schedule:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'DIV40',
      assetName: '',
      cost: 0,
      startDate: new Date().toISOString().split('T')[0],
      rate: 10,
      method: 'DIMINISHING_VALUE',
      notes: '',
    });
  };

  const handleEdit = (schedule: DepreciationSchedule) => {
    setFormData({
      category: schedule.category,
      assetName: schedule.assetName,
      cost: schedule.cost,
      startDate: new Date(schedule.startDate).toISOString().split('T')[0],
      rate: schedule.rate,
      method: schedule.method,
      notes: schedule.notes || '',
    });
    setEditingId(schedule.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this depreciation schedule?')) return;

    try {
      await fetch(`/api/properties/${propertyId}/depreciation/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadSchedules();
    } catch (error) {
      console.error('Error deleting depreciation schedule:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getCategoryBadge = (category: DepreciationSchedule['category']) => {
    switch (category) {
      case 'DIV40':
        return <Badge variant="default">Div 40 - Plant & Equipment</Badge>;
      case 'DIV43':
        return <Badge variant="secondary">Div 43 - Capital Works</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const getMethodBadge = (method: DepreciationSchedule['method']) => {
    switch (method) {
      case 'PRIME_COST':
        return <Badge variant="outline">Prime Cost</Badge>;
      case 'DIMINISHING_VALUE':
        return <Badge variant="outline">Diminishing Value</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  // Calculate annual depreciation for display
  const calculateAnnualDepr = (schedule: DepreciationSchedule) => {
    const rate = schedule.rate / 100;
    if (schedule.method === 'DIMINISHING_VALUE' && schedule.category === 'DIV40') {
      // Simplified - assumes first year
      return schedule.cost * rate * 2;
    }
    return schedule.cost * rate;
  };

  const totalAnnualDepreciation = schedules.reduce((sum, s) => sum + calculateAnnualDepr(s), 0);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/properties')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Properties
        </Button>
      </div>

      <PageHeader
        title={`Depreciation - ${property?.name || 'Loading...'}`}
        description={`Manage depreciation schedules • Total annual: ${formatCurrency(totalAnnualDepreciation)}`}
        action={
          <Button onClick={() => { setShowDialog(true); setEditingId(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Schedule
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading depreciation schedules...</p>
          </div>
        </div>
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No depreciation schedules yet"
          description="Add your first depreciation schedule to track tax deductions for this property."
          action={{
            label: 'Add Depreciation Schedule',
            onClick: () => { setShowDialog(true); resetForm(); },
          }}
        />
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-muted-foreground" />
                      {schedule.assetName}
                    </CardTitle>
                    <div className="flex gap-2 mt-2">
                      {getCategoryBadge(schedule.category)}
                      {getMethodBadge(schedule.method)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(schedule)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(schedule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-medium">{formatCurrency(schedule.cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rate</p>
                    <p className="font-medium">{schedule.rate}% p.a.</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formatDate(schedule.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Deduction</p>
                    <p className="font-medium text-green-600">{formatCurrency(calculateAnnualDepr(schedule))}</p>
                  </div>
                </div>
                {schedule.notes && (
                  <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{schedule.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Depreciation Schedule' : 'Add Depreciation Schedule'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the depreciation details below.' : 'Add a new depreciable asset for this property.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assetName">Asset Name</Label>
              <Input
                id="assetName"
                value={formData.assetName}
                onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                placeholder="e.g., Air Conditioning, Carpet, Building Structure"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => {
                    const newFormData = { ...formData, category: value as DepreciationSchedule['category'] };
                    // Set default rate based on category
                    if (value === 'DIV43') {
                      newFormData.rate = 2.5;
                      newFormData.method = 'PRIME_COST';
                    } else {
                      newFormData.rate = 10;
                    }
                    setFormData(newFormData);
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIV40">Division 40 - Plant & Equipment</SelectItem>
                    <SelectItem value="DIV43">Division 43 - Capital Works</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) => setFormData({ ...formData, method: value as DepreciationSchedule['method'] })}
                  disabled={formData.category === 'DIV43'}
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIMINISHING_VALUE">Diminishing Value</SelectItem>
                    <SelectItem value="PRIME_COST">Prime Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  placeholder="5000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">Rate (% p.a.)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })}
                  placeholder="10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
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
                {editingId ? 'Update Schedule' : 'Add Schedule'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
