/**
 * MON-194 — the ONE guarded response-error reader (M2 kept-depth PR-1).
 *
 * Failure bodies are not always JSON: the platform rejects an oversized
 * request body with a plain-text 413 BEFORE our routes run, and
 * `await res.json()` on it throws — the raw parser exception
 * ("Unexpected token 'R', 'Request En'… is not valid JSON") used to be
 * shown to the user as the error banner. This helper never lets a parse
 * failure become the message: it tries the API's JSON error shapes, then
 * falls back to a human sentence mapped from the HTTP status.
 *
 * Use at fetch seams that surface errors to people:
 *   if (!res.ok) throw new Error(await responseErrorMessage(res, 'Upload failed'));
 *
 * (§12.2.1 search-first note: the only prior reader was component-local in
 * the hidden entities canvas — no canonical one existed; this is it now.)
 */

/** Human sentences for statuses whose raw bodies are typically not JSON. */
const STATUS_MESSAGES: Record<number, string> = {
  413: 'That file is too large to upload — please use a smaller file.',
  429: 'Too many requests right now — give it a moment and try again.',
  502: 'The server had a hiccup — please try again.',
  503: 'The service is briefly unavailable — please try again.',
  504: 'The request timed out — please try again.',
};

/**
 * Extract a human-readable error message from a failed Response.
 * Never throws; never returns a JSON-parse exception.
 */
export async function responseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await res.clone().json();
    if (body && typeof body === 'object') {
      const b = body as { error?: unknown; message?: unknown };
      if (typeof b.error === 'string' && b.error) return b.error;
      if (b.error && typeof b.error === 'object') {
        const msg = (b.error as { message?: unknown }).message;
        if (typeof msg === 'string' && msg) return msg;
      }
      if (typeof b.message === 'string' && b.message) return b.message;
    }
  } catch {
    // Non-JSON body (platform 413s, HTML error pages) — fall through to the
    // status mapping; the parse failure itself is never the message.
  }
  return STATUS_MESSAGES[res.status] ?? `${fallback} (HTTP ${res.status}).`;
}
