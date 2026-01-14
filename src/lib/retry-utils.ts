/**
 * Retry Utility Functions
 * 
 * Provides retry logic for failed API calls and async operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';

  // Network errors
  if (
    message.includes('network') ||
    message.includes('Network') ||
    message.includes('fetch') ||
    code.includes('UNAVAILABLE') ||
    code.includes('DEADLINE_EXCEEDED')
  ) {
    return true;
  }

  // Quota errors (should retry after delay)
  if (
    code.includes('RESOURCE_EXHAUSTED') ||
    code.includes('quota-exceeded') ||
    message.includes('quota')
  ) {
    return true;
  }

  // Timeout errors
  if (
    code.includes('TIMEOUT') ||
    message.includes('timeout') ||
    message.includes('Timeout')
  ) {
    return true;
  }

  // Permission errors should NOT be retried
  if (code.includes('PERMISSION_DENIED') || code.includes('permission-denied')) {
    return false;
  }

  // Invalid argument errors should NOT be retried
  if (code.includes('INVALID_ARGUMENT') || code.includes('invalid-argument')) {
    return false;
  }

  // Default: retry for unknown errors (might be transient)
  return true;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>>): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = {
    ...DEFAULT_OPTIONS,
    retryableErrors: options.retryableErrors || isRetryableError,
    onRetry: options.onRetry,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!opts.retryableErrors(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= opts.maxAttempts) {
        break;
      }

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt, error);
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Retry with specific error handling for Firestore operations
 */
export async function retryFirestoreOperation<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  return retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    onRetry: (attempt, error) => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn(`[Retry] ${context || 'Firestore operation'} failed (attempt ${attempt}):`, error);
      }
    },
  });
}

/**
 * Retry with specific error handling for network operations
 */
export async function retryNetworkOperation<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  return retry(fn, {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 8000,
    onRetry: (attempt, error) => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn(`[Retry] ${context || 'Network operation'} failed (attempt ${attempt}):`, error);
      }
    },
  });
}

