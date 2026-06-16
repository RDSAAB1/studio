import { doc, getDocs, writeBatch } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { logError } from "../error-logger";
import { customersCollection, createLocalSubscription } from "./core";
import { Customer } from "@/lib/definitions";

export async function addCustomer(customerData: Customer): Promise<Customer> {
    try {
        const { writeLocalFirst } = await import('../local-first-sync');
        const result = await writeLocalFirst('customers', 'create', customerData.id, customerData) as Customer;
        
        if (!isSqliteMode()) {
            try {
                const batch = writeBatch(firestoreDB);
                batch.set(doc(customersCollection, customerData.id), customerData);
                const { notifySyncRegistry } = await import('../sync-registry');
                await notifySyncRegistry('customers', { batch });
                await batch.commit();
            } catch (error) {
                console.error('addCustomer Firestore sync', error);
            }
        }
        
        return result;
    } catch (error) {
        logError(error, `addCustomer(${customerData.id})`, 'high');
        throw error;
    }
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('customers', 'update', id, undefined, customerData as Partial<Customer>);

    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(doc(customersCollection, id), customerData, { merge: true });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('customers', { batch });
            await batch.commit();
        } catch (error) {
            console.error(`updateCustomer Firestore sync - id: ${id}`, error);
        }
    }
}

export async function deleteCustomer(id: string): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('customers', 'delete', id);

    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.delete(doc(customersCollection, id));
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('customers', { batch });
            await batch.commit();
        } catch (error) {
            console.error(`deleteCustomer Firestore sync - id: ${id}`, error);
        }
    }
}

export async function getAllCustomers(): Promise<Customer[]> {
  if (isSqliteMode() && db) {
    return db.customers.toArray();
  }
  const snapshot = await getDocs(customersCollection);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Customer));
}

export function getCustomersRealtime(
    callback: (data: Customer[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Customer>("customers", callback);
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

export async function bulkUpsertCustomers(customers: Customer[], chunkSize = 400) {
    if (!customers.length) return;
    
    if (!isSqliteMode()) {
        const chunks = chunkArray(customers, chunkSize);
        for (const chunk of chunks) {
            const batch = writeBatch(firestoreDB);
            chunk.forEach((customer) => {
                if (!customer.id) throw new Error("Customer entry missing id");
                const ref = doc(customersCollection, customer.id);
                batch.set(ref, customer, { merge: true });
            });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('customers', { batch });
            await batch.commit();
        }
    }
}

export async function addStagedCustomer(customerData: Customer): Promise<Customer> {
  try {
    const documentIdValue = customerData.id || String(Date.now() + Math.random());
    const customerWithCorrectId = { ...customerData, id: documentIdValue };
    const { writeLocalFirst } = await import('../local-first-sync');
    const result = await writeLocalFirst('staged_customers', 'create', documentIdValue, customerWithCorrectId) as Customer;

    if (typeof window !== 'undefined' && result) {
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', {
        detail: { collection: 'staged_customers' },
      }));
    }
    return result;
  } catch (error) {
    logError(error, `addStagedCustomer(${customerData.id})`, 'high');
    throw error;
  }
}

export async function updateStagedCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) return false;
  try {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('staged_customers', 'update', id, undefined, customerData as Partial<Customer>);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', {
        detail: { collection: 'staged_customers' },
      }));
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function deleteStagedCustomer(id: string): Promise<void> {
  if (!id) return;
  try {
    const dbRaw = db;
    await dbRaw.stagedCustomers.delete(id);
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('staged_customers', 'delete', id);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', {
        detail: { collection: 'staged_customers' },
      }));
    }
  } catch (error) {
    logError(error, `deleteStagedCustomer(${id})`, 'high');
    throw error;
  }
}

export async function deleteMultipleStagedCustomers(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    const dbRaw = db;
    await dbRaw.stagedCustomers.bulkDelete(ids);
    const { isLocalFolderMode, syncCollectionToFolder } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, syncCollectionToFolder: async () => false }));
    if (isLocalFolderMode()) {
      await syncCollectionToFolder('staged_customers').catch(() => { });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', {
        detail: { collection: 'staged_customers' },
      }));
    }
  } catch (error) {
    logError(error, `deleteMultipleStagedCustomers`, 'high');
    throw error;
  }
}

export async function bulkUpsertStagedCustomers(customers: Customer[], chunkSize = 400) {
  if (!customers.length) return;
  const chunks = chunkArray(customers, chunkSize);
  if (!isSqliteMode()) {
    const { stagedCustomersCollection } = await import('./core');
    for (const chunk of chunks) {
      const batch = writeBatch(firestoreDB);
      chunk.forEach((customer) => {
        if (!customer.id) throw new Error("Customer entry missing id");
        const ref = doc(stagedCustomersCollection, customer.id);
        batch.set(ref, customer, { merge: true });
      });
      await batch.commit();
    }
  }
}

export function getStagedCustomersRealtime(
  callback: (data: Customer[]) => void,
  onError: (error: Error) => void
): () => void {
  return createLocalSubscription<Customer>("staged_customers", callback);
}

export async function mergeStagedCustomers(selectedStaged: Customer[]): Promise<{ addCount: number; updateCount: number }> {
    if (!selectedStaged || selectedStaged.length === 0) return { addCount: 0, updateCount: 0 };

    const dbRaw = db;
    const targetSrNos = selectedStaged.map(s => s.srNo).filter(Boolean);
    
    // Fetch existing customers to check for updates vs inserts
    const existingCustomers = await dbRaw.customers.where('srNo').anyOf(targetSrNos).toArray();
    const existingMap = new Map(existingCustomers.map(s => [s.srNo, s]));

    const customersToPut: Customer[] = [];
    const stagedIdsToDelete: string[] = [];
    
    let addCount = 0;
    let updateCount = 0;

    const nowStr = new Date().toISOString();
    const { withCreateMetadata, withEditMetadata } = await import("../audit");

    for (const staged of selectedStaged) {
        const targetSrNo = staged.srNo;
        const existing = existingMap.get(targetSrNo);
        
        let finalRecord: Customer;
        if (existing) {
            // Update existing customer
            const baseRecord = {
                ...existing,
                ...staged,
                id: existing.id,
                srNo: existing.srNo,
                updatedAt: nowStr
            };
            finalRecord = withEditMetadata(baseRecord as Record<string, unknown>) as Customer;
            updateCount++;
        } else {
            // Add new customer
            const documentIdValue = targetSrNo && targetSrNo.trim() !== '' && targetSrNo !== 'C----' 
                ? targetSrNo 
                : (staged.id || String(Date.now() + Math.random()));
            const baseRecord = {
                ...staged,
                id: documentIdValue,
                srNo: documentIdValue,
                createdAt: nowStr,
                updatedAt: nowStr
            };
            finalRecord = withCreateMetadata(baseRecord as Record<string, unknown>) as Customer;
            addCount++;
        }
        customersToPut.push(finalRecord);
        stagedIdsToDelete.push(staged.id);
    }

    // Perform bulk operations in Dexie/IndexedDB
    if (customersToPut.length > 0) {
        await dbRaw.customers.bulkPut(customersToPut);
    }
    if (stagedIdsToDelete.length > 0) {
        await dbRaw.stagedCustomers.bulkDelete(stagedIdsToDelete);
    }

    // Handle local folder storage if active
    try {
        const { isLocalFolderMode, mergeRecordToFolderFile, syncCollectionToFolder } = await import('@/lib/local-folder-storage');
        if (isLocalFolderMode()) {
            for (const record of customersToPut) {
                await mergeRecordToFolderFile('customers', record as unknown as Record<string, unknown>, 'id').catch(() => {});
            }
            await syncCollectionToFolder('staged_customers').catch(() => {});
        }
    } catch (e) {
        // Ignore folder storage errors
    }

    // Dispatch collection changed events exactly once at the end
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'customers' } }));
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'staged_customers' } }));
    }

    return { addCount, updateCount };
}

