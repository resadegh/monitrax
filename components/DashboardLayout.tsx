'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Properties', href: '/dashboard/properties', icon: '🏠' },
  { name: 'Loans', href: '/dashboard/loans', icon: '💰' },
  { name: 'Accounts', href: '/dashboard/accounts', icon: '🏦' },
  { name: 'Income', href: '/dashboard/income', icon: '💵' },
  { name: 'Expenses', href: '/dashboard/expenses', icon: '📉' },
  { name: 'Debt Planner', href: '/dashboard/debt-planner', icon: '📈' },
  { name: 'Tax Calculator', href: '/dashboard/tax', icon: '🧾' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-indigo-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Monitrax</h1>
          <p className="text-sm text-indigo-200 mt-1">Financial Planning</p>
        </div>

        <nav className="mt-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-800 text-white border-l-4 border-white'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-indigo-800">
          <div className="mb-4">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-indigo-200">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full px-4 py-2 text-sm bg-indigo-800 hover:bg-indigo-700 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
