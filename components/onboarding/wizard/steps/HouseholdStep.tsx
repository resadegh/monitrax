'use client';

/**
 * HouseholdStep — Phase 12 PR 3a visual redesign
 *
 * Composes the new PR 3a primitives. Still captures the same fields as
 * before (members, pets, cars count); no data model changes. The
 * lifestyle fields (lifestylePreference, diningOutFrequency,
 * hobbiesWithCosts) land in PR 3b, not here.
 *
 * Layout:
 *   [WizardStepShell]
 *     ├─ Members section
 *     │   ├─ empty state OR member cards grid
 *     │   └─ Add member dialog
 *     ├─ Pets section
 *     │   ├─ empty state OR pet cards grid
 *     │   └─ Add pet dialog
 *     └─ Vehicles section (inline number picker)
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Dog,
  Plus,
  Pencil,
  Trash2,
  Baby,
  Car,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  WizardData,
  HouseholdMemberInput,
  HouseholdPetInput,
  HouseholdRelationship,
  HouseholdPetType,
  LifestylePreference,
  DiningFrequency,
  RELATIONSHIP_LABELS,
  PET_TYPE_LABELS,
} from '../types';
import {
  WizardStepShell,
  WizardSection,
  WizardSegmentedControl,
  WizardField,
} from '../primitives';
import '@/styles/wizard-animations.css';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface HouseholdStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function HouseholdStep({ data, onUpdate }: HouseholdStepProps) {
  // ---- Member dialog state -------------------------------------------
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMemberInput | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    relationship: 'SELF' as HouseholdRelationship,
    dateOfBirth: '',
    isIncomeEarner: true,
  });

  // ---- Pet dialog state ----------------------------------------------
  const [petDialogOpen, setPetDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<HouseholdPetInput | null>(null);
  const [petForm, setPetForm] = useState({
    name: '',
    type: 'DOG' as HouseholdPetType,
    breed: '',
  });

  // ---- Member operations ---------------------------------------------
  const openAddMemberDialog = () => {
    setEditingMember(null);
    const hasSelf = data.householdMembers.some((m) => m.relationship === 'SELF');
    setMemberForm({
      name: '',
      relationship: hasSelf ? 'SPOUSE' : 'SELF',
      dateOfBirth: '',
      isIncomeEarner: true,
    });
    setMemberDialogOpen(true);
  };

  const openEditMemberDialog = (member: HouseholdMemberInput) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      relationship: member.relationship,
      dateOfBirth: member.dateOfBirth || '',
      isIncomeEarner: member.isIncomeEarner,
    });
    setMemberDialogOpen(true);
  };

  const saveMember = () => {
    if (!memberForm.name.trim()) return;
    if (editingMember) {
      const updatedMembers = data.householdMembers.map((m) =>
        m.id === editingMember.id
          ? {
              ...m,
              name: memberForm.name.trim(),
              relationship: memberForm.relationship,
              dateOfBirth: memberForm.dateOfBirth || undefined,
              isIncomeEarner: memberForm.isIncomeEarner,
            }
          : m
      );
      onUpdate({ householdMembers: updatedMembers });
    } else {
      const newMember: HouseholdMemberInput = {
        id: `member-${Date.now()}`,
        name: memberForm.name.trim(),
        relationship: memberForm.relationship,
        dateOfBirth: memberForm.dateOfBirth || undefined,
        isIncomeEarner: memberForm.isIncomeEarner,
      };
      onUpdate({ householdMembers: [...data.householdMembers, newMember] });
    }
    setMemberDialogOpen(false);
  };

  const deleteMember = (id: string) => {
    onUpdate({ householdMembers: data.householdMembers.filter((m) => m.id !== id) });
  };

  // ---- Pet operations ------------------------------------------------
  const openAddPetDialog = () => {
    setEditingPet(null);
    setPetForm({ name: '', type: 'DOG', breed: '' });
    setPetDialogOpen(true);
  };

  const openEditPetDialog = (pet: HouseholdPetInput) => {
    setEditingPet(pet);
    setPetForm({ name: pet.name, type: pet.type, breed: pet.breed || '' });
    setPetDialogOpen(true);
  };

  const savePet = () => {
    if (!petForm.name.trim()) return;
    if (editingPet) {
      const updatedPets = data.householdPets.map((p) =>
        p.id === editingPet.id
          ? {
              ...p,
              name: petForm.name.trim(),
              type: petForm.type,
              breed: petForm.breed.trim() || undefined,
            }
          : p
      );
      onUpdate({ householdPets: updatedPets });
    } else {
      const newPet: HouseholdPetInput = {
        id: `pet-${Date.now()}`,
        name: petForm.name.trim(),
        type: petForm.type,
        breed: petForm.breed.trim() || undefined,
      };
      onUpdate({ householdPets: [...data.householdPets, newPet] });
    }
    setPetDialogOpen(false);
  };

  const deletePet = (id: string) => {
    onUpdate({ householdPets: data.householdPets.filter((p) => p.id !== id) });
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <WizardStepShell
      icon={<Users className="h-8 w-8" strokeWidth={1.5} />}
      title="Your household"
      subtitle="Who are you building this for? We'll personalise your TRAIL journey for your whole family."
    >
      {/* Members */}
      <WizardSection
        icon={<Users className="h-4 w-4" />}
        iconClassName="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
        title="Household members"
        description="Add the people who live with you — including yourself."
        trailing={
          <Button onClick={openAddMemberDialog} size="sm" variant="outline">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        }
      >
        {data.householdMembers.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No members yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Start by adding yourself
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.householdMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={() => openEditMemberDialog(member)}
                onDelete={() => deleteMember(member.id)}
              />
            ))}
          </div>
        )}
      </WizardSection>

      {/* Pets */}
      <WizardSection
        icon={<Dog className="h-4 w-4" />}
        iconClassName="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400"
        title="Pets"
        description="Track vet bills, food, insurance per pet."
        trailing={
          <Button onClick={openAddPetDialog} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        }
      >
        {data.householdPets.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-5 text-center">
            <Dog className="mx-auto mb-1.5 h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-500 dark:text-slate-500">
              No pets? Skip this section.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {data.householdPets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                onEdit={() => openEditPetDialog(pet)}
                onDelete={() => deletePet(pet.id)}
              />
            ))}
          </div>
        )}
      </WizardSection>

      {/* Vehicles — segmented count picker */}
      <WizardSection
        icon={<Car className="h-4 w-4" />}
        iconClassName="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
        title="Vehicles"
        description="How many vehicles does your household have?"
      >
        <WizardSegmentedControl<string>
          value={String(data.carsCount)}
          onChange={(v) => onUpdate({ carsCount: parseInt(v, 10) })}
          options={[
            { value: '0', label: 'None' },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4+' },
          ]}
          name="cars-count"
        />
      </WizardSection>

      {/* Phase 12 PR 3b: Lifestyle fields (Phase 28 budget AI) */}
      <WizardSection
        icon={<Sparkles className="h-4 w-4" />}
        iconClassName="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
        title="Your lifestyle"
        description="We use this to personalise your budget estimates."
      >
        <div className="space-y-4">
          <WizardSegmentedControl<LifestylePreference>
            label="How would you describe your spending?"
            value={data.lifestylePreference}
            onChange={(v) => onUpdate({ lifestylePreference: v })}
            options={[
              { value: 'FRUGAL', label: 'Frugal' },
              { value: 'MODERATE', label: 'Moderate' },
              { value: 'COMFORTABLE', label: 'Comfortable' },
            ]}
            name="lifestyle-preference"
          />
          <WizardSegmentedControl<DiningFrequency>
            label="How often do you eat out?"
            value={data.diningOutFrequency}
            onChange={(v) => onUpdate({ diningOutFrequency: v })}
            options={[
              { value: 'NEVER', label: 'Never' },
              { value: 'RARELY', label: 'Rarely' },
              { value: 'SOMETIMES', label: 'Sometimes' },
              { value: 'OFTEN', label: 'Often' },
            ]}
            name="dining-frequency"
          />
          <WizardField
            label="Any expensive hobbies?"
            placeholder="e.g. golf, photography, restoring cars"
            value={data.hobbiesWithCosts}
            onChange={(e) => onUpdate({ hobbiesWithCosts: e.target.value })}
            helper="Optional — helps the budget AI allow for hobby-related spending"
          />
        </div>
      </WizardSection>

      {/* Member dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit member' : 'Add member'}</DialogTitle>
            <DialogDescription>
              Categories will be created automatically based on their role.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="e.g. Reza"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="member-relationship">Relationship</Label>
              <Select
                value={memberForm.relationship}
                onValueChange={(v) =>
                  setMemberForm({ ...memberForm, relationship: v as HouseholdRelationship })
                }
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
              <div className="grid gap-1.5">
                <Label htmlFor="member-dob">Date of birth (optional)</Label>
                <Input
                  id="member-dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={memberForm.dateOfBirth}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, dateOfBirth: e.target.value })
                  }
                />
              </div>
            )}
            {memberForm.relationship !== 'CHILD' && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-3 py-2.5">
                <Switch
                  id="member-earner"
                  checked={memberForm.isIncomeEarner}
                  onCheckedChange={(checked) =>
                    setMemberForm({ ...memberForm, isIncomeEarner: checked })
                  }
                />
                <Label htmlFor="member-earner" className="cursor-pointer">
                  <span className="font-medium">Income earner</span>
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                    Creates salary and work expense categories
                  </span>
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMember} disabled={!memberForm.name.trim()}>
              {editingMember ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pet dialog */}
      <Dialog open={petDialogOpen} onOpenChange={setPetDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingPet ? 'Edit pet' : 'Add pet'}</DialogTitle>
            <DialogDescription>
              Expense categories will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pet-name">Name</Label>
              <Input
                id="pet-name"
                value={petForm.name}
                onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                placeholder="e.g. Fandogh"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
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
            <div className="grid gap-1.5">
              <Label htmlFor="pet-breed">Breed (optional)</Label>
              <Input
                id="pet-breed"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                placeholder="e.g. Golden Retriever"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePet} disabled={!petForm.name.trim()}>
              {editingPet ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WizardStepShell>
  );
}

// =============================================================================
// MEMBER CARD
// =============================================================================

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: HouseholdMemberInput;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isChild = member.relationship === 'CHILD';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
            isChild
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
          }`}
        >
          {isChild ? <Baby className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {member.name}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {RELATIONSHIP_LABELS[member.relationship]}
            {member.isIncomeEarner && !isChild && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                Earner
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// PET CARD
// =============================================================================

function PetCard({
  pet,
  onEdit,
  onDelete,
}: {
  pet: HouseholdPetInput;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400">
          <Dog className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {pet.name}
          </div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {PET_TYPE_LABELS[pet.type]}
            {pet.breed && ` · ${pet.breed}`}
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
        </Button>
      </div>
    </div>
  );
}

export default HouseholdStep;
