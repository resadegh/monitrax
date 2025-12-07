'use client';

import React from 'react';
import { Globe, Calendar } from 'lucide-react';

interface CountryTaxStepProps {
  country: string;
  taxYear: string;
  onChangeCountry: (country: string) => void;
  onChangeTaxYear: (year: string) => void;
}

const countries = [
  { code: 'AU', name: 'Australia', fyStart: 'July 1' },
  { code: 'NZ', name: 'New Zealand', fyStart: 'April 1' },
  { code: 'US', name: 'United States', fyStart: 'January 1' },
  { code: 'UK', name: 'United Kingdom', fyStart: 'April 6' },
  { code: 'OTHER', name: 'Other', fyStart: 'January 1' },
];

export function CountryTaxStep({
  country,
  taxYear,
  onChangeCountry,
  onChangeTaxYear,
}: CountryTaxStepProps) {
  const selectedCountry = countries.find(c => c.code === country);

  // Generate tax year options
  const currentYear = new Date().getFullYear();
  const taxYears = [
    `${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
    `${currentYear - 1}-${currentYear.toString().slice(-2)}`,
    `${currentYear - 2}-${(currentYear - 1).toString().slice(-2)}`,
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Confirm your location
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          This helps us apply the correct tax rules and financial year settings
        </p>
      </div>

      {/* Country selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Globe className="w-4 h-4" />
          Country
        </label>
        <select
          value={country}
          onChange={(e) => onChangeCountry(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {selectedCountry && (
          <p className="text-xs text-gray-500 mt-1">
            Financial year starts: {selectedCountry.fyStart}
          </p>
        )}
      </div>

      {/* Tax year selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Calendar className="w-4 h-4" />
          Current tax year
        </label>
        <select
          value={taxYear}
          onChange={(e) => onChangeTaxYear(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {taxYears.map((year) => (
            <option key={year} value={year}>
              FY {year}
            </option>
          ))}
        </select>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> You can change these settings later from your profile.
          These settings affect how we calculate your tax estimates and organize your financial data.
        </p>
      </div>
    </div>
  );
}
