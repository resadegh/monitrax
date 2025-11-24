/**
 * Monitrax Logger Utility
 * Structured logging for consistent application monitoring
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Format and output a log entry
 */
function formatLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  requestId?: string
): void {
  const timestamp = new Date().toISOString();
  const logEntry: LogEntry = {
    timestamp,
    level,
    message,
    ...(context && { context }),
    ...(requestId && { requestId }),
  };

  // In development, pretty print for readability
  // In production, use single-line JSON for log aggregation
  const output = isDev
    ? JSON.stringify(logEntry, null, 2)
    : JSON.stringify(logEntry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      if (isDev) console.debug(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Main logger object with level-specific methods
 */
export const log = {
  /**
   * Debug level logging - only outputs in development
   */
  debug: (message: string, context?: Record<string, unknown>) => {
    if (isDev) {
      formatLog('debug', message, context);
    }
  },

  /**
   * Info level logging - general application events
   */
  info: (message: string, context?: Record<string, unknown>) => {
    formatLog('info', message, context);
  },

  /**
   * Warning level logging - potential issues
   */
  warn: (message: string, context?: Record<string, unknown>) => {
    formatLog('warn', message, context);
  },

  /**
   * Error level logging - exceptions and failures
   */
  error: (message: string, error?: Error | null, context?: Record<string, unknown>) => {
    formatLog('error', message, {
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: isDev ? error.stack : undefined,
        },
      }),
    });
  },
};

/**
 * Create a logger with a persistent context (e.g., requestId, userId)
 */
export function createContextLogger(baseContext: Record<string, unknown>) {
  return {
    debug: (message: string, context?: Record<string, unknown>) => {
      log.debug(message, { ...baseContext, ...context });
    },
    info: (message: string, context?: Record<string, unknown>) => {
      log.info(message, { ...baseContext, ...context });
    },
    warn: (message: string, context?: Record<string, unknown>) => {
      log.warn(message, { ...baseContext, ...context });
    },
    error: (message: string, error?: Error | null, context?: Record<string, unknown>) => {
      log.error(message, error, { ...baseContext, ...context });
    },
  };
}

/**
 * Create a logger for a specific API route
 */
export function createRouteLogger(route: string, requestId?: string) {
  return createContextLogger({
    route,
    ...(requestId && { requestId }),
  });
}

/**
 * Measure and log execution time of an async function
 */
export async function logTimed<T>(
  label: string,
  fn: () => Promise<T>,
  warnThresholdMs = 200
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;

    if (duration > warnThresholdMs) {
      log.warn(`Slow operation: ${label}`, {
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${warnThresholdMs}ms`,
      });
    } else if (isDev) {
      log.debug(`${label} completed`, { duration: `${duration.toFixed(2)}ms` });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    log.error(`${label} failed`, error as Error, { duration: `${duration.toFixed(2)}ms` });
    throw error;
  }
}
