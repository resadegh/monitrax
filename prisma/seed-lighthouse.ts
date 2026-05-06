/**
 * LIGHTHOUSE PITCH FIXTURE SEED
 *
 * Closes Up Next #33. Creates the demo-complete data set the lighthouse
 * adviser pitch (`docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md`) walks through.
 *
 * What this seeds:
 *   1. **Smithfield Wealth Advisers** — Reza's adviser firm
 *      - Org with profession=FINANCIAL_ADVISOR
 *      - Reza Sadeghi as PORTAL_OWNER
 *      - APPROVED ProfessionalListing on the public marketplace
 *      - 3 OrganizationClient rows linking the 3 archetypes (consent GRANTED)
 *      - Pre-existing SUBMITTED ProfessionalRequest from Sarah ready for
 *        live demo Accept
 *      - Active StripeSubscription on Practice tier (test-mode)
 *
 *   2. **Sarah Kim** — sole-trader investor (TRACK stage)
 *      - Personal entity + Sarah Kim Pty Ltd (COMPANY/OPERATING)
 *      - 1 investment property (Melbourne)
 *      - Investment loan
 *      - Modest emergency fund
 *      - Salary (personal) + side-business income (Pty Ltd)
 *      - Cashflow turning slightly negative (the alert hook)
 *
 *   3. **David Mei + Emma Liu** — family with trust + SMSF (REDUCE stage)
 *      - 2 personal entities + Mei Family Holdings Pty Ltd (corporate
 *        trustee) + Mei Family Trust + Mei SMSF
 *      - 3 properties: 1 PPR (David personal) + 2 investment via trust
 *        + 1 in SMSF
 *      - 4 loans (PPR + 2 investment + 1 LRBA in SMSF)
 *      - Healthy emergency fund
 *      - PPR refinance window opening (the alert hook)
 *
 *   4. **Olivia Novak** — multi-entity HNW (INVEST stage)
 *      - 5 entities: Personal + Holdings Pty Ltd (corp trustee) + Family
 *        Trust + Unit Trust + SMSF
 *      - 4 properties (PPR + 2 trust + 1 SMSF)
 *      - 3 loans
 *      - 11 months emergency fund
 *      - Tax position complex (the entity tree is the moat)
 *
 *   5. **Pre-existing engagement** — David's conversation with Reza already
 *      has a few sample messages so the pitch can demonstrate the thread
 *      depth without composing live (Sarah's request is the live-accept demo).
 *
 * **IDEMPOTENT** — re-running this script does NOT duplicate rows.
 * Uses upsert() with deterministic UUIDs everywhere; subsequent runs
 * keep the same data so the demo URL stays stable across browser sessions.
 *
 * **RESET MODE** — pass `--reset` to delete all lighthouse-seeded users
 * (cascade-deletes all owned objects) before re-seeding. Use this when
 * the schema has shifted and the existing rows are stale.
 *
 * Usage:
 *   npm run seed:lighthouse           # idempotent upsert
 *   npm run seed:lighthouse -- --reset  # delete + re-seed
 *
 * The script is intentionally LONG and explicit rather than abstracted
 * into helpers — it's the canonical demo data, and reading it from top
 * to bottom should match the pitch playbook flow. Comments call out the
 * pitch step each fixture supports.
 */

import { prisma } from '../lib/db';

// =============================================================================
// DETERMINISTIC IDs
// =============================================================================
// All IDs are stable so the demo URLs don't change between seed runs.
// Format: lh-<archetype>-<entity-type>-<index>

const IDS = {
  // Smithfield Wealth Advisers org
  ORG: 'lh-org-smithfield',
  ORG_OWNER_USER: 'lh-user-reza',
  ORG_MEMBER: 'lh-member-reza',
  ORG_LISTING: 'lh-listing-smithfield',
  ORG_STRIPE_CUSTOMER: 'lh-stripe-cust-smithfield',
  ORG_STRIPE_SUBSCRIPTION: 'lh-stripe-sub-smithfield',

  // Sarah Kim
  SARAH_USER: 'lh-user-sarah',
  SARAH_PERSONAL_ENTITY: 'lh-ent-sarah-personal',
  SARAH_PTYLTD_ENTITY: 'lh-ent-sarah-ptyltd',
  SARAH_HOUSEHOLD_PROFILE: 'lh-hh-sarah',
  SARAH_HOUSEHOLD_MEMBER: 'lh-hhm-sarah',
  SARAH_PROPERTY: 'lh-prop-sarah-1',
  SARAH_LOAN: 'lh-loan-sarah-1',
  SARAH_OFFSET_ACCOUNT: 'lh-acc-sarah-offset',
  SARAH_SALARY: 'lh-inc-sarah-salary',
  SARAH_BUSINESS_INCOME: 'lh-inc-sarah-business',
  SARAH_RENTAL_INCOME: 'lh-inc-sarah-rental',
  SARAH_RENT_EXPENSE: 'lh-exp-sarah-rent',
  SARAH_GROCERIES_EXPENSE: 'lh-exp-sarah-grocery',
  SARAH_LOAN_EXPENSE: 'lh-exp-sarah-loan',
  SARAH_CLIENT_LINK: 'lh-clink-sarah',
  SARAH_REQUEST: 'lh-req-sarah',

  // David Mei + Emma Liu
  DAVID_USER: 'lh-user-david',
  DAVID_PERSONAL_ENTITY: 'lh-ent-david-personal',
  EMMA_PERSONAL_ENTITY: 'lh-ent-emma-personal',
  MEI_HOLDINGS_ENTITY: 'lh-ent-mei-holdings',
  MEI_TRUST_ENTITY: 'lh-ent-mei-trust',
  MEI_SMSF_ENTITY: 'lh-ent-mei-smsf',
  DAVID_HOUSEHOLD_PROFILE: 'lh-hh-david',
  DAVID_HOUSEHOLD_DAVID: 'lh-hhm-david',
  DAVID_HOUSEHOLD_EMMA: 'lh-hhm-emma',
  DAVID_HOUSEHOLD_CHILD: 'lh-hhm-child',
  DAVID_PROPERTY_PPR: 'lh-prop-david-ppr',
  DAVID_PROPERTY_INV1: 'lh-prop-david-inv1',
  DAVID_PROPERTY_INV2: 'lh-prop-david-inv2',
  DAVID_PROPERTY_SMSF: 'lh-prop-david-smsf',
  DAVID_LOAN_PPR: 'lh-loan-david-ppr',
  DAVID_LOAN_INV1: 'lh-loan-david-inv1',
  DAVID_LOAN_INV2: 'lh-loan-david-inv2',
  DAVID_LOAN_LRBA: 'lh-loan-david-lrba',
  DAVID_OFFSET_ACCOUNT: 'lh-acc-david-offset',
  DAVID_EMERGENCY_ACCOUNT: 'lh-acc-david-emergency',
  DAVID_SALARY: 'lh-inc-david-salary',
  EMMA_SALARY: 'lh-inc-emma-salary',
  DAVID_RENT1: 'lh-inc-david-rent1',
  DAVID_RENT2: 'lh-inc-david-rent2',
  DAVID_RENT_SMSF: 'lh-inc-david-rent-smsf',
  DAVID_GROCERIES: 'lh-exp-david-grocery',
  DAVID_PPR_REPAYMENT: 'lh-exp-david-ppr-repay',
  DAVID_CLIENT_LINK: 'lh-clink-david',
  DAVID_CONVERSATION: 'lh-conv-david',
  DAVID_REQUEST: 'lh-req-david',

  // Olivia Novak
  OLIVIA_USER: 'lh-user-olivia',
  OLIVIA_PERSONAL_ENTITY: 'lh-ent-olivia-personal',
  NOVAK_HOLDINGS_ENTITY: 'lh-ent-novak-holdings',
  NOVAK_TRUST_ENTITY: 'lh-ent-novak-trust',
  NOVAK_UNIT_TRUST_ENTITY: 'lh-ent-novak-unit-trust',
  NOVAK_SMSF_ENTITY: 'lh-ent-novak-smsf',
  OLIVIA_HOUSEHOLD_PROFILE: 'lh-hh-olivia',
  OLIVIA_HOUSEHOLD_OLIVIA: 'lh-hhm-olivia',
  OLIVIA_PROPERTY_PPR: 'lh-prop-olivia-ppr',
  OLIVIA_PROPERTY_INV1: 'lh-prop-olivia-inv1',
  OLIVIA_PROPERTY_INV2: 'lh-prop-olivia-inv2',
  OLIVIA_PROPERTY_COMMERCIAL: 'lh-prop-olivia-commercial',
  OLIVIA_PROPERTY_SMSF: 'lh-prop-olivia-smsf',
  OLIVIA_LOAN_PPR: 'lh-loan-olivia-ppr',
  OLIVIA_LOAN_INV1: 'lh-loan-olivia-inv1',
  OLIVIA_LOAN_COMMERCIAL: 'lh-loan-olivia-commercial',
  OLIVIA_EMERGENCY_ACCOUNT: 'lh-acc-olivia-emergency',
  OLIVIA_SALARY: 'lh-inc-olivia-salary',
  OLIVIA_DIVIDENDS: 'lh-inc-olivia-divs',
  OLIVIA_RENT_INV1: 'lh-inc-olivia-rent-inv1',
  OLIVIA_RENT_INV2: 'lh-inc-olivia-rent-inv2',
  OLIVIA_RENT_COMMERCIAL: 'lh-inc-olivia-rent-commercial',
  OLIVIA_GROCERIES: 'lh-exp-olivia-grocery',
  OLIVIA_CLIENT_LINK: 'lh-clink-olivia',
} as const;

// =============================================================================
// CONSTANTS
// =============================================================================

const NOW = new Date();
const ONE_YEAR_AGO = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000);
const TWO_YEARS_AGO = new Date(NOW.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
const FIVE_YEARS_AGO = new Date(NOW.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
const SEVEN_YEARS_FROM_NOW = new Date(NOW.getTime() + 7 * 365 * 24 * 60 * 60 * 1000);

// =============================================================================
// RESET (--reset flag)
// =============================================================================

async function reset() {
  console.log('🧹 Resetting lighthouse seed data…');
  const userIds = [
    IDS.ORG_OWNER_USER,
    IDS.SARAH_USER,
    IDS.DAVID_USER,
    IDS.OLIVIA_USER,
  ];
  // Cascade deletes via FK chain: deleting User cascades to almost
  // everything (LegalEntity, Property, Loan, Account, Income, Expense,
  // Conversation participants, ProfessionalRequest, ClientLink, etc).
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // Org row + listing + subscription + customer cascade off Organization.id
  await prisma.organization.deleteMany({ where: { id: IDS.ORG } });
  console.log('🧹 Reset complete.');
}

// =============================================================================
// SEED — SMITHFIELD WEALTH ADVISERS (the org)
// =============================================================================

async function seedSmithfield() {
  console.log('🏢 Seeding Smithfield Wealth Advisers…');

  // Reza's user account (also the Org owner)
  await prisma.user.upsert({
    where: { id: IDS.ORG_OWNER_USER },
    create: {
      id: IDS.ORG_OWNER_USER,
      email: 'reza@smithfieldwealth.com.au',
      name: 'Reza Sadeghi',
      password: null, // passwordless demo account
      emailVerified: true,
      emailVerifiedAt: ONE_YEAR_AGO,
    },
    update: {},
  });

  // Reza's PERSONAL entity (every user gets one for the entity layer)
  await prisma.legalEntity.upsert({
    where: { id: 'lh-ent-reza-personal' },
    create: {
      id: 'lh-ent-reza-personal',
      userId: IDS.ORG_OWNER_USER,
      name: 'Reza Sadeghi',
      type: 'PERSONAL_NAME',
      role: 'PERSONAL',
    },
    update: {},
  });

  // Smithfield Org
  await prisma.organization.upsert({
    where: { id: IDS.ORG },
    create: {
      id: IDS.ORG,
      name: 'Smithfield Wealth Advisers',
      slug: 'smithfield-wealth',
      description: 'Australian financial planning practice serving property investors and families with multi-entity structures.',
      profession: 'FINANCIAL_ADVISOR',
      mfaEnforced: false,
      sessionDurationHours: 168,
      allowedDomains: [],
    },
    update: {
      name: 'Smithfield Wealth Advisers',
      profession: 'FINANCIAL_ADVISOR',
    },
  });

  // Reza as PORTAL_OWNER seat
  await prisma.organizationMember.upsert({
    where: { id: IDS.ORG_MEMBER },
    create: {
      id: IDS.ORG_MEMBER,
      organizationId: IDS.ORG,
      userId: IDS.ORG_OWNER_USER,
      role: 'OWNER',
      joinedAt: ONE_YEAR_AGO,
      isActive: true,
    },
    update: {},
  });

  // Portal settings (tier set to PROFESSIONAL legacy, maps to PRACTICE tier)
  await prisma.organizationPortalSettings.upsert({
    where: { organizationId: IDS.ORG },
    create: {
      organizationId: IDS.ORG,
      organizationType: 'FINANCIAL_ADVISOR',
      plan: 'PROFESSIONAL', // Legacy — maps to canonical PRACTICE tier
    },
    update: {},
  });

  // Marketplace listing — APPROVED so it's live on /marketplace
  await prisma.professionalListing.upsert({
    where: { id: IDS.ORG_LISTING },
    create: {
      id: IDS.ORG_LISTING,
      organizationId: IDS.ORG,
      publicSlug: 'smithfield-wealth',
      displayName: 'Smithfield Wealth Advisers',
      tagline: 'Helping Australian families build wealth across more than one entity.',
      blurb:
        'We work with Australian property investors and families with trust + SMSF structures. ' +
        'Most of our clients have multi-property portfolios held across personal names, family trusts, ' +
        'and self-managed super funds. We\'re fee-for-service, AFSL-licensed, and transparent about ' +
        'what we do and don\'t do — we\'ll tell you when something is outside our remit. Our youngest ' +
        'client is 28 (first investment property); our most established is 71 (managing a $4.5M ' +
        'discretionary trust). We\'re based in Sydney CBD but most engagements are remote.',
      heroImageUrl: null,
      discipline: 'FINANCIAL_ADVISOR',
      specialisations: ['WEALTH_BUILDING', 'TAX_OPTIMISATION', 'PROPERTY_INVESTORS', 'SMSF_ACCOUNTING', 'TRUST_ACCOUNTING', 'RETIREMENT_PLANNING'],
      targetTiers: ['GROWING', 'ESTABLISHED', 'HIGH_NET_WORTH'],
      regions: ['NSW_SYDNEY_METRO', 'NATIONAL'],
      afslNumber: '524365',
      creditRepNumber: null,
      tpbNumber: null,
      abn: '12 345 678 901',
      leadFeeTierEmerging: 80,
      leadFeeTierGrowing: 150,
      leadFeeTierEstablished: 250,
      status: 'APPROVED',
      submittedAt: ONE_YEAR_AGO,
      reviewedAt: ONE_YEAR_AGO,
      asicCrossCheckedAt: ONE_YEAR_AGO,
      verificationNotes: 'AFSL #524365 verified on ASIC moneysmart register. ABN active on ABR. Demo seed.',
      ratingsCount: 12,
      averageRating: 4.8,
      acceptedRequestsCount: 18,
    },
    update: {
      status: 'APPROVED',
      ratingsCount: 12,
      averageRating: 4.8,
      acceptedRequestsCount: 18,
    },
  });

  // Stripe customer (test-mode demo) — useful so /portal/billing shows
  // real linkage instead of NOT_CONFIGURED state when the demo runs.
  await prisma.stripeCustomer.upsert({
    where: { id: IDS.ORG_STRIPE_CUSTOMER },
    create: {
      id: IDS.ORG_STRIPE_CUSTOMER,
      organizationId: IDS.ORG,
      stripeCustomerId: 'cus_lighthouse_demo',
      email: 'reza@smithfieldwealth.com.au',
      isTestMode: true,
    },
    update: {},
  });

  // Active Practice subscription
  await prisma.stripeSubscription.upsert({
    where: { id: IDS.ORG_STRIPE_SUBSCRIPTION },
    create: {
      id: IDS.ORG_STRIPE_SUBSCRIPTION,
      organizationId: IDS.ORG,
      customerId: IDS.ORG_STRIPE_CUSTOMER,
      stripeSubscriptionId: 'sub_lighthouse_demo',
      status: 'ACTIVE',
      planTier: 'PRACTICE',
      stripePriceId: 'price_practice_demo',
      stripeProductId: 'prod_practice_demo',
      currentPeriodStart: new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(NOW.getTime() + 16 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      isTestMode: true,
    },
    update: {
      status: 'ACTIVE',
      planTier: 'PRACTICE',
    },
  });

  console.log('  ✓ Smithfield Wealth Advisers + Reza + Practice subscription');
}

// =============================================================================
// SEED — SARAH KIM (sole-trader investor, TRACK stage)
// =============================================================================

async function seedSarah() {
  console.log('👤 Seeding Sarah Kim (sole-trader investor)…');

  await prisma.user.upsert({
    where: { id: IDS.SARAH_USER },
    create: {
      id: IDS.SARAH_USER,
      email: 'sarah.kim@example.com',
      name: 'Sarah Kim',
      password: null,
      emailVerified: true,
      emailVerifiedAt: new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  // Entities — Personal + Sarah Kim Pty Ltd
  await prisma.legalEntity.upsert({
    where: { id: IDS.SARAH_PERSONAL_ENTITY },
    create: {
      id: IDS.SARAH_PERSONAL_ENTITY,
      userId: IDS.SARAH_USER,
      name: 'Sarah Kim',
      type: 'PERSONAL_NAME',
      role: 'PERSONAL',
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.SARAH_PTYLTD_ENTITY },
    create: {
      id: IDS.SARAH_PTYLTD_ENTITY,
      userId: IDS.SARAH_USER,
      name: 'Sarah Kim Pty Ltd',
      type: 'COMPANY',
      role: 'OPERATING',
      abn: '11 222 333 444',
      acn: '222 333 444',
      establishedDate: TWO_YEARS_AGO,
    },
    update: {},
  });

  // Household
  await prisma.householdProfile.upsert({
    where: { id: IDS.SARAH_HOUSEHOLD_PROFILE },
    create: {
      id: IDS.SARAH_HOUSEHOLD_PROFILE,
      userId: IDS.SARAH_USER,
      adultsCount: 1,
      childrenCount: 0,
      childrenAges: [],
      petsCount: 0,
      petTypes: [],
      carsCount: 1,
      lifestylePreference: 'MODERATE',
      diningOutFrequency: 'SOMETIMES',
      isComplete: true,
    },
    update: {},
  });
  await prisma.householdMember.upsert({
    where: { id: IDS.SARAH_HOUSEHOLD_MEMBER },
    create: {
      id: IDS.SARAH_HOUSEHOLD_MEMBER,
      householdProfileId: IDS.SARAH_HOUSEHOLD_PROFILE,
      name: 'Sarah',
      relationship: 'SELF',
      isIncomeEarner: true,
    },
    update: {},
  });

  // Investment property — Melbourne 1-bed unit
  await prisma.property.upsert({
    where: { id: IDS.SARAH_PROPERTY },
    create: {
      id: IDS.SARAH_PROPERTY,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      name: 'Brunswick investment unit',
      type: 'INVESTMENT',
      address: '12/45 Sydney Road, Brunswick VIC 3056',
      purchasePrice: 480_000,
      purchaseDate: TWO_YEARS_AGO,
      currentValue: 525_000,
      valuationDate: NOW,
      suburb: 'Brunswick',
      state: 'VIC',
      postcode: '3056',
    },
    update: {},
  });

  // Loan + offset account
  await prisma.account.upsert({
    where: { id: IDS.SARAH_OFFSET_ACCOUNT },
    create: {
      id: IDS.SARAH_OFFSET_ACCOUNT,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      name: 'Brunswick offset',
      type: 'OFFSET',
      institution: 'Macquarie',
      currentBalance: 8_500, // <1 month emergency fund — alert hook
    },
    update: {
      currentBalance: 8_500,
    },
  });
  await prisma.loan.upsert({
    where: { id: IDS.SARAH_LOAN },
    create: {
      id: IDS.SARAH_LOAN,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      propertyId: IDS.SARAH_PROPERTY,
      offsetAccountId: IDS.SARAH_OFFSET_ACCOUNT,
      name: 'Brunswick investment loan',
      type: 'INVESTMENT',
      principal: 384_000, // 80% LVR at purchase
      interestRateAnnual: 0.0625,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 348, // 29 yr remaining
      minRepayment: 2_000,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });

  // Income — salary (personal) + business (Pty Ltd) + rental (personal)
  await prisma.income.upsert({
    where: { id: IDS.SARAH_SALARY },
    create: {
      id: IDS.SARAH_SALARY,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      name: 'PAYG salary — UX designer',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 105_000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
      payFrequency: 'FORTNIGHTLY',
      grossAmount: 105_000,
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.SARAH_BUSINESS_INCOME },
    create: {
      id: IDS.SARAH_BUSINESS_INCOME,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PTYLTD_ENTITY,
      name: 'Sarah Kim Pty Ltd — design contracts',
      type: 'OTHER',
      sourceType: 'GENERAL',
      amount: 45_000,
      frequency: 'ANNUAL',
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.SARAH_RENTAL_INCOME },
    create: {
      id: IDS.SARAH_RENTAL_INCOME,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      propertyId: IDS.SARAH_PROPERTY,
      name: 'Brunswick rental',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 480,
      frequency: 'WEEKLY',
    },
    update: {},
  });

  // Expenses — rent, groceries, loan repayment
  await prisma.expense.upsert({
    where: { id: IDS.SARAH_RENT_EXPENSE },
    create: {
      id: IDS.SARAH_RENT_EXPENSE,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      name: 'Rent — Carlton',
      category: 'RENT',
      sourceType: 'GENERAL',
      amount: 620,
      frequency: 'WEEKLY',
      isEssential: true,
      isTaxDeductible: false,
    },
    update: {},
  });
  await prisma.expense.upsert({
    where: { id: IDS.SARAH_GROCERIES_EXPENSE },
    create: {
      id: IDS.SARAH_GROCERIES_EXPENSE,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      name: 'Groceries',
      category: 'GROCERIES',
      sourceType: 'GENERAL',
      amount: 220,
      frequency: 'WEEKLY',
      isEssential: true,
    },
    update: {},
  });
  await prisma.expense.upsert({
    where: { id: IDS.SARAH_LOAN_EXPENSE },
    create: {
      id: IDS.SARAH_LOAN_EXPENSE,
      userId: IDS.SARAH_USER,
      ownerEntityId: IDS.SARAH_PERSONAL_ENTITY,
      loanId: IDS.SARAH_LOAN,
      name: 'Brunswick loan interest',
      category: 'LOAN_INTEREST',
      sourceType: 'PROPERTY',
      amount: 2_000,
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: true,
    },
    update: {},
  });

  // ClientLink — Sarah linked to Smithfield with active GRANTED consent
  await prisma.organizationClient.upsert({
    where: { id: IDS.SARAH_CLIENT_LINK },
    create: {
      id: IDS.SARAH_CLIENT_LINK,
      organizationId: IDS.ORG,
      userId: IDS.SARAH_USER,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
      accessScopes: ['FINANCIAL', 'PROPERTIES', 'LOANS', 'TAX'],
      consentGrantedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
      assignedToMemberId: IDS.ORG_MEMBER,
    },
    update: {},
  });

  // **The live-demo SUBMITTED request** — Reza accepts this during the pitch
  await prisma.professionalRequest.upsert({
    where: { id: IDS.SARAH_REQUEST },
    create: {
      id: IDS.SARAH_REQUEST,
      requesterUserId: IDS.SARAH_USER,
      listingId: IDS.ORG_LISTING,
      contextLabel: 'tax',
      question:
        'I want to make sure my tax position is optimised before EOFY — could we have a chat? ' +
        'I have a Pty Ltd I started this year and I\'m wondering whether I\'m structuring things ' +
        'correctly. Also keen to understand whether I should be claiming more on the Brunswick property.',
      snapshotContextJson: { shareMetrics: true },
      status: 'SUBMITTED',
      submittedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      leadFeeTier: 'EMERGING',
      leadFeeAmount: 80,
    },
    update: {
      status: 'SUBMITTED',
    },
  });

  console.log('  ✓ Sarah Kim — 1 property + Pty Ltd + 1 SUBMITTED request');
}

// =============================================================================
// SEED — DAVID MEI + EMMA LIU (family with trust + SMSF, REDUCE stage)
// =============================================================================

async function seedDavid() {
  console.log('👤 Seeding David Mei + Emma Liu (family with trust + SMSF)…');

  await prisma.user.upsert({
    where: { id: IDS.DAVID_USER },
    create: {
      id: IDS.DAVID_USER,
      email: 'david.mei@example.com',
      name: 'David Mei',
      password: null,
      emailVerified: true,
      emailVerifiedAt: new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  // 5 entities
  await prisma.legalEntity.upsert({
    where: { id: IDS.DAVID_PERSONAL_ENTITY },
    create: {
      id: IDS.DAVID_PERSONAL_ENTITY,
      userId: IDS.DAVID_USER,
      name: 'David Mei',
      type: 'PERSONAL_NAME',
      role: 'PERSONAL',
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.EMMA_PERSONAL_ENTITY },
    create: {
      id: IDS.EMMA_PERSONAL_ENTITY,
      userId: IDS.DAVID_USER,
      name: 'Emma Liu',
      type: 'PERSONAL_NAME',
      role: 'PERSONAL',
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.MEI_HOLDINGS_ENTITY },
    create: {
      id: IDS.MEI_HOLDINGS_ENTITY,
      userId: IDS.DAVID_USER,
      name: 'Mei Family Holdings Pty Ltd',
      type: 'COMPANY',
      role: 'HOLDING',
      abn: '12 345 678 901',
      acn: '345 678 901',
      establishedDate: FIVE_YEARS_AGO,
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.MEI_TRUST_ENTITY },
    create: {
      id: IDS.MEI_TRUST_ENTITY,
      userId: IDS.DAVID_USER,
      name: 'Mei Family Trust',
      type: 'DISCRETIONARY_TRUST',
      role: 'HOLDING',
      abn: '23 456 789 012',
      establishedDate: FIVE_YEARS_AGO,
      parentEntityId: IDS.MEI_HOLDINGS_ENTITY,
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.MEI_SMSF_ENTITY },
    create: {
      id: IDS.MEI_SMSF_ENTITY,
      userId: IDS.DAVID_USER,
      name: 'Mei SMSF',
      type: 'SMSF',
      role: 'SUPERANNUATION',
      abn: '34 567 890 123',
      establishedDate: TWO_YEARS_AGO,
    },
    update: {},
  });

  // Household
  await prisma.householdProfile.upsert({
    where: { id: IDS.DAVID_HOUSEHOLD_PROFILE },
    create: {
      id: IDS.DAVID_HOUSEHOLD_PROFILE,
      userId: IDS.DAVID_USER,
      adultsCount: 2,
      childrenCount: 1,
      childrenAges: [7],
      petsCount: 1,
      petTypes: ['dog'],
      carsCount: 2,
      lifestylePreference: 'COMFORTABLE',
      diningOutFrequency: 'OFTEN',
      isComplete: true,
    },
    update: {},
  });
  await prisma.householdMember.upsert({
    where: { id: IDS.DAVID_HOUSEHOLD_DAVID },
    create: {
      id: IDS.DAVID_HOUSEHOLD_DAVID,
      householdProfileId: IDS.DAVID_HOUSEHOLD_PROFILE,
      name: 'David',
      relationship: 'SELF',
      isIncomeEarner: true,
    },
    update: {},
  });
  await prisma.householdMember.upsert({
    where: { id: IDS.DAVID_HOUSEHOLD_EMMA },
    create: {
      id: IDS.DAVID_HOUSEHOLD_EMMA,
      householdProfileId: IDS.DAVID_HOUSEHOLD_PROFILE,
      name: 'Emma',
      relationship: 'SPOUSE',
      isIncomeEarner: true,
    },
    update: {},
  });
  await prisma.householdMember.upsert({
    where: { id: IDS.DAVID_HOUSEHOLD_CHILD },
    create: {
      id: IDS.DAVID_HOUSEHOLD_CHILD,
      householdProfileId: IDS.DAVID_HOUSEHOLD_PROFILE,
      name: 'Lucas',
      relationship: 'CHILD',
      isIncomeEarner: false,
    },
    update: {},
  });

  // PPR (David personal)
  await prisma.property.upsert({
    where: { id: IDS.DAVID_PROPERTY_PPR },
    create: {
      id: IDS.DAVID_PROPERTY_PPR,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      name: 'Family home — Killara',
      type: 'HOME',
      address: '24 Werona Avenue, Killara NSW 2071',
      purchasePrice: 1_350_000,
      purchaseDate: FIVE_YEARS_AGO,
      currentValue: 1_850_000,
      valuationDate: NOW,
      suburb: 'Killara',
      state: 'NSW',
      postcode: '2071',
    },
    update: {},
  });
  // 2 investment properties via trust
  await prisma.property.upsert({
    where: { id: IDS.DAVID_PROPERTY_INV1 },
    create: {
      id: IDS.DAVID_PROPERTY_INV1,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_TRUST_ENTITY,
      name: 'Investment 1 — Newtown',
      type: 'INVESTMENT',
      address: '78 King Street, Newtown NSW 2042',
      purchasePrice: 920_000,
      purchaseDate: new Date(NOW.getTime() - 4 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 1_080_000,
      valuationDate: NOW,
      suburb: 'Newtown',
      state: 'NSW',
      postcode: '2042',
    },
    update: {},
  });
  await prisma.property.upsert({
    where: { id: IDS.DAVID_PROPERTY_INV2 },
    create: {
      id: IDS.DAVID_PROPERTY_INV2,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_TRUST_ENTITY,
      name: 'Investment 2 — Marrickville',
      type: 'INVESTMENT',
      address: '15 Illawarra Road, Marrickville NSW 2204',
      purchasePrice: 850_000,
      purchaseDate: new Date(NOW.getTime() - 3 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 985_000,
      valuationDate: NOW,
      suburb: 'Marrickville',
      state: 'NSW',
      postcode: '2204',
    },
    update: {},
  });
  // SMSF property
  await prisma.property.upsert({
    where: { id: IDS.DAVID_PROPERTY_SMSF },
    create: {
      id: IDS.DAVID_PROPERTY_SMSF,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_SMSF_ENTITY,
      name: 'SMSF property — Brisbane',
      type: 'INVESTMENT',
      address: '42 Vulture Street, South Brisbane QLD 4101',
      purchasePrice: 720_000,
      purchaseDate: new Date(NOW.getTime() - 2 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 795_000,
      valuationDate: NOW,
      suburb: 'South Brisbane',
      state: 'QLD',
      postcode: '4101',
    },
    update: {},
  });

  // Loans
  await prisma.account.upsert({
    where: { id: IDS.DAVID_OFFSET_ACCOUNT },
    create: {
      id: IDS.DAVID_OFFSET_ACCOUNT,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      name: 'Killara offset',
      type: 'OFFSET',
      institution: 'CommBank',
      currentBalance: 95_000,
    },
    update: {},
  });
  await prisma.account.upsert({
    where: { id: IDS.DAVID_EMERGENCY_ACCOUNT },
    create: {
      id: IDS.DAVID_EMERGENCY_ACCOUNT,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      name: 'Emergency fund',
      type: 'SAVINGS',
      institution: 'Macquarie',
      currentBalance: 65_000, // ~6 months emergency fund
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: IDS.DAVID_LOAN_PPR },
    create: {
      id: IDS.DAVID_LOAN_PPR,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_PPR,
      offsetAccountId: IDS.DAVID_OFFSET_ACCOUNT,
      name: 'Killara PPR loan',
      type: 'HOME',
      principal: 760_000,
      interestRateAnnual: 0.0699, // **The refinance hook** — fixed expiry Tuesday
      rateType: 'FIXED',
      fixedExpiry: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks — refinance window
      isInterestOnly: false,
      termMonthsRemaining: 240,
      minRepayment: 5_900,
      repaymentFrequency: 'MONTHLY',
    },
    update: {
      fixedExpiry: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.loan.upsert({
    where: { id: IDS.DAVID_LOAN_INV1 },
    create: {
      id: IDS.DAVID_LOAN_INV1,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_TRUST_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_INV1,
      name: 'Newtown investment loan',
      type: 'INVESTMENT',
      principal: 720_000,
      interestRateAnnual: 0.0625,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 312,
      minRepayment: 3_750,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: IDS.DAVID_LOAN_INV2 },
    create: {
      id: IDS.DAVID_LOAN_INV2,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_TRUST_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_INV2,
      name: 'Marrickville investment loan',
      type: 'INVESTMENT',
      principal: 660_000,
      interestRateAnnual: 0.0625,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 324,
      minRepayment: 3_440,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: IDS.DAVID_LOAN_LRBA },
    create: {
      id: IDS.DAVID_LOAN_LRBA,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_SMSF_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_SMSF,
      name: 'SMSF LRBA — Brisbane',
      type: 'INVESTMENT',
      principal: 504_000, // 70% LVR (SMSF lending limit)
      interestRateAnnual: 0.0699,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 288,
      minRepayment: 2_940,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });

  // Income
  await prisma.income.upsert({
    where: { id: IDS.DAVID_SALARY },
    create: {
      id: IDS.DAVID_SALARY,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      name: 'PAYG salary — engineering manager',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 215_000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
      payFrequency: 'FORTNIGHTLY',
      grossAmount: 215_000,
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.EMMA_SALARY },
    create: {
      id: IDS.EMMA_SALARY,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.EMMA_PERSONAL_ENTITY,
      name: 'PAYG salary — Emma, marketing director',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 168_000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
      payFrequency: 'FORTNIGHTLY',
      grossAmount: 168_000,
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.DAVID_RENT1 },
    create: {
      id: IDS.DAVID_RENT1,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_TRUST_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_INV1,
      name: 'Newtown rental',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 720,
      frequency: 'WEEKLY',
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.DAVID_RENT2 },
    create: {
      id: IDS.DAVID_RENT2,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_TRUST_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_INV2,
      name: 'Marrickville rental',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 660,
      frequency: 'WEEKLY',
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.DAVID_RENT_SMSF },
    create: {
      id: IDS.DAVID_RENT_SMSF,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.MEI_SMSF_ENTITY,
      propertyId: IDS.DAVID_PROPERTY_SMSF,
      name: 'Brisbane SMSF rental',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 580,
      frequency: 'WEEKLY',
    },
    update: {},
  });

  // Expenses
  await prisma.expense.upsert({
    where: { id: IDS.DAVID_GROCERIES },
    create: {
      id: IDS.DAVID_GROCERIES,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      name: 'Groceries',
      category: 'GROCERIES',
      sourceType: 'GENERAL',
      amount: 380,
      frequency: 'WEEKLY',
      isEssential: true,
    },
    update: {},
  });
  await prisma.expense.upsert({
    where: { id: IDS.DAVID_PPR_REPAYMENT },
    create: {
      id: IDS.DAVID_PPR_REPAYMENT,
      userId: IDS.DAVID_USER,
      ownerEntityId: IDS.DAVID_PERSONAL_ENTITY,
      loanId: IDS.DAVID_LOAN_PPR,
      name: 'Killara PPR repayment',
      category: 'LOAN_INTEREST',
      sourceType: 'PROPERTY',
      amount: 5_900,
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: false,
    },
    update: {},
  });

  // ClientLink — David linked to Smithfield
  await prisma.organizationClient.upsert({
    where: { id: IDS.DAVID_CLIENT_LINK },
    create: {
      id: IDS.DAVID_CLIENT_LINK,
      organizationId: IDS.ORG,
      userId: IDS.DAVID_USER,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
      accessScopes: ['FULL'],
      consentGrantedAt: new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000),
      assignedToMemberId: IDS.ORG_MEMBER,
    },
    update: {},
  });

  // **Pre-existing ACCEPTED ProfessionalRequest + conversation** — for the
  // Step 7 demo path that shows a thread with prior history (Sarah's is
  // the live-Accept demo; David's already has a conversation depth).
  await prisma.professionalRequest.upsert({
    where: { id: IDS.DAVID_REQUEST },
    create: {
      id: IDS.DAVID_REQUEST,
      requesterUserId: IDS.DAVID_USER,
      listingId: IDS.ORG_LISTING,
      contextLabel: 'refinance',
      question:
        'Our PPR fixed rate rolls off in 2 weeks. Would love a quick chat about ' +
        'whether to fix again or go variable, given where rates are heading. Also ' +
        'wondering if we should restructure the trust loans at the same time.',
      snapshotContextJson: { shareMetrics: true },
      status: 'ACCEPTED',
      submittedAt: new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000),
      respondedAt: new Date(NOW.getTime() - 13 * 24 * 60 * 60 * 1000),
      respondedByMemberId: IDS.ORG_MEMBER,
      leadFeeTier: 'ESTABLISHED',
      leadFeeAmount: 250,
      leadFeeChargedAt: new Date(NOW.getTime() - 13 * 24 * 60 * 60 * 1000),
      leadFeeStatus: 'PAID',
      leadFeePaidAt: new Date(NOW.getTime() - 12 * 24 * 60 * 60 * 1000),
      stripeInvoiceId: 'in_lighthouse_demo_david',
      leadFeeInvoiceUrl: 'https://invoice.stripe.com/i/test_demo_david',
      clientLinkId: IDS.DAVID_CLIENT_LINK,
    },
    update: {},
  });

  // Conversation auto-created from David's accepted request
  await prisma.professionalConversation.upsert({
    where: { id: IDS.DAVID_CONVERSATION },
    create: {
      id: IDS.DAVID_CONVERSATION,
      requestId: IDS.DAVID_REQUEST,
      organizationId: IDS.ORG,
      replyToSlug: 'lighthouse-david-demo-thread',
      subject: 'PPR fixed rate rolling off in 2 weeks',
      isClosed: false,
      lastMessageAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  // Participants
  await prisma.conversationParticipant.upsert({
    where: { id: 'lh-cp-david-consumer' },
    create: {
      id: 'lh-cp-david-consumer',
      conversationId: IDS.DAVID_CONVERSATION,
      userId: IDS.DAVID_USER,
      role: 'CONSUMER',
    },
    update: {},
  });
  await prisma.conversationParticipant.upsert({
    where: { id: 'lh-cp-david-pro' },
    create: {
      id: 'lh-cp-david-pro',
      conversationId: IDS.DAVID_CONVERSATION,
      memberId: IDS.ORG_MEMBER,
      role: 'PROFESSIONAL',
    },
    update: {},
  });

  // 3 sample messages — use deleteMany + createMany so message-list is
  // deterministic each seed run (don't accumulate duplicates)
  await prisma.conversationMessage.deleteMany({
    where: { conversationId: IDS.DAVID_CONVERSATION },
  });
  await prisma.conversationMessage.createMany({
    data: [
      {
        conversationId: IDS.DAVID_CONVERSATION,
        senderUserId: IDS.ORG_OWNER_USER,
        senderRole: 'PROFESSIONAL',
        body: 'Hi David, happy to help. Your timing is good — let\'s set up 30 min before the fixed rate rolls off. Tuesday 10am or Thursday 2pm? Bring your last two FY tax returns and your trust deed.',
        channel: 'IN_APP',
        retentionUntil: SEVEN_YEARS_FROM_NOW,
        createdAt: new Date(NOW.getTime() - 13 * 24 * 60 * 60 * 1000),
      },
      {
        conversationId: IDS.DAVID_CONVERSATION,
        senderUserId: IDS.DAVID_USER,
        senderRole: 'CONSUMER',
        body: 'Thursday 2pm works great. I\'ll send the docs through now. One more question — should Emma\'s super contributions be coordinated with the trust distribution this year? My accountant said something about it but I didn\'t fully follow.',
        channel: 'IN_APP',
        retentionUntil: SEVEN_YEARS_FROM_NOW,
        createdAt: new Date(NOW.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
      {
        conversationId: IDS.DAVID_CONVERSATION,
        senderUserId: IDS.ORG_OWNER_USER,
        senderRole: 'PROFESSIONAL',
        body: 'Great question — we\'ll cover that on the call. Short answer: yes, there\'s coordination value if Emma\'s in a higher marginal bracket than the trust\'s effective rate. Looking forward to Thursday.',
        channel: 'IN_APP',
        retentionUntil: SEVEN_YEARS_FROM_NOW,
        createdAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('  ✓ David Mei + Emma Liu — 5 entities + 4 properties + 4 loans + ACCEPTED request + conversation');
}

// =============================================================================
// SEED — OLIVIA NOVAK (multi-entity HNW, INVEST stage)
// =============================================================================

async function seedOlivia() {
  console.log('👤 Seeding Olivia Novak (multi-entity HNW)…');

  await prisma.user.upsert({
    where: { id: IDS.OLIVIA_USER },
    create: {
      id: IDS.OLIVIA_USER,
      email: 'olivia.novak@example.com',
      name: 'Olivia Novak',
      password: null,
      emailVerified: true,
      emailVerifiedAt: new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  // 5 entities
  await prisma.legalEntity.upsert({
    where: { id: IDS.OLIVIA_PERSONAL_ENTITY },
    create: {
      id: IDS.OLIVIA_PERSONAL_ENTITY,
      userId: IDS.OLIVIA_USER,
      name: 'Olivia Novak',
      type: 'PERSONAL_NAME',
      role: 'PERSONAL',
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.NOVAK_HOLDINGS_ENTITY },
    create: {
      id: IDS.NOVAK_HOLDINGS_ENTITY,
      userId: IDS.OLIVIA_USER,
      name: 'Novak Investment Holdings Pty Ltd',
      type: 'COMPANY',
      role: 'HOLDING',
      abn: '34 567 890 123',
      acn: '567 890 123',
      establishedDate: new Date(NOW.getTime() - 8 * 365 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.NOVAK_TRUST_ENTITY },
    create: {
      id: IDS.NOVAK_TRUST_ENTITY,
      userId: IDS.OLIVIA_USER,
      name: 'Novak Family Trust',
      type: 'DISCRETIONARY_TRUST',
      role: 'HOLDING',
      abn: '45 678 901 234',
      establishedDate: new Date(NOW.getTime() - 8 * 365 * 24 * 60 * 60 * 1000),
      parentEntityId: IDS.NOVAK_HOLDINGS_ENTITY,
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.NOVAK_UNIT_TRUST_ENTITY },
    create: {
      id: IDS.NOVAK_UNIT_TRUST_ENTITY,
      userId: IDS.OLIVIA_USER,
      name: 'Novak Unit Trust',
      type: 'UNIT_TRUST',
      role: 'INVESTMENT',
      abn: '56 789 012 345',
      establishedDate: new Date(NOW.getTime() - 4 * 365 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });
  await prisma.legalEntity.upsert({
    where: { id: IDS.NOVAK_SMSF_ENTITY },
    create: {
      id: IDS.NOVAK_SMSF_ENTITY,
      userId: IDS.OLIVIA_USER,
      name: 'Novak SMSF',
      type: 'SMSF',
      role: 'SUPERANNUATION',
      abn: '67 890 123 456',
      establishedDate: new Date(NOW.getTime() - 6 * 365 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  // Household — Olivia solo
  await prisma.householdProfile.upsert({
    where: { id: IDS.OLIVIA_HOUSEHOLD_PROFILE },
    create: {
      id: IDS.OLIVIA_HOUSEHOLD_PROFILE,
      userId: IDS.OLIVIA_USER,
      adultsCount: 1,
      childrenCount: 0,
      childrenAges: [],
      petsCount: 0,
      petTypes: [],
      carsCount: 1,
      lifestylePreference: 'COMFORTABLE',
      diningOutFrequency: 'OFTEN',
      isComplete: true,
    },
    update: {},
  });
  await prisma.householdMember.upsert({
    where: { id: IDS.OLIVIA_HOUSEHOLD_OLIVIA },
    create: {
      id: IDS.OLIVIA_HOUSEHOLD_OLIVIA,
      householdProfileId: IDS.OLIVIA_HOUSEHOLD_PROFILE,
      name: 'Olivia',
      relationship: 'SELF',
      isIncomeEarner: true,
    },
    update: {},
  });

  // Properties
  await prisma.property.upsert({
    where: { id: IDS.OLIVIA_PROPERTY_PPR },
    create: {
      id: IDS.OLIVIA_PROPERTY_PPR,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.OLIVIA_PERSONAL_ENTITY,
      name: 'PPR — Mosman',
      type: 'HOME',
      address: '156 Military Road, Mosman NSW 2088',
      purchasePrice: 2_750_000,
      purchaseDate: new Date(NOW.getTime() - 7 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 4_100_000,
      valuationDate: NOW,
      suburb: 'Mosman',
      state: 'NSW',
      postcode: '2088',
    },
    update: {},
  });
  await prisma.property.upsert({
    where: { id: IDS.OLIVIA_PROPERTY_INV1 },
    create: {
      id: IDS.OLIVIA_PROPERTY_INV1,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_TRUST_ENTITY,
      name: 'Trust Investment 1 — Bondi',
      type: 'INVESTMENT',
      address: '88 Campbell Parade, Bondi Beach NSW 2026',
      purchasePrice: 1_650_000,
      purchaseDate: new Date(NOW.getTime() - 5 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 2_280_000,
      valuationDate: NOW,
      suburb: 'Bondi Beach',
      state: 'NSW',
      postcode: '2026',
    },
    update: {},
  });
  await prisma.property.upsert({
    where: { id: IDS.OLIVIA_PROPERTY_INV2 },
    create: {
      id: IDS.OLIVIA_PROPERTY_INV2,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_TRUST_ENTITY,
      name: 'Trust Investment 2 — Surry Hills',
      type: 'INVESTMENT',
      address: '24 Crown Street, Surry Hills NSW 2010',
      purchasePrice: 1_280_000,
      purchaseDate: new Date(NOW.getTime() - 3 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 1_485_000,
      valuationDate: NOW,
      suburb: 'Surry Hills',
      state: 'NSW',
      postcode: '2010',
    },
    update: {},
  });
  await prisma.property.upsert({
    where: { id: IDS.OLIVIA_PROPERTY_COMMERCIAL },
    create: {
      id: IDS.OLIVIA_PROPERTY_COMMERCIAL,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_UNIT_TRUST_ENTITY,
      name: 'Commercial property — Parramatta',
      type: 'INVESTMENT',
      address: '210 Church Street, Parramatta NSW 2150',
      purchasePrice: 1_850_000,
      purchaseDate: new Date(NOW.getTime() - 4 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 2_350_000,
      valuationDate: NOW,
      suburb: 'Parramatta',
      state: 'NSW',
      postcode: '2150',
    },
    update: {},
  });
  await prisma.property.upsert({
    where: { id: IDS.OLIVIA_PROPERTY_SMSF },
    create: {
      id: IDS.OLIVIA_PROPERTY_SMSF,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_SMSF_ENTITY,
      name: 'SMSF — Brisbane CBD apartment',
      type: 'INVESTMENT',
      address: '42 Mary Street, Brisbane QLD 4000',
      purchasePrice: 950_000,
      purchaseDate: new Date(NOW.getTime() - 4 * 365 * 24 * 60 * 60 * 1000),
      currentValue: 1_120_000,
      valuationDate: NOW,
      suburb: 'Brisbane CBD',
      state: 'QLD',
      postcode: '4000',
    },
    update: {},
  });

  // Emergency fund (11 months — INVEST stage)
  await prisma.account.upsert({
    where: { id: IDS.OLIVIA_EMERGENCY_ACCOUNT },
    create: {
      id: IDS.OLIVIA_EMERGENCY_ACCOUNT,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.OLIVIA_PERSONAL_ENTITY,
      name: 'Emergency fund — high-interest savings',
      type: 'SAVINGS',
      institution: 'ING',
      currentBalance: 165_000,
    },
    update: {},
  });

  // Loans
  await prisma.loan.upsert({
    where: { id: IDS.OLIVIA_LOAN_PPR },
    create: {
      id: IDS.OLIVIA_LOAN_PPR,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.OLIVIA_PERSONAL_ENTITY,
      propertyId: IDS.OLIVIA_PROPERTY_PPR,
      name: 'Mosman PPR loan',
      type: 'HOME',
      principal: 1_650_000,
      interestRateAnnual: 0.0625,
      rateType: 'VARIABLE',
      isInterestOnly: false,
      termMonthsRemaining: 240,
      minRepayment: 12_000,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: IDS.OLIVIA_LOAN_INV1 },
    create: {
      id: IDS.OLIVIA_LOAN_INV1,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_TRUST_ENTITY,
      propertyId: IDS.OLIVIA_PROPERTY_INV1,
      name: 'Bondi investment loan',
      type: 'INVESTMENT',
      principal: 1_320_000,
      interestRateAnnual: 0.0625,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 300,
      minRepayment: 6_870,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: IDS.OLIVIA_LOAN_COMMERCIAL },
    create: {
      id: IDS.OLIVIA_LOAN_COMMERCIAL,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_UNIT_TRUST_ENTITY,
      propertyId: IDS.OLIVIA_PROPERTY_COMMERCIAL,
      name: 'Parramatta commercial loan',
      type: 'BUSINESS',
      principal: 1_295_000,
      interestRateAnnual: 0.0699,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 240,
      minRepayment: 7_550,
      repaymentFrequency: 'MONTHLY',
    },
    update: {},
  });

  // Income — salary + dividends + 3 rentals
  await prisma.income.upsert({
    where: { id: IDS.OLIVIA_SALARY },
    create: {
      id: IDS.OLIVIA_SALARY,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.OLIVIA_PERSONAL_ENTITY,
      name: 'PAYG salary — partner at law firm',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 480_000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
      payFrequency: 'MONTHLY',
      grossAmount: 480_000,
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.OLIVIA_DIVIDENDS },
    create: {
      id: IDS.OLIVIA_DIVIDENDS,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_HOLDINGS_ENTITY,
      name: 'Holdings Pty Ltd — share dividends',
      type: 'INVESTMENT',
      sourceType: 'INVESTMENT',
      amount: 38_000,
      frequency: 'ANNUAL',
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.OLIVIA_RENT_INV1 },
    create: {
      id: IDS.OLIVIA_RENT_INV1,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_TRUST_ENTITY,
      propertyId: IDS.OLIVIA_PROPERTY_INV1,
      name: 'Bondi rental',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 1_280,
      frequency: 'WEEKLY',
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.OLIVIA_RENT_INV2 },
    create: {
      id: IDS.OLIVIA_RENT_INV2,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_TRUST_ENTITY,
      propertyId: IDS.OLIVIA_PROPERTY_INV2,
      name: 'Surry Hills rental',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 920,
      frequency: 'WEEKLY',
    },
    update: {},
  });
  await prisma.income.upsert({
    where: { id: IDS.OLIVIA_RENT_COMMERCIAL },
    create: {
      id: IDS.OLIVIA_RENT_COMMERCIAL,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.NOVAK_UNIT_TRUST_ENTITY,
      propertyId: IDS.OLIVIA_PROPERTY_COMMERCIAL,
      name: 'Parramatta commercial rent',
      type: 'RENT',
      sourceType: 'PROPERTY',
      amount: 4_500,
      frequency: 'MONTHLY',
    },
    update: {},
  });

  // Groceries (the relatable expense — every demo benefits from one)
  await prisma.expense.upsert({
    where: { id: IDS.OLIVIA_GROCERIES },
    create: {
      id: IDS.OLIVIA_GROCERIES,
      userId: IDS.OLIVIA_USER,
      ownerEntityId: IDS.OLIVIA_PERSONAL_ENTITY,
      name: 'Groceries',
      category: 'GROCERIES',
      sourceType: 'GENERAL',
      amount: 280,
      frequency: 'WEEKLY',
      isEssential: true,
    },
    update: {},
  });

  // ClientLink
  await prisma.organizationClient.upsert({
    where: { id: IDS.OLIVIA_CLIENT_LINK },
    create: {
      id: IDS.OLIVIA_CLIENT_LINK,
      organizationId: IDS.ORG,
      userId: IDS.OLIVIA_USER,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
      accessScopes: ['FULL'],
      consentGrantedAt: new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000),
      assignedToMemberId: IDS.ORG_MEMBER,
    },
    update: {},
  });

  console.log('  ✓ Olivia Novak — 5 entities + 5 properties + 3 loans');
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Importable entry point — used by `app/api/admin/run-seed/route.ts` so the
 * seed can be triggered via Vercel runtime auth (WIF) without needing a
 * Cloud SQL Proxy on the operator's machine. Also called by the CLI
 * bootstrap below when invoked via `npm run seed:lighthouse`.
 */
export async function runLighthouseSeed(options: { reset?: boolean } = {}): Promise<void> {
  const { reset: shouldReset = false } = options;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LIGHTHOUSE PITCH FIXTURE SEED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (shouldReset) {
    await reset();
  }

  await seedSmithfield();
  await seedSarah();
  await seedDavid();
  await seedOlivia();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('DEMO ACCOUNTS:');
  console.log('  Reza @ Smithfield  — reza@smithfieldwealth.com.au');
  console.log('  Sarah Kim          — sarah.kim@example.com');
  console.log('  David Mei          — david.mei@example.com');
  console.log('  Olivia Novak       — olivia.novak@example.com');
  console.log('');
  console.log('All accounts are passwordless (use Firebase Auth password reset to set).');
  console.log('');
  console.log('PITCH HOOKS PRE-LOADED:');
  console.log('  • Sarah has a SUBMITTED ProfessionalRequest waiting for live Accept');
  console.log('  • David has an ACCEPTED conversation with 3 sample messages');
  console.log('  • Smithfield is on Practice plan (active StripeSubscription, test-mode)');
  console.log('  • Marketplace listing is APPROVED + live on /marketplace');
}

// CLI bootstrap — only runs when invoked directly via `npm run seed:lighthouse`,
// NOT when imported by the admin route handler.
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');

  runLighthouseSeed({ reset: shouldReset })
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
