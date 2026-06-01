'use client';

/**
 * My Wealth → Superannuation (TRAIL Stage I — Invest), Phase 39.4.
 *
 * Gives everyday (retail/industry) super a first-class post-onboarding home.
 * Previously super was only capturable in the onboarding wizard (SuperStep)
 * and shown read-only on the Tax page — there was no surface to add/manage a
 * fund after onboarding. This page reuses the existing /api/tax/super
 * endpoints (GET + POST here, PUT/DELETE on /[id]) — no new snapshot or
 * aggregation logic (CLAUDE.md §12.2/§12.4).
 *
 * Design: mirrors the Investments/Properties glass vocabulary
 * (CLAUDE.md §18.7.2) — InvestmentsHero (reused), SuperAccountTile,
 * SuperCapMeter. Stitch screens 1c01d0c1… (desktop) / e7a87730… (mobile).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Landmark, Plus, Lightbulb, Edit2, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { InvestmentsHero, type InvestmentsHeroSegment } from '@/components/investments/InvestmentsHero';
import { SuperAccountTile } from '@/components/wealth/SuperAccountTile';
import { SuperCapMeter } from '@/components/wealth/SuperCapMeter';

interface SuperContributionRow {
  id: string;
  type: string;
  amount: number;
  date: string;
  employerName: string | null;
}

interface SuperAccount {
  id: string;
  name: string;
  fundName: string | null;
  memberNumber: string | null;
  currentBalance: number;
  taxableComponent: number;
  taxFreeComponent: number;
  investmentOption: string | null;
  returns1Year: number | null;
  returns5Year: number | null;
  contributions?: {
    employerSG: number;
    salarySacrifice: number;
    personalDeductible: number;
    personalNonDeductible: number;
    totalConcessional: number;
    totalNonConcessional: number;
  };
  recentContributions?: SuperContributionRow[];
}

interface SuperPosition {
  financialYear: string;
  summary: { totalBalance: number; taxableComponent: number; taxFreeComponent: number; accountCount: number };
  caps: {
    concessional: { cap: number; used: number; remaining: number; percentageUsed: number };
    nonConcessional: { cap: number; used: number; remaining: number; percentageUsed: number };
  };
  accounts: SuperAccount[];
  optimization: { recommendedSalarySacrifice: number; taxSavings: number; explanation: string } | null;
}

type SuperFormData = {
  name: string;
  fundName: string;
  memberNumber: string;
  fundABN: string;
  investmentOption: string;
  currentBalance: number;
  taxFreeComponent: number;
  taxableComponent: number;
};

const EMPTY_FORM: SuperFormData = {
  name: '',
  fundName: '',
  memberNumber: '',
  fundABN: '',
  investmentOption: '',
  currentBalance: 0,
  taxFreeComponent: 0,
  taxableComponent: 0,
};

// Per-fund hero allocation segment styles — cycle through the Stage I family.
const SEGMENT_STYLES = [
  { barClass: 'bg-gradient-to-r from-indigo-400 to-violet-500', dotClass: 'bg-indigo-500', chipClass: 'text-indigo-700 dark:text-indigo-300' },
  { barClass: 'bg-gradient-to-r from-sky-400 to-indigo-500', dotClass: 'bg-sky-500', chipClass: 'text-sky-700 dark:text-sky-300' },
  { barClass: 'bg-gradient-to-r from-violet-400 to-purple-500', dotClass: 'bg-violet-500', chipClass: 'text-violet-700 dark:text-violet-300' },
  { barClass: 'bg-gradient-to-r from-cyan-400 to-sky-500', dotClass: 'bg-cyan-500', chipClass: 'text-cyan-700 dark:text-cyan-300' },
];

export default function SuperannuationPage() {
  const { token } = useAuth();

  const [position, setPosition] = useState<SuperPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SuperFormData>(EMPTY_FORM);
  const [detailAccount, setDetailAccount] = useState<SuperAccount | null>(null);

  useEffect(() => {
    if (token) loadPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadPosition = async () => {
    try {
      const response = await fetch('/api/tax/super', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setPosition(await response.json());
      }
    } catch (error) {
      console.error('Error loading superannuation position:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => setFormData(EMPTY_FORM);

  const handleAdd = () => {
    setEditingId(null);
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (account: SuperAccount) => {
    setFormData({
      name: account.name,
      fundName: account.fundName || '',
      memberNumber: account.memberNumber || '',
      fundABN: '',
      investmentOption: account.investmentOption || '',
      currentBalance: account.currentBalance,
      taxFreeComponent: account.taxFreeComponent,
      taxableComponent: account.taxableComponent,
    });
    setEditingId(account.id);
    setShowDialog(true);
  };

  const handleViewDetails = (account: SuperAccount) => {
    setDetailAccount(account);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/tax/super/${editingId}` : '/api/tax/super';
    const method = editingId ? 'PUT' : 'POST';
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formData.name,
          fundName: formData.fundName || undefined,
          memberNumber: formData.memberNumber || undefined,
          fundABN: formData.fundABN || undefined,
          investmentOption: formData.investmentOption || undefined,
          currentBalance: formData.currentBalance || 0,
          taxFreeComponent: formData.taxFreeComponent || 0,
          taxableComponent: formData.taxableComponent || 0,
        }),
      });
      if (response.ok) {
        await loadPosition();
        setShowDialog(false);
        setEditingId(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving superannuation account:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this super fund?')) return;
    try {
      await fetch(`/api/tax/super/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadPosition();
    } catch (error) {
      console.error('Error deleting superannuation account:', error);
    }
  };

  const accounts = position?.accounts ?? [];
  const summary = position?.summary;
  const caps = position?.caps;

  const heroSegments: InvestmentsHeroSegment[] = accounts
    .filter((a) => a.currentBalance > 0)
    .map((a, i) => {
      const style = SEGMENT_STYLES[i % SEGMENT_STYLES.length];
      return {
        id: a.id,
        label: a.fundName || a.name,
        count: 1,
        value: a.currentBalance,
        ...style,
      };
    });

  // Warm, non-shaming headroom note (behaviour-psychology lens, §0.1): the
  // optimisation engine's explanation when present, else a plain-English
  // "here's your remaining cap" celebration of the next achievable action.
  const concessionalRemaining = caps?.concessional.remaining ?? 0;
  const insight =
    position?.optimization?.explanation ||
    (concessionalRemaining > 0
      ? `You have ${formatCurrency(concessionalRemaining)} of concessional cap remaining this year. Salary sacrificing into super can reduce your taxable income.`
      : null);

  return (
    <DashboardLayout>
      <PageHeader
        title="Superannuation"
        description="Your retirement is wealth too — track every fund, balance, and contribution cap in one place."
        action={
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add super fund
          </Button>
        }
      />

      {/* Premium hero summary — reuses InvestmentsHero (Stage I palette) */}
      {!isLoading && summary && accounts.length > 0 && (
        <div className="mb-6">
          <InvestmentsHero
            title="Your super"
            total={summary.totalBalance}
            subtitle={`${summary.accountCount} ${summary.accountCount === 1 ? 'fund' : 'funds'}`}
            kpis={[
              { label: 'Total balance', value: formatCurrency(summary.totalBalance) },
              { label: 'Tax-free', value: formatCurrency(summary.taxFreeComponent), accent: 'emerald' },
              { label: 'Concessional used', value: `${caps?.concessional.percentageUsed ?? 0}%` },
            ]}
            segments={heroSegments}
            segmentsLabel="Allocation by fund"
          />
        </div>
      )}

      {/* Contribution caps — shared SuperCapMeter (SSOT with the Tax page) */}
      {!isLoading && caps && accounts.length > 0 && (
        <div className="mb-6 rounded-[22px] border border-indigo-300/30 dark:border-indigo-400/15 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Contribution caps</h2>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {position?.financialYear}
            </span>
          </div>
          <SuperCapMeter
            concessional={{ used: caps.concessional.used, cap: caps.concessional.cap }}
            nonConcessional={{ used: caps.nonConcessional.used, cap: caps.nonConcessional.cap }}
          />
          {insight && (
            <div className="mt-5 flex gap-2.5 rounded-[14px] border border-amber-400/20 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{insight}</p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your super…</p>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Add your first super fund"
          description="Bring your super into the picture to track your balance, your tax-free and taxable components, and how much concessional cap you have left this year."
          action={{ label: 'Add super fund', onClick: handleAdd }}
        />
      ) : (
        /* Tiles — sticky-stack on mobile, grid on desktop (matches Investments,
           PRs #916/#918/#919). Opaque backing because the tile is translucent. */
        <div className="max-md:space-y-5 md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {accounts.map((account, idx) => (
            <div
              key={account.id}
              className="max-md:sticky max-md:overflow-hidden max-md:rounded-[22px] max-md:bg-editorial-ivory max-md:shadow-[0_-6px_24px_-8px_rgba(0,0,0,0.45)]"
              style={{ top: `calc(7.5rem + ${idx * 0.75}rem)` }}
            >
              <SuperAccountTile
                index={idx}
                account={account}
                onView={() => handleViewDetails(account)}
                onEdit={() => handleEdit(account)}
                onDelete={() => handleDelete(account.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[500px]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingId ? 'Edit super fund' : 'Add super fund'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update your fund details below.' : 'Enter the details for your super fund.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
            <div className="space-y-2">
              <Label htmlFor="fundName">Fund name</Label>
              <Input
                id="fundName"
                value={formData.fundName}
                onChange={(e) => setFormData({ ...formData, fundName: e.target.value })}
                placeholder="e.g. AustralianSuper"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nickname</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. My Super"
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="memberNumber">Member number</Label>
                <Input
                  id="memberNumber"
                  value={formData.memberNumber}
                  onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fundABN">Fund ABN</Label>
                <Input
                  id="fundABN"
                  value={formData.fundABN}
                  onChange={(e) => setFormData({ ...formData, fundABN: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="investmentOption">Investment option</Label>
              <Input
                id="investmentOption"
                value={formData.investmentOption}
                onChange={(e) => setFormData({ ...formData, investmentOption: e.target.value })}
                placeholder="e.g. Balanced, High Growth"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentBalance">Current balance</Label>
              <Input
                id="currentBalance"
                type="number"
                min="0"
                step="0.01"
                value={formData.currentBalance || 0}
                onChange={(e) => setFormData({ ...formData, currentBalance: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxFreeComponent">Tax-free component</Label>
                <Input
                  id="taxFreeComponent"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxFreeComponent || 0}
                  onChange={(e) => setFormData({ ...formData, taxFreeComponent: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxableComponent">Taxable component</Label>
                <Input
                  id="taxableComponent"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxableComponent || 0}
                  onChange={(e) => setFormData({ ...formData, taxableComponent: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? 'Update fund' : 'Add fund'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog — read-only overview + contributions */}
      <Dialog open={!!detailAccount} onOpenChange={(open) => !open && setDetailAccount(null)}>
        <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-[640px]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              {detailAccount?.fundName || detailAccount?.name}
            </DialogTitle>
            <DialogDescription>
              {detailAccount?.fundName && detailAccount?.name !== detailAccount?.fundName
                ? detailAccount.name
                : 'Super fund details'}
            </DialogDescription>
          </DialogHeader>

          {detailAccount && (
            <Tabs defaultValue="overview" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contributions">Contributions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatCurrency(detailAccount.currentBalance)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DetailStat label="Tax-free" value={formatCurrency(detailAccount.taxFreeComponent)} />
                  <DetailStat label="Taxable" value={formatCurrency(detailAccount.taxableComponent)} />
                  {typeof detailAccount.returns1Year === 'number' && (
                    <DetailStat
                      label="1-year return"
                      value={`${detailAccount.returns1Year >= 0 ? '+' : ''}${detailAccount.returns1Year.toFixed(1)}%`}
                      accent={detailAccount.returns1Year >= 0 ? 'emerald' : 'amber'}
                    />
                  )}
                  {typeof detailAccount.returns5Year === 'number' && (
                    <DetailStat
                      label="5-year return"
                      value={`${detailAccount.returns5Year >= 0 ? '+' : ''}${detailAccount.returns5Year.toFixed(1)}%`}
                      accent={detailAccount.returns5Year >= 0 ? 'emerald' : 'amber'}
                    />
                  )}
                </div>

                <div className="space-y-2 rounded-[14px] border border-foreground/[0.06] bg-background/40 p-4">
                  <DetailRow label="Fund" value={detailAccount.fundName || '—'} />
                  <DetailRow label="Nickname" value={detailAccount.name} />
                  <DetailRow label="Member number" value={detailAccount.memberNumber || '—'} />
                  <DetailRow label="Investment option" value={detailAccount.investmentOption || '—'} />
                </div>
              </TabsContent>

              <TabsContent value="contributions" className="space-y-4 pt-4">
                {detailAccount.contributions && (
                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Concessional (YTD)" value={formatCurrency(detailAccount.contributions.totalConcessional)} />
                    <DetailStat label="Non-concessional (YTD)" value={formatCurrency(detailAccount.contributions.totalNonConcessional)} />
                  </div>
                )}

                {detailAccount.recentContributions && detailAccount.recentContributions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent contributions</p>
                    {detailAccount.recentContributions.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-[12px] border border-foreground/[0.06] bg-background/40 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{formatContributionType(c.type)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {c.employerName ? ` · ${c.employerName}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <PiggyBank className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    <p className="text-sm">No contributions recorded yet.</p>
                    <p className="text-xs">Contributions sync from your linked income and super activity.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex flex-shrink-0 justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDetailAccount(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                const acct = detailAccount;
                setDetailAccount(null);
                if (acct) handleEdit(acct);
              }}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit fund
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function DetailStat({
  label,
  value,
  accent = 'neutral',
}: {
  label: string;
  value: string;
  accent?: 'neutral' | 'emerald' | 'amber';
}) {
  const tone =
    accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-300'
      : accent === 'amber'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-foreground';
  return (
    <div className="rounded-[12px] border border-foreground/[0.06] bg-background/40 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Format a SuperContributionType enum value into plain English. */
function formatContributionType(type: string): string {
  const map: Record<string, string> = {
    EMPLOYER_SG: 'Employer SG',
    SALARY_SACRIFICE: 'Salary sacrifice',
    PERSONAL_DEDUCTIBLE: 'Personal (deductible)',
    PERSONAL_NON_DEDUCTIBLE: 'Personal (after-tax)',
    SPOUSE: 'Spouse contribution',
    GOVERNMENT_CO_CONTRIBUTION: 'Government co-contribution',
    DOWNSIZER: 'Downsizer contribution',
  };
  return map[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}
