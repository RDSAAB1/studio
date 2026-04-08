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
        return result;
    } catch (error) {
        logError(error, `addCustomer(${customerData.id})`, 'high');
        throw error;
    }
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('customers', 'update', id, undefined, customerData as Partial<Customer>);
}

export async function deleteCustomer(id: string): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('customers', 'delete', id);
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
    const chunks = chunkArray(customers, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((customer) => {
            if (!customer.id) throw new Error("Customer entry missing id");
            const ref = doc(customersCollection, customer.id);
            batch.set(ref, customer, { merge: true });
        });
        await batch.commit();
    }
}
