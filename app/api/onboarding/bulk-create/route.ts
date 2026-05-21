import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
// Prisma's Json? columns disallow raw `null` — use Prisma.JsonNull
// (sentinel meaning "write SQL NULL") to clear a JSONB field.
// See: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields#using-null-values
import { Prisma } from '@prisma/client';

// Prisma transaction client type
type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// =============================================================================
// TYPES (matching wizard types - which match Prisma schema)
// =============================================================================

// Prisma enums
type PropertyType = 'HOME' | 'INVESTMENT';
type RateType = 'VARIABLE' | 'FIXED';
type RepaymentFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
type AccountType = 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
type InvestmentAccountType = 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
type HoldingType = 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
type AssetType = 'VEHICLE' | 'ELECTRONICS' | 'FURNITURE' | 'EQUIPMENT' | 'COLLECTIBLE' | 'OTHER';
type IncomeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';
type SalaryType = 'GROSS' | 'NET';
type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
type ExpenseCategory =
  | 'HOUSING'
  | 'RENT'
  | 'RATES'
  | 'INSURANCE'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'UTILITIES'
  | 'FOOD'
  | 'GROCERIES'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'SUBSCRIPTION'
  | 'STRATA'
  | 'LAND_TAX'
  | 'LOAN_INTEREST'
  | 'REGISTRATION'
  | 'MODIFICATIONS'
  | 'HEALTH'
  | 'EDUCATION'
  | 'OTHER';

interface PropertyLoanInput {
  id: string;
  name: string;
  lender: string;
  principal: number;
  interestRateAnnual: number;
  rateType: RateType;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
}

interface PropertyIncomeInput {
  id: string;
  type: 'RENTAL';
  amount: number;
  frequency: Frequency;
  tenantName?: string;
}

interface PropertyExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

interface PropertyInput {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  hasLoan: boolean;
  loan?: PropertyLoanInput;
  income?: PropertyIncomeInput;
  expenses: PropertyExpenseInput[];
  // Phase 41E.5 — reform-aware fields. Wizard captures these only for
  // post-cut-over purchases; pre-cut-over uses purchaseDate as the
  // contract date (auto-backfill). See PHASE_41E_REFORM_2026_27.md §10.1.
  acquisitionContractDate?: string;
  isNewBuild?: boolean;
  newBuildEvidence?:
    | 'NEVER_SOLD'
    | 'BUILDER_FIRST_OWNER_UNDER_12M'
    | 'VACANT_LAND_BUILD'
    | 'OFF_THE_PLAN'
    | 'DEMO_REBUILD_NET_ADD';
}

// Phase 12 PR 3b: data source tier for an account entered in the wizard.
//   MANUAL — user typed the balance; bulk-create writes a new Account row
//   BASIQ  — account was imported via Basiq consent flow; row already
//            exists in the DB, bulk-create skips it
//   IMPORT — account was created by the Phase 18 file-import flow; row
//            already exists in the DB, bulk-create skips it
type AccountDataSource = 'BASIQ' | 'IMPORT' | 'MANUAL';

interface AccountInput {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  currentBalance: number;
  interestRate?: number;
  linkedLoanId?: string;
  // PR 3b: data source tier + pointer to pre-existing DB row
  source?: AccountDataSource;
  existingAccountId?: string;
}

interface HoldingInput {
  id: string;
  ticker: string;
  name?: string;
  units: number;
  averagePrice: number;
  type: HoldingType;
}

interface InvestmentAccountInput {
  id: string;
  name: string;
  platform?: string;
  type: InvestmentAccountType;
  cashBalance: number;
  holdings: HoldingInput[];
}

interface AssetExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

interface AssetInput {
  id: string;
  name: string;
  type: AssetType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  description?: string;
  expenses: AssetExpenseInput[];
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

interface IncomeInput {
  id: string;
  name: string;
  type: IncomeType;
  amount: number;
  frequency: Frequency;
  salaryType?: SalaryType;
}

interface ExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
}

// Phase 29: Household
type HouseholdRelationship = 'SELF' | 'SPOUSE' | 'PARTNER' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
type HouseholdPetTypeEnum = 'DOG' | 'CAT' | 'BIRD' | 'FISH' | 'RABBIT' | 'REPTILE' | 'OTHER';

interface HouseholdMemberInput {
  id: string;
  name: string;
  relationship: HouseholdRelationship;
  dateOfBirth?: string;
  isIncomeEarner: boolean;
}

interface HouseholdPetInput {
  id: string;
  name: string;
  type: HouseholdPetTypeEnum;
  breed?: string;
}

// Phase 12 PR 3b: Housing situation drives renter path + Properties visibility
type HousingSituation = 'OWN' | 'RENT' | 'BOTH';

// Phase 12 PR 3b: Lifestyle fields for Phase 28 budget AI
type LifestylePreference = 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
type DiningFrequency = 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';

// Phase 12 PR 3b: Non-property loans (CAR/STUDENT/PERSONAL/BUSINESS)
type DebtLoanType = 'CAR' | 'STUDENT' | 'PERSONAL' | 'BUSINESS';

interface DebtInput {
  id: string;
  name: string;
  type: DebtLoanType;
  lender?: string;
  principal: number;
  interestRateAnnual: number; // percentage — converted to decimal below
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  termMonthsRemaining?: number;
  linkedAssetId?: string;
  isHecsHelp?: boolean;
}

// Phase 12 PR 3b: SuperannuationAccount minimum-viable fields
interface SuperAccountInput {
  id: string;
  name: string;
  fundName: string;
  currentBalance: number;
}

// Phase 41b: optional entity rows captured by the EntitiesStep wizard.
// Mirrors the EntityInput shape from
// `components/onboarding/wizard/types.ts` but kept locally typed so this
// route doesn't add a client→server coupling.
type LegalEntityType =
  | 'PERSONAL_NAME'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF'
  | 'PARTNERSHIP'
  | 'SOLE_TRADER';
type LegalEntityRole =
  | 'PERSONAL'
  | 'HOLDING'
  | 'OPERATING'
  | 'INVESTMENT'
  | 'SUPERANNUATION';
interface EntityInput {
  id: string;                        // wizard-local temp id
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn?: string;
  acn?: string;
  tfn?: string;                      // raw; encrypted by encryptTfn() before persistence
  tradingName?: string;
  establishedDate?: string;
  parentEntityTempId?: string;       // wizard-local pointer to another EntityInput.id
  // Phase 41E.5 — reform-aware fields (Measure 3 + Measure 4).
  // See PHASE_41E_REFORM_2026_27.md §10.3 + §10.4.
  trustType?:
    | 'DISCRETIONARY'
    | 'FIXED'
    | 'UNIT'
    | 'TESTAMENTARY_FIXED'
    | 'CHARITABLE'
    | 'DECEASED_ESTATE'
    | 'SPECIAL_DISABILITY'
    | 'OTHER';
  isForeignResident?: boolean;
}

interface WizardData {
  profileType: string | null;
  country: string;
  taxYear: string;
  // PR 3b: Welcome answers driving renter path + step filtering
  housing?: HousingSituation | null;
  debtCategories?: string[];
  // Phase 29: Household
  householdMembers?: HouseholdMemberInput[];
  householdPets?: HouseholdPetInput[];
  carsCount?: number;
  // PR 3b: Household lifestyle fields (Phase 28 budget AI)
  lifestylePreference?: LifestylePreference | null;
  diningOutFrequency?: DiningFrequency | null;
  hobbiesWithCosts?: string;
  // Phase 41b: optional entity layer rows
  entities?: EntityInput[];
  properties: PropertyInput[];
  // PR 3b: Non-property loans
  debts?: DebtInput[];
  accounts: AccountInput[];
  investments: InvestmentAccountInput[];
  // PR 3b: Superannuation accounts
  superAccounts?: SuperAccountInput[];
  assets: AssetInput[];
  income: IncomeInput[];
  expenses: ExpenseInput[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Fix: frequency double-conversion bug (docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_CORRECTNESS.md).
// The canonical Income/Expense contract (per lib/utils/frequencies.ts and /api/income)
// stores `amount` at the given `frequency` — downstream engines call toAnnual/toMonthly.
// This file previously called normalizeToMonthly() AND stored the original frequency,
// which caused every amount to be read by the snapshot engine at the wrong scale
// (e.g. $1000/week became $225K/year instead of $52K/year). We now pass the
// amount and frequency through unchanged.

// =============================================================================
// POST - Bulk create all onboarding data
// =============================================================================

export const POST = withPermission('onboarding.complete', async (request, auth) => {
    // Hoisted out of the try block so the catch handler can include
    // them in the structured error log without scope errors.
    const userId = auth.userId;
    let parsedPayload: WizardData | undefined;
    try {
      parsedPayload = (await request.json()) as WizardData;
      const data = parsedPayload;

      // Start a transaction to create all data atomically.
      //
      // Prisma's default interactive-transaction timeout is 5 seconds —
      // far too short for the full bulk-create payload, which can issue
      // ~50–80 sequential writes on a healthy account (3 properties ×
      // [property + loan + rent + expenses], 1+ accounts, 9+ general
      // expenses, household profile + members + pets, super accounts,
      // debts, assets, etc.). On a slow Cloud SQL connection or first
      // cold-start of the build the cumulative latency easily exceeds
      // 5s, the transaction aborts, the 500 propagates to the client,
      // and the wizard's "Launching..." button reverts with no
      // user-visible feedback (see handleSubmit's silent catch in
      // components/onboarding/wizard/WizardContainer.tsx — also fixed
      // in this PR).
      //
      // 30s is a generous ceiling (well below the Vercel function
      // timeout) and matches what equivalent bulk-write endpoints in
      // this codebase use for similar payload sizes. `maxWait` is
      // bumped to 10s so we don't reject the transaction at the slot-
      // acquisition stage during traffic spikes.
      const result = await prisma.$transaction(
        async (tx: TransactionClient) => {
        // =======================================================================
        // Phase 41b — wizard-defined LegalEntity rows
        //
        // ⚠ Phase 12 Track G.3a (2026-05-21): entities are no longer
        // written here. The EntitiesStep now reads + writes the real
        // `LegalEntity` table directly via `lib/onboarding/entitiesSync.ts`
        // — including the two-pass trust→trustee parent linking. The
        // step's commit runs on Continue (before bulk-create), so every
        // entity is already persisted (with a real id carried back into
        // `data.entities`) by the time this runs.
        //
        // Intentionally a no-op until bulk-create is fully retired in G.3c.
        // =======================================================================

        // =======================================================================
        // 1. Update user onboarding status
        //
        // ⚠ Track G.3b (2026-05-21): the onboarding-completion write
        // (`onboardingCompleted` / `onboardingCompletedAt` /
        // `onboardingProfileType`) is now owned by
        // `/api/onboarding/complete` — the end-of-wizard finaliser, called
        // right after this route. This section is a full no-op.
        // =======================================================================

        // =======================================================================
        // 1a. Phase 29 — Household profile, members, pets
        //
        // ⚠ Phase 12 Track F.1 (2026-05-20): the HOUSEHOLD domain is no
        // longer written here. It is now written incrementally to the real
        // tables (`HouseholdProfile` / `HouseholdMember` / `HouseholdPet`)
        // by the wizard household step + chat household topic, via the
        // household entity APIs — see `lib/onboarding/householdSync.ts` and
        // `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md`.
        //
        // The wizard payload still carries `householdMembers` / `householdPets`
        // / `carsCount` / lifestyle fields (they remain in `WizardData` for
        // the Review step), but they MUST NOT be re-written here: doing so
        // would `deleteMany` + recreate the rows F.1 already persisted,
        // discarding their ids + re-running category generation. Household
        // is the single SSOT in the real tables — this block is intentionally
        // a no-op until `bulk-create` is fully retired in Track F.9.
        //
        // The other 7 domains below remain draft-staged + written here
        // (coexistence — F.2–F.8 migrate them one PR at a time).
        // =======================================================================

        // =======================================================================
        // 2. Properties (with mortgage / rental income / expenses)
        //
        // ⚠ Phase 12 Track F.2 (2026-05-20): the PROPERTIES domain is no
        // longer written here. The whole property aggregate — `Property`
        // plus its mortgage `Loan`, rental `Income` and `Expense`s — is now
        // written incrementally to the real tables by the wizard properties
        // step, via the property/loan/income/expense entity APIs. See
        // `lib/onboarding/propertiesSync.ts` and
        // `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md`.
        //
        // The wizard payload still carries `data.properties` (it stays in
        // `WizardData` for the Review step), but it MUST NOT be re-written
        // here: the properties step's commit already persisted every
        // property — re-creating them would duplicate the whole portfolio.
        // The properties step's commit runs on every Continue / Back /
        // progress-jump, so by the time `bulk-create` runs (Review step)
        // every property is already in the real tables.
        //
        // Intentionally a no-op until `bulk-create` is fully retired in
        // Track F.9. The other draft-staged domains below are unaffected
        // (coexistence — F.3–F.8 migrate them one PR at a time).
        // =======================================================================
        const createdProperties: never[] = [];

        // =======================================================================
        // 3. Bank Accounts
        //
        // ⚠ Phase 12 Track F.3 (2026-05-20): MANUAL bank accounts are no
        // longer written here. They are written incrementally to the real
        // `Account` table by the wizard accounts step via /api/accounts —
        // see `lib/onboarding/accountsSync.ts`. The accounts step's commit
        // runs before bulk-create, so every MANUAL account (and its
        // offset→loan link) is already persisted by the time this runs.
        //
        // MANUAL accounts were never written here after F.3. ⚠ Track G.3b
        // (2026-05-21): the BASIQ/IMPORT offset→loan link this section used
        // to wire is now done by `/api/onboarding/complete` (the
        // end-of-wizard finaliser). This section is a full no-op.
        // =======================================================================
        const createdAccounts: never[] = [];

        // =======================================================================
        // 4. Investment accounts (+ holdings)
        //
        // ⚠ Phase 12 Track F.5 (2026-05-20): investment accounts + holdings
        // are no longer written here. They are written incrementally to the
        // real `InvestmentAccount` / `InvestmentHolding` tables by the
        // wizard Investments step via /api/investments/* — see
        // `lib/onboarding/investmentsSync.ts`. The Investments step's commit
        // runs before bulk-create, so every account is already persisted
        // (with a real id carried back into `data.investments`) by the time
        // this runs.
        //
        // Intentionally a no-op until bulk-create is fully retired in F.9.
        // =======================================================================
        const createdInvestments: never[] = [];

        // =======================================================================
        // 4a. SuperannuationAccount rows
        //
        // ⚠ Phase 12 Track F.6 (2026-05-20): super accounts are no longer
        // written here. They are written incrementally to the real
        // `SuperannuationAccount` table by the wizard Super step via the
        // super API (`/api/tax/super` + `/api/tax/super/[id]`) — see
        // `lib/onboarding/superSync.ts`. The Super step's commit runs
        // before bulk-create, so every account is already persisted by then.
        //
        // Intentionally a no-op until bulk-create is fully retired in F.9.
        // =======================================================================
        const createdSuper: never[] = [];

        // =======================================================================
        // 4b. Non-property loans (CAR / STUDENT / PERSONAL / BUSINESS)
        //
        // ⚠ Phase 12 Track F.4 (2026-05-20): standalone debts are no longer
        // written here. They are written incrementally to the real `Loan`
        // table by the wizard Debts step via /api/loans — see
        // `lib/onboarding/debtsSync.ts`. The Debts step's commit runs before
        // bulk-create, so every debt is already persisted (with a real id
        // carried back into `data.debts`) by the time this runs.
        //
        // The CAR→vehicle link still needs wiring after the Assets loop
        // (the Assets step is not migrated until F.7) — see section 5a.
        //
        // Intentionally a no-op until bulk-create is fully retired in F.9.
        // =======================================================================
        const createdDebts: never[] = [];

        // =======================================================================
        // 5. Personal assets (+ expenses)
        //
        // ⚠ Phase 12 Track F.7 (2026-05-20): assets + their expenses are no
        // longer written here. They are written incrementally to the real
        // `Asset` / `Expense` tables by the wizard Assets step via
        // /api/assets + /api/expenses — see `lib/onboarding/assetsSync.ts`.
        // The Assets step's commit runs before bulk-create, so every asset
        // is already persisted (with a real id carried back into
        // `data.assets`) by the time this runs.
        //
        // Intentionally a no-op until bulk-create is fully retired in F.9.
        // =======================================================================
        const createdAssets: never[] = [];

        // =======================================================================
        // 5a. CAR debt → vehicle Asset link
        //
        // ⚠ Track G.3b (2026-05-21): the CAR-loan → vehicle-Asset link is
        // now wired by `/api/onboarding/complete` (the end-of-wizard
        // finaliser). This section is a full no-op.
        // =======================================================================

        // =======================================================================
        // 6. Income Sources
        //
        // ⚠ Track G.3b (2026-05-21): GENERAL income was already F.8's
        // domain; INVESTMENT-type income is now created by
        // `/api/onboarding/complete` (the end-of-wizard finaliser). This
        // section is a full no-op.
        // =======================================================================
        const createdIncome: never[] = [];

        // =======================================================================
        // 7. Expenses
        //
        // ⚠ Phase 12 Track F.8 (2026-05-20): GENERAL expenses are no longer
        // written here. They are written incrementally to the real `Expense`
        // table by the wizard Income & Expenses step via /api/expenses — see
        // `lib/onboarding/incomeExpensesSync.ts`. The step's commit runs
        // before bulk-create, so every GENERAL expense row is already
        // persisted by the time this runs.
        //
        // Property expenses (F.2) + asset expenses (F.7) were never written
        // in this section — they belong to their own domain steps.
        //
        // Phase 12 PR 3b — Renter path note: when the user picks
        // housing === 'RENT' or 'BOTH' the Properties step is hidden and
        // rent is modelled as an Expense(category='RENT', sourceType=GENERAL)
        // the user adds themselves in the Income & Expenses step. That row
        // is now written by the step's commit (Track F.8), not here.
        //
        // Intentionally a no-op until bulk-create is fully retired in F.9.
        // =======================================================================
        const createdExpenses: never[] = [];

        // =======================================================================
        // 8. Update user preferences
        // =======================================================================
        // Phase 12 PR 2: wiping `onboardingDraft` on success is what makes the
        // resume banner disappear and keeps the DB from growing a stale copy
        // of the user's financial data after they've finished onboarding.
        await tx.userPreference.upsert({
          where: { userId },
          create: {
            userId,
            country: data.country,
            taxYear: data.taxYear || null,
            dismissedWelcomeModal: true,
            hasSeenGuidedTour: true,
            // Prisma Json? — raw `null` is rejected by the generated
            // type, so we use Prisma.JsonNull to write SQL NULL.
            onboardingDraft: Prisma.JsonNull,
          },
          update: {
            country: data.country,
            taxYear: data.taxYear || null,
            dismissedWelcomeModal: true,
            onboardingDraft: Prisma.JsonNull,
          },
        });

        return {
          properties: createdProperties.length,
          accounts: createdAccounts.length,
          investments: createdInvestments.length,
          // PR 3b new entity counts
          superAccounts: createdSuper.length,
          debts: createdDebts.length,
          assets: createdAssets.length,
          income: createdIncome.length,
          expenses: createdExpenses.length,
          // Phase 12 Track F.1: the household domain is written incrementally
          // to the real tables by the wizard/chat (not here). These counts
          // are informational only — taken from the payload, not from rows
          // this transaction created.
          householdMembers: (data.householdMembers ?? []).length,
          householdPets: (data.householdPets ?? []).length,
        };
        },
        {
          maxWait: 10_000, // ms — wait up to 10s for a tx slot
          timeout: 30_000, // ms — allow up to 30s for the full bulk write
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Onboarding data saved successfully',
        summary: result,
      });
    } catch (error) {
      // Log a structured snapshot so we can correlate the failure with
      // the user's payload shape without exposing financial values
      // (count-only — no balances, names, or addresses leak into the
      // log). Indispensable when a real user hits a 500 and we need
      // to reproduce.
      try {
        // `parsedPayload` is set after request.json() returns. If we
        // crashed before that point this snapshot is just the user id
        // and a null payload — still useful for correlating failures.
        const p = parsedPayload;
        const payloadSummary: Record<string, unknown> = {
          userId,
          profileType: p?.profileType ?? null,
          housing: p?.housing ?? null,
          counts: {
            properties: p?.properties?.length ?? 0,
            propertiesWithLoan: p?.properties?.filter((x) => x.hasLoan).length ?? 0,
            accounts: p?.accounts?.length ?? 0,
            accountsByType: {
              MANUAL: p?.accounts?.filter((a) => !a.source || a.source === 'MANUAL').length ?? 0,
              IMPORT: p?.accounts?.filter((a) => a.source === 'IMPORT').length ?? 0,
              BASIQ: p?.accounts?.filter((a) => a.source === 'BASIQ').length ?? 0,
            },
            investments: p?.investments?.length ?? 0,
            superAccounts: p?.superAccounts?.length ?? 0,
            debts: p?.debts?.length ?? 0,
            assets: p?.assets?.length ?? 0,
            income: p?.income?.length ?? 0,
            expenses: p?.expenses?.length ?? 0,
            householdMembers: p?.householdMembers?.length ?? 0,
            householdPets: p?.householdPets?.length ?? 0,
          },
        };
        console.error('Bulk create error:', error, payloadSummary);
      } catch {
        console.error('Bulk create error:', error);
      }

      const message = error instanceof Error ? error.message : String(error);

      // Validation errors thrown from inside the transaction (e.g.
      // missing purchase date) are user-recoverable and should
      // return 400, not 500.
      const isValidationError =
        message.includes('missing a purchase date') ||
        message.includes('invalid purchase date');
      if (isValidationError) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      // Translate common Prisma error codes into actionable messages
      // so the user (and we, when reading server logs) get useful
      // information instead of a generic "Failed to save…".
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code: string | undefined = (error as any)?.code;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta: Record<string, unknown> | undefined = (error as any)?.meta;

      if (code === 'P2028') {
        // Transaction timeout — the bumped 30s ceiling we set should
        // already cover real-world onboarding payloads, so this means
        // either the DB is under load or there's a slow query in the
        // hot path.
        return NextResponse.json(
          {
            error: 'Saving took too long',
            details:
              'The save timed out after 30 seconds. Please try again — your answers are still saved.',
          },
          { status: 504 }
        );
      }

      if (code === 'P2002') {
        // Unique constraint
        const target = Array.isArray(meta?.target)
          ? (meta!.target as string[]).join(', ')
          : (meta?.target as string | undefined) ?? 'a field';
        return NextResponse.json(
          {
            error: 'Duplicate value',
            details: `A record with the same ${target} already exists. Please review your entries and try again.`,
          },
          { status: 409 }
        );
      }

      if (code === 'P2003') {
        // Foreign key violation
        const field =
          (meta?.field_name as string | undefined) ??
          (meta?.constraint as string | undefined) ??
          'a linked record';
        return NextResponse.json(
          {
            error: 'Linked record missing',
            details: `Couldn't find ${field}. Please go back and check your linked accounts/loans, then try again.`,
          },
          { status: 400 }
        );
      }

      // Fallback: 500 with the raw message in `details` so the
      // client banner can show what actually went wrong instead of
      // the generic copy.
      return NextResponse.json(
        {
          error: 'Failed to save onboarding data',
          details: message,
        },
        { status: 500 }
      );
    }
});
