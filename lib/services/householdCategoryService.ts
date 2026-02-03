/**
 * Household Category Service
 *
 * Phase 29: Automatically generates and manages categories linked to household members and pets.
 * This service ensures that when members/pets are added, relevant expense and income categories
 * are automatically created for proper tracking.
 *
 * Design Principles Followed:
 * - Single source of truth: Categories created here are the canonical representation
 * - Pure functions: No side effects outside explicit database operations
 * - Extensibility: Easy to add new category templates
 */

import { prisma } from '@/lib/db';
import { CategoryType, HouseholdRelationship, HouseholdPetType } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryTemplate {
  namePattern: string;        // Pattern with {name} placeholder
  code: string;               // Base code (will be prefixed with member/pet identifier)
  type: CategoryType;
  description: string;
  color: string;
  icon: string;
}

export interface GeneratedCategory {
  name: string;
  code: string;
  type: CategoryType;
  description: string;
  color: string;
  icon: string;
}

// =============================================================================
// CATEGORY TEMPLATES BY ROLE
// =============================================================================

// Templates for adult income earners
const ADULT_EARNER_TEMPLATES: CategoryTemplate[] = [
  {
    namePattern: "{name}'s Salary",
    code: 'SALARY',
    type: 'INCOME',
    description: "Primary salary income",
    color: '#22C55E',
    icon: 'briefcase'
  },
  {
    namePattern: "{name}'s Superannuation",
    code: 'SUPER',
    type: 'INCOME',
    description: "Superannuation contributions",
    color: '#3B82F6',
    icon: 'piggy-bank'
  },
  {
    namePattern: "{name}'s Work Expenses",
    code: 'WORK_EXPENSES',
    type: 'EXPENSE',
    description: "Work-related expenses",
    color: '#6366F1',
    icon: 'briefcase'
  },
];

// Templates for adults (non-earner specific)
const ADULT_TEMPLATES: CategoryTemplate[] = [
  {
    namePattern: "{name}'s Personal Expenses",
    code: 'PERSONAL',
    type: 'EXPENSE',
    description: "Personal discretionary spending",
    color: '#8B5CF6',
    icon: 'user'
  },
];

// Templates for children
const CHILD_TEMPLATES: CategoryTemplate[] = [
  {
    namePattern: "{name}'s Education",
    code: 'EDUCATION',
    type: 'EXPENSE',
    description: "School fees, supplies, tutoring",
    color: '#F59E0B',
    icon: 'graduation-cap'
  },
  {
    namePattern: "{name}'s Activities",
    code: 'ACTIVITIES',
    type: 'EXPENSE',
    description: "Sports, hobbies, extracurricular activities",
    color: '#EF4444',
    icon: 'activity'
  },
  {
    namePattern: "{name}'s Clothing",
    code: 'CLOTHING',
    type: 'EXPENSE',
    description: "Clothing and uniforms",
    color: '#EC4899',
    icon: 'shirt'
  },
];

// Templates for pets
const PET_TEMPLATES: CategoryTemplate[] = [
  {
    namePattern: "{name} Pet Insurance",
    code: 'PET_INSURANCE',
    type: 'EXPENSE',
    description: "Pet insurance premiums",
    color: '#06B6D4',
    icon: 'shield'
  },
  {
    namePattern: "{name} Vet Expenses",
    code: 'VET',
    type: 'EXPENSE',
    description: "Veterinary care and medications",
    color: '#14B8A6',
    icon: 'stethoscope'
  },
  {
    namePattern: "{name} Food & Supplies",
    code: 'PET_FOOD',
    type: 'EXPENSE',
    description: "Food, treats, and pet supplies",
    color: '#F97316',
    icon: 'bowl'
  },
];

// Additional templates for dogs
const DOG_TEMPLATES: CategoryTemplate[] = [
  {
    namePattern: "{name} Grooming",
    code: 'GROOMING',
    type: 'EXPENSE',
    description: "Grooming and hygiene services",
    color: '#A855F7',
    icon: 'scissors'
  },
  {
    namePattern: "{name} Training",
    code: 'TRAINING',
    type: 'EXPENSE',
    description: "Training and behavior classes",
    color: '#0EA5E9',
    icon: 'award'
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique code for a category based on member/pet name
 */
function generateCategoryCode(baseName: string, baseCode: string): string {
  // Sanitize name: uppercase, replace spaces with underscore, remove special chars
  const sanitizedName = baseName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return `${sanitizedName}_${baseCode}`;
}

/**
 * Get templates for a household member based on their relationship and role
 */
function getMemberTemplates(
  relationship: HouseholdRelationship,
  isIncomeEarner: boolean
): CategoryTemplate[] {
  const templates: CategoryTemplate[] = [];

  // Adults get adult templates
  if (['SELF', 'SPOUSE', 'PARTNER', 'PARENT', 'SIBLING', 'OTHER'].includes(relationship)) {
    templates.push(...ADULT_TEMPLATES);

    // Income earners get salary-related templates
    if (isIncomeEarner) {
      templates.push(...ADULT_EARNER_TEMPLATES);
    }
  }

  // Children get child-specific templates
  if (relationship === 'CHILD') {
    templates.push(...CHILD_TEMPLATES);
  }

  return templates;
}

/**
 * Get templates for a pet based on their type
 */
function getPetTemplates(petType: HouseholdPetType): CategoryTemplate[] {
  const templates = [...PET_TEMPLATES];

  // Dogs get additional grooming/training categories
  if (petType === 'DOG') {
    templates.push(...DOG_TEMPLATES);
  }

  return templates;
}

// =============================================================================
// MAIN SERVICE FUNCTIONS
// =============================================================================

/**
 * Generate categories for a new household member
 */
export async function generateMemberCategories(
  userId: string,
  memberId: string,
  memberName: string,
  relationship: HouseholdRelationship,
  isIncomeEarner: boolean
): Promise<void> {
  const templates = getMemberTemplates(relationship, isIncomeEarner);

  for (const template of templates) {
    const name = template.namePattern.replace('{name}', memberName);
    const code = generateCategoryCode(memberName, template.code);

    // Check if category already exists (by code for this user)
    const existing = await prisma.category.findUnique({
      where: { userId_code: { userId, code } }
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          userId,
          name,
          code,
          type: template.type,
          description: template.description,
          color: template.color,
          icon: template.icon,
          isSystem: false,
          isActive: true,
          householdMemberId: memberId,
        }
      });
    }
  }
}

/**
 * Generate categories for a new household pet
 */
export async function generatePetCategories(
  userId: string,
  petId: string,
  petName: string,
  petType: HouseholdPetType
): Promise<void> {
  const templates = getPetTemplates(petType);

  for (const template of templates) {
    const name = template.namePattern.replace('{name}', petName);
    const code = generateCategoryCode(petName, template.code);

    // Check if category already exists (by code for this user)
    const existing = await prisma.category.findUnique({
      where: { userId_code: { userId, code } }
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          userId,
          name,
          code,
          type: template.type,
          description: template.description,
          color: template.color,
          icon: template.icon,
          isSystem: false,
          isActive: true,
          householdPetId: petId,
        }
      });
    }
  }
}

/**
 * Update categories when a member's name changes
 */
export async function updateMemberCategoryNames(
  memberId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const categories = await prisma.category.findMany({
    where: { householdMemberId: memberId }
  });

  for (const category of categories) {
    const newCategoryName = category.name.replace(oldName, newName);
    await prisma.category.update({
      where: { id: category.id },
      data: { name: newCategoryName }
    });
  }
}

/**
 * Update categories when a pet's name changes
 */
export async function updatePetCategoryNames(
  petId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const categories = await prisma.category.findMany({
    where: { householdPetId: petId }
  });

  for (const category of categories) {
    const newCategoryName = category.name.replace(oldName, newName);
    await prisma.category.update({
      where: { id: category.id },
      data: { name: newCategoryName }
    });
  }
}

/**
 * Get all categories linked to a specific member
 */
export async function getMemberCategories(memberId: string) {
  return prisma.category.findMany({
    where: { householdMemberId: memberId, isActive: true },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
  });
}

/**
 * Get all categories linked to a specific pet
 */
export async function getPetCategories(petId: string) {
  return prisma.category.findMany({
    where: { householdPetId: petId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  });
}

/**
 * Orphan categories when a member is deleted (don't delete, just unlink)
 */
export async function orphanMemberCategories(memberId: string): Promise<void> {
  await prisma.category.updateMany({
    where: { householdMemberId: memberId },
    data: { householdMemberId: null }
  });
}

/**
 * Orphan categories when a pet is deleted (don't delete, just unlink)
 */
export async function orphanPetCategories(petId: string): Promise<void> {
  await prisma.category.updateMany({
    where: { householdPetId: petId },
    data: { householdPetId: null }
  });
}

/**
 * Regenerate categories for a member (e.g., when role changes from non-earner to earner)
 */
export async function regenerateMemberCategories(
  userId: string,
  memberId: string,
  memberName: string,
  relationship: HouseholdRelationship,
  isIncomeEarner: boolean
): Promise<void> {
  // Generate any missing categories for the new role
  await generateMemberCategories(userId, memberId, memberName, relationship, isIncomeEarner);
}

/**
 * Preview what categories would be generated for a member (without creating them)
 */
export function previewMemberCategories(
  memberName: string,
  relationship: HouseholdRelationship,
  isIncomeEarner: boolean
): GeneratedCategory[] {
  const templates = getMemberTemplates(relationship, isIncomeEarner);

  return templates.map(template => ({
    name: template.namePattern.replace('{name}', memberName),
    code: generateCategoryCode(memberName, template.code),
    type: template.type,
    description: template.description,
    color: template.color,
    icon: template.icon,
  }));
}

/**
 * Preview what categories would be generated for a pet (without creating them)
 */
export function previewPetCategories(
  petName: string,
  petType: HouseholdPetType
): GeneratedCategory[] {
  const templates = getPetTemplates(petType);

  return templates.map(template => ({
    name: template.namePattern.replace('{name}', petName),
    code: generateCategoryCode(petName, template.code),
    type: template.type,
    description: template.description,
    color: template.color,
    icon: template.icon,
  }));
}
