/**
 * Simple in-memory rate limiter
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const store = new Map<string, { count: number; resetTime: number }>();

/**
 * Checks if a key has exceeded the rate limit.
 * Returns true if allowed, false if blocked.
 */
export function rateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + config.windowMs });
    return true;
  }

  if (record.count >= config.max) {
    return false;
  }

  record.count += 1;
  return true;
}

// Cleanup function to prevent memory leaks (only runs if module is loaded)
// In a serverless environment (like Vercel), this might not persist, 
// but it works for long-running servers or client-side throttling.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 60000); // Cleanup every minute
}
