/**
 * VALIDATION SEED SCRIPT
 * Creates deterministic test data for validation testing
 *
 * Portfolio A: Standard portfolio with typical financial situation
 * Portfolio B: Edge-case portfolio with complex scenarios
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// TEST USER IDs (deterministic for consistent testing)
// =============================================================================

const TEST_USER_A_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_B_ID = '00000000-0000-0000-0000-000000000002';

// =============================================================================
// PORTFOLIO A: STANDARD PORTFOLIO
// =============================================================================
// A typical Australian family with:
// - 1 home, 1 investment property
// - 2 loans (home + investment)
// - Offset account
// - Salary income + rental income
// - Various expenses
// - Some ETF investments

async function seedPortfolioA() {
  console.log('Seeding Portfolio A (Standard)...');

  // Create user
  const userA = await prisma.user.upsert({
    where: { id: TEST_USER_A_ID },
    update: {},
    create: {
      id: TEST_USER_A_ID,
      email: 'test-user-a@monitrax.test',
      name: 'Test User A',
      password: '$2b$10$hash', // Not used, just placeholder
      role: 'OWNER',
      emailVerified: true,
    },
  });

  // ==========================================================================
  // PROPERTIES
  // ==========================================================================

  // Home property
  const homeProperty = await prisma.property.upsert({
    where: { id: '11111111-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '11111111-0000-0000-0000-000000000001',
      userId: userA.id,
      name: 'Primary Residence - Sydney',
      type: 'HOME',
      address: '123 Test Street, Sydney NSW 2000',
      purchasePrice: 800000,
      purchaseDate: new Date('2020-01-15'),
      currentValue: 950000,
      valuationDate: new Date('2024-06-01'),
    },
  });

  // Investment property
  const investmentProperty = await prisma.property.upsert({
    where: { id: '11111111-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '11111111-0000-0000-0000-000000000002',
      userId: userA.id,
      name: 'Investment Property - Melbourne',
      type: 'INVESTMENT',
      address: '456 Rental Avenue, Melbourne VIC 3000',
      purchasePrice: 550000,
      purchaseDate: new Date('2021-06-01'),
      currentValue: 620000,
      valuationDate: new Date('2024-06-01'),
    },
  });

  // ==========================================================================
  // ACCOUNTS (before loans, for offset linking)
  // ==========================================================================

  // Offset account (for home loan)
  const offsetAccount = await prisma.account.upsert({
    where: { id: '22222222-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '22222222-0000-0000-0000-000000000001',
      userId: userA.id,
      name: 'Home Loan Offset',
      type: 'OFFSET',
      institution: 'CBA',
      currentBalance: 45000, // $45k in offset
      interestRate: 0, // Offset accounts don't earn interest
    },
  });

  // Savings account
  const savingsAccount = await prisma.account.upsert({
    where: { id: '22222222-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '22222222-0000-0000-0000-000000000002',
      userId: userA.id,
      name: 'High Interest Savings',
      type: 'SAVINGS',
      institution: 'ING',
      currentBalance: 25000,
      interestRate: 0.045, // 4.5%
    },
  });

  // Transaction account
  const transactionAccount = await prisma.account.upsert({
    where: { id: '22222222-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '22222222-0000-0000-0000-000000000003',
      userId: userA.id,
      name: 'Everyday Account',
      type: 'TRANSACTIONAL',
      institution: 'CBA',
      currentBalance: 5000,
    },
  });

  // ==========================================================================
  // LOANS
  // ==========================================================================

  // Home loan (P&I, variable, with offset)
  const homeLoan = await prisma.loan.upsert({
    where: { id: '33333333-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '33333333-0000-0000-0000-000000000001',
      userId: userA.id,
      propertyId: homeProperty.id,
      offsetAccountId: offsetAccount.id,
      name: 'Home Loan - CBA',
      type: 'HOME',
      principal: 520000, // $520k remaining
      interestRateAnnual: 0.0625, // 6.25%
      rateType: 'VARIABLE',
      isInterestOnly: false,
      termMonthsRemaining: 324, // 27 years
      minRepayment: 3450, // Monthly P&I
      repaymentFrequency: 'MONTHLY',
    },
  });

  // Investment loan (IO, variable, no offset)
  const investmentLoan = await prisma.loan.upsert({
    where: { id: '33333333-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '33333333-0000-0000-0000-000000000002',
      userId: userA.id,
      propertyId: investmentProperty.id,
      name: 'Investment Loan - ANZ',
      type: 'INVESTMENT',
      principal: 440000, // $440k remaining (80% LVR)
      interestRateAnnual: 0.0685, // 6.85%
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 60, // 5 years IO period
      minRepayment: 2512, // Monthly IO payment
      repaymentFrequency: 'MONTHLY',
    },
  });

  // ==========================================================================
  // INCOME
  // ==========================================================================

  // Salary
  const salaryIncome = await prisma.income.upsert({
    where: { id: '44444444-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '44444444-0000-0000-0000-000000000001',
      userId: userA.id,
      name: 'Primary Salary',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 7500, // $7,500/month gross = $90k/year
      frequency: 'MONTHLY',
      isTaxable: true,
    },
  });

  // Partner salary
  const partnerSalary = await prisma.income.upsert({
    where: { id: '44444444-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '44444444-0000-0000-0000-000000000002',
      userId: userA.id,
      name: 'Partner Salary',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 5500, // $5,500/month = $66k/year
      frequency: 'MONTHLY',
      isTaxable: true,
    },
  });

  // Rental income
  const rentalIncome = await prisma.income.upsert({
    where: { id: '44444444-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '44444444-0000-0000-0000-000000000003',
      userId: userA.id,
      propertyId: investmentProperty.id,
      name: 'Melbourne Rental',
      type: 'RENTAL',
      sourceType: 'PROPERTY',
      amount: 550, // $550/week
      frequency: 'WEEKLY',
      isTaxable: true,
    },
  });

  // ==========================================================================
  // EXPENSES
  // ==========================================================================

  // Home loan interest (calculated: $520k - $45k offset = $475k @ 6.25%)
  const homeLoanInterest = await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000001',
      userId: userA.id,
      loanId: homeLoan.id,
      name: 'Home Loan Interest',
      category: 'LOAN_INTEREST',
      sourceType: 'LOAN',
      amount: 2474, // Monthly interest on effective principal
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: false, // Home loan not deductible
    },
  });

  // Investment loan interest (tax deductible)
  const investLoanInterest = await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000002',
      userId: userA.id,
      loanId: investmentLoan.id,
      propertyId: investmentProperty.id,
      name: 'Investment Loan Interest',
      category: 'LOAN_INTEREST',
      sourceType: 'LOAN',
      amount: 2512, // Monthly IO
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Council rates - home
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000003',
      userId: userA.id,
      propertyId: homeProperty.id,
      name: 'Council Rates - Home',
      category: 'RATES',
      sourceType: 'PROPERTY',
      amount: 2400, // $2,400/year
      frequency: 'ANNUAL',
      isEssential: true,
      isTaxDeductible: false,
    },
  });

  // Council rates - investment
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000004',
      userId: userA.id,
      propertyId: investmentProperty.id,
      name: 'Council Rates - Investment',
      category: 'RATES',
      sourceType: 'PROPERTY',
      amount: 1800,
      frequency: 'ANNUAL',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Insurance - home
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000005',
      userId: userA.id,
      propertyId: homeProperty.id,
      name: 'Home Insurance',
      category: 'INSURANCE',
      sourceType: 'PROPERTY',
      amount: 2200,
      frequency: 'ANNUAL',
      isEssential: true,
      isTaxDeductible: false,
    },
  });

  // Insurance - investment (landlord)
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000006' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000006',
      userId: userA.id,
      propertyId: investmentProperty.id,
      name: 'Landlord Insurance',
      category: 'INSURANCE',
      sourceType: 'PROPERTY',
      amount: 1600,
      frequency: 'ANNUAL',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Strata - investment
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000007' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000007',
      userId: userA.id,
      propertyId: investmentProperty.id,
      name: 'Strata Fees',
      category: 'STRATA',
      sourceType: 'PROPERTY',
      amount: 650, // $650/quarter
      frequency: 'MONTHLY', // stored as monthly equivalent
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Property management - investment
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000008' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000008',
      userId: userA.id,
      propertyId: investmentProperty.id,
      name: 'Property Management',
      category: 'MAINTENANCE',
      sourceType: 'PROPERTY',
      amount: 143, // 5% of weekly rent
      frequency: 'WEEKLY',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Utilities
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000009' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000009',
      userId: userA.id,
      name: 'Utilities (Gas, Electric, Water)',
      category: 'UTILITIES',
      sourceType: 'GENERAL',
      amount: 450,
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: false,
    },
  });

  // Groceries
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000010',
      userId: userA.id,
      name: 'Groceries',
      category: 'FOOD',
      sourceType: 'GENERAL',
      amount: 250,
      frequency: 'WEEKLY',
      isEssential: true,
      isTaxDeductible: false,
    },
  });

  // Transport
  await prisma.expense.upsert({
    where: { id: '55555555-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '55555555-0000-0000-0000-000000000011',
      userId: userA.id,
      name: 'Transport (Fuel, Opal)',
      category: 'TRANSPORT',
      sourceType: 'GENERAL',
      amount: 400,
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: false,
    },
  });

  // ==========================================================================
  // DEPRECIATION SCHEDULES
  // ==========================================================================

  // DIV43 Capital Works - Investment property (post-1987)
  await prisma.depreciationSchedule.upsert({
    where: { id: '66666666-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '66666666-0000-0000-0000-000000000001',
      propertyId: investmentProperty.id,
      category: 'DIV43',
      assetName: 'Building Structure',
      cost: 350000, // Construction cost portion
      startDate: new Date('2021-06-01'),
      rate: 0.025, // 2.5% for post-1987
      method: 'PRIME_COST',
      notes: 'Capital works deduction at 2.5% over 40 years',
    },
  });

  // DIV40 Plant & Equipment
  await prisma.depreciationSchedule.upsert({
    where: { id: '66666666-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '66666666-0000-0000-0000-000000000002',
      propertyId: investmentProperty.id,
      category: 'DIV40',
      assetName: 'Carpet & Floor Coverings',
      cost: 8000,
      startDate: new Date('2021-06-01'),
      rate: 0.125, // 8-year effective life = 12.5%
      method: 'DIMINISHING_VALUE',
    },
  });

  await prisma.depreciationSchedule.upsert({
    where: { id: '66666666-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '66666666-0000-0000-0000-000000000003',
      propertyId: investmentProperty.id,
      category: 'DIV40',
      assetName: 'Air Conditioning System',
      cost: 6500,
      startDate: new Date('2021-06-01'),
      rate: 0.1, // 10-year life = 10%
      method: 'PRIME_COST',
    },
  });

  await prisma.depreciationSchedule.upsert({
    where: { id: '66666666-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '66666666-0000-0000-0000-000000000004',
      propertyId: investmentProperty.id,
      category: 'DIV40',
      assetName: 'Hot Water System',
      cost: 2500,
      startDate: new Date('2021-06-01'),
      rate: 0.1, // 10-year life
      method: 'PRIME_COST',
    },
  });

  // ==========================================================================
  // INVESTMENT ACCOUNTS
  // ==========================================================================

  const brokerageAccount = await prisma.investmentAccount.upsert({
    where: { id: '77777777-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '77777777-0000-0000-0000-000000000001',
      userId: userA.id,
      name: 'SelfWealth Brokerage',
      type: 'BROKERAGE',
      platform: 'SelfWealth',
      currency: 'AUD',
    },
  });

  // VAS - Vanguard Australian Shares ETF
  const vasHolding = await prisma.investmentHolding.upsert({
    where: { id: '88888888-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '88888888-0000-0000-0000-000000000001',
      investmentAccountId: brokerageAccount.id,
      ticker: 'VAS',
      units: 450,
      averagePrice: 85.50, // Avg cost $85.50
      frankingPercentage: 0.80, // 80% franked
      type: 'ETF',
    },
  });

  // VGS - Vanguard International Shares
  const vgsHolding = await prisma.investmentHolding.upsert({
    where: { id: '88888888-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '88888888-0000-0000-0000-000000000002',
      investmentAccountId: brokerageAccount.id,
      ticker: 'VGS',
      units: 280,
      averagePrice: 105.20,
      frankingPercentage: 0, // International = no franking
      type: 'ETF',
    },
  });

  // Investment transactions
  // VAS purchases
  await prisma.investmentTransaction.upsert({
    where: { id: '99999999-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '99999999-0000-0000-0000-000000000001',
      investmentAccountId: brokerageAccount.id,
      holdingId: vasHolding.id,
      date: new Date('2022-03-15'),
      type: 'BUY',
      price: 82.00,
      units: 200,
      fees: 9.50,
    },
  });

  await prisma.investmentTransaction.upsert({
    where: { id: '99999999-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '99999999-0000-0000-0000-000000000002',
      investmentAccountId: brokerageAccount.id,
      holdingId: vasHolding.id,
      date: new Date('2023-06-20'),
      type: 'BUY',
      price: 88.50,
      units: 250,
      fees: 9.50,
    },
  });

  // VAS dividend
  await prisma.investmentTransaction.upsert({
    where: { id: '99999999-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '99999999-0000-0000-0000-000000000003',
      investmentAccountId: brokerageAccount.id,
      holdingId: vasHolding.id,
      date: new Date('2024-03-15'),
      type: 'DIVIDEND',
      price: 0.85, // $0.85 per unit
      units: 450,
      fees: 0,
    },
  });

  // VGS purchases
  await prisma.investmentTransaction.upsert({
    where: { id: '99999999-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '99999999-0000-0000-0000-000000000004',
      investmentAccountId: brokerageAccount.id,
      holdingId: vgsHolding.id,
      date: new Date('2022-08-10'),
      type: 'BUY',
      price: 98.00,
      units: 150,
      fees: 9.50,
    },
  });

  await prisma.investmentTransaction.upsert({
    where: { id: '99999999-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '99999999-0000-0000-0000-000000000005',
      investmentAccountId: brokerageAccount.id,
      holdingId: vgsHolding.id,
      date: new Date('2024-01-08'),
      type: 'BUY',
      price: 113.50,
      units: 130,
      fees: 9.50,
    },
  });

  console.log('Portfolio A seeded successfully!');

  return {
    userId: userA.id,
    propertyIds: [homeProperty.id, investmentProperty.id],
    loanIds: [homeLoan.id, investmentLoan.id],
    accountIds: [offsetAccount.id, savingsAccount.id, transactionAccount.id],
  };
}

// =============================================================================
// PORTFOLIO B: EDGE-CASE PORTFOLIO
// =============================================================================
// Complex scenarios:
// - Multiple loans on same property (split loan)
// - Fixed rate loan with cap
// - Credit card debt
// - Pre-CGT assets
// - High LVR
// - Negative gearing
// - Super contributions

async function seedPortfolioB() {
  console.log('Seeding Portfolio B (Edge-case)...');

  const userB = await prisma.user.upsert({
    where: { id: TEST_USER_B_ID },
    update: {},
    create: {
      id: TEST_USER_B_ID,
      email: 'test-user-b@monitrax.test',
      name: 'Test User B',
      password: '$2b$10$hash',
      role: 'OWNER',
      emailVerified: true,
    },
  });

  // Investment property (high LVR, negatively geared)
  const propertyB = await prisma.property.upsert({
    where: { id: 'B1111111-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B1111111-0000-0000-0000-000000000001',
      userId: userB.id,
      name: 'High LVR Investment - Brisbane',
      type: 'INVESTMENT',
      address: '789 Edge Case St, Brisbane QLD 4000',
      purchasePrice: 480000,
      purchaseDate: new Date('2023-09-01'),
      currentValue: 460000, // Underwater!
      valuationDate: new Date('2024-06-01'),
    },
  });

  // Offset account for split loan
  const offsetB = await prisma.account.upsert({
    where: { id: 'B2222222-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B2222222-0000-0000-0000-000000000001',
      userId: userB.id,
      name: 'Investment Offset',
      type: 'OFFSET',
      institution: 'Macquarie',
      currentBalance: 12000,
    },
  });

  // Credit card (to test credit card handling)
  const creditCard = await prisma.account.upsert({
    where: { id: 'B2222222-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'B2222222-0000-0000-0000-000000000002',
      userId: userB.id,
      name: 'Credit Card',
      type: 'CREDIT_CARD',
      institution: 'ANZ',
      currentBalance: -8500, // Negative = owing
      interestRate: 0.2199, // 21.99%
    },
  });

  // Split loan - Variable portion with offset
  const loanVariable = await prisma.loan.upsert({
    where: { id: 'B3333333-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B3333333-0000-0000-0000-000000000001',
      userId: userB.id,
      propertyId: propertyB.id,
      offsetAccountId: offsetB.id,
      name: 'Split Loan - Variable',
      type: 'INVESTMENT',
      principal: 250000,
      interestRateAnnual: 0.0695,
      rateType: 'VARIABLE',
      isInterestOnly: true,
      termMonthsRemaining: 48,
      minRepayment: 1448,
      repaymentFrequency: 'MONTHLY',
    },
  });

  // Split loan - Fixed portion with extra repayment cap
  const loanFixed = await prisma.loan.upsert({
    where: { id: 'B3333333-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'B3333333-0000-0000-0000-000000000002',
      userId: userB.id,
      propertyId: propertyB.id,
      name: 'Split Loan - Fixed',
      type: 'INVESTMENT',
      principal: 180000,
      interestRateAnnual: 0.0589, // Lower fixed rate
      rateType: 'FIXED',
      fixedExpiry: new Date('2026-09-01'), // 2 years fixed
      isInterestOnly: false,
      termMonthsRemaining: 360,
      minRepayment: 1067,
      repaymentFrequency: 'MONTHLY',
      extraRepaymentCap: 10000, // $10k annual cap
    },
  });

  // Low salary (edge case for negative gearing)
  await prisma.income.upsert({
    where: { id: 'B4444444-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B4444444-0000-0000-0000-000000000001',
      userId: userB.id,
      name: 'Part-time Salary',
      type: 'SALARY',
      sourceType: 'GENERAL',
      amount: 3200, // $3,200/month = $38.4k/year
      frequency: 'MONTHLY',
      isTaxable: true,
    },
  });

  // Low rental income (negatively geared)
  await prisma.income.upsert({
    where: { id: 'B4444444-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'B4444444-0000-0000-0000-000000000002',
      userId: userB.id,
      propertyId: propertyB.id,
      name: 'Brisbane Rental',
      type: 'RENTAL',
      sourceType: 'PROPERTY',
      amount: 380, // $380/week - low yield
      frequency: 'WEEKLY',
      isTaxable: true,
    },
  });

  // High expenses creating negative gearing
  await prisma.expense.upsert({
    where: { id: 'B5555555-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B5555555-0000-0000-0000-000000000001',
      userId: userB.id,
      loanId: loanVariable.id,
      propertyId: propertyB.id,
      name: 'Variable Loan Interest',
      category: 'LOAN_INTEREST',
      sourceType: 'LOAN',
      amount: 1379, // After offset: (250k-12k) * 6.95% / 12
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  await prisma.expense.upsert({
    where: { id: 'B5555555-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'B5555555-0000-0000-0000-000000000002',
      userId: userB.id,
      loanId: loanFixed.id,
      propertyId: propertyB.id,
      name: 'Fixed Loan Interest',
      category: 'LOAN_INTEREST',
      sourceType: 'LOAN',
      amount: 884, // $180k * 5.89% / 12
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Strata for unit
  await prisma.expense.upsert({
    where: { id: 'B5555555-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: 'B5555555-0000-0000-0000-000000000003',
      userId: userB.id,
      propertyId: propertyB.id,
      name: 'Body Corporate',
      category: 'STRATA',
      sourceType: 'PROPERTY',
      amount: 850, // $850/month - high strata
      frequency: 'MONTHLY',
      isEssential: true,
      isTaxDeductible: true,
    },
  });

  // Investment account with pre-CGT asset
  const superAccount = await prisma.investmentAccount.upsert({
    where: { id: 'B7777777-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B7777777-0000-0000-0000-000000000001',
      userId: userB.id,
      name: 'Industry Super',
      type: 'SUPERS',
      platform: 'AustralianSuper',
      currency: 'AUD',
    },
  });

  // Crypto holding (volatile)
  const brokerageB = await prisma.investmentAccount.upsert({
    where: { id: 'B7777777-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'B7777777-0000-0000-0000-000000000002',
      userId: userB.id,
      name: 'Crypto Wallet',
      type: 'ETF_CRYPTO',
      platform: 'CoinSpot',
      currency: 'AUD',
    },
  });

  await prisma.investmentHolding.upsert({
    where: { id: 'B8888888-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'B8888888-0000-0000-0000-000000000001',
      investmentAccountId: brokerageB.id,
      ticker: 'BTC',
      units: 0.15,
      averagePrice: 45000, // Bought at $45k avg
      type: 'CRYPTO',
    },
  });

  console.log('Portfolio B seeded successfully!');

  return {
    userId: userB.id,
    propertyIds: [propertyB.id],
    loanIds: [loanVariable.id, loanFixed.id],
    accountIds: [offsetB.id, creditCard.id],
  };
}

// =============================================================================
// EXPECTED CALCULATIONS (GOLDEN VALUES)
// =============================================================================

export const GOLDEN_VALUES = {
  portfolioA: {
    // Net Worth = Assets - Liabilities
    // Assets: Home $950k + Investment $620k + Offset $45k + Savings $25k + Transaction $5k + Investments
    // Investments: VAS 450 * $90 (current) = $40,500 + VGS 280 * $115 = $32,200 = $72,700
    // Total Assets: 950000 + 620000 + 45000 + 25000 + 5000 + 72700 = $1,717,700
    // Liabilities: Home Loan $520k + Investment Loan $440k = $960,000
    // Net Worth: $1,717,700 - $960,000 = $757,700
    netWorth: 757700,
    totalAssets: 1717700,
    totalLiabilities: 960000,

    // Home Loan LVR: $520k / $950k = 54.74%
    homeLoanLVR: 0.5474,
    // Investment Loan LVR: $440k / $620k = 70.97%
    investmentLoanLVR: 0.7097,

    // Effective principal with offset: $520k - $45k = $475k
    effectivePrincipal: 475000,

    // Monthly interest on home loan: $475k * 6.25% / 12 = $2,474
    homeMonthlyInterest: 2474,

    // Rental yield: ($550 * 52) / $620,000 = 4.61%
    rentalYield: 0.0461,

    // Annual rental income: $550 * 52 = $28,600
    annualRentalIncome: 28600,

    // Investment property cashflow:
    // Income: $28,600
    // Expenses: Interest $30,144 + Rates $1,800 + Insurance $1,600 + Strata $7,800 + Management $7,436 = $48,780
    // Annual property cashflow: $28,600 - $48,780 = -$20,180 (negative gearing)
    propertyAnnualCashflow: -20180,

    // Total annual income: Salary $90k + Partner $66k + Rental $28,600 = $184,600
    totalAnnualIncome: 184600,

    // Annual depreciation (investment property):
    // DIV43: $350,000 * 2.5% = $8,750
    // DIV40: Carpet $8k * 25% (DV year 1) = $2,000, AC $6.5k * 10% = $650, HWS $2.5k * 10% = $250
    // Total depreciation: $8,750 + $2,000 + $650 + $250 = $11,650
    annualDepreciation: 11650,

    // Investment portfolio value
    // VAS: 450 * $90 = $40,500
    // VGS: 280 * $115 = $32,200
    // Total: $72,700
    investmentValue: 72700,

    // VAS cost base: (200 * $82) + (250 * $88.50) = $16,400 + $22,125 = $38,525
    // Average cost: $38,525 / 450 = $85.61
    vasAverageCost: 85.61,
    vasCostBase: 38525,

    // Unrealised gain VAS: (450 * $90) - $38,525 = $40,500 - $38,525 = $1,975
    vasUnrealisedGain: 1975,

    // Franking credit on VAS dividend: $0.85 * 450 * (0.80 / (1 - 0.30)) * 0.30 = $130.71
    // Wait, let me recalc: Dividend = $0.85 * 450 = $382.50
    // Franking credit = $382.50 * (0.80 * 0.30 / 0.70) = $382.50 * 0.343 = $131.20
    vasFrankingCredit: 131.20,
  },

  portfolioB: {
    // Net Worth = Assets - Liabilities
    // Assets: Property $460k + Offset $12k = $472k (ignoring crypto for simplicity)
    // Liabilities: Variable $250k + Fixed $180k + Credit Card $8,500 = $438,500
    // Net Worth: $472,000 - $438,500 = $33,500
    netWorth: 33500,

    // Combined LVR: ($250k + $180k) / $460k = 93.48% - HIGH RISK
    combinedLVR: 0.9348,

    // Property is underwater: $460k value vs $480k purchase
    isUnderwater: true,
    paperLoss: 20000,

    // Annual rental: $380 * 52 = $19,760
    annualRentalIncome: 19760,

    // Effective variable principal: $250k - $12k offset = $238k
    effectiveVariablePrincipal: 238000,

    // Variable interest: $238k * 6.95% / 12 = $1,378.59
    variableMonthlyInterest: 1378.59,

    // Fixed interest: $180k * 5.89% / 12 = $883.50
    fixedMonthlyInterest: 883.50,

    // Total annual interest: ($1,378.59 + $883.50) * 12 = $27,145
    totalAnnualInterest: 27145,

    // Annual expenses: Interest $27,145 + Strata $10,200 = $37,345
    annualPropertyExpenses: 37345,

    // Negative gearing loss: $19,760 - $37,345 = -$17,585
    negativeGearingLoss: 17585,

    // Credit card monthly interest: $8,500 * 21.99% / 12 = $155.76
    creditCardMonthlyInterest: 155.76,
  },
};

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log('Starting validation seed...');
  console.log('================================');

  try {
    // Clean up existing test data
    console.log('Cleaning up existing test data...');
    await prisma.investmentTransaction.deleteMany({
      where: {
        investmentAccount: {
          userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] },
        },
      },
    });
    await prisma.investmentHolding.deleteMany({
      where: {
        investmentAccount: {
          userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] },
        },
      },
    });
    await prisma.investmentAccount.deleteMany({
      where: { userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });
    await prisma.depreciationSchedule.deleteMany({
      where: {
        property: {
          userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] },
        },
      },
    });
    await prisma.expense.deleteMany({
      where: { userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });
    await prisma.income.deleteMany({
      where: { userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });
    await prisma.loan.deleteMany({
      where: { userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });
    await prisma.account.deleteMany({
      where: { userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });
    await prisma.property.deleteMany({
      where: { userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_A_ID, TEST_USER_B_ID] } },
    });

    // Seed portfolios
    const portfolioA = await seedPortfolioA();
    const portfolioB = await seedPortfolioB();

    console.log('================================');
    console.log('Validation seed complete!');
    console.log('');
    console.log('Test Users:');
    console.log(`  Portfolio A: ${TEST_USER_A_ID}`);
    console.log(`  Portfolio B: ${TEST_USER_B_ID}`);
    console.log('');
    console.log('Run tests with: npm run test:validation');

    return { portfolioA, portfolioB, goldenValues: GOLDEN_VALUES };
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { main as seedValidation, TEST_USER_A_ID, TEST_USER_B_ID };
