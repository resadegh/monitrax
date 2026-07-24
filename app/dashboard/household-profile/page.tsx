'use client';

/**
 * My Household — profile + members. MON-088 adds the per-member
 * "Private hospital cover?" tri-state control (Yes / No / Not sure) to the
 * member dialog — it drives the Medicare levy surcharge in the tax engine
 * (null = not entered → conservatively treated as no cover).
 * Control design: Stitch screen 16e804559bf74af8b1c2b02d2e7f8b78, project
 * 1859462351962811110 (§18.8 9.2/10).
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  UserPlus,
  Baby,
  Car,
  Dog,
  Utensils,
  Sparkles,
  Save,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Heart,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type LifestylePreference = 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
type DiningFrequency = 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';
type HouseholdRelationship = 'SELF' | 'SPOUSE' | 'PARTNER' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
type HouseholdPetType = 'DOG' | 'CAT' | 'BIRD' | 'FISH' | 'RABBIT' | 'REPTILE' | 'OTHER';

interface LinkedCategory {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  color: string | null;
  icon: string | null;
}

interface HouseholdMember {
  id: string;
  name: string;
  relationship: HouseholdRelationship;
  dateOfBirth: string | null;
  isIncomeEarner: boolean;
  /** MON-088: private hospital cover — null = "not sure / not entered". */
  hasPrivateHospitalCover: boolean | null;
  sortOrder: number;
  linkedCategories: LinkedCategory[];
}

interface HouseholdPet {
  id: string;
  name: string;
  type: HouseholdPetType;
  breed: string | null;
  sortOrder: number;
  linkedCategories: LinkedCategory[];
}

interface HouseholdProfile {
  id: string;
  adultsCount: number;
  childrenCount: number;
  childrenAges: number[];
  petsCount: number;
  petTypes: string[];
  carsCount: number;
  lifestylePreference: LifestylePreference;
  diningOutFrequency: DiningFrequency;
  hobbiesWithCosts: string;
  isComplete: boolean;
  needsMigration?: boolean;
  members: HouseholdMember[];
  pets: HouseholdPet[];
}

const RELATIONSHIP_LABELS: Record<HouseholdRelationship, string> = {
  SELF: 'You',
  SPOUSE: 'Spouse',
  PARTNER: 'Partner',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  OTHER: 'Other',
};

const PET_TYPE_LABELS: Record<HouseholdPetType, string> = {
  DOG: 'Dog',
  CAT: 'Cat',
  BIRD: 'Bird',
  FISH: 'Fish',
  RABBIT: 'Rabbit',
  REPTILE: 'Reptile',
  OTHER: 'Other',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function HouseholdProfilePage() {
  const { token, user } = useAuth();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Member dialog state
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    relationship: 'SELF' as HouseholdRelationship,
    dateOfBirth: '',
    isIncomeEarner: false,
    hasPrivateHospitalCover: null as boolean | null,
  });
  const [savingMember, setSavingMember] = useState(false);

  // Pet dialog state
  const [petDialogOpen, setPetDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<HouseholdPet | null>(null);
  const [petForm, setPetForm] = useState({
    name: '',
    type: 'DOG' as HouseholdPetType,
    breed: '',
  });
  const [savingPet, setSavingPet] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: 'member' | 'pet'; id: string; name: string } | null>(null);

  // Lifestyle preferences
  const [lifestylePreference, setLifestylePreference] = useState<LifestylePreference>('MODERATE');
  const [diningOutFrequency, setDiningOutFrequency] = useState<DiningFrequency>('SOMETIMES');
  const [carsCount, setCarsCount] = useState(0);
  const [hobbiesWithCosts, setHobbiesWithCosts] = useState('');

  // =============================================================================
  // FETCH PROFILE
  // =============================================================================

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/household-profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProfile(result.data);
          setLifestylePreference(result.data.lifestylePreference);
          setDiningOutFrequency(result.data.diningOutFrequency);
          setCarsCount(result.data.carsCount);
          setHobbiesWithCosts(result.data.hobbiesWithCosts || '');
          setNeedsMigration(result._meta?.needsMigration || false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token, fetchProfile]);

  // =============================================================================
  // MEMBER OPERATIONS
  // =============================================================================

  const openAddMemberDialog = () => {
    setEditingMember(null);
    // Pre-populate with user's name if adding SELF and no SELF exists
    const hasSelf = profile?.members.some(m => m.relationship === 'SELF');
    setMemberForm({
      name: !hasSelf && user?.name ? user.name : '',
      relationship: hasSelf ? 'SPOUSE' : 'SELF',
      dateOfBirth: '',
      isIncomeEarner: true,
      hasPrivateHospitalCover: null,
    });
    setMemberDialogOpen(true);
  };

  const openEditMemberDialog = (member: HouseholdMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      relationship: member.relationship,
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
      isIncomeEarner: member.isIncomeEarner,
      hasPrivateHospitalCover: member.hasPrivateHospitalCover ?? null,
    });
    setMemberDialogOpen(true);
  };

  const saveMember = async () => {
    if (!memberForm.name.trim()) {
      setError('Please enter a name');
      return;
    }

    setSavingMember(true);
    setError('');

    try {
      const url = editingMember
        ? `/api/household-members/${editingMember.id}`
        : '/api/household-members';

      const response = await fetch(url, {
        method: editingMember ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: memberForm.name.trim(),
          relationship: memberForm.relationship,
          dateOfBirth: memberForm.dateOfBirth || null,
          isIncomeEarner: memberForm.isIncomeEarner,
          hasPrivateHospitalCover: memberForm.hasPrivateHospitalCover,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save member');
      }

      setMemberDialogOpen(false);
      setSuccess(editingMember ? 'Member updated successfully' : 'Member added successfully');
      fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member');
    } finally {
      setSavingMember(false);
    }
  };

  // =============================================================================
  // PET OPERATIONS
  // =============================================================================

  const openAddPetDialog = () => {
    setEditingPet(null);
    setPetForm({
      name: '',
      type: 'DOG',
      breed: '',
    });
    setPetDialogOpen(true);
  };

  const openEditPetDialog = (pet: HouseholdPet) => {
    setEditingPet(pet);
    setPetForm({
      name: pet.name,
      type: pet.type,
      breed: pet.breed || '',
    });
    setPetDialogOpen(true);
  };

  const savePet = async () => {
    if (!petForm.name.trim()) {
      setError('Please enter a name');
      return;
    }

    setSavingPet(true);
    setError('');

    try {
      const url = editingPet
        ? `/api/household-pets/${editingPet.id}`
        : '/api/household-pets';

      const response = await fetch(url, {
        method: editingPet ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: petForm.name.trim(),
          type: petForm.type,
          breed: petForm.breed.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save pet');
      }

      setPetDialogOpen(false);
      setSuccess(editingPet ? 'Pet updated successfully' : 'Pet added successfully');
      fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pet');
    } finally {
      setSavingPet(false);
    }
  };

  // =============================================================================
  // DELETE OPERATIONS
  // =============================================================================

  const confirmDelete = (type: 'member' | 'pet', id: string, name: string) => {
    setDeletingItem({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!deletingItem) return;

    try {
      const url = deletingItem.type === 'member'
        ? `/api/household-members/${deletingItem.id}`
        : `/api/household-pets/${deletingItem.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete');
      }

      setSuccess(`${deletingItem.name} removed successfully`);
      fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };

  // =============================================================================
  // SAVE LIFESTYLE PREFERENCES
  // =============================================================================

  const savePreferences = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/household-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adultsCount: profile?.members.filter(m => m.relationship !== 'CHILD').length || 1,
          childrenCount: profile?.members.filter(m => m.relationship === 'CHILD').length || 0,
          childrenAges: profile?.childrenAges || [],
          petsCount: profile?.pets.length || 0,
          petTypes: profile?.pets.map(p => p.type.toLowerCase()) || [],
          carsCount,
          lifestylePreference,
          diningOutFrequency,
          hobbiesWithCosts: hobbiesWithCosts || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save preferences');
      }

      setSuccess('Preferences saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // CALCULATE PROGRESS
  // =============================================================================

  const calculateProgress = () => {
    if (!profile) return 0;

    let completed = 0;
    const total = 4;

    // Has at least one member
    if (profile.members.length >= 1) completed++;
    // Has lifestyle preference set
    if (lifestylePreference) completed++;
    // Has dining frequency set
    if (diningOutFrequency) completed++;
    // Either has pets OR explicitly has 0 pets configured
    if (profile.pets.length > 0 || profile.petsCount === 0) completed++;

    return Math.round((completed / total) * 100);
  };

  const progress = calculateProgress();

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Household Profile"
        description="Tell us about your household to get accurate budget estimates and personalized tracking"
      />

      <div className="space-y-6 max-w-5xl">
        {/* Progress indicator */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Profile Completion</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {progress === 100 && (
              <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Profile complete
              </div>
            )}
          </CardContent>
        </Card>

        {/* Migration prompt for existing users */}
        {needsMigration && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800 dark:text-amber-200">
                    Upgrade Your Household Profile
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Add names to your household members and pets to unlock personalized expense categories.
                    This will help you track spending for each person and pet individually.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error/Success messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button onClick={() => setError('')} className="ml-auto hover:opacity-70">
              &times;
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-300 text-sm">
            <CheckCircle className="h-4 w-4" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto hover:opacity-70">
              &times;
            </button>
          </div>
        )}

        {/* Household Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Household Members
                </CardTitle>
                <CardDescription>
                  Add people living in your household to create personalized categories
                </CardDescription>
              </div>
              <Button onClick={openAddMemberDialog} size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {profile?.members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No household members yet</p>
                <p className="text-sm">Start by adding yourself</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile?.members.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onEdit={() => openEditMemberDialog(member)}
                    onDelete={() => confirmDelete('member', member.id, member.name)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Household Pets */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Pets
                </CardTitle>
                <CardDescription>
                  Add your pets to track their expenses separately
                </CardDescription>
              </div>
              <Button onClick={openAddPetDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Pet
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {profile?.pets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Dog className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pets added yet</p>
                <p className="text-sm">Add a pet to track vet bills, food, and insurance</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profile?.pets.map((pet) => (
                  <PetCard
                    key={pet.id}
                    pet={pet}
                    onEdit={() => openEditPetDialog(pet)}
                    onDelete={() => confirmDelete('pet', pet.id, pet.name)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Household Vehicles
            </CardTitle>
            <CardDescription>
              {/* MON-042: this is a DECLARED expense-calibration input (how many
                  vehicles the household runs day-to-day), used to estimate
                  running costs. It is deliberately separate from — and may
                  differ from — the vehicles tracked in My Wealth → Assets
                  (which can include plant/equipment like an excavator). The
                  label makes that distinction explicit so the two counts
                  reading differently is not read as an inconsistency. */}
              How many vehicles does your household run day-to-day? We use this
              to estimate running costs like rego, fuel and insurance — it&rsquo;s
              separate from the vehicles you track in My Wealth &rarr; Assets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Select
                value={String(carsCount)}
                onValueChange={(v) => setCarsCount(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? 'vehicle' : 'vehicles'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lifestyle Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Lifestyle Preferences
            </CardTitle>
            <CardDescription>
              This helps calibrate your expense estimates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>Spending Style</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    value: 'FRUGAL' as LifestylePreference,
                    label: 'Frugal',
                    description: 'Budget-conscious, prioritize savings',
                  },
                  {
                    value: 'MODERATE' as LifestylePreference,
                    label: 'Moderate',
                    description: 'Balanced approach, reasonable spending',
                  },
                  {
                    value: 'COMFORTABLE' as LifestylePreference,
                    label: 'Comfortable',
                    description: 'Higher quality choices, more convenience',
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLifestylePreference(option.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      lifestylePreference === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Dining Out Frequency</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: 'NEVER' as DiningFrequency, label: 'Never', description: 'Always cook at home' },
                  { value: 'RARELY' as DiningFrequency, label: 'Rarely', description: '1-2 times/month' },
                  { value: 'SOMETIMES' as DiningFrequency, label: 'Sometimes', description: 'About weekly' },
                  { value: 'OFTEN' as DiningFrequency, label: 'Often', description: 'Multiple times/week' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDiningOutFrequency(option.value)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      diningOutFrequency === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hobbies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Hobbies & Activities
            </CardTitle>
            <CardDescription>
              Optional: List any hobbies with regular costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g., Golf membership ($200/mo), gym ($60/mo), kids soccer ($50/mo)"
              value={hobbiesWithCosts}
              onChange={(e) => setHobbiesWithCosts(e.target.value)}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={savePreferences}
            disabled={saving}
            variant="outline"
            className="flex-1"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Preferences
          </Button>
          <Button
            onClick={() => router.push('/dashboard/budget-analysis')}
            disabled={progress < 50}
            className="flex-1"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Budget Analysis
          </Button>
        </div>
      </div>

      {/* Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Edit Household Member' : 'Add Household Member'}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? 'Update the details for this household member'
                : 'Add a new person to your household. Categories will be created automatically.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-relationship">Relationship</Label>
              <Select
                value={memberForm.relationship}
                onValueChange={(v) => setMemberForm({ ...memberForm, relationship: v as HouseholdRelationship })}
              >
                <SelectTrigger id="member-relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {memberForm.relationship === 'CHILD' && (
              <div className="grid gap-2">
                <Label htmlFor="member-dob">Date of Birth (optional)</Label>
                <Input
                  id="member-dob"
                  type="date"
                  value={memberForm.dateOfBirth}
                  onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })}
                />
              </div>
            )}
            {memberForm.relationship !== 'CHILD' && (
              <div className="flex items-center gap-3">
                <Switch
                  id="member-earner"
                  checked={memberForm.isIncomeEarner}
                  onCheckedChange={(checked) => setMemberForm({ ...memberForm, isIncomeEarner: checked })}
                />
                <Label htmlFor="member-earner" className="cursor-pointer">
                  Income earner
                  <span className="block text-xs text-muted-foreground font-normal">
                    Creates salary and work expense categories
                  </span>
                </Label>
              </div>
            )}
            {memberForm.relationship !== 'CHILD' && (
              <div>
                <Label className="text-[13px]">Private hospital cover?</Label>
                <div className="mt-1.5 flex rounded-full border border-foreground/15 bg-background p-0.5">
                  {([
                    ['Yes', true],
                    ['No', false],
                    ['Not sure', null],
                  ] as const).map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setMemberForm({ ...memberForm, hasPrivateHospitalCover: value })}
                      className={
                        memberForm.hasPrivateHospitalCover === value
                          ? 'flex-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-300'
                          : 'flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground'
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Affects the Medicare levy surcharge. If you&apos;re not sure, we assume no
                  cover — you can update this any time.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMember} disabled={savingMember}>
              {savingMember ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pet Dialog */}
      <Dialog open={petDialogOpen} onOpenChange={setPetDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingPet ? 'Edit Pet' : 'Add Pet'}
            </DialogTitle>
            <DialogDescription>
              {editingPet
                ? 'Update the details for this pet'
                : 'Add a pet to your household. Expense categories will be created automatically.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pet-name">Name</Label>
              <Input
                id="pet-name"
                value={petForm.name}
                onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                placeholder="Enter pet's name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pet-type">Type</Label>
              <Select
                value={petForm.type}
                onValueChange={(v) => setPetForm({ ...petForm, type: v as HouseholdPetType })}
              >
                <SelectTrigger id="pet-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PET_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pet-breed">Breed (optional)</Label>
              <Input
                id="pet-breed"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                placeholder="e.g., Golden Retriever"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePet} disabled={savingPet}>
              {savingPet ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingPet ? 'Save Changes' : 'Add Pet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deletingItem?.name} from your household.
              Any categories created for {deletingItem?.name} will be preserved
              and can still be used for tracking expenses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// =============================================================================
// MEMBER CARD COMPONENT
// =============================================================================

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: HouseholdMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isChild = member.relationship === 'CHILD';

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isChild ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary/10'}`}>
            {isChild ? (
              <Baby className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="font-medium">{member.name}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {RELATIONSHIP_LABELS[member.relationship]}
              {member.isIncomeEarner && (
                <Badge variant="secondary" className="text-xs">
                  <Briefcase className="h-3 w-3 mr-1" />
                  Earner
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      {member.linkedCategories.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <Tag className="h-3 w-3" />
            Auto-created categories
          </div>
          <div className="flex flex-wrap gap-1">
            {member.linkedCategories.map((cat) => (
              <Badge
                key={cat.id}
                variant="outline"
                className="text-xs"
                style={{ borderColor: cat.color || undefined }}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PET CARD COMPONENT
// =============================================================================

function PetCard({
  pet,
  onEdit,
  onDelete,
}: {
  pet: HouseholdPet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
            <Dog className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium">{pet.name}</div>
            <div className="text-sm text-muted-foreground">
              {PET_TYPE_LABELS[pet.type]}
              {pet.breed && ` - ${pet.breed}`}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      {pet.linkedCategories.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <Tag className="h-3 w-3" />
            Auto-created categories
          </div>
          <div className="flex flex-wrap gap-1">
            {pet.linkedCategories.map((cat) => (
              <Badge
                key={cat.id}
                variant="outline"
                className="text-xs"
                style={{ borderColor: cat.color || undefined }}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
