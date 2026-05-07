'use client';

/**
 * Phase 41f.4 — /dashboard/entities/[id]/trust-deed
 *
 * 4-step confirm-before-apply trust-deed parser surface (per spec doc §7):
 *
 *   1. UPLOAD — drag-and-drop or file picker for the deed PDF
 *   2. EXTRACT — Vision OCR (via unpdf) + Gemini structurer; status =
 *      EXTRACTED on completion
 *   3. REVIEW — beneficiaries + distributionRules + UNCOMPUTED notes
 *      rendered with confidence chips; user can edit before confirming
 *   4. APPLY — user clicks Confirm; status flips to CONFIRMED; Phase
 *      41e.4 + 41e.5 tax engines now consume the rules
 *
 * Per spec doc §1.1 — the surface explicitly states what we DO and
 * DON'T do. No legal-document generation; never modifies the user's
 * PDF; the user can reject at any time before Confirm.
 *
 * Behaviour-psychology lens: the surface frames the AI extraction as
 * a STARTING POINT, not the source of truth. Every rule has visible
 * confidence; every uncertain clause surfaces as UNCOMPUTED with the
 * verbatim source text + plain-English rationale.
 *
 * Deferred to v2: inline rule editing (PATCH endpoint exists but UI
 * shows read-only-with-Confirm-or-Reject for v1; user with edits
 * uses the existing PATCH endpoint via API or rejects + re-uploads).
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Scale,
  Users,
  Coins,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface RulesPayload {
  id: string;
  legalEntityId: string;
  uploadedDocumentId: string;
  extractedAt: string;
  extractorVersion: string;
  status: 'EXTRACTED' | 'CONFIRMED' | 'REJECTED';
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  beneficiaries: Array<{
    name: string;
    type: string;
    percentageEntitlement: number | null;
    conditions: string | null;
    confidence: number;
    sourceClause: string | null;
  }>;
  distributionRules: Array<{
    type: string;
    description: string;
    allocations: Array<{ beneficiaryName: string; share: number | null }> | null;
    confidence: number;
    sourceClause: string | null;
  }>;
  vestingDate: string | null;
  trusteePower: {
    appointor: string | null;
    removalRights: string | null;
    amendmentClause: string | null;
    confidence: number;
  } | null;
  loanProvisions: Array<{
    type: string;
    description: string;
    confidence: number;
  }> | null;
  uncomputedNotes: Array<{
    id: string;
    rationale: string;
    sourceText: string;
    sourceClause: string | null;
  }>;
}

interface StatusPayload {
  configured: boolean;
  entity: { id: string; name: string; type: string };
  rules: RulesPayload | null;
  document: {
    id: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  } | null;
}

const ERROR_HINTS: Record<string, string> = {
  NOT_A_TRUST_ENTITY: 'Trust-deed parsing is only available for Discretionary Trust or Unit Trust entities.',
  GEMINI_NOT_CONFIGURED: 'The trust-deed parser is being set up. Please check back soon.',
  NOT_A_PDF: 'Please upload a PDF file.',
  PDF_TOO_LARGE: 'PDF file is too large (max 25 MB).',
  PDF_PARSE_ERROR: 'We could not read this PDF. Try a different file or contact support.',
  EMPTY_PDF: 'This PDF appears to be empty.',
  SCANNED_PDF_DETECTED: 'This PDF appears to be a scan/image rather than typeset text. Image-based trust deeds are coming in a follow-up — please supply a typeset PDF for now.',
  EXTRACTION_FAILED: 'The AI extraction failed. Please try again or contact support.',
  SCHEMA_INVALID: 'The AI returned data we could not parse. Please try again.',
};

const CONFIDENCE_THRESHOLD = 0.7;

export default function TrustDeedPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const entityId = params?.id;

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!entityId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/trust-deed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setStatus((await res.json()) as StatusPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trust-deed status');
    } finally {
      setLoading(false);
    }
  }, [entityId, token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async (file: File) => {
    if (!entityId || !token) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/entities/${entityId}/trust-deed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as
        | { rules: RulesPayload }
        | { error: string; code?: string };
      if (!res.ok || !('rules' in json)) {
        const code = 'code' in json ? json.code : undefined;
        const msg = (code && ERROR_HINTS[code]) ?? ('error' in json ? json.error : `HTTP ${res.status}`);
        throw new Error(msg);
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!entityId || !token || !status?.rules) return;
    if (!confirm('Confirm these extracted rules? Once confirmed, the Phase 41e tax engines (Div 6E streaming + s100A zone classifier) will use them as input. You can re-upload the deed to revise.')) {
      return;
    }
    await transition('CONFIRM');
  };

  const handleReject = async () => {
    if (!entityId || !token || !status?.rules) return;
    const reason = prompt('Why are you rejecting this extraction? (Optional but useful for audit)');
    if (reason === null) return; // User cancelled
    await transition('REJECT', reason || undefined);
  };

  const transition = async (action: 'CONFIRM' | 'REJECT', rejectionReason?: string) => {
    if (!entityId || !token || !status?.rules) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/trust-deed/${status.rules.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, rejectionReason }),
      });
      const json = (await res.json()) as
        | { rules: RulesPayload }
        | { error: string; code?: string };
      if (!res.ok || !('rules' in json)) {
        const msg = 'error' in json ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Trust deed parsing"
        description="Upload your trust deed and we'll extract its structural rules. You confirm each rule before any tax calculation uses them. Your deed stays unchanged — we just read it."
        action={
          <Link
            href="/dashboard/entities"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Structure
          </Link>
        }
      />

      <div className="space-y-6">
        {loading && (
          <Card>
            <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </CardContent>
          </Card>
        )}

        {!loading && status && (
          <>
            <EntitySummaryCard entity={status.entity} />

            {!status.configured && <NotConfiguredCard />}

            {status.configured && !status.rules && (
              <UploadCard onUpload={handleUpload} disabled={uploading} />
            )}

            {status.configured && status.rules && (
              <RulesReviewCards
                rules={status.rules}
                document={status.document}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onReupload={() => fetchStatus()}
                disabled={actionLoading || uploading}
              />
            )}

            <ScopeBoundaryCard />
          </>
        )}

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function EntitySummaryCard({ entity }: { entity: StatusPayload['entity'] }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Entity</p>
          <p className="text-base font-semibold">{entity.name}</p>
        </div>
        <span className="text-xs text-muted-foreground">{entity.type.replace(/_/g, ' ').toLowerCase()}</span>
      </CardContent>
    </Card>
  );
}

function NotConfiguredCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trust-deed parser is being set up</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        We&apos;re finalising the AI structurer. Please check back soon.
      </CardContent>
    </Card>
  );
}

function UploadCard({
  onUpload,
  disabled,
}: {
  onUpload: (file: File) => void;
  disabled: boolean;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          Upload your trust deed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload the executed PDF of your trust deed. We&apos;ll read it and extract the beneficiaries, distribution rules, vesting date, trustee powers, and any sub-trust UPE clauses. **Your deed is never modified.**
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
            Read-only — we never write to your PDF
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
            You confirm each extracted rule before our tax engine uses it
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
            Stored encrypted-at-rest in your Monitrax vault
          </li>
        </ul>
        <label className="block">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={disabled}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
          />
        </label>
        {disabled && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading + extracting (this can take 20–60 seconds for a typical deed)…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RulesReviewCards({
  rules,
  document,
  onConfirm,
  onReject,
  onReupload,
  disabled,
}: {
  rules: RulesPayload;
  document: StatusPayload['document'];
  onConfirm: () => void;
  onReject: () => void;
  onReupload: () => void;
  disabled: boolean;
}) {
  const isExtracted = rules.status === 'EXTRACTED';
  const isConfirmed = rules.status === 'CONFIRMED';
  const isRejected = rules.status === 'REJECTED';

  const beneficiaries = rules.beneficiaries ?? [];
  const distributionRules = rules.distributionRules ?? [];
  const loanProvisions = rules.loanProvisions ?? [];
  const uncomputedNotes = rules.uncomputedNotes ?? [];

  return (
    <>
      <StatusBanner status={rules.status} confirmedAt={rules.confirmedAt} rejectedAt={rules.rejectedAt} rejectionReason={rules.rejectionReason} document={document} />

      <BeneficiariesCard beneficiaries={beneficiaries} />

      <DistributionRulesCard rules={distributionRules} />

      {rules.trusteePower && <TrusteePowerCard power={rules.trusteePower} />}

      {loanProvisions.length > 0 && <LoanProvisionsCard provisions={loanProvisions} />}

      {rules.vestingDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Vesting date
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{rules.vestingDate}</CardContent>
        </Card>
      )}

      {uncomputedNotes.length > 0 && <UncomputedNotesCard notes={uncomputedNotes} />}

      {isExtracted && (
        <Card className="border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="space-y-4 p-5">
            <p className="text-sm font-semibold">Confirm or reject the extracted rules</p>
            <p className="text-sm text-muted-foreground">
              When you Confirm, our Phase 41e tax engines (Div 6E trust streaming + s100A zone classifier) will use these rules as input. When you Reject, the rules are tombstoned for audit and never used.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onConfirm} disabled={disabled} size="sm">
                {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirm and apply
              </Button>
              <Button onClick={onReject} disabled={disabled} size="sm" variant="outline">
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={onReupload} disabled={disabled} size="sm" variant="ghost">
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(isConfirmed || isRejected) && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              This extraction is finalised. Re-upload the deed to revise.
            </p>
            <Button onClick={onReupload} disabled={disabled} size="sm" variant="outline" className="mt-3">
              <Upload className="mr-2 h-4 w-4" />
              Upload a new deed
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function StatusBanner({
  status,
  confirmedAt,
  rejectedAt,
  rejectionReason,
  document,
}: {
  status: 'EXTRACTED' | 'CONFIRMED' | 'REJECTED';
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  document: StatusPayload['document'];
}) {
  const variants: Record<typeof status, { tone: string; label: string; icon: React.ReactNode }> = {
    EXTRACTED: {
      tone: 'border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20',
      label: 'Awaiting your review',
      icon: <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    },
    CONFIRMED: {
      tone: 'border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      label: `Confirmed${confirmedAt ? ` ${formatTimestamp(confirmedAt)}` : ''}`,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    },
    REJECTED: {
      tone: 'border-destructive/40 bg-destructive/5',
      label: `Rejected${rejectedAt ? ` ${formatTimestamp(rejectedAt)}` : ''}`,
      icon: <XCircle className="h-4 w-4 text-destructive" />,
    },
  };
  const v = variants[status];
  return (
    <Card className={v.tone}>
      <CardContent className="flex items-start gap-3 p-4">
        {v.icon}
        <div className="text-sm">
          <p className="font-semibold">{v.label}</p>
          {document && (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {document.originalFilename}
              <span className="text-xs">({Math.round(document.size / 1024)} KB)</span>
            </p>
          )}
          {rejectionReason && (
            <p className="mt-1 text-xs text-muted-foreground">Reason: {rejectionReason}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BeneficiariesCard({ beneficiaries }: { beneficiaries: RulesPayload['beneficiaries'] }) {
  if (beneficiaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Beneficiaries
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No beneficiaries extracted. Review the deed manually or re-upload.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Beneficiaries ({beneficiaries.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {beneficiaries.map((b, i) => (
          <div key={`${b.name}-${i}`} className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.type.toLowerCase()}</p>
              </div>
              <ConfidenceBadge value={b.confidence} />
            </div>
            {b.percentageEntitlement !== null && (
              <p className="text-xs text-muted-foreground">
                Entitlement: {(b.percentageEntitlement * 100).toFixed(1)}%
              </p>
            )}
            {b.conditions && (
              <p className="text-xs text-muted-foreground italic">Condition: {b.conditions}</p>
            )}
            {b.sourceClause && (
              <p className="text-xs text-muted-foreground/70">Source: {b.sourceClause}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DistributionRulesCard({ rules }: { rules: RulesPayload['distributionRules'] }) {
  if (rules.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4" />
          Distribution rules ({rules.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rules.map((r, i) => (
          <div key={i} className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.type.replace(/_/g, ' ').toLowerCase()}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
              <ConfidenceBadge value={r.confidence} />
            </div>
            {r.allocations && r.allocations.length > 0 && (
              <ul className="ml-3 list-disc text-xs text-muted-foreground">
                {r.allocations.map((a, j) => (
                  <li key={j}>
                    {a.beneficiaryName}: {a.share !== null ? `${(a.share * 100).toFixed(1)}%` : '—'}
                  </li>
                ))}
              </ul>
            )}
            {r.sourceClause && (
              <p className="text-xs text-muted-foreground/70">Source: {r.sourceClause}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TrusteePowerCard({ power }: { power: NonNullable<RulesPayload['trusteePower']> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Trustee power
          </span>
          <ConfidenceBadge value={power.confidence} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {power.appointor && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Appointor</p>
            <p>{power.appointor}</p>
          </div>
        )}
        {power.removalRights && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Removal rights</p>
            <p className="text-muted-foreground">{power.removalRights}</p>
          </div>
        )}
        {power.amendmentClause && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Amendment clause</p>
            <p className="text-muted-foreground">{power.amendmentClause}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoanProvisionsCard({ provisions }: { provisions: NonNullable<RulesPayload['loanProvisions']> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4" />
          Loan provisions ({provisions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {provisions.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
            <div>
              <p className="font-medium">{p.type.replace(/_/g, ' ').toLowerCase()}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
            <ConfidenceBadge value={p.confidence} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UncomputedNotesCard({ notes }: { notes: RulesPayload['uncomputedNotes'] }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4" />
          Clauses needing your review ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          These clauses required interpretation and weren&apos;t structured automatically. Read each one and decide with your accountant or solicitor before confirming.
        </p>
        {notes.map((n) => (
          <div key={n.id} className="space-y-1.5 border-b pb-3 last:border-b-0 last:pb-0">
            <p className="font-medium text-foreground">{n.rationale}</p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              {n.sourceText}
            </pre>
            {n.sourceClause && (
              <p className="text-xs text-muted-foreground/70">Source: {n.sourceClause}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  if (value >= CONFIDENCE_THRESHOLD) {
    return (
      <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
        {pct}% confidence
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400">
      {pct}% — review carefully
    </Badge>
  );
}

function ScopeBoundaryCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">What we do — and don&apos;t do</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ul className="space-y-1.5">
            <li>✓ Read the structural rules from your existing deed</li>
            <li>✓ Surface uncertain clauses for your review</li>
            <li>✓ Use your CONFIRMED rules in tax calculations</li>
          </ul>
          <ul className="space-y-1.5">
            <li>✗ Generate or modify trust deeds</li>
            <li>✗ Issue distribution minutes / resolutions</li>
            <li>✗ Replace your solicitor or tax agent</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}
