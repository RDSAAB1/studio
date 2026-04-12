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
