/**
 * Help Center — tooltip dictionary.
 *
 * Phase 33j (2026-05-09): centralised definitions for the inline `<HelpTooltip term="...">`
 * primitive. SINGLE source of truth per CLAUDE.md §12.2 — reviewers reject
 * PRs that add inline definitions outside this file.
 *
 * Structure:
 *   - `term` (key) is a stable kebab-case slug. Never rename — it's a
 *     contract with every wire-up site. Add a new term, deprecate the old
 *     one if needed.
 *   - `title` is the field/concept name as it appears in the popover header.
 *   - `body` is the one-paragraph definition (≤ 50 words). Plain language.
 *     Markdown is NOT rendered — keep it text-only for tooltip simplicity.
 *   - `source` (optional) is an external authority URL — ATO / ASIC /
 *     SIS Act / similar. Required for finance terms; lets the user verify.
 *   - `learnMoreSlug` (optional) is the path to a longer help article
 *     when one exists. Renders as "Learn more →" in the popover footer.
 *
 * Usage:
 *   <HelpTooltip term="lvr" />                                   // info icon next to a label
 *   <HelpTooltip term="lvr" inline>Loan-to-value ratio</HelpTooltip>  // wraps the label
 *
 * Adding a new term:
 *   1. Add the entry below (keep alphabetical within section).
 *   2. Append the slug to docs/blueprint/HELP_COVERAGE_MAP.md inventory.
 *   3. Wire <HelpTooltip term="..." /> in the surface(s) that need it.
 *
 * Source-cite policy (finance terms): if the regulator publishes a
 * canonical URL (ATO Quick Code, SIS Act section, ASIC INFO sheet),
 * use it. Avoid linking to articles that paraphrase regulators —
 * cite the regulator directly.
 */

export interface TooltipDefinition {
  title: string;
  body: string;
  source?: { label: string; url: string };
  learnMoreSlug?: string;
}

export const TOOLTIPS: Record<string, TooltipDefinition> = {
  // ===========================================================================
  // FINANCE — Property
  // ===========================================================================
  lvr: {
    title: 'LVR (loan-to-value ratio)',
    body:
      'The loan balance divided by the property value, expressed as a percentage. Lenders typically charge LMI above 80%; most cap lending at 90%.',
    source: {
      label: 'ASIC Moneysmart — Loan-to-value ratio',
      url: 'https://moneysmart.gov.au/home-loans',
    },
    learnMoreSlug: 'consumer/adding-properties',
  },
  equity: {
    title: 'Equity',
    body:
      'The portion of a property you own outright — estimated value minus the loan balance plus any offset balance.',
    learnMoreSlug: 'consumer/adding-properties',
  },
  'rental-yield': {
    title: 'Rental yield',
    body:
      'The annual rental income divided by the property value, as a percentage. Gross is before costs; net subtracts expenses + interest.',
    source: {
      label: 'ATO — Rental properties',
      url: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/residential-rental-properties',
    },
    learnMoreSlug: 'consumer/adding-properties',
  },
  'effective-principal': {
    title: 'Effective principal',
    body:
      'The loan balance minus your offset balance — the amount interest is actually charged on. Reducing offset reduces interest, not repayment.',
    learnMoreSlug: 'consumer/managing-accounts-and-loans',
  },
  'offset-account': {
    title: 'Offset account',
    body:
      'A transaction account linked to a loan. Its balance reduces the loan principal interest is calculated on. Funds remain accessible.',
    source: {
      label: 'ASIC Moneysmart — Offset accounts',
      url: 'https://moneysmart.gov.au/home-loans/mortgage-offset-accounts',
    },
    learnMoreSlug: 'consumer/managing-accounts-and-loans',
  },
  ppr: {
    title: 'PPR (principal place of residence)',
    body:
      'The home you live in. PPRs receive specific tax treatment (CGT main-residence exemption) different from investment properties.',
    source: {
      label: 'ATO — Main residence exemption',
      url: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/your-main-residence',
    },
    learnMoreSlug: 'consumer/adding-properties',
  },
  'negative-gearing': {
    title: 'Negative gearing',
    body:
      'When deductible expenses (interest, depreciation, costs) exceed rental income on an investment property, producing a loss. The loss can offset other taxable income.',
    source: {
      label: 'ATO — Rental property income and expenses',
      url: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/residential-rental-properties',
    },
    learnMoreSlug: 'consumer/your-tax-position',
  },

  // ===========================================================================
  // FINANCE — Super
  // ===========================================================================
  'concessional-cap': {
    title: 'Concessional contributions cap',
    body:
      'The annual cap on pre-tax super contributions (employer SG + salary sacrifice + personal deductible). FY24-25 cap: $30,000. Excess is taxed at marginal rates.',
    source: {
      label: 'ATO — Concessional contributions cap',
      url: 'https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-limits-and-tax-on-super-contributions',
    },
    learnMoreSlug: 'consumer/your-tax-position',
  },
  'non-concessional-cap': {
    title: 'Non-concessional contributions cap',
    body:
      'The annual cap on after-tax super contributions. FY24-25 cap: $120,000. Bring-forward arrangements may allow up to 3 years contributed in one.',
    source: {
      label: 'ATO — Non-concessional contributions cap',
      url: 'https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-limits-and-tax-on-super-contributions',
    },
  },
  'superannuation-guarantee': {
    title: 'Superannuation Guarantee (SG)',
    body:
      'The minimum percentage of your ordinary time earnings your employer must contribute to your super. FY24-25 rate: 11.5%. Rises to 12% from 1 July 2025.',
    source: {
      label: 'ATO — SG contributions',
      url: 'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/paying-super-contributions',
    },
  },
  'division-293': {
    title: 'Division 293 tax',
    body:
      'An extra 15% tax on concessional super contributions for individuals with combined income + low-tax contributions over $250,000. Total tax becomes 30% on the affected portion.',
    source: {
      label: 'ATO — Division 293 tax',
      url: 'https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/division-293-tax-information-for-individuals',
    },
  },
  'division-296': {
    title: 'Division 296 tax (proposed)',
    body:
      'Proposed extra 15% tax on earnings from super balances above $3 million. Not yet legislated as of 2026-05; treat as forward-looking.',
    source: {
      label: 'Treasury — Better Targeted Superannuation Concessions',
      url: 'https://treasury.gov.au/consultation/c2023-432155',
    },
  },
  'transfer-balance-cap': {
    title: 'Transfer Balance Cap (TBC)',
    body:
      'The maximum super balance you can transfer into a tax-free retirement-phase pension. FY24-25 personal cap: $1.9 million.',
    source: {
      label: 'ATO — Transfer balance cap',
      url: 'https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/transfer-balance-cap',
    },
  },
  tbar: {
    title: 'TBAR (Transfer Balance Account Report)',
    body:
      'The form SMSF trustees lodge to report events affecting members\' transfer balance accounts (pension starts, commutations, etc.).',
    source: {
      label: 'ATO — TBAR for SMSFs',
      url: 'https://www.ato.gov.au/tax-and-super-professionals/for-superannuation-professionals/apra-regulated-funds/reporting-and-lodging/event-based-reporting',
    },
  },
  'sole-purpose-test': {
    title: 'Sole purpose test',
    body:
      'SMSF rule (SIS Act s62) requiring the fund be maintained solely for retirement benefits. Investment decisions failing this test breach the regulations.',
    source: {
      label: 'ATO — Sole purpose test',
      url: 'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/managing-an-smsf/investing/sole-purpose-test',
    },
  },
  'in-house-asset-cap': {
    title: 'In-house asset 5% cap',
    body:
      'SMSF rule (SIS Act s71) limiting investments in related-party assets to 5% of total fund value at end of FY. Breaches require divestment.',
    source: {
      label: 'ATO — In-house assets',
      url: 'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/managing-an-smsf/investing/in-house-assets',
    },
  },
  lrba: {
    title: 'LRBA (Limited Recourse Borrowing Arrangement)',
    body:
      'The compliant structure for SMSFs to borrow to acquire a single asset. Lender recourse limited to the acquired asset; arm\'s-length terms required.',
    source: {
      label: 'ATO — LRBAs (PCG 2016/5)',
      url: 'https://www.ato.gov.au/law/view/document?docid=COG/PCG20165/NAT/ATO/00001',
    },
  },

  // ===========================================================================
  // FINANCE — Tax
  // ===========================================================================
  'cgt-discount': {
    title: 'CGT discount',
    body:
      'A 50% discount on capital gains for individuals + trusts holding the asset >12 months (ITAA 1997 Div 115). Companies don\'t get the discount.',
    source: {
      label: 'ATO — CGT discount (Div 115)',
      url: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/working-out-your-capital-gain-or-loss/the-cgt-discount',
    },
  },
  'franking-credit': {
    title: 'Franking credit',
    body:
      'Tax already paid by an Australian company on dividends. Holders gross up the dividend by the credit + claim it as an offset against their tax (ITAA 1997 Div 207).',
    source: {
      label: 'ATO — Franking credits',
      url: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/investing-in-shares/dividends/dividends-and-franking-credits',
    },
  },
  'division-7a-loan': {
    title: 'Division 7A loan',
    body:
      'A private company loan to a shareholder or associate that, without compliant treatment, is taxed as an unfranked dividend. Requires a written compliant loan agreement.',
    source: {
      label: 'ATO — Division 7A',
      url: 'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/in-detail/division-7a',
    },
  },
  'medicare-levy': {
    title: 'Medicare Levy',
    body:
      '2% of taxable income paid in addition to income tax (Health Insurance Levy Act 1982). Reductions/exemptions apply at lower income thresholds.',
    source: {
      label: 'ATO — Medicare levy',
      url: 'https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy',
    },
  },
  'lito-sapto': {
    title: 'LITO / SAPTO',
    body:
      'Low Income Tax Offset (LITO) reduces tax for incomes <$66,667. Senior and Pensioners Tax Offset (SAPTO) reduces tax for eligible seniors. Both calculated automatically.',
    source: {
      label: 'ATO — Tax offsets',
      url: 'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/offsets-and-rebates',
    },
  },

  // ===========================================================================
  // MONITRAX-SPECIFIC
  // ===========================================================================
  'entity-role': {
    title: 'Entity role',
    body:
      'What an entity does in your structure: PERSONAL (your name), HOLDING (Pty Ltd / trust holding investments), OPERATING (Pty Ltd doing business), SUPERANNUATION (SMSF), INVESTMENT (Unit Trust).',
    learnMoreSlug: 'consumer/my-structure',
  },
  'entity-type': {
    title: 'Entity type',
    body:
      'The legal form of an entity: PERSONAL_NAME, COMPANY (Pty Ltd), DISCRETIONARY_TRUST, UNIT_TRUST, SMSF, PARTNERSHIP, SOLE_TRADER. Drives tax treatment.',
    learnMoreSlug: 'consumer/my-structure',
  },
  'trail-stage': {
    title: 'TRAIL stage',
    body:
      'Your current stage on the TRAIL framework: Track → Reduce → Anchor → Invest → Live. Computed from your data; updates as your situation changes.',
    learnMoreSlug: 'consumer/what-is-trail',
  },
  'health-score': {
    title: 'Financial health score',
    body:
      'Composite indicator (0–100) summarising emergency fund coverage, debt position, savings rate, diversification, and TRAIL stage. Higher = healthier.',
  },
  'ownership-scope': {
    title: 'Ownership scope',
    body:
      'When linked to a professional, the data slices you\'ve granted them: LOANS / PROPERTIES / INVESTMENTS / TAX / FINANCIAL / FULL. Configurable per-professional.',
  },
  audience: {
    title: 'Audience (help)',
    body:
      'Who a help article is written for: consumer (you), org-admin (firm operator), org-professional (adviser), org-client (you, when org-attached), compliance (auditor).',
  },
  'surface-tag': {
    title: 'Surface tag (feedback)',
    body:
      'What kind of feedback you\'re sending: BUG (broken), FEATURE (wishlist), UX (friction), PRAISE (positive), QUESTION (genuine ask), COMPLIANCE (CDR/AFSL/TPB concern).',
    learnMoreSlug: 'org-professional/sending-feedback',
  },
  'consent-status': {
    title: 'CDR consent status',
    body:
      'Where a Consumer Data Right consent sits: ACTIVE (data flowing), EXPIRED (lapsed), REVOKED (you cancelled), DELETED (data purged). View at Settings → Security → CDR consents.',
    learnMoreSlug: 'compliance/cdr-consent-walkthrough',
  },
};

/**
 * Lookup helper. Returns `null` for unknown terms — caller should treat as
 * "no tooltip" (don't render the affordance) rather than throw.
 */
export function getTooltip(term: string): TooltipDefinition | null {
  return TOOLTIPS[term] ?? null;
}

/**
 * All term keys — useful for the coverage-map verification in
 * `docs/blueprint/HELP_COVERAGE_MAP.md`.
 */
export const TOOLTIP_TERMS = Object.keys(TOOLTIPS);
