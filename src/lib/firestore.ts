
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  where,
  onSnapshot,
  limit,
  setDoc,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  DocumentChangeType,
  getCountFromServer,
  documentId,
  increment,
} from "firebase/firestore";
import { firestoreDB } from "./firebase"; // Renamed to avoid conflict
import { db, getDb } from "./database";
import { isFirestoreTemporarilyDisabled, markFirestoreDisabled, isQuotaError, createPollingFallback } from "./realtime-guard";
import { firestoreMonitor } from "./firestore-monitor";
import { getTenantCollectionPath, getTenantDocPath, getStorageKeySuffix, getErpCollectionPath, getErpSelection } from "./tenancy";
import { isSqliteMode } from "./sqlite-storage";
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense, Holiday, LedgerAccount, LedgerEntry, LedgerAccountInput, LedgerEntryInput, LedgerCashAccount, LedgerCashAccountInput, MandiReport, MandiHeaderSettings, KantaParchi, CustomerDocument, Employee, PayrollEntry, InventoryItem, Account, ManufacturingCostingData } from "@/lib/definitions";
import { toTitleCase, generateReadableId, calculateSupplierEntry } from "./utils";
import { withCreateMetadata, withEditMetadata, getEditMetadata, logActivity, moveToRecycleBin } from "./audit";
import { format } from "date-fns";
import { logError } from "./error-logger";
import { retryFirestoreOperation } from "./retry-utils";
import { createMetadataBasedListener } from "./sync-registry-listener";

// Helper function to handle errors silently (for fallback scenarios)
// This can be replaced with a proper error logging service later
function handleSilentError(error: unknown, context: string): void {
  // Error is intentionally handled silently for fallback scenarios
  // In production, this could be sent to an error tracking service
  if (process.env.NODE_ENV === 'development') {
    // Only log in development for debugging
    // eslint-disable-next-line no-console
    console.debug(`[Firestore] Silent error in ${context}:`, error);
  }
}

let suppliersCollection = collection(firestoreDB, ...getTenantCollectionPath("suppliers"));
let customersCollection = collection(firestoreDB, ...getTenantCollectionPath("customers"));
let supplierPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("payments"));
let customerPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
let governmentFinalizedPaymentsCollection = collection(firestoreDB, ...getTenantCollectionPath("governmentFinalizedPayments"));
let incomesCollection = collection(firestoreDB, ...getTenantCollectionPath("incomes"));
let expensesCollection = collection(firestoreDB, ...getTenantCollectionPath("expenses"));
let accountsCollection = collection(firestoreDB, ...getTenantCollectionPath("accounts"));
let loansCollection = collection(firestoreDB, ...getTenantCollectionPath("loans"));
let fundTransactionsCollection = collection(firestoreDB, ...getTenantCollectionPath("fund_transactions"));
let banksCollection = collection(firestoreDB, ...getTenantCollectionPath("banks"));
let bankBranchesCollection = collection(firestoreDB, ...getTenantCollectionPath("bankBranches"));
let bankAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("bankAccounts"));
let supplierBankAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("supplierBankAccounts"));
let settingsCollection = collection(firestoreDB, ...getTenantCollectionPath("settings"));
let optionsCollection = collection(firestoreDB, ...getTenantCollectionPath("options"));
let usersCollection = collection(firestoreDB, "users");
let attendanceCollection = collection(firestoreDB, ...getTenantCollectionPath("attendance"));
let projectsCollection = collection(firestoreDB, ...getTenantCollectionPath("projects"));
let employeesCollection = collection(firestoreDB, ...getTenantCollectionPath("employees"));
let payrollCollection = collection(firestoreDB, ...getTenantCollectionPath("payroll"));
let inventoryItemsCollection = collection(firestoreDB, ...getTenantCollectionPath("inventoryItems"));
let expenseTemplatesCollection = collection(firestoreDB, ...getTenantCollectionPath("expenseTemplates"));
let ledgerAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerAccounts"));
let ledgerEntriesCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerEntries"));
let ledgerCashAccountsCollection = collection(firestoreDB, ...getTenantCollectionPath("ledgerCashAccounts"));
let mandiReportsCollection = collection(firestoreDB, ...getTenantCollectionPath("mandiReports"));
let mandiHeaderDocRef = doc(settingsCollection, "mandiHeader");
let kantaParchiCollection = collection(firestoreDB, ...getTenantCollectionPath("kantaParchi"));
let customerDocumentsCollection = collection(firestoreDB, ...getTenantCollectionPath("customerDocuments"));
let manufacturingCostingCollection = collection(firestoreDB, ...getTenantCollectionPath("manufacturingCosting"));

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
  attendanceCollection = collection(firestoreDB, ...getTenantCollectionPath("attendance"));
  projectsCollection = collection(firestoreDB, ...getTenantCollectionPath("projects"));
  employeesCollection = collection(firestoreDB, ...getTenantCollectionPath("employees"));
  payrollCollection = collection(firestoreDB, ...getTenantCollectionPath("payroll"));
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

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
    const cleanedEntries = Object.entries(data).filter(
        ([, value]) => value !== undefined
    );
    return Object.fromEntries(cleanedEntries) as T;
}


// --- User Refresh Token Functions ---
export async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
        const userDocRef = doc(firestoreDB, "users", userId);
        await retryFirestoreOperation(
            () => setDoc(userDocRef, { refreshToken: refreshToken }, { merge: true }),
            `saveRefreshToken for user ${userId}`
        );
    } catch (error) {
        logError(error, `saveRefreshToken(${userId})`, 'medium');
        throw error;
    }
}

export async function getRefreshToken(userId: string): Promise<string | null> {
    try {
        const userDocRef = doc(firestoreDB, "users", userId);
        const docSnap = await retryFirestoreOperation(
            () => getDoc(userDocRef),
            `getRefreshToken for user ${userId}`
        );
        if (docSnap.exists() && docSnap.data().refreshToken) {
            return docSnap.data().refreshToken;
        }
        return null;
    } catch (error) {
        logError(error, `getRefreshToken(${userId})`, 'medium');
        throw error;
    }
}


// --- Dynamic Options Functions ---

export function getOptionsRealtime(collectionName: string, callback: (options: OptionItem[]) => void, onError: (error: Error) => void): () => void {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    if (db) {
        db.options.where('type').equals(collectionName).toArray().then((localOptions) => {
            if (localOptions.length > 0) {
                callback(localOptions);
            }
        }).catch((error) => {
            // If local read fails, continue with Firestore
            handleSilentError(error, 'getOptionsRealtime - local read fallback');
        });
    }

    // ✅ Use incremental sync - only listen for changes
    const docRef = doc(optionsCollection, collectionName);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const options = Array.isArray(data.items) ? data.items.map((name: string) => ({ id: name.toLowerCase(), name: name.toUpperCase() })) : [];
            
            // Save to local IndexedDB
            if (db) {
                options.forEach(opt => {
                    db.options.put({ ...opt, type: collectionName }).catch(() => {});
                });
            }
            
            callback(options);
        } else {
            callback([]);
        }
    }, onError);
}

export async function addOption(collectionName: string, optionData: { name: string }): Promise<void> {
    if (!optionData || !optionData.name || !optionData.name.trim()) {
        throw new Error('Option name cannot be empty');
    }
    
    try {
        const name = optionData.name.trim().toUpperCase();
        
        const docRef = doc(optionsCollection, collectionName);
        
        // Get current items first
        const docSnap = await retryFirestoreOperation(
            () => getDoc(docRef),
            `addOption - get current items for ${collectionName}`
        );
        const currentItems = docSnap.exists() ? (docSnap.data().items || []) : [];
        
        // Check if item already exists
        if (currentItems.includes(name)) {
            throw new Error(`Option "${name}" already exists`);
        }
        
        const meta = getEditMetadata();
        await retryFirestoreOperation(
            () => setDoc(docRef, {
                items: arrayUnion(name),
                ...meta
            }, { merge: true }),
            `addOption - set item for ${collectionName}`
        );
        logActivity({ type: "create", collection: "options", docId: collectionName, docPath: getTenantCollectionPath("options").join("/"), summary: `Added option ${name} to ${collectionName}`, afterData: { items: [...currentItems, name], ...meta } as Record<string, unknown> }).catch(() => {});
        
        // Also update local IndexedDB immediately
        if (db) {
            try {
                const optionItem = { id: name.toLowerCase(), name, type: collectionName };
                await db.options.put(optionItem);
            } catch (dbError) {
                logError(dbError, `addOption - IndexedDB update for ${collectionName}`, 'low');
                // Continue even if IndexedDB update fails
            }
        }
    } catch (error) {
        logError(error, `addOption(${collectionName})`, 'medium');
        throw error;
    }
}


export async function updateOption(collectionName: string, id: string, optionData: Partial<{ name: string }>): Promise<void> {
    if (!optionData || !optionData.name || !optionData.name.trim()) {
        throw new Error('Option name cannot be empty');
    }
    
    try {
        const newName = optionData.name.trim().toUpperCase();
        const docRef = doc(optionsCollection, collectionName);
        
        // Get current items
        const docSnap = await retryFirestoreOperation(
            () => getDoc(docRef),
            `updateOption - get current items for ${collectionName}`
        );
        if (!docSnap.exists()) {
            throw new Error(`Collection ${collectionName} does not exist`);
        }
        
        const currentItems = docSnap.data().items || [];
        
        // Find the old name by id (id is usually the lowercase name)
        const oldName = currentItems.find((item: string) => item.toLowerCase() === id.toLowerCase());
        
        if (!oldName) {
            throw new Error(`Option with id "${id}" not found`);
        }
        
        // Check if new name already exists (and it's not the same as old name)
        if (currentItems.includes(newName) && oldName !== newName) {
            throw new Error(`Option "${newName}" already exists`);
        }
        
        // Update: remove old name and add new name
        const updatedItems = currentItems.map((item: string) => item === oldName ? newName : item);
        
        const meta = getEditMetadata();
        await retryFirestoreOperation(
            () => setDoc(docRef, {
                items: updatedItems,
                ...meta
            }, { merge: true }),
            `updateOption - set updated items for ${collectionName}`
        );
        logActivity({ type: "edit", collection: "options", docId: collectionName, docPath: getTenantCollectionPath("options").join("/"), summary: `Updated option ${oldName} to ${newName} in ${collectionName}`, afterData: { items: updatedItems, ...meta } as Record<string, unknown> }).catch(() => {});
        
        // Update local IndexedDB
        if (db) {
            try {
                // Find old option by type and id (id is lowercase name)
                const oldOptions = await db.options.where('type').equals(collectionName).toArray();
                const oldOption = oldOptions.find(opt => {
                    // Check both id field and name field (id might be auto-increment or lowercase name)
                    const optId = typeof opt.id === 'string' ? opt.id.toLowerCase() : String(opt.id);
                    const optName = String(opt.name || '').toLowerCase();
                    return optId === id.toLowerCase() || optName === id.toLowerCase() || optName === oldName.toLowerCase();
                });
                
                if (oldOption) {
                    // Delete old option (use the actual id from the found option)
                    await db.options.delete(oldOption.id);
                }
                
                // Add new option with lowercase name as id
                const optionItem = { 
                    id: newName.toLowerCase(), 
                    name: newName, 
                    type: collectionName 
                };
                await db.options.put(optionItem);
            } catch (dbError) {
                logError(dbError, `updateOption - IndexedDB update for ${collectionName}`, 'low');
                // Continue even if IndexedDB update fails
            }
        }
    } catch (error) {
        logError(error, `updateOption(${collectionName}, ${id})`, 'medium');
        throw error;
    }
}

export async function deleteOption(collectionName: string, id: string, name: string): Promise<void> {
    try {
        const docRef = doc(optionsCollection, collectionName);
        const docSnap = await getDoc(docRef);
        const beforeItems = docSnap.exists() ? (docSnap.data().items || []) : [];
        await retryFirestoreOperation(
            () => updateDoc(docRef, {
                items: arrayRemove(name),
                ...getEditMetadata()
            }),
            `deleteOption - remove item from ${collectionName}`
        );
        logActivity({ type: "delete", collection: "options", docId: collectionName, docPath: getTenantCollectionPath("options").join("/"), summary: `Deleted option ${name} from ${collectionName}`, beforeData: { items: beforeItems } as Record<string, unknown> }).catch(() => {});
    } catch (error) {
        logError(error, `deleteOption(${collectionName}, ${id})`, 'medium');
        throw error;
    }
}


// --- Company & RTGS Settings Functions ---

export async function getCompanyEmailSettings(erp?: { companyId: string; subCompanyId: string; seasonKey: string }): Promise<{ email: string; appPassword: string } | null> {
    try {
        let coll = settingsCollection;
        if (erp?.companyId && erp?.subCompanyId && erp?.seasonKey) {
            coll = collection(firestoreDB, ...getErpCollectionPath("settings", erp));
        }
        const docRef = doc(coll, "emailConfig");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as { email: string; appPassword: string };
        }
    } catch (e) {
        console.error("Error getting company email settings:", e);
    }
    return null;
}

export async function saveCompanyEmailSettings(settings: { email: string; appPassword: string }, erp?: { companyId: string; subCompanyId: string; seasonKey: string }): Promise<void> {
    let coll = settingsCollection;
    if (erp?.companyId && erp?.subCompanyId && erp?.seasonKey) {
        coll = collection(firestoreDB, ...getErpCollectionPath("settings", erp));
    }
    const docRef = doc(coll, "emailConfig");
    await setDoc(docRef, settings, { merge: true });
}

export async function deleteCompanyEmailSettings(erp?: { companyId: string; subCompanyId: string; seasonKey: string }): Promise<void> {
    let coll = settingsCollection;
    if (erp?.companyId && erp?.subCompanyId && erp?.seasonKey) {
        coll = collection(firestoreDB, ...getErpCollectionPath("settings", erp));
    }
    const docRef = doc(coll, "emailConfig");
    await deleteDoc(docRef);
}


export async function getRtgsSettings(): Promise<RtgsSettings> {
    if (isSqliteMode()) {
        const { getReceiptSettingsFromLocal } = await import('./database');
        const local = await getReceiptSettingsFromLocal();
        if (local) return local as RtgsSettings;
    }

    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as RtgsSettings;
        if (data.defaultBankAccountId) {
            const bankDoc = await getDoc(doc(bankAccountsCollection, data.defaultBankAccountId));
            if (bankDoc.exists()) {
                data.defaultBank = bankDoc.data() as BankAccount;
            }
        }
        return data;
    }
    return {
        companyName: "BizSuite DataFlow",
        companyAddress1: "123 Business Rd",
        companyAddress2: "Suite 100, BizCity",
        contactNo: "9876543210",
        gmail: "contact@bizsuite.com",
    } as RtgsSettings;
}

export async function updateRtgsSettings(settings: Partial<RtgsSettings>): Promise<void> {
    if (isSqliteMode()) {
        const d = getDb();
        await d.settings.put({ id: 'companyDetails', ...settings } as any);
    }
    
    try {
        const docRef = doc(settingsCollection, "companyDetails");
        await setDoc(docRef, settings, { merge: true });
    } catch (e) {
        if (!isSqliteMode()) throw e;
        console.warn("Firestore sync for RTGS settings failed (skipped in SQLite mode):", e);
    }
}

const defaultReceiptFields: ReceiptFieldSettings = {
    date: true,
    name: true,
    contact: true,
    address: true,
    vehicleNo: true,
    term: true,
    rate: true,
    grossWeight: true,
    teirWeight: true,
    weight: true,
    amount: true,
    dueDate: true,
    kartaWeight: true,
    netAmount: true,
    srNo: true,
    variety: true,
    netWeight: true,
};


// --- Receipt Settings Functions ---
export async function getReceiptSettings(): Promise<ReceiptSettings | null> {
    const docRef = doc(settingsCollection, "companyDetails"); // Use companyDetails as the source
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as Partial<ReceiptSettings>;
        if (data.defaultBankAccountId) {
            const bankDoc = await getDoc(doc(bankAccountsCollection, data.defaultBankAccountId));
            if (bankDoc.exists()) {
                data.defaultBank = bankDoc.data() as BankAccount;
            }
        }
        return {
            companyName: data.companyName || "JAGDAMBE RICE MILL",
            companyAddress1: data.companyAddress1 || "Devkali Road, Banda, Shajahanpur",
            companyAddress2: data.companyAddress2 || "Near Devkali, Uttar Pradesh",
            contactNo: data.contactNo || "9555130735",
            gmail: data.gmail || "JRMDofficial@gmail.com",
            fields: { ...defaultReceiptFields, ...(data.fields || {}) },
            defaultBankAccountId: data.defaultBankAccountId,
            defaultBank: data.defaultBank,
            companyGstin: data.companyGstin,
            companyStateName: data.companyStateName,
            companyStateCode: data.companyStateCode,
            panNo: data.panNo
        };
    }
    return {
        companyName: "JAGDAMBE RICE MILL",
        companyAddress1: "Devkali Road, Banda, Shajahanpur",
        companyAddress2: "Near Devkali, Uttar Pradesh",
        contactNo: "9555130735",
        gmail: "JRMDofficial@gmail.com",
        fields: defaultReceiptFields,
    };
}

export async function updateReceiptSettings(settings: Partial<ReceiptSettings>): Promise<void> {
    const docRef = doc(settingsCollection, "companyDetails");
    await setDoc(docRef, settings, { merge: true });
}

export async function getMandiHeaderSettings(): Promise<MandiHeaderSettings | null> {
    const snapshot = await getDoc(mandiHeaderDocRef);
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() as Partial<MandiHeaderSettings>;
    return {
        firmName: data.firmName || "",
        firmAddress: data.firmAddress || "",
        mandiName: data.mandiName || "",
        licenseNo: data.licenseNo || "",
        licenseNo2: data.licenseNo2 || "",
        mandiType: data.mandiType || "",
        registerNo: data.registerNo || "",
        commodity: data.commodity || "",
        financialYear: data.financialYear || "",
    };
}

export async function saveMandiHeaderSettings(settings: Partial<MandiHeaderSettings>): Promise<void> {
    const payload: Partial<MandiHeaderSettings> = {};
    if (settings.firmName !== undefined) payload.firmName = settings.firmName;
    if (settings.firmAddress !== undefined) payload.firmAddress = settings.firmAddress;
    if (settings.mandiName !== undefined) payload.mandiName = settings.mandiName;
    if (settings.licenseNo !== undefined) payload.licenseNo = settings.licenseNo;
    if (settings.licenseNo2 !== undefined) payload.licenseNo2 = settings.licenseNo2;
    if (settings.mandiType !== undefined) payload.mandiType = settings.mandiType;
    if (settings.registerNo !== undefined) payload.registerNo = settings.registerNo;
    if (settings.commodity !== undefined) payload.commodity = settings.commodity;
    if (settings.financialYear !== undefined) payload.financialYear = settings.financialYear;

    await setDoc(mandiHeaderDocRef, payload, { merge: true });
}

// --- Bank & Branch Functions ---
export async function addBank(bankName: string): Promise<Bank> {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(firestoreDB, ...getTenantDocPath('banks', bankName));
  const bankData = withCreateMetadata({ name: bankName, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  batch.set(docRef, bankData);
  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('banks', { batch });
  await batch.commit();
  logActivity({ type: "create", collection: "banks", docId: docRef.id, docPath: getTenantCollectionPath("banks").join("/"), summary: `Created bank ${bankName}`, afterData: bankData as Record<string, unknown> }).catch(() => {});
  return { id: docRef.id, ...(bankData as any) } as Bank;
}

export async function deleteBank(id: string): Promise<void> {
    const docRef = doc(firestoreDB, ...getTenantDocPath("banks", id));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "banks", docId: id, docPath: getTenantCollectionPath("banks").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted bank ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('banks', { batch });
    await batch.commit();
    if (typeof window !== 'undefined' && db) {
      try {
        await db.banks.delete(id);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'banks' } }));
      } catch {
        // ignore
      }
    }
}

export async function addBankBranch(branchData: Omit<BankBranch, 'id'>): Promise<BankBranch> {
    const { ifscCode, branchName, bankName } = branchData;
    if (!ifscCode || !branchName || !bankName) {
        throw new Error("Bank name, branch name, and IFSC code are required.");
    }
    
    // A branch is unique if its combination of IFSC and branch name is unique for a given bank.
    const q = query(bankBranchesCollection, 
        where("ifscCode", "==", ifscCode.toUpperCase()),
        where("branchName", "==", branchName),
        where("bankName", "==", bankName)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        throw new Error(`This exact branch (name and IFSC) already exists for ${bankName}.`);
    }

    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankBranchesCollection);
    const dataWithTimestamp = withCreateMetadata({ ...branchData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(docRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "bankBranches", docId: docRef.id, docPath: getTenantCollectionPath("bankBranches").join("/"), summary: `Created branch ${branchData.branchName}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    return { id: docRef.id, ...(dataWithTimestamp as any) } as BankBranch;
}

export async function updateBankBranch(id: string, branchData: Partial<BankBranch>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath("bankBranches", id));
    const data = withEditMetadata({ ...branchData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "bankBranches", docId: id, docPath: getTenantCollectionPath("bankBranches").join("/"), summary: `Updated branch ${id}`, afterData: data }).catch(() => {});
}

export async function deleteBankBranch(id: string): Promise<void> {
    const docRef = doc(firestoreDB, ...getTenantDocPath("bankBranches", id));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "bankBranches", docId: id, docPath: getTenantCollectionPath("bankBranches").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted branch ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    await batch.commit();
    if (typeof window !== 'undefined' && db) {
      try {
        await db.bankBranches.delete(id);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'bankBranches' } }));
      } catch {
        // ignore
      }
    }
}


// --- Bank Account Functions ---
export async function addBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankAccountsCollection, accountData.accountNumber);
    const newAccount = withCreateMetadata({ ...accountData, id: docRef.id, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(docRef, newAccount);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankAccounts', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "bankAccounts", docId: docRef.id, docPath: getTenantCollectionPath("bankAccounts").join("/"), summary: `Created bank account ${accountData.accountNumber}`, afterData: newAccount as Record<string, unknown> }).catch(() => {});
    return newAccount as BankAccount;
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankAccountsCollection, id);
    const data = withEditMetadata({ ...accountData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankAccounts', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "bankAccounts", docId: id, docPath: getTenantCollectionPath("bankAccounts").join("/"), summary: `Updated bank account ${id}`, afterData: data }).catch(() => {});
}

export async function deleteBankAccount(id: string): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "bankAccounts", docId: id, docPath: getTenantCollectionPath("bankAccounts").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted bank account ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankAccounts', { batch });
    await batch.commit();
    if (typeof window !== 'undefined' && db) {
      try {
        await db.bankAccounts.delete(id);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'bankAccounts' } }));
      } catch {
        // ignore
      }
    }
}


// --- Supplier Functions ---
export async function addSupplier(supplierData: Customer): Promise<Customer> {
    try {
        // ✅ Use srNo as document ID if available, otherwise use the provided id
        // This ensures suppliers are saved with serial number as document ID in Firestore
        const documentId = supplierData.srNo && supplierData.srNo.trim() !== '' && supplierData.srNo !== 'S----' 
            ? supplierData.srNo 
            : supplierData.id;
        
        // Ensure the id field matches the document ID
        const supplierWithCorrectId = { ...supplierData, id: documentId };
        
        // Use local-first sync manager (Dexie add)
        const { writeLocalFirst } = await import('./local-first-sync');
        const result = await writeLocalFirst('suppliers', 'create', documentId, supplierWithCorrectId) as Customer;
        // File-first (local folder): merge new supplier to file in background so UI doesn't block
        const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
        if (isLocalFolderMode() && result) void mergeRecordToFolderFile('suppliers', result as unknown as Record<string, unknown>, 'id').catch(() => {});
        // UI incremental update: notify listeners about this single supplier (avoids full-table reloads)
        if (typeof window !== 'undefined' && result) {
            window.dispatchEvent(new CustomEvent('indexeddb:supplier:updated', {
                detail: { supplier: result },
            }));
        }
        return result;
    } catch (error) {
        logError(error, `addSupplier(${supplierData.srNo || supplierData.id})`, 'high');
        throw error;
    }
}

// Find supplier Firestore document ID by serial number
export async function getSupplierIdBySrNo(srNo: string): Promise<string | null> {
  try {
    const q = query(suppliersCollection, where('srNo', '==', srNo));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) {
    return false;
  }
  
  if (!supplierData || Object.keys(supplierData).length === 0) {
    return false;
  }
  
  // ✅ Check if SR No is being changed - need to update related payments
  // Use IndexedDB instead of Firestore to avoid reads
  let oldSrNo: string | undefined;
  let newSrNo: string | undefined;
  
  if (supplierData.srNo && db) {
    // Get current supplier from IndexedDB (no Firestore read)
    const currentSupplier = await db.suppliers.get(id);
    if (currentSupplier) {
      oldSrNo = currentSupplier.srNo;
      newSrNo = supplierData.srNo;
      
      // If SR No is changing, update all related payments (use IndexedDB)
      if (oldSrNo && newSrNo && oldSrNo !== newSrNo) {
        try {
          // Find all payments with old SR No in paidFor from IndexedDB (no Firestore read)
          const allPayments = await db.payments.toArray();
          const affectedPayments = allPayments.filter(p => 
            p.paidFor?.some((pf: PaidFor) => pf.srNo === oldSrNo)
          );
          
          if (affectedPayments.length > 0) {
            // Update IndexedDB first
            for (const payment of affectedPayments) {
              if (payment.paidFor) {
                const updatedPaidFor = payment.paidFor.map((pf: PaidFor) => 
                  pf.srNo === oldSrNo ? { ...pf, srNo: newSrNo! } : pf
                );
                await db.payments.update(payment.id, {
                    paidFor: updatedPaidFor,
                    updatedAt: new Date().toISOString()
                } as any).catch(() => {});
              }
            }
            
            // Queue Firestore updates via sync (no immediate Firestore read/write)
            const { enqueueSyncTask } = await import('./sync-queue');
            for (const payment of affectedPayments) {
              if (payment.paidFor) {
                const updatedPaidFor = payment.paidFor.map((pf: PaidFor) => 
                  pf.srNo === oldSrNo ? { ...pf, srNo: newSrNo! } : pf
                );
                await enqueueSyncTask(
                  'update:payments',
                  { id: payment.id, changes: { paidFor: updatedPaidFor, updatedAt: new Date().toISOString() } },
                  { attemptImmediate: true, dedupeKey: `payments:${payment.id}` }
                ).catch(() => {});
              }
            }
          }
        } catch (error) {
          // Continue with supplier update even if payment update fails
          // Payment updates are non-critical for supplier update operation
          handleSilentError(error, 'updateSupplier - payment update');
        }
      }
    }
  }
  
    // Use local-first sync manager (Dexie update)
  try {
    const { writeLocalFirst } = await import('./local-first-sync');
    await writeLocalFirst('suppliers', 'update', id, undefined, supplierData as Partial<Customer>);
    // File-first (local folder): merge updated supplier to file in background so UI doesn't block
    const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
    let updatedSupplier: Customer | null = null;
    if (db) {
      updatedSupplier = await db.suppliers.get(id) as Customer | null;
    }
    if (isLocalFolderMode() && updatedSupplier) {
      void mergeRecordToFolderFile('suppliers', updatedSupplier as unknown as Record<string, unknown>, 'id').catch(() => {});
    }
    // UI incremental update: notify listeners about this single supplier (avoids full-table reloads)
    if (typeof window !== 'undefined' && updatedSupplier) {
      window.dispatchEvent(new CustomEvent('indexeddb:supplier:updated', {
        detail: { supplier: updatedSupplier },
      }));
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) {
    return;
  }

  try {
    // Get supplier data from IndexedDB first (local-first)
    let supplierData: Customer | null = null;
    let supplierSrNo: string | null = null;
    let documentId: string = id; // Default to provided id
    
    if (db) {
      // Try to get by id first
      supplierData = (await db.suppliers.get(id)) || null;
      if (supplierData) {
        supplierSrNo = supplierData.srNo;
      } else {
        // If not found by id, try to find by srNo (in case id is actually srNo)
        const allSuppliers = await db.suppliers.toArray();
        const foundBySrNo = allSuppliers.find(s => s.srNo === id);
        if (foundBySrNo) {
          supplierData = foundBySrNo;
          supplierSrNo = foundBySrNo.srNo;
        }
      }
    }
    
    // ✅ Determine the correct Firestore document ID (optional when we already have supplierData from IndexedDB / local mode)
    let supplierDoc: { exists: () => boolean; id: string; data: () => unknown } | null = null;
    let foundInFirestore = false;
    try {
      let docRef = await getDoc(doc(suppliersCollection, id));
      if (docRef.exists()) {
        supplierDoc = docRef as any;
        documentId = id;
        foundInFirestore = true;
        if (!supplierData) {
          supplierData = supplierDoc!.data() as unknown as Customer | null;
          supplierSrNo = (supplierData as any)?.srNo;
        }
      } else if (supplierSrNo && supplierSrNo.trim() !== '' && supplierSrNo !== 'S----') {
        docRef = await getDoc(doc(suppliersCollection, supplierSrNo));
        if (docRef.exists()) {
          supplierDoc = docRef as any;
          documentId = supplierSrNo;
          foundInFirestore = true;
          if (!supplierData) supplierData = supplierDoc!.data() as unknown as Customer | null;
        } else {
          const q = query(suppliersCollection, where('srNo', '==', supplierSrNo));
          const snap = await getDocs(q);
          if (!snap.empty) {
            supplierDoc = snap.docs[0] as any;
            documentId = supplierDoc!.id;
            foundInFirestore = true;
            if (!supplierData) supplierData = supplierDoc!.data() as unknown as Customer | null;
          } else {
            const q2 = query(suppliersCollection, where('srNo', '==', id));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
              supplierDoc = snap2.docs[0] as any;
              documentId = supplierDoc!.id;
              foundInFirestore = true;
              if (!supplierData) {
                supplierData = supplierDoc!.data() as unknown as Customer | null;
                supplierSrNo = (supplierData as any)?.srNo;
              }
            }
          }
        }
      } else {
        const q = query(suppliersCollection, where('srNo', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          supplierDoc = snap.docs[0] as any;
          documentId = supplierDoc!.id;
          foundInFirestore = true;
          if (!supplierData) {
            supplierData = supplierDoc!.data() as unknown as Customer | null;
            supplierSrNo = (supplierData as any)?.srNo;
          }
        }
      }
    } catch (_) {
      // Firestore may be unavailable (e.g. local folder mode); continue if we have supplierData from IndexedDB
    }
    // If not found in Firestore but we have supplierData from IndexedDB (local mode), use it and proceed with delete
    if (!supplierData) {
      return; // Not found anywhere
    }
    if (!foundInFirestore) {
      documentId = (supplierData as any)?.id ?? id;
    }
    if (!supplierSrNo && supplierData) {
      supplierSrNo = (supplierData as any)?.srNo;
    }
    
    // Find all payments associated with this supplier's serial number from IndexedDB
    const paymentsToDelete: string[] = [];
    const paymentIdsToRemoveFromFile: string[] = [];
    const paymentsToUpdate: Array<{ id: string; paidFor: PaidFor[]; amount: number }> = [];
    
    if (db) {
      const allPayments = await db.payments.toArray();
      for (const payment of allPayments) {
        if (payment.paidFor && Array.isArray(payment.paidFor)) {
          const matchingPaidFor = payment.paidFor.find((pf: PaidFor) => pf.srNo === supplierSrNo);
          if (matchingPaidFor) {
            if (payment.paidFor.length === 1) {
              paymentsToDelete.push(payment.id);
              paymentIdsToRemoveFromFile.push(String((payment as any).paymentId ?? payment.id).trim());
            } else {
              const updatedPaidFor = payment.paidFor.filter((pf: PaidFor) => pf.srNo !== supplierSrNo);
              const amountToDeduct = matchingPaidFor.amount || 0;
              paymentsToUpdate.push({
                id: payment.id,
                paidFor: updatedPaidFor,
                amount: payment.amount - amountToDeduct
              });
            }
          }
        }
      }
    }
    
    // File-first (local folder): remove deleted payments from file, then update file for modified payments
    const { isLocalFolderMode, removePaymentsFromFolderFile, writePaymentToFolderFile, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false, writePaymentToFolderFile: async () => false, removeRecordFromFolderFile: async () => false }));
    if (isLocalFolderMode() && paymentIdsToRemoveFromFile.length > 0) {
      await removePaymentsFromFolderFile('payments', paymentIdsToRemoveFromFile).catch(() => {});
    }
    
    // Delete payments from IndexedDB
    if (db && paymentsToDelete.length > 0) {
      await db.payments.bulkDelete(paymentsToDelete);
    }
    
    // Update payments in IndexedDB and in file (file-first for each updated payment)
    if (db && paymentsToUpdate.length > 0) {
      for (const paymentUpdate of paymentsToUpdate) {
        const existingPayment = await db.payments.get(paymentUpdate.id);
        if (existingPayment) {
          const updatedPayment = {
            ...existingPayment,
            paidFor: paymentUpdate.paidFor,
            amount: paymentUpdate.amount
          };
          if ('updatedAt' in existingPayment) {
            (updatedPayment as any).updatedAt = new Date().toISOString();
          }
          if (isLocalFolderMode()) await writePaymentToFolderFile('payments', updatedPayment as unknown as Record<string, unknown>).catch(() => {});
          await db.payments.put(updatedPayment);
        }
      }
    }
    
    // ✅ UI refresh: dispatch so list/context update immediately
    if (typeof window !== 'undefined' && (paymentsToDelete.length > 0 || paymentsToUpdate.length > 0)) {
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'payments' } }));
    }
    
    // ✅ Use local-first sync for supplier deletion – use raw DB so delete is not affected by proxy
    const idToDelete = (supplierData as any)?.id ?? documentId;
    if (typeof window !== 'undefined') {
      try {
        const dbRaw = getDb();
        await dbRaw.suppliers.delete(idToDelete);
        // Fallback: delete by srNo in case primary key differs (e.g. Excel id vs UI id)
        if (supplierSrNo != null && String(supplierSrNo).trim() !== '') {
          await dbRaw.suppliers.where('srNo').equals(supplierSrNo).delete();
        }
      } catch (e) {
        handleSilentError(e, 'deleteSupplier IndexedDB delete');
      }
      // UI incremental update: notify listeners so they can remove this supplier from in-memory lists
      window.dispatchEvent(new CustomEvent('indexeddb:supplier:deleted', {
        detail: { id: idToDelete, srNo: supplierSrNo },
      }));
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'suppliers' } }));
    }
    const { writeLocalFirst } = await import('./local-first-sync');
    await writeLocalFirst('suppliers', 'delete', documentId);

    // File-first (local folder): remove supplier from file (reuse isLocalFolderMode/removeRecordFromFolderFile from above)
    if (isLocalFolderMode()) {
      await removeRecordFromFolderFile('suppliers', (supplierData as any)?.id ?? documentId, 'id').catch(() => {});
    }

    // Enqueue sync tasks for payment deletions
    if (paymentsToDelete.length > 0) {
      const { enqueueSyncTask } = await import('./sync-queue');
      for (const paymentId of paymentsToDelete) {
        await enqueueSyncTask('delete:payment', { id: paymentId }, { 
          attemptImmediate: true, 
          dedupeKey: `delete:payment:${paymentId}` 
        });
      }
    }
    
    // Enqueue sync tasks for payment updates
    if (paymentsToUpdate.length > 0) {
      const { enqueueSyncTask } = await import('./sync-queue');
      for (const paymentUpdate of paymentsToUpdate) {
        const existingPayment = await db?.payments.get(paymentUpdate.id);
        if (existingPayment) {
          await enqueueSyncTask('upsert:payment', {
            ...existingPayment,
            paidFor: paymentUpdate.paidFor,
            amount: paymentUpdate.amount
          }, { 
            attemptImmediate: true, 
            dedupeKey: `upsert:payment:${paymentUpdate.id}` 
          });
        }
      }
    }
    
  } catch (error) {
    throw error;
  }
}

export async function deleteMultipleSuppliers(supplierIds: string[]): Promise<void> {
    if (!supplierIds || supplierIds.length === 0) return;

    try {
        const paymentsToDelete = new Set<string>();
        const paymentsToUpdate = new Map<string, { updatedPaidFor: any[], amountToDeduct: number }>();
        const validSupplierIds: string[] = [];
        const supplierSrNos: string[] = [];

        // 1. Identify suppliers and related payments (Prefer Local IndexedDB for speed)
        if (typeof window !== 'undefined' && db) {
            const localSuppliers = await db.suppliers.where('id').anyOf(supplierIds).toArray();
            localSuppliers.forEach(s => {
                validSupplierIds.push(s.id);
                if (s.srNo) supplierSrNos.push(s.srNo);
            });

            if (supplierSrNos.length > 0) {
                // Find all affected payments locally
                const allPayments = await db.payments.toArray();
                allPayments.forEach(payment => {
                    const affectedEntries = payment.paidFor?.filter((pf: any) => supplierSrNos.includes(pf.srNo)) || [];
                    if (affectedEntries.length > 0) {
                        if (payment.paidFor?.length === affectedEntries.length) {
                            // Entire payment belongs to these suppliers
                            paymentsToDelete.add(payment.id);
                        } else {
                            // Partial update needed
                            const updatedPaidFor = payment.paidFor?.filter((pf: any) => !supplierSrNos.includes(pf.srNo)) || [];
                            const amountToDeduct = affectedEntries.reduce((sum: number, pf: any) => sum + (Number(pf.amount) || 0), 0);
                            paymentsToUpdate.set(payment.id, { updatedPaidFor, amountToDeduct });
                        }
                    }
                });
            }
        } else {
            // Fallback: Parallel Firestore Queries (Slow but correct)
            const supplierDocs = await Promise.all(supplierIds.map(id => getDoc(doc(suppliersCollection, id))));
            for (const sDoc of supplierDocs) {
                if (!sDoc.exists()) continue;
                validSupplierIds.push(sDoc.id);
                const srNo = sDoc.data().srNo;
                if (!srNo) continue;
                
                const q = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo }));
                const pSnap = await getDocs(q);
                pSnap.forEach(pDoc => {
                    const pData = pDoc.data() as Payment;
                    if (pData.paidFor?.length === 1) {
                        paymentsToDelete.add(pDoc.id);
                    } else {
                        const updatedPaidFor = pData.paidFor?.filter(pf => pf.srNo !== srNo) || [];
                        const amountToDeduct = pData.paidFor?.find(pf => pf.srNo === srNo)?.amount || 0;
                        const existing = paymentsToUpdate.get(pDoc.id);
                        if (existing) {
                            existing.updatedPaidFor = existing.updatedPaidFor.filter(pf => pf.srNo !== srNo);
                            existing.amountToDeduct += Number(amountToDeduct);
                        } else {
                            paymentsToUpdate.set(pDoc.id, { updatedPaidFor, amountToDeduct: Number(amountToDeduct) });
                        }
                    }
                });
            }
        }

        // 2. Perform Firestore Writes in Chunked Batches (Max 500 per batch)
        // REWRITTEN BATCH LOOP FOR SAFETY:
        const ops = [
            ...Array.from(paymentsToDelete).map(pid => ({ type: 'delete', ref: doc(supplierPaymentsCollection, pid) })),
            ...Array.from(paymentsToUpdate.entries()).map(([pid, info]) => ({ 
                type: 'update', 
                ref: doc(supplierPaymentsCollection, pid), 
                data: { paidFor: info.updatedPaidFor, amount: increment(-info.amountToDeduct) } 
            })),
            ...validSupplierIds.map(sid => ({ type: 'delete', ref: doc(suppliersCollection, sid) }))
        ];

        for (let i = 0; i < ops.length; i += 450) {
            const batch = writeBatch(firestoreDB);
            const chunk = ops.slice(i, i + 450);
            
            chunk.forEach(op => {
                if (op.type === 'delete') batch.delete(op.ref);
                else if (op.type === 'update') batch.update(op.ref, (op as any).data);
            });

            await notifySyncRegistry('suppliers', { batch });
            if (paymentsToDelete.size > 0 || paymentsToUpdate.size > 0) {
                await notifySyncRegistry('payments', { batch });
            }
            await batch.commit();
        }

        // 3. Local Cleanups
        if (db) {
            const { isLocalFolderMode, removePaymentsFromFolderFile, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false, removeRecordFromFolderFile: async () => false }));
            
            const pIdsArray = Array.from(paymentsToDelete);
            if (isLocalFolderMode() && pIdsArray.length > 0) {
                const rows = await db.payments.where('id').anyOf(pIdsArray).toArray();
                const pids = rows.map((p: any) => String(p.paymentId ?? p.id).trim()).filter(Boolean);
                if (pids.length) await removePaymentsFromFolderFile('payments', pids).catch(() => {});
            }
            if (isLocalFolderMode()) {
                for (const sid of validSupplierIds) await removeRecordFromFolderFile('suppliers', sid, 'id').catch(() => {});
            }

            // Bulk actions on Dexie
            await db.suppliers.bulkDelete(validSupplierIds);
            await db.payments.bulkDelete(pIdsArray);
            
            // Apply partial updates to Dexie
            for (const [pid, info] of paymentsToUpdate.entries()) {
                const p = await db.payments.get(pid);
                if (p) {
                    await db.payments.update(pid, { 
                        paidFor: info.updatedPaidFor, 
                        amount: (Number(p.amount) || 0) - info.amountToDeduct 
                    });
                }
            }

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'suppliers' } }));
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'payments' } }));
            }
        }
    } catch (error) {
        console.error('[Bulk Delete Error]', error);
        throw error;
    }
}

export async function recalculateAndUpdateSuppliers(supplierIds: string[]): Promise<number> {
    const holidays = await getHolidays();
    const dailyPaymentLimit = await getDailyPaymentLimit();
    const paymentHistory = await db.payments.toArray(); // Assuming Dexie is populated
    
    const batch = writeBatch(firestoreDB);
    let updatedCount = 0;

    for (const id of supplierIds) {
        const supplierRef = doc(suppliersCollection, id);
        const supplierSnap = await getDoc(supplierRef);
        
        if (supplierSnap.exists()) {
            const supplierData = supplierSnap.data() as Customer;
            
            // Pass the complete existing data to the calculation function
            const recalculatedData = calculateSupplierEntry(supplierData, paymentHistory, holidays, dailyPaymentLimit, []);
            
            // Only update the calculated fields, preserving the original entry data
            const updatePayload = {
                weight: recalculatedData.weight,
                kartaWeight: recalculatedData.kartaWeight,
                kartaAmount: recalculatedData.kartaAmount,
                netWeight: recalculatedData.netWeight,
                labouryAmount: recalculatedData.labouryAmount,
                amount: recalculatedData.amount,
                originalNetAmount: recalculatedData.originalNetAmount,
                netAmount: recalculatedData.originalNetAmount, // Reset netAmount to original
                dueDate: (recalculatedData as any).dueDate,
            };
            
            batch.update(supplierRef, updatePayload);
            updatedCount++;
        }
    }
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('suppliers', { batch });
    
    await batch.commit();
    return updatedCount;
}


// --- Customer Functions ---
export async function addCustomer(customerData: Customer): Promise<Customer> {
    try {
        // ✅ Use srNo as document ID if available, otherwise use the provided id
        // This ensures customers are saved with serial number as document ID in Firestore
        const documentId = customerData.srNo && customerData.srNo.trim() !== '' && customerData.srNo !== 'C----' 
            ? customerData.srNo 
            : customerData.id;
        
        // Ensure the id field matches the document ID
        const customerWithCorrectId = { ...customerData, id: documentId };
        
        // Use local-first sync manager (Dexie add)
        const { writeLocalFirst } = await import('./local-first-sync');
        const result = await writeLocalFirst('customers', 'create', documentId, customerWithCorrectId) as Customer;
        // File-first (local folder): merge new customer to file
        const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
        if (isLocalFolderMode() && result) void mergeRecordToFolderFile('customers', result as unknown as Record<string, unknown>, 'id').catch(() => {});
        return result;
    } catch (error) {
        logError(error, `addCustomer(${customerData.srNo || customerData.id})`, 'high');
        throw error;
    }
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        return false;
    }
    
    // ✅ Check if SR No is being changed - need to update related customerPayments
    // Use IndexedDB instead of Firestore to avoid reads
    let oldSrNo: string | undefined;
    let newSrNo: string | undefined;
    
    if (customerData.srNo && db) {
        // Get current customer from IndexedDB (no Firestore read)
        const currentCustomer = await db.customers.get(id);
        if (currentCustomer) {
            oldSrNo = currentCustomer.srNo;
            newSrNo = customerData.srNo;
            
            // If SR No is changing, update all related customerPayments (use IndexedDB)
            if (oldSrNo && newSrNo && oldSrNo !== newSrNo) {
                try {
                    // Find all customerPayments with old SR No in paidFor from IndexedDB (no Firestore read)
                    const allPayments = await db.customerPayments.toArray();
                    const affectedPayments = allPayments.filter(p => 
                        p.paidFor?.some((pf: PaidFor) => pf.srNo === oldSrNo)
                    );
                    
                    if (affectedPayments.length > 0) {
                        // Update IndexedDB first
                        for (const payment of affectedPayments) {
                            if (payment.paidFor) {
                                const updatedPaidFor = payment.paidFor.map((pf: PaidFor) => 
                                    pf.srNo === oldSrNo ? { ...pf, srNo: newSrNo! } : pf
                                );
                                await db.customerPayments.update(payment.id, {
                                    paidFor: updatedPaidFor,
                                    updatedAt: new Date().toISOString()
                                }).catch(() => {});
                            }
                        }
                        
                        // Queue Firestore updates via sync (no immediate Firestore read/write)
                        const { enqueueSyncTask } = await import('./sync-queue');
                        for (const payment of affectedPayments) {
                            if (payment.paidFor) {
                                const updatedPaidFor = payment.paidFor.map((pf: PaidFor) => 
                                    pf.srNo === oldSrNo ? { ...pf, srNo: newSrNo! } : pf
                                );
                                await enqueueSyncTask(
                                    'update:customerPayments',
                                    { id: payment.id, changes: { paidFor: updatedPaidFor, updatedAt: new Date().toISOString() } },
                                    { attemptImmediate: true, dedupeKey: `customerPayments:${payment.id}` }
                                ).catch(() => {});
                            }
                        }
                    }
                } catch (error) {
                    // Continue with customer update even if payment update fails
                    // Payment updates are non-critical for customer update operation
                    handleSilentError(error, 'updateCustomer - payment update');
                }
            }
        }
    }
    
    // Use local-first sync manager (Dexie update)
    try {
        const { writeLocalFirst } = await import('./local-first-sync');
        await writeLocalFirst<Customer>('customers', 'update', id, undefined, customerData as Partial<Customer>);
        // File-first (local folder): merge updated customer to file in background so UI doesn't block
        const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
        if (isLocalFolderMode() && db) {
            const updated = await db.customers.get(id);
            if (updated) void mergeRecordToFolderFile('customers', updated as unknown as Record<string, unknown>, 'id').catch(() => {});
        }
        return true;
    } catch (error) {
        return false;
    }
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
        return;
    }
    // File-first (local folder): remove customer from file then Dexie
    const { isLocalFolderMode, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removeRecordFromFolderFile: async () => false }));
    if (isLocalFolderMode()) await removeRecordFromFolderFile('customers', id, 'id').catch(() => {});
    const { writeLocalFirst } = await import('./local-first-sync');
    await writeLocalFirst('customers', 'delete', id);
}

// --- Kanta Parchi Functions ---
export async function addKantaParchi(kantaParchiData: KantaParchi): Promise<KantaParchi> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(kantaParchiCollection, kantaParchiData.srNo);
    const base = { ...kantaParchiData, createdAt: kantaParchiData.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const dataWithTimestamp = withCreateMetadata(base as Record<string, unknown>);
    batch.set(docRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('kantaParchi', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "kantaParchi", docId: kantaParchiData.srNo, docPath: getTenantCollectionPath("kantaParchi").join("/"), summary: `Created kanta parchi ${kantaParchiData.srNo}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    return dataWithTimestamp as KantaParchi;
}

export async function updateKantaParchi(srNo: string, kantaParchiData: Partial<Omit<KantaParchi, 'id' | 'srNo'>>): Promise<boolean> {
    if (!srNo) return false;
    const batch = writeBatch(firestoreDB);
    const docRef = doc(kantaParchiCollection, srNo);
    const data = withEditMetadata({ ...kantaParchiData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('kantaParchi', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "kantaParchi", docId: srNo, docPath: getTenantCollectionPath("kantaParchi").join("/"), summary: `Updated kanta parchi ${srNo}`, afterData: data }).catch(() => {});
    return true;
}

export async function deleteKantaParchi(srNo: string): Promise<void> {
    if (!srNo) return;
    const docRef = doc(kantaParchiCollection, srNo);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "kantaParchi", docId: srNo, docPath: getTenantCollectionPath("kantaParchi").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted kanta parchi ${srNo}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('kantaParchi', { batch });
    await batch.commit();
}

export async function getKantaParchiBySrNo(srNo: string): Promise<KantaParchi | null> {
    const docRef = doc(kantaParchiCollection, srNo);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as KantaParchi;
    }
    return null;
}

export function getKantaParchiRealtime(callback: (kantaParchi: KantaParchi[]) => void, onError: (error: Error) => void): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<KantaParchi>(
            kantaParchiCollection, 
            'lastSync:kantaParchi', 
            db?.kantaParchi,
            'updatedAt',
            'srNo'
        );
    };

    return createMetadataBasedListener<KantaParchi>(
        {
            collectionName: 'kantaParchi',
            fetchFunction,
            localTableName: 'kantaParchi'
        },
        callback,
        onError
    );
}

// --- Customer Document Functions ---
export async function addCustomerDocument(documentData: CustomerDocument): Promise<CustomerDocument> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(customerDocumentsCollection, documentData.documentSrNo);
    const base = { ...documentData, createdAt: documentData.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const dataWithTimestamp = withCreateMetadata(base as Record<string, unknown>);
    batch.set(docRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('customerDocuments', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "customerDocuments", docId: documentData.documentSrNo, docPath: getTenantCollectionPath("customerDocuments").join("/"), summary: `Created customer document ${documentData.documentSrNo}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    return dataWithTimestamp as CustomerDocument;
}

export async function updateCustomerDocument(documentSrNo: string, documentData: Partial<Omit<CustomerDocument, 'id' | 'documentSrNo' | 'kantaParchiSrNo'>>): Promise<boolean> {
    if (!documentSrNo) return false;
    const batch = writeBatch(firestoreDB);
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    const data = withEditMetadata({ ...documentData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('customerDocuments', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "customerDocuments", docId: documentSrNo, docPath: getTenantCollectionPath("customerDocuments").join("/"), summary: `Updated customer document ${documentSrNo}`, afterData: data }).catch(() => {});
    return true;
}

export async function deleteCustomerDocument(documentSrNo: string): Promise<void> {
    if (!documentSrNo) return;
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "customerDocuments", docId: documentSrNo, docPath: getTenantCollectionPath("customerDocuments").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted customer document ${documentSrNo}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('customerDocuments', { batch });
    await batch.commit();
}

export async function getCustomerDocumentBySrNo(documentSrNo: string): Promise<CustomerDocument | null> {
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CustomerDocument;
    }
    return null;
}

export function getCustomerDocumentsByKantaParchiSrNo(kantaParchiSrNo: string, callback: (documents: CustomerDocument[]) => void, onError: (error: Error) => void): () => void {
    const q = query(customerDocumentsCollection, where("kantaParchiSrNo", "==", kantaParchiSrNo), orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument));
        callback(documents);
    }, onError);
}

export function getCustomerDocumentsRealtime(callback: (documents: CustomerDocument[]) => void, onError: (error: Error) => void): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<CustomerDocument>(
            customerDocumentsCollection, 
            'lastSync:customerDocuments', 
            db?.customerDocuments,
            'updatedAt',
            'documentSrNo'
        );
    };

    return createMetadataBasedListener<CustomerDocument>(
        {
            collectionName: 'customerDocuments',
            fetchFunction,
            localTableName: 'customerDocuments'
        },
        callback,
        onError
    );
}

// --- Inventory Item Functions ---
export async function addInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(inventoryItemsCollection);
  const dataWithTimestamp = withCreateMetadata({ ...item, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  batch.set(docRef, dataWithTimestamp);
  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  await batch.commit();
  logActivity({ type: "create", collection: "inventoryItems", docId: docRef.id, docPath: getTenantCollectionPath("inventoryItems").join("/"), summary: `Created inventory item ${(item as any).name || docRef.id}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
  return { id: docRef.id, ...dataWithTimestamp } as InventoryItem;
}

export async function updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<void> {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(inventoryItemsCollection, id);
  const data = withEditMetadata({ ...item, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  batch.update(docRef, data);
  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  await batch.commit();
  logActivity({ type: "edit", collection: "inventoryItems", docId: id, docPath: getTenantCollectionPath("inventoryItems").join("/"), summary: `Updated inventory item ${id}`, afterData: data }).catch(() => {});
}

export async function deleteInventoryItem(id: string) {
  const docRef = doc(inventoryItemsCollection, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await moveToRecycleBin({ collection: "inventoryItems", docId: id, docPath: getTenantCollectionPath("inventoryItems").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted inventory item ${id}` });
  }
  const batch = writeBatch(firestoreDB);
  batch.delete(docRef);
  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  await batch.commit();
}


// --- Payment Functions ---
export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  
  // Find payments from IndexedDB first (local-first)
  const paymentIdsToDelete: string[] = [];
  
  if (db) {
    const allPayments = await db.payments.toArray();
    const paymentIdsToRemoveFromFile: string[] = [];
    for (const payment of allPayments) {
      if (payment.paidFor && Array.isArray(payment.paidFor)) {
        const hasMatchingSrNo = payment.paidFor.some((pf: PaidFor) => pf.srNo === srNo);
        if (hasMatchingSrNo) {
          paymentIdsToDelete.push(payment.id);
          paymentIdsToRemoveFromFile.push(String((payment as any).paymentId ?? payment.id).trim());
        }
      }
    }
    
    // File-first (local folder): remove from file then Dexie
    const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false }));
    if (isLocalFolderMode() && paymentIdsToRemoveFromFile.length > 0) {
      await removePaymentsFromFolderFile('payments', paymentIdsToRemoveFromFile).catch(() => {});
    }
    if (paymentIdsToDelete.length > 0) {
      await db.payments.bulkDelete(paymentIdsToDelete);
    }
  }
  
  // Enqueue sync tasks for payment deletions
  if (paymentIdsToDelete.length > 0) {
    const { enqueueSyncTask } = await import('./sync-queue');
    for (const paymentId of paymentIdsToDelete) {
      await enqueueSyncTask('delete:payment', { id: paymentId }, { 
        attemptImmediate: true, 
        dedupeKey: `delete:payment:${paymentId}` 
      });
    }
  }
}

export async function deleteAllPayments(): Promise<void> {
    const snapshot = await getDocs(supplierPaymentsCollection);
    const batch = writeBatch(firestoreDB);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    if (db) {
        await db.payments.clear();
    }
}

export async function deleteCustomerPaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  
  // Find payments from IndexedDB first (local-first)
  const paymentIdsToDelete: string[] = [];
  
  if (db) {
    const allPayments = await db.customerPayments.toArray();
    const paymentIdsToRemoveFromFile: string[] = [];
    for (const payment of allPayments) {
      if (payment.paidFor && Array.isArray(payment.paidFor)) {
        const hasMatchingSrNo = payment.paidFor.some((pf: PaidFor) => pf.srNo === srNo);
        if (hasMatchingSrNo) {
          paymentIdsToDelete.push(payment.id);
          paymentIdsToRemoveFromFile.push(String((payment as any).paymentId ?? payment.id).trim());
        }
      }
    }
    
    const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false }));
    if (isLocalFolderMode() && paymentIdsToRemoveFromFile.length > 0) {
      await removePaymentsFromFolderFile('customerPayments', paymentIdsToRemoveFromFile).catch(() => {});
    }
    if (paymentIdsToDelete.length > 0) {
      await db.customerPayments.bulkDelete(paymentIdsToDelete);
    }
  }
  
  // Enqueue sync tasks for payment deletions
  if (paymentIdsToDelete.length > 0) {
    const { enqueueSyncTask } = await import('./sync-queue');
    for (const paymentId of paymentIdsToDelete) {
      await enqueueSyncTask('delete:customerPayment', { id: paymentId }, { 
        attemptImmediate: true, 
        dedupeKey: `delete:customerPayment:${paymentId}` 
      });
    }
  }
}


// --- Fund Transaction Functions ---
export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'transactionId' | 'date'>): Promise<FundTransaction> {
  const dataWithDate = withCreateMetadata({ ...transactionData, date: new Date().toISOString(), updatedAt: new Date().toISOString() } as Record<string, unknown>);
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const saved = { id, transactionId: '', ...dataWithDate } as FundTransaction;
  try {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(fundTransactionsCollection, id);
    batch.set(docRef, dataWithDate);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('fundTransactions', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "fundTransactions", docId: id, docPath: getTenantCollectionPath("fundTransactions").join("/"), summary: `Created fund transaction ${id}`, afterData: dataWithDate as Record<string, unknown> }).catch(() => {});
  } catch {
    // Firestore failed (e.g. local folder mode) — save to IndexedDB only
  }
  if (typeof window !== 'undefined' && db) {
    try {
      const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
      if (isLocalFolderMode()) await mergeRecordToFolderFile('fundTransactions', saved as unknown as Record<string, unknown>, 'id').catch(() => {});
      await db.fundTransactions.put(saved);
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'fundTransactions' } }));
    } catch { /* ignore */ }
  }
  return saved;
}

export async function updateFundTransaction(id: string, data: Partial<FundTransaction>): Promise<void> {
    const updateData = withEditMetadata({ ...data, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    try {
      const batch = writeBatch(firestoreDB);
      const docRef = doc(fundTransactionsCollection, id);
      batch.update(docRef, updateData);
      const { notifySyncRegistry } = await import('./sync-registry');
      await notifySyncRegistry('fundTransactions', { batch });
      await batch.commit();
      logActivity({ type: "edit", collection: "fundTransactions", docId: id, docPath: getTenantCollectionPath("fundTransactions").join("/"), summary: `Updated fund transaction ${id}`, afterData: updateData }).catch(() => {});
    } catch { /* Firestore failed — update IndexedDB only */ }
    if (typeof window !== 'undefined' && db) {
      try {
        const existing = await db.fundTransactions.get(id);
        if (existing) {
          const updated = { ...existing, ...data, updatedAt: (updateData as { updatedAt?: string }).updatedAt };
          const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
          if (isLocalFolderMode()) await mergeRecordToFolderFile('fundTransactions', updated as unknown as Record<string, unknown>, 'id').catch(() => {});
          await db.fundTransactions.put(updated);
          window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'fundTransactions' } }));
        }
      } catch { /* ignore */ }
    }
  }

export async function deleteFundTransaction(id: string): Promise<void> {
    try {
      const docRef = doc(fundTransactionsCollection, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await moveToRecycleBin({ collection: "fundTransactions", docId: id, docPath: getTenantCollectionPath("fundTransactions").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted fund transaction ${id}` });
      }
      const batch = writeBatch(firestoreDB);
      batch.delete(docRef);
      const { notifySyncRegistry } = await import('./sync-registry');
      await notifySyncRegistry('fundTransactions', { batch });
      await batch.commit();
    } catch { /* Firestore failed — delete from IndexedDB only */ }
    if (typeof window !== 'undefined' && db) {
      try {
        const { isLocalFolderMode, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removeRecordFromFolderFile: async () => false }));
        if (isLocalFolderMode()) await removeRecordFromFolderFile('fundTransactions', id, 'id').catch(() => {});
        await db.fundTransactions.delete(id);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'fundTransactions' } }));
      } catch { /* ignore */ }
    }
}


// --- Income/Expense Category Functions ---

export function getIncomeCategories(callback: (data: IncomeCategory[]) => void, onError: (error: Error) => void) {
    const fetchFunction = async () => {
        return await getAllIncomeCategories();
    };

    return createMetadataBasedListener<IncomeCategory>(
        {
            collectionName: 'incomeCategories',
            fetchFunction,
            localTableName: 'incomeCategories'
        },
        callback,
        onError
    );
}

export function getExpenseCategories(callback: (data: ExpenseCategory[]) => void, onError: (error: Error) => void) {
    const fetchFunction = async () => {
        return await getAllExpenseCategories();
    };

    return createMetadataBasedListener<ExpenseCategory>(
        {
            collectionName: 'expenseCategories',
            fetchFunction,
            localTableName: 'expenseCategories'
        },
        callback,
        onError
    );
}

// Fetch ALL categories without incremental sync (for category manager)
export async function getAllIncomeCategories(): Promise<IncomeCategory[]> {
    try {
        const path = getTenantCollectionPath("incomeCategories");
        const q = query(collection(firestoreDB, ...path), orderBy("name"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IncomeCategory));
    } catch (error) {
        throw error;
    }
}

export async function getAllExpenseCategories(): Promise<ExpenseCategory[]> {
    try {
        const path = getTenantCollectionPath("expenseCategories");
        const q = query(collection(firestoreDB, ...path), orderBy("name"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseCategory));
    } catch (error) {
        throw error;
    }
}

export async function addCategory(collectionName: "incomeCategories" | "expenseCategories", category: { name: string; nature?: string }) {
    const batch = writeBatch(firestoreDB);
    const path = getTenantCollectionPath(collectionName);
    const newDocRef = doc(collection(firestoreDB, ...path));
    const base = { ...category, subCategories: [], updatedAt: Timestamp.now() };
    const data = withCreateMetadata(base as Record<string, unknown>);

    batch.set(newDocRef, data);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });

    await batch.commit();
    await logActivity({
      type: "create",
      collection: collectionName,
      docId: newDocRef.id,
      docPath: path.join("/"),
      summary: `Created ${category.name} in ${collectionName}`,
      afterData: data,
    });
}

export async function updateCategoryName(collectionName: "incomeCategories" | "expenseCategories", id: string, name: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath(collectionName, id));
    const data = withEditMetadata({ name, updatedAt: Timestamp.now() } as Record<string, unknown>);

    batch.update(docRef, data);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });

    await batch.commit();
    await logActivity({
      type: "edit",
      collection: collectionName,
      docId: id,
      docPath: getTenantCollectionPath(collectionName).join("/"),
      summary: `Updated ${collectionName}/${id} to ${name}`,
      afterData: data,
    });
}

export async function deleteCategory(collectionName: "incomeCategories" | "expenseCategories", id: string) {
    const docRef = doc(firestoreDB, ...getTenantDocPath(collectionName, id));
    const snap = await getDoc(docRef);
    const beforeData = snap.exists() ? { id: snap.id, ...snap.data() } : {};

    if (Object.keys(beforeData).length > 0) {
      await moveToRecycleBin({
        collection: collectionName,
        docId: id,
        docPath: getTenantCollectionPath(collectionName).join("/"),
        data: beforeData as Record<string, unknown>,
        summary: `Deleted ${collectionName}/${id}`,
      });
    }

    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });

    await batch.commit();
}

export async function addSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath(collectionName, categoryId));
    
    batch.update(docRef, {
        subCategories: arrayUnion(subCategoryName),
        updatedAt: Timestamp.now()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });
    
    await batch.commit();
}

export async function deleteSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath(collectionName, categoryId));
    
    batch.update(docRef, {
        subCategories: arrayRemove(subCategoryName),
        updatedAt: Timestamp.now()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });
    
    await batch.commit();
}

// --- Attendance Functions ---

export async function getAttendanceForPeriod(employeeId: string, startDate: string, endDate: string): Promise<AttendanceEntry[]> {
    const q = query(
        attendanceCollection, 
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
}

export async function setAttendance(entry: AttendanceEntry): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(attendanceCollection, entry.id);
    const data = withEditMetadata({ ...entry, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(docRef, data, { merge: true });
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('attendance', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "attendance", docId: entry.id, docPath: getTenantCollectionPath("attendance").join("/"), summary: `Updated attendance ${entry.id}`, afterData: data }).catch(() => {});
}

export function getAttendanceRealtime(
    callback: (data: AttendanceEntry[]) => void,
    onError: (error: Error) => void,
    dateFilter?: string // Optional: filter by specific date
): () => void {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.attendance.toArray() : [];
        }, callback);
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:attendance');
        return stored ? parseInt(stored, 10) : undefined;
    };

    let firestoreAttendance: AttendanceEntry[] = [];
    
    // ✅ Read from local IndexedDB first (immediate response)
    if (db) {
        db.attendance.toArray().then((localAttendance) => {
            if (dateFilter) {
                const filtered = localAttendance.filter(a => a.date === dateFilter);
                callback(filtered as AttendanceEntry[]);
            } else {
                callback(localAttendance as AttendanceEntry[]);
            }
        }).catch(() => {
            // If IndexedDB read fails, Firestore will call callback
        });
    }

    // Build query
    let q;
    if (dateFilter) {
        // Filter by specific date
        q = query(
            attendanceCollection,
            where('date', '==', dateFilter),
            orderBy('date', 'desc')
        );
    } else {
        // Get all attendance
        const lastSyncTime = getLastSyncTime();
        if (lastSyncTime) {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                attendanceCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } else {
            q = query(attendanceCollection, orderBy('date', 'desc'));
        }
    }

    // ✅ Always fetch all attendance from Firestore (source of truth)
    getDocs(q).then((fullSnapshot) => {
        const allAttendance = fullSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
        firestoreAttendance = allAttendance;
        callback(allAttendance);
        
        // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
        if (db && allAttendance.length > 0) {
            import('./chunked-operations').then(({ chunkedBulkPut }) => {
                chunkedBulkPut(db.attendance, allAttendance, 100).catch(() => {});
            });
        }
        
        // ✅ Save last sync time
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:attendance', String(Date.now()));
        }
    }).catch((error) => {
        onError(error as Error);
    });

    // ✅ Set up realtime listener for future changes
    return onSnapshot(q, (snapshot) => {
        const attendance = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
        
        // Merge with existing data if not filtering by date
        if (!dateFilter) {
            // Merge new/changed entries with existing
            attendance.forEach(entry => {
                const index = firestoreAttendance.findIndex(a => a.id === entry.id);
                if (index >= 0) {
                    firestoreAttendance[index] = entry;
                } else {
                    firestoreAttendance.push(entry);
                }
            });
            callback([...firestoreAttendance]);
        } else {
            callback(attendance);
        }
        
        // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
        if (db && attendance.length > 0) {
            import('./chunked-operations').then(({ chunkedBulkPut }) => {
                chunkedBulkPut(db.attendance, attendance, 100).catch(() => {});
            });
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:attendance', String(Date.now()));
        }
    }, (err: unknown) => {
        onError(err as Error);
    });
}

// --- Project Functions ---
export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(projectsCollection);
    const now = new Date().toISOString();
    const data = withCreateMetadata({ ...projectData, createdAt: now, updatedAt: now } as Record<string, unknown>);
    batch.set(newDocRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('projects', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "projects", docId: newDocRef.id, docPath: getTenantCollectionPath("projects").join("/"), summary: `Created project ${(projectData as any).name || newDocRef.id}`, afterData: data }).catch(() => {});
    return { id: newDocRef.id, ...projectData, createdAt: now, updatedAt: now };
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(projectsCollection, id);
    const data = withEditMetadata({ ...projectData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('projects', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "projects", docId: id, docPath: getTenantCollectionPath("projects").join("/"), summary: `Updated project ${id}`, afterData: data }).catch(() => {});
}

export async function deleteProject(id: string): Promise<void> {
    const docRef = doc(projectsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "projects", docId: id, docPath: getTenantCollectionPath("projects").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted project ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('projects', { batch });
    await batch.commit();
}


// --- Loan Functions ---
export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `loan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const dataWithTimestamp = withCreateMetadata({ ...loanData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    const saved = { id, ...dataWithTimestamp } as Loan;
    try {
        const batch = writeBatch(firestoreDB);
        const docRef = doc(loansCollection, id);
        batch.set(docRef, dataWithTimestamp);
        if ((loanData.loanType === 'Bank' || loanData.loanType === 'Outsider') && loanData.totalAmount > 0) {
            const fundData = withCreateMetadata({
                type: 'CapitalInflow',
                source: loanData.loanType === 'Bank' ? 'BankLoan' : 'ExternalLoan',
                destination: loanData.depositTo,
                amount: loanData.totalAmount,
                description: `Capital inflow from ${loanData.loanName}`,
                date: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            } as Record<string, unknown>);
            const fundDocRef = doc(fundTransactionsCollection);
            batch.set(fundDocRef, fundData);
            const { notifySyncRegistry } = await import('./sync-registry');
            await notifySyncRegistry('fundTransactions', { batch });
        }
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('loans', { batch });
        await batch.commit();
        logActivity({ type: "create", collection: "loans", docId: id, docPath: getTenantCollectionPath("loans").join("/"), summary: `Created loan ${(loanData as any).loanName || id}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    } catch {
        // Firestore failed (e.g. local folder mode) — save to IndexedDB only
    }
    if (typeof window !== 'undefined' && db) {
        try {
            const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
            if (isLocalFolderMode()) await mergeRecordToFolderFile('loans', saved as unknown as Record<string, unknown>, 'id').catch(() => {});
            await db.loans.put(saved);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'loans' } }));
        } catch { /* ignore */ }
    }
    return saved;
}

export async function updateLoan(id: string, loanData: Partial<Loan>): Promise<void> {
    const data = withEditMetadata({ ...loanData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    try {
        const batch = writeBatch(firestoreDB);
        const docRef = doc(loansCollection, id);
        batch.update(docRef, data);
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('loans', { batch });
        await batch.commit();
        logActivity({ type: "edit", collection: "loans", docId: id, docPath: getTenantCollectionPath("loans").join("/"), summary: `Updated loan ${id}`, afterData: data }).catch(() => {});
    } catch { /* Firestore failed — update IndexedDB only */ }
    if (typeof window !== 'undefined' && db) {
        try {
            const existing = await db.loans.get(id);
            if (existing) {
                const updated = { ...existing, ...loanData, updatedAt: (data as { updatedAt?: string }).updatedAt };
                const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
                if (isLocalFolderMode()) await mergeRecordToFolderFile('loans', updated as unknown as Record<string, unknown>, 'id').catch(() => {});
                await db.loans.put(updated);
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'loans' } }));
            }
        } catch { /* ignore */ }
    }
}

export async function deleteLoan(id: string): Promise<void> {
    try {
        const docRef = doc(loansCollection, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            await moveToRecycleBin({ collection: "loans", docId: id, docPath: getTenantCollectionPath("loans").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted loan ${id}` });
        }
        const batch = writeBatch(firestoreDB);
        batch.delete(docRef);
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('loans', { batch });
        await batch.commit();
    } catch { /* Firestore failed — delete from IndexedDB only */ }
    if (typeof window !== 'undefined' && db) {
        try {
            const { isLocalFolderMode, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removeRecordFromFolderFile: async () => false }));
            if (isLocalFolderMode()) await removeRecordFromFolderFile('loans', id, 'id').catch(() => {});
            await db.loans.delete(id);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'loans' } }));
        } catch { /* ignore */ }
    }
}


// --- Customer Payment Functions ---

export async function addCustomerPayment(paymentData: Omit<CustomerPayment, 'id'>): Promise<CustomerPayment> {
    const docRef = doc(customerPaymentsCollection, paymentData.paymentId);
    const newPayment = withCreateMetadata({ ...paymentData, id: docRef.id } as Record<string, unknown>);
    await setDoc(docRef, newPayment);
    logActivity({ type: "create", collection: "customer_payments", docId: docRef.id, docPath: getTenantCollectionPath("customer_payments").join("/"), summary: `Created customer payment ${docRef.id}`, afterData: newPayment }).catch(() => {});
    return newPayment as CustomerPayment;
}

export async function deleteCustomerPayment(id: string): Promise<void> {
    const docRef = doc(customerPaymentsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "customer_payments", docId: id, docPath: getTenantCollectionPath("customer_payments").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted customer payment ${id}` });
    }
    await deleteDoc(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('customerPayments');
    if (typeof window !== 'undefined' && db) {
      try {
        const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false }));
        if (isLocalFolderMode()) await removePaymentsFromFolderFile('customerPayments', [id]).catch(() => {});
        await db.customerPayments.delete(id);
        await db.customerPayments.where('paymentId').equals(id).delete();
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'customerPayments' } }));
      } catch {
        // ignore
      }
    }
}


// --- Income and Expense specific functions ---
export async function addIncome(incomeData: Omit<Income, 'id'>): Promise<Income> {
    try {
        const formatSettings = await getFormatSettings();
        const newTransactionId = incomeData.transactionId || (await (async () => {
            const incomesSnapshot = await retryFirestoreOperation(
                () => getDocs(query(incomesCollection, orderBy('transactionId', 'desc'), limit(1))),
                'addIncome - get last transaction ID'
            );
            const lastNum = incomesSnapshot.empty ? 0 : parseInt(incomesSnapshot.docs[0].data().transactionId.replace(formatSettings.income?.prefix || 'IN', '')) || 0;
            return generateReadableId(formatSettings.income?.prefix || 'IN', lastNum, formatSettings.income?.padding || 5);
        })());

        // SAFETY CHECK: Prevent overwriting existing document
        const docRef = doc(incomesCollection, newTransactionId);
        const existingDoc = await retryFirestoreOperation(
            () => getDoc(docRef),
            'addIncome - check existing document'
        );
        
        if (existingDoc.exists()) {
            throw new Error(`Transaction ID ${newTransactionId} already exists! Cannot overwrite existing document.`);
        }
        
        const newIncome = withCreateMetadata(stripUndefined({ ...incomeData, transactionId: newTransactionId, id: docRef.id } as Record<string, unknown>));
        const batch = writeBatch(firestoreDB);
        batch.set(docRef, newIncome);
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('incomes', { batch });
        await retryFirestoreOperation(() => batch.commit(), 'addIncome - commit batch');
        logActivity({ type: "create", collection: "incomes", docId: newTransactionId, docPath: getTenantCollectionPath("incomes").join("/"), summary: `Created income ${newTransactionId}`, afterData: newIncome as Record<string, unknown> }).catch(() => {});
        const saved = newIncome as Income;
        if (typeof window !== 'undefined' && db?.transactions) {
            try {
                const toSave = { ...saved, type: 'Income' as const, transactionType: 'Income' as const };
                await db.transactions.put(toSave);
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'incomes' } }));
            } catch {
                // ignore
            }
        }
        return saved;
    } catch (error) {
        logError(error, `addIncome(${incomeData.transactionId || 'new'})`, 'high');
        throw error;
    }
}

export async function addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const formatSettings = await getFormatSettings();
    
    // Use the provided transactionId if it exists, otherwise generate a new one.
    const newTransactionId = expenseData.transactionId || (await (async () => {
        const expensesSnapshot = await getDocs(query(expensesCollection, orderBy('transactionId', 'desc'), limit(1)));
        
        let lastNum = 0;
        if (!expensesSnapshot.empty) {
            const lastId = expensesSnapshot.docs[0].data().transactionId;
            const prefix = formatSettings.expense?.prefix || 'EX';
            if (lastId && lastId.startsWith(prefix)) {
                lastNum = parseInt(lastId.replace(prefix, ''), 10) || 0;
            }
        }
        
        return generateReadableId(formatSettings.expense?.prefix || 'EX', lastNum, formatSettings.expense?.padding || 5);
    })());
    
    // SAFETY CHECK: Prevent overwriting existing document
    const docRef = doc(expensesCollection, newTransactionId);
    const existingDoc = await getDoc(docRef);
    
    if (existingDoc.exists()) {
        throw new Error(`Transaction ID ${newTransactionId} already exists! Cannot overwrite existing document.`);
    }
    
    const newExpense = withCreateMetadata(stripUndefined({ ...expenseData, transactionId: newTransactionId, id: docRef.id } as Record<string, unknown>));
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, newExpense);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "expenses", docId: newTransactionId, docPath: getTenantCollectionPath("expenses").join("/"), summary: `Created expense ${newTransactionId}`, afterData: newExpense as Record<string, unknown> }).catch(() => {});
    const saved = newExpense as Expense;
    if (typeof window !== 'undefined' && db?.transactions) {
        try {
            const toSave = { ...saved, type: 'Expense' as const, transactionType: 'Expense' as const };
            await db.transactions.put(toSave);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'expenses' } }));
        } catch {
            // ignore
        }
    }
    return saved;
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    const data = withEditMetadata(stripUndefined({ ...incomeData, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    const batch = writeBatch(firestoreDB);
    batch.update(doc(incomesCollection, id), data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('incomes', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "incomes", docId: id, docPath: getTenantCollectionPath("incomes").join("/"), summary: `Updated income ${id}`, afterData: data }).catch(() => {});

    if (db && db.transactions) {
        try {
            await db.transactions.update(id, { ...incomeData, updatedAt: data.updatedAt });
        } catch (error) {
            handleSilentError(error, 'updateIncome - local optimistic update');
        }
    }
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    const data = withEditMetadata(stripUndefined({ ...expenseData, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    const batch = writeBatch(firestoreDB);
    batch.update(doc(expensesCollection, id), data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "expenses", docId: id, docPath: getTenantCollectionPath("expenses").join("/"), summary: `Updated expense ${id}`, afterData: data }).catch(() => {});
    if (db && db.transactions) {
        try {
            await db.transactions.update(id, { ...expenseData, updatedAt: data.updatedAt });
        } catch (error) {
            handleSilentError(error, 'updateExpense - local optimistic update');
        }
    }
}

export async function deleteIncome(id: string): Promise<void> {
    const docRef = doc(incomesCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "incomes", docId: id, docPath: getTenantCollectionPath("incomes").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted income ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('incomes', { batch });
    await batch.commit();

    if (typeof window !== 'undefined' && db?.transactions) {
        try {
            await db.transactions.delete(id);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'incomes' } }));
        } catch {
            // ignore
        }
    }
}

export async function deleteExpense(id: string): Promise<void> {
    const docRef = doc(expensesCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "expenses", docId: id, docPath: getTenantCollectionPath("expenses").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted expense ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    await batch.commit();

    if (typeof window !== 'undefined' && db?.transactions) {
        try {
            await db.transactions.delete(id);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'expenses' } }));
        } catch {
            // ignore
        }
    }
}

export async function updateExpensePayee(oldPayee: string, newPayee: string): Promise<void> {
    const updatedAt = new Date().toISOString();
    const q = query(expensesCollection, where('payee', '==', oldPayee));
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    const idsToUpdate: string[] = [];

    snapshot.forEach(doc => {
        idsToUpdate.push(doc.id);
        batch.update(doc.ref, { 
            payee: toTitleCase(newPayee),
            updatedAt
        });
    });
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    
    await batch.commit();

    // ✅ Optimistic UI update
    if (db && db.transactions && idsToUpdate.length > 0) {
        try {
            await db.transactions.bulkUpdate(idsToUpdate.map(id => ({ 
                key: id, 
                changes: { payee: toTitleCase(newPayee), updatedAt } 
            })));
        } catch (error) {
            handleSilentError(error, 'updateExpensePayee - local optimistic update');
        }
    }
}

export async function updateIncomePayee(oldPayee: string, newPayee: string): Promise<void> {
    const updatedAt = new Date().toISOString();
    const q = query(incomesCollection, where('payee', '==', oldPayee));
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    const idsToUpdate: string[] = [];

    snapshot.forEach(doc => {
        idsToUpdate.push(doc.id);
        batch.update(doc.ref, { 
            payee: toTitleCase(newPayee),
            updatedAt
        });
    });
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('incomes', { batch });
    
    await batch.commit();

    // ✅ Optimistic UI update
    if (db && db.transactions && idsToUpdate.length > 0) {
        try {
             await db.transactions.bulkUpdate(idsToUpdate.map(id => ({ 
                key: id, 
                changes: { payee: toTitleCase(newPayee), updatedAt } 
            })));
        } catch (error) {
            handleSilentError(error, 'updateIncomePayee - local optimistic update');
        }
    }
}

export async function deleteExpensesForPayee(payee: string): Promise<void> {
    const q = query(expensesCollection, where('payee', '==', payee));
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

export async function deleteIncomesForPayee(payee: string): Promise<void> {
    const q = query(incomesCollection, where('payee', '==', payee));
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

// --- Account Management Functions ---
const buildAccountDocId = (name: string) =>
    toTitleCase(name || '').trim().replace(/\s+/g, '_').toLowerCase();

export async function addAccount(account: Omit<Account, 'id'>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const normalizedName = toTitleCase(account.name || '').trim();
    if (!normalizedName) throw new Error('Account name is required');
    const docRef = doc(accountsCollection, buildAccountDocId(normalizedName));
    const payload = withCreateMetadata({
        name: normalizedName,
        contact: account.contact?.trim() || undefined,
        address: account.address?.trim() || undefined,
        nature: account.nature || undefined,
        category: account.category?.trim() || undefined,
        subCategory: account.subCategory?.trim() || undefined,
        updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
    batch.set(docRef, payload, { merge: true });
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('accounts', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "accounts", docId: docRef.id, docPath: getTenantCollectionPath("accounts").join("/"), summary: `Created account ${normalizedName}`, afterData: payload }).catch(() => {});

    if (typeof window !== 'undefined' && db) {
      try {
        const toSave: Account = { id: docRef.id, name: normalizedName, ...(payload as Omit<Account, 'id' | 'name'>) };
        await db.accounts.put(toSave);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'accounts' } }));
      } catch {
        // ignore
      }
    }
}

export async function getAccount(name: string): Promise<Account | null> {
    const normalizedName = toTitleCase(name || '').trim();
    if (!normalizedName) return null;

    const docRef = doc(accountsCollection, buildAccountDocId(normalizedName));
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        return { ...docSnap.data() as Account, id: docSnap.id };
    }
    return null;
}

export async function getAllAccounts(): Promise<Account[]> {
    try {
        const snapshot = await getDocs(accountsCollection);
        return snapshot.docs.map(doc => ({
            ...(doc.data() as Account),
            id: doc.id,
        }));
    } catch (error) {
        throw error;
    }
}

export function getAccountsRealtime(
    callback: (data: Account[]) => void,
    onError: (error: Error) => void,
): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Account>(
            accountsCollection,
            'lastSync:accounts',
            db?.accounts,
            'updatedAt',
            'name'
        );
    };

    return createMetadataBasedListener<Account>(
        {
            collectionName: 'accounts',
            fetchFunction,
            localTableName: 'accounts'
        },
        callback,
        onError
    );
}

export async function updateAccount(account: Omit<Account, 'id'>, previousName?: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const normalizedName = toTitleCase(account.name || '').trim();
    if (!normalizedName) throw new Error('Account name is required');
    const isRename = previousName && toTitleCase(previousName).trim() !== normalizedName;
    if (isRename) {
        const prevDocId = buildAccountDocId(previousName!);
        const prevRef = doc(accountsCollection, prevDocId);
        const prevSnap = await getDoc(prevRef);
        if (prevSnap.exists()) {
          await moveToRecycleBin({ collection: "accounts", docId: prevDocId, docPath: getTenantCollectionPath("accounts").join("/"), data: { id: prevSnap.id, ...prevSnap.data() } as Record<string, unknown>, summary: `Deleted account (renamed) ${previousName}` });
        }
        batch.delete(prevRef);
    }
    const docRef = doc(accountsCollection, buildAccountDocId(normalizedName));
    const base = {
        name: normalizedName,
        contact: account.contact?.trim() || undefined,
        address: account.address?.trim() || undefined,
        nature: account.nature || undefined,
        category: account.category?.trim() || undefined,
        subCategory: account.subCategory?.trim() || undefined,
        updatedAt: new Date().toISOString(),
    };
    const payload = isRename ? withCreateMetadata(base as Record<string, unknown>) : withEditMetadata(base as Record<string, unknown>);
    batch.set(docRef, payload, { merge: true });
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('accounts', { batch });
    await batch.commit();
    logActivity({ type: isRename ? "create" : "edit", collection: "accounts", docId: docRef.id, docPath: getTenantCollectionPath("accounts").join("/"), summary: isRename ? `Created account ${normalizedName}` : `Updated account ${normalizedName}`, afterData: payload }).catch(() => {});

    if (typeof window !== 'undefined' && db) {
      try {
        if (isRename && previousName) {
          await db.accounts.delete(buildAccountDocId(previousName));
        }
        const toSave: Account = { id: docRef.id, name: normalizedName, ...(base as Omit<Account, 'id' | 'name'>) };
        await db.accounts.put(toSave);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'accounts' } }));
      } catch {
        // ignore
      }
    }
}

export async function deleteAccount(name: string): Promise<void> {
    const normalizedName = toTitleCase(name || '').trim();
    if (!normalizedName) return;
    const docId = buildAccountDocId(normalizedName);
    const docRef = doc(accountsCollection, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "accounts", docId, docPath: getTenantCollectionPath("accounts").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted account ${name}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('accounts', { batch });
    await batch.commit();

    if (typeof window !== 'undefined' && db) {
      try {
        await db.accounts.delete(docId);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'accounts' } }));
      } catch {
        // ignore
      }
    }
}

// --- Format Settings Functions ---
export async function getFormatSettings(): Promise<FormatSettings> {
    const docRef = doc(settingsCollection, "formats");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as FormatSettings;
    }
    // Return a default if it doesn't exist
    return {
        income: { prefix: 'IM', padding: 5 },
        expense: { prefix: 'ES', padding: 5 },
        loan: { prefix: 'LN', padding: 4 },
        fundTransaction: { prefix: 'AT', padding: 4 },
        supplier: { prefix: 'S', padding: 5 },
        customer: { prefix: 'C', padding: 5 },
        supplierPayment: { prefix: 'SP', padding: 5 },
        customerPayment: { prefix: 'CP', padding: 5 },
    };
}

export async function saveFormatSettings(settings: FormatSettings): Promise<void> {
    const docRef = doc(settingsCollection, "formats");
    await setDoc(docRef, settings, { merge: true });
}

export async function addTransaction(transactionData: Omit<Transaction, 'id'|'transactionId'>) {
    const { transactionType } = transactionData;
    const collectionRef = transactionType === 'Income' ? incomesCollection : expensesCollection;
    return addDoc(collectionRef, transactionData);
}
    
// --- Batch Deletion for All Suppliers ---
export async function deleteAllSuppliers(): Promise<void> {
  const allDocs = await getDocs(suppliersCollection);
  const batch = writeBatch(firestoreDB);
  allDocs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  if (db) {
    await db.suppliers.clear();
  }
}


// --- Employee Functions ---
export async function addEmployee(employeeData: Partial<Omit<Employee, 'id'>>) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(employeesCollection, employeeData.employeeId);
    const dataToSave = withCreateMetadata({ ...employeeData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(docRef, dataToSave, { merge: true });
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('employees', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "employees", docId: docRef.id, docPath: getTenantCollectionPath("employees").join("/"), summary: `Created employee ${(employeeData as any).name || docRef.id}`, afterData: dataToSave }).catch(() => {});
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(employeesCollection, id);
    const data = withEditMetadata({ ...employeeData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('employees', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "employees", docId: id, docPath: getTenantCollectionPath("employees").join("/"), summary: `Updated employee ${id}`, afterData: data }).catch(() => {});
}

export async function deleteEmployee(id: string) {
    const docRef = doc(employeesCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "employees", docId: id, docPath: getTenantCollectionPath("employees").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted employee ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('employees', { batch });
    await batch.commit();
}

// --- Payroll Functions ---
export async function addPayrollEntry(entryData: Omit<PayrollEntry, 'id'>) {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(payrollCollection);
    const dataWithTimestamp = withCreateMetadata({ ...entryData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(newDocRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('payroll', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "payroll", docId: newDocRef.id, docPath: getTenantCollectionPath("payroll").join("/"), summary: `Created payroll entry ${newDocRef.id}`, afterData: dataWithTimestamp }).catch(() => {});
    return { id: newDocRef.id, ...dataWithTimestamp };
}

export async function updatePayrollEntry(id: string, entryData: Partial<PayrollEntry>) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(payrollCollection, id);
    const data = withEditMetadata({ ...entryData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('payroll', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "payroll", docId: id, docPath: getTenantCollectionPath("payroll").join("/"), summary: `Updated payroll entry ${id}`, afterData: data }).catch(() => {});
}

export async function deletePayrollEntry(id: string) {
    const docRef = doc(payrollCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "payroll", docId: id, docPath: getTenantCollectionPath("payroll").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted payroll entry ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('payroll', { batch });
    await batch.commit();
}

// --- Holiday Functions ---
export async function getHolidays(): Promise<Holiday[]> {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    if (db) {
        try {
            const localHolidays = await db.settings.where('id').startsWith('holiday:').toArray();
            if (localHolidays.length > 0) {
                return localHolidays as Holiday[];
            }
        } catch (error) {
            // If local read fails, continue with Firestore
            handleSilentError(error, 'getHolidays - local read fallback');
        }
    }

    // ✅ Use incremental sync - only get changed holidays
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:holidays');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    const holidaysPath = getTenantCollectionPath("holidays");
    if (lastSyncTime) {
        // Only get documents modified after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            collection(firestoreDB, ...holidaysPath),
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(collection(firestoreDB, ...holidaysPath));
    }

    const querySnapshot = await getDocs(q);
    const holidays = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Holiday));
    
    // Save to local IndexedDB and update last sync time
    if (db && holidays.length > 0) {
        // Note: Holidays might be stored differently, adjust as needed
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:holidays', String(Date.now()));
        }
    }
    
    return holidays;
}

export async function addHoliday(date: string, name: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath("holidays", date));
    batch.set(docRef, { date, name, updatedAt: Timestamp.now() });
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('holidays', { batch });
    await batch.commit();
}

export async function deleteHoliday(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath("holidays", id));
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('holidays', { batch });
    await batch.commit();
}

// --- Daily Payment Limit ---
export async function getDailyPaymentLimit(): Promise<number> {
    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().dailyPaymentLimit) {
        return docSnap.data().dailyPaymentLimit;
    }
    return 800000; // Default limit
}

// --- PAGINATED/INITIAL DATA FETCHING ---
export async function getInitialSuppliers(count = 50) {
  const q = query(suppliersCollection, orderBy("srNo", "desc"), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

export async function getMoreSuppliers(startAfterDoc: QueryDocumentSnapshot<DocumentData> | null, count = 50) {
  if (!startAfterDoc) return { data: [], lastVisible: null, hasMore: false };
  const q = query(suppliersCollection, orderBy("srNo", "desc"), startAfter(startAfterDoc), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

// Fetch ALL suppliers (use cautiously for manual sync)
export async function getAllSuppliers(): Promise<Customer[]> {
  // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
  if (db) {
    try {
      const localSuppliers = await db.suppliers.toArray();
      if (localSuppliers.length > 0) {
        return localSuppliers;
      }
    } catch (error) {
      // If local read fails, continue with Firestore
      handleSilentError(error, 'getAllSuppliers - local read fallback');
    }
  }

  // ✅ FIX: Always do FULL sync to ensure we get ALL documents
  // Incremental sync misses documents without updatedAt or with incorrect timestamps
  let q;
  try {
    // Try with orderBy first (faster if index exists)
    q = query(suppliersCollection, orderBy("srNo", "desc"));
  } catch (error: unknown) {
    // If orderBy fails (missing index), use simple query
    q = query(suppliersCollection);
  }

  const snapshot = await getDocs(q);
  const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  
  // Track Firestore read
  firestoreMonitor.logRead('suppliers', 'getAllSuppliers', suppliers.length);
  
  // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
  if (db && suppliers.length > 0) {
    const { chunkedBulkPut } = await import('./chunked-operations');
    await chunkedBulkPut(db.suppliers, suppliers, 100);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSync:suppliers', String(Date.now()));
    }
  }
  
  return suppliers;
}

export async function getAllCustomers(): Promise<Customer[]> {
  // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
  if (db) {
    try {
      const localCustomers = await db.customers.toArray();
      if (localCustomers.length > 0) {
        return localCustomers;
      }
    } catch (error) {
      // If local read fails, continue with Firestore
      handleSilentError(error, 'getAllCustomers - local read fallback');
    }
  }

  // ✅ FIX: Always do FULL sync to ensure we get ALL documents
  // Incremental sync misses documents without updatedAt or with incorrect timestamps
  let q;
  try {
    // Try with orderBy first (faster if index exists)
    q = query(customersCollection, orderBy("srNo", "desc"));
  } catch (error: unknown) {
    // If orderBy fails (missing index), use simple query
    q = query(customersCollection);
  }

  const snapshot = await getDocs(q);
  const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  
  // Track Firestore read
  firestoreMonitor.logRead('customers', 'getAllCustomers', customers.length);
  
  // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
  if (db && customers.length > 0) {
    const { chunkedBulkPut } = await import('./chunked-operations');
    await chunkedBulkPut(db.customers, customers, 100);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSync:customers', String(Date.now()));
    }
  }
  
  return customers;
}

export async function getInitialCustomers(count = 50) {
  const q = query(customersCollection, orderBy("srNo", "desc"), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

export async function getMoreCustomers(startAfterDoc: QueryDocumentSnapshot<DocumentData> | null, count = 50) {
  if (!startAfterDoc) return { data: [], lastVisible: null, hasMore: false };
  const q = query(customersCollection, orderBy("srNo", "desc"), startAfter(startAfterDoc), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

export async function getInitialPayments(count = 100) {
  const q = query(supplierPaymentsCollection, orderBy("date", "desc"), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

export async function getMorePayments(startAfterDoc: QueryDocumentSnapshot<DocumentData> | null, count = 100) {
  if (!startAfterDoc) return { data: [], lastVisible: null, hasMore: false };
  const q = query(supplierPaymentsCollection, orderBy("date", "desc"), startAfter(startAfterDoc), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

// Fetch ALL supplier payments (use cautiously for manual sync) - single payments collection for all (including Gov)
export async function getAllPayments(): Promise<Payment[]> {
  if (db) {
    try {
      const localPayments = await db.payments.toArray();
      if (localPayments.length > 0) {
        return localPayments;
      }
    } catch (error) {
      handleSilentError(error, 'getAllPayments - local read fallback');
    }
  }

  let q;
  try {
    q = query(supplierPaymentsCollection, orderBy("date", "desc"));
  } catch (error: unknown) {
    q = query(supplierPaymentsCollection);
  }

  const snapshot = await getDocs(q);
  const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
  
  firestoreMonitor.logRead('payments', 'getAllPayments', payments.length);
  
  if (db && payments.length > 0) {
    const { chunkedBulkPut } = await import('./chunked-operations');
    await chunkedBulkPut(db.payments, payments, 100);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSync:payments', String(Date.now()));
    }
  }
  
  return payments;
}

export async function getAllCustomerPayments(): Promise<CustomerPayment[]> {
  // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
  if (db) {
    try {
      const localPayments = await db.customerPayments.toArray();
      if (localPayments.length > 0) {
        return localPayments;
      }
    } catch (error) {
      // If local read fails, continue with Firestore
      handleSilentError(error, 'getAllCustomerPayments - local read fallback');
    }
  }

  // ✅ FIX: Always do FULL sync to ensure we get ALL documents
  // Incremental sync misses documents without updatedAt or with incorrect timestamps
  let q;
  try {
    // Try with orderBy first (faster if index exists)
    q = query(customerPaymentsCollection, orderBy("date", "desc"));
  } catch (error: unknown) {
    // If orderBy fails (missing index), use simple query
    q = query(customerPaymentsCollection);
  }

  const snapshot = await getDocs(q);
  const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
  
  // Save to local IndexedDB and update last sync time
  if (db && payments.length > 0) {
    // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
    if (payments.length > 0) {
      const { chunkedBulkPut } = await import('./chunked-operations');
      await chunkedBulkPut(db.customerPayments, payments, 100);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSync:customerPayments', String(Date.now()));
    }
  }
  
  return payments;
}

export async function getAllIncomes(): Promise<Income[]> {
  // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
  if (db) {
    try {
      const localTransactions = await db.transactions.where('type').equals('Income').toArray();
      if (localTransactions.length > 0) {
        return localTransactions as Income[];
      }
    } catch (error) {
      // If local read fails, continue with Firestore
      handleSilentError(error, 'getAllIncomes - local read fallback');
    }
  }

  // Always fetch ALL incomes from Firestore (no incremental sync for payee extraction)
  // This ensures we get all payees for the dropdown
  try {
    const q = query(incomesCollection);
    const snapshot = await getDocs(q);
    const incomes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
    return incomes;
  } catch (error) {
    throw error;
  }
}

export async function getAllExpenses(): Promise<Expense[]> {
  // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
  if (db) {
    try {
      const localTransactions = await db.transactions.where('type').equals('Expense').toArray();
      if (localTransactions.length > 0) {
        return localTransactions as Expense[];
      }
    } catch (error) {
      // If local read fails, continue with Firestore
      handleSilentError(error, 'getAllExpenses - local read fallback');
    }
  }

  // Always fetch ALL expenses from Firestore (no incremental sync for payee extraction)
  // This ensures we get all payees for the dropdown
  try {
    const q = query(expensesCollection);
    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    return expenses;
  } catch (error) {
    throw error;
  }
}

// Fetch ALL supplier bank accounts
export async function getAllSupplierBankAccounts(): Promise<BankAccount[]> {
  const snapshot = await getDocs(supplierBankAccountsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
}

// Fetch ALL banks
export async function getAllBanks(): Promise<Bank[]> {
  const snapshot = await getDocs(banksCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
}

// Fetch ALL bank branches
export async function getAllBankBranches(): Promise<BankBranch[]> {
  const snapshot = await getDocs(bankBranchesCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankBranch));
}

// Fetch ALL bank accounts (regular)
export async function getAllBankAccounts(): Promise<BankAccount[]> {
  const snapshot = await getDocs(bankAccountsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
}

// Fetch ALL projects
export async function getAllProjects(): Promise<Project[]> {
  const snapshot = await getDocs(projectsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
}

// Fetch ALL loans
export async function getAllLoans(): Promise<Loan[]> {
  const snapshot = await getDocs(loansCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
}

// Fetch ALL fund transactions
export async function getAllFundTransactions(): Promise<FundTransaction[]> {
  const snapshot = await getDocs(fundTransactionsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FundTransaction));
}

// Fetch ALL employees
export async function getAllEmployees(): Promise<Employee[]> {
  const snapshot = await getDocs(employeesCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
}

// Fetch ALL payroll entries
export async function getAllPayroll(): Promise<PayrollEntry[]> {
  const snapshot = await getDocs(payrollCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry));
}

// Fetch ALL attendance entries
export async function getAllAttendance(): Promise<AttendanceEntry[]> {
  const snapshot = await getDocs(attendanceCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
}

// Fetch ALL inventory items
export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  const snapshot = await getDocs(inventoryItemsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
}

// Fetch ALL expense templates
export async function getAllExpenseTemplates(): Promise<any[]> {
  const snapshot = await getDocs(expenseTemplatesCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch ALL ledger accounts
export async function getAllLedgerAccounts(): Promise<LedgerAccount[]> {
  const snapshot = await getDocs(ledgerAccountsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerAccount));
}

// Fetch ALL ledger cash accounts
export async function getAllLedgerCashAccounts(): Promise<LedgerCashAccount[]> {
  const snapshot = await getDocs(ledgerCashAccountsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerCashAccount));
}

// Fetch ALL kanta parchi
export async function getAllKantaParchi(): Promise<KantaParchi[]> {
  const snapshot = await getDocs(kantaParchiCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KantaParchi));
}

// Fetch ALL customer documents
export async function getAllCustomerDocuments(): Promise<CustomerDocument[]> {
  const snapshot = await getDocs(customerDocumentsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument));
}

// Fetch ALL manufacturing costing
export async function getInitialCustomerPayments(count = 100) {
  const q = query(customerPaymentsCollection, orderBy("date", "desc"), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

export async function getMoreCustomerPayments(startAfterDoc: QueryDocumentSnapshot<DocumentData> | null, count = 100) {
  if (!startAfterDoc) return { data: [], lastVisible: null, hasMore: false };
  const q = query(customerPaymentsCollection, orderBy("date", "desc"), startAfter(startAfterDoc), limit(count));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return { data, lastVisible, hasMore: data.length === count };
}

// =================================================================
// --- Realtime Data Fetching Functions using onSnapshot ---
// =================================================================

export function getSuppliersRealtime(callback: (data: Customer[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.suppliers.orderBy('srNo').reverse().toArray() : [];
        }, callback);
    }
    
    const storageKey = `lastSync:suppliers_v3:${getStorageKeySuffix()}`;
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Customer>(
            suppliersCollection,
            storageKey,
            db?.suppliers,
            'updatedAt',
            'srNo'
        );
    };
    
    return createMetadataBasedListener<Customer>(
        {
            collectionName: 'suppliers',
            fetchFunction,
            localTableName: 'suppliers',
            storageKey
        },
        callback,
        onError
    );
}

export function getCustomersRealtime(callback: (data: Customer[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.customers.orderBy('srNo').reverse().toArray() : [];
        }, callback);
    }

    const storageKey = `lastSync:customers_v3:${getStorageKeySuffix()}`;
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Customer>(
            customersCollection,
            storageKey,
            db?.customers,
            'updatedAt',
            'srNo'
        );
    };
    
    return createMetadataBasedListener<Customer>(
        {
            collectionName: 'customers',
            fetchFunction,
            localTableName: 'customers',
            storageKey
        },
        callback,
        onError
    );
}

// Generic fetch function for incremental sync
async function fetchCollectionWithIncrementalSync<T extends { id?: string }>(
    collectionRef: any,
    localStorageKey: string,
    table: any,
    orderByField: string = 'updatedAt',
    fallbackOrderByField: string = 'date',
    transformFn?: (doc: any) => T,
    localDataFilter?: (item: any) => boolean
): Promise<T[]> {
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem(localStorageKey);
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let hasLocalData = false;
    
    if (table) {
        try {
            const count = await table.count();
            hasLocalData = count > 0;
        } catch {
            hasLocalData = false;
        }
    }

    let snapshot;
    let isIncremental = false;

    if (lastSyncTime && hasLocalData) {
         const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
         try {
             // Fetch updates since last sync
             const q = query(collectionRef, where('updatedAt', '>', lastSyncTimestamp), orderBy('updatedAt'));
             snapshot = await getDocs(q);
             isIncremental = true;
         } catch {
             // Fallback to full sync
             try {
                // Try to get all docs ordered by ID (guaranteed to exist on all docs)
                // This prevents data loss from missing fields like 'date'
                snapshot = await getDocs(query(collectionRef, orderBy(documentId())));
             } catch {
                snapshot = await getDocs(query(collectionRef));
             }
         }
    } else {
         // Full sync
         // ✅ FIX: Use unordered query first to ensure we get ALL documents (including those with missing order fields)
         // orderBy() excludes documents where the field is missing/null, which causes data loss
         try {
            // Use simple collection reference fetch - this is the most robust way to get all documents
            snapshot = await getDocs(collectionRef);
         } catch {
            // If that fails, try with order by ID which exists on all docs
            snapshot = await getDocs(query(collectionRef, orderBy(documentId())));
         }
    }

    const fetchedData = snapshot.docs.map((doc: any) => {
        if (transformFn) {
            return transformFn(doc);
        }
        return { id: doc.id, ...doc.data() } as T;
    });

    firestoreMonitor.logRead(collectionRef.id, 'fetchCollectionWithIncrementalSync', snapshot.size);
    
    if (typeof window !== 'undefined') {
        localStorage.setItem(localStorageKey, Date.now().toString());
    }

    // If incremental, merge with local data
    if (isIncremental && table) {
         const { chunkedToArray } = await import('./chunked-operations');
         const localData = await chunkedToArray(table);
         
         // ✅ SAFETY: If local data read failed or returned empty (but we expected data), 
         // we must force a full sync to avoid data loss
         if (localData.length === 0 && hasLocalData) {
             console.warn(`[${collectionRef.id}] Incremental sync mismatch: Local data empty. Forcing full sync.`);
             
             // Clear last sync time to force full sync next time
             if (typeof window !== 'undefined') {
                 localStorage.removeItem(localStorageKey);
             }
             
             // Perform immediate full sync
             try {
                const fullSnapshot = await getDocs(collectionRef);
                firestoreMonitor.logRead(collectionRef.id, 'fetchCollectionWithIncrementalSync_Fallback', fullSnapshot.size);
                
                return fullSnapshot.docs.map((doc: any) => {
                    if (transformFn) {
                        return transformFn(doc);
                    }
                    return { id: doc.id, ...doc.data() } as T;
                });
             } catch (e) {
                 // Final attempt with ID ordering
                 const fullSnapshot = await getDocs(query(collectionRef, orderBy(documentId())));
                 return fullSnapshot.docs.map((doc: any) => {
                    if (transformFn) {
                        return transformFn(doc);
                    }
                    return { id: doc.id, ...doc.data() } as T;
                 });
             }
         }
         
         let relevantLocalData = localData;
         if (localDataFilter) {
             relevantLocalData = localData.filter(localDataFilter);
         }
         
         const localDataMap = new Map(relevantLocalData.map((item: any) => [item.id, item]));
         
         // Update local map with fetched data
         fetchedData.forEach((item: any) => {
             localDataMap.set(item.id, item);
         });
         
         // Return merged values
         return Array.from(localDataMap.values()) as T[];
    }

    return fetchedData;
}

export function getPaymentsRealtime(callback: (data: Payment[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return (db ? await db.payments.orderBy('date').reverse().toArray() : []) as Payment[];
        }, callback);
    }

    return createMetadataBasedListener<Payment>(
        {
            collectionName: 'payments',
            fetchFunction: async () => {
                return await fetchCollectionWithIncrementalSync<Payment>(
                    supplierPaymentsCollection, 
                    'lastSync:payments_v3', 
                    db?.payments,
                    'updatedAt',
                    'date'
                );
            },
            localTableName: 'payments',
            storageKey: 'lastSync:payments_v3'
        },
        (data) => {
            const sorted = [...data].sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
            });
            callback(sorted);
        },
        onError
    );
}

export function getCustomerPaymentsRealtime(callback: (data: CustomerPayment[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.customerPayments.orderBy('date').reverse().toArray() : [];
        }, callback);
    }

    
    const fetchCustomerPayments = async (): Promise<CustomerPayment[]> => {
        let snapshot;
        try {
            const fullQ = query(customerPaymentsCollection, orderBy("date", "desc"));
            snapshot = await getDocs(fullQ);
        } catch {
            snapshot = await getDocs(query(customerPaymentsCollection));
        }
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
        firestoreMonitor.logRead('customerPayments', 'getCustomerPaymentsRealtime', snapshot.size);
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:customerPayments', Date.now().toString());
        }
        return payments;
    };
    
    return createMetadataBasedListener<CustomerPayment>(
        {
            collectionName: 'customerPayments',
            fetchFunction: fetchCustomerPayments,
            localTableName: 'customerPayments'
        },
        callback,
        onError
    );
}

export function getLoansRealtime(callback: (data: Loan[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.loans.orderBy('startDate').reverse().toArray() : [];
        }, callback);
    }

    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Loan>(
            loansCollection,
            'lastSync:loans',
            db?.loans,
            'updatedAt',
            'startDate'
        );
    };
    
    return createMetadataBasedListener<Loan>(
        {
            collectionName: 'loans',
            fetchFunction,
            localTableName: 'loans'
        },
        callback,
        onError
    );
}

export function getFundTransactionsRealtime(callback: (data: FundTransaction[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.fundTransactions.orderBy('date').reverse().toArray() : [];
        }, callback);
    }

    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<FundTransaction>(
            fundTransactionsCollection,
            'lastSync:fundTransactions_v3',
            db?.fundTransactions,
            'updatedAt',
            'date'
        );
    };
    
    return createMetadataBasedListener<FundTransaction>(
        {
            collectionName: 'fundTransactions',
            fetchFunction,
            localTableName: 'fundTransactions',
            storageKey: 'lastSync:fundTransactions_v3'
        },
        callback,
        onError
    );
}

export function getIncomeRealtime(callback: (data: Income[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            if (db && db.transactions) {
                try {
                    const incomes = await db.transactions.orderBy('date').reverse().filter(t => (t as any).type === 'Income').toArray();
                    return incomes as Income[];
                } catch {
                    const all = await db.transactions.where('type').equals('Income').toArray();
                    return all.sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : 0;
                        const dateB = b.date ? new Date(b.date).getTime() : 0;
                        return dateB - dateA;
                    }) as Income[];
                }
            }
            return [];
        }, callback);
    }

    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Income>(
            incomesCollection,
            'lastSync:incomes_v4', // Force re-sync with robust fetch
            db?.transactions,
            'updatedAt',
            'date',
            (doc) => ({ 
                id: doc.id, 
                ...doc.data(), 
                type: 'Income', 
                transactionType: 'Income' 
            } as Income),
            (item) => item.type === 'Income'
        );
    };
    
    return createMetadataBasedListener<Income>(
        {
            collectionName: 'incomes',
            fetchFunction,
            localTableName: 'transactions',
            localFilter: (t) => t.type === 'Income',
            storageKey: 'lastSync:incomes_v4'
        },
        callback,
        onError
    );
}
export function getExpensesRealtime(callback: (data: Expense[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            if (db && db.transactions) {
                try {
                    const expenses = await db.transactions.orderBy('date').reverse().filter(t => (t as any).type === 'Expense').toArray();
                    return expenses as Expense[];
                } catch {
                    const all = await db.transactions.where('type').equals('Expense').toArray();
                    return all.sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : 0;
                        const dateB = b.date ? new Date(b.date).getTime() : 0;
                        return dateB - dateA;
                    }) as Expense[];
                }
            }
            return [];
        }, callback);
    }

    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Expense>(
            expensesCollection,
            'lastSync:expenses_v5', // Force re-sync with robust fetch
            db?.transactions,
            'updatedAt',
            'date',
            (doc) => ({ 
                id: doc.id, 
                ...doc.data(), 
                type: 'Expense', 
                transactionType: 'Expense' 
            } as Expense),
            (item) => item.type === 'Expense'
        );
    };

    return createMetadataBasedListener<Expense>(
        {
            collectionName: 'expenses',
            fetchFunction,
            localTableName: 'transactions',
            localFilter: (t) => t.type === 'Expense',
            storageKey: 'lastSync:expenses_v5'
        },
        callback,
        onError
    );
}

export function getIncomeAndExpensesRealtime(callback: (data: Transaction[]) => void, onError: (error: Error) => void) {
    let incomeData: Income[] = [];
    let expenseData: Expense[] = [];
    let incomeLoaded = false;
    let expenseLoaded = false;

    const merge = () => {
        if (incomeLoaded && expenseLoaded) {
            const all: Transaction[] = [...incomeData, ...expenseData].sort((a,b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
            }) as Transaction[];
            callback(all);
        }
    };

    const unsubIncomes = getIncomeRealtime((data) => {
        incomeData = data;
        incomeLoaded = true;
        merge();
    }, onError);

    const unsubExpenses = getExpensesRealtime((data) => {
        expenseData = data;
        expenseLoaded = true;
        merge();
    }, onError);

    return () => {
        unsubIncomes();
        unsubExpenses();
    };
}

export async function getTotalExpenseCount(): Promise<number> {
    try {
        const snapshot = await getCountFromServer(expensesCollection);
        return snapshot.data().count;
    } catch (error) {
        logError(error, 'getTotalExpenseCount', 'low');
        return 0;
    }
}

// Helper function to remove duplicate bank accounts by accountNumber
function removeDuplicateBankAccounts(accounts: BankAccount[]): BankAccount[] {
    const uniqueMap = new Map<string, BankAccount>();
    
    accounts.forEach((account) => {
        const accountNumber = account.accountNumber?.trim() || '';
        if (accountNumber) {
            const existing = uniqueMap.get(accountNumber);
            if (!existing) {
                uniqueMap.set(accountNumber, account);
            } else {
                // Keep the one with more recent updatedAt or createdAt
                const existingTime = (existing as any).updatedAt || (existing as any).createdAt || '';
                const currentTime = (account as any).updatedAt || (account as any).createdAt || '';
                if (currentTime > existingTime) {
                    uniqueMap.set(accountNumber, account);
                }
            }
        } else {
            // Accounts without account number - keep them but they won't cause duplicate errors
            uniqueMap.set(account.id || `no-account-${Date.now()}`, account);
        }
    });
    
    return Array.from(uniqueMap.values());
}

// Helper function to clean up existing duplicate bank accounts in IndexedDB and merge with incoming data
async function cleanupAndPrepareBankAccounts(incomingAccounts: BankAccount[]): Promise<BankAccount[]> {
    if (!db) return incomingAccounts;
    
    try {
        const existingAccounts = await db.bankAccounts.toArray();
        const accountMap = new Map<string, BankAccount[]>();
        
        // Group existing accounts by account number
        existingAccounts.forEach((account: BankAccount) => {
            const accountNumber = account.accountNumber?.trim() || '';
            if (accountNumber) {
                if (!accountMap.has(accountNumber)) {
                    accountMap.set(accountNumber, []);
                }
                accountMap.get(accountNumber)!.push(account);
            }
        });
        
        // Remove duplicate existing records (keep the most recent one)
        const toDelete: string[] = [];
        for (const [accountNumber, accounts] of accountMap.entries()) {
            if (accounts.length > 1) {
                // Sort by updatedAt/createdAt, keep the most recent
                accounts.sort((a, b) => {
                    const timeA = (a as any).updatedAt || (a as any).createdAt || '';
                    const timeB = (b as any).updatedAt || (b as any).createdAt || '';
                    return timeB.localeCompare(timeA);
                });
                
                // Delete all except the first (most recent)
                const deleteIds = accounts.slice(1).map((a: BankAccount) => a.id).filter((id: string | undefined): id is string => id !== undefined);
                toDelete.push(...deleteIds);
            }
        }
        
        if (toDelete.length > 0) {
            await db.bankAccounts.bulkDelete(toDelete);

            // Re-fetch existing accounts after deletion to get clean data
            const cleanExistingAccounts = await db.bankAccounts.toArray();
            existingAccounts.length = 0;
            existingAccounts.push(...cleanExistingAccounts);
        }
        
        // Now merge incoming data with existing (non-duplicate) data
        // Create a map of final accounts, starting with existing (already deduplicated)
        const finalAccounts = new Map<string, BankAccount>();
        
        // First add existing accounts (already deduplicated in database)
        // But deduplicate again in memory to be safe
        const existingUnique = new Map<string, BankAccount>();
        existingAccounts.forEach((account: BankAccount) => {
            const accountNumber = account.accountNumber?.trim() || '';
            if (accountNumber) {
                const existing = existingUnique.get(accountNumber);
                if (!existing) {
                    existingUnique.set(accountNumber, account);
                } else {
                    // Keep the most recent
                    const existingTime = (existing as any).updatedAt || (existing as any).createdAt || '';
                    const currentTime = (account as any).updatedAt || (account as any).createdAt || '';
                    if (currentTime > existingTime) {
                        existingUnique.set(accountNumber, account);
                    }
                }
            }
        });
        
        // Add deduplicated existing accounts to final map
        existingUnique.forEach((account, accountNumber) => {
            finalAccounts.set(accountNumber, account);
        });
        
        // Then merge incoming accounts, keeping the most recent
        incomingAccounts.forEach((account) => {
            const accountNumber = account.accountNumber?.trim() || '';
            if (accountNumber) {
                const existing = finalAccounts.get(accountNumber);
                if (!existing) {
                    finalAccounts.set(accountNumber, account);
                } else {
                    // Keep the one with more recent updatedAt or createdAt
                    const existingTime = (existing as any).updatedAt || (existing as any).createdAt || '';
                    const currentTime = (account as any).updatedAt || (account as any).createdAt || '';
                    if (currentTime > existingTime) {
                        finalAccounts.set(accountNumber, account);
                    }
                }
            } else {
                // Accounts without account number - add with unique key
                finalAccounts.set(account.id || `no-account-${Date.now()}-${Math.random()}`, account);
            }
        });
        
        return Array.from(finalAccounts.values());
    } catch (error) {

        // Fallback: just return deduplicated incoming data
        return removeDuplicateBankAccounts(incomingAccounts);
    }
}

// Helper function to remove duplicate bank branches by ifscCode
function removeDuplicateBankBranches(branches: BankBranch[]): BankBranch[] {
    const uniqueMap = new Map<string, BankBranch>();
    
    branches.forEach((branch) => {
        const ifscCode = branch.ifscCode?.trim() || '';
        if (ifscCode) {
            const existing = uniqueMap.get(ifscCode);
            if (!existing) {
                uniqueMap.set(ifscCode, branch);
            } else {
                // Keep the one with more recent updatedAt or createdAt
                const existingTime = (existing as any).updatedAt || (existing as any).createdAt || '';
                const currentTime = (branch as any).updatedAt || (branch as any).createdAt || '';
                if (currentTime > existingTime) {
                    uniqueMap.set(ifscCode, branch);
                }
            }
        } else {
            // Branches without IFSC code - keep them but they won't cause duplicate errors
            uniqueMap.set(branch.id || `no-ifsc-${Date.now()}`, branch);
        }
    });
    
    return Array.from(uniqueMap.values());
}

export function getBankAccountsRealtime(
    callback: (data: BankAccount[]) => void,
    onError: (error: Error) => void
): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<BankAccount>(
            bankAccountsCollection,
            'lastSync:bankAccounts',
            db?.bankAccounts,
            'updatedAt',
            'updatedAt'
        );
    };

    return createMetadataBasedListener<BankAccount>(
        {
            collectionName: 'bankAccounts',
            fetchFunction,
            localTableName: 'bankAccounts'
        },
        callback,
        onError
    );
}

// --- Supplier Bank Account Functions ---
export async function addSupplierBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(supplierBankAccountsCollection, accountData.accountNumber);
    const newAccount = withCreateMetadata({ ...accountData, id: docRef.id, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(docRef, newAccount);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('supplierBankAccounts', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "supplierBankAccounts", docId: docRef.id, docPath: getTenantCollectionPath("supplierBankAccounts").join("/"), summary: `Created supplier bank account ${accountData.accountNumber}`, afterData: newAccount as Record<string, unknown> }).catch(() => {});
    return newAccount as BankAccount;
}

export async function updateSupplierBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(supplierBankAccountsCollection, id);
    const data = withEditMetadata({ ...accountData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('supplierBankAccounts', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "supplierBankAccounts", docId: id, docPath: getTenantCollectionPath("supplierBankAccounts").join("/"), summary: `Updated supplier bank account ${id}`, afterData: data }).catch(() => {});
}

export async function deleteSupplierBankAccount(id: string): Promise<void> {
    const docRef = doc(supplierBankAccountsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "supplierBankAccounts", docId: id, docPath: getTenantCollectionPath("supplierBankAccounts").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted supplier bank account ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('supplierBankAccounts', { batch });
    await batch.commit();
}

export function getSupplierBankAccountsRealtime(
    callback: (data: BankAccount[]) => void,
    onError: (error: Error) => void
): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<BankAccount>(
            supplierBankAccountsCollection,
            'lastSync:supplierBankAccounts',
            db?.supplierBankAccounts,
            'updatedAt',
            'updatedAt'
        );
    };

    return createMetadataBasedListener<BankAccount>(
        {
            collectionName: 'supplierBankAccounts',
            fetchFunction,
            localTableName: 'supplierBankAccounts'
        },
        callback,
        onError
    );
}

export function getBanksRealtime(
    callback: (data: Bank[]) => void,
    onError: (error: Error) => void
): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Bank>(
            banksCollection,
            'lastSync:banks',
            db?.banks,
            'updatedAt',
            'updatedAt'
        );
    };

    return createMetadataBasedListener<Bank>(
        {
            collectionName: 'banks',
            fetchFunction,
            localTableName: 'banks'
        },
        callback,
        onError
    );
}

export function getBankBranchesRealtime(callback: (data: BankBranch[]) => void, onError: (error: Error) => void): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<BankBranch>(
            bankBranchesCollection,
            'lastSync:bankBranches',
            db?.bankBranches,
            'updatedAt',
            'updatedAt'
        );
    };

    return createMetadataBasedListener<BankBranch>(
        {
            collectionName: 'bankBranches',
            fetchFunction,
            localTableName: 'bankBranches'
        },
        callback,
        onError
    );
}

export function getProjectsRealtime(callback: (data: Project[]) => void, onError: (error: Error) => void) {
    let localProjects: Project[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response, no Firestore reads)
    if (db) {
        db.projects.orderBy('startDate').reverse().toArray().then((localData) => {
            localProjects = localData as Project[];
            callbackCalledFromIndexedDB = true;
            callback(localData as Project[]);
        }).catch(() => {
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync - only listen to NEW changes after last sync
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:projects');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            projectsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(projectsCollection, orderBy("startDate", "desc"));
    }

    return onSnapshot(q, async (snapshot) => {
        const newProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        
        // Merge new changes with local data
        if (callbackCalledFromIndexedDB && localProjects.length > 0) {
            const mergedMap = new Map<string, Project>();
            localProjects.forEach(p => mergedMap.set(p.id, p));
            newProjects.forEach(p => mergedMap.set(p.id, p));
            const merged = Array.from(mergedMap.values()).sort((a, b) => {
                return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            });
            callback(merged);
            
            if (db && newProjects.length > 0) {
                await db.projects.bulkPut(newProjects);
            }
        } else {
            callback(newProjects);
            if (db && newProjects.length > 0) {
                await db.projects.bulkPut(newProjects);
            }
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:projects', String(Date.now()));
        }
    }, onError);
}

export function getEmployeesRealtime(callback: (data: Employee[]) => void, onError: (error: Error) => void) {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Employee>(
            employeesCollection,
            'lastSync:employees',
            db?.employees,
            'updatedAt',
            'employeeId'
        );
    };

    return createMetadataBasedListener<Employee>(
        {
            collectionName: 'employees',
            fetchFunction,
            localTableName: 'employees'
        },
        callback,
        onError
    );
}

export function getPayrollRealtime(callback: (data: PayrollEntry[]) => void, onError: (error: Error) => void) {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<PayrollEntry>(
            payrollCollection,
            'lastSync:payroll',
            db?.payroll,
            'updatedAt',
            'payPeriod'
        );
    };

    return createMetadataBasedListener<PayrollEntry>(
        {
            collectionName: 'payroll',
            fetchFunction,
            localTableName: 'payroll'
        },
        callback,
        onError
    );
}

export function getInventoryItemsRealtime(callback: (data: InventoryItem[]) => void, onError: (error: Error) => void) {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<InventoryItem>(
            inventoryItemsCollection,
            'lastSync:inventoryItems',
            db?.inventoryItems,
            'updatedAt',
            'name'
        );
    };

    return createMetadataBasedListener<InventoryItem>(
        {
            collectionName: 'inventoryItems',
            fetchFunction,
            localTableName: 'inventoryItems'
        },
        callback,
        onError
    );
}

export async function recalculateAndUpdateAllSuppliers(): Promise<number> {
    // ✅ Read from local IndexedDB instead of Firestore to avoid unnecessary reads
    if (db) {
        const localSuppliers = await db.suppliers.toArray();
        const supplierIds = localSuppliers.map(s => s.id).filter((id): id is string => !!id);
        return await recalculateAndUpdateSuppliers(supplierIds);
    }
    
    // ✅ Fallback to Firestore with incremental sync if IndexedDB not available
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:suppliers');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only get changed suppliers (though for recalculation we might need all)
        // For now, use incremental but note: recalculation might need all suppliers
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            suppliersCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(suppliersCollection);
    }

    const allSuppliersSnapshot = await getDocs(q);
    const supplierIds = allSuppliersSnapshot.docs.map(doc => doc.id);
    return await recalculateAndUpdateSuppliers(supplierIds);
}
    
// --- Expense Templates Functions ---
export interface ExpenseTemplate {
  id?: string;
  name: string;
  category: string;
  subCategory: string;
  amount: number;
  payee: string;
  paymentMethod: string;
  expenseNature: 'Seasonal' | 'Permanent';
  createdAt?: string;
}

export async function addExpenseTemplate(template: Omit<ExpenseTemplate, 'id'>): Promise<string> {
  const templateData = withCreateMetadata({ ...template, createdAt: new Date().toISOString() } as Record<string, unknown>);
  const docRef = await addDoc(expenseTemplatesCollection, templateData);
  logActivity({ type: "create", collection: "expenseTemplates", docId: docRef.id, docPath: getTenantCollectionPath("expenseTemplates").join("/"), summary: `Created expense template ${(template as any).name || docRef.id}`, afterData: templateData }).catch(() => {});
  return docRef.id;
}

export async function getExpenseTemplates(): Promise<ExpenseTemplate[]> {
  // ✅ Use incremental sync - only get changed templates
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:expenseTemplates');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      expenseTemplatesCollection,
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(expenseTemplatesCollection, orderBy("createdAt", "desc"));
  }

  const snapshot = await getDocs(q);
  const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseTemplate));
  
  // Save last sync time
  if (snapshot.size > 0 && typeof window !== 'undefined') {
    localStorage.setItem('lastSync:expenseTemplates', String(Date.now()));
  }
  
  return templates;
}

export function getExpenseTemplatesRealtime(
  callback: (data: ExpenseTemplate[]) => void, 
  onError: (error: Error) => void
) {
  // ✅ Use incremental sync for realtime listener
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:expenseTemplates');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    // Only listen to NEW changes after last sync
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      expenseTemplatesCollection,
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    // First sync - get all (only once)
    q = query(expenseTemplatesCollection, orderBy("createdAt", "desc"));
  }

  return onSnapshot(q, (snapshot) => {
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseTemplate));
    callback(templates);
    
    // ✅ Save last sync time
    if (snapshot.size > 0 && typeof window !== 'undefined') {
      localStorage.setItem('lastSync:expenseTemplates', String(Date.now()));
    }
  }, onError);
}

export async function updateExpenseTemplate(id: string, template: Partial<ExpenseTemplate>): Promise<void> {
  const docRef = doc(expenseTemplatesCollection, id);
  const data = withEditMetadata({ ...template, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  await updateDoc(docRef, data);
  logActivity({ type: "edit", collection: "expenseTemplates", docId: id, docPath: getTenantCollectionPath("expenseTemplates").join("/"), summary: `Updated expense template ${id}`, afterData: data }).catch(() => {});
}

export async function deleteExpenseTemplate(id: string): Promise<void> {
  const docRef = doc(expenseTemplatesCollection, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await moveToRecycleBin({ collection: "expenseTemplates", docId: id, docPath: getTenantCollectionPath("expenseTemplates").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted expense template ${id}` });
  }
  await deleteDoc(docRef);
}

// --- Ledger Accounting Functions ---

export async function fetchLedgerAccounts(): Promise<LedgerAccount[]> {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    if (db) {
        try {
            const localAccounts = await db.ledgerAccounts.toArray();
            if (localAccounts.length > 0) {
                return localAccounts;
            }
        } catch (error) {
            // If local read fails, continue with Firestore
        }
    }

    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        
        // ✅ Use incremental sync - only get changed accounts
        const getLastSyncTime = (): number | undefined => {
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem('lastSync:ledgerAccounts');
            return stored ? parseInt(stored, 10) : undefined;
        };

        const lastSyncTime = getLastSyncTime();
        let q;
        
        if (lastSyncTime) {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                ledgerAccountsCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } else {
            q = query(ledgerAccountsCollection, orderBy('name'));
        }

        const snapshot = await getDocs(q);
        const accounts = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
                id: docSnap.id,
                name: data.name || '',
                address: data.address || '',
                contact: data.contact || '',
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
            } as LedgerAccount;
        });

        // Save to local IndexedDB and update last sync time
        if (db && accounts.length > 0) {
            await db.ledgerAccounts.bulkPut(accounts);
            if (typeof window !== 'undefined') {
                localStorage.setItem('lastSync:ledgerAccounts', String(Date.now()));
            }
        }

        return accounts;
    } catch (e) {
        if (isQuotaError(e)) {
            markFirestoreDisabled();
            return db ? await db.ledgerAccounts.toArray() : [];
        }
        throw e;
    }
}

export async function createLedgerAccount(account: LedgerAccountInput): Promise<LedgerAccount> {
    const timestamp = new Date().toISOString();
    const docRef = doc(ledgerAccountsCollection);
    const base = { name: account.name, address: account.address || '', contact: account.contact || '', createdAt: timestamp, updatedAt: timestamp };
    const newAccount = withCreateMetadata(base as Record<string, unknown>);
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, newAccount);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "ledgerAccounts", docId: docRef.id, docPath: getTenantCollectionPath("ledgerAccounts").join("/"), summary: `Created ledger account ${account.name}`, afterData: newAccount }).catch(() => {});
    return { id: docRef.id, ...newAccount } as LedgerAccount;
}

export async function updateLedgerAccount(id: string, updates: Partial<LedgerAccountInput>): Promise<void> {
    const docRef = doc(ledgerAccountsCollection, id);
    const data = withEditMetadata({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    const batch = writeBatch(firestoreDB);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "ledgerAccounts", docId: id, docPath: getTenantCollectionPath("ledgerAccounts").join("/"), summary: `Updated ledger account ${id}`, afterData: data }).catch(() => {});
}

export function getLedgerAccountsRealtime(
    callback: (data: LedgerAccount[]) => void,
    onError: (error: Error) => void
): () => void {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.ledgerAccounts.toArray() : [];
        }, callback);
    }

    
    
    const fetchLedgerAccounts = async (): Promise<LedgerAccount[]> => {
        const snapshot = await getDocs(query(ledgerAccountsCollection, orderBy('name')));
        const accounts = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
                id: docSnap.id,
                name: data.name || '',
                address: data.address || '',
                contact: data.contact || '',
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
            } as LedgerAccount;
        });
        firestoreMonitor.logRead('ledgerAccounts', 'getLedgerAccountsRealtime', snapshot.size);
        return accounts;
    };
    
    return createMetadataBasedListener<LedgerAccount>(
        {
            collectionName: 'ledgerAccounts',
            fetchFunction: fetchLedgerAccounts,
            localTableName: 'ledgerAccounts'
        },
        callback,
        onError
    );
}

export async function deleteLedgerAccount(id: string): Promise<void> {
    const docRef = doc(ledgerAccountsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "ledgerAccounts", docId: id, docPath: getTenantCollectionPath("ledgerAccounts").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted ledger account ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const entriesSnapshot = await getDocs(query(ledgerEntriesCollection, where('accountId', '==', id)));
    entriesSnapshot.forEach((entryDoc) => batch.delete(entryDoc.ref));
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    if (entriesSnapshot.size > 0) await notifySyncRegistry('ledgerEntries', { batch });
    await batch.commit();
}

export async function fetchLedgerCashAccounts(): Promise<LedgerCashAccount[]> {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    // Note: LedgerCashAccounts are stored in a separate collection, but we can cache them
    // For now, we'll fetch from Firestore and cache in localStorage or a separate store
    
    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        
        // ✅ Use incremental sync - only get changed accounts
        const getLastSyncTime = (): number | undefined => {
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem('lastSync:ledgerCashAccounts');
            return stored ? parseInt(stored, 10) : undefined;
        };

        const lastSyncTime = getLastSyncTime();
        let q;
        let useIncremental = false;
        
        if (lastSyncTime) {
            // Check if we have cached data - if not, fetch all
            const cached = typeof window !== 'undefined' ? localStorage.getItem('ledgerCashAccountsCache') : null;
            if (cached) {
                // Use incremental sync - only get changed accounts
                useIncremental = true;
                const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
                q = query(
                    ledgerCashAccountsCollection,
                    where('updatedAt', '>', lastSyncTimestamp),
                    orderBy('updatedAt')
                );
            } else {
                // No cache - fetch all accounts
                q = query(ledgerCashAccountsCollection, orderBy('name'));
            }
        } else {
            // First sync - get all accounts
            q = query(ledgerCashAccountsCollection, orderBy('name'));
        }

        const snapshot = await getDocs(q);
        const newAccounts = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            const rawNoteGroups = (data.noteGroups && typeof data.noteGroups === 'object') ? data.noteGroups : {};
            const normalizedNoteGroups = Object.entries(rawNoteGroups).reduce<Record<string, number[]>>((acc, [key, value]) => {
                acc[key] = Array.isArray(value) ? value.map((entry) => Number(entry) || 0) : [];
                return acc;
            }, {});

            return {
                id: docSnap.id,
                name: data.name || '',
                noteGroups: normalizedNoteGroups,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
            } as LedgerCashAccount;
        });

        // ✅ Merge with cached data if using incremental sync
        let accounts: LedgerCashAccount[];
        if (useIncremental && typeof window !== 'undefined') {
            const cached = localStorage.getItem('ledgerCashAccountsCache');
            if (cached) {
                try {
                    const cachedAccounts = JSON.parse(cached) as LedgerCashAccount[];
                    const accountMap = new Map<string, LedgerCashAccount>();
                    // Add all cached accounts
                    cachedAccounts.forEach(acc => accountMap.set(acc.id, acc));
                    // Update/add new accounts from Firestore
                    newAccounts.forEach(acc => accountMap.set(acc.id, acc));
                    accounts = Array.from(accountMap.values());
                } catch {
                    accounts = newAccounts;
                }
            } else {
                accounts = newAccounts;
            }
        } else {
            accounts = newAccounts;
        }

        // ✅ Save to localStorage cache and update last sync time
        if (typeof window !== 'undefined') {
            localStorage.setItem('ledgerCashAccountsCache', JSON.stringify(accounts));
            localStorage.setItem('lastSync:ledgerCashAccounts', String(Date.now()));
        }
        
        return accounts;
    } catch (error) {
        // If Firestore fails, try to return cached data
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ledgerCashAccountsCache');
            if (cached) {
                try {
                    return JSON.parse(cached) as LedgerCashAccount[];
                } catch {
                    // If cache is invalid, return empty array
                }
            }
        }
        throw error;
    }
}

export async function createLedgerCashAccount(account: LedgerCashAccountInput): Promise<LedgerCashAccount> {
    const timestamp = new Date().toISOString();
    const payload = {
        name: account.name,
        noteGroups: account.noteGroups,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    const docRef = doc(ledgerCashAccountsCollection);
    
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, payload);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerCashAccounts', { batch });
    
    await batch.commit();

    return {
        id: docRef.id,
        ...payload,
    };
}

export async function updateLedgerCashAccount(id: string, updates: Partial<LedgerCashAccountInput>): Promise<void> {
    const docRef = doc(ledgerCashAccountsCollection, id);
    const payload = stripUndefined({
        ...updates,
        updatedAt: new Date().toISOString(),
    });
    
    const batch = writeBatch(firestoreDB);
    batch.update(docRef, payload);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerCashAccounts', { batch });
    
    await batch.commit();
}

export async function deleteLedgerCashAccount(id: string): Promise<void> {
    const docRef = doc(ledgerCashAccountsCollection, id);
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerCashAccounts', { batch });
    
    await batch.commit();
}

export function getLedgerCashAccountsRealtime(
    callback: (data: LedgerCashAccount[]) => void,
    onError: (error: Error) => void
): () => void {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem('ledgerCashAccountsCache');
                if (cached) {
                    try {
                        return JSON.parse(cached) as LedgerCashAccount[];
                    } catch {}
                }
            }
            return [];
        }, callback);
    }

    
    
    const fetchLedgerCashAccounts = async (): Promise<LedgerCashAccount[]> => {
        const snapshot = await getDocs(query(ledgerCashAccountsCollection, orderBy('name')));
        const accounts = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            const rawNoteGroups = (data.noteGroups && typeof data.noteGroups === 'object') ? data.noteGroups : {};
            const normalizedNoteGroups = Object.entries(rawNoteGroups).reduce<Record<string, number[]>>((acc, [key, value]) => {
                acc[key] = Array.isArray(value) ? value.map((entry) => Number(entry) || 0) : [];
                return acc;
            }, {});

            return {
                id: docSnap.id,
                name: data.name || '',
                noteGroups: normalizedNoteGroups,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
            } as LedgerCashAccount;
        });
        firestoreMonitor.logRead('ledgerCashAccounts', 'getLedgerCashAccountsRealtime', snapshot.size);
        return accounts;
    };
    
    return createMetadataBasedListener<LedgerCashAccount>(
        {
            collectionName: 'ledgerCashAccounts',
            fetchFunction: fetchLedgerCashAccounts,
            localTableName: 'ledgerCashAccounts'
        },
        async (data) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('ledgerCashAccountsCache', JSON.stringify(data));
            }
            callback(data);
        },
        onError
    );
}

export async function fetchLedgerEntries(accountId: string): Promise<LedgerEntry[]> {
    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        const snapshot = await getDocs(query(ledgerEntriesCollection, where('accountId', '==', accountId), orderBy('createdAt')));
        return snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
                id: docSnap.id,
                accountId: data.accountId,
                date: data.date,
                particulars: data.particulars,
                debit: Number(data.debit) || 0,
                credit: Number(data.credit) || 0,
                balance: Number(data.balance) || 0,
                remarks: typeof data.remarks === 'string' ? data.remarks : undefined,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
                linkGroupId: data.linkGroupId || undefined,
                linkStrategy: data.linkStrategy || undefined,
            } as LedgerEntry;
        });
    } catch (e) {
        if (isQuotaError(e)) {
            markFirestoreDisabled();
            return db ? await db.ledgerEntries.where('accountId').equals(accountId).toArray() : [];
        }
        throw e;
    }
}

export async function fetchAllLedgerEntries(): Promise<LedgerEntry[]> {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    if (db) {
        try {
            const localEntries = await db.ledgerEntries.toArray();
            if (localEntries.length > 0) {
                return localEntries;
            }
        } catch (error) {

        }
    }

    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        
        // ✅ FIX: Always do FULL sync to ensure we get ALL documents
        // Incremental sync misses documents without updatedAt or with incorrect timestamps
        let q;
        try {
            // Try with orderBy first (faster if index exists)
            q = query(ledgerEntriesCollection, orderBy('createdAt'));
        } catch (error: unknown) {
            // If orderBy fails (missing index), use simple query
            q = query(ledgerEntriesCollection);
        }

        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
                id: docSnap.id,
                accountId: data.accountId,
                date: data.date,
                particulars: data.particulars,
                debit: Number(data.debit) || 0,
                credit: Number(data.credit) || 0,
                balance: Number(data.balance) || 0,
                remarks: typeof data.remarks === 'string' ? data.remarks : undefined,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
                linkGroupId: data.linkGroupId || undefined,
                linkStrategy: data.linkStrategy || undefined,
            } as LedgerEntry;
        });

        // Save to local IndexedDB and update last sync time
        if (db && entries.length > 0) {
            await db.ledgerEntries.bulkPut(entries);
            if (typeof window !== 'undefined') {
                localStorage.setItem('lastSync:ledgerEntries', String(Date.now()));
            }
        }

        return entries;
    } catch (e) {
        if (isQuotaError(e)) {
            markFirestoreDisabled();
            return db ? await db.ledgerEntries.toArray() : [];
        }
        throw e;
    }
}

export function getLedgerEntriesRealtime(
    callback: (data: LedgerEntry[]) => void,
    onError: (error: Error) => void,
    accountId?: string // Optional: filter by specific account
): () => void {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            if (!db) return [];
            if (accountId) {
                return await db.ledgerEntries.where('accountId').equals(accountId).toArray();
            }
            return await db.ledgerEntries.toArray();
        }, callback);
    }

    
    
    const fetchLedgerEntries = async (): Promise<LedgerEntry[]> => {
        let q;
        if (accountId) {
            q = query(
                ledgerEntriesCollection,
                where('accountId', '==', accountId),
                orderBy('createdAt')
            );
        } else {
            q = query(ledgerEntriesCollection, orderBy('createdAt'));
        }
        
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
                id: docSnap.id,
                accountId: data.accountId,
                date: data.date,
                particulars: data.particulars,
                debit: Number(data.debit) || 0,
                credit: Number(data.credit) || 0,
                balance: Number(data.balance) || 0,
                remarks: typeof data.remarks === 'string' ? data.remarks : undefined,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || data.createdAt || '',
                linkGroupId: data.linkGroupId || undefined,
                linkStrategy: data.linkStrategy || undefined,
            } as LedgerEntry;
        });
        firestoreMonitor.logRead('ledgerEntries', 'getLedgerEntriesRealtime', snapshot.size);
        return entries;
    };
    
    // For filtered queries (accountId), we need to handle IndexedDB updates carefully
    // Only update entries for the specific account, don't delete entries from other accounts
    const handleCallback = async (data: LedgerEntry[]) => {
        if (db && accountId) {
            // For filtered queries, only update entries for this account
            const accountEntries = data.filter(e => e.accountId === accountId);
            const existingIds = new Set(
                (await db.ledgerEntries.where('accountId').equals(accountId).toArray()).map(e => e.id)
            );
            const freshIds = new Set(accountEntries.map(e => e.id));
            const deletedIds = Array.from(existingIds).filter(id => !freshIds.has(id));
            
            if (deletedIds.length > 0) {
                await db.ledgerEntries.bulkDelete(deletedIds);
            }
            if (accountEntries.length > 0) {
                await db.ledgerEntries.bulkPut(accountEntries);
            }
        }
        callback(data);
    };
    
    return createMetadataBasedListener<LedgerEntry>(
        {
            collectionName: 'ledgerEntries',
            fetchFunction: fetchLedgerEntries,
            localTableName: accountId ? undefined : 'ledgerEntries' // Don't use default IndexedDB update for filtered queries
        },
        accountId ? handleCallback : callback,
        onError
    );
}

export async function createLedgerEntry(entry: LedgerEntryInput & { accountId: string; balance: number }): Promise<LedgerEntry> {
    const timestamp = new Date().toISOString();
    const normalizedRemarks = typeof entry.remarks === 'string' ? entry.remarks : '';
    const docRef = await addDoc(ledgerEntriesCollection, {
        accountId: entry.accountId,
        date: entry.date,
        particulars: entry.particulars,
        debit: entry.debit,
        credit: entry.credit,
        balance: entry.balance,
        remarks: normalizedRemarks,
        linkGroupId: entry.linkGroupId || null,
        linkStrategy: entry.linkStrategy || null,
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    return {
        id: docRef.id,
        accountId: entry.accountId,
        date: entry.date,
        particulars: entry.particulars,
        debit: entry.debit,
        credit: entry.credit,
        balance: entry.balance,
        remarks: normalizedRemarks || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
        linkGroupId: entry.linkGroupId,
        linkStrategy: entry.linkStrategy || undefined,
    };
}

export async function updateLedgerEntriesBatch(entries: LedgerEntry[]): Promise<void> {
    if (!entries.length) return;
    const batch = writeBatch(firestoreDB);
    const timestamp = new Date().toISOString();

    entries.forEach((entry) => {
        const entryRef = doc(ledgerEntriesCollection, entry.id);
        batch.set(
            entryRef,
            {
                ...entry,
                updatedAt: timestamp,
                linkGroupId: entry.linkGroupId || null,
                linkStrategy: entry.linkStrategy || null,
                remarks: typeof entry.remarks === 'string' ? entry.remarks : '',
            },
            { merge: true }
        );
    });

    await batch.commit();
}

export async function deleteLedgerEntry(id: string): Promise<void> {
    const entryRef = doc(ledgerEntriesCollection, id);
    const batch = writeBatch(firestoreDB);
    batch.delete(entryRef);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerEntries', { batch });
    
    await batch.commit();
}
    
function chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

export async function bulkUpsertSuppliers(suppliers: Customer[], chunkSize = 400) {
    if (!suppliers.length) return;
    const chunks = chunkArray(suppliers, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((supplier) => {
            if (!supplier.id) {
                throw new Error("Supplier entry missing id");
            }
            const ref = doc(suppliersCollection, supplier.id);
            batch.set(ref, supplier, { merge: true });
        });
        await batch.commit();
    }
}

export async function bulkUpsertCustomers(customers: Customer[], chunkSize = 400) {
    if (!customers.length) return;
    const chunks = chunkArray(customers, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((customer) => {
            if (!customer.id) {
                throw new Error("Customer entry missing id");
            }
            const ref = doc(customersCollection, customer.id);
            batch.set(ref, customer, { merge: true });
        });
        await batch.commit();
    }
}

export async function bulkUpsertPayments(payments: Payment[], chunkSize = 400) {
    if (!payments.length) return;
    const chunks = chunkArray(payments, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((payment) => {
            if (!payment.id) {
                throw new Error("Payment entry missing id");
            }
            const ref = doc(supplierPaymentsCollection, payment.id);
            batch.set(ref, payment, { merge: true });
        });
        await batch.commit();
    }
}

/** Gov Finalized → Payments migration: move payments from governmentFinalizedPayments to payments collection */
export interface MigrateGovFinalizedToPaymentsResult {
    success: boolean;
    migrated: number;
    skipped: number;
    error?: string;
}

export async function migrateGovFinalizedPaymentsToPayments(options?: {
    deleteFromSource?: boolean;
}): Promise<MigrateGovFinalizedToPaymentsResult> {
    try {
        const snapshot = await getDocs(governmentFinalizedPaymentsCollection);
        const govPayments: Payment[] = snapshot.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return { id: d.id, ...data, paymentId: data.paymentId || d.id } as Payment;
        });

        if (govPayments.length === 0) {
            return { success: true, migrated: 0, skipped: 0 };
        }

        await bulkUpsertPayments(govPayments, 100);

        if (db) {
            const { chunkedBulkPut } = await import('./chunked-operations');
            await chunkedBulkPut(db.payments, govPayments, 100);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'payments' } }));
            }
        }

        if (options?.deleteFromSource && govPayments.length > 0) {
            const batch = writeBatch(firestoreDB);
            govPayments.forEach((p) => {
                const ref = doc(governmentFinalizedPaymentsCollection, p.id);
                batch.delete(ref);
            });
            await batch.commit();
            if (db) {
                const idsToDelete = govPayments.map((p) => p.id);
                await db.governmentFinalizedPayments.bulkDelete(idsToDelete);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'governmentFinalizedPayments' } }));
                }
            }
        }

        return { success: true, migrated: govPayments.length, skipped: 0 };
    } catch (error) {
        return {
            success: false,
            migrated: 0,
            skipped: 0,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function bulkUpsertCustomerPayments(payments: CustomerPayment[], chunkSize = 400) {
    if (!payments.length) return;
    const chunks = chunkArray(payments, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((payment) => {
            if (!payment.id) {
                throw new Error("Customer payment entry missing id");
            }
            const ref = doc(customerPaymentsCollection, payment.id);
            batch.set(ref, payment, { merge: true });
        });
        await batch.commit();
    }
}

export async function bulkUpsertLedgerAccounts(accounts: LedgerAccount[], chunkSize = 400) {
    if (!accounts.length) return;
    const chunks = chunkArray(accounts, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((account) => {
            if (!account.id) {
                throw new Error("Ledger account entry missing id");
            }
            const ref = doc(ledgerAccountsCollection, account.id);
            batch.set(ref, account, { merge: true });
        });
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('ledgerAccounts', { batch });
        await batch.commit();
    }
}

export async function bulkUpsertLedgerEntries(entries: LedgerEntry[], chunkSize = 400) {
    if (!entries.length) return;
    const chunks = chunkArray(entries, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((entry) => {
            if (!entry.id) {
                throw new Error("Ledger entry missing id");
            }
            const ref = doc(ledgerEntriesCollection, entry.id);
            batch.set(ref, entry, { merge: true });
        });
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('ledgerEntries', { batch });
        await batch.commit();
    }
}

export async function bulkUpsertLedgerCashAccounts(accounts: LedgerCashAccount[], chunkSize = 400) {
    if (!accounts.length) return;
    const chunks = chunkArray(accounts, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((account) => {
            if (!account.id) {
                throw new Error("Ledger cash account entry missing id");
            }
            const ref = doc(ledgerCashAccountsCollection, account.id);
            batch.set(ref, account, { merge: true });
        });
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('ledgerCashAccounts', { batch });
        await batch.commit();
    }
}

export async function bulkUpsertMandiReports(reports: MandiReport[], chunkSize = 400) {
    if (!reports.length) return;
    const chunks = chunkArray(reports, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((report) => {
            if (!report.id) {
                throw new Error("Mandi report entry missing id");
            }
            const ref = doc(mandiReportsCollection, report.id);
            batch.set(ref, report, { merge: true });
        });
        await batch.commit();
    }
}


// --- Mandi Report Functions ---

export async function addMandiReport(report: MandiReport): Promise<MandiReport> {
    if (!report.id) {
        throw new Error("MandiReport requires a valid id");
    }
    const timestamp = new Date().toISOString();
    const payload = stripUndefined<MandiReport>({
        ...report,
        createdAt: report.createdAt || timestamp,
        updatedAt: timestamp,
    });
    
    try {
        const docRef = doc(mandiReportsCollection, payload.id);
        await setDoc(docRef, payload, { merge: true });
    } catch (error: unknown) {
        throw error;
    }
    
    if (db) {
        try {
            await db.mandiReports.put(payload);
        } catch (error) {
            // Don't throw here - Firestore save succeeded, IndexedDB is just cache
        }
    }
    return payload;
}

export async function updateMandiReport(id: string, updates: Partial<MandiReport>): Promise<void> {
    if (!id) {
        throw new Error("updateMandiReport requires an id");
    }
    const docRef = doc(mandiReportsCollection, id);
    const updatePayload = stripUndefined<Partial<MandiReport>>({
        ...updates,
        updatedAt: new Date().toISOString(),
    });
    
    try {
        await setDoc(docRef, updatePayload, { merge: true });

    } catch (error) {

        throw error;
    }
    
    if (db) {
        try {
            const existing = await db.mandiReports.get(id);
            await db.mandiReports.put({
                ...(existing || { id }),
                ...updates,
                voucherNo: (updates.voucherNo ?? existing?.voucherNo ?? ""),
                updatedAt: updatePayload.updatedAt,
            } as MandiReport);

        } catch (error) {

            // Don't throw here - Firestore update succeeded, IndexedDB is just cache
        }
    }
}

export async function deleteMandiReport(id: string): Promise<void> {
    if (!id) return;
    const docRef = doc(mandiReportsCollection, id);
    await deleteDoc(docRef);
    if (db) {
        await db.mandiReports.delete(id);
    }
}

export async function fetchMandiReports(forceFromFirestore = false): Promise<MandiReport[]> {
    
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads (unless forceRefresh)
    if (!forceFromFirestore && db) {
        try {
            const localReports = await db.mandiReports.toArray();
            if (localReports.length > 0) {
                return localReports;
            }
        } catch (error) {
            // If local read fails, continue with Firestore
            handleSilentError(error, 'getAllMandiReports - local read fallback');
        }
    }

    let allReports: MandiReport[] = [];
    const reportMap = new Map<string, MandiReport>();
    
    try {
        // Data structure: /mandiReports/{voucherNo}/6P/{docId} OR mandiReports/{docId} (direct)
        // NOTE: Do NOT use collectionGroup('6P') - it fetches from ENTIRE Firestore, ignoring tenant/season!
        // Use only tenant-scoped mandiReportsCollection.
        
        // Method 1: Query each parent document's 6P subcollection (tenant-scoped)
        try {

            const parentDocsSnapshot = await getDocs(mandiReportsCollection);
            
            let subcollectionCount = 0;
            for (const parentDoc of parentDocsSnapshot.docs) {
                try {
                    // Query the 6P subcollection under this parent document
                    const subcollectionRef = collection(parentDoc.ref, '6P');
                    const subcollectionSnapshot = await getDocs(subcollectionRef);
                    
                    if (subcollectionSnapshot.size > 0) {
                        subcollectionCount += subcollectionSnapshot.size;
                        
                        subcollectionSnapshot.docs.forEach((docSnap) => {
                            const data = docSnap.data() as MandiReport;
                            const docId = docSnap.id;
                            const finalId = data.id || docId;
                            
                            // Only add if not already in map
                            if (!reportMap.has(finalId)) {
                                reportMap.set(finalId, { ...data, id: finalId });

                            }
                        });
                    }
                } catch (subcollectionError: unknown) {

                }
            }
            
        } catch (manualQueryError: unknown) {

        }
        
        // Method 3: Also try direct collection query (in case some data is at root level)
        try {

            const directQuery = query(mandiReportsCollection);
            const directSnapshot = await getDocs(directQuery);
            
            directSnapshot.docs.forEach((docSnap) => {
                const data = docSnap.data() as MandiReport;
                // Only add if it looks like a MandiReport (has voucherNo or sellerName)
                if (data.voucherNo || data.sellerName) {
                    const docId = docSnap.id;
                    const finalId = data.id || docId;
                    
                    // Only add if not already in map
                    if (!reportMap.has(finalId)) {
                        reportMap.set(finalId, { ...data, id: finalId });

                    }
                }
            });
        } catch (directError: unknown) {

        }
        
        // Convert map to array
        allReports = Array.from(reportMap.values());
        
        // Log sample document IDs for debugging
        if (allReports.length > 0) {

        } else {



        }
        
        // Sort by purchaseDate in memory (newest first)
        allReports.sort((a, b) => {
            const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
            const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
            return dateB - dateA;
        });
        
        if (db && allReports.length > 0) {
            try {
                await db.mandiReports.bulkPut(allReports);

            } catch (error) {

            }
        }
        
        // Save last sync time
        if (allReports.length > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:mandiReports', String(Date.now()));
        }
        
        return allReports;
    } catch (error: unknown) {

        
        // Try a simple direct query as last resort
        try {

            const snapshot = await getDocs(mandiReportsCollection);
            
            const reports = snapshot.docs.map((docSnap) => {
                const data = docSnap.data() as MandiReport;

                return { ...data, id: data.id || docSnap.id };
            });
            
            reports.sort((a, b) => {
                const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
                const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
                return dateB - dateA;
            });
            
            if (db && reports.length > 0) {
                await db.mandiReports.bulkPut(reports);

            }
            
            return reports;
        } catch (fallbackError: unknown) {

            return [];
        }
    }
}

export function getMandiReportsRealtime(
    callback: (data: MandiReport[]) => void,
    onError: (error: Error) => void
): () => void {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.mandiReports.toArray() : [];
        }, callback);
    }

    let firestoreReports: MandiReport[] = [];
    const reportMap = new Map<string, MandiReport>();
    
    // ✅ Read from local IndexedDB first (immediate response)
    if (db) {
        db.mandiReports.toArray().then((localReports) => {
            callback(localReports as MandiReport[]);
            // Populate map for merging
            localReports.forEach(report => {
                reportMap.set(report.id || '', report);
            });
        }).catch(() => {
            // If IndexedDB read fails, Firestore will call callback
        });
    }

    // ✅ Use tenant-scoped mandiReportsCollection (NOT collectionGroup - that fetches from entire DB!)
    const refreshFromFirestore = () => {
        fetchMandiReports(true).then((reports) => {
            firestoreReports = reports;
            callback(firestoreReports);
            if (db) {
                // Always sync IndexedDB - clear if empty, bulkPut if has data (prevents stale data from wrong season)
                if (firestoreReports.length > 0) {
                    db.mandiReports.clear().then(() => db.mandiReports.bulkPut(firestoreReports)).catch(() => {});
                } else {
                    db.mandiReports.clear().catch(() => {});
                }
            }
            if (typeof window !== 'undefined') {
                localStorage.setItem('lastSync:mandiReports', String(Date.now()));
            }
        }).catch((err) => onError(err as Error));
    };

    // Initial fetch
    refreshFromFirestore();

    // Listen to changes on tenant-scoped mandiReports collection
    return onSnapshot(mandiReportsCollection, () => {
        refreshFromFirestore();
    }, (err: unknown) => {
        onError(err as Error);
    });
}

// --- Manufacturing Costing Functions ---

export async function getAllManufacturingCosting(): Promise<ManufacturingCostingData[]> {
    const docRef = doc(manufacturingCostingCollection, 'current');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return [{ id: docSnap.id, ...docSnap.data() } as ManufacturingCostingData];
    }
    return [];
}

export function getManufacturingCostingRealtime(
    callback: (data: ManufacturingCostingData | null) => void,
    onError: (error: Error) => void
): () => void {
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<ManufacturingCostingData>(
            manufacturingCostingCollection,
            'lastSync:manufacturingCosting',
            db?.manufacturingCosting,
            'updatedAt',
            'updatedAt'
        );
    };

    return createMetadataBasedListener<ManufacturingCostingData>(
        {
            collectionName: 'manufacturingCosting',
            fetchFunction,
            localTableName: 'manufacturingCosting'
        },
        (data) => {
            if (data && data.length > 0) {
                callback(data[0]);
            } else {
                callback(null);
            }
        },
        onError
    );
}

import { notifySyncRegistry } from './sync-registry';

export async function saveManufacturingCosting(data: Omit<ManufacturingCostingData, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const docRef = doc(manufacturingCostingCollection, 'current');
    const now = new Date().toISOString();
    
    const batch = writeBatch(firestoreDB);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        // Update existing document
        batch.update(docRef, {
            ...data,
            updatedAt: now
        });
    } else {
        // Create new document
        batch.set(docRef, {
            ...data,
            createdAt: now,
            updatedAt: now
        });
    }

    // Update sync registry
    await notifySyncRegistry('manufacturingCosting', { batch });
    
    await batch.commit();
}

export async function updateManufacturingCosting(data: Partial<Omit<ManufacturingCostingData, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = doc(manufacturingCostingCollection, 'current');
    
    const batch = writeBatch(firestoreDB);
    
    batch.update(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
    });

    // Update sync registry
    await notifySyncRegistry('manufacturingCosting', { batch });
    
    await batch.commit();
}
