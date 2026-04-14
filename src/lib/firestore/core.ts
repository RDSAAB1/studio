import {
  collection,
  doc,
} from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { getTenantCollectionPath } from "../tenancy";
import { isSqliteMode } from "../sqlite-storage";

export { isSqliteMode };

/**
 * Local-only realtime subscription helper for SQLite-only architecture.
 */
export function createLocalSubscription<T>(
  tableName: string,
  callback: (data: T[]) => void,
  queryFn?: (data: T[]) => any
) {
  const refresh = async () => {
    try {
      const table = (db as any)[tableName];
      if (!table) {
        console.warn(`Table ${tableName} not found in db`);
        return;
      }
      const data = await table.toArray();
      callback(queryFn ? queryFn(data) : data);
    } catch (e) {
      console.error(`Local subscription error [${tableName}]:`, e);
    }
  };

  const handler = (e: any) => {
    if (e.detail === "all" || e.detail === tableName) {
      refresh();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("sqlite-change", handler);
  }
  
  refresh(); // Initial load

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("sqlite-change", handler);
    }
  };
}

export function stripUndefined<T extends Record<string, any>>(obj: T): T {
    const newObj: any = {};
    Object.keys(obj).forEach((key) => {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    });
    return newObj as T;
}

export function isFirestoreTemporarilyDisabled(): boolean {
    if (typeof window === 'undefined') return false;
    const disabledUntil = localStorage.getItem('firestore_disabled_until');
    if (!disabledUntil) return false;
    if (Date.now() > parseInt(disabledUntil, 10)) {
        localStorage.removeItem('firestore_disabled_until');
        return false;
    }
    return true;
}

export function markFirestoreDisabled(durationMs = 60 * 60 * 1000): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('firestore_disabled_until', String(Date.now() + durationMs));
}

export function isQuotaError(error: any): boolean {
    const errorMessage = error?.message || String(error);
    return (
        errorMessage.includes('quota-exceeded') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('quota exceeded')
    );
}

// Helper function to handle errors silently (for fallback scenarios)
export function handleSilentError(error: unknown, context: string): void {
  if (isQuotaError(error)) {
    markFirestoreDisabled();
  }
  if (process.env.NODE_ENV === 'development') {
    // Only log in development for debugging
    // eslint-disable-next-line no-console
    console.debug(`[Firestore] Silent error in ${context}:`, error);
  }
}


// Collection References
export let suppliersCollection = collection(firestoreDB, ...getTenantCollectionPath("suppliers"));
export let customersCollection = collection(firestoreDB, ...getTenantCollectionPath("customers"));
export let supplierPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("payments"));
export let customerPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
export let governmentFinalizedPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("governmentFinalizedPayments"));
export let incomesCollection = collection(firestoreDB, ...getTenantCollectionPath("incomes"));
export let expensesCollection = collection(firestoreDB, ...getTenantCollectionPath("expenses"));
export let accountsCollection = collection(firestoreDB, ...getTenantCollectionPath("accounts"));
export let loansCollection = collection(firestoreDB, ...getTenantCollectionPath("loans"));
export let fundTransactionsCollection = collection(firestoreDB, ...getTenantCollectionPath("fund_transactions"));
export let banksCollection = collection(firestoreDB, ...getTenantCollectionPath("banks"));
export let bankBranchesCollection = collection(firestoreDB, ...getTenantCollectionPath("bankBranches"));
export let bankAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("bankAccounts"));
export let supplierBankAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("supplierBankAccounts"));
export let settingsCollection = collection(firestoreDB, ...getTenantCollectionPath("settings"));
export let optionsCollection = collection(firestoreDB, ...getTenantCollectionPath("options"));
export let usersCollection = collection(firestoreDB, "users");
export let inventoryItemsCollection = collection(firestoreDB, ...getTenantCollectionPath("inventoryItems"));
export let expenseTemplatesCollection = collection(firestoreDB, ...getTenantCollectionPath("expenseTemplates"));
export let ledgerAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerAccounts"));
export let ledgerEntriesCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerEntries"));
export let ledgerCashAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerCashAccounts"));
export let mandiReportsCollection = collection(firestoreDB, ...getTenantCollectionPath("mandiReports"));
export let mandiHeaderDocRef = doc(settingsCollection, "mandiHeader");
export let kantaParchiCollection = collection(firestoreDB, ...getTenantCollectionPath("kantaParchi"));
export let customerDocumentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customerDocuments"));
export let manufacturingCostingCollection = collection(firestoreDB, ...getTenantCollectionPath("manufacturingCosting"));

export function refreshTenantFirestoreBindings() {
  suppliersCollection = collection(firestoreDB, ...getTenantCollectionPath("suppliers"));
  customersCollection = collection(firestoreDB, ...getTenantCollectionPath("customers"));
  supplierPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("payments"));
  customerPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
  governmentFinalizedPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("governmentFinalizedPayments"));
  incomesCollection = collection(firestoreDB, ...getTenantCollectionPath("incomes"));
  expensesCollection = collection(firestoreDB, ...getTenantCollectionPath("expenses"));
  accountsCollection = collection(firestoreDB, ...getTenantCollectionPath("accounts"));
  loansCollection = collection(firestoreDB, ...getTenantCollectionPath("loans"));
  fundTransactionsCollection = collection(firestoreDB, ...getTenantCollectionPath("fund_transactions"));
  banksCollection = collection(firestoreDB, ...getTenantCollectionPath("banks"));
  bankBranchesCollection = collection(firestoreDB, ...getTenantCollectionPath("bankBranches"));
  bankAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("bankAccounts"));
  supplierBankAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("supplierBankAccounts"));
  settingsCollection = collection(firestoreDB, ...getTenantCollectionPath("settings"));
  optionsCollection = collection(firestoreDB, ...getTenantCollectionPath("options"));
  inventoryItemsCollection = collection(firestoreDB, ...getTenantCollectionPath("inventoryItems"));
  expenseTemplatesCollection = collection(firestoreDB, ...getTenantCollectionPath("expenseTemplates"));
  ledgerAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerAccounts"));
  ledgerEntriesCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerEntries"));
  ledgerCashAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerCashAccounts"));
  mandiReportsCollection = collection(firestoreDB, ...getTenantCollectionPath("mandiReports"));
  mandiHeaderDocRef = doc(settingsCollection, "mandiHeader");
  kantaParchiCollection = collection(firestoreDB, ...getTenantCollectionPath("kantaParchi"));
  customerDocumentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customerDocuments"));
  manufacturingCostingCollection = collection(firestoreDB, ...getTenantCollectionPath("manufacturingCosting"));
}

refreshTenantFirestoreBindings();

if (typeof window !== "undefined") {
  window.addEventListener("erp:mode-changed", refreshTenantFirestoreBindings);
  window.addEventListener("erp:selection-changed", refreshTenantFirestoreBindings);
}
