/**
 * Phase 32: Organization Selector Component
 *
 * Dropdown component for switching between organizations.
 * Shows user's role in each organization.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useOrganization, type Organization } from '@/lib/portal';

interface OrganizationSelectorProps {
  className?: string;
}

// Role display configuration
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  PORTAL_OWNER: { label: 'Owner', color: 'bg-purple-500' },
  PORTAL_ADMIN: { label: 'Admin', color: 'bg-blue-500' },
  PORTAL_ADVISOR: { label: 'Advisor', color: 'bg-green-500' },
  PORTAL_VIEWER: { label: 'Viewer', color: 'bg-slate-500' },
  // Fallback for standard roles
  OWNER: { label: 'Owner', color: 'bg-purple-500' },
  ADMIN: { label: 'Admin', color: 'bg-blue-500' },
  CONTRIBUTOR: { label: 'Advisor', color: 'bg-green-500' },
  VIEWER: { label: 'Viewer', color: 'bg-slate-500' },
};

export function OrganizationSelector({ className = '' }: OrganizationSelectorProps) {
  const { organizations, currentOrg, selectOrganization, isLoading } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (org: Organization) => {
    selectOrganization(org.id);
    setIsOpen(false);
    // Reload the page to refresh data for new organization
    window.location.reload();
  };

  const getRoleInfo = (role: string) => {
    return ROLE_LABELS[role] || { label: role, color: 'bg-slate-500' };
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse flex items-center gap-3 p-2">
          <div className="w-10 h-10 bg-slate-700 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-4 bg-slate-700 rounded w-24 mb-1"></div>
            <div className="h-3 bg-slate-700 rounded w-16"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className={`${className} p-4`}>
        <p className="text-sm text-slate-400">No organization</p>
        <a
          href="/portal/organizations/new"
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          Create organization
        </a>
      </div>
    );
  }

  const currentRoleInfo = getRoleInfo(currentOrg.role);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Current Organization Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group"
      >
        {currentOrg.brandLogoUrl ? (
          <img
            src={currentOrg.brandLogoUrl}
            alt={currentOrg.name}
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-lg font-bold">
            {currentOrg.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold truncate">{currentOrg.name}</p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${currentRoleInfo.color} text-white`}>
              {currentRoleInfo.label}
            </span>
          </div>
        </div>
        <ChevronIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && organizations.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Switch Organization</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {organizations.map((org) => {
              const roleInfo = getRoleInfo(org.role);
              const isSelected = org.id === currentOrg.id;

              return (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org)}
                  disabled={isSelected}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-700 cursor-default'
                      : 'hover:bg-slate-700/50'
                  }`}
                >
                  {org.brandLogoUrl ? (
                    <img
                      src={org.brandLogoUrl}
                      alt={org.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center text-sm font-bold">
                      {org.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleInfo.color} text-white`}>
                        {roleInfo.label}
                      </span>
                      {org.portalEnabled && (
                        <span className="text-[10px] text-green-400">Active</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckIcon className="w-4 h-4 text-green-400" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-700">
            <a
              href="/portal/organizations/new"
              className="flex items-center gap-2 p-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create New Organization</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

export default OrganizationSelector;
