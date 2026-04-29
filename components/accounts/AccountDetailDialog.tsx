'use client';

/**
 * AccountDetailDialog — shared account detail modal.
 *
 * Extracted from `/dashboard/accounts/page.tsx` so the same Overview /
 * Transactions / Offset Details / Linked tab structure can be opened
 * from any page (currently used by `/dashboard/accounts` and
 * `/dashboard/balances`).
 *
 * Phase 1 of the "make the accounts page redundant" plan: previously
 * clicking an account row on `/dashboard/balances` navigated to
 * `/dashboard/accounts#<id>` (which didn't auto-open the dialog —
 * the user had to click the tile a second time). Now Balances
 * renders this dialog inline so a single click is enough.
 *
 * The dialog is pure presentation. Side-effects the parent must
 * handle through callbacks:
 *   - `onEdit`             — open the edit form for this account
 *   - `onImportClick`      — open the parent's import dialog
 *                            (caller keeps the import state because
 *                            `TransactionImportDialog` needs the full
 *                            accounts list and an onImportComplete
 *                            handler that knows the current page)
 *   - `onLinkedEntityNavigate` — handle GRDCS Linked-tab clicks
 *
 * Calculations (offset interest savings, effective loan balance)
 * are imported from the canonical `lib/utils/calculations.ts`
 * (CLAUDE.md §12.2 SSOT). Do NOT redefine them here.
 */

import {
  Wallet,
  Edit2,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Link2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { LinkedDataPanel } from '@/components/LinkedDataPanel';
import type { GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import { formatCurrency } from '@/lib/utils/formatters';
// SSOT (CLAUDE.md §12.2): use the existing canonical primitive in
// lib/utils/calculations.ts. The legacy `calculateEffectiveLoanBalance`
// helper this dialog used to define locally was structurally
// identical — same `Math.max(0, principal - offsetBalance)` math.
// Interest-savings math is preserved EXACTLY as the legacy /dashboard/accounts
// page had it (per user direction: existing calculations are
// correct, this Phase 1 is purely visual/flow).
import { calculateEffectivePrincipal } from '@/lib/utils/calculations';

// =============================================================================
// TYPES
// =============================================================================

export interface AccountDetailTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category?: string | null;
}

export interface AccountDetailLinkedLoan {
  id: string;
  name: string;
  principal: number;
  interestRateAnnual: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
}

export interface AccountDetail {
  id: string;
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  institution?: string | null;
  currentBalance: number;
  interestRate?: number | null;
  transactions?: AccountDetailTransaction[];
  linkedLoan?: AccountDetailLinkedLoan | null;
  _links?: {
    self: string;
    related: GRDCSLinkedEntity[];
  };
  _meta?: {
    linkedCount: number;
    missingLinks: GRDCSMissingLink[];
  };
}

interface AccountDetailDialogProps {
  account: AccountDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user clicks "Edit Account" in the footer. */
  onEdit?: (account: AccountDetail) => void;
  /**
   * Called when the user clicks the import button in the Transactions
   * tab. When omitted, the import button is hidden — useful for
   * callers (like the dashboard balances page) that don't yet host
   * the TransactionImportDialog.
   */
  onImportClick?: () => void;
  /** GRDCS Linked tab navigation handler. */
  onLinkedEntityNavigate?: (entity: GRDCSLinkedEntity) => void;
}

const TX_PER_PAGE = 20;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Annual interest a user is saving by holding this offset balance
 * against the linked loan. Preserves the legacy
 * `/dashboard/accounts` formula EXACTLY:
 *   `offsetBalance × loanAnnualRate`
 *
 * Per user direction (2026-04-29): the existing calculations on
 * the legacy and current pages are correct — this Phase 1 is
 * purely visual / flow, no calculation changes. This wrapper only
 * exists because the dialog needs to consult it in two places.
 */
function offsetSavingsFor(account: AccountDetail): number {
  if (account.type !== 'OFFSET' || !account.linkedLoan) return 0;
  return account.currentBalance * account.linkedLoan.interestRateAnnual;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AccountDetailDialog({
  account,
  open,
  onOpenChange,
  onEdit,
  onImportClick,
  onLinkedEntityNavigate,
}: AccountDetailDialogProps) {
  const [txPage, setTxPage] = useState(1);

  // Reset pagination when the dialog opens for a different account.
  // (Otherwise switching from a 3-page account to a 1-page one would
  // strand the user on a non-existent page 3.)
  const accountIdKey = account?.id ?? null;
  const [lastIdKey, setLastIdKey] = useState<string | null>(null);
  if (accountIdKey !== lastIdKey) {
    setLastIdKey(accountIdKey);
    if (txPage !== 1) setTxPage(1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {account?.name}
          </DialogTitle>
          <DialogDescription>
            Account details and transactions
          </DialogDescription>
        </DialogHeader>

        {account && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList
              className={`grid w-full ${
                account.type === 'OFFSET' ? 'grid-cols-4' : 'grid-cols-3'
              }`}
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              {account.type === 'OFFSET' && (
                <TabsTrigger value="offset">Offset Details</TabsTrigger>
              )}
              <TabsTrigger value="linked" className="gap-1">
                <Link2 className="h-3 w-3" />
                Linked
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Current Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className={`text-2xl font-bold ${
                        account.currentBalance >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(account.currentBalance)}
                    </p>
                  </CardContent>
                </Card>

                {account.interestRate && account.type !== 'OFFSET' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Interest Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {(account.interestRate * 100).toFixed(2)}%
                      </p>
                      <p className="text-sm text-muted-foreground">p.a.</p>
                    </CardContent>
                  </Card>
                )}

                {account.type === 'OFFSET' && account.linkedLoan && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Interest Savings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(offsetSavingsFor(account))}
                      </p>
                      <p className="text-sm text-muted-foreground">per year</p>
                    </CardContent>
                  </Card>
                )}

                {account.type === 'SAVINGS' && account.interestRate && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Annual Interest
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(
                          account.currentBalance * account.interestRate
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">estimated</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{account.type}</span>
                  </div>
                  {account.institution && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Institution</span>
                      <span className="font-medium">{account.institution}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transactions</span>
                    <span className="font-medium">
                      {account.transactions?.length || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4 pt-4">
              {onImportClick && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={onImportClick}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Transactions
                  </Button>
                </div>
              )}

              {account.transactions && account.transactions.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const totalTx = account.transactions?.length || 0;
                    const totalPages = Math.ceil(totalTx / TX_PER_PAGE);
                    const startIdx = (txPage - 1) * TX_PER_PAGE;
                    const endIdx = startIdx + TX_PER_PAGE;
                    const paginatedTx =
                      account.transactions?.slice(startIdx, endIdx) || [];

                    return (
                      <>
                        {paginatedTx.map((tx) => (
                          <Card key={tx.id}>
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div className="flex items-start gap-3">
                                  {tx.type === 'CREDIT' ? (
                                    <ArrowDownRight className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                                  )}
                                  <div>
                                    <p className="font-medium">
                                      {tx.description}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(tx.date)}
                                    </p>
                                    {tx.category && (
                                      <Badge variant="outline" className="mt-1">
                                        {tx.category}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <p
                                  className={`font-semibold ${
                                    tx.type === 'CREDIT'
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {tx.type === 'CREDIT' ? '+' : '-'}
                                  {formatCurrency(Math.abs(tx.amount), { showCents: true })}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                              disabled={txPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Page {txPage} of {totalPages} ({totalTx} transactions)
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setTxPage((p) => Math.min(totalPages, p + 1))
                              }
                              disabled={txPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        )}

                        {totalPages === 1 && (
                          <p className="text-center text-sm text-muted-foreground pt-2">
                            {totalTx} transaction{totalTx !== 1 ? 's' : ''}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions recorded</p>
                  {onImportClick && (
                    <>
                      <p className="text-sm mb-4">
                        Import a QIF or CSV file to get started
                      </p>
                      <Button onClick={onImportClick}>
                        <Upload className="h-4 w-4 mr-2" />
                        Import Transactions
                      </Button>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            {account.type === 'OFFSET' && (
              <TabsContent value="offset" className="space-y-4 pt-4">
                {account.linkedLoan ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Landmark className="h-5 w-5" />
                          {account.linkedLoan.name}
                        </CardTitle>
                        <CardDescription>Linked loan details</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Loan Principal
                            </p>
                            <p className="text-xl font-bold">
                              {formatCurrency(account.linkedLoan.principal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Interest Rate
                            </p>
                            <p className="text-xl font-bold">
                              {(
                                account.linkedLoan.interestRateAnnual * 100
                              ).toFixed(2)}
                              %
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Rate Type
                            </p>
                            <Badge variant="outline">
                              {account.linkedLoan.rateType}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Repayment Type
                            </p>
                            <Badge variant="outline">
                              {account.linkedLoan.isInterestOnly
                                ? 'Interest Only'
                                : 'P&I'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200">
                      <CardHeader>
                        <CardTitle className="text-sm text-green-800">
                          Offset Calculation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Loan Principal
                            </p>
                            <p className="font-semibold">
                              {formatCurrency(account.linkedLoan.principal)}
                            </p>
                          </div>
                          <span className="text-2xl text-green-600">−</span>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Offset Balance
                            </p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(account.currentBalance)}
                            </p>
                          </div>
                          <span className="text-2xl">=</span>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Effective Balance
                            </p>
                            <p className="font-semibold">
                              {formatCurrency(
                                calculateEffectivePrincipal(account.linkedLoan.principal, account.currentBalance)
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-green-200">
                          <div className="flex justify-between">
                            <span className="text-green-800">
                              Annual Interest Savings
                            </span>
                            <span className="font-bold text-green-600">
                              {formatCurrency(offsetSavingsFor(account))}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Monthly Savings
                            </span>
                            <span className="font-medium text-green-600">
                              {formatCurrency(
                                offsetSavingsFor(account) / 12
                              )}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No loan linked to this offset account</p>
                    <p className="text-sm">
                      Link this account to a loan from the Loans page
                    </p>
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="linked" className="mt-4">
              <LinkedDataPanel
                linkedEntities={account._links?.related || []}
                missingLinks={account._meta?.missingLinks || []}
                entityType="account"
                entityName={account.name}
                showHealthScore={true}
                onNavigate={onLinkedEntityNavigate}
              />
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && account && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onEdit(account);
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Account
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AccountDetailDialog;
