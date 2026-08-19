/**
 * Server-side guards for hidden-module routes and APIs
 * (PROD_SIMPLIFICATION_PLAN.md §4.4 — "server enforcement is the real
 * control"; nav-only hiding is a compliance hazard).
 *
 * R0 (override wiring): enforcement is user-aware where a user exists.
 * Server LAYOUTS have no user identity (auth is Bearer-token
 * client-side; no session cookie exists in this app), so routing works
 * in three modes via `resolveModuleRouting`:
 *
 *   - 'enabled'          → global flag ON: render for everyone.
 *   - 'hidden'           → flag OFF and NO active override for the key
 *                          anywhere: hard server 404 (the v1 default).
 *   - 'override-window'  → flag OFF but ≥1 user holds an active
 *                          override: the shell may render; the per-user
 *                          verdict is enforced by `ModuleOverrideGate`
 *                          (client, renders not-found for everyone
 *                          without the override) and by the user-aware
 *                          API guard on every data call. Defense in
 *                          depth for a deliberately narrow window —
 *                          R0's purpose is one user (Reza) verifying a
 *                          hidden module on live PROD data.
 *
 * `moduleApiGuard(key, userId?)` — call at the top of each gated API
 * route handler. With a userId it honours per-user overrides; without
 * one (public/webhook handlers) it is global-only. Returns a 503
 * NextResponse when blocked, `null` when the handler should proceed.
 *
 * MON-160: `resolveModuleRouting` awaits `connection()` BEFORE any flag
 * read. Without this, Next.js statically pre-renders gated layouts at
 * build time and BAKES the verdict into the deployment — an admin flag
 * flip then cannot unhide (or re-hide) a module without a redeploy.
 * This is the one place (SSOT) every gated layout passes through.
 *
 * `middleware.ts` explicitly CANNOT host these checks: it runs on the
 * Edge runtime with no Prisma (CLAUDE.md §13.6), so enforcement lives
 * in layouts + route handlers.
 */

import { NextResponse, connection } from 'next/server';
import {
  isModuleEnabled,
  isModuleEnabledForUser,
  moduleHasActiveOverride,
} from './moduleGate';
import type { ModuleKey } from './moduleRegistry';

export type ModuleRoutingMode = 'enabled' | 'override-window' | 'hidden';

/** Layout-level routing decision (see the file header for the three modes). */
export async function resolveModuleRouting(key: ModuleKey): Promise<ModuleRoutingMode> {
  // MON-160 fix: force dynamic rendering BEFORE reading the flag.
  await connection();
  if (await isModuleEnabled(key)) return 'enabled';
  if (await moduleHasActiveOverride(key)) return 'override-window';
  return 'hidden';
}

/**
 * API-level guard: 503 with a stable code when the module is hidden
 * for this caller. Pass the authenticated `userId` wherever the
 * handler has one (all `withPermission` handlers do) so active R0
 * overrides are honoured; omit it only for public/webhook handlers,
 * which stay global-only.
 */
export async function moduleApiGuard(
  key: ModuleKey,
  userId?: string,
): Promise<NextResponse | null> {
  const enabled = userId
    ? await isModuleEnabledForUser(key, userId)
    : await isModuleEnabled(key);
  if (enabled) return null;
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: 'This part of Monitrax is not currently available.',
        details: { module: key },
      },
    },
    { status: 503 },
  );
}
