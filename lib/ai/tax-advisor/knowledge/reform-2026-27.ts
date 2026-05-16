/**
 * Phase 41E.2 — AI advisor knowledge pack for the 12 May 2026 Budget reform.
 *
 * Versioned facts the AI advisor narrates from. Per CLAUDE.md §12.14 FW-4
 * + HR-2: every claim the AI makes about the AU tax reform MUST trace
 * back to an entry in this pack — never the LLM's memory.
 *
 * Status field on every entry tracks the rule's regulatory maturity:
 *   - `'announced'` — Budget night announcement only (12 May 2026); no
 *     exposure draft yet. Default for most measures at Phase 41E ship time.
 *   - `'exposure-draft'` — Treasury has published the exposure draft.
 *     The rule mechanic is code-readable; still pre-Bill. (M4 currently.)
 *   - `'bill'` — Bill introduced to Parliament. Final text TBC pending passage.
 *   - `'assented'` — Royal Assent received. Rule is law; the matching
 *     `commencementVerified` flag in `taxYearConfig.ts` can flip to true
 *     (only after the corresponding Stage 2 mechanic is shipped).
 *
 * **When the status moves from `'announced'` → `'exposure-draft'` etc.**,
 * the operator updates the entry in this file + the matching
 * `lastReviewed` date. The pack is the single source of truth for the
 * AI advisor's narration of reform status — no other file may hard-code
 * a status string (CLAUDE.md §12.14 FW-4).
 *
 * See `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10 + §10.10 (the
 * AI advisor summary surface).
 */

import type { ReformMeasure } from '@/lib/tax-engine/config/reformConstants';

/**
 * Regulatory maturity status. Closed discriminant — every consumer
 * must handle every variant. Pre-`assented`, the AI surfaces the
 * status to the user so they see the rule's maturity.
 */
export type ReformStatus = 'announced' | 'exposure-draft' | 'bill' | 'assented';

/**
 * A single knowledge entry for a reform measure. Built at module load
 * time + immutable at runtime. Updated only by editing this file.
 */
export interface ReformKnowledgeEntry {
  /** The measure this entry describes. */
  measure: ReformMeasure;
  /** Short human-readable title — surfaced in the AI's narrative. */
  title: string;
  /**
   * 1-2 sentence plain-English summary of WHAT the measure does. Read
   * verbatim by the AI's narrator (HR-2 enforcement — must come from
   * this entry, never the LLM). Warm-words framing (CLAUDE.md §14).
   */
  summary: string;
  /** Current regulatory maturity. */
  status: ReformStatus;
  /**
   * Plain-English commencement description, e.g. "Commences 1 July 2027
   * (start of FY 2027-28)". The hard date lives on `MEASURE_COMMENCEMENT`
   * in `reformConstants.ts` — this string is for narration only.
   */
  commencementText: string;
  /**
   * Plain-English grandfathering description, e.g. "Assets contracted
   * at or before 7:30pm AEST 12 May 2026 are grandfathered under the
   * pre-reform rules indefinitely." Empty string for measures with no
   * grandfathering (M3, M5, M6-9).
   */
  grandfatheringText: string;
  /**
   * 1-2 sentence plain-English description of WHAT CHANGES for the
   * user. Used by the AI advisor's narrative. Calm framing per Reza's
   * 5-point confirmation 2026-05-16 — lead with "you're already
   * protected" where grandfathering applies.
   */
  userImpactText: string;
  /**
   * Authoritative URLs the AI cites. ATO + Treasury + Budget primary
   * sources. The AI MUST NOT cite anything not in this list (HR-2).
   */
  citations: ReadonlyArray<{
    label: string;
    url: string;
  }>;
  /** ISO date the entry was last reviewed against the live source. */
  lastReviewed: string;
}

const CUT_OVER_LABEL = '7:30pm AEST 12 May 2026';

/**
 * The complete knowledge pack — one entry per measure. **All entries
 * default to `'announced'`** at Phase 41E ship time (PR #765, 16 May 2026)
 * EXCEPT Measure 4 which has an exposure draft published 10 April 2026.
 *
 * Operators MUST update an entry's `status` (+ `lastReviewed`) when:
 *   - Treasury publishes the exposure draft → `'exposure-draft'`
 *   - The Bill is introduced to Parliament → `'bill'`
 *   - Royal Assent received → `'assented'`
 *
 * Code reviewers MUST verify the matching `commencementVerified` flag
 * in `taxYearConfig.ts` is also flipped + the Stage 2 mechanic shipped
 * when an entry moves to `'assented'`. Never move to `'assented'`
 * alone — that would leave the AI narrating "rule is in force" while
 * the engine still returns UNCOMPUTED. CLAUDE.md §12.14 FW-2.
 */
export const REFORM_KNOWLEDGE_PACK: Record<ReformMeasure, ReformKnowledgeEntry> = {
  NEGATIVE_GEARING_NEW_BUILDS_ONLY: {
    measure: 'NEGATIVE_GEARING_NEW_BUILDS_ONLY',
    title: 'Negative gearing restricted to new builds',
    summary:
      'For residential investment properties, the cost of negative gearing (loss against other income) will be available only for newly built homes acquired after 12 May 2026.',
    status: 'announced',
    commencementText: 'Commences 1 July 2027 (start of FY 2027-28).',
    grandfatheringText: `Residential properties where the **contract** was signed at or before ${CUT_OVER_LABEL} are grandfathered under the pre-reform rules indefinitely — negative gearing continues to offset other income for the life of your ownership.`,
    userImpactText:
      'If you bought your residential investment property before 12 May 2026 7:30pm AEST, nothing changes for your negative gearing. For properties you might acquire from now on, negative gearing will only apply if the property qualifies as a new build (off-the-plan, never sold, builder-first-owner under 12 months, vacant-land build, or demolition+rebuild with net-additional dwellings).',
    citations: [
      {
        label: 'ATO — Tax reform: Reforming negative gearing and CGT',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/individuals/tax-reform-boosting-home-ownership-reforming-negative-gearing-and-capital-gains-tax',
      },
      {
        label: 'Treasury fact sheet — Negative gearing + CGT reform',
        url: 'https://budget.gov.au/content/factsheets/download/tax-explainers-negative-gearing-capital-gains-tax.pdf',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  CGT_INDEXATION_PLUS_MIN_RATE: {
    measure: 'CGT_INDEXATION_PLUS_MIN_RATE',
    title: '50% CGT discount replaced with cost-base indexation + 30% minimum rate',
    summary:
      'For CGT events on or after 1 July 2027, the 50% capital-gains discount is replaced with cost-base indexation (against the CPI) plus a 30% minimum effective tax rate on the indexed gain.',
    status: 'announced',
    commencementText: 'Commences 1 July 2027 (start of FY 2027-28).',
    grandfatheringText: `Assets where the acquisition **contract** was signed at or before ${CUT_OVER_LABEL} keep the 50% discount even on disposals after 1 July 2027.`,
    userImpactText:
      'For investments (property, shares, units) you already own and contracted before 12 May 2026 7:30pm AEST, the 50% discount still applies when you sell — even years from now. For investments you acquire from now on, disposals from 1 July 2027 will use the new indexation + 30% floor formula.',
    citations: [
      {
        label: 'ATO — Tax reform: Reforming negative gearing and CGT',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/individuals/tax-reform-boosting-home-ownership-reforming-negative-gearing-and-capital-gains-tax',
      },
      {
        label: 'Treasury fact sheet — Negative gearing + CGT reform',
        url: 'https://budget.gov.au/content/factsheets/download/tax-explainers-negative-gearing-capital-gains-tax.pdf',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  TRUST_MINIMUM_TAX: {
    measure: 'TRUST_MINIMUM_TAX',
    title: '30% minimum tax on discretionary-trust taxable income',
    summary:
      'Discretionary trusts will pay a 30% minimum tax on their taxable income from FY 2028-29 onwards. Fixed, unit, widely-held, complying super, charitable, deceased-estate, special-disability, and fixed-testamentary trusts are excluded.',
    status: 'announced',
    commencementText: 'Commences 1 July 2028 (start of FY 2028-29). 3-year rollover-relief window runs 1 July 2027 – 30 June 2030 for restructuring out of discretionary trusts without triggering CGT events.',
    grandfatheringText: '',
    userImpactText:
      'Only DISCRETIONARY (family) trusts are affected — other trust types (fixed, unit, testamentary, charitable) are explicitly excluded. From FY 2028-29, the trust pays the difference between 30% of its taxable income and the actual tax paid by beneficiaries. Non-corporate beneficiaries receive a non-refundable credit; corporate beneficiaries do NOT (this is the integrity feature). The 3-year rollover-relief window lets you restructure the trust into another vehicle with no CGT event during 1 July 2027 – 30 June 2030.',
    citations: [
      {
        label: 'ATO — Tax reform: Minimum tax on discretionary trusts',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/tax-reform-introducing-a-minimum-tax-on-discretionary-trusts',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  FOREIGN_RESIDENT_CGT: {
    measure: 'FOREIGN_RESIDENT_CGT',
    title: 'Foreign-resident CGT regime strengthened',
    summary:
      'Div 855 (foreign-resident CGT) is expanded: broader Taxable Australian Real Property (TARP) definition; 365-day Principal Asset Test (replacing the point-in-time test); >$50M disposal notification to the ATO; 50% concession on qualifying renewable-energy infrastructure to 30 June 2030.',
    status: 'exposure-draft',
    commencementText: 'Commencement date TBC pending Royal Assent. Treasury exposure draft published 10 April 2026; consultation closed 24 April 2026. The expanded TARP definition has retrospective reach to CGT events from 12 December 2006.',
    grandfatheringText: '',
    userImpactText:
      'Only foreign-resident taxpayers (or Australian entities with foreign-resident interests) are affected. The expanded definition catches more interests in Australian real property + mining/quarrying/prospecting rights. The 365-day test stops same-day asset shuffling. Disposals over $50M require 14-day pre-settlement notice to the ATO.',
    citations: [
      {
        label: 'ATO — Strengthening the foreign resident CGT regime',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/strengthening-the-foreign-resident-cgt-regime',
      },
      {
        label: 'Treasury Consultation — Foreign resident CGT (exposure draft)',
        url: 'https://consult.treasury.gov.au/c2026-755475',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  LOSS_REFUNDABILITY: {
    measure: 'LOSS_REFUNDABILITY',
    title: 'Company loss refundability (carry-back + start-up + R&D)',
    summary:
      'Companies with turnover under $1B can elect to carry back current-year losses against tax paid in the prior 2 years and receive a refund (capped at the franking account balance). Start-up loss refundability + R&D Tax Incentive rework follow in FY 2028-29.',
    status: 'announced',
    commencementText: 'Loss carry-back commences this FY (FY 2026-27). Start-up loss refundability + R&DTI rework commence 1 July 2028 (FY 2028-29).',
    grandfatheringText: '',
    userImpactText:
      'If your company has a loss this FY and paid tax in either of the prior 2 years, you can elect to claim a refund. The refund is capped at your franking-account balance. The election is optional — you can also carry the loss forward under the existing rules. Mirrors the 2020-22 COVID-stimulus carry-back mechanic.',
    citations: [
      {
        label: 'ATO — Loss refundability reforms for businesses + start-ups',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/tax-reform-loss-refundability-reforms-for-businesses-and-start-ups',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  FOREIGN_PURCHASE_BAN: {
    measure: 'FOREIGN_PURCHASE_BAN',
    title: 'Foreign-purchase ban on established dwellings extended',
    summary:
      'Foreign residents cannot purchase established (i.e. not new build) residential dwellings. Existing ban extended to 30 June 2029.',
    status: 'assented',
    commencementText: 'Already in force. Extension runs until 30 June 2029.',
    grandfatheringText: '',
    userImpactText:
      'If you are a foreign resident, you can only purchase newly built residential property in Australia, not established homes. The ban runs until at least 30 June 2029. Domestic-resident taxpayers are unaffected.',
    citations: [
      {
        label: 'ATO — Banning foreign purchases of established dwellings',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/international/banning-foreign-purchases-of-established-dwellings',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  VC_CAPS_LIFTED: {
    measure: 'VC_CAPS_LIFTED',
    title: 'Venture-capital incentive caps lifted',
    summary:
      'VCLP investee-asset cap rises from $250M to $480M. ESVCLP investee-asset cap rises from $50M to $80M; total ESVCLP cap rises from $200M to $270M.',
    status: 'announced',
    commencementText: 'Commences 1 July 2027 (FY 2027-28). Applies to both new and existing funds.',
    grandfatheringText: '',
    userImpactText:
      'If you invest in venture-capital limited partnerships (VCLPs) or early-stage venture-capital limited partnerships (ESVCLPs), the larger caps allow these funds to invest in bigger companies + write bigger cheques. This is an industry-side change; the tax treatment of your individual returns from these funds is unchanged.',
    citations: [
      {
        label: 'ATO — Expanding venture capital incentives',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/tax-reform-expanding-venture-capital-incentives',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  EV_FBT_PHASED: {
    measure: 'EV_FBT_PHASED',
    title: 'Electric-car FBT phased transition',
    summary:
      'Phase 1 (full FBT exemption ≤ LCT threshold) ends 31 March 2027. Phase 2 (1 Apr 2027 – 31 Mar 2029): full exemption ≤ $75k value, 25% discount $75k-LCT. Phase 3 (from 1 April 2029): 25% discount only.',
    status: 'announced',
    commencementText: 'Phase 2 commences 1 April 2027. Phase 3 commences 1 April 2029.',
    grandfatheringText: 'EVs novated in Phase 1 retain Phase 1 treatment (full exemption) for the life of the novation arrangement.',
    userImpactText:
      'If you have an EV under a novated lease established before 31 March 2027, your full FBT exemption continues for the life of the novation. For new arrangements from 1 April 2027 onwards, the exemption depends on the vehicle value + the current phase.',
    citations: [
      {
        label: 'ATO — Electric car discount — sustainable FBT treatment',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/electric-car-discount-more-sustainable-fbt-treatment-of-electric-cars',
      },
    ],
    lastReviewed: '2026-05-16',
  },

  DYNAMIC_PAYG: {
    measure: 'DYNAMIC_PAYG',
    title: 'Dynamic PAYG instalments (monthly opt-in)',
    summary:
      'Small + medium businesses can opt into monthly PAYG instalments (versus quarterly), with the instalment amount calculated dynamically by ATO-approved accounting software.',
    status: 'announced',
    commencementText: 'Commences 1 July 2027 (FY 2027-28). Opt-in only.',
    grandfatheringText: '',
    userImpactText:
      'If you run a business and use ATO-approved accounting software, you can opt into monthly PAYG (instead of quarterly) for smoother cashflow. The amount is calculated dynamically from your business activity, not a fixed instalment. The default stays quarterly.',
    citations: [
      {
        label: 'ATO — Dynamic PAYG instalments',
        url: 'https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/dynamic-pay-as-you-go-instalments-making-tax-simpler-for-businesses',
      },
    ],
    lastReviewed: '2026-05-16',
  },
};

/**
 * Helper — get a single entry. Returns the entry or throws if the
 * measure key is invalid (defensive — should never happen given the
 * closed `ReformMeasure` discriminant).
 */
export function getReformKnowledgeEntry(measure: ReformMeasure): ReformKnowledgeEntry {
  const entry = REFORM_KNOWLEDGE_PACK[measure];
  if (!entry) {
    throw new Error(`[Phase 41E.2] Unknown reform measure: ${measure}`);
  }
  return entry;
}

/**
 * Helper — get all entries as an ordered list (M1 → M9). Used by
 * the AI advisor to narrate the full reform summary.
 */
export function getAllReformKnowledgeEntries(): ReadonlyArray<ReformKnowledgeEntry> {
  const ordered: ReformMeasure[] = [
    'NEGATIVE_GEARING_NEW_BUILDS_ONLY',
    'CGT_INDEXATION_PLUS_MIN_RATE',
    'TRUST_MINIMUM_TAX',
    'FOREIGN_RESIDENT_CGT',
    'LOSS_REFUNDABILITY',
    'FOREIGN_PURCHASE_BAN',
    'VC_CAPS_LIFTED',
    'EV_FBT_PHASED',
    'DYNAMIC_PAYG',
  ];
  return ordered.map((m) => REFORM_KNOWLEDGE_PACK[m]);
}

/**
 * Helper — plain-English label for the status enum. Used by the AI
 * advisor's narrator to surface rule maturity ("announced — final
 * law TBC" vs "in force from 1 Jul 2027").
 */
export function getStatusLabel(status: ReformStatus): string {
  switch (status) {
    case 'announced':
      return 'Announced in the 12 May 2026 Federal Budget — final law TBC';
    case 'exposure-draft':
      return 'Exposure draft published by Treasury — pending Bill introduction';
    case 'bill':
      return 'Bill introduced to Parliament — pending Royal Assent';
    case 'assented':
      return 'Royal Assent received — rule is law';
  }
}
