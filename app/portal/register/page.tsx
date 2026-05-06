/**
 * Phase 32: Organization Registration Page
 *
 * Multi-step registration flow for new organizations:
 * 1. Organization details
 * 2. Admin user account
 * 3. Plan selection with pricing
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Pricing tiers
const PRICING_TIERS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 49,
    period: 'month',
    maxClients: 10,
    maxStaff: 3,
    features: [
      'Up to 10 clients',
      'Up to 3 team members',
      'Client portal access',
      'Basic reporting',
      'Email support',
    ],
    popular: false,
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: 149,
    period: 'month',
    maxClients: 50,
    maxStaff: 10,
    features: [
      'Up to 50 clients',
      'Up to 10 team members',
      'Client portal access',
      'Advanced reporting',
      'Priority email support',
      'Custom branding',
    ],
    popular: true,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: 349,
    period: 'month',
    maxClients: 200,
    maxStaff: 25,
    features: [
      'Up to 200 clients',
      'Up to 25 team members',
      'Client portal access',
      'Advanced reporting',
      'Priority support',
      'Custom branding',
      'API access',
      'SSO/SAML',
    ],
    popular: false,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: null, // Custom pricing
    period: 'month',
    maxClients: -1, // Unlimited
    maxStaff: -1, // Unlimited
    features: [
      'Unlimited clients',
      'Unlimited team members',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantees',
      'Custom branding',
      'API access',
      'SSO/SAML',
      'Dedicated account manager',
    ],
    popular: false,
  },
];

const ORGANIZATION_TYPES = [
  { id: 'ACCOUNTING_FIRM', label: 'Accounting Firm' },
  { id: 'FINANCIAL_ADVISOR', label: 'Financial Advisor' },
  { id: 'WEALTH_MANAGER', label: 'Wealth Manager' },
  { id: 'BOOKKEEPER', label: 'Bookkeeper' },
  { id: 'TAX_AGENT', label: 'Tax Agent' },
  { id: 'OTHER', label: 'Other' },
];

type Step = 'organization' | 'admin' | 'plan' | 'review' | 'processing' | 'success';

interface FormData {
  // Organization
  organizationName: string;
  organizationType: string;
  businessEmail: string;
  businessPhone: string;
  abn: string;
  // Admin
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  // Plan
  selectedPlan: string;
  expectedClients: number;
}

export default function OrganizationRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('organization');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>({
    organizationName: '',
    organizationType: 'ACCOUNTING_FIRM',
    businessEmail: '',
    businessPhone: '',
    abn: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    selectedPlan: 'PROFESSIONAL',
    expectedClients: 20,
  });

  const updateFormData = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateOrganizationStep = (): boolean => {
    if (!formData.organizationName.trim()) {
      setError('Organization name is required');
      return false;
    }
    if (!formData.businessEmail.trim()) {
      setError('Business email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.businessEmail)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validateAdminStep = (): boolean => {
    if (!formData.adminName.trim()) {
      setError('Your name is required');
      return false;
    }
    if (!formData.adminEmail.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.adminPassword) {
      setError('Password is required');
      return false;
    }
    if (formData.adminPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.adminPassword !== formData.adminPasswordConfirm) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'organization' && validateOrganizationStep()) {
      setStep('admin');
    } else if (step === 'admin' && validateAdminStep()) {
      setStep('plan');
    } else if (step === 'plan') {
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'admin') setStep('organization');
    else if (step === 'plan') setStep('admin');
    else if (step === 'review') setStep('plan');
  };

  const handleSubmit = async () => {
    setStep('processing');
    setError('');

    try {
      const response = await fetch('/api/portal/organizations/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: {
            name: formData.organizationName,
            type: formData.organizationType,
            businessEmail: formData.businessEmail,
            businessPhone: formData.businessPhone,
            abn: formData.abn,
          },
          admin: {
            name: formData.adminName,
            email: formData.adminEmail,
            password: formData.adminPassword,
          },
          plan: formData.selectedPlan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Registration failed');
        setStep('review');
        return;
      }

      // Store token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      setStep('success');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setStep('review');
    }
  };

  const selectedTier = PRICING_TIERS.find((t) => t.id === formData.selectedPlan);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Register Your Organization</h1>
          <p className="text-slate-500 mt-2">Get started with Monitrax Enterprise Portal</p>
        </div>

        {/* Progress Steps */}
        {step !== 'processing' && step !== 'success' && (
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              {['organization', 'admin', 'plan', 'review'].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === s
                        ? 'bg-blue-600 text-white'
                        : ['organization', 'admin', 'plan', 'review'].indexOf(step) > i
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {['organization', 'admin', 'plan', 'review'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  {i < 3 && <div className="w-12 h-0.5 bg-slate-200 mx-1" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-lg mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Organization Details */}
        {step === 'organization' && (
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Organization Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => updateFormData('organizationName', e.target.value)}
                  placeholder="ABC Accounting"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Organization Type *
                </label>
                <select
                  value={formData.organizationType}
                  onChange={(e) => updateFormData('organizationType', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {ORGANIZATION_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business Email *
                </label>
                <input
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => updateFormData('businessEmail', e.target.value)}
                  placeholder="contact@abcaccounting.com.au"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business Phone
                </label>
                <input
                  type="tel"
                  value={formData.businessPhone}
                  onChange={(e) => updateFormData('businessPhone', e.target.value)}
                  placeholder="02 9000 0000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ABN (Australian Business Number)
                </label>
                <input
                  type="text"
                  value={formData.abn}
                  onChange={(e) => updateFormData('abn', e.target.value)}
                  placeholder="00 000 000 000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <a
                href="/portal/login"
                className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Back to Login
              </a>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Admin Account */}
        {step === 'admin' && (
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Create Your Admin Account</h2>
            <p className="text-slate-500 text-sm mb-6">
              You will be the owner and primary administrator of this organization.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) => updateFormData('adminName', e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => updateFormData('adminEmail', e.target.value)}
                  placeholder="john@abcaccounting.com.au"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => updateFormData('adminPassword', e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={formData.adminPasswordConfirm}
                  onChange={(e) => updateFormData('adminPasswordConfirm', e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={handleBack}
                className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Plan Selection */}
        {step === 'plan' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-2 text-center">
              Choose Your Plan
            </h2>
            <p className="text-slate-500 text-sm mb-8 text-center">
              Select the plan that best fits your organization&apos;s needs
            </p>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => tier.id !== 'ENTERPRISE' && updateFormData('selectedPlan', tier.id)}
                  className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.selectedPlan === tier.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${tier.id === 'ENTERPRISE' ? 'cursor-default' : ''}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-lg font-semibold text-slate-900">{tier.name}</h3>

                  <div className="mt-4">
                    {tier.price ? (
                      <>
                        <span className="text-3xl font-bold text-slate-900">${tier.price}</span>
                        <span className="text-slate-500">/{tier.period}</span>
                      </>
                    ) : (
                      <span className="text-xl font-semibold text-slate-900">Contact Sales</span>
                    )}
                  </div>

                  <div className="mt-2 text-sm text-slate-500">
                    {tier.maxClients === -1
                      ? 'Unlimited clients'
                      : `Up to ${tier.maxClients} clients`}
                  </div>

                  <ul className="mt-4 space-y-2">
                    {tier.features.slice(0, 4).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-green-500">✓</span>
                        {feature}
                      </li>
                    ))}
                    {tier.features.length > 4 && (
                      <li className="text-sm text-slate-400">
                        +{tier.features.length - 4} more features
                      </li>
                    )}
                  </ul>

                  {tier.id === 'ENTERPRISE' ? (
                    <a
                      href="mailto:sales@monitrax.com?subject=Enterprise%20Plan%20Inquiry"
                      className="mt-4 block w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg text-center font-medium text-slate-700"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <div
                      className={`mt-4 py-2 px-4 rounded-lg text-center font-medium ${
                        formData.selectedPlan === tier.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {formData.selectedPlan === tier.id ? 'Selected' : 'Select Plan'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={handleBack}
                className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Continue to Review
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Review Your Registration</h2>

            <div className="space-y-6">
              {/* Organization Summary */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase mb-3">Organization</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name</span>
                    <span className="font-medium text-slate-900">{formData.organizationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Type</span>
                    <span className="font-medium text-slate-900">
                      {ORGANIZATION_TYPES.find((t) => t.id === formData.organizationType)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email</span>
                    <span className="font-medium text-slate-900">{formData.businessEmail}</span>
                  </div>
                  {formData.abn && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">ABN</span>
                      <span className="font-medium text-slate-900">{formData.abn}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Summary */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase mb-3">Admin Account</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name</span>
                    <span className="font-medium text-slate-900">{formData.adminName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email</span>
                    <span className="font-medium text-slate-900">{formData.adminEmail}</span>
                  </div>
                </div>
              </div>

              {/* Plan Summary */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-medium text-blue-600 uppercase mb-3">Selected Plan</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-lg font-semibold text-slate-900">
                      {selectedTier?.name}
                    </span>
                    <div className="text-sm text-slate-500">
                      Up to {selectedTier?.maxClients} clients, {selectedTier?.maxStaff} team
                      members
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-slate-900">${selectedTier?.price}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <p className="text-xs text-slate-500 text-center">
                By registering, you agree to our{' '}
                <a href="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={handleBack}
                className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Complete Registration
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              Setting up your organization...
            </h2>
            <p className="text-slate-500 mt-2">This will only take a moment.</p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-green-600 text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mt-6">Registration Complete!</h2>
            <p className="text-slate-500 mt-2">
              Your organization <strong>{formData.organizationName}</strong> has been created.
            </p>
            <p className="text-slate-500 mt-2">
              A verification email has been sent to <strong>{formData.adminEmail}</strong>.
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => router.push('/portal/signin')}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Sign In to Portal
              </button>
              <a
                href="/portal/login"
                className="block w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
              >
                Back to Portal Home
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-400">
          Phase 32: Enterprise Portal • v0.1.0
        </div>
      </div>
    </div>
  );
}
