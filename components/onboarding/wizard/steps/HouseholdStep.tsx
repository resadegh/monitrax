'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Dog, Plus, Pencil, Trash2, Baby, Car } from 'lucide-react';
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
  RELATIONSHIP_LABELS,
  PET_TYPE_LABELS,
} from '../types';
import '@/styles/wizard-animations.css';

// =============================================================================
// TYPES
// =============================================================================

interface HouseholdStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HouseholdStep({ data, onUpdate }: HouseholdStepProps) {
  // Member dialog state
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMemberInput | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    relationship: 'SELF' as HouseholdRelationship,
    dateOfBirth: '',
    isIncomeEarner: true,
  });

  // Pet dialog state
  const [petDialogOpen, setPetDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<HouseholdPetInput | null>(null);
  const [petForm, setPetForm] = useState({
    name: '',
    type: 'DOG' as HouseholdPetType,
    breed: '',
  });

  // =============================================================================
  // MEMBER OPERATIONS
  // =============================================================================

  const openAddMemberDialog = () => {
    setEditingMember(null);
    const hasSelf = data.householdMembers.some(m => m.relationship === 'SELF');
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
      // Update existing member
      const updatedMembers = data.householdMembers.map(m =>
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
      // Add new member
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
    onUpdate({ householdMembers: data.householdMembers.filter(m => m.id !== id) });
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

  const openEditPetDialog = (pet: HouseholdPetInput) => {
    setEditingPet(pet);
    setPetForm({
      name: pet.name,
      type: pet.type,
      breed: pet.breed || '',
    });
    setPetDialogOpen(true);
  };

  const savePet = () => {
    if (!petForm.name.trim()) return;

    if (editingPet) {
      // Update existing pet
      const updatedPets = data.householdPets.map(p =>
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
      // Add new pet
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
    onUpdate({ householdPets: data.householdPets.filter(p => p.id !== id) });
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6 wizard-step-enter">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Who&apos;s in Your Household?</h2>
        <p className="text-muted-foreground mt-2">
          Add your household members and pets to create personalized tracking categories
        </p>
      </div>

      {/* Household Members Section */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Household Members
            </h3>
            <p className="text-sm text-muted-foreground">
              Add people in your household to track income and expenses separately
            </p>
          </div>
          <Button onClick={openAddMemberDialog} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>

        {data.householdMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No household members added yet</p>
            <p className="text-sm">Start by adding yourself</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      {/* Pets Section */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Dog className="h-5 w-5" />
              Pets
            </h3>
            <p className="text-sm text-muted-foreground">
              Add pets to track vet bills, food, and insurance expenses
            </p>
          </div>
          <Button onClick={openAddPetDialog} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Pet
          </Button>
        </div>

        {data.householdPets.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
            <Dog className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pets? Skip this section</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
      </div>

      {/* Vehicles Section */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Car className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="font-semibold">Vehicles</h3>
            <p className="text-sm text-muted-foreground">
              How many vehicles does your household have?
            </p>
          </div>
          <Select
            value={String(data.carsCount)}
            onValueChange={(v) => onUpdate({ carsCount: parseInt(v) })}
          >
            <SelectTrigger className="w-32">
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
      </div>

      {/* Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Edit Member' : 'Add Member'}
            </DialogTitle>
            <DialogDescription>
              Categories will be created automatically based on their role
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="Enter name"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Select
                value={memberForm.relationship}
                onValueChange={(v) => setMemberForm({ ...memberForm, relationship: v as HouseholdRelationship })}
              >
                <SelectTrigger id="relationship">
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
                <Label htmlFor="dob">Date of Birth (optional)</Label>
                <Input
                  id="dob"
                  type="date"
                  value={memberForm.dateOfBirth}
                  onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })}
                />
              </div>
            )}
            {memberForm.relationship !== 'CHILD' && (
              <div className="flex items-center gap-3">
                <Switch
                  id="earner"
                  checked={memberForm.isIncomeEarner}
                  onCheckedChange={(checked) => setMemberForm({ ...memberForm, isIncomeEarner: checked })}
                />
                <Label htmlFor="earner" className="cursor-pointer">
                  Income earner
                  <span className="block text-xs text-muted-foreground font-normal">
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

      {/* Pet Dialog */}
      <Dialog open={petDialogOpen} onOpenChange={setPetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingPet ? 'Edit Pet' : 'Add Pet'}
            </DialogTitle>
            <DialogDescription>
              Expense categories will be created automatically
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
                autoFocus
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
            <Button onClick={savePet} disabled={!petForm.name.trim()}>
              {editingPet ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
  member: HouseholdMemberInput;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isChild = member.relationship === 'CHILD';

  return (
    <div className="p-3 border rounded-lg bg-background flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isChild ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary/10'}`}>
          {isChild ? (
            <Baby className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Users className="h-4 w-4 text-primary" />
          )}
        </div>
        <div>
          <div className="font-medium text-sm">{member.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {RELATIONSHIP_LABELS[member.relationship]}
            {member.isIncomeEarner && !isChild && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                Earner
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-red-500" />
        </Button>
      </div>
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
  pet: HouseholdPetInput;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-3 border rounded-lg bg-background flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-cyan-100 dark:bg-cyan-900/30">
          <Dog className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <div className="font-medium text-sm">{pet.name}</div>
          <div className="text-xs text-muted-foreground">
            {PET_TYPE_LABELS[pet.type]}
            {pet.breed && ` - ${pet.breed}`}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

export default HouseholdStep;
