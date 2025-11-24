/**
 * Rate Limiting Middleware
 * Phase 05 - Backend Security
 *
 * Simple in-memory rate limiter for API protection.
 * For production, replace with Redis-based solution (e.g., @upstash/ratelimit)
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// =============================================================================
// IN-MEMORY STORE (Replace with Redis in production)
// =============================================================================

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// =============================================================================
// RATE LIMIT CONFIGURATIONS
// =============================================================================

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 attempts per 15 min
  },
  // Login specifically - very strict
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 min
  },
  // API endpoints - general limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  // Calculate endpoints - moderate limit
  calculate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 calculations per minute
  },
  // Webhook/export endpoints - strict
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 exports per hour
  },
};

// =============================================================================
// RATE LIMIT CHECKER
// =============================================================================

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier (IP, user ID, API key)
 * @param configKey - Which rate limit config to use
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  configKey: keyof typeof RATE_LIMITS = 'api'
): RateLimitResult {
  const config = RATE_LIMITS[configKey];
  const key = `${configKey}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Create new entry if doesn't exist or expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const success = entry.count <= config.maxRequests;

  return {
    success,
    remaining,
    resetTime: entry.resetTime,
    retryAfter: success ? undefined : Math.ceil((entry.resetTime - now) / 1000),
  };
}

/**
 * Get client identifier from request.
 * Uses IP address, with fallback to forwarded headers.
 */
export function getClientIdentifier(request: NextRequest): string {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check for real IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP or default
  return '127.0.0.1';
}

// =============================================================================
// MIDDLEWARE WRAPPER
// =============================================================================

/**
 * Rate limiting middleware wrapper.
 *
 * @param configKey - Which rate limit config to use
 * @returns Middleware function
 */
export function withRateLimit(configKey: keyof typeof RATE_LIMITS = 'api') {
  return async function rateLimit(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(identifier, configKey);

    // Set rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', RATE_LIMITS[configKey].maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetTime.toString());

    if (!result.success) {
      headers.set('Retry-After', result.retryAfter?.toString() || '60');
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers,
        }
      );
    }

    // Execute the handler and add rate limit headers to response
    const response = await handler();

    // Clone response to add headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-RateLimit-Limit', RATE_LIMITS[configKey].maxRequests.toString());
    newHeaders.set('X-RateLimit-Remaining', result.remaining.toString());
    newHeaders.set('X-RateLimit-Reset', result.resetTime.toString());

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Simple rate limit check for use in route handlers.
 * Returns 429 response if rate limited, null otherwise.
 */
export function rateLimitCheck(
  request: NextRequest,
  configKey: keyof typeof RATE_LIMITS = 'api'
): NextResponse | null {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(identifier, configKey);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': result.retryAfter?.toString() || '60',
          'X-RateLimit-Limit': RATE_LIMITS[configKey].maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }

  return null;
}
