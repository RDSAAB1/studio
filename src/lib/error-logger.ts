/**
 * Error Logging Service
 * 
 * Centralized error logging that can be extended to send errors to
 * external services (e.g., Sentry, LogRocket, etc.)
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorLog {
  message: string;
  error: unknown;
  severity: ErrorSeverity;
  context?: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory

  /**
   * Log an error with context
   */
  log(error: unknown, context?: string, severity: ErrorSeverity = 'medium', metadata?: Record<string, unknown>): void {
    const errorLog: ErrorLog = {
      message: this.getErrorMessage(error),
      error,
      severity,
      context,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      metadata,
    };

    // Add browser info if available
    if (typeof window !== 'undefined') {
      errorLog.userAgent = window.navigator.userAgent;
      errorLog.url = window.location.href;
    }

    // Store in memory (for debugging)
    this.logs.push(errorLog);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const logMethod = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
      // eslint-disable-next-line no-console
      console[logMethod](`[Error Logger] ${context || 'Error'}:`, error, metadata);
    }

    // TODO: In production, send to external error tracking service
    // Example: Sentry.captureException(error, { contexts: { custom: { context, metadata } } });
  }

  /**
   * Get error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown error';
  }

  /**
   * Get recent error logs (for debugging)
   */
  getRecentLogs(count: number = 10): ErrorLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get error statistics
   */
  getStats(): { total: number; bySeverity: Record<ErrorSeverity, number> } {
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    this.logs.forEach(log => {
      bySeverity[log.severity]++;
    });

    return {
      total: this.logs.length,
      bySeverity,
    };
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Convenience function to log errors
 */
export function logError(
  error: unknown,
  context?: string,
  severity: ErrorSeverity = 'medium',
  metadata?: Record<string, unknown>
): void {
  errorLogger.log(error, context, severity, metadata);
}

