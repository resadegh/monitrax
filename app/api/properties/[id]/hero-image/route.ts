/**
 * Phase 45.2.5 — Property hero photo (CLAUDE.md §18.7.4 Cremorne pattern,
 * Asset Spotlight detail page).
 *
 * Per-property user-uploadable photo bytes for the §18.7.5 single-asset
 * detail page hero canvas. v1 stores the image inline on the Property
 * row (≤5MB JPEG/PNG/WEBP); the future-Phase migration to GCS is queued
 * (`lib/documents/storage` already abstracts it — only the storage
 * backend swap is required).
 *
 * Endpoints:
 *   GET    — stream the image bytes (Bearer-auth, ownership-gated).
 *            Returns the raw bytes with Content-Type matching the
 *            stored MIME. 404 if no image set. Detail page consumes
 *            this via an authenticated fetch → Blob URL → <Image>.
 *   POST   — multipart/form-data upload, single field `file`. Validates
 *            MIME + size (≤5MB), persists the bytes + MIME.
 *   DELETE — clears the column, reverting the detail page to the
 *            default Cremorne apartment photo.
 *
 * Why inline-DB v1 (not GCS):
 *   - No new infrastructure dependency to ship the affordance.
 *   - Postgres bytea TOAST-compresses + tolerates this size class fine.
 *   - Photos are decor, not evidence (§18.7.4) — not CDR-classified.
 *   - Storage backend can swap to GCS later without changing this API
 *     surface or the dialog component.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const GET = withPermission<RouteContext>('property.read', async (_request, auth, context) => {
  try {
    const { id } = await context!.params;

    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true, userId: true, heroImage: true, heroImageMime: true },
    });

    const ownershipResult = verifyOwnership(property, auth.userId, 'Property');
    if (!ownershipResult.success) return ownershipResult.response;

    if (!property!.heroImage || !property!.heroImageMime) {
      return new NextResponse(null, { status: 404 });
    }

    const bytes = property!.heroImage as unknown as Buffer;
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': property!.heroImageMime,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=600, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Get property hero image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withPermission<RouteContext>('property.write', async (request, auth, context) => {
  try {
    const { id } = await context!.params;

    const existing = await prisma.property.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    const ownershipResult = verifyOwnership(existing, auth.userId, 'Property');
    if (!ownershipResult.success) return ownershipResult.response;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const mime = file.type;
    if (!ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG or WEBP.' },
        { status: 415 },
      );
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_BYTES / 1024 / 1024}MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // §12.11 destructive-write checklist:
    //   1. where clause matches: a single property row keyed by id, gated by
    //      verifyOwnership above (only this user's row).
    //   2. columns overwritten: heroImage + heroImageMime — both decorative,
    //      no canonical financial / CDR data, replacement is the user's intent.
    //   3. guard: ownership check enforces "only mutate a row this user owns".
    //      Replacement is the documented behaviour (uploading a new photo
    //      REPLACES the previous one — confirmed by the dialog UX).
    await prisma.property.update({
      where: { id },
      data: { heroImage: buffer, heroImageMime: mime },
    });

    void createAuditLog({
      userId: auth.userId,
      action: 'PROPERTY_HERO_IMAGE_UPDATED',
      status: 'SUCCESS',
      entityType: 'Property',
      entityId: id,
      metadata: { mime, sizeBytes: buffer.length },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upload property hero image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withPermission<RouteContext>('property.write', async (_request, auth, context) => {
  try {
    const { id } = await context!.params;

    const existing = await prisma.property.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    const ownershipResult = verifyOwnership(existing, auth.userId, 'Property');
    if (!ownershipResult.success) return ownershipResult.response;

    // §12.11 destructive-write checklist:
    //   1. where clause matches: a single property row keyed by id, gated by
    //      verifyOwnership above.
    //   2. columns overwritten: heroImage + heroImageMime set back to null —
    //      reverts to the default decor photo on the detail page. Reversible
    //      (user can re-upload at any time).
    //   3. guard: ownership check. Action is the user's explicit intent
    //      ("Reset to default" CTA in the dialog).
    await prisma.property.update({
      where: { id },
      data: { heroImage: null, heroImageMime: null },
    });

    void createAuditLog({
      userId: auth.userId,
      action: 'PROPERTY_HERO_IMAGE_REMOVED',
      status: 'SUCCESS',
      entityType: 'Property',
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete property hero image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
