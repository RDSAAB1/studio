
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
} from "firebase/firestore";
import { firestoreDB } from "./firebase"; // Renamed to avoid conflict
import { db } from "./database";
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense, Holiday, LedgerAccount, LedgerEntry, LedgerAccountInput, LedgerEntryInput, LedgerCashAccount, LedgerCashAccountInput, MandiReport, MandiHeaderSettings } from "@/lib/definitions";
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
    const docRef = doc(optionsCollection, collectionName);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const options = Array.isArray(data.items) ? data.items.map((name: string) => ({ id: name.toLowerCase(), name: toTitleCase(name) })) : [];
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
    const docRef = doc(suppliersCollection, supplierData.id);
    await setDoc(docRef, supplierData);
    if (db) {
        await db.suppliers.put(supplierData); // WRITE-THROUGH
    }
    return supplierData;
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
  
  try {
    const docRef = doc(suppliersCollection, id);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      // Remove 'id' from supplierData if it exists (shouldn't be in update data)
      const { id: _, ...updateData } = supplierData as any;
      await updateDoc(docRef, updateData);
    } else {
      // Create the document if it does not exist
      const dataToSet: any = { id, ...supplierData };
      await setDoc(docRef, dataToSet, { merge: true });
    }
    
    if (db) {
      // Merge update locally as well
      try {
        const existing = await db.suppliers.get(id);
        await db.suppliers.put({ ...(existing || { id }), ...(supplierData as any) });
      } catch (localError) {
        console.warn('Failed to update local IndexedDB:', localError);
        // Don't fail the whole operation if local update fails
      }
    }
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
    const docRef = doc(customersCollection, customerData.srNo);
    await setDoc(docRef, customerData);
    return customerData;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        console.error("updateCustomer requires a valid ID.");
        return false;
    }
    const docRef = doc(customersCollection, id);
    await updateDoc(docRef, customerData);
    return true;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
      console.error("deleteCustomer requires a valid ID.");
      return;
    }
    await deleteDoc(doc(customersCollection, id));
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
    const q = query(collection(firestoreDB, "incomeCategories"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeCategory));
        callback(categories);
    }, onError);
}

export function getExpenseCategories(callback: (data: ExpenseCategory[]) => void, onError: (error: Error) => void) {
    const q = query(collection(firestoreDB, "expenseCategories"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
        callback(categories);
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
    return onSnapshot(payeeProfilesCollection, (snapshot) => {
        const profiles = snapshot.docs.map(doc => ({
            ...(doc.data() as PayeeProfile)
        }));
        callback(profiles);
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
    const querySnapshot = await getDocs(collection(firestoreDB, "holidays"));
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Holiday));
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
  const snapshot = await getDocs(suppliersCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
}

export async function getAllCustomers(): Promise<Customer[]> {
  const snapshot = await getDocs(customersCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
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
  const snapshot = await getDocs(supplierPaymentsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
}

export async function getAllCustomerPayments(): Promise<CustomerPayment[]> {
  const snapshot = await getDocs(customerPaymentsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
}

export async function getAllIncomes(): Promise<Income[]> {
  const snapshot = await getDocs(collection(firestoreDB, "incomes"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
}

export async function getAllExpenses(): Promise<Expense[]> {
  const snapshot = await getDocs(collection(firestoreDB, "expenses"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
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
    const q = query(suppliersCollection, orderBy("srNo", "desc"));
    return onSnapshot(q, (snapshot) => {
        const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        callback(suppliers);
    }, onError);
}

export function getCustomersRealtime(callback: (data: Customer[]) => void, onError: (error: Error) => void) {
    const q = query(customersCollection, orderBy("srNo", "desc"));
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        callback(customers);
    }, onError);
}

export function getPaymentsRealtime(callback: (data: Payment[]) => void, onError: (error: Error) => void) {
    const q = query(supplierPaymentsCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        callback(payments);
    }, onError);
}

export function getCustomerPaymentsRealtime(callback: (data: CustomerPayment[]) => void, onError: (error: Error) => void) {
    const q = query(customerPaymentsCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
        callback(payments);
    }, onError);
}

export function getLoansRealtime(callback: (data: Loan[]) => void, onError: (error: Error) => void) {
    const q = query(loansCollection, orderBy("startDate", "desc"));
    return onSnapshot(q, (snapshot) => {
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        callback(loans);
    }, onError);
}

export function getFundTransactionsRealtime(callback: (data: FundTransaction[]) => void, onError: (error: Error) => void) {
    const q = query(fundTransactionsCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FundTransaction));
        callback(transactions);
    }, onError);
}

export function getIncomeRealtime(callback: (data: Income[]) => void, onError: (error: Error) => void) {
    const q = query(incomesCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        callback(transactions);
    }, onError);
}
export function getExpensesRealtime(callback: (data: Expense[]) => void, onError: (error: Error) => void) {
    const q = query(expensesCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        callback(transactions);
    }, onError);
}

export function getIncomeAndExpensesRealtime(callback: (data: Transaction[]) => void, onError: (error: Error) => void) {
    let incomeData: Income[] = [];
    let expenseData: Expense[] = [];
    let incomeDone = false;
    let expenseDone = false;

    const mergeAndCallback = () => {
        if (incomeDone && expenseDone) {
            const all = [...incomeData, ...expenseData].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            callback(all);
        }
    }

    const unsubIncomes = onSnapshot(query(incomesCollection, orderBy("date", "desc")), (snapshot) => {
        incomeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        incomeDone = true;
        mergeAndCallback();
    }, onError);

    const unsubExpenses = onSnapshot(query(expensesCollection, orderBy("date", "desc")), (snapshot) => {
        expenseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        expenseDone = true;
        mergeAndCallback();
    }, onError);
    
    return () => {
        unsubIncomes();
        unsubExpenses();
    }
}

export function getBankAccountsRealtime(callback: (data: BankAccount[]) => void, onError: (error: Error) => void) {
    return onSnapshot(bankAccountsCollection, (snapshot) => {
        const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        callback(accounts);
    }, onError);
}

export function getBanksRealtime(callback: (data: Bank[]) => void, onError: (error: Error) => void) {
    return onSnapshot(banksCollection, (snapshot) => {
        const banks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
        callback(banks);
    }, onError);
}

export function getBankBranchesRealtime(callback: (data: BankBranch[]) => void, onError: (error: Error) => void) {
    return onSnapshot(bankBranchesCollection, (snapshot) => {
        const branches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankBranch));
        callback(branches);
    }, onError);
}

export function getProjectsRealtime(callback: (data: Project[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(projectsCollection, orderBy("startDate", "desc")), (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        callback(projects);
    }, onError);
}

export function getEmployeesRealtime(callback: (data: Employee[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(employeesCollection, orderBy("employeeId")), (snapshot) => {
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        callback(employees);
    }, onError);
}

export function getPayrollRealtime(callback: (data: PayrollEntry[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(payrollCollection, orderBy("payPeriod", "desc")), (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry));
        callback(entries);
    }, onError);
}

export function getInventoryItemsRealtime(callback: (data: InventoryItem[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(inventoryItemsCollection, orderBy("name")), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        callback(items);
    }, onError);
}

export async function recalculateAndUpdateAllSuppliers(): Promise<number> {
    const allSuppliersSnapshot = await getDocs(query(suppliersCollection));
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
  const snapshot = await getDocs(query(expenseTemplatesCollection, orderBy("createdAt", "desc")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseTemplate));
}

export function getExpenseTemplatesRealtime(
  callback: (data: ExpenseTemplate[]) => void, 
  onError: (error: Error) => void
) {
  return onSnapshot(
    query(expenseTemplatesCollection, orderBy("createdAt", "desc")), 
    (snapshot) => {
      const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseTemplate));
      callback(templates);
    }, 
    onError
  );
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
    const snapshot = await getDocs(query(ledgerAccountsCollection, orderBy('name')));
    return snapshot.docs.map((docSnap) => {
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
    const snapshot = await getDocs(query(ledgerCashAccountsCollection, orderBy('name')));
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
}

export async function fetchAllLedgerEntries(): Promise<LedgerEntry[]> {
    const snapshot = await getDocs(ledgerEntriesCollection);
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
    const snapshot = await getDocs(query(mandiReportsCollection, orderBy("purchaseDate", "desc")));
    const reports = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as MandiReport;
        return { ...data, id: data.id || docSnap.id };
    });
    if (db && reports.length) {
        await db.mandiReports.bulkPut(reports);
    }
    return reports;
}
