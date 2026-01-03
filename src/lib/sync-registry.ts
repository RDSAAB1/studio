import { firestoreDB } from "./firebase";
import { collection, doc, setDoc, getDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import type { WriteBatch } from "firebase/firestore";

/**
 * Collection name mapping from internal names to Firestore collection names
 * Complete mapping of all 28 collections
 */
const COLLECTION_MAP: Record<string, string> = {
    // Core collections
    'suppliers': 'suppliers',
    'customers': 'customers',
    'payments': 'payments',
    'customerPayments': 'customer_payments',
    'governmentFinalizedPayments': 'governmentFinalizedPayments',
    
    // Financial collections
    'incomes': 'incomes',
    'expenses': 'expenses',
    'fundTransactions': 'fund_transactions',
    'loans': 'loans',
    
    // Bank related
    'banks': 'banks',
    'bankBranches': 'bankBranches',
    'bankAccounts': 'bankAccounts',
    'supplierBankAccounts': 'supplierBankAccounts',
    
    // Settings and options
    'settings': 'settings',
    'options': 'options',
    
    // User and employee management
    'users': 'users',
    'employees': 'employees',
    'attendance': 'attendance',
    'payroll': 'payroll',
    
    // Project and inventory
    'projects': 'projects',
    'inventoryItems': 'inventoryItems',
    'expenseTemplates': 'expenseTemplates',
    
    // Ledger collections
    'ledgerAccounts': 'ledgerAccounts',
    'ledgerEntries': 'ledgerEntries',
    'ledgerCashAccounts': 'ledgerCashAccounts',
    
    // Other collections
    'mandiReports': 'mandiReports',
    'kantaParchi': 'kantaParchi',
    'customerDocuments': 'customerDocuments',
    'manufacturingCosting': 'manufacturingCosting',
};

const syncRegistryCollection = collection(firestoreDB, "sync_registry");

/**
 * Update sync registry timestamp when any collection is modified
 * This is called atomically with every write operation to ensure metadata stays in sync
 * 
 * @param collectionName - Internal collection name (e.g., 'suppliers', 'payments')
 * @param options - Options for batch/transaction support
 * @returns Promise that resolves when registry is updated
 */
export async function notifySyncRegistry(
    collectionName: string,
    options?: { 
        useTransaction?: boolean; 
        batch?: WriteBatch;
        transaction?: any;
    }
): Promise<void> {
    const registryDocId = COLLECTION_MAP[collectionName] || collectionName;
    const registryRef = doc(syncRegistryCollection, registryDocId);
    
    const updateData = {
        last_updated: serverTimestamp(),
        updated_at: Timestamp.now(), // Fallback if serverTimestamp fails
        collection_name: collectionName,
        // Add a random component to ensure timestamp is always different
        // This helps payment listeners detect changes when suppliers/customers are updated
        _trigger: Math.random(), // Random value to ensure change is detected
    };
    
    if (options?.batch) {
        // Use batch write - atomic with data operation
        options.batch.set(registryRef, updateData, { merge: true });
        return; // Batch will be committed by caller
    } else if (options?.transaction) {
        // Use transaction - atomic with data operation
        options.transaction.set(registryRef, updateData, { merge: true });
        return; // Transaction will be committed by caller
    } else if (options?.useTransaction) {
        // Caller wants transaction mode but didn't provide transaction object
        throw new Error("Transaction mode requires transaction object to be passed");
    } else {
        // Direct write (fallback - not recommended for critical operations)
        await setDoc(registryRef, updateData, { merge: true });
    }
}

/**
 * Get current sync registry timestamp for a collection
 * Used to check if local data is stale
 * 
 * @param collectionName - Internal collection name
 * @returns Timestamp or null if registry doesn't exist
 */
export async function getSyncRegistryTimestamp(collectionName: string): Promise<Timestamp | null> {
    const registryDocId = COLLECTION_MAP[collectionName] || collectionName;
    const registryRef = doc(syncRegistryCollection, registryDocId);
    
    try {
        const docSnap = await getDoc(registryRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.last_updated || data.updated_at || null;
        }
        return null;
    } catch (error) {

        return null;
    }
}

/**
 * Get all collection names that are tracked in sync registry
 */
export function getTrackedCollections(): string[] {
    return Object.keys(COLLECTION_MAP);
}

/**
 * Get Firestore collection name from internal name
 */
export function getFirestoreCollectionName(internalName: string): string {
    return COLLECTION_MAP[internalName] || internalName;
}

