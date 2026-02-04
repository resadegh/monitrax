# Phase 29: Household Profile Redesign

## Overview

Phase 29 introduces a complete redesign of the household profile system, transforming it from simple count-based tracking to detailed member and pet profiles with automatic category generation. This enables personalized financial tracking across the entire Monitrax platform.

## Problem Statement

Prior to Phase 29:
- **Household Profile**: Only captured counts (adults, children, pets)
- **Categories**: Generic, not personalized to household members
- **Onboarding**: Household setup was buried deep in the wizard
- **User Experience**: No connection between household composition and expense tracking

## Solution

Phase 29 transforms household management:
1. Named household members with relationships
2. Named pets with types and breeds
3. Automatic category generation based on household composition
4. Household as the first data collection step in onboarding
5. Prominent sidebar navigation placement

---

## Data Model Changes

### New Enums

```prisma
enum HouseholdRelationship {
  SELF
  SPOUSE
  PARTNER
  CHILD
  PARENT
  SIBLING
  OTHER
}

enum HouseholdPetType {
  DOG
  CAT
  BIRD
  FISH
  RABBIT
  REPTILE
  OTHER
}
```

### New Models

#### HouseholdMember

```prisma
model HouseholdMember {
  id                    String   @id @default(uuid())
  householdProfileId    String
  name                  String
  relationship          HouseholdRelationship
  dateOfBirth           DateTime?
  isIncomeEarner        Boolean  @default(false)
  sortOrder             Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  householdProfile      HouseholdProfile @relation(fields: [householdProfileId], references: [id], onDelete: Cascade)
  linkedCategories      Category[]       @relation("MemberLinkedCategories")

  @@index([householdProfileId])
  @@map("household_members")
}
```

#### HouseholdPet

```prisma
model HouseholdPet {
  id                    String   @id @default(uuid())
  householdProfileId    String
  name                  String
  type                  HouseholdPetType
  breed                 String?
  sortOrder             Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  householdProfile      HouseholdProfile @relation(fields: [householdProfileId], references: [id], onDelete: Cascade)
  linkedCategories      Category[]       @relation("PetLinkedCategories")

  @@index([householdProfileId])
  @@map("household_pets")
}
```

### Model Updates

#### HouseholdProfile

```prisma
model HouseholdProfile {
  // ... existing fields ...
  needsMigration        Boolean  @default(false)  // NEW: Flag for existing users

  // NEW: Relations
  members               HouseholdMember[]
  pets                  HouseholdPet[]
}
```

#### Category

```prisma
model Category {
  // ... existing fields ...
  householdMemberId     String?  // NEW: Link to household member
  householdPetId        String?  // NEW: Link to household pet

  // NEW: Relations
  householdMember       HouseholdMember? @relation("MemberLinkedCategories", ...)
  householdPet          HouseholdPet?    @relation("PetLinkedCategories", ...)
}
```

---

## Auto-Generated Categories

### Member Categories

| Member Type | Condition | Categories Created |
|-------------|-----------|-------------------|
| Income Earner | `isIncomeEarner: true`, Adult relationship | `{Name}'s Salary`, `{Name}'s Super Contributions`, `{Name}'s Work Expenses`, `{Name}'s Health Insurance` |
| Non-Earner Adult | `isIncomeEarner: false`, Adult relationship | `{Name}'s Personal Spending`, `{Name}'s Health Expenses`, `{Name}'s Entertainment` |
| Child | `relationship: CHILD` | `{Name}'s School Fees`, `{Name}'s Childcare`, `{Name}'s Kids Activities`, `{Name}'s Medical` |

**Adult Relationships**: SELF, SPOUSE, PARTNER, PARENT, SIBLING, OTHER

### Pet Categories

| Pet Type | Categories Created |
|----------|-------------------|
| Any Pet | `{Name} Food & Supplies`, `{Name} Vet Visits`, `{Name} Pet Insurance`, `{Name} Grooming` |

---

## Category Orphaning

When a household member or pet is deleted:

1. **Categories are NOT deleted** - Preserves expense history
2. **Categories are unlinked** - `householdMemberId` / `householdPetId` set to `null`
3. **Categories remain usable** - Can be reassigned to other expenses
4. **Category names preserved** - e.g., "Reza's Salary" remains even after Reza is deleted

This pattern ensures:
- No data loss on member/pet deletion
- Historical expense tracking integrity
- User can manually delete orphaned categories if desired

---

## API Endpoints

### Household Members

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/household-members` | GET | List all members with linked categories |
| `/api/household-members` | POST | Create member, auto-generate categories |
| `/api/household-members/[id]` | GET | Get single member with categories |
| `/api/household-members/[id]` | PUT | Update member, rename linked categories |
| `/api/household-members/[id]` | DELETE | Delete member, orphan categories |

### Household Pets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/household-pets` | GET | List all pets with linked categories |
| `/api/household-pets` | POST | Create pet, auto-generate categories |
| `/api/household-pets/[id]` | GET | Get single pet with categories |
| `/api/household-pets/[id]` | PUT | Update pet, rename linked categories |
| `/api/household-pets/[id]` | DELETE | Delete pet, orphan categories |

### Household Profile

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/household-profile` | GET | Profile with members, pets, and categories |

---

## Onboarding Wizard Integration

### Step Order (Updated)

```
1. welcome      - Introduction
2. household    - Members, pets, vehicles (NEW - Phase 29)
3. income       - Income sources
4. expenses     - Expense tracking
5. properties   - Property portfolio
6. loans        - Debt tracking
7. accounts     - Bank accounts
8. review       - Summary and completion
```

### Household Step Features

- Card-based UI for members and pets
- Add/Edit/Delete dialogs
- Vehicle count selector
- AI Helper with contextual guidance
- Pre-populated primary user from Clerk profile

---

## UI Changes

### Sidebar Navigation

**Before:**
```
Dashboard
Personal CFO
Portfolio
  └── Properties, Investments, Assets
Cashflow
  └── Income, Expenses, Accounts, Loans
Transactions
Planning
  └── Budgets, Goals, Debt Plans, Household Profile  ← Hidden
Settings
```

**After:**
```
Dashboard
Household        ← Prominent standalone position
Personal CFO
Portfolio
Cashflow
Transactions
Planning
  └── Budgets, Goals, Debt Plans  ← Household Profile removed
Settings
```

### Household Profile Page

Complete redesign with:
- Member cards showing name, relationship, income earner status
- Pet cards showing name, type, breed
- Auto-created categories displayed per member/pet
- Add/Edit/Delete functionality with dialogs
- Migration prompt for existing users
- Lifestyle preferences section preserved

---

## Migration Path

### Existing Users

1. `needsMigration` flag set to `true` on existing HouseholdProfile records
2. Migration prompt displayed on household profile page
3. Prompt guides users to add names to household members
4. Once members/pets added, `needsMigration` set to `false`

### New Users

1. Household step is second in onboarding (after welcome)
2. Users enter named members and pets during onboarding
3. Categories auto-generated immediately
4. No migration needed

---

## Service Layer

### householdCategoryService.ts

**Location**: `lib/services/householdCategoryService.ts`

**Functions:**
- `generateMemberCategories(memberId, memberName, isIncomeEarner, isChild, userId)`
- `generatePetCategories(petId, petName, userId)`
- `updateMemberCategoryNames(memberId, oldName, newName)`
- `updatePetCategoryNames(petId, oldName, newName)`
- `orphanMemberCategories(memberId)`
- `orphanPetCategories(petId)`
- `previewMemberCategories(memberName, isIncomeEarner, isChild)`
- `previewPetCategories(petName)`

---

## Files Created/Modified

### Created

| File | Purpose |
|------|---------|
| `lib/services/householdCategoryService.ts` | Category generation service |
| `app/api/household-members/route.ts` | Members list/create API |
| `app/api/household-members/[id]/route.ts` | Member CRUD API |
| `app/api/household-pets/route.ts` | Pets list/create API |
| `app/api/household-pets/[id]/route.ts` | Pet CRUD API |
| `components/onboarding/wizard/steps/HouseholdStep.tsx` | Wizard step component |

### Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | New enums, models, relations |
| `app/api/household-profile/route.ts` | Include members/pets in response |
| `app/dashboard/household-profile/page.tsx` | Complete UI redesign |
| `components/DashboardLayout.tsx` | Navigation reorder |
| `components/onboarding/wizard/types.ts` | Household step types |
| `components/onboarding/wizard/WizardContainer.tsx` | Register step |
| `components/onboarding/wizard/AIHelper.tsx` | Household context |

---

## Design Principles Applied

1. **One Source of Truth** - Categories linked to members/pets, not duplicated
2. **Additive Schema Changes** - No existing data affected
3. **Data Preservation** - Category orphaning prevents data loss
4. **Single Calculation Engine** - Category service handles all generation
5. **No Dead-Ends** - Every UI element leads to an action

---

## Testing Checklist

- [x] Build passes (`npm run build`)
- [x] Prisma generates successfully
- [x] No breaking changes to existing data
- [ ] New user onboarding flow works
- [ ] Existing user migration prompt works
- [ ] Member CRUD operations work
- [ ] Pet CRUD operations work
- [ ] Categories auto-generated correctly
- [ ] Category names update on member/pet rename
- [ ] Categories orphaned on member/pet delete
- [ ] Navigation updated correctly

---

## Future Enhancements

1. **Age-based category suggestions** - Use DOB for age-specific categories
2. **Income forecasting** - Use income earner data for projections
3. **Household expense splitting** - Assign expenses to specific members
4. **Pet expense tracking** - Dashboard widget for pet costs
5. **Family financial planning** - Multi-member budgeting

---

*Document Version: 1.0*
*Last Updated: 2026-02-04*
*Phase Status: ✅ Implemented*
