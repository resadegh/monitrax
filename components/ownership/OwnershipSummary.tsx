'use client';

/**
 * OwnershipSummary — Phase 47 Stage A2 (Reza feedback 2026-06-10:
 * "there is no ownership available on the edit form, except the link").
 *
 * The Ownership ROW for edit surfaces: shows WHO currently owns the item
 * in warm words — "Just you" / "Joint — you & Sarah (50/50)" /
 * "Shared — you 70%, Sarah 30%" / the owning entity's name — with the
 * "Correct the record" affordance attached to it instead of a bare
 * floating link. Reads `GET /api/ownership/{type}/{id}` (canonical
 * `getOwnershipRecord`).
 */

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

interface OwnershipRecord {
  ownerEntityId: string | null;
  ownerEntityName: string | null;
  ownerIsSelf: boolean;
  group: {
    tenancyType: string;
    stakes: Array<{ entityName: string; sharePct: number | null }>;
  } | null;
}

interface OwnershipSummaryProps {
  token: string | null;
  objectType: string;
  objectId: string;
  onCorrect: () => void;
  /** Bump to re-fetch after a correction lands. */
  refreshKey?: number;
}

function describe(record: OwnershipRecord): string {
  if (record.group) {
    const names = record.group.stakes.map(s => s.entityName);
    if (record.group.tenancyType === 'JOINT_TENANTS') {
      return `Joint — ${names.join(' & ')} (equal, with survivorship)`;
    }
    const parts = record.group.stakes.map(s =>
      s.sharePct != null ? `${s.entityName} ${s.sharePct}%` : s.entityName,
    );
    return `Shared — ${parts.join(', ')}`;
  }
  if (record.ownerIsSelf) return 'Just you';
  return record.ownerEntityName ?? 'Not recorded yet';
}

export default function OwnershipSummary({
  token,
  objectType,
  objectId,
  onCorrect,
  refreshKey = 0,
}: OwnershipSummaryProps) {
  const [record, setRecord] = useState<OwnershipRecord | null>(null);

  useEffect(() => {
    if (!token || !objectId) return;
    fetch(`/api/ownership/${objectType}/${objectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(result => setRecord(result?.data ?? null))
      .catch(() => setRecord(null));
  }, [token, objectType, objectId, refreshKey]);

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Ownership
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-foreground/10 bg-background/50 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-400 to-indigo-500 text-white">
            <Users size={13} strokeWidth={1.8} />
          </span>
          <span className="font-medium">
            {record ? describe(record) : 'Loading…'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCorrect}
          className="shrink-0 text-xs text-sky-600 underline-offset-2 hover:underline"
        >
          Correct the record
        </button>
      </div>
    </div>
  );
}
