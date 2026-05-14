'use client';

/**
 * AccountsStep — Phase 12 PR 3a visual redesign + PR 3b data source tiers
 *
 * Captures bank / transaction / savings / offset / credit card accounts.
 *
 * PR 3a: clean redesign using the primitives library.
 * PR 3b: adds the 3-tier data source picker at the top
 *   Tier 1: Basiq — POST /api/basiq/connect → redirect to consent URL.
 *           Draft is autosaved via WizardContainer's normal 1.2s cadence
 *           before the redirect so nothing is lost.
 *   Tier 2: File import — composes the existing Phase 18 ImportWizard in
 *           a dialog. Reuses all the CSV/OFX/QIF parsing. Imported
 *           accounts appear as read-only cards below.
 *   Tier 3: Manual — unchanged quick-add + card grid from PR 3a (just
 *           visually de-ranked behind the other two tiles).
 *
 * Users can freely mix sources. Basiq + Import accounts are marked with
 * `source='BASIQ' | 'IMPORT'` + `existingAccountId`; bulk-create skips
 * writing these since they already exist in the DB. Manual accounts
 * remain `source='MANUAL'` (or undefined for backwards compat) and are
 * created by bulk-create as before.
 */

import React, { useState, useCallback } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  CreditCard,
  Landmark,
  PiggyBank,
  Link2,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  WizardData,
  AccountInput,
  AccountType,
  generateId,
  getLoansFromProperties,
} from '../types';
import {
  WizardStepShell,
  WizardSection,
  WizardField,
  WizardCurrencyField,
  WizardSelectField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import { AccountsDataSourceTiles } from './AccountsDataSourceTiles';
import { useBasiqEnabled } from '@/lib/featureFlags/BasiqGateContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ImportWizard } from '@/components/bank/ImportWizard';
import '@/styles/wizard-animations.css';

// =============================================================================
// ACCOUNT TYPE META
// =============================================================================

interface AccountTypeMeta {
  value: AccountType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const ACCOUNT_TYPES: AccountTypeMeta[] = [
  {
    value: 'TRANSACTIONAL',
    label: 'Transaction',
    description: 'Everyday spending',
    icon: <Wallet className="h-5 w-5" />,
    accent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  },
  {
    value: 'SAVINGS',
    label: 'Savings',
    description: 'High-interest',
    icon: <PiggyBank className="h-5 w-5" />,
    accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    value: 'OFFSET',
    label: 'Offset',
    description: 'Linked to mortgage',
    icon: <Link2 className="h-5 w-5" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  },
  {
    value: 'CREDIT_CARD',
    label: 'Credit card',
    description: 'Balance as debt',
    icon: <CreditCard className="h-5 w-5" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
];

const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

// =============================================================================
// HELPERS
// =============================================================================

function createEmptyAccount(type: AccountType = 'TRANSACTIONAL'): AccountInput {
  return {
    id: generateId(),
    name: '',
    type,
    currentBalance: 0,
    linkedLoanId: undefined,
  };
}

// =============================================================================
// ACCOUNT CARD
// =============================================================================

interface AccountCardProps {
  account: AccountInput;
  availableLoans: Array<{ id: string; name: string; propertyName: string }>;
  onUpdate: (updates: Partial<AccountInput>) => void;
  onRemove: () => void;
}

function AccountCard({ account, availableLoans, onUpdate, onRemove }: AccountCardProps) {
  const meta = ACCOUNT_TYPES.find((t) => t.value === account.type) ?? ACCOUNT_TYPES[0];
  const isCredit = account.type === 'CREDIT_CARD';
  const linkedLoan = availableLoans.find((l) => l.id === account.linkedLoanId);

  return (
    <div className="wz-section">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.accent}`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {meta.label}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove account"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <WizardField
          label="Account name"
          placeholder={isCredit ? 'e.g. Visa platinum' : 'e.g. Everyday account'}
          value={account.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
        <WizardCurrencyField
          label={isCredit ? 'Outstanding balance' : 'Current balance'}
          required
          value={account.currentBalance}
          onChange={(v) => onUpdate({ currentBalance: v })}
          helper={isCredit ? 'Enter as a positive number — we\u2019ll track it as debt.' : undefined}
        />
        <WizardField
          className="sm:col-span-2"
          label="Institution (optional)"
          placeholder="e.g. CommBank, NAB, ANZ"
          value={account.institution || ''}
          onChange={(e) => onUpdate({ institution: e.target.value })}
        />
        <WizardSelectField
          className="sm:col-span-2"
          label="Change type"
          value={account.type}
          onChange={(v) => {
            const newType = v as AccountType;
            onUpdate({
              type: newType,
              linkedLoanId: newType === 'OFFSET' ? account.linkedLoanId : undefined,
            });
          }}
          options={ACCOUNT_TYPE_OPTIONS}
        />
      </div>

      {account.type === 'OFFSET' && (
        <div className="mt-4 rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-900/10 p-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Link2 className="h-3 w-3" />
            Link to a loan
          </label>
          {availableLoans.length > 0 ? (
            <select
              value={account.linkedLoanId || ''}
              onChange={(e) => onUpdate({ linkedLoanId: e.target.value || undefined })}
              className="wz-input"
            >
              <option value="">Select a loan to link</option>
              {availableLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No loans to link yet. Add a property with a mortgage first.
            </p>
          )}
          {linkedLoan && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
              <Building2 className="h-3 w-3" />
              Linked to {linkedLoan.propertyName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// QUICK ADD TILE
// =============================================================================

function QuickAddTile({ meta, onClick }: { meta: AccountTypeMeta; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white/40 p-4 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.accent}`}>
        {meta.icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
          {meta.label}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{meta.description}</div>
      </div>
    </button>
  );
}

// =============================================================================
// ACCOUNTS STEP
// =============================================================================

interface AccountsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function AccountsStep({ data, onUpdate }: AccountsStepProps) {
  const { token } = useAuth();
  const availableLoans = getLoansFromProperties(data.properties);

  // PR 3b: data source tier state
  const [showManual, setShowManual] = useState(
    // If the user already has MANUAL accounts from a resumed draft,
    // keep the manual quick-add surface visible immediately.
    () =>
      data.accounts.some(
        (a) => !a.source || a.source === 'MANUAL'
      ) || data.accounts.length === 0 === false
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [basiqLoading, setBasiqLoading] = useState(false);
  const [basiqError, setBasiqError] = useState<string | null>(null);
  // Admin toggle — hides the "Connect your bank" tile when off.
  const basiqEnabled = useBasiqEnabled();

  // ---- Basiq tier ---------------------------------------------------
  // POST /api/basiq/connect → returns { consentUrl }. We save the draft
  // (WizardContainer autosave handles this on its own cadence, but we
  // also fire a final save here via onUpdate with the unchanged data
  // to trigger the debounced saveDraft), then navigate to the consent
  // URL. Basiq redirects back to /onboarding/basiq-callback which
  // reloads /onboarding with the imported accounts now in the DB.
  const handlePickBasiq = useCallback(async () => {
    if (basiqLoading) return;
    setBasiqError(null);
    setBasiqLoading(true);
    try {
      const response = await fetch('/api/basiq/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start bank connection');
      }
      const body = await response.json();
      const consentUrl = body.consentUrl || body.data?.consentUrl;
      if (!consentUrl || typeof consentUrl !== 'string') {
        throw new Error('No consent URL returned from Basiq');
      }
      // Navigate to Basiq consent. The user will be redirected back to
      // /app/onboarding/basiq-callback (handled in a follow-up commit).
      window.location.href = consentUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setBasiqError(msg);
      setBasiqLoading(false);
    }
  }, [basiqLoading, token]);

  // ---- Import tier --------------------------------------------------
  // Open the existing Phase 18 ImportWizard in a dialog. When the user
  // completes a successful import, the imported Account already exists
  // in the DB — we fetch it and add a display-pointer row to the
  // wizard data so the user sees their imported accounts alongside any
  // manual ones, and bulk-create knows to skip them.
  const handlePickImport = useCallback(() => {
    setImportDialogOpen(true);
  }, []);

  // ImportWizard's onAccountCreated callback now forwards the real
  // currentBalance — either the value the user typed in the inline
  // "Create New Account" panel or the closing-balance anchor that the
  // server auto-creates from the file. Either way, we use it instead
  // of a $0 placeholder so the AccountCard and the Cash/Net summary
  // tiles reflect what's actually in the DB.
  //
  // bulk-create still skips writing source='IMPORT' accounts (they
  // already exist with the correct balance), so this value is purely
  // for display in the wizard.
  const handleImportAccountCreated = useCallback(
    (created: {
      id: string;
      name: string;
      type: string;
      currentBalance?: number;
    }) => {
      const newRow: AccountInput = {
        id: generateId(),
        name: created.name,
        type: (created.type as AccountType) || 'TRANSACTIONAL',
        currentBalance:
          typeof created.currentBalance === 'number'
            ? created.currentBalance
            : 0,
        source: 'IMPORT',
        existingAccountId: created.id,
      };
      onUpdate({ accounts: [...data.accounts, newRow] });
    },
    [data.accounts, onUpdate]
  );

  const handleImportComplete = useCallback(() => {
    setImportDialogOpen(false);
  }, []);

  // ---- Manual tier --------------------------------------------------
  const handlePickManual = useCallback(() => {
    setShowManual(true);
  }, []);

  const addAccount = (type: AccountType = 'TRANSACTIONAL') => {
    onUpdate({ accounts: [...data.accounts, createEmptyAccount(type)] });
  };

  const updateAccount = (accountId: string, updates: Partial<AccountInput>) => {
    onUpdate({
      accounts: data.accounts.map((a) => (a.id === accountId ? { ...a, ...updates } : a)),
    });
  };

  const removeAccount = (accountId: string) => {
    onUpdate({ accounts: data.accounts.filter((a) => a.id !== accountId) });
  };

  // Summary
  const cashAssets = data.accounts
    .filter((a) => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const creditDebt = data.accounts
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const net = cashAssets - creditDebt;

  return (
    <WizardStepShell
      icon={<Landmark className="h-8 w-8" strokeWidth={1.5} />}
      title="Bank accounts"
      subtitle="Where your money lives. This is the first step on your TRAIL — Track your full picture."
    >
      {/* PR 3b: 3-tier data source picker — always visible above the
          manual quick-add. Tiles are interactive buttons. */}
      <AccountsDataSourceTiles
        basiqLoading={basiqLoading}
        importOpen={importDialogOpen}
        // Pass the admin-flag value so the picker hides its Basiq tile
        // when the BASIQ_INTEGRATION switch is OFF.
        basiqEnabled={basiqEnabled}
        onPickBasiq={handlePickBasiq}
        onPickImport={handlePickImport}
        onPickManual={handlePickManual}
      />

      {basiqError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Couldn&apos;t start the bank connection.</strong> {basiqError}
            <br />
            You can try again or pick a different option above.
          </div>
        </div>
      )}

      {/* Manual tier quick-add — only shown after the user explicitly
          picks the Manual tile, OR if they already have manual accounts
          from a resumed draft. */}
      {showManual && data.accounts.length === 0 && (
        <WizardSection
          title="Quick add"
          description="Start with the account type you use most."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ACCOUNT_TYPES.map((type) => (
              <QuickAddTile key={type.value} meta={type} onClick={() => addAccount(type.value)} />
            ))}
          </div>
        </WizardSection>
      )}

      {data.accounts.length > 0 && (
        <div className="space-y-3">
          {data.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              availableLoans={availableLoans}
              onUpdate={(updates) => updateAccount(account.id, updates)}
              onRemove={() => removeAccount(account.id)}
            />
          ))}
        </div>
      )}

      {data.accounts.length > 0 && (
        <WizardAddButton
          leadingIcon={<Plus className="h-4 w-4" />}
          onClick={() => addAccount()}
        >
          Add another account
        </WizardAddButton>
      )}

      {data.accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile
            label="Cash"
            value={formatCurrency(cashAssets, { abbreviate: true })}
            accent="emerald"
          />
          <SummaryTile
            label="Credit debt"
            value={formatCurrency(creditDebt, { abbreviate: true })}
            accent="amber"
          />
          <SummaryTile
            label="Net"
            value={formatCurrency(net, { abbreviate: true })}
            accent={net >= 0 ? 'blue' : 'rose'}
          />
        </div>
      )}

      {data.accounts.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          We recommend adding at least one account for accurate cashflow tracking.
        </p>
      )}

      {/* PR 3b: Import wizard composed in a dialog. ImportWizard creates
          Account rows in the DB directly; we listen to onAccountCreated
          to track the row ID, then mark it as source='IMPORT' in the
          wizard data so bulk-create skips writing it. */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload a transaction file</DialogTitle>
            <DialogDescription>
              CSV, OFX or QIF from your bank&apos;s export. We&apos;ll parse it and
              create an account with the closing balance as the anchor point.
            </DialogDescription>
          </DialogHeader>
          {/* ImportWizard expects an `accounts` prop (existing accounts to
              import into) and calls `onAccountCreated` when the user
              creates a new account during the flow. We pass only the
              already-persisted Basiq/Import rows from the wizard data —
              manual rows are temp IDs and can't be imported into. */}
          <ImportWizard
            accounts={data.accounts
              .filter((a) => a.existingAccountId)
              .map((a) => ({
                id: a.existingAccountId!,
                name: a.name || 'Account',
                type: a.type,
                currentBalance: a.currentBalance,
              }))}
            onAccountCreated={handleImportAccountCreated}
            onComplete={handleImportComplete}
            onClose={() => setImportDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </WizardStepShell>
  );
}

// =============================================================================
// SUMMARY TILE
// =============================================================================

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
}) {
  const accentClass = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-3 text-center">
      <div className={`text-xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export default AccountsStep;
