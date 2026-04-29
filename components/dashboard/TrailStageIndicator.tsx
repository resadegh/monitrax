'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';
import {
  Eye,
  Scissors,
  Anchor,
  TrendingUp,
  Sun,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

interface TrailData {
  emergencyFund?: { monthsCovered: number };
  cashflow?: { monthlySurplus: number };
  hasAccounts: boolean;
  hasInvestments: boolean;
  healthScore: number;
}

const stages = [
  {
    letter: 'T', name: 'Track', tagline: 'See your full picture',
    icon: Eye, color: 'text-amber-500', bg: 'bg-amber-500', bgLight: 'bg-amber-500/10',
    href: '/dashboard/accounts',
  },
  {
    letter: 'R', name: 'Reduce', tagline: 'Fix the leaks',
    icon: Scissors, color: 'text-orange-500', bg: 'bg-orange-500', bgLight: 'bg-orange-500/10',
    href: '/dashboard/budget-analysis',
  },
  {
    letter: 'A', name: 'Anchor', tagline: 'Build your safety net',
    icon: Anchor, color: 'text-emerald-500', bg: 'bg-emerald-500', bgLight: 'bg-emerald-500/10',
    href: '/dashboard/safety-net',
  },
  {
    letter: 'I', name: 'Invest', tagline: 'Grow your wealth',
    icon: TrendingUp, color: 'text-sky-500', bg: 'bg-sky-500', bgLight: 'bg-sky-500/10',
    href: '/dashboard/properties',
  },
  {
    letter: 'L', name: 'Live', tagline: 'On your terms',
    icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/10',
    href: '/dashboard/cfo',
  },
];

function determineStage(data: TrailData | null): number {
  if (!data) return 0;
  if (!data.hasAccounts) return 0;
  if (data.cashflow && data.cashflow.monthlySurplus <= 0) return 1;
  if (!data.emergencyFund || data.emergencyFund.monthsCovered < 3) return 2;
  if (!data.hasInvestments) return 3;
  if (data.healthScore < 75) return 3;
  return 4;
}

export function TrailStageIndicator() {
  const { token } = useAuth();
  const [trailData, setTrailData] = useState<TrailData | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/master-snapshot', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success || json.data || json.netWorth !== undefined) {
          const d = json.data || json;
          setTrailData({
            hasAccounts: (d.accounts?.length || 0) > 0 || (d.netWorth?.totalAssets || 0) > 0,
            hasInvestments: (d.investments?.totalValue || 0) > 0 || (d.properties?.length || 0) > 0,
            emergencyFund: d.emergencyFund,
            cashflow: d.cashflow ? { monthlySurplus: d.cashflow.netMonthlyCashflow || d.cashflow.monthlySurplus || 0 } : undefined,
            healthScore: d.healthScore?.score || d.health?.score || 0,
          });
        }
      })
      .catch(() => {});
  }, [token]);

  const currentStage = determineStage(trailData);
  const current = stages[currentStage];

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Your TRAIL
        </h3>
        <Link
          href={current.href}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          Go to {current.name} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stage progress */}
      <div className="flex items-center gap-0.5 sm:gap-1 mb-5 overflow-x-auto">
        {stages.map((stage, i) => (
          <div key={stage.letter} className="flex items-center">
            <div
              className={`flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold transition-all ${
                i < currentStage
                  ? `${stage.bg} text-white`
                  : i === currentStage
                  ? `${stage.bg} text-white ring-2 ring-offset-2 ring-offset-card ${stage.bg.replace('bg-', 'ring-')}`
                  : 'bg-muted text-muted-foreground/50'
              }`}
            >
              {i < currentStage ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                stage.letter
              )}
            </div>
            {i < stages.length - 1 && (
              <div className={`w-full min-w-[8px] sm:min-w-[12px] h-0.5 mx-0.5 ${i < currentStage ? stage.bg : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Current stage info */}
      <div className={`rounded-xl ${current.bgLight} p-4`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${current.bgLight}`}>
            <current.icon className={`h-5 w-5 ${current.color}`} />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${current.color}`}>
              Stage {current.letter} — {current.name}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {current.tagline}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
