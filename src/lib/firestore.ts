
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
} from "firebase/firestore";
import { firestoreDB } from "./firebase"; // Renamed to avoid conflict
import { db } from "./database";
import { isFirestoreTemporarilyDisabled, markFirestoreDisabled, isQuotaError, createPollingFallback } from "./realtime-guard";
import { firestoreMonitor } from "./firestore-monitor";
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense, Holiday, LedgerAccount, LedgerEntry, LedgerAccountInput, LedgerEntryInput, LedgerCashAccount, LedgerCashAccountInput, MandiReport, MandiHeaderSettings, KantaParchi, CustomerDocument } from "@/lib/definitions";
import { toTitleCase, generateReadableId, calculateSupplierEntry } from "./utils";
import { format } from "date-fns";

const suppliersCollection = collection(firestoreDB, "suppliers");
const customersCollection = collection(firestoreDB, "customers");
const supplierPaymentsCollection = collection(firestoreDB, "payments");
const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
const incomesCollection = collection(firestoreDB, "incomes");
const expensesCollection = collection(firestoreDB, "expenses");
const payeeProfilesCollection = collection(firestoreDB, "payeeProfiles");
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

function stripUndefined<T extends Record<string, any>>(data: T): T {
    const cleanedEntries = Object.entries(data).filter(
        ([, value]) => value !== undefined
    );
    return Object.fromEntries(cleanedEntries) as T;
}


// --- User Refresh Token Functions ---
export async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const userDocRef = doc(firestoreDB, "users", userId);
    await setDoc(userDocRef, { refreshToken: refreshToken }, { merge: true });
}

export async function getRefreshToken(userId: string): Promise<string | null> {
    const userDocRef = doc(firestoreDB, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && docSnap.data().refreshToken) {
        return docSnap.data().refreshToken;
    }
    return null;
}


// --- Dynamic Options Functions ---

export function getOptionsRealtime(collectionName: string, callback: (options: OptionItem[]) => void, onError: (error: Error) => void): () => void {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    if (db) {
        db.options.where('type').equals(collectionName).toArray().then((localOptions) => {
            if (localOptions.length > 0) {
                callback(localOptions);
            }
        }).catch(() => {
            // If local read fails, continue with Firestore
        });
    }

    // ✅ Use incremental sync - only listen for changes
    const docRef = doc(optionsCollection, collectionName);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const options = Array.isArray(data.items) ? data.items.map((name: string) => ({ id: name.toLowerCase(), name: toTitleCase(name) })) : [];
            
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
    const docRef = doc(optionsCollection, collectionName);
    await setDoc(docRef, {
        items: arrayUnion(toTitleCase(optionData.name))
    }, { merge: true });
}


export async function updateOption(collectionName: string, id: string, optionData: Partial<{ name: string }>): Promise<void> {
    console.warn("Updating option names is not directly supported via this function. Please implement rename logic carefully.");
}

export async function deleteOption(collectionName: string, id: string, name: string): Promise<void> {
    const docRef = doc(optionsCollection, collectionName);
    await updateDoc(docRef, {
        items: arrayRemove(name)
    });
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
    if (settings.mandiType !== undefined) payload.mandiType = settings.mandiType;
    if (settings.registerNo !== undefined) payload.registerNo = settings.registerNo;
    if (settings.commodity !== undefined) payload.commodity = settings.commodity;
    if (settings.financialYear !== undefined) payload.financialYear = settings.financialYear;

    await setDoc(mandiHeaderDocRef, payload, { merge: true });
}

// --- Bank & Branch Functions ---
export async function addBank(bankName: string): Promise<Bank> {
  const docRef = doc(firestoreDB, 'banks', bankName);
  await setDoc(docRef, { name: bankName });
  return { id: docRef.id, name: bankName };
}

export async function deleteBank(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "banks", id);
    await deleteDoc(docRef);
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

    const docRef = await addDoc(bankBranchesCollection, branchData);
    return { id: docRef.id, ...branchData };
}


export async function updateBankBranch(id: string, branchData: Partial<BankBranch>): Promise<void> {
    const docRef = doc(firestoreDB, "bankBranches", id);
    await updateDoc(docRef, branchData);
}

export async function deleteBankBranch(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "bankBranches", id);
    await deleteDoc(docRef);
}


// --- Bank Account Functions ---
export async function addBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const docRef = doc(bankAccountsCollection, accountData.accountNumber);
    const newAccount = { ...accountData, id: docRef.id };
    await setDoc(docRef, newAccount);
    return newAccount as BankAccount;
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    await updateDoc(docRef, accountData);
}

export async function deleteBankAccount(id: string): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    await deleteDoc(docRef);
}


// --- Supplier Functions ---
export async function addSupplier(supplierData: Customer): Promise<Customer> {
    // Use local-first sync manager
    const { writeLocalFirst } = await import('./local-first-sync');
    return await writeLocalFirst('suppliers', 'create', supplierData.id, supplierData) as Customer;
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
    console.error('updateSupplier: No ID provided');
    return false;
  }
  
  if (!supplierData || Object.keys(supplierData).length === 0) {
    console.error('updateSupplier: No data provided to update');
    return false;
  }
  
  // Use local-first sync manager
  try {
    const { writeLocalFirst } = await import('./local-first-sync');
    await writeLocalFirst('suppliers', 'update', id, undefined, supplierData);
    return true;
  } catch (error) {
    console.error('updateSupplier error:', error);
    return false;
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) {
    console.error("deleteSupplier requires a valid ID.");
    return;
  }

  try {
    // Get the supplier data to find the serial number
    const supplierDoc = await getDoc(doc(suppliersCollection, id));
    if (!supplierDoc.exists()) {
      console.error("Supplier not found for deletion");
      return;
    }
    
    const supplierData = supplierDoc.data();
    const supplierSrNo = supplierData.srNo;
    
    // Find all payments associated with this supplier's serial number
    const paymentsQuery = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo: supplierSrNo }));
    const paymentsSnapshot = await getDocs(paymentsQuery);
    
    const batch = writeBatch(firestoreDB);
    const paymentsToDelete: string[] = [];
    
    // Process each payment
    paymentsSnapshot.forEach(paymentDoc => {
      const payment = paymentDoc.data() as Payment;
      
      if (payment.paidFor && payment.paidFor.length === 1 && payment.paidFor[0].srNo === supplierSrNo) {
        // Payment is only for this supplier, delete it completely
        paymentsToDelete.push(paymentDoc.id);
        batch.delete(paymentDoc.ref);
      } else if (payment.paidFor && payment.paidFor.length > 1) {
        // Payment is for multiple entries, remove this supplier from paidFor
        const updatedPaidFor = payment.paidFor.filter(pf => pf.srNo !== supplierSrNo);
        const amountToDeduct = payment.paidFor.find(pf => pf.srNo === supplierSrNo)?.amount || 0;
        
        if (updatedPaidFor.length > 0) {
          batch.update(paymentDoc.ref, {
            paidFor: updatedPaidFor,
            amount: payment.amount - amountToDeduct
          });
        } else {
          // If no more entries, delete the payment
          paymentsToDelete.push(paymentDoc.id);
          batch.delete(paymentDoc.ref);
        }
      }
    });
    
    // Delete the supplier
    batch.delete(doc(suppliersCollection, id));
    
    // Commit all changes
    await batch.commit();
    
    // Update IndexedDB
    if (db) {
      await db.suppliers.delete(id);
      if (paymentsToDelete.length > 0) {
        await db.payments.bulkDelete(paymentsToDelete);
      }
    }
    
    console.log(`Deleted supplier ${id} and ${paymentsToDelete.length} associated payments`);
    
  } catch (error) {
    console.error('Error deleting supplier and payments:', error);
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
                dueDate: recalculatedData.dueDate,
            };
            
            batch.update(supplierRef, updatePayload);
            updatedCount++;
        }
    }
    
    await batch.commit();
    return updatedCount;
}


// --- Customer Functions ---
export async function addCustomer(customerData: Customer): Promise<Customer> {
    // Use local-first sync manager
    const { writeLocalFirst } = await import('./local-first-sync');
    const id = customerData.id || customerData.srNo;
    return await writeLocalFirst('customers', 'create', id, customerData) as Customer;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        console.error("updateCustomer requires a valid ID.");
        return false;
    }
    // Use local-first sync manager
    try {
        const { writeLocalFirst } = await import('./local-first-sync');
        await writeLocalFirst('customers', 'update', id, undefined, customerData);
        return true;
    } catch (error) {
        console.error('updateCustomer error:', error);
        return false;
    }
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
        console.error("deleteCustomer requires a valid ID.");
        return;
    }
    // Use local-first sync manager
    const { writeLocalFirst } = await import('./local-first-sync');
    await writeLocalFirst('customers', 'delete', id);
}

// --- Kanta Parchi Functions ---
export async function addKantaParchi(kantaParchiData: KantaParchi): Promise<KantaParchi> {
    const docRef = doc(kantaParchiCollection, kantaParchiData.srNo);
    const dataWithTimestamp = {
        ...kantaParchiData,
        createdAt: kantaParchiData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, dataWithTimestamp);
    return dataWithTimestamp;
}

export async function updateKantaParchi(srNo: string, kantaParchiData: Partial<Omit<KantaParchi, 'id' | 'srNo'>>): Promise<boolean> {
    if (!srNo) {
        console.error("updateKantaParchi requires a valid srNo.");
        return false;
    }
    const docRef = doc(kantaParchiCollection, srNo);
    await updateDoc(docRef, {
        ...kantaParchiData,
        updatedAt: new Date().toISOString(),
    });
    return true;
}

export async function deleteKantaParchi(srNo: string): Promise<void> {
    if (!srNo) {
        console.error("deleteKantaParchi requires a valid srNo.");
        return;
    }
    await deleteDoc(doc(kantaParchiCollection, srNo));
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
    const q = query(kantaParchiCollection, orderBy("srNo", "desc"));
    return onSnapshot(q, (snapshot) => {
        const kantaParchi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KantaParchi));
        callback(kantaParchi);
    }, onError);
}

// --- Customer Document Functions ---
export async function addCustomerDocument(documentData: CustomerDocument): Promise<CustomerDocument> {
    const docRef = doc(customerDocumentsCollection, documentData.documentSrNo);
    const dataWithTimestamp = {
        ...documentData,
        createdAt: documentData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, dataWithTimestamp);
    return dataWithTimestamp;
}

export async function updateCustomerDocument(documentSrNo: string, documentData: Partial<Omit<CustomerDocument, 'id' | 'documentSrNo' | 'kantaParchiSrNo'>>): Promise<boolean> {
    if (!documentSrNo) {
        console.error("updateCustomerDocument requires a valid documentSrNo.");
        return false;
    }
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    await updateDoc(docRef, {
        ...documentData,
        updatedAt: new Date().toISOString(),
    });
    return true;
}

export async function deleteCustomerDocument(documentSrNo: string): Promise<void> {
    if (!documentSrNo) {
        console.error("deleteCustomerDocument requires a valid documentSrNo.");
        return;
    }
    await deleteDoc(doc(customerDocumentsCollection, documentSrNo));
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
    const q = query(customerDocumentsCollection, orderBy("documentSrNo", "desc"));
    return onSnapshot(q, (snapshot) => {
        const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument));
        callback(documents);
    }, onError);
}

// --- Inventory Item Functions ---
export async function addInventoryItem(item: any) {
  const docRef = await addDoc(inventoryItemsCollection, item);
  return { id: docRef.id, ...item };
}
export async function updateInventoryItem(id: string, item: any) {
  const docRef = doc(inventoryItemsCollection, id);
  await updateDoc(docRef, item);
}
export async function deleteInventoryItem(id: string) {
  const docRef = doc(inventoryItemsCollection, id);
  await deleteDoc(docRef);
}


// --- Payment Functions ---
export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentsQuery = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo: srNo }));
  const snapshot = await getDocs(paymentsQuery);
  const batch = writeBatch(firestoreDB);
  
  const paymentIdsToDelete: string[] = [];
  snapshot.forEach(doc => {
      batch.delete(doc.ref);
      paymentIdsToDelete.push(doc.id);
  });
  
  await batch.commit();

  if (db) {
    await db.payments.bulkDelete(paymentIdsToDelete);
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
  const paymentsQuery = query(customerPaymentsCollection, where("paidFor", "array-contains", { srNo: srNo }));
  const snapshot = await getDocs(paymentsQuery);
  const batch = writeBatch(firestoreDB);
  snapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  await batch.commit();
}


// --- Fund Transaction Functions ---
export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'transactionId' | 'date'>): Promise<FundTransaction> {
  const dataWithDate = {
    ...transactionData,
    date: new Date().toISOString(),
  };
  const docRef = await addDoc(fundTransactionsCollection, dataWithDate);
  return { id: docRef.id, transactionId: '', ...dataWithDate };
}

export async function updateFundTransaction(id: string, data: Partial<FundTransaction>): Promise<void> {
    const docRef = doc(fundTransactionsCollection, id);
    await updateDoc(docRef, data);
}

export async function deleteFundTransaction(id: string): Promise<void> {
    const docRef = doc(fundTransactionsCollection, id);
    await deleteDoc(docRef);
}


// --- Income/Expense Category Functions ---

export function getIncomeCategories(callback: (data: IncomeCategory[]) => void, onError: (error: Error) => void) {
    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:incomeCategories');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            collection(firestoreDB, "incomeCategories"),
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(collection(firestoreDB, "incomeCategories"), orderBy("name"));
    }

    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeCategory));
        callback(categories);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:incomeCategories', String(Date.now()));
        }
    }, onError);
}

export function getExpenseCategories(callback: (data: ExpenseCategory[]) => void, onError: (error: Error) => void) {
    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:expenseCategories');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            collection(firestoreDB, "expenseCategories"),
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(collection(firestoreDB, "expenseCategories"), orderBy("name"));
    }

    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
        callback(categories);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:expenseCategories', String(Date.now()));
        }
    }, onError);
}

export async function addCategory(collectionName: "incomeCategories" | "expenseCategories", category: { name: string; nature?: string }) {
    await addDoc(collection(firestoreDB, collectionName), { ...category, subCategories: [] });
}

export async function updateCategoryName(collectionName: "incomeCategories" | "expenseCategories", id: string, name: string) {
    await updateDoc(doc(firestoreDB, collectionName, id), { name });
}

export async function deleteCategory(collectionName: "incomeCategories" | "expenseCategories", id: string) {
    await deleteDoc(doc(firestoreDB, collectionName, id));
}

export async function addSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    await updateDoc(doc(firestoreDB, collectionName, categoryId), {
        subCategories: arrayUnion(subCategoryName)
    });
}

export async function deleteSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    await updateDoc(doc(firestoreDB, collectionName, categoryId), {
        subCategories: arrayRemove(subCategoryName)
    });
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
    const docRef = doc(attendanceCollection, entry.id);
    await setDoc(docRef, entry, { merge: true });
}

// --- Project Functions ---
export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const docRef = await addDoc(projectsCollection, projectData);
    return { id: docRef.id, ...projectData };
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    await updateDoc(doc(projectsCollection, id), projectData);
}

export async function deleteProject(id: string): Promise<void> {
    await deleteDoc(doc(projectsCollection, id));
}


// --- Loan Functions ---
export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    const docRef = await addDoc(loansCollection, loanData);
    const newLoan = { id: docRef.id, ...loanData };

    if ((loanData.loanType === 'Bank' || loanData.loanType === 'Outsider') && loanData.totalAmount > 0) {
        await addFundTransaction({
            type: 'CapitalInflow',
            source: loanData.loanType === 'Bank' ? 'BankLoan' : 'ExternalLoan',
            destination: loanData.depositTo,
            amount: loanData.totalAmount,
            description: `Capital inflow from ${loanData.loanName}`
        });
    }
    
    return newLoan;
}

export async function updateLoan(id: string, loanData: Partial<Loan>): Promise<void> {
    await updateDoc(doc(loansCollection, id), loanData);
}

export async function deleteLoan(id: string): Promise<void> {
    await deleteDoc(doc(loansCollection, id));
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
    const formatSettings = await getFormatSettings();
    const newTransactionId = incomeData.transactionId || (await (async () => {
        const incomesSnapshot = await getDocs(query(incomesCollection, orderBy('transactionId', 'desc'), limit(1)));
        const lastNum = incomesSnapshot.empty ? 0 : parseInt(incomesSnapshot.docs[0].data().transactionId.replace(formatSettings.income?.prefix || 'IN', '')) || 0;
        return generateReadableId(formatSettings.income?.prefix || 'IN', lastNum, formatSettings.income?.padding || 5);
    })());

    // SAFETY CHECK: Prevent overwriting existing document
    const docRef = doc(incomesCollection, newTransactionId);
    const existingDoc = await getDoc(docRef);
    
    if (existingDoc.exists()) {
        throw new Error(`Transaction ID ${newTransactionId} already exists! Cannot overwrite existing document.`);
    }
    
    const newIncome = { ...incomeData, transactionId: newTransactionId, id: docRef.id };
    await setDoc(docRef, newIncome);
    return newIncome;
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
    await setDoc(docRef, newExpense);
    return newExpense;
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    await updateDoc(doc(incomesCollection, id), incomeData);
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    await updateDoc(doc(expensesCollection, id), expenseData);
}

export async function deleteIncome(id: string): Promise<void> {
    await deleteDoc(doc(incomesCollection, id));
}

export async function deleteExpense(id: string): Promise<void> {
    await deleteDoc(doc(expensesCollection, id));
}

export async function updateExpensePayee(oldPayee: string, newPayee: string): Promise<void> {
    const q = query(expensesCollection, where('payee', '==', oldPayee));
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    snapshot.forEach(doc => {
        batch.update(doc.ref, { payee: toTitleCase(newPayee) });
    });
    await batch.commit();
}

export async function updateIncomePayee(oldPayee: string, newPayee: string): Promise<void> {
    const q = query(incomesCollection, where('payee', '==', oldPayee));
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    snapshot.forEach(doc => {
        batch.update(doc.ref, { payee: toTitleCase(newPayee) });
    });
    await batch.commit();
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

export type PayeeProfile = {
    name: string;
    contact?: string;
    address?: string;
    nature?: string;
    category?: string;
    subCategory?: string;
    updatedAt?: string;
};

const buildPayeeProfileDocId = (name: string) =>
    toTitleCase(name || '').trim().replace(/\s+/g, '_').toLowerCase();

export function getPayeeProfilesRealtime(
    callback: (data: PayeeProfile[]) => void,
    onError: (error: Error) => void,
) {
    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:payeeProfiles');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            payeeProfilesCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(payeeProfilesCollection);
    }

    return onSnapshot(q, (snapshot) => {
        const profiles = snapshot.docs.map(doc => ({
            ...(doc.data() as PayeeProfile)
        }));
        callback(profiles);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:payeeProfiles', String(Date.now()));
        }
    }, onError);
}

export async function upsertPayeeProfile(profile: PayeeProfile, previousName?: string): Promise<void> {
    const normalizedName = toTitleCase(profile.name || '').trim();
    if (!normalizedName) return;

    if (previousName && toTitleCase(previousName).trim() !== normalizedName) {
        const prevDocId = buildPayeeProfileDocId(previousName);
        await deleteDoc(doc(payeeProfilesCollection, prevDocId)).catch(() => {});
    }

    const docRef = doc(payeeProfilesCollection, buildPayeeProfileDocId(normalizedName));
    const payload: PayeeProfile = {
        name: normalizedName,
        updatedAt: new Date().toISOString(),
    };

    if (profile.contact !== undefined) payload.contact = profile.contact;
    if (profile.address !== undefined) payload.address = profile.address;
    if (profile.nature !== undefined) payload.nature = profile.nature;
    if (profile.category !== undefined) payload.category = profile.category;
    if (profile.subCategory !== undefined) payload.subCategory = profile.subCategory;

    await setDoc(docRef, payload, { merge: true });
}

export async function deletePayeeProfile(name: string): Promise<void> {
    const normalizedName = toTitleCase(name || '').trim();
    if (!normalizedName) return;
    const docId = buildPayeeProfileDocId(normalizedName);
    await deleteDoc(doc(payeeProfilesCollection, docId)).catch(() => {});
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
    const docRef = doc(employeesCollection, employeeData.employeeId);
    await setDoc(docRef, employeeData, { merge: true });
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
    await updateDoc(doc(employeesCollection, id), employeeData);
}

export async function deleteEmployee(id: string) {
    await deleteDoc(doc(employeesCollection, id));
}

// --- Payroll Functions ---
export async function addPayrollEntry(entryData: Omit<PayrollEntry, 'id'>) {
    const docRef = await addDoc(payrollCollection, entryData);
    return { id: docRef.id, ...entryData };
}

export async function updatePayrollEntry(id: string, entryData: Partial<PayrollEntry>) {
    await updateDoc(doc(payrollCollection, id), entryData);
}

export async function deletePayrollEntry(id: string) {
    await deleteDoc(doc(payrollCollection, id));
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
    }
  }

  // ✅ Use incremental sync - only get changed suppliers
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:suppliers');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      suppliersCollection,
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(suppliersCollection);
  }

  const snapshot = await getDocs(q);
  const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  
  // Track Firestore read
  firestoreMonitor.logRead('suppliers', 'getAllSuppliers', suppliers.length);
  
  // Save to local IndexedDB and update last sync time
  if (db && suppliers.length > 0) {
    await db.suppliers.bulkPut(suppliers);
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
    }
  }

  // ✅ Use incremental sync - only get changed customers
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:customers');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      customersCollection,
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(customersCollection);
  }

  const snapshot = await getDocs(q);
  const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  
  // Track Firestore read
  firestoreMonitor.logRead('customers', 'getAllCustomers', customers.length);
  
  // Save to local IndexedDB and update last sync time
  if (db && customers.length > 0) {
    await db.customers.bulkPut(customers);
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
      if (localPayments.length > 0) {
        return localPayments;
      }
    } catch (error) {
      // If local read fails, continue with Firestore
    }
  }

  // ✅ Use incremental sync - only get changed payments
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:payments');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      supplierPaymentsCollection,
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(supplierPaymentsCollection);
  }

  const snapshot = await getDocs(q);
  const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
  
  // Track Firestore read
  firestoreMonitor.logRead('payments', 'getAllPayments', payments.length);
  
  // Save to local IndexedDB and update last sync time
  if (db && payments.length > 0) {
    await db.payments.bulkPut(payments);
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
    }
  }

  // ✅ Use incremental sync - only get changed customer payments
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:customerPayments');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      customerPaymentsCollection,
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(customerPaymentsCollection);
  }

  const snapshot = await getDocs(q);
  const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
  
  // Save to local IndexedDB and update last sync time
  if (db && payments.length > 0) {
    await db.customerPayments.bulkPut(payments);
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
    }
  }

  // ✅ Use incremental sync - only get changed incomes
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:incomes');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      collection(firestoreDB, "incomes"),
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(collection(firestoreDB, "incomes"));
  }

  const snapshot = await getDocs(q);
  const incomes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
  
  // Save last sync time
  if (snapshot.size > 0 && typeof window !== 'undefined') {
    localStorage.setItem('lastSync:incomes', String(Date.now()));
  }
  
  return incomes;
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
    }
  }

  // ✅ Use incremental sync - only get changed expenses
  const getLastSyncTime = (): number | undefined => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('lastSync:expenses');
    return stored ? parseInt(stored, 10) : undefined;
  };

  const lastSyncTime = getLastSyncTime();
  let q;
  
  if (lastSyncTime) {
    const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
    q = query(
      collection(firestoreDB, "expenses"),
      where('updatedAt', '>', lastSyncTimestamp),
      orderBy('updatedAt')
    );
  } else {
    q = query(collection(firestoreDB, "expenses"));
  }

  const snapshot = await getDocs(q);
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  
  // Save last sync time
  if (snapshot.size > 0 && typeof window !== 'undefined') {
    localStorage.setItem('lastSync:expenses', String(Date.now()));
  }
  
  return expenses;
}

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
    // Circuit breaker: if FS is temporarily disabled, fallback to local polling
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.suppliers.orderBy('srNo').reverse().toArray() : [];
        }, callback);
    }

    let localSuppliers: Customer[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response, no Firestore reads)
    if (db) {
        db.suppliers.orderBy('srNo').reverse().toArray().then((localData) => {
            localSuppliers = localData as Customer[];
            callbackCalledFromIndexedDB = true;
            // Always call callback with IndexedDB results (even if empty) to clear loading state
            callback(localData as Customer[]);
        }).catch(() => {
            // If IndexedDB read fails, ensure Firestore will call callback
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync - only listen to NEW changes after last sync
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:suppliers');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            suppliersCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(suppliersCollection, orderBy("srNo", "desc"));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const newSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        
        // Track Firestore read
        firestoreMonitor.logRead('suppliers', 'getSuppliersRealtime', newSuppliers.length);
        
        // Merge new changes with local data
        if (callbackCalledFromIndexedDB && localSuppliers.length > 0) {
            const mergedMap = new Map<string, Customer>();
            // Add all local suppliers
            localSuppliers.forEach(s => mergedMap.set(s.id, s));
            // Update/add new suppliers from Firestore
            newSuppliers.forEach(s => mergedMap.set(s.id, s));
            const merged = Array.from(mergedMap.values()).sort((a, b) => {
                const aSrNo = parseInt(a.srNo || '0') || 0;
                const bSrNo = parseInt(b.srNo || '0') || 0;
                return bSrNo - aSrNo;
            });
            callback(merged);
            
            // Update IndexedDB with new changes
            if (db && newSuppliers.length > 0) {
                await db.suppliers.bulkPut(newSuppliers);
            }
        } else {
            // No local data or first sync - use Firestore data directly
            callback(newSuppliers);
            if (db && newSuppliers.length > 0) {
                await db.suppliers.bulkPut(newSuppliers);
            }
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:suppliers', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            // Switch to polling fallback immediately
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.suppliers.orderBy('srNo').reverse().toArray() : [];
            }, callback);
            try { unsubscribe(); } catch {}
            // Return a compound unsubscribe
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getCustomersRealtime(callback: (data: Customer[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.customers.orderBy('srNo').reverse().toArray() : [];
        }, callback);
    }

    let localCustomers: Customer[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response, no Firestore reads)
    if (db) {
        db.customers.orderBy('srNo').reverse().toArray().then((localData) => {
            localCustomers = localData as Customer[];
            callbackCalledFromIndexedDB = true;
            callback(localData as Customer[]);
        }).catch(() => {
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync - only listen to NEW changes after last sync
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:customers');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            customersCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(customersCollection, orderBy("srNo", "desc"));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const newCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        
        // Track Firestore read
        firestoreMonitor.logRead('customers', 'getCustomersRealtime', newCustomers.length);
        
        // Merge new changes with local data
        if (callbackCalledFromIndexedDB && localCustomers.length > 0) {
            const mergedMap = new Map<string, Customer>();
            localCustomers.forEach(c => mergedMap.set(c.id, c));
            newCustomers.forEach(c => mergedMap.set(c.id, c));
            const merged = Array.from(mergedMap.values()).sort((a, b) => {
                const aSrNo = parseInt(a.srNo || '0') || 0;
                const bSrNo = parseInt(b.srNo || '0') || 0;
                return bSrNo - aSrNo;
            });
            callback(merged);
            
            if (db && newCustomers.length > 0) {
                await db.customers.bulkPut(newCustomers);
            }
        } else {
            callback(newCustomers);
            if (db && newCustomers.length > 0) {
                await db.customers.bulkPut(newCustomers);
            }
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:customers', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.customers.orderBy('srNo').reverse().toArray() : [];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getPaymentsRealtime(callback: (data: Payment[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.payments.orderBy('date').reverse().toArray() : [];
        }, callback);
    }

    let localPayments: Payment[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response, no Firestore reads)
    if (db) {
        db.payments.orderBy('date').reverse().toArray().then((localData) => {
            localPayments = localData as Payment[];
            callbackCalledFromIndexedDB = true;
            callback(localData as Payment[]);
        }).catch(() => {
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync - only listen to NEW changes after last sync
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:payments');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        try {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                supplierPaymentsCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } catch (error) {
            // If updatedAt query fails (no index or missing fields), fallback to full sync
            console.warn('Incremental sync failed for payments, using full sync:', error);
            q = query(supplierPaymentsCollection, orderBy("date", "desc"));
        }
    } else {
        // First sync - get all (only once)
        q = query(supplierPaymentsCollection, orderBy("date", "desc"));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const newPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        
        // Track Firestore read
        firestoreMonitor.logRead('payments', 'getPaymentsRealtime', newPayments.length);
        
        // Merge new changes with local data
        if (callbackCalledFromIndexedDB && localPayments.length > 0) {
            const mergedMap = new Map<string, Payment>();
            // Add all local payments first
            localPayments.forEach(p => mergedMap.set(p.id, p));
            // Update/add new payments from Firestore
            newPayments.forEach(p => mergedMap.set(p.id, p));
            const merged = Array.from(mergedMap.values()).sort((a, b) => {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            callback(merged);
            // Update localPayments for next merge
            localPayments = merged;
            
            if (db && newPayments.length > 0) {
                await db.payments.bulkPut(newPayments);
            }
        } else {
            // No local data or first sync - use Firestore data directly
            callback(newPayments);
            localPayments = newPayments;
            if (db && newPayments.length > 0) {
                await db.payments.bulkPut(newPayments);
            }
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:payments', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.payments.orderBy('date').reverse().toArray() : [];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getCustomerPaymentsRealtime(callback: (data: CustomerPayment[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.customerPayments.orderBy('date').reverse().toArray() : [];
        }, callback);
    }

    let localPayments: CustomerPayment[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response, no Firestore reads)
    if (db) {
        db.customerPayments.orderBy('date').reverse().toArray().then((localData) => {
            localPayments = localData as CustomerPayment[];
            callbackCalledFromIndexedDB = true;
            callback(localData as CustomerPayment[]);
        }).catch(() => {
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync - only listen to NEW changes after last sync
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:customerPayments');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            customerPaymentsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(customerPaymentsCollection, orderBy("date", "desc"));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const newPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
        
        // Track Firestore read
        firestoreMonitor.logRead('customerPayments', 'getCustomerPaymentsRealtime', newPayments.length);
        
        // Merge new changes with local data
        if (callbackCalledFromIndexedDB && localPayments.length > 0) {
            const mergedMap = new Map<string, CustomerPayment>();
            localPayments.forEach(p => mergedMap.set(p.id, p));
            newPayments.forEach(p => mergedMap.set(p.id, p));
            const merged = Array.from(mergedMap.values()).sort((a, b) => {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            callback(merged);
            
            if (db && newPayments.length > 0) {
                await db.customerPayments.bulkPut(newPayments);
            }
        } else {
            callback(newPayments);
            if (db && newPayments.length > 0) {
                await db.customerPayments.bulkPut(newPayments);
            }
        }
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:customerPayments', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.customerPayments.orderBy('date').reverse().toArray() : [];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getLoansRealtime(callback: (data: Loan[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.loans.orderBy('startDate').reverse().toArray() : [];
        }, callback);
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:loans');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            loansCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(loansCollection, orderBy("startDate", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        callback(loans);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:loans', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.loans.orderBy('startDate').reverse().toArray() : [];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getFundTransactionsRealtime(callback: (data: FundTransaction[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.fundTransactions.orderBy('date').reverse().toArray() : [];
        }, callback);
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:fundTransactions');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            fundTransactionsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(fundTransactionsCollection, orderBy("date", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FundTransaction));
        callback(transactions);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:fundTransactions', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.fundTransactions.orderBy('date').reverse().toArray() : [];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getIncomeRealtime(callback: (data: Income[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        // Fallback to local transactions filtered as Income
        return createPollingFallback(async () => {
            if (!db) return [];
            const tx = await db.transactions.orderBy('date').reverse().toArray();
            return tx.filter((t: any) => (t.transactionType || t.type) === 'Income') as unknown as Income[];
        }, callback);
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:incomes');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            incomesCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(incomesCollection, orderBy("date", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        callback(transactions);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:incomes', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                if (!db) return [];
                const tx = await db.transactions.orderBy('date').reverse().toArray();
                return tx.filter((t: any) => (t.transactionType || t.type) === 'Income') as unknown as Income[];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}
export function getExpensesRealtime(callback: (data: Expense[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            if (!db) return [];
            const tx = await db.transactions.orderBy('date').reverse().toArray();
            return tx.filter((t: any) => (t.transactionType || t.type) === 'Expense') as unknown as Expense[];
        }, callback);
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:expenses');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            expensesCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(expensesCollection, orderBy("date", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        callback(transactions);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:expenses', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                if (!db) return [];
                const tx = await db.transactions.orderBy('date').reverse().toArray();
                return tx.filter((t: any) => (t.transactionType || t.type) === 'Expense') as unknown as Expense[];
            }, callback);
            try { unsubscribe(); } catch {}
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
    return unsubscribe;
}

export function getIncomeAndExpensesRealtime(callback: (data: Transaction[]) => void, onError: (error: Error) => void) {
    let incomeData: Income[] = [];
    let expenseData: Expense[] = [];
    let incomeDone = false;
    let expenseDone = false;

    // ✅ Use incremental sync for both collections
    const getLastSyncTime = (collectionName: string): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem(`lastSync:${collectionName}`);
        return stored ? parseInt(stored, 10) : undefined;
    };

    const incomesLastSync = getLastSyncTime('incomes');
    const expensesLastSync = getLastSyncTime('expenses');

    const mergeAndCallback = () => {
        if (incomeDone && expenseDone) {
            const all = [...incomeData, ...expenseData].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            callback(all);
        }
    }

    let incomesQuery;
    if (incomesLastSync) {
        const lastSyncTimestamp = Timestamp.fromMillis(incomesLastSync);
        incomesQuery = query(
            incomesCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        incomesQuery = query(incomesCollection, orderBy("date", "desc"));
    }

    const unsubIncomes = onSnapshot(incomesQuery, (snapshot) => {
        incomeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        incomeDone = true;
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:incomes', String(Date.now()));
        }
        
        mergeAndCallback();
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            incomeDone = true;
            mergeAndCallback();
            return;
        }
        onError(err);
    });

    let expensesQuery;
    if (expensesLastSync) {
        const lastSyncTimestamp = Timestamp.fromMillis(expensesLastSync);
        expensesQuery = query(
            expensesCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        expensesQuery = query(expensesCollection, orderBy("date", "desc"));
    }

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
        expenseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        expenseDone = true;
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:expenses', String(Date.now()));
        }
        
        mergeAndCallback();
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            expenseDone = true;
            mergeAndCallback();
            return;
        }
        onError(err);
    });
    
    return () => {
        unsubIncomes();
        unsubExpenses();
    }
}

export function getBankAccountsRealtime(callback: (data: BankAccount[]) => void, onError: (error: Error) => void) {
    if (isFirestoreTemporarilyDisabled()) {
        return createPollingFallback(async () => {
            return db ? await db.bankAccounts.toArray() : [];
        }, callback);
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:bankAccounts');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            bankAccountsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(bankAccountsCollection);
    }

    return onSnapshot(q, (snapshot) => {
        const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        callback(accounts);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:bankAccounts', String(Date.now()));
        }
    }, (err: any) => {
        if (isQuotaError(err)) {
            markFirestoreDisabled();
            const pollUnsub = createPollingFallback(async () => {
                return db ? await db.bankAccounts.toArray() : [];
            }, callback);
            (pollUnsub as any).__fromQuota__ = true;
            return;
        }
        onError(err);
    });
}

// --- Supplier Bank Account Functions ---
export async function addSupplierBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const docRef = doc(supplierBankAccountsCollection, accountData.accountNumber);
    const newAccount = { ...accountData, id: docRef.id };
    await setDoc(docRef, newAccount);
    return newAccount as BankAccount;
}

export async function updateSupplierBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const docRef = doc(supplierBankAccountsCollection, id);
    await updateDoc(docRef, accountData);
}

export async function deleteSupplierBankAccount(id: string): Promise<void> {
    const docRef = doc(supplierBankAccountsCollection, id);
    await deleteDoc(docRef);
}

export function getSupplierBankAccountsRealtime(callback: (data: BankAccount[]) => void, onError: (error: Error) => void) {
    let firestoreAccounts: BankAccount[] = []; // Store previous Firestore snapshot data (source of truth)
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response)
    // Note: IndexedDB might contain both regular and supplier bank accounts mixed together
    // Firestore will provide the correct supplier bank accounts data and overwrite IndexedDB cache
    if (db) {
        db.bankAccounts.toArray().then((localAccounts) => {
            callbackCalledFromIndexedDB = true;
            // Call callback with IndexedDB data to clear loading state quickly
            // Firestore snapshot will update with correct supplier bank accounts shortly
            callback(localAccounts as BankAccount[]);
        }).catch(() => {
            // If IndexedDB read fails, ensure Firestore will call callback
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:supplierBankAccounts');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Try incremental sync with updatedAt
        try {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                supplierBankAccountsCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } catch (error) {
            // If updatedAt query fails (no index or missing fields), fallback to full sync
            console.warn('Incremental sync failed for supplierBankAccounts, using full sync:', error);
            q = query(supplierBankAccountsCollection);
        }
    } else {
        // First sync - get all (only once)
        q = query(supplierBankAccountsCollection);
    }

    return onSnapshot(q, (snapshot) => {
        const newAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        
        // Firestore is the ONLY source of truth for supplier bank accounts
        // Always update state with Firestore data, never rely on IndexedDB cache alone
        if (lastSyncTime) {
            if (newAccounts.length > 0) {
                // Incremental sync with new accounts - merge with previous Firestore snapshot
                const merged = new Map<string, BankAccount>();
                firestoreAccounts.forEach(acc => merged.set(acc.id, acc));
                newAccounts.forEach(acc => merged.set(acc.id, acc));
                const allAccounts = Array.from(merged.values());
                firestoreAccounts = allAccounts;
                // Always call callback with merged accounts from Firestore
                callback(allAccounts);
                
                // Save to IndexedDB
                if (db) {
                    db.bankAccounts.bulkPut(allAccounts).catch(() => {});
                }
            } else {
                // No new accounts in incremental sync - use previous Firestore snapshot data
                // This ensures we always show the correct supplier bank accounts from Firestore
                if (firestoreAccounts.length > 0) {
                    callback(firestoreAccounts);
                } else {
                    // No previous Firestore data - need to do full fetch to get all supplier accounts
                    // For now, fetch all to ensure we have complete data
                    getDocs(query(supplierBankAccountsCollection)).then((fullSnapshot) => {
                        const allAccounts = fullSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
                        firestoreAccounts = allAccounts;
                        callback(allAccounts);
                        if (db && allAccounts.length > 0) {
                            db.bankAccounts.bulkPut(allAccounts).catch(() => {});
                        }
                    }).catch(onError);
                }
            }
        } else {
            // First sync - Firestore data is the source of truth
            firestoreAccounts = newAccounts;
            // Always call callback with Firestore data to ensure correct state
            callback(newAccounts);
            
            // Save to IndexedDB if there are accounts
            if (newAccounts.length > 0 && db) {
                db.bankAccounts.bulkPut(newAccounts).catch(() => {});
            }
        }
        
        // ✅ Save last sync time
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:supplierBankAccounts', String(Date.now()));
        }
    }, onError);
}

export function getBanksRealtime(callback: (data: Bank[]) => void, onError: (error: Error) => void) {
    let cachedBanks: Bank[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response)
    if (db) {
        db.banks.toArray().then((localBanks) => {
            cachedBanks = localBanks as Bank[];
            callbackCalledFromIndexedDB = true;
            // Always call callback with IndexedDB results (even if empty) to clear loading state
            callback(localBanks as Bank[]);
        }).catch(() => {
            // If IndexedDB read fails, ensure Firestore will call callback
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:banks');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Try incremental sync with updatedAt
        // But if banks don't have updatedAt field, always use full sync
        try {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                banksCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } catch (error) {
            // If updatedAt query fails (no index or missing fields), fallback to full sync
            console.warn('Incremental sync failed for banks, using full sync:', error);
            q = query(banksCollection);
        }
    } else {
        // First sync - get all (only once)
        q = query(banksCollection);
    }

    return onSnapshot(q, (snapshot) => {
        try {
        const newBanks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
        
        // Firestore is the source of truth for banks
        if (lastSyncTime) {
            if (newBanks.length > 0) {
                // Incremental sync with new banks - merge with cached from IndexedDB
                const merged = new Map<string, Bank>();
                cachedBanks.forEach(bank => merged.set(bank.id, bank));
                newBanks.forEach(bank => merged.set(bank.id, bank));
                const allBanks = Array.from(merged.values());
                cachedBanks = allBanks;
                callback(allBanks);
                
                // Save to IndexedDB
                if (db) {
                    db.banks.bulkPut(allBanks).catch(() => {});
                }
            } else {
                // No new banks in incremental sync - use cached from IndexedDB
                // This ensures we always show banks even if there are no changes
                if (cachedBanks.length > 0) {
                    callback(cachedBanks);
                } else {
                    // No cached banks - call with empty array to clear loading
                    callback([]);
                }
            }
        } else {
            // First sync - Firestore data is the source of truth
            if (newBanks.length > 0) {
                // Firestore has banks - use them
                cachedBanks = newBanks;
                callback(newBanks);
                
                // Save to IndexedDB
                if (db) {
                    db.banks.bulkPut(newBanks).catch(() => {});
                }
            } else {
                // First sync but Firestore has no banks - use cached from IndexedDB if available
                if (cachedBanks.length > 0) {
                    callback(cachedBanks);
                } else {
                    // No banks in Firestore or IndexedDB - call with empty array
                    callback([]);
                }
            }
        }
        
        // ✅ Save last sync time
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:banks', String(Date.now()));
        }
        } catch (error) {
            console.error('Error processing banks snapshot:', error);
            // On error, still try to use cached banks from IndexedDB
            if (cachedBanks.length > 0) {
                callback(cachedBanks);
            } else {
                onError(error as Error);
            }
        }
    }, (error) => {
        console.error('Banks snapshot error:', error);
        // On snapshot error, use cached banks from IndexedDB if available
        if (cachedBanks.length > 0) {
            callback(cachedBanks);
        } else {
            onError(error);
        }
    });
}

export function getBankBranchesRealtime(callback: (data: BankBranch[]) => void, onError: (error: Error) => void) {
    let cachedBranches: BankBranch[] = [];
    let callbackCalledFromIndexedDB = false;
    
    // ✅ Read from local IndexedDB first (immediate response)
    if (db) {
        db.bankBranches.toArray().then((localBranches) => {
            cachedBranches = localBranches as BankBranch[];
            callbackCalledFromIndexedDB = true;
            // Always call callback with IndexedDB results (even if empty) to clear loading state
            callback(localBranches as BankBranch[]);
        }).catch(() => {
            // If IndexedDB read fails, ensure Firestore will call callback
            callbackCalledFromIndexedDB = false;
        });
    }

    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:bankBranches');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Try incremental sync with updatedAt
        try {
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                bankBranchesCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } catch (error) {
            // If updatedAt query fails (no index or missing fields), fallback to full sync
            console.warn('Incremental sync failed for bankBranches, using full sync:', error);
            q = query(bankBranchesCollection);
        }
    } else {
        // First sync - get all (only once)
        q = query(bankBranchesCollection);
    }

    return onSnapshot(q, (snapshot) => {
        const newBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankBranch));
        
        // Firestore is the source of truth for bank branches
        if (lastSyncTime) {
            if (newBranches.length > 0) {
                // Incremental sync with new branches - merge with cached from IndexedDB
                const merged = new Map<string, BankBranch>();
                cachedBranches.forEach(branch => merged.set(branch.id || `${branch.bankName}_${branch.branchName}`, branch));
                newBranches.forEach(branch => merged.set(branch.id || `${branch.bankName}_${branch.branchName}`, branch));
                const allBranches = Array.from(merged.values());
                cachedBranches = allBranches;
                callback(allBranches);
                
                // Save to IndexedDB
                if (db) {
                    db.bankBranches.bulkPut(allBranches).catch(() => {});
                }
            } else {
                // No new branches in incremental sync - use cached from IndexedDB
                // This ensures we always show branches even if there are no changes
                if (cachedBranches.length > 0) {
                    callback(cachedBranches);
                } else {
                    // No cached branches - call with empty array to clear loading
                    callback([]);
                }
            }
        } else {
            // First sync - Firestore data is the source of truth
            cachedBranches = newBranches;
            callback(newBranches);
            
            // Save to IndexedDB if there are branches
            if (newBranches.length > 0 && db) {
                db.bankBranches.bulkPut(newBranches).catch(() => {});
            }
        }
        
        // ✅ Save last sync time
        if (typeof window !== 'undefined') {
            localStorage.setItem('lastSync:bankBranches', String(Date.now()));
        }
    }, onError);
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
    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:employees');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            employeesCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(employeesCollection, orderBy("employeeId"));
    }

    return onSnapshot(q, (snapshot) => {
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        callback(employees);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:employees', String(Date.now()));
        }
    }, onError);
}

export function getPayrollRealtime(callback: (data: PayrollEntry[]) => void, onError: (error: Error) => void) {
    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:payroll');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            payrollCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(payrollCollection, orderBy("payPeriod", "desc"));
    }

    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry));
        callback(entries);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:payroll', String(Date.now()));
        }
    }, onError);
}

export function getInventoryItemsRealtime(callback: (data: InventoryItem[]) => void, onError: (error: Error) => void) {
    // ✅ Use incremental sync for realtime listener
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:inventoryItems');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        // Only listen to NEW changes after last sync
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            inventoryItemsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        // First sync - get all (only once)
        q = query(inventoryItemsCollection, orderBy("name"));
    }

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        callback(items);
        
        // ✅ Save last sync time
        if (snapshot.size > 0 && typeof window !== 'undefined') {
            localStorage.setItem('lastSync:inventoryItems', String(Date.now()));
        }
    }, onError);
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
    const docRef = await addDoc(ledgerAccountsCollection, {
        name: account.name,
        address: account.address || '',
        contact: account.contact || '',
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    return {
        id: docRef.id,
        name: account.name,
        address: account.address || '',
        contact: account.contact || '',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export async function updateLedgerAccount(id: string, updates: Partial<LedgerAccountInput>): Promise<void> {
    const docRef = doc(ledgerAccountsCollection, id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
}

export async function deleteLedgerAccount(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    batch.delete(doc(ledgerAccountsCollection, id));

    const entriesSnapshot = await getDocs(query(ledgerEntriesCollection, where('accountId', '==', id)));
    entriesSnapshot.forEach((entryDoc) => {
        batch.delete(entryDoc.ref);
    });

    await batch.commit();
}

export async function fetchLedgerCashAccounts(): Promise<LedgerCashAccount[]> {
    // ✅ Read from local IndexedDB first to avoid unnecessary Firestore reads
    // Note: LedgerCashAccounts might not be in IndexedDB, adjust if needed
    
    // ✅ Use incremental sync - only get changed accounts
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:ledgerCashAccounts');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            ledgerCashAccountsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        q = query(ledgerCashAccountsCollection, orderBy('name'));
    }

    const snapshot = await getDocs(q);
    
    // Save last sync time
    if (snapshot.size > 0 && typeof window !== 'undefined') {
        localStorage.setItem('lastSync:ledgerCashAccounts', String(Date.now()));
    }
    
    return snapshot.docs.map((docSnap) => {
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
        };
    });
}

export async function createLedgerCashAccount(account: LedgerCashAccountInput): Promise<LedgerCashAccount> {
    const timestamp = new Date().toISOString();
    const payload = {
        name: account.name,
        noteGroups: account.noteGroups,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    const docRef = await addDoc(ledgerCashAccountsCollection, payload);

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
    await updateDoc(docRef, payload);
}

export async function deleteLedgerCashAccount(id: string): Promise<void> {
    await deleteDoc(doc(ledgerCashAccountsCollection, id));
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
            console.warn('Error reading from local IndexedDB, falling back to Firestore:', error);
        }
    }

    try {
        if (isFirestoreTemporarilyDisabled()) throw new Error('quota-exceeded');
        
        // ✅ Use incremental sync - only get changed entries
        const getLastSyncTime = (): number | undefined => {
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem('lastSync:ledgerEntries');
            return stored ? parseInt(stored, 10) : undefined;
        };

        const lastSyncTime = getLastSyncTime();
        let q;
        
        if (lastSyncTime) {
            // Only get documents modified after last sync
            const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
            q = query(
                ledgerEntriesCollection,
                where('updatedAt', '>', lastSyncTimestamp),
                orderBy('updatedAt')
            );
        } else {
            // First sync - get all (only once)
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
    await deleteDoc(entryRef);
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
    const docRef = doc(mandiReportsCollection, payload.id);
    await setDoc(docRef, payload, { merge: true });
    if (db) {
        await db.mandiReports.put(payload);
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
    await setDoc(docRef, updatePayload, { merge: true });
    if (db) {
        const existing = await db.mandiReports.get(id);
        await db.mandiReports.put({ ...(existing || { id }), ...updates, updatedAt: updatePayload.updatedAt });
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
        }
    }

    // ✅ Use incremental sync - only get changed reports
    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:mandiReports');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(
            mandiReportsCollection,
            where('updatedAt', '>', lastSyncTimestamp),
            orderBy('updatedAt')
        );
    } else {
        q = query(mandiReportsCollection, orderBy("purchaseDate", "desc"));
    }

    const snapshot = await getDocs(q);
    const reports = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as MandiReport;
        return { ...data, id: data.id || docSnap.id };
    });
    
    if (db && reports.length) {
        await db.mandiReports.bulkPut(reports);
    }
    
    // Save last sync time
    if (snapshot.size > 0 && typeof window !== 'undefined') {
        localStorage.setItem('lastSync:mandiReports', String(Date.now()));
    }
    
    return reports;
}
