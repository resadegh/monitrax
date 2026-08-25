/**
 * M2 kept-depth PR-1 — wiring guards for the intake-pipeline fixes
 * (MON-188 persist · MON-190 one count · MON-193 one limit · MON-194 guarded
 * errors). Source-scan style (mirrors tests/api/propertyDetailActuals.test.ts)
 * — pins the static wiring so a future edit can't silently reintroduce a
 * fixed class.
 *
 * Coverage: static shape at HEAD. Does NOT prove the live behaviour — that is
 * the brief's Ring-3 run.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MAX_FILE_SIZE as CONSTANTS_LIMIT } from '@/lib/documents/constants';
import { MAX_FILE_SIZE as TYPES_LIMIT } from '@/lib/documents/types';
import { responseErrorMessage } from '@/lib/utils/responseError';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-187 — SmartInbox consumes the typed model, never a local `.type` read', () => {
  const src = read('components/documents/SmartInbox.tsx');
  it('imports the row model from inboxModel (the analyzer-typed contract)', () => {
    expect(src).toContain("from '@/lib/documents/intelligence/inboxModel'");
    expect(src).toContain('buildInboxRows');
  });
  it('the phantom `.type` read is gone', () => {
    expect(src).not.toContain('top?.type');
  });
});

describe('MON-188 — Done persists (never a local-close that loses the edit)', () => {
  it('SmartInbox Done calls the persist path', () => {
    const src = read('components/documents/SmartInbox.tsx');
    expect(src).toContain('onPersistEdits');
    expect(src).toContain('saveEdits');
  });
  it('the page PATCHes /api/documents/analyze and refreshes', () => {
    const src = read('app/dashboard/documents/page.tsx');
    expect(src).toContain("method: 'PATCH'");
    expect(src).toContain('handlePersistEdits');
  });
  it('the PATCH handler guards ownership + review state and merges ONLY the editable fields', () => {
    const src = read('app/api/documents/analyze/route.ts');
    expect(src).toContain('userVerified: false, document: { userId }');
    expect(src).toContain("const EDITABLE_FIELDS = ['vendor', 'amount', 'date', 'category']");
    expect(src).toContain("confidence: 1, source: 'user'");
  });
});

describe('MON-190 — ONE document total (tree ≡ hero, +1 per upload)', () => {
  it('the page produces the one total from the rendered list', () => {
    expect(read('app/dashboard/documents/page.tsx')).toContain("counts['total'] = documents.length");
  });
  it('the tree READS it — the bucket-summing reduce is gone', () => {
    const src = read('components/documents/FolderTree.tsx');
    expect(src).toContain("documentCounts['total']");
    expect(src).not.toMatch(/baseTotal = Object\.entries/);
  });
});

describe('MON-193 — ONE upload limit, stated and enforced everywhere', () => {
  it('constants and types expose the SAME constant (the duplicate is dead)', () => {
    expect(TYPES_LIMIT).toBe(CONSTANTS_LIMIT);
    expect(CONSTANTS_LIMIT).toBe(4 * 1024 * 1024);
    expect(read('lib/documents/types.ts')).toContain("export { MAX_FILE_SIZE } from './constants'");
  });
  it('no upload surface carries a local 10MB number any more', () => {
    for (const rel of [
      'components/documents/GlobalScanReceipt.tsx',
      'components/documents/FormDocumentUpload.tsx',
      'components/onboarding/wizard/DocumentUploadAccelerator.tsx',
    ]) {
      const src = read(rel);
      expect(src, `${rel} must import the shared limit`).toContain(
        "from '@/lib/documents/constants'"
      );
      expect(src, `${rel} still hardcodes 10MB`).not.toContain('10 * 1024 * 1024');
    }
  });
});

describe('MON-194 — the guarded error reader (never a raw JSON-parse message)', () => {
  it('a non-JSON 413 body maps to a human sentence', async () => {
    const res = new Response('Request Entity Too Large', { status: 413 });
    const msg = await responseErrorMessage(res, 'Upload failed');
    expect(msg.toLowerCase()).toContain('too large');
    expect(msg).not.toContain('Unexpected token');
  });
  it('the API JSON error shapes pass through', async () => {
    const nested = new Response(JSON.stringify({ error: { message: 'Nope from API' } }), { status: 400 });
    expect(await responseErrorMessage(nested, 'x')).toBe('Nope from API');
    const flatShape = new Response(JSON.stringify({ error: 'Flat nope' }), { status: 400 });
    expect(await responseErrorMessage(flatShape, 'x')).toBe('Flat nope');
  });
  it('an unmapped non-JSON failure falls back to the caller sentence + status', async () => {
    const res = new Response('<html>teapot</html>', { status: 418 });
    expect(await responseErrorMessage(res, 'Upload failed')).toBe('Upload failed (HTTP 418).');
  });
  it('the upload seams read errors through the helper', () => {
    for (const rel of [
      'app/dashboard/documents/page.tsx',
      'components/documents/GlobalScanReceipt.tsx',
      'components/documents/FormDocumentUpload.tsx',
    ]) {
      expect(read(rel), `${rel} must use responseErrorMessage`).toContain('responseErrorMessage');
    }
  });
});
