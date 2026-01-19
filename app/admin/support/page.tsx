'use client';

/**
 * Phase 33: Support Tools Page
 *
 * User impersonation, access logs, and error tracking.
 */

import React from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

const supportTools = [
  {
    title: 'User Impersonation',
    description: 'Login as a user to debug issues. All actions are logged.',
    href: `${ADMIN_ROUTES.SUPPORT}/impersonate`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: 'blue',
  },
  {
    title: 'Access Logs',
    description: 'View user and admin access logs across the platform.',
    href: `${ADMIN_ROUTES.SUPPORT}/logs`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'green',
  },
  {
    title: 'Error Logs',
    description: 'Track and diagnose application errors and exceptions.',
    href: `${ADMIN_ROUTES.SUPPORT}/logs?type=errors`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    color: 'red',
  },
  {
    title: 'Admin Audit Log',
    description: 'Review all admin actions and changes for compliance.',
    href: `${ADMIN_ROUTES.SETTINGS}?tab=audit`,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: 'purple',
  },
];

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function SupportPage() {
  return (
    <AdminFeatureGate feature="supportTools">
      <AdminHeader
        title="Support Tools"
        description="Debugging and troubleshooting tools for customer support"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {supportTools.map((tool) => (
          <Link key={tool.title} href={tool.href}>
            <AdminCard className="h-full hover:border-blue-500 transition-colors cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${colorClasses[tool.color]}`}>
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {tool.description}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </AdminCard>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <AdminCard className="mt-6">
        <AdminCardHeader
          title="Quick User Lookup"
          description="Search for a user by email to view their account"
        />
        <div className="flex gap-4">
          <input
            type="email"
            placeholder="Enter user email..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <AdminButton>Look Up</AdminButton>
        </div>
      </AdminCard>
    </AdminFeatureGate>
  );
}
