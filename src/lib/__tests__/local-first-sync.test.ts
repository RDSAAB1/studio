import {
  writeLocalFirst,
  readLocalFirst,
  hasPendingChanges,
  getPendingChangesCount,
} from '../local-first-sync';

const putMock = jest.fn();
const getMock = jest.fn();
const deleteMock = jest.fn();
const toArrayMock = jest.fn();

const batchSetMock = jest.fn();
const batchUpdateMock = jest.fn();
const batchDeleteMock = jest.fn();
const batchCommitMock = jest.fn();

const getDocMock = jest.fn();

jest.mock('../database', () => {
  return {
    db: {
      suppliers: {
        put: (...args: unknown[]) => putMock(...args),
        get: (...args: unknown[]) => getMock(...args),
        delete: (...args: unknown[]) => deleteMock(...args),
        toArray: (...args: unknown[]) => toArrayMock(...args),
      },
      transactions: {
        bulkPut: jest.fn(),
      },
    },
  };
});

jest.mock('../firebase', () => ({
  firestoreDB: {},
}));

jest.mock('firebase/firestore', () => {
  return {
    collection: jest.fn(() => ({})),
    doc: jest.fn(() => ({})),
    writeBatch: jest.fn(() => ({
      set: (...args: unknown[]) => batchSetMock(...args),
      update: (...args: unknown[]) => batchUpdateMock(...args),
      delete: (...args: unknown[]) => batchDeleteMock(...args),
      commit: (...args: unknown[]) => batchCommitMock(...args),
    })),
    getDoc: (...args: unknown[]) => getDocMock(...args),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    Timestamp: {
      fromDate: (date: Date) => ({ toDate: () => date }),
      fromMillis: (ms: number) => ({ toMillis: () => ms }),
    },
  };
});

jest.mock('../sync-queue', () => ({
  enqueueSyncTask: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../chunked-operations', () => ({
  yieldToMainThread: jest.fn().mockResolvedValue(undefined),
  chunkedBulkPut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('../sync-registry', () => ({
  notifySyncRegistry: jest.fn().mockResolvedValue(undefined),
}));

describe('Local-First Sync - writeLocalFirst and readLocalFirst', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a new supplier locally and syncs to Firestore', async () => {
    const supplier = { id: 's1', name: 'Test Supplier' };
    putMock.mockResolvedValue(undefined);
    batchCommitMock.mockResolvedValue(undefined);

    const result = await writeLocalFirst('suppliers', 'create', supplier.id, supplier as any);

    expect(putMock).toHaveBeenCalledTimes(1);
    const putArg = putMock.mock.calls[0][0] as any;
    expect(putArg.id).toBe('s1');
    expect(putArg.createdAt).toBeDefined();
    expect(putArg.updatedAt).toBeDefined();
    expect(result).toMatchObject({ id: 's1', name: 'Test Supplier' });

    expect(batchSetMock).toHaveBeenCalledTimes(1);
    expect(hasPendingChanges()).toBe(false);
    expect(getPendingChangesCount()).toBe(0);
  });

  it('updates an existing supplier and issues Firestore update', async () => {
    const existing = { id: 's2', name: 'Old Name', updatedAt: new Date().toISOString() };
    getMock.mockResolvedValue(existing);
    putMock.mockResolvedValue(undefined);
    batchCommitMock.mockResolvedValue(undefined);
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    });

    const result = await writeLocalFirst('suppliers', 'update', existing.id, undefined as any, {
      name: 'New Name',
    } as any);

    expect(getMock).toHaveBeenCalledWith('s2');
    expect(putMock).toHaveBeenCalledTimes(1);
    const putArg = putMock.mock.calls[0][0] as any;
    expect(putArg.name).toBe('New Name');
    expect(putArg.updatedAt).toBeDefined();

    expect(result).toMatchObject({ id: 's2', name: 'New Name' });
    expect(batchUpdateMock).toHaveBeenCalledTimes(1);
    expect(hasPendingChanges()).toBe(false);
    expect(getPendingChangesCount()).toBe(0);
  });

  it('re-queues pending changes when Firestore commit fails with permission error', async () => {
    const supplier = { id: 's3', name: 'Failing Supplier' };
    putMock.mockResolvedValue(undefined);
    batchCommitMock.mockRejectedValue({ code: 'permission-denied' });

    await writeLocalFirst('suppliers', 'create', supplier.id, supplier as any);

    expect(batchSetMock).toHaveBeenCalledTimes(1);
    expect(hasPendingChanges()).toBe(true);
    expect(getPendingChangesCount()).toBe(1);
  });

  it('reads a single supplier from local database', async () => {
    const supplier = { id: 's4', name: 'Read Supplier' };
    getMock.mockResolvedValue(supplier);

    const result = await readLocalFirst<any>('suppliers', 's4');

    expect(getMock).toHaveBeenCalledWith('s4');
    expect(result).toEqual(supplier);
  });

  it('reads all suppliers from local database', async () => {
    const suppliers = [
      { id: 's5', name: 'Supplier 1' },
      { id: 's6', name: 'Supplier 2' },
    ];
    toArrayMock.mockResolvedValue(suppliers);

    const result = await readLocalFirst<any>('suppliers');

    expect(toArrayMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(suppliers);
  });
});
