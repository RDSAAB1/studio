/**
 * Firestore Read/Write Monitor
 * Tracks all Firestore operations to help monitor usage
 */

interface FirestoreOperation {
  type: 'read' | 'write' | 'delete';
  collection: string;
  operation: string;
  timestamp: number;
  documentCount?: number;
}

class FirestoreMonitor {
  private operations: FirestoreOperation[] = [];
  private readCount = 0;
  private writeCount = 0;
  private deleteCount = 0;
  private startTime = Date.now();
  private isEnabled = false;

  constructor() {
    // Enable monitoring in development or if localStorage flag is set
    if (typeof window !== 'undefined') {
      this.isEnabled = 
        process.env.NODE_ENV === 'development' || 
        localStorage.getItem('firestore-monitor-enabled') === 'true';
    }
  }

  logRead(collection: string, operation: string, documentCount: number = 1) {
    if (!this.isEnabled) return;
    
    this.readCount += documentCount;
    this.operations.push({
      type: 'read',
      collection,
      operation,
      timestamp: Date.now(),
      documentCount,
    });

    // Keep only last 1000 operations
    if (this.operations.length > 1000) {
      this.operations.shift();
    }

    this.logToConsole(collection, operation, 'read', documentCount);
  }

  logWrite(collection: string, operation: string, documentCount: number = 1) {
    if (!this.isEnabled) return;
    
    this.writeCount += documentCount;
    this.operations.push({
      type: 'write',
      collection,
      operation,
      timestamp: Date.now(),
      documentCount,
    });

    if (this.operations.length > 1000) {
      this.operations.shift();
    }

    this.logToConsole(collection, operation, 'write', documentCount);
  }

  logDelete(collection: string, operation: string, documentCount: number = 1) {
    if (!this.isEnabled) return;
    
    this.deleteCount += documentCount;
    this.operations.push({
      type: 'delete',
      collection,
      operation,
      timestamp: Date.now(),
      documentCount,
    });

    if (this.operations.length > 1000) {
      this.operations.shift();
    }

    this.logToConsole(collection, operation, 'delete', documentCount);
  }

  private logToConsole(collection: string, operation: string, type: string, count: number) {
    if (process.env.NODE_ENV === 'development') {

    }
  }

  getStats() {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000; // seconds
    const readsPerMinute = (this.readCount / elapsed) * 60;
    const writesPerMinute = (this.writeCount / elapsed) * 60;

    // Group by collection
    const byCollection = this.operations.reduce((acc, op) => {
      if (!acc[op.collection]) {
        acc[op.collection] = { reads: 0, writes: 0, deletes: 0 };
      }
      if (op.type === 'read') acc[op.collection].reads += op.documentCount || 1;
      if (op.type === 'write') acc[op.collection].writes += op.documentCount || 1;
      if (op.type === 'delete') acc[op.collection].deletes += op.documentCount || 1;
      return acc;
    }, {} as Record<string, { reads: number; writes: number; deletes: number }>);

    // Recent operations (last 5 minutes)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const recentOps = this.operations.filter(op => op.timestamp > fiveMinutesAgo);
    const recentReads = recentOps.filter(op => op.type === 'read').reduce((sum, op) => sum + (op.documentCount || 1), 0);
    const recentWrites = recentOps.filter(op => op.type === 'write').reduce((sum, op) => sum + (op.documentCount || 1), 0);

    return {
      total: {
        reads: this.readCount,
        writes: this.writeCount,
        deletes: this.deleteCount,
      },
      rates: {
        readsPerMinute: Math.round(readsPerMinute * 100) / 100,
        writesPerMinute: Math.round(writesPerMinute * 100) / 100,
      },
      recent: {
        reads: recentReads,
        writes: recentWrites,
        timeWindow: '5 minutes',
      },
      byCollection,
      elapsed: Math.round(elapsed),
      operations: this.operations.slice(-50), // Last 50 operations
    };
  }

  reset() {
    this.operations = [];
    this.readCount = 0;
    this.writeCount = 0;
    this.deleteCount = 0;
    this.startTime = Date.now();
  }

  enable() {
    this.isEnabled = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('firestore-monitor-enabled', 'true');
    }
  }

  disable() {
    this.isEnabled = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firestore-monitor-enabled');
    }
  }

  isMonitoringEnabled() {
    return this.isEnabled;
  }
}

// Singleton instance
export const firestoreMonitor = new FirestoreMonitor();

// Helper to wrap Firestore operations
export function trackFirestoreRead<T>(
  collection: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return fn().then((result) => {
    // Try to count documents in result
    let count = 1;
    if (Array.isArray(result)) {
      count = result.length;
    } else if (result && typeof result === 'object' && 'docs' in result) {
      count = (result as any).docs?.length || 1;
    }
    firestoreMonitor.logRead(collection, operation, count);
    return result;
  });
}

export function trackFirestoreWrite<T>(
  collection: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return fn().then((result) => {
    firestoreMonitor.logWrite(collection, operation, 1);
    return result;
  });
}

export function trackFirestoreDelete<T>(
  collection: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return fn().then((result) => {
    firestoreMonitor.logDelete(collection, operation, 1);
    return result;
  });
}

