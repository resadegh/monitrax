/**
 * Q-DEC PR 3.B — Decimal → JSON serializer for the API boundary.
 *
 * Route handlers that consume Decimal engines need to return
 * `NextResponse.json(...)`. JSON has no native Decimal — every Decimal
 * leaf must convert to a `number` (or `string`, if the caller wants to
 * preserve full precision past Float's 15-digit mantissa).
 *
 * This walker handles the common case: recursively traverse the result
 * tree, leave non-Decimal leaves intact (strings, booleans, nulls,
 * Date instances), convert Decimal instances to numbers via
 * `fromDecimal(policy)`.
 *
 * **Per-field-policy escape hatch:** money fields use `'currency'`
 * (2dp HALF_EVEN — ATO standard); rate fields use `'rate'` (4dp); etc.
 * The walker takes a default policy plus optional path overrides for
 * fields that need a different one.
 */

import { Decimal, fromDecimal, type RoundingPolicy } from './index';

/**
 * Options for `serializeDecimalsForJson`.
 */
export interface SerializeOptions {
  /** Default policy for Decimal → number conversion. Defaults to 'currency' (2dp HALF_EVEN). */
  defaultPolicy?: RoundingPolicy;
  /**
   * Optional per-path policy overrides. Paths use dot notation:
   *   `'tax.effectiveTaxRate' → 'rate'`
   *   `'tax.netTax' → 'currency'`
   * Path-prefix matching means `'income.*'` would need explicit per-leaf
   * overrides (not glob); to keep the helper deterministic.
   */
  policyByPath?: Record<string, RoundingPolicy>;
}

const DEFAULT: Required<SerializeOptions> = {
  defaultPolicy: 'currency',
  policyByPath: {},
};

/**
 * Recursively walk `value` and convert every `Decimal` instance to a
 * `number` via `fromDecimal(policy)`. Non-Decimal leaves are returned
 * unchanged. Arrays + plain objects are traversed structurally.
 *
 * Type-safety note: the return type is `unknown` because the walker is
 * structural — callers narrow at the response-shape boundary. For the
 * tax-engine routes, the consumer narrows to the public response shape
 * documented in each route's JSDoc.
 */
export function serializeDecimalsForJson(value: unknown, options: SerializeOptions = {}): unknown {
  const opts = { ...DEFAULT, ...options, policyByPath: { ...DEFAULT.policyByPath, ...options.policyByPath } };
  return walk(value, '', opts);
}

function walk(value: unknown, path: string, opts: Required<SerializeOptions>): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Decimal) {
    const policy = opts.policyByPath[path] ?? opts.defaultPolicy;
    return fromDecimal(value, policy);
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const childPath = path ? `${path}[${i}]` : `[${i}]`;
      out.push(walk(value[i], childPath, opts));
    }
    return out;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${k}` : k;
    out[k] = walk(v, childPath, opts);
  }
  return out;
}
