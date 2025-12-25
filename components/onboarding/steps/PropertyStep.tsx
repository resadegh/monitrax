'use client';

import React, { useState, useEffect } from 'react';
import { Home, Building2, DollarSign, Percent, ChevronDown, ChevronUp, KeyRound } from 'lucide-react';

interface PropertyData {
  name: string;
  type: string;
  value: number;
  hasLoan: boolean;
  loanDetails?: {
    lender: string;
    principal: number;
    rate: number;
    isFixed: boolean;
    isInterestOnly: boolean;
  };
  // Rental property fields
  rentAmount?: number;
  rentFrequency?: string;
}

interface PropertyStepProps {
  value: PropertyData | null;
  onChange: (data: PropertyData | null) => void;
}

export function PropertyStep({ value, onChange }: PropertyStepProps) {
  const [skipProperty, setSkipProperty] = useState(false);
  const [name, setName] = useState(value?.name || '');
  const [type, setType] = useState(value?.type || 'HOME');
  const [propertyValue, setPropertyValue] = useState(value?.value?.toString() || '');
  const [hasLoan, setHasLoan] = useState(value?.hasLoan ?? true);
  const [showLoanDetails, setShowLoanDetails] = useState(value?.hasLoan ?? false);

  // Loan details
  const [lender, setLender] = useState(value?.loanDetails?.lender || '');
  const [principal, setPrincipal] = useState(value?.loanDetails?.principal?.toString() || '');
  const [rate, setRate] = useState(value?.loanDetails?.rate?.toString() || '');
  const [isFixed, setIsFixed] = useState(value?.loanDetails?.isFixed ?? false);
  const [isInterestOnly, setIsInterestOnly] = useState(value?.loanDetails?.isInterestOnly ?? false);

  // Rental property fields
  const [rentAmount, setRentAmount] = useState(value?.rentAmount?.toString() || '');
  const [rentFrequency, setRentFrequency] = useState(value?.rentFrequency || 'WEEKLY');

  useEffect(() => {
    if (skipProperty) {
      onChange(null);
      return;
    }

    // For rental properties, we need name and rent amount
    if (type === 'RENTAL') {
      if (name && rentAmount) {
        const data: PropertyData = {
          name,
          type,
          value: 0, // Rental properties have no owned value
          hasLoan: false, // Renters don't have loans on rental properties
          rentAmount: parseFloat(rentAmount) || 0,
          rentFrequency,
        };
        onChange(data);
      }
    } else if (name && propertyValue) {
      // For owned properties (HOME/INVESTMENT)
      const data: PropertyData = {
        name,
        type,
        value: parseFloat(propertyValue) || 0,
        hasLoan,
        loanDetails: hasLoan && lender && principal && rate
          ? {
              lender,
              principal: parseFloat(principal) || 0,
              rate: parseFloat(rate) || 0,
              isFixed,
              isInterestOnly,
            }
          : undefined,
      };
      onChange(data);
    }
  }, [skipProperty, name, type, propertyValue, hasLoan, lender, principal, rate, isFixed, isInterestOnly, rentAmount, rentFrequency, onChange]);

  // Calculate equity preview
  const equity = propertyValue && principal
    ? (parseFloat(propertyValue) || 0) - (parseFloat(principal) || 0)
    : null;

  if (skipProperty) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No property? No problem!
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            You can add properties later from the Properties page.
            Click &quot;Next&quot; to continue.
          </p>
          <button
            onClick={() => setSkipProperty(false)}
            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Actually, I do have a property
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Add your property
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Your primary residence or first investment property
        </p>
      </div>

      {/* Skip option */}
      <button
        onClick={() => setSkipProperty(true)}
        className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        I don&apos;t own property yet →
      </button>

      {/* Property name */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Property name or address
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., 123 Main St or Home"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Property type */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Property type
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setType('HOME')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
              type === 'HOME'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Home className={`w-5 h-5 ${type === 'HOME' ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="font-medium">Primary Home</span>
          </button>
          <button
            onClick={() => setType('INVESTMENT')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
              type === 'INVESTMENT'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Building2 className={`w-5 h-5 ${type === 'INVESTMENT' ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="font-medium">Investment</span>
          </button>
          <button
            onClick={() => { setType('RENTAL'); setHasLoan(false); }}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
              type === 'RENTAL'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <KeyRound className={`w-5 h-5 ${type === 'RENTAL' ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="font-medium">Rental</span>
          </button>
        </div>
        {type === 'RENTAL' && (
          <p className="mt-2 text-sm text-gray-500">
            Track your rental property and rent expenses
          </p>
        )}
      </div>

      {/* Property value - only for owned properties */}
      {type !== 'RENTAL' && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4" />
            Current market value
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Rent details - only for rental properties */}
      {type === 'RENTAL' && (
        <div className="space-y-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4" />
              Rent amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Payment frequency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].map((freq) => (
                <button
                  key={freq}
                  onClick={() => setRentFrequency(freq)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    rentFrequency === freq
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {freq.charAt(0) + freq.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          {rentAmount && (
            <div className="pt-2 border-t border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Annual rent:</strong> ${(
                  parseFloat(rentAmount) *
                  (rentFrequency === 'WEEKLY' ? 52 : rentFrequency === 'FORTNIGHTLY' ? 26 : 12)
                ).toLocaleString()}/year
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This will be added as a recurring expense
              </p>
            </div>
          )}
        </div>
      )}

      {/* Has loan toggle - only for owned properties */}
      {type !== 'RENTAL' && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <span className="font-medium text-gray-900">Do you have a loan on this property?</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setHasLoan(true); setShowLoanDetails(true); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                hasLoan
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => { setHasLoan(false); setShowLoanDetails(false); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                !hasLoan
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700'
              }`}
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Loan details (collapsible) - only for owned properties */}
      {type !== 'RENTAL' && hasLoan && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowLoanDetails(!showLoanDetails)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
          >
            <span className="font-medium text-gray-900">Loan Details</span>
            {showLoanDetails ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showLoanDetails && (
            <div className="p-4 space-y-4">
              {/* Lender */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Lender / Bank
                </label>
                <input
                  type="text"
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                  placeholder="e.g., CBA, Westpac, ANZ"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Principal remaining */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Principal remaining
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Interest rate */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Percent className="w-4 h-4" />
                  Interest rate (annual)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="6.25"
                    className="w-full px-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>

              {/* Rate type & Interest only */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isFixed}
                    onChange={(e) => setIsFixed(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Fixed rate</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isInterestOnly}
                    onChange={(e) => setIsInterestOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Interest only</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Equity preview - only for owned properties */}
      {type !== 'RENTAL' && equity !== null && hasLoan && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="text-sm text-green-800">
            <strong>Equity:</strong> ${equity.toLocaleString()}
          </div>
          <div className="text-xs text-green-600 mt-1">
            Property value − Loan balance = Your equity
          </div>
        </div>
      )}
    </div>
  );
}
