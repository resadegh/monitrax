/**
 * Phase 32: Organization Settings Component
 *
 * MODULAR: Settings form for organization configuration.
 * Includes branding, business info, and portal settings.
 */

'use client';

import { useState } from 'react';
import { PortalCard, CardHeader } from '../ui/PortalCard';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { Input, Textarea, Select, FormGroup, FormRow, FormSection } from '../ui/PortalForm';
import type { OrganizationType, OrganizationPlan } from '@prisma/client';

interface OrganizationSettingsData {
  // Basic Info
  name: string;
  slug: string;
  description: string;

  // Organization Type
  organizationType: OrganizationType;
  plan: OrganizationPlan;

  // Business Info
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  abn: string;
  acn: string;

  // Compliance
  afslNumber: string;
  taxAgentNumber: string;

  // Branding
  brandName: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
}

interface OrganizationSettingsProps {
  initialData: Partial<OrganizationSettingsData>;
  onSave: (data: Partial<OrganizationSettingsData>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  planLimits?: {
    whiteLabeling: boolean;
    customDomains: boolean;
    ssoSaml: boolean;
  };
}

export function OrganizationSettings({
  initialData,
  onSave,
  onCancel,
  loading = false,
  planLimits,
}: OrganizationSettingsProps) {
  const [data, setData] = useState<Partial<OrganizationSettingsData>>(initialData);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof OrganizationSettingsData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!data.name?.trim()) {
      newErrors.name = 'Organization name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <PortalCard>
        <FormSection
          title="Basic Information"
          description="Your organization's public-facing information"
        >
          <FormGroup>
            <FormRow columns={2}>
              <Input
                label="Organization Name"
                value={data.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                error={errors.name}
                required
              />
              <Input
                label="URL Slug"
                value={data.slug || ''}
                onChange={(e) => handleChange('slug', e.target.value)}
                hint="Used in your portal URL"
                disabled
              />
            </FormRow>
            <Textarea
              label="Description"
              value={data.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of your organization"
              rows={3}
            />
            <FormRow columns={2}>
              <Select
                label="Organization Type"
                value={data.organizationType || 'ACCOUNTING_FIRM'}
                onChange={(e) => handleChange('organizationType', e.target.value)}
                options={[
                  { value: 'ACCOUNTING_FIRM', label: 'Accounting Firm' },
                  { value: 'FINANCIAL_ADVISOR', label: 'Financial Advisor' },
                  { value: 'MORTGAGE_BROKER', label: 'Mortgage Broker' },
                  { value: 'TAX_AGENT', label: 'Tax Agent' },
                  { value: 'BOOKKEEPER', label: 'Bookkeeper' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <Input
                label="Current Plan"
                value={formatPlan(data.plan)}
                disabled
                hint="Contact support to change your plan"
              />
            </FormRow>
          </FormGroup>
        </FormSection>
      </PortalCard>

      {/* Business Details */}
      <PortalCard>
        <FormSection
          title="Business Details"
          description="Contact and registration information"
        >
          <FormGroup>
            <FormRow columns={2}>
              <Input
                label="Business Email"
                type="email"
                value={data.businessEmail || ''}
                onChange={(e) => handleChange('businessEmail', e.target.value)}
              />
              <Input
                label="Business Phone"
                type="tel"
                value={data.businessPhone || ''}
                onChange={(e) => handleChange('businessPhone', e.target.value)}
              />
            </FormRow>
            <Textarea
              label="Business Address"
              value={data.businessAddress || ''}
              onChange={(e) => handleChange('businessAddress', e.target.value)}
              rows={2}
            />
            <FormRow columns={2}>
              <Input
                label="ABN"
                value={data.abn || ''}
                onChange={(e) => handleChange('abn', e.target.value)}
                placeholder="00 000 000 000"
                hint="Australian Business Number"
              />
              <Input
                label="ACN"
                value={data.acn || ''}
                onChange={(e) => handleChange('acn', e.target.value)}
                placeholder="000 000 000"
                hint="Australian Company Number (optional)"
              />
            </FormRow>
          </FormGroup>
        </FormSection>
      </PortalCard>

      {/* Compliance */}
      <PortalCard>
        <FormSection
          title="Compliance & Licensing"
          description="Professional registration numbers"
        >
          <FormGroup>
            <FormRow columns={2}>
              <Input
                label="AFSL Number"
                value={data.afslNumber || ''}
                onChange={(e) => handleChange('afslNumber', e.target.value)}
                hint="Australian Financial Services License (if applicable)"
              />
              <Input
                label="Tax Agent Number"
                value={data.taxAgentNumber || ''}
                onChange={(e) => handleChange('taxAgentNumber', e.target.value)}
                hint="Tax Practitioners Board registration (if applicable)"
              />
            </FormRow>
          </FormGroup>
        </FormSection>
      </PortalCard>

      {/* Branding */}
      <PortalCard>
        <FormSection
          title="Branding"
          description="Customize the look and feel of your client portal"
        >
          {planLimits?.whiteLabeling ? (
            <FormGroup>
              <FormRow columns={2}>
                <Input
                  label="Brand Name"
                  value={data.brandName || ''}
                  onChange={(e) => handleChange('brandName', e.target.value)}
                  placeholder="Your brand name"
                  hint="Displayed instead of 'Monitrax' to clients"
                />
                <Input
                  label="Logo URL"
                  value={data.brandLogoUrl || ''}
                  onChange={(e) => handleChange('brandLogoUrl', e.target.value)}
                  placeholder="https://..."
                  hint="Square logo recommended (128x128 or larger)"
                />
              </FormRow>
              <FormRow columns={2}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data.brandPrimaryColor || '#1e293b'}
                      onChange={(e) => handleChange('brandPrimaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                    />
                    <Input
                      value={data.brandPrimaryColor || '#1e293b'}
                      onChange={(e) => handleChange('brandPrimaryColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data.brandSecondaryColor || '#3b82f6'}
                      onChange={(e) => handleChange('brandSecondaryColor', e.target.value)}
                      className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                    />
                    <Input
                      value={data.brandSecondaryColor || '#3b82f6'}
                      onChange={(e) => handleChange('brandSecondaryColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </FormRow>
            </FormGroup>
          ) : (
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-sm text-slate-600">
                White-labeling is available on Professional plans and above.
              </p>
              <a href="/portal/settings/billing" className="text-sm text-blue-600 hover:underline">
                Upgrade your plan →
              </a>
            </div>
          )}
        </FormSection>
      </PortalCard>

      {/* Actions */}
      <div className="flex justify-end">
        <ButtonGroup>
          {onCancel && (
            <PortalButton type="button" variant="outline" onClick={onCancel}>
              Cancel
            </PortalButton>
          )}
          <PortalButton type="submit" loading={saving || loading}>
            Save Changes
          </PortalButton>
        </ButtonGroup>
      </div>
    </form>
  );
}

function formatPlan(plan?: OrganizationPlan): string {
  if (!plan) return 'Unknown';
  const planNames: Record<OrganizationPlan, string> = {
    STARTER: 'Starter',
    PROFESSIONAL: 'Professional',
    BUSINESS: 'Business',
    ENTERPRISE: 'Enterprise',
  };
  return planNames[plan] || plan;
}

export default OrganizationSettings;
