/**
 * Asset document storage-path rule (Phase 50).
 *
 * A document attached to an asset (e.g. a vehicle's rego/insurance/receipt) must
 * file under that asset's own folder — `${userId}/assets/${assetId}/...` — so all
 * of an asset's paperwork lives together, the same way properties/loans/investments
 * already do. Before this rule, asset-linked docs fell through to the generic
 * category folder.
 */

import { describe, it, expect } from 'vitest';
import { resolveStoragePath } from '@/lib/documents/engine/rules/PathRules';
import type { UploadContext, EntityLink } from '@/lib/documents/engine/types';
import { LinkedEntityType, DocumentCategory } from '@/lib/documents/types';

function ctx(category?: DocumentCategory): UploadContext {
  return {
    userId: 'user-1',
    filename: 'rego-renewal.pdf',
    mimeType: 'application/pdf',
    size: 1234,
    userInput: category ? { category } : {},
  } as unknown as UploadContext;
}

const assetLink: EntityLink[] = [
  { entityType: LinkedEntityType.ASSET, entityId: 'asset-landcruiser' } as EntityLink,
];

describe('asset_path rule', () => {
  it('files an asset document under the asset\'s own folder', () => {
    const path = resolveStoragePath(ctx(DocumentCategory.RECEIPT), assetLink);
    expect(path).toContain('user-1/assets/asset-landcruiser/');
    expect(path).not.toMatch(/^user-1\/documents\//); // not the generic fallback
  });

  it('keeps the asset folder even with a different category', () => {
    const path = resolveStoragePath(ctx(DocumentCategory.OTHER), assetLink);
    expect(path).toMatch(/^user-1\/assets\/asset-landcruiser\//);
  });

  it('does NOT hijack an expense-linked doc (expense rule wins)', () => {
    const links: EntityLink[] = [
      { entityType: LinkedEntityType.ASSET, entityId: 'asset-1' } as EntityLink,
      { entityType: LinkedEntityType.EXPENSE, entityId: 'exp-1' } as EntityLink,
    ];
    const path = resolveStoragePath(ctx(DocumentCategory.RECEIPT), links);
    expect(path).not.toContain('/assets/asset-1/');
  });
});
