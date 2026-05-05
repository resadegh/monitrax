/**
 * Phase 32C PR4a — Org-side marketplace listing editor.
 *
 * Single-form layout with discipline-conditional fields:
 *   - FINANCIAL_ADVISOR → AFSL number required
 *   - MORTGAGE_BROKER   → Credit rep number required
 *   - TAX_AGENT / ACCOUNTING_FIRM → TPB number required
 *
 * The form is disabled while the listing is `PENDING_REVIEW` — once the
 * Org owner submits, only the admin can move the lifecycle. ADMIN can edit
 * but only OWNER can submit. ADVISOR / VIEWER read-only.
 *
 * Specialisations / target tiers / regions are checkbox groups — multi-
 * select. We chose checkboxes over chip toggles for accessibility (native
 * keyboard semantics, screen-reader friendly) and so the listing surface
 * doesn't accidentally become a touch-only experience.
 */
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { PracticeGlassCard } from '@/components/portal/practice';

// =============================================================================
// SHAPES — kept loose (string[]) so the component doesn't depend on Prisma
// at the client boundary. The server-side route validates against the enums.
// =============================================================================

type ListingStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface ListingState {
  id: string;
  organizationId: string;
  publicSlug: string;
  displayName: string;
  tagline: string | null;
  blurb: string | null;
  heroImageUrl: string | null;
  discipline: string;
  specialisations: string[];
  targetTiers: string[];
  regions: string[];
  afslNumber: string | null;
  creditRepNumber: string | null;
  tpbNumber: string | null;
  abn: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  ratingsCount: number;
  averageRating: string | null;
  acceptedRequestsCount: number;
}

interface Props {
  orgId: string;
  orgName: string;
  profession: string;
  initialListing: ListingState | null;
  canEdit: boolean;
  canSubmit: boolean;
  onSaved: (listing: ListingState) => void;
}

// =============================================================================
// CHOICE LABELS (from enums in prisma/schema.prisma)
// =============================================================================

const SPECIALISATION_OPTIONS: Array<[string, string]> = [
  ['RETIREMENT_PLANNING', 'Retirement planning'],
  ['WEALTH_BUILDING', 'Wealth building'],
  ['TAX_OPTIMISATION', 'Tax optimisation'],
  ['ESTATE_PLANNING', 'Estate planning'],
  ['RISK_INSURANCE', 'Risk & insurance'],
  ['HOME_LOANS', 'Home loans'],
  ['INVESTMENT_LOANS', 'Investment loans'],
  ['REFINANCE', 'Refinance'],
  ['COMMERCIAL_LENDING', 'Commercial lending'],
  ['FIRST_HOME_BUYER', 'First-home buyer'],
  ['PERSONAL_TAX', 'Personal tax'],
  ['SMALL_BUSINESS', 'Small business'],
  ['TRUST_ACCOUNTING', 'Trust accounting'],
  ['SMSF_ACCOUNTING', 'SMSF accounting'],
  ['PROPERTY_INVESTORS', 'Property investors'],
];

const TIER_OPTIONS: Array<[string, string]> = [
  ['EMERGING', 'Emerging (under $200k)'],
  ['GROWING', 'Growing ($200k – $1M)'],
  ['ESTABLISHED', 'Established ($1M – $3M)'],
  ['HIGH_NET_WORTH', 'High net worth ($3M+)'],
];

const REGION_OPTIONS: Array<[string, string]> = [
  ['NATIONAL', 'National (any state)'],
  ['NSW_SYDNEY_METRO', 'NSW — Sydney metro'],
  ['NSW_REGIONAL', 'NSW — regional'],
  ['VIC_MELBOURNE_METRO', 'VIC — Melbourne metro'],
  ['VIC_REGIONAL', 'VIC — regional'],
  ['QLD_BRISBANE_METRO', 'QLD — Brisbane metro'],
  ['QLD_REGIONAL', 'QLD — regional'],
  ['WA', 'Western Australia'],
  ['SA', 'South Australia'],
  ['TAS', 'Tasmania'],
  ['ACT', 'Australian Capital Territory'],
  ['NT', 'Northern Territory'],
];

const DISCIPLINE_OPTIONS: Array<[string, string]> = [
  ['FINANCIAL_ADVISOR', 'Financial adviser'],
  ['MORTGAGE_BROKER', 'Mortgage broker'],
  ['ACCOUNTING_FIRM', 'Accounting firm'],
  ['TAX_AGENT', 'Tax agent'],
  ['BOOKKEEPER', 'Bookkeeper'],
  ['OTHER', 'Other'],
];

// =============================================================================
// HELPERS
// =============================================================================

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function disciplineRequiresAfsl(d: string): boolean {
  return d === 'FINANCIAL_ADVISOR';
}
function disciplineRequiresCreditRep(d: string): boolean {
  return d === 'MORTGAGE_BROKER';
}
function disciplineRequiresTpb(d: string): boolean {
  return d === 'TAX_AGENT' || d === 'ACCOUNTING_FIRM';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MarketplaceListingEditor({
  orgId,
  orgName,
  profession,
  initialListing,
  canEdit,
  canSubmit,
  onSaved,
}: Props) {
  const [displayName, setDisplayName] = useState(initialListing?.displayName ?? orgName);
  const [publicSlug, setPublicSlug] = useState(initialListing?.publicSlug ?? slugify(orgName));
  const [slugTouched, setSlugTouched] = useState(Boolean(initialListing));
  const [tagline, setTagline] = useState(initialListing?.tagline ?? '');
  const [blurb, setBlurb] = useState(initialListing?.blurb ?? '');
  const [discipline, setDiscipline] = useState(initialListing?.discipline ?? profession);
  const [specialisations, setSpecialisations] = useState<string[]>(initialListing?.specialisations ?? []);
  const [targetTiers, setTargetTiers] = useState<string[]>(initialListing?.targetTiers ?? []);
  const [regions, setRegions] = useState<string[]>(initialListing?.regions ?? []);
  const [afslNumber, setAfslNumber] = useState(initialListing?.afslNumber ?? '');
  const [creditRepNumber, setCreditRepNumber] = useState(initialListing?.creditRepNumber ?? '');
  const [tpbNumber, setTpbNumber] = useState(initialListing?.tpbNumber ?? '');
  const [abn, setAbn] = useState(initialListing?.abn ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate state when initialListing changes (after parent reload).
  useEffect(() => {
    if (initialListing) {
      setDisplayName(initialListing.displayName);
      setPublicSlug(initialListing.publicSlug);
      setSlugTouched(true);
      setTagline(initialListing.tagline ?? '');
      setBlurb(initialListing.blurb ?? '');
      setDiscipline(initialListing.discipline);
      setSpecialisations(initialListing.specialisations);
      setTargetTiers(initialListing.targetTiers);
      setRegions(initialListing.regions);
      setAfslNumber(initialListing.afslNumber ?? '');
      setCreditRepNumber(initialListing.creditRepNumber ?? '');
      setTpbNumber(initialListing.tpbNumber ?? '');
      setAbn(initialListing.abn ?? '');
    }
  }, [initialListing]);

  // Auto-derive slug from displayName until the user touches it explicitly.
  useEffect(() => {
    if (!slugTouched && displayName) setPublicSlug(slugify(displayName));
  }, [displayName, slugTouched]);

  const isLocked = initialListing?.status === 'PENDING_REVIEW';
  const isDisabled = !canEdit || isLocked || isSaving || isSubmitting;

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (displayName.trim().length < 2) errors.push('Display name must be at least 2 characters');
    if (publicSlug.length < 2) errors.push('Public slug too short');
    if (tagline.length > 0 && tagline.length < 10) errors.push('Tagline must be at least 10 characters');
    if (blurb.length > 0 && blurb.length < 100) errors.push('Blurb must be at least 100 characters');
    if (specialisations.length === 0) errors.push('Pick at least one specialisation');
    if (regions.length === 0) errors.push('Pick at least one region');
    if (disciplineRequiresAfsl(discipline) && !afslNumber.trim()) errors.push('AFSL number required for financial advisers');
    if (disciplineRequiresCreditRep(discipline) && !creditRepNumber.trim()) errors.push('Credit rep number required for mortgage brokers');
    if (disciplineRequiresTpb(discipline) && !tpbNumber.trim()) errors.push('TPB number required for tax agents / accountants');
    return errors;
  }, [displayName, publicSlug, tagline, blurb, specialisations, regions, discipline, afslNumber, creditRepNumber, tpbNumber]);

  const canSave = canEdit && !isLocked && !isSaving;
  const canSubmitNow =
    canSubmit &&
    !isLocked &&
    !isSubmitting &&
    validationErrors.length === 0 &&
    Boolean(initialListing) &&
    initialListing?.status !== 'PENDING_REVIEW';

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSavedFlash(false);
    try {
      const res = await fetch(`/api/portal/organizations/${orgId}/marketplace-listing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          publicSlug: publicSlug.trim(),
          tagline: tagline.trim() || null,
          blurb: blurb.trim() || null,
          discipline,
          specialisations,
          targetTiers,
          regions,
          afslNumber: afslNumber.trim() || null,
          creditRepNumber: creditRepNumber.trim() || null,
          tpbNumber: tpbNumber.trim() || null,
          abn: abn.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Save failed');
      onSaved(json.data.listing);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [
    abn, afslNumber, blurb, creditRepNumber, discipline, displayName, onSaved,
    orgId, publicSlug, regions, specialisations, tagline, targetTiers, tpbNumber,
  ]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSaveError(null);
    try {
      // Save first, then submit (defensive — ensures the latest edits are
      // captured before the listing transitions to PENDING_REVIEW).
      await handleSave();
      const res = await fetch(`/api/portal/organizations/${orgId}/marketplace-listing/submit`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Submit failed');
      onSaved(json.data.listing);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSave, onSaved, orgId]);

  const toggleArrayItem = (
    setter: (arr: string[]) => void,
    arr: string[],
    value: string,
  ) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  return (
    <div className="space-y-6">
      <PracticeGlassCard padding="lg">
        <div className="space-y-6">
          {/* Identity */}
          <section>
            <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Public identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Display name" hint="How your firm appears on the marketplace">
                <input
                  type="text"
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isDisabled}
                  placeholder="Smithfield Wealth Advisers"
                  maxLength={120}
                />
              </Field>
              <Field label="Public slug" hint="The URL slug at /marketplace/<slug>">
                <input
                  type="text"
                  className={inputClass}
                  value={publicSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setPublicSlug(e.target.value.toLowerCase());
                  }}
                  disabled={isDisabled}
                  placeholder="smithfield-wealth"
                  maxLength={64}
                />
              </Field>
              <Field label="Discipline" hint="What kind of firm is this?">
                <select
                  className={inputClass}
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  disabled={isDisabled}
                >
                  {DISCIPLINE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="ABN" hint="Optional — for ASIC + ABR cross-check">
                <input
                  type="text"
                  className={inputClass}
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  disabled={isDisabled}
                  placeholder="11 222 333 444"
                  maxLength={20}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field
                label="Tagline"
                hint="One-line hook (max 140 characters). Avoid hype — auditors read this too."
              >
                <input
                  type="text"
                  className={inputClass}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  disabled={isDisabled}
                  placeholder="We help Australian families build wealth across more than one entity."
                  maxLength={140}
                />
                <p className="mt-1 text-[11px] text-slate-400 tabular-nums">{tagline.length} / 140</p>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Blurb" hint="Longer pitch — what makes you different (≥ 100 chars)">
                <textarea
                  className={`${inputClass} min-h-[140px]`}
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  disabled={isDisabled}
                  placeholder="We work with Australian property investors and families with trust + SMSF structures…"
                  maxLength={2000}
                />
                <p className="mt-1 text-[11px] text-slate-400 tabular-nums">{blurb.length} / 2000</p>
              </Field>
            </div>
          </section>

          {/* Compliance numbers */}
          <section>
            <h2 className="text-[15px] font-semibold text-slate-900 mb-1">Compliance numbers</h2>
            <p className="text-[12px] text-slate-500 mb-4">
              Cross-checked manually by Monitrax against ASIC + TPB public registers before approval.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="AFSL number" hint={disciplineRequiresAfsl(discipline) ? 'Required' : 'Optional'}>
                <input
                  type="text"
                  className={inputClass}
                  value={afslNumber}
                  onChange={(e) => setAfslNumber(e.target.value)}
                  disabled={isDisabled || !disciplineRequiresAfsl(discipline)}
                  placeholder="123456"
                />
              </Field>
              <Field label="Credit rep number" hint={disciplineRequiresCreditRep(discipline) ? 'Required' : 'Optional'}>
                <input
                  type="text"
                  className={inputClass}
                  value={creditRepNumber}
                  onChange={(e) => setCreditRepNumber(e.target.value)}
                  disabled={isDisabled || !disciplineRequiresCreditRep(discipline)}
                  placeholder="567890"
                />
              </Field>
              <Field label="TPB number" hint={disciplineRequiresTpb(discipline) ? 'Required' : 'Optional'}>
                <input
                  type="text"
                  className={inputClass}
                  value={tpbNumber}
                  onChange={(e) => setTpbNumber(e.target.value)}
                  disabled={isDisabled || !disciplineRequiresTpb(discipline)}
                  placeholder="24567890"
                />
              </Field>
            </div>
          </section>

          {/* Facets */}
          <section>
            <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Specialisations</h2>
            <CheckboxGroup
              options={SPECIALISATION_OPTIONS}
              selected={specialisations}
              onToggle={(v) => toggleArrayItem(setSpecialisations, specialisations, v)}
              disabled={isDisabled}
              columns={3}
            />
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-slate-900 mb-1">Target client tiers</h2>
            <p className="text-[12px] text-slate-500 mb-4">
              Who are you set up to serve well? Helps the marketplace match the right fit.
            </p>
            <CheckboxGroup
              options={TIER_OPTIONS}
              selected={targetTiers}
              onToggle={(v) => toggleArrayItem(setTargetTiers, targetTiers, v)}
              disabled={isDisabled}
              columns={2}
            />
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Regions served</h2>
            <CheckboxGroup
              options={REGION_OPTIONS}
              selected={regions}
              onToggle={(v) => toggleArrayItem(setRegions, regions, v)}
              disabled={isDisabled}
              columns={2}
            />
          </section>
        </div>
      </PracticeGlassCard>

      {/* Validation summary */}
      {validationErrors.length > 0 && (
        <PracticeGlassCard padding="md" accentTone="opportunity">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-amber-700 mb-2">
            Before submitting for review
          </h3>
          <ul className="space-y-1 text-[13px] text-slate-700 list-disc list-inside">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </PracticeGlassCard>
      )}

      {saveError && (
        <PracticeGlassCard padding="md" accentTone="critical">
          <p className="text-[14px] text-rose-700">{saveError}</p>
        </PracticeGlassCard>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 sticky bottom-4">
        <PracticeGlassCard padding="md" className="flex items-center gap-3 text-[12px] text-slate-500">
          {isLocked ? (
            <>Listing is in review. Editing locked until Monitrax responds.</>
          ) : !canEdit ? (
            <>You don&rsquo;t have permission to edit this listing.</>
          ) : (
            <>Save anytime. Submit when ready for Monitrax review.</>
          )}
        </PracticeGlassCard>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-[12px] text-emerald-700">Saved ✓</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={primaryButtonClass}
          >
            {isSaving ? 'Saving…' : 'Save draft'}
          </button>
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmitNow}
              className={submitButtonClass}
              title={validationErrors.length > 0 ? validationErrors[0] : undefined}
            >
              {isSubmitting ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>

      <div className="text-[12px] text-slate-500">
        <Link href="/portal/dashboard" className="underline decoration-slate-200 hover:decoration-slate-400">
          ← Back to Practice dashboard
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const inputClass =
  'block w-full rounded-xl border-0 bg-white/80 py-2.5 px-3.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 transition-shadow';

const primaryButtonClass =
  'inline-flex items-center rounded-full bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50 px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const submitButtonClass =
  'inline-flex items-center rounded-full bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}
function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </label>
  );
}

interface CheckboxGroupProps {
  options: Array<[string, string]>;
  selected: string[];
  onToggle: (value: string) => void;
  disabled: boolean;
  columns: 1 | 2 | 3;
}
function CheckboxGroup({ options, selected, onToggle, disabled, columns }: CheckboxGroupProps) {
  const cols = columns === 3 ? 'md:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';
  return (
    <div className={`grid grid-cols-1 ${cols} gap-2`}>
      {options.map(([value, label]) => {
        const isSelected = selected.includes(value);
        return (
          <label
            key={value}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] cursor-pointer transition-colors ${
              isSelected
                ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-900'
                : 'bg-white/60 ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={isSelected}
              onChange={() => !disabled && onToggle(value)}
              disabled={disabled}
            />
            <span>{label}</span>
          </label>
        );
      })}
    </div>
  );
}
