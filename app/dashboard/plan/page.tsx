'use client';

/**
 * MY PLAN — The Intent
 *
 * Phase 37: Single hub for the user's financial plan. Three sub-sections
 * delivered via Apple-style segmented control with cross-fade transitions:
 *
 *   • Money In   — what you're earning  (links to /dashboard/income for full CRUD)
 *   • Money Out  — what you're planning to spend (links to /dashboard/expenses)
 *   • Your Budget — AI-estimated targets (links to /dashboard/budget-analysis)
 *
 * Architecture:
 *   • Hero summary numbers come from /api/cashflow/intelligence (existing
 *     canonical aggregator — see lib/cashflow/intelligenceEngine.ts).
 *     ZERO new calculations. ZERO new endpoints.
 *   • Each section's summary list comes from its existing API
 *     (/api/income, /api/expenses, /api/budget-analysis/latest).
 *   • Every "Manage all →" link drills into the existing detail page
 *     (which itself is unchanged — full CRUD, full forms, full power).
 *
 * Design language: extends Home TRAIL banner v3
 * (components/dashboard/TrailStageIndicator.tsx) — glassmorphic 28px cards,
 * appleEase 1.4s, framer-motion v12 springs (stiffness 320 / damping 28),
 * AnimatePresence cross-fades with blur, full prefers-reduced-motion.
 *
 * No new dependencies. No new design tokens. No calc engine changes.
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { appleEase, springSnap as springy } from '@/components/shell/motion';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { toMonthly } from '@/lib/utils/frequencies';

// =============================================================================
// DESIGN TOKENS — sourced from TrailStageIndicator.tsx (Home TRAIL banner v3)
// =============================================================================


// =============================================================================
// TYPES — minimal shapes pulled from the existing API responses
// =============================================================================

type Section = 'in' | 'out' | 'budget';

interface IntelligenceCurrent {
  income: number;
  expenses: number;
  net: number;
  balance: number;
}

interface IncomeItem {
  id: string;
  source: string;
  type: string;
  amount: number;
  frequency: string;
}

interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  frequency: string;
  isEssential?: boolean;
}

interface BudgetSnapshot {
  status?: 'DRAFT' | 'CONFIRMED';
  totalEstimated?: number;
  variableEstimate?: number;
  committedTotal?: number;
  discretionaryTotal?: number;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SegmentedControl({
  value,
  onChange,
  reduced,
}: {
  value: Section;
  onChange: (s: Section) => void;
  reduced: boolean | null;
}) {
  const segments: { id: Section; label: string }[] = [
    { id: 'in', label: 'Money In' },
    { id: 'out', label: 'Money Out' },
    { id: 'budget', label: 'Your Budget' },
  ];

  return (
    <div className="relative inline-flex items-center rounded-2xl border border-border/50 bg-muted/40 p-1 backdrop-blur-md">
      {segments.map((seg) => {
        const active = value === seg.id;
        return (
          <button
            key={seg.id}
            onClick={() => onChange(seg.id)}
            className="relative px-4 sm:px-6 py-2 text-sm font-medium transition-colors duration-200 z-10"
            style={{
              color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
            }}
          >
            {active && (
              <motion.span
                layoutId="plan-segment-pill"
                className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                transition={reduced ? { duration: 0 } : springy}
                style={{ zIndex: -1 }}
              />
            )}
            <span className="relative">{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-card/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function SectionEmpty({
  icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{body}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ManageAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all hover:gap-2.5"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// =============================================================================
// SECTION RENDERERS — each is a condensed summary; full CRUD lives on the
// existing detail page, reached via the "Manage all →" link.
// =============================================================================

function MoneyInSection({
  items,
  reduced,
}: {
  items: IncomeItem[];
  reduced: boolean | null;
}) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={<TrendingUp className="h-6 w-6" />}
        title="No income tracked yet"
        body="Add your salary, rent, dividends, or any other income to start your plan."
        cta="Add income"
        href="/dashboard/income"
      />
    );
  }

  // Top 5 sources by monthly amount — descending
  const ranked = [...items]
    .map((i) => ({ ...i, monthly: toMonthly(i.amount, i.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL') }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 5);

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Your top {ranked.length} income source{ranked.length === 1 ? '' : 's'}
        </p>
        <ManageAllLink href="/dashboard/income" label={`Manage all ${items.length}`} />
      </div>
      <div className="space-y-1">
        {ranked.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={reduced ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.4, ease: appleEase, delay: idx * 0.04 }
            }
            className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{item.source}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {item.type.toLowerCase().replace(/_/g, ' ')} · {item.frequency.toLowerCase()}
              </div>
            </div>
            <div className="text-right ml-3">
              <div className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(item.monthly)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">/ mo</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MoneyOutSection({
  items,
  reduced,
}: {
  items: ExpenseItem[];
  reduced: boolean | null;
}) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={<TrendingDown className="h-6 w-6" />}
        title="No spending plan yet"
        body="Add your recurring spending — rent, groceries, utilities, subscriptions — to see where your money goes."
        cta="Add spending"
        href="/dashboard/expenses"
      />
    );
  }

  // Group by category, top 6 by monthly total
  const byCategory = new Map<string, number>();
  items.forEach((it) => {
    const monthly = toMonthly(it.amount, it.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + monthly);
  });
  const ranked = Array.from(byCategory.entries())
    .map(([category, monthly]) => ({ category, monthly }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 6);
  const total = ranked.reduce((sum, r) => sum + r.monthly, 0);

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Top {ranked.length} categor{ranked.length === 1 ? 'y' : 'ies'} by monthly spend
        </p>
        <ManageAllLink href="/dashboard/expenses" label={`Manage all ${items.length}`} />
      </div>
      <div className="space-y-2">
        {ranked.map((cat, idx) => {
          const pct = total > 0 ? (cat.monthly / total) * 100 : 0;
          return (
            <motion.div
              key={cat.category}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.4, ease: appleEase, delay: idx * 0.04 }
              }
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium capitalize">
                  {cat.category.toLowerCase().replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatCurrency(cat.monthly)}
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">/ mo</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                <motion.div
                  initial={reduced ? { width: `${pct}%` } : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.9, ease: appleEase, delay: 0.1 + idx * 0.04 }
                  }
                  className="h-full rounded-full bg-gradient-to-r from-rose-500/70 to-rose-500"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function YourBudgetSection({
  budget,
  reduced,
}: {
  budget: BudgetSnapshot | null;
  reduced: boolean | null;
}) {
  if (!budget) {
    return (
      <SectionEmpty
        icon={<Sparkles className="h-6 w-6" />}
        title="No budget generated yet"
        body="Let our AI estimate a realistic monthly budget based on your household profile — then adjust to your taste."
        cta="Generate budget"
        href="/dashboard/budget-analysis"
      />
    );
  }

  const cards = [
    {
      label: 'Committed',
      value: budget.committedTotal ?? 0,
      hint: 'rent, loans, utilities',
      tone: 'committed',
    },
    {
      label: 'Variable',
      value: budget.variableEstimate ?? 0,
      hint: 'groceries, fuel, household',
      tone: 'variable',
    },
    {
      label: 'Discretionary',
      value: budget.discretionaryTotal ?? 0,
      hint: 'entertainment, hobbies',
      tone: 'discretionary',
    },
  ];

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {budget.status === 'CONFIRMED' ? 'Confirmed plan' : 'Draft estimate'} · target spend per month
          </p>
          {budget.status === 'CONFIRMED' && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              ✓ Confirmed
            </span>
          )}
        </div>
        <ManageAllLink href="/dashboard/budget-analysis" label="Edit budget" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c, idx) => (
          <motion.div
            key={c.label}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.5, ease: appleEase, delay: idx * 0.06 }
            }
            className="rounded-2xl border border-border/40 bg-background/60 p-4 backdrop-blur-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              {c.label}
            </div>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(c.value)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{c.hint}</div>
          </motion.div>
        ))}
      </div>
      {budget.totalEstimated != null && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">Total monthly target</span>
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(budget.totalEstimated)}
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

function PlanPageContent() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [section, setSection] = useState<Section>('in');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [current, setCurrent] = useState<IntelligenceCurrent | null>(null);
  const [income, setIncome] = useState<IncomeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [budget, setBudget] = useState<BudgetSnapshot | null>(null);

  // ALL data sourced from existing canonical APIs. ZERO new endpoints.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);

      try {
        const [intelRes, incomeRes, expensesRes, budgetRes] = await Promise.allSettled([
          fetch('/api/cashflow/intelligence', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/income', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/budget-analysis/latest', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (cancelled) return;

        if (intelRes.status === 'fulfilled' && intelRes.value.ok) {
          const data = await intelRes.value.json();
          // /api/cashflow/intelligence shape: { forecast: { current: {...} } }
          if (data?.forecast?.current) {
            setCurrent(data.forecast.current);
          } else if (data?.data?.forecast?.current) {
            setCurrent(data.data.forecast.current);
          }
        }

        if (incomeRes.status === 'fulfilled' && incomeRes.value.ok) {
          const data = await incomeRes.value.json();
          const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
          setIncome(items);
        }

        if (expensesRes.status === 'fulfilled' && expensesRes.value.ok) {
          const data = await expensesRes.value.json();
          const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
          setExpenses(items);
        }

        if (budgetRes.status === 'fulfilled' && budgetRes.value.ok) {
          const data = await budgetRes.value.json();
          // /api/budget-analysis/latest shape — keep loose to tolerate GRDCS variations
          const snap = data?.data ?? data;
          if (snap && typeof snap === 'object' && Object.keys(snap).length > 0) {
            setBudget(snap as BudgetSnapshot);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load your plan');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Hero values derived from /api/cashflow/intelligence (same source the
  // Cashflow page uses). No local recalculation, no second source of truth.
  const heroIn = current?.income ?? 0;
  const heroOut = current?.expenses ?? 0;
  const heroNet = current?.net ?? heroIn - heroOut;

  // Empowering Apple-voice supporting copy. Doesn't repeat the dollar amount
  // (the hero number shows it) — conveys meaning + next step instead.
  // Reza's note 2026-05-01: must feel engaging and empowering, never warning.
  const headlineSentence = useMemo(() => {
    if (loading || !current) return 'Reading your plan…';
    if (heroNet > 0) return 'Your plan keeps money working for you each month.';
    if (heroNet === 0) return 'Balanced and intentional — every dollar with a job.';
    return 'Your plan runs short this month — tighten one category below to close the gap.';
  }, [loading, current, heroNet]);

  // Hero number: color isolated to the digits. Apple Wallet pattern.
  const heroToneClass =
    heroNet > 0
      ? 'text-emerald-500 dark:text-emerald-400'
      : heroNet < 0
        ? 'text-rose-500 dark:text-rose-400'
        : 'text-foreground';

  // U+2212 minus / U+002B plus — typographically correct.
  const heroSign = heroNet < 0 ? '−' : heroNet > 0 ? '+' : '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* PAGE HEADER */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">My Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your financial intent — what's coming in, what's going out, what you're targeting.
          </p>
        </div>

        {/* HERO — Apple typography (refined 2026-05-01 evening per Reza
             feedback): the hero number is the primary visual, not the
             sentence; the sentence is muted supporting copy. */}
        <GlassCard>
          {/* Atmospheric mesh gradient — softer than v1 to read "calm",
              not "alert". Tone shifts subtly with surplus/shortfall sign. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 1.4, ease: appleEase }}
            style={{
              background:
                heroNet >= 0
                  ? 'radial-gradient(circle at 20% 0%, rgba(16,185,129,0.10), transparent 55%), radial-gradient(circle at 80% 100%, rgba(59,130,246,0.06), transparent 55%)'
                  : 'radial-gradient(circle at 20% 0%, rgba(244,63,94,0.06), transparent 55%), radial-gradient(circle at 80% 100%, rgba(245,158,11,0.05), transparent 55%)',
            }}
          />
          <div className="p-6 sm:p-8 md:p-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 mb-4">
              Your plan · This month
            </p>

            {/* Hero number — Apple-typography */}
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.7, ease: appleEase }}
              className={`text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.04em] tabular-nums leading-none ${heroToneClass}`}
            >
              {heroSign}
              {formatCurrency(Math.abs(heroNet))}
            </motion.div>

            {/* Supporting sentence — muted, refined */}
            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase, delay: 0.18 }
              }
              className="mt-5 text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-xl"
            >
              {headlineSentence}
            </motion.p>

            {/* Money In + Money Out — supporting stats, smaller, neutral
                weight. Sit below a thin separator. The Surplus/Shortfall
                slot is removed because the hero number IS that value. */}
            <div className="mt-8 pt-6 grid grid-cols-2 gap-6 border-t border-border/40">
              {[
                {
                  label: 'Money In',
                  value: heroIn,
                  tone: 'in' as const,
                  icon: <TrendingUp className="h-3 w-3" />,
                },
                {
                  label: 'Money Out',
                  value: heroOut,
                  tone: 'out' as const,
                  icon: <TrendingDown className="h-3 w-3" />,
                },
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.5, ease: appleEase, delay: 0.25 + idx * 0.05 }
                  }
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                    {stat.icon}
                    {stat.label}
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-medium tabular-nums tracking-[-0.02em] ${
                      stat.tone === 'in'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(stat.value)}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* SECTION SELECTOR + CONTENT */}
        <div>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <SegmentedControl value={section} onChange={setSection} reduced={reduced} />
            <p className="text-xs text-muted-foreground">
              Full editing power lives on the detail pages — click <span className="font-medium">Manage all →</span> to dive in.
            </p>
          </div>

          <GlassCard>
            <div className="p-2 sm:p-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex items-center gap-3 px-6 py-12 text-sm text-muted-foreground">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  {error}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={section}
                    initial={reduced ? false : { opacity: 0, filter: 'blur(6px)', y: 6 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)', y: -4 }}
                    transition={reduced ? { duration: 0 } : { duration: 0.45, ease: appleEase }}
                  >
                    {section === 'in' && <MoneyInSection items={income} reduced={reduced} />}
                    {section === 'out' && <MoneyOutSection items={expenses} reduced={reduced} />}
                    {section === 'budget' && <YourBudgetSection budget={budget} reduced={reduced} />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function PlanPage() {
  return <PlanPageContent />;
}
