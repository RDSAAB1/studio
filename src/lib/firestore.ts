
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
  collectionGroup,
  getCountFromServer,
  documentId,
} from "firebase/firestore";
import { firestoreDB } from "./firebase"; // Renamed to avoid conflict
import { db } from "./database";
import { isFirestoreTemporarilyDisabled, markFirestoreDisabled, isQuotaError, createPollingFallback } from "./realtime-guard";
import { firestoreMonitor } from "./firestore-monitor";
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense, Holiday, LedgerAccount, LedgerEntry, LedgerAccountInput, LedgerEntryInput, LedgerCashAccount, LedgerCashAccountInput, MandiReport, MandiHeaderSettings, KantaParchi, CustomerDocument, Employee, PayrollEntry, InventoryItem, Account, ManufacturingCostingData } from "@/lib/definitions";
import { toTitleCase, generateReadableId, calculateSupplierEntry } from "./utils";
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

const suppliersCollection = collection(firestoreDB, "suppliers");
const customersCollection = collection(firestoreDB, "customers");
const supplierPaymentsCollection = collection(firestoreDB, "payments");
const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
const governmentFinalizedPaymentsCollection = collection(firestoreDB, "governmentFinalizedPayments");
const incomesCollection = collection(firestoreDB, "incomes");
const expensesCollection = collection(firestoreDB, "expenses");
const accountsCollection = collection(firestoreDB, "accounts");
const loansCollection = collection(firestoreDB, "loans");
const fundTransactionsCollection = collection(firestoreDB, "fund_transactions");
const banksCollection = collection(firestoreDB, "banks");
const bankBranchesCollection = collection(firestoreDB, "bankBranches");
const bankAccountsCollection = collection(firestoreDB, "bankAccounts");
const supplierBankAccountsCollection = collection(firestoreDB, "supplierBankAccounts");
const settingsCollection = collection(firestoreDB, "settings");
const optionsCollection = collection(firestoreDB, "options");
const usersCollection = collection(firestoreDB, "users");
const attendanceCollection = collection(firestoreDB, "attendance");
const projectsCollection = collection(firestoreDB, "projects");
const employeesCollection = collection(firestoreDB, "employees");
const payrollCollection = collection(firestoreDB, 'payroll');
const inventoryItemsCollection = collection(firestoreDB, 'inventoryItems');
const expenseTemplatesCollection = collection(firestoreDB, 'expenseTemplates');
const ledgerAccountsCollection = collection(firestoreDB, 'ledgerAccounts');
const ledgerEntriesCollection = collection(firestoreDB, 'ledgerEntries');
const ledgerCashAccountsCollection = collection(firestoreDB, 'ledgerCashAccounts');
const mandiReportsCollection = collection(firestoreDB, 'mandiReports');
const mandiHeaderDocRef = doc(settingsCollection, "mandiHeader");
const kantaParchiCollection = collection(firestoreDB, 'kantaParchi');
const customerDocumentsCollection = collection(firestoreDB, 'customerDocuments');
const manufacturingCostingCollection = collection(firestoreDB, 'manufacturingCosting');

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
        
        // Add new item
        await retryFirestoreOperation(
            () => setDoc(docRef, {
                items: arrayUnion(name)
            }, { merge: true }),
            `addOption - set item for ${collectionName}`
        );
        
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
        
        await retryFirestoreOperation(
            () => setDoc(docRef, {
                items: updatedItems
            }, { merge: true }),
            `updateOption - set updated items for ${collectionName}`
        );
        
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
        await retryFirestoreOperation(
            () => updateDoc(docRef, {
                items: arrayRemove(name)
            }),
            `deleteOption - remove item from ${collectionName}`
        );
    } catch (error) {
        logError(error, `deleteOption(${collectionName}, ${id})`, 'medium');
        throw error;
    }
}


// --- Company & RTGS Settings Functions ---

export async function getCompanySettings(userId: string): Promise<{ email: string; appPassword: string } | null> {
    if (!userId) return null;
    const docRef = doc(firestoreDB, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            email: data.email,
            appPassword: data.appPassword
        };
    }
    return null;
}

export async function saveCompanySettings(userId: string, settings: { email: string; appPassword: string }): Promise<void> {
    const userDocRef = doc(firestoreDB, "users", userId);
    await setDoc(userDocRef, settings, { merge: true });
}

export async function deleteCompanySettings(userId: string): Promise<void> {
    const userDocRef = doc(firestoreDB, "users", userId);
    await updateDoc(userDocRef, {
        appPassword: '' 
    });
}


export async function getRtgsSettings(): Promise<RtgsSettings> {
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
    const docRef = doc(settingsCollection, "companyDetails");
    await setDoc(docRef, settings, { merge: true });
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
  const docRef = doc(firestoreDB, 'banks', bankName);
  
  const bankData = { name: bankName, updatedAt: new Date().toISOString() };
  batch.set(docRef, bankData);
  
  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('banks', { batch });
  
  await batch.commit();
  return { id: docRef.id, ...bankData };
}

export async function deleteBank(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, "banks", id);
    
    batch.delete(docRef);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('banks', { batch });
    
    await batch.commit();
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
    
    const dataWithTimestamp = {
        ...branchData,
        updatedAt: new Date().toISOString()
    };
    
    batch.set(docRef, dataWithTimestamp);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    
    await batch.commit();
    return { id: docRef.id, ...dataWithTimestamp };
}


export async function updateBankBranch(id: string, branchData: Partial<BankBranch>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, "bankBranches", id);
    
    batch.update(docRef, {
        ...branchData,
        updatedAt: new Date().toISOString()
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    
    await batch.commit();
}

export async function deleteBankBranch(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, "bankBranches", id);
    
    batch.delete(docRef);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    
    await batch.commit();
}


// --- Bank Account Functions ---
export async function addBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankAccountsCollection, accountData.accountNumber);
    
    const newAccount = { 
        ...accountData, 
        id: docRef.id,
        updatedAt: new Date().toISOString()
    };
    
    batch.set(docRef, newAccount);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankAccounts', { batch });
    
    await batch.commit();
    return newAccount as BankAccount;
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankAccountsCollection, id);
    
    batch.update(docRef, {
        ...accountData,
        updatedAt: new Date().toISOString()
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankAccounts', { batch });
    
    await batch.commit();
}

export async function deleteBankAccount(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankAccountsCollection, id);
    
    batch.delete(docRef);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('bankAccounts', { batch });
    
    await batch.commit();
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
        
        // Use local-first sync manager
        const { writeLocalFirst } = await import('./local-first-sync');
        return await writeLocalFirst('suppliers', 'create', documentId, supplierWithCorrectId) as Customer;
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
  
  // Use local-first sync manager
  try {
    const { writeLocalFirst } = await import('./local-first-sync');
    // Cast supplierData to match the expected type for writeLocalFirst
    await writeLocalFirst('suppliers', 'update', id, undefined, supplierData as Partial<Customer>);
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
    
    // ✅ Determine the correct Firestore document ID
    // Try multiple strategies to find the document:
    // 1. Try with provided id (might be Firestore doc ID or srNo)
    let supplierDoc = await getDoc(doc(suppliersCollection, id));
    if (supplierDoc.exists()) {
      documentId = id;
      if (!supplierData) {
        supplierData = supplierDoc.data() as unknown as Customer | null;
        supplierSrNo = (supplierData as any)?.srNo;
      }
    } else if (supplierSrNo && supplierSrNo.trim() !== '' && supplierSrNo !== 'S----') {
      // 2. Try with srNo as document ID (new entries are saved this way)
      supplierDoc = await getDoc(doc(suppliersCollection, supplierSrNo));
      if (supplierDoc.exists()) {
        documentId = supplierSrNo;
        if (!supplierData) {
          supplierData = supplierDoc.data() as unknown as Customer | null;
        }
      } else {
        // 3. Try to find by srNo query (for old entries saved with random IDs)
        const q = query(suppliersCollection, where('srNo', '==', supplierSrNo));
        const snap = await getDocs(q);
        if (!snap.empty) {
          supplierDoc = snap.docs[0];
          documentId = supplierDoc.id; // Use the actual Firestore document ID
          if (!supplierData) {
            supplierData = supplierDoc.data() as unknown as Customer | null;
          }
        } else {
          // 4. Last resort: try id as srNo query
          const q2 = query(suppliersCollection, where('srNo', '==', id));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            supplierDoc = snap2.docs[0];
            documentId = supplierDoc.id;
            if (!supplierData) {
              supplierData = supplierDoc.data() as unknown as Customer | null;
              supplierSrNo = (supplierData as any)?.srNo;
            }
          } else {
            return; // Not found
          }
        }
      }
    } else {
      // Try id as srNo query
      const q = query(suppliersCollection, where('srNo', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        supplierDoc = snap.docs[0];
        documentId = supplierDoc.id;
        if (!supplierData) {
          supplierData = supplierDoc.data() as unknown as Customer | null;
          supplierSrNo = (supplierData as any)?.srNo;
        }
      } else {
        return; // Not found
      }
    }
    
    if (!supplierSrNo && supplierData) {
      supplierSrNo = (supplierData as any)?.srNo;
    }
    
    // Find all payments associated with this supplier's serial number from IndexedDB
    const paymentsToDelete: string[] = [];
    const paymentsToUpdate: Array<{ id: string; paidFor: PaidFor[]; amount: number }> = [];
    
    if (db) {
      const allPayments = await db.payments.toArray();
      for (const payment of allPayments) {
        if (payment.paidFor && Array.isArray(payment.paidFor)) {
          const matchingPaidFor = payment.paidFor.find((pf: PaidFor) => pf.srNo === supplierSrNo);
          if (matchingPaidFor) {
            if (payment.paidFor.length === 1) {
              // Payment is only for this supplier, delete it completely
              paymentsToDelete.push(payment.id);
            } else {
              // Payment is for multiple entries, remove this supplier from paidFor
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
    
    // Delete payments from IndexedDB
    if (db && paymentsToDelete.length > 0) {
      await db.payments.bulkDelete(paymentsToDelete);
    }
    
    // Update payments in IndexedDB
    if (db && paymentsToUpdate.length > 0) {
      for (const paymentUpdate of paymentsToUpdate) {
        const existingPayment = await db.payments.get(paymentUpdate.id);
        if (existingPayment) {
          const updatedPayment = {
            ...existingPayment,
            paidFor: paymentUpdate.paidFor,
            amount: paymentUpdate.amount
          };
          // Add updatedAt if it exists in the payment type
          if ('updatedAt' in existingPayment) {
            (updatedPayment as any).updatedAt = new Date().toISOString();
          }
          await db.payments.put(updatedPayment);
        }
      }
    }
    
    // ✅ Use local-first sync for supplier deletion with correct document ID
    const { writeLocalFirst } = await import('./local-first-sync');
    // Use documentId (which should be srNo if available) instead of the provided id
    await writeLocalFirst('suppliers', 'delete', documentId);
    
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
    const batch = writeBatch(firestoreDB);
    const paymentsToDelete: string[] = [];

    // First, find all payments associated with the suppliers to be deleted
    for (const supplierId of supplierIds) {
        const supplierDoc = await getDoc(doc(suppliersCollection, supplierId));
        if (!supplierDoc.exists()) continue;
        const supplierSrNo = supplierDoc.data().srNo;
        
        const paymentsQuery = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo: supplierSrNo }));
        const paymentsSnapshot = await getDocs(paymentsQuery);

        paymentsSnapshot.forEach(paymentDoc => {
            const payment = paymentDoc.data() as Payment;
            if (payment.paidFor && payment.paidFor.length === 1 && payment.paidFor[0].srNo === supplierSrNo) {
                if (!paymentsToDelete.includes(paymentDoc.id)) {
                    paymentsToDelete.push(paymentDoc.id);
                }
            } else {
                // If payment is for multiple entries, just remove this one
                const updatedPaidFor = payment.paidFor?.filter(pf => pf.srNo !== supplierSrNo);
                const amountToDeduct = payment.paidFor?.find(pf => pf.srNo === supplierSrNo)?.amount || 0;
                batch.update(paymentDoc.ref, {
                    paidFor: updatedPaidFor,
                    amount: payment.amount - amountToDeduct
                });
            }
        });
    }

    // Delete the identified single-entry payments
    for (const paymentId of paymentsToDelete) {
        batch.delete(doc(supplierPaymentsCollection, paymentId));
    }
    // Delete the suppliers themselves
    for (const supplierId of supplierIds) {
        batch.delete(doc(suppliersCollection, supplierId));
    }
    
    // ✅ Update sync registry atomically for suppliers and payments
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('suppliers', { batch });
    if (paymentsToDelete.length > 0) {
        await notifySyncRegistry('payments', { batch });
    }
    
    await batch.commit();

    // Sync Dexie
    if (db) {
        await db.suppliers.bulkDelete(supplierIds);
        await db.payments.bulkDelete(paymentsToDelete);
        // Handle partial payment updates in Dexie if necessary
    }
}

export async function recalculateAndUpdateSuppliers(supplierIds: string[]): Promise<number> {
    const holidays = await getHolidays();
    const dailyPaymentLimit = await getDailyPaymentLimit();
    const paymentHistory = await db.payments.toArray(); // Assuming Dexie is populated
    
    const batch = writeBatch(firestoreDB);
    let updatedCount = 0;

    for (const id of supplierIds) {
        const supplierRef = doc(firestoreDB, "suppliers", id);
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
        
        // Use local-first sync manager
        const { writeLocalFirst } = await import('./local-first-sync');
        return await writeLocalFirst('customers', 'create', documentId, customerWithCorrectId) as Customer;
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
    
    // Use local-first sync manager
    try {
        const { writeLocalFirst } = await import('./local-first-sync');
        await writeLocalFirst<Customer>('customers', 'update', id, undefined, customerData as Partial<Customer>);
        return true;
    } catch (error) {
        return false;
    }
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
        return;
    }
    // Use local-first sync manager
    const { writeLocalFirst } = await import('./local-first-sync');
    await writeLocalFirst('customers', 'delete', id);
}

// --- Kanta Parchi Functions ---
export async function addKantaParchi(kantaParchiData: KantaParchi): Promise<KantaParchi> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(kantaParchiCollection, kantaParchiData.srNo);
    const dataWithTimestamp = {
        ...kantaParchiData,
        createdAt: kantaParchiData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    batch.set(docRef, dataWithTimestamp);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('kantaParchi', { batch });
    
    await batch.commit();
    return dataWithTimestamp;
}

export async function updateKantaParchi(srNo: string, kantaParchiData: Partial<Omit<KantaParchi, 'id' | 'srNo'>>): Promise<boolean> {
    if (!srNo) {
        return false;
    }
    const batch = writeBatch(firestoreDB);
    const docRef = doc(kantaParchiCollection, srNo);
    
    batch.update(docRef, {
        ...kantaParchiData,
        updatedAt: new Date().toISOString(),
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('kantaParchi', { batch });
    
    await batch.commit();
    return true;
}

export async function deleteKantaParchi(srNo: string): Promise<void> {
    if (!srNo) {
        return;
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(doc(kantaParchiCollection, srNo));

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
    const dataWithTimestamp = {
        ...documentData,
        createdAt: documentData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    batch.set(docRef, dataWithTimestamp);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('customerDocuments', { batch });
    
    await batch.commit();
    return dataWithTimestamp;
}

export async function updateCustomerDocument(documentSrNo: string, documentData: Partial<Omit<CustomerDocument, 'id' | 'documentSrNo' | 'kantaParchiSrNo'>>): Promise<boolean> {
    if (!documentSrNo) {
        return false;
    }
    const batch = writeBatch(firestoreDB);
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    
    batch.update(docRef, {
        ...documentData,
        updatedAt: new Date().toISOString(),
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('customerDocuments', { batch });
    
    await batch.commit();
    return true;
}

export async function deleteCustomerDocument(documentSrNo: string): Promise<void> {
    if (!documentSrNo) {
        return;
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(doc(customerDocumentsCollection, documentSrNo));

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
  
  const dataWithTimestamp = {
      ...item,
      updatedAt: new Date().toISOString()
  };
  
  batch.set(docRef, dataWithTimestamp);

  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  
  await batch.commit();
  return { id: docRef.id, ...dataWithTimestamp };
}

export async function updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<void> {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(inventoryItemsCollection, id);
  
  batch.update(docRef, {
      ...item,
      updatedAt: new Date().toISOString()
  });

  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  
  await batch.commit();
}

export async function deleteInventoryItem(id: string) {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(inventoryItemsCollection, id);
  
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
    for (const payment of allPayments) {
      if (payment.paidFor && Array.isArray(payment.paidFor)) {
        const hasMatchingSrNo = payment.paidFor.some((pf: PaidFor) => pf.srNo === srNo);
        if (hasMatchingSrNo) {
          paymentIdsToDelete.push(payment.id);
        }
      }
    }
    
    // Delete from IndexedDB
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
    for (const payment of allPayments) {
      if (payment.paidFor && Array.isArray(payment.paidFor)) {
        const hasMatchingSrNo = payment.paidFor.some((pf: PaidFor) => pf.srNo === srNo);
        if (hasMatchingSrNo) {
          paymentIdsToDelete.push(payment.id);
        }
      }
    }
    
    // Delete from IndexedDB
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
  const batch = writeBatch(firestoreDB);
  const docRef = doc(fundTransactionsCollection);
  
  const dataWithDate = {
    ...transactionData,
    date: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  batch.set(docRef, dataWithDate);

  const { notifySyncRegistry } = await import('./sync-registry');
  await notifySyncRegistry('fundTransactions', { batch });
  
  await batch.commit();
  return { id: docRef.id, transactionId: '', ...dataWithDate };
}

export async function updateFundTransaction(id: string, data: Partial<FundTransaction>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(fundTransactionsCollection, id);
    
    batch.update(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('fundTransactions', { batch });
    
    await batch.commit();
}

export async function deleteFundTransaction(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(fundTransactionsCollection, id);
    
    batch.delete(docRef);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('fundTransactions', { batch });
    
    await batch.commit();
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
        const q = query(collection(firestoreDB, "incomeCategories"), orderBy("name"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeCategory));
    } catch (error) {
        throw error;
    }
}

export async function getAllExpenseCategories(): Promise<ExpenseCategory[]> {
    try {
        const q = query(collection(firestoreDB, "expenseCategories"), orderBy("name"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
    } catch (error) {
        throw error;
    }
}

export async function addCategory(collectionName: "incomeCategories" | "expenseCategories", category: { name: string; nature?: string }) {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(collection(firestoreDB, collectionName));
    
    batch.set(newDocRef, { 
        ...category, 
        subCategories: [],
        updatedAt: Timestamp.now()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });
    
    await batch.commit();
}

export async function updateCategoryName(collectionName: "incomeCategories" | "expenseCategories", id: string, name: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, collectionName, id);
    
    batch.update(docRef, { 
        name,
        updatedAt: Timestamp.now()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });
    
    await batch.commit();
}

export async function deleteCategory(collectionName: "incomeCategories" | "expenseCategories", id: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, collectionName, id);
    
    batch.delete(docRef);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry(collectionName, { batch });
    
    await batch.commit();
}

export async function addSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, collectionName, categoryId);
    
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
    const docRef = doc(firestoreDB, collectionName, categoryId);
    
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
    
    batch.set(docRef, {
        ...entry,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('attendance', { batch });
    
    await batch.commit();
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
    
    batch.set(newDocRef, {
        ...projectData,
        createdAt: now,
        updatedAt: now
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('projects', { batch });
    
    await batch.commit();
    return { id: newDocRef.id, ...projectData, createdAt: now, updatedAt: now };
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(projectsCollection, id);
    
    batch.update(docRef, {
        ...projectData,
        updatedAt: new Date().toISOString()
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('projects', { batch });
    
    await batch.commit();
}

export async function deleteProject(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(projectsCollection, id);
    
    batch.delete(docRef);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('projects', { batch });
    
    await batch.commit();
}


// --- Loan Functions ---
export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(loansCollection);
    
    const dataWithTimestamp = {
        ...loanData,
        updatedAt: new Date().toISOString()
    };
    
    batch.set(docRef, dataWithTimestamp);

    if ((loanData.loanType === 'Bank' || loanData.loanType === 'Outsider') && loanData.totalAmount > 0) {
        const fundData = {
            type: 'CapitalInflow',
            source: loanData.loanType === 'Bank' ? 'BankLoan' : 'ExternalLoan',
            destination: loanData.depositTo,
            amount: loanData.totalAmount,
            description: `Capital inflow from ${loanData.loanName}`,
            date: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const fundDocRef = doc(fundTransactionsCollection);
        batch.set(fundDocRef, fundData);
        
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('fundTransactions', { batch });
    }
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('loans', { batch });

    await batch.commit();
    
    return { id: docRef.id, ...dataWithTimestamp };
}

export async function updateLoan(id: string, loanData: Partial<Loan>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(loansCollection, id);
    
    batch.update(docRef, {
        ...loanData,
        updatedAt: new Date().toISOString()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('loans', { batch });
    
    await batch.commit();
}

export async function deleteLoan(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(loansCollection, id);
    
    batch.delete(docRef);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('loans', { batch });
    
    await batch.commit();
}


// --- Customer Payment Functions ---

export async function addCustomerPayment(paymentData: Omit<CustomerPayment, 'id'>): Promise<CustomerPayment> {
    const docRef = doc(customerPaymentsCollection, paymentData.paymentId);
    const newPayment = { ...paymentData, id: docRef.id };
    await setDoc(docRef, newPayment);
    return newPayment;
}

export async function deleteCustomerPayment(id: string): Promise<void> {
    const docRef = doc(customerPaymentsCollection, id);
    await deleteDoc(docRef);
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
        
        const newIncome = { ...incomeData, transactionId: newTransactionId, id: docRef.id };
        
        // ✅ Use batch write to ensure atomicity with sync registry
        const batch = writeBatch(firestoreDB);
        batch.set(docRef, newIncome);
        
        // ✅ Update sync registry atomically
        const { notifySyncRegistry } = await import('./sync-registry');
        await notifySyncRegistry('incomes', { batch });
        
        await retryFirestoreOperation(
            () => batch.commit(),
            'addIncome - commit batch'
        );
        return newIncome;
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
    
    const newExpense = { ...expenseData, transactionId: newTransactionId, id: docRef.id };
    
    // ✅ Use batch write to ensure atomicity with sync registry
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, newExpense);
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    
    await batch.commit();
    return newExpense;
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    const updatedAt = new Date().toISOString();
    // ✅ Use batch write to ensure atomicity with sync registry
    const batch = writeBatch(firestoreDB);
    batch.update(doc(incomesCollection, id), {
        ...incomeData,
        updatedAt
    });
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('incomes', { batch });
    
    await batch.commit();

    // ✅ Optimistic UI update: Update IndexedDB immediately
    if (db && db.transactions) {
        try {
            await db.transactions.update(id, { ...incomeData, updatedAt });
        } catch (error) {
            // Ignore error if local update fails (sync will handle it)
            handleSilentError(error, 'updateIncome - local optimistic update');
        }
    }
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    const updatedAt = new Date().toISOString();
    // ✅ Use batch write to ensure atomicity with sync registry
    const batch = writeBatch(firestoreDB);
    batch.update(doc(expensesCollection, id), {
        ...expenseData,
        updatedAt
    });
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    
    await batch.commit();

    // ✅ Optimistic UI update: Update IndexedDB immediately
    if (db && db.transactions) {
        try {
            await db.transactions.update(id, { ...expenseData, updatedAt });
        } catch (error) {
            // Ignore error if local update fails (sync will handle it)
            handleSilentError(error, 'updateExpense - local optimistic update');
        }
    }
}

export async function deleteIncome(id: string): Promise<void> {
    // ✅ Use batch write to ensure atomicity with sync registry
    const batch = writeBatch(firestoreDB);
    batch.delete(doc(incomesCollection, id));
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('incomes', { batch });
    
    await batch.commit();
}

export async function deleteExpense(id: string): Promise<void> {
    // ✅ Use batch write to ensure atomicity with sync registry
    const batch = writeBatch(firestoreDB);
    batch.delete(doc(expensesCollection, id));
    
    // ✅ Update sync registry atomically
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('expenses', { batch });
    
    await batch.commit();
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
    const payload: Omit<Account, 'id'> = {
        name: normalizedName,
        contact: account.contact?.trim() || undefined,
        address: account.address?.trim() || undefined,
        nature: account.nature || undefined,
        category: account.category?.trim() || undefined,
        subCategory: account.subCategory?.trim() || undefined,
        updatedAt: new Date().toISOString(),
    };

    batch.set(docRef, payload, { merge: true });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('accounts', { batch });
    
    await batch.commit();
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

    // If name changed, delete old document
    if (previousName && toTitleCase(previousName).trim() !== normalizedName) {
        const prevDocId = buildAccountDocId(previousName);
        batch.delete(doc(accountsCollection, prevDocId));
    }

    const docRef = doc(accountsCollection, buildAccountDocId(normalizedName));
    const payload: Omit<Account, 'id'> = {
        name: normalizedName,
        contact: account.contact?.trim() || undefined,
        address: account.address?.trim() || undefined,
        nature: account.nature || undefined,
        category: account.category?.trim() || undefined,
        subCategory: account.subCategory?.trim() || undefined,
        updatedAt: new Date().toISOString(),
    };

    batch.set(docRef, payload, { merge: true });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('accounts', { batch });
    
    await batch.commit();
}

export async function deleteAccount(name: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const normalizedName = toTitleCase(name || '').trim();
    if (!normalizedName) return;
    const docId = buildAccountDocId(normalizedName);
    
    batch.delete(doc(accountsCollection, docId));

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('accounts', { batch });
    
    await batch.commit();
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
    
    const dataToSave = {
        ...employeeData,
        updatedAt: new Date().toISOString()
    };
    
    batch.set(docRef, dataToSave, { merge: true });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('employees', { batch });
    
    await batch.commit();
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(employeesCollection, id);
    
    batch.update(docRef, {
        ...employeeData,
        updatedAt: new Date().toISOString()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('employees', { batch });
    
    await batch.commit();
}

export async function deleteEmployee(id: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(employeesCollection, id);
    
    batch.delete(docRef);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('employees', { batch });
    
    await batch.commit();
}

// --- Payroll Functions ---
export async function addPayrollEntry(entryData: Omit<PayrollEntry, 'id'>) {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(payrollCollection);
    
    const dataWithTimestamp = {
        ...entryData,
        updatedAt: new Date().toISOString()
    };
    
    batch.set(newDocRef, dataWithTimestamp);

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('payroll', { batch });
    
    await batch.commit();
    return { id: newDocRef.id, ...dataWithTimestamp };
}

export async function updatePayrollEntry(id: string, entryData: Partial<PayrollEntry>) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(payrollCollection, id);
    
    batch.update(docRef, {
        ...entryData,
        updatedAt: new Date().toISOString()
    });

    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('payroll', { batch });
    
    await batch.commit();
}

export async function deletePayrollEntry(id: string) {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(payrollCollection, id);
    
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
    
    if (lastSyncTime) {
        // Only get documents modified after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            collection(firestoreDB, "holidays"),
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(collection(firestoreDB, "holidays"));
    }

    const querySnapshot = await getDocs(q);
    const holidays = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Holiday));
    
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
    const docRef = doc(firestoreDB, "holidays", date);
    await setDoc(docRef, { date, name });
}

export async function deleteHoliday(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "holidays", id);
    await deleteDoc(docRef);
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

// Fetch ALL supplier payments (use cautiously for manual sync)
export async function getAllPayments(): Promise<Payment[]> {
  // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
  if (db) {
    try {
      const localPayments = await db.payments.toArray();
      const localGovPayments = await db.governmentFinalizedPayments.toArray();
      const allLocalPayments = [...localPayments, ...localGovPayments];
      if (allLocalPayments.length > 0) {
        return allLocalPayments;
      }
    } catch (error) {
      // If local read fails, continue with Firestore
      handleSilentError(error, 'getAllPayments - local read fallback');
    }
  }

  // ✅ FIX: Always do FULL sync to ensure we get ALL documents
  // Incremental sync misses documents without updatedAt or with incorrect timestamps
  let q, govQ;
  try {
    // Try with orderBy first (faster if index exists)
    q = query(supplierPaymentsCollection, orderBy("date", "desc"));
    govQ = query(governmentFinalizedPaymentsCollection, orderBy("date", "desc"));
  } catch (error: unknown) {
    // If orderBy fails (missing index), use simple query
    q = query(supplierPaymentsCollection);
    govQ = query(governmentFinalizedPaymentsCollection);
  }

  const [snapshot, govSnapshot] = await Promise.all([
    getDocs(q),
    getDocs(govQ)
  ]);
  
  const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
  const govPayments = govSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
  const allPayments = [...payments, ...govPayments];
  
  // Track Firestore read
  firestoreMonitor.logRead('payments', 'getAllPayments', allPayments.length);
  
  // Save to local IndexedDB and update last sync time
  if (db && allPayments.length > 0) {
    // ✅ OPTIMIZED: Use chunked bulkPut to prevent blocking
    const { chunkedBulkPut } = await import('./chunked-operations');
    if (payments.length > 0) {
      await chunkedBulkPut(db.payments, payments, 100);
    }
    if (govPayments.length > 0) {
      await chunkedBulkPut(db.governmentFinalizedPayments, govPayments, 100);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSync:payments', String(Date.now()));
    }
  }
  
  return allPayments;
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
    
    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Customer>(
            suppliersCollection,
            'lastSync:suppliers_v3',
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
            storageKey: 'lastSync:suppliers_v3'
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

    const fetchFunction = async () => {
        return await fetchCollectionWithIncrementalSync<Customer>(
            customersCollection,
            'lastSync:customers_v3',
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
            storageKey: 'lastSync:customers_v3'
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
            const regularPayments = db ? await db.payments.orderBy('date').reverse().toArray() : [];
            const govPayments = db ? await db.governmentFinalizedPayments.orderBy('date').reverse().toArray() : [];
            return [...regularPayments, ...govPayments] as Payment[];
        }, callback);
    }

    let regularPayments: Payment[] = [];
    let govPayments: Payment[] = [];
    let regularLoaded = false;
    let govLoaded = false;

    // Helper to merge and sort payments from both sources
    const mergeAndCallback = () => {
        // Deduplicate by id/paymentId to prevent double counting when offline submissions create duplicates
        const uniquePayments = new Map<string, Payment>();

        const getPaymentKey = (p: Payment) => {
            const key = String((p as any).paymentId || (p as any).id || '').trim();
            return key || null;
        };

        const getPaymentTime = (p: Payment) => {
            const updatedAt = (p as any).updatedAt;
            const updatedAtMs =
                updatedAt && typeof updatedAt === 'object' && typeof (updatedAt as any).toMillis === 'function'
                    ? (updatedAt as any).toMillis()
                    : (updatedAt ? new Date(updatedAt as any).getTime() : 0);
            const dateMs = p.date ? new Date(p.date).getTime() : 0;
            return Math.max(updatedAtMs || 0, dateMs || 0);
        };
        
        [...regularPayments, ...govPayments].forEach(p => {
            const key = getPaymentKey(p);
            if (!key) return;

            const existing = uniquePayments.get(key);
            if (!existing) {
                uniquePayments.set(key, p);
                return;
            }

            if (getPaymentTime(p) >= getPaymentTime(existing)) {
                uniquePayments.set(key, p);
            }
        });

        // Create a new array to avoid mutating state
        const allPayments = Array.from(uniquePayments.values()).sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
        callback(allPayments);
    };

    // Listener 1: Regular Payments
    const unsubRegular = createMetadataBasedListener<Payment>(
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
            regularPayments = data;
            regularLoaded = true;
            mergeAndCallback();
        },
        onError
    );

    // Listener 2: Gov Payments
    const unsubGov = createMetadataBasedListener<Payment>(
        {
            collectionName: 'governmentFinalizedPayments',
            fetchFunction: async () => {
                return await fetchCollectionWithIncrementalSync<Payment>(
                    governmentFinalizedPaymentsCollection, 
                    'lastSync:governmentFinalizedPayments_v3', 
                    db?.governmentFinalizedPayments,
                    'updatedAt',
                    'date',
                    (doc) => ({ id: doc.id, ...doc.data(), receiptType: 'Gov.' } as Payment)
                );
            },
            localTableName: 'governmentFinalizedPayments',
            storageKey: 'lastSync:governmentFinalizedPayments_v3'
        },
        (data) => {
            // Force receiptType again for safety
            govPayments = data.map(p => ({ ...p, receiptType: 'Gov.' }));
            govLoaded = true;
            mergeAndCallback();
        },
        onError
    );

    return () => {
        unsubRegular();
        unsubGov();
    };
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
    
    const newAccount = { 
        ...accountData, 
        id: docRef.id,
        updatedAt: new Date().toISOString()
    };
    
    batch.set(docRef, newAccount);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('supplierBankAccounts', { batch });
    
    await batch.commit();
    return newAccount as BankAccount;
}

export async function updateSupplierBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(supplierBankAccountsCollection, id);
    
    batch.update(docRef, {
        ...accountData,
        updatedAt: new Date().toISOString()
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('supplierBankAccounts', { batch });
    
    await batch.commit();
}

export async function deleteSupplierBankAccount(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(supplierBankAccountsCollection, id);
    
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
  const templateData = {
    ...template,
    createdAt: new Date().toISOString()
  };
  const docRef = await addDoc(expenseTemplatesCollection, templateData);
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
  await updateDoc(docRef, template);
}

export async function deleteExpenseTemplate(id: string): Promise<void> {
  await deleteDoc(doc(expenseTemplatesCollection, id));
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
    const newAccount = {
        name: account.name,
        address: account.address || '',
        contact: account.contact || '',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, newAccount);
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    
    await batch.commit();

    return {
        id: docRef.id,
        ...newAccount,
    };
}

export async function updateLedgerAccount(id: string, updates: Partial<LedgerAccountInput>): Promise<void> {
    const docRef = doc(ledgerAccountsCollection, id);
    const batch = writeBatch(firestoreDB);
    batch.update(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    
    await batch.commit();
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
    const batch = writeBatch(firestoreDB);
    batch.delete(doc(ledgerAccountsCollection, id));

    const entriesSnapshot = await getDocs(query(ledgerEntriesCollection, where('accountId', '==', id)));
    entriesSnapshot.forEach((entryDoc) => {
        batch.delete(entryDoc.ref);
    });
    
    const { notifySyncRegistry } = await import('./sync-registry');
    await notifySyncRegistry('ledgerAccounts', { batch });
    if (entriesSnapshot.size > 0) {
        await notifySyncRegistry('ledgerEntries', { batch });
    }

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

export async function fetchMandiReports(): Promise<MandiReport[]> {
    
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    if (db) {
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
        // Data structure: /mandiReports/{voucherNo}/6P/{docId}
        // So we need to:
        // 1. Fetch all parent documents from mandiReports collection
        // 2. For each parent, query the 6P subcollection
        // 3. Also try collectionGroup for '6P' subcollection (gets all 6P subcollections regardless of parent)
        
        
        // Method 1: Use collectionGroup to get ALL '6P' subcollections
        try {

            const collectionGroup6P = collectionGroup(firestoreDB, '6P');
            const group6PSnapshot = await getDocs(collectionGroup6P);
            
            if (group6PSnapshot.size > 0) {
                group6PSnapshot.docs.forEach((docSnap, index) => {
                    const data = docSnap.data() as MandiReport;
                    const fullPath = docSnap.ref.path;
                    const pathParts = fullPath.split('/');
                    
                    // Path format: mandiReports/{voucherNo}/6P/{docId}
                    // Extract voucherNo (parent doc) and docId
                    let docId = pathParts[pathParts.length - 1];
                    let voucherNo = pathParts.length >= 2 ? pathParts[pathParts.length - 3] : undefined;
                    
                    const finalId = data.id || docId;
                    
                    if (index < 5) {

                    }
                    
                    // Use finalId as key to avoid duplicates
                    if (!reportMap.has(finalId)) {
                        reportMap.set(finalId, { ...data, id: finalId });
                    }
                });
                
            } else {

            }
        } catch (collectionGroup6PError: unknown) {


        }
        
        // Method 2: Manually query each parent document's 6P subcollection
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

    // Use collectionGroup to listen to all '6P' subcollections
    const collectionGroup6P = collectionGroup(firestoreDB, '6P');
    
    // ✅ First fetch all reports
    getDocs(collectionGroup6P).then((fullSnapshot) => {
        const allReports: MandiReport[] = [];
        fullSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as MandiReport;
            const fullPath = docSnap.ref.path;
            const pathParts = fullPath.split('/');
            let docId = pathParts[pathParts.length - 1];
            const finalId = data.id || docId;
            
            if (!reportMap.has(finalId)) {
                reportMap.set(finalId, { ...data, id: finalId });
            }
        });
        
        firestoreReports = Array.from(reportMap.values());
        
        // Sort by purchaseDate (newest first)
        firestoreReports.sort((a, b) => {
            const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
            const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
            return dateB - dateA;
        });
        
        callback(firestoreReports);
        
        // Save to IndexedDB
        if (db && firestoreReports.length > 0) {
            db.mandiReports.bulkPut(firestoreReports).catch(() => {});
        }
        
        // ✅ Save last sync time
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:mandiReports', String(Date.now()));
        }
    }).catch((error) => {

        onError(error as Error);
    });

    // ✅ Set up realtime listener for future changes
    return onSnapshot(collectionGroup6P, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data() as MandiReport;
            const fullPath = change.doc.ref.path;
            const pathParts = fullPath.split('/');
            let docId = pathParts[pathParts.length - 1];
            const finalId = data.id || docId;
            
            if (change.type === 'removed') {
                reportMap.delete(finalId);
            } else {
                reportMap.set(finalId, { ...data, id: finalId });
            }
        });
        
        firestoreReports = Array.from(reportMap.values());
        
        // Sort by purchaseDate (newest first)
        firestoreReports.sort((a, b) => {
            const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
            const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
            return dateB - dateA;
        });
        
        callback(firestoreReports);
        
        // Save to IndexedDB
        if (db && firestoreReports.length > 0) {
            db.mandiReports.bulkPut(firestoreReports).catch(() => {});
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:mandiReports', String(Date.now()));
        }
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
