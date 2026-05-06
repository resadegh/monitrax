/**
 * Phase 41f.2 — Xero integration public surface.
 *
 * Strategic positioning per `PHASE_41F_BOOKKEEPING_INTEGRATION.md`
 * §1: Monitrax CONSUMES Xero data, never replaces it.
 *
 * Scope boundary per §1.1: storage + understanding only. We never
 * write back to Xero. The integration is INBOUND-only. v1 ships
 * read-only OAuth scopes (`accounting.reports.read` +
 * `accounting.transactions.read` + `accounting.contacts.read` +
 * `offline_access` for refresh).
 *
 * Phase 41f.3 (next sub-PR) will add the snapshot pull pipeline.
 * This sub-PR (41f.2) ships the OAuth handshake + persistence only.
 */

export {
  resolveXeroConfig,
  isXeroConfigured,
  XERO_SCOPES,
  XERO_AUTHORIZE_URL,
  XERO_TOKEN_URL,
  XERO_REVOKE_URL,
  XERO_CONNECTIONS_URL,
  type XeroConfig,
  type XeroConfigResolution,
} from './config';

export {
  issueOAuthState,
  verifyOAuthState,
  type XeroOAuthStatePayload,
} from './state';

export {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeRefreshToken,
  listConnectedTenants,
  XeroOAuthError,
  type XeroTokens,
  type XeroTenant,
} from './oauth';

// Phase 41f.3 — token-refresh + report parsing + snapshot pull
export {
  getValidAccessToken,
  TokenRefreshError,
  type RefreshedTokens,
} from './tokenRefresh';

export {
  parseBalanceSheet,
  parseProfitAndLoss,
  XeroReportParseError,
  type XeroBalanceSheet,
  type XeroProfitAndLoss,
} from './reportParser';

export {
  pullSnapshot,
  resolveFiscalPeriod,
  currentAustralianFY,
  computeSimplifiedDistributableSurplus,
  SnapshotPullError,
  type PullSnapshotInput,
  type PullSnapshotResult,
  type FiscalPeriod,
} from './snapshotPuller';
