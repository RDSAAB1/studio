

import { db, addToSyncQueue } from "./database";
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
} from "firebase/firestore";
import { db as firestoreDB } from "./firebase"; // Renamed to avoid conflict
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense } from "@/lib/definitions";
import { toTitleCase, generateReadableId } from "./utils";

const suppliersCollection = collection(firestoreDB, "suppliers");
const customersCollection = collection(firestoreDB, "customers");
const supplierPaymentsCollection = collection(firestoreDB, "payments");
const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
const incomesCollection = collection(firestoreDB, "incomes");
const expensesCollection = collection(firestoreDB, "expenses");
const loansCollection = collection(firestoreDB, "loans");
const fundTransactionsCollection = collection(firestoreDB, "fund_transactions");
const banksCollection = collection(firestoreDB, "banks");
const bankBranchesCollection = collection(firestoreDB, "bankBranches");
const bankAccountsCollection = collection(firestoreDB, "bankAccounts");
const settingsCollection = collection(firestoreDB, "settings");
const optionsCollection = collection(firestoreDB, "options");
const usersCollection = collection(firestoreDB, "users");

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
            const options = data.items.map((name: string, index: number) => ({ id: `${name}-${index}`, name }));
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
    // Note: This is more complex if you need to rename, as you'd need the old value.
    // This example assumes you might want to adjust something else, or handle rename logic in the component.
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

// --- Bank & Branch Functions ---
export function getBanksRealtime(callback: (banks: Bank[]) => void, onError: (error: Error) => void): () => void {
  const q = query(banksCollection, orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
    callback(data);
  }, onError);
}

export function getBankBranchesRealtime(callback: (branches: BankBranch[]) => void, onError: (error: Error) => void): () => void {
  const q = query(bankBranchesCollection, orderBy("bankName", "asc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankBranch));
    callback(data);
  }, onError);
}

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
    const docRef = doc(firestoreDB, 'bankBranches', branchData.ifscCode);
    await setDoc(docRef, branchData);
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
export function getBankAccountsRealtime(callback: (accounts: BankAccount[]) => void, onError: (error: Error) => void): () => void {
    const q = query(bankAccountsCollection, orderBy("bankName", "asc"));
    return onSnapshot(q, (snapshot) => {
        const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        callback(accounts);
    }, onError);
}

export async function addBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const docRef = doc(bankAccountsCollection, accountData.accountNumber);
    const newAccountData = { ...accountData, id: docRef.id };
    await setDoc(docRef, newAccountData);
    return newAccountData as BankAccount;
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    await setDoc(docRef, accountData, { merge: true });
}

export async function deleteBankAccount(id: string): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    await deleteDoc(docRef);
}


// --- Supplier Functions ---

export function getSuppliersRealtime(callback: (suppliers: Customer[]) => void, onError: (error: Error) => void): () => void {
  // First, get data from IndexedDB
  db.mainDataStore.where('id').startsWith('S').toArray().then(callback);

  // Then, listen for real-time updates from Firestore
  const q = query(suppliersCollection, orderBy("srNo", "asc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    db.mainDataStore.bulkPut(data); // Update local DB
    callback(data);
  }, onError);
}

export async function addSupplier(supplierData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(firestoreDB, 'suppliers', supplierData.srNo);
    const newSupplier = { ...supplierData, id: docRef.id };

    await db.mainDataStore.put(newSupplier);
    await addToSyncQueue({ action: 'create', payload: { collection: 'suppliers', data: newSupplier } });

    return newSupplier;
}

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) {
    console.error("updateSupplier requires a valid ID.");
    return false;
  }
  
  await db.mainDataStore.update(id, supplierData);
  await addToSyncQueue({ action: 'update', payload: { collection: 'suppliers', id, changes: supplierData } });

  return true;
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) {
    console.error("deleteSupplier requires a valid ID.");
    return;
  }
  await db.mainDataStore.delete(id);
  await addToSyncQueue({ action: 'delete', payload: { collection: 'suppliers', id } });
}

export async function deleteMultipleSuppliers(srNos: string[]): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const paymentsBatch = writeBatch(firestoreDB);

    for (const srNo of srNos) {
        // Delete the supplier entry
        const supplierDocRef = doc(suppliersCollection, srNo);
        batch.delete(supplierDocRef);

        // Find and delete related payments
        const paymentsQuery = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo }));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        paymentsSnapshot.forEach(paymentDoc => {
            const payment = paymentDoc.data() as Payment;
            // If the payment only contains this srNo, delete the whole payment
            if (payment.paidFor && payment.paidFor.length === 1 && payment.paidFor[0].srNo === srNo) {
                paymentsBatch.delete(paymentDoc.ref);
            } else { // Otherwise, just remove the srNo from the paidFor array
                const updatedPaidFor = payment.paidFor?.filter(pf => pf.srNo !== srNo);
                const amountToDeduct = payment.paidFor?.find(pf => pf.srNo === srNo)?.amount || 0;
                paymentsBatch.update(paymentDoc.ref, { 
                    paidFor: updatedPaidFor,
                    amount: payment.amount - amountToDeduct
                });
            }
        });
    }

    await batch.commit();
    await paymentsBatch.commit();
}


// --- Customer Functions ---

export function getCustomersRealtime(callback: (customers: Customer[]) => void, onError: (error: Error) => void): () => void {
  // First, get data from IndexedDB
  db.mainDataStore.where('id').startsWith('C').toArray().then(callback);
  
  // Then, listen for real-time updates from Firestore
  const q = query(customersCollection, orderBy("srNo", "asc"));
  return onSnapshot(q, (querySnapshot) => {
    const customers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    db.mainDataStore.bulkPut(customers); // Update local DB
    callback(customers);
  }, (error) => {
      console.error("Error fetching customers in real-time:", error);
      onError(error);
  });
}

export async function addCustomer(customerData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(firestoreDB, 'customers', customerData.srNo);
    const newCustomer = { ...customerData, id: docRef.id };
    
    await db.mainDataStore.put(newCustomer);
    await addToSyncQueue({ action: 'create', payload: { collection: 'customers', data: newCustomer } });

    return newCustomer;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        console.error("updateCustomer requires a valid ID.");
        return false;
    }
    await db.mainDataStore.update(id, customerData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'customers', id, changes: customerData } });
    return true;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
      console.error("deleteCustomer requires a valid ID.");
      return;
    }
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'customers', id } });
}

// --- Inventory Item Functions ---
export function getInventoryItems(callback: (items: any[]) => void, onError: (error: Error) => void) {
  // First, get data from IndexedDB
  db.mainDataStore.where('collection').equals('inventoryItems').toArray().then(callback);

  const q = query(collection(firestoreDB, "inventoryItems"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, collection: 'inventoryItems', ...doc.data() }));
    db.mainDataStore.bulkPut(items);
    callback(items);
  }, onError);
}
export async function addInventoryItem(item: any) {
  const newId = doc(collection(firestoreDB, "inventoryItems")).id;
  const newItem = { ...item, id: newId, collection: 'inventoryItems' };
  
  await db.mainDataStore.put(newItem);
  await addToSyncQueue({ action: 'create', payload: { collection: 'inventoryItems', data: newItem } });
  
  return newItem;
}
export async function updateInventoryItem(id: string, item: any) {
  await db.mainDataStore.update(id, item);
  await addToSyncQueue({ action: 'update', payload: { collection: 'inventoryItems', id, changes: item } });
}
export async function deleteInventoryItem(id: string) {
  await db.mainDataStore.delete(id);
  await addToSyncQueue({ action: 'delete', payload: { collection: 'inventoryItems', id } });
}


// --- Payment Functions ---

export function getPaymentsRealtime(callback: (payments: Payment[]) => void, onError: (error: Error) => void): () => void {
  const q = query(supplierPaymentsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    callback(payments);
  }, onError);
}

export function getCustomerPaymentsRealtime(callback: (payments: CustomerPayment[]) => void, onError: (error: Error) => void): () => void {
  const q = query(customerPaymentsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
    callback(payments);
  }, onError);
}

export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) {
    console.error("SR No. is required to delete payments.");
    return;
  }
  
  const paymentsSnapshot = await getDocs(query(supplierPaymentsCollection));
  
  const batch = writeBatch(firestoreDB);
  let paymentsDeleted = 0;

  paymentsSnapshot.forEach(paymentDoc => {
    const payment = paymentDoc.data() as Payment;
    const initialPaidFor = payment.paidFor || [];
    const filteredPaidFor = initialPaidFor.filter(pf => pf.srNo !== srNo);
    
    if (filteredPaidFor.length < initialPaidFor.length) {
      if (filteredPaidFor.length === 0) {
        batch.delete(paymentDoc.ref);
      } else {
        const originalAmountForSr = initialPaidFor.find(pf => pf.srNo === srNo)?.amount || 0;
        const newTotalAmount = payment.amount - originalAmountForSr;
        batch.update(paymentDoc.ref, { paidFor: filteredPaidFor, amount: newTotalAmount });
      }
      paymentsDeleted++;
    }
  });

  if (paymentsDeleted > 0) {
    await batch.commit();
  }
}

export async function deleteAllPayments(): Promise<void> {
    const q = query(supplierPaymentsCollection);
    const snapshot = await getDocs(q);
    const batch = writeBatch(firestoreDB);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}


export async function deleteCustomerPaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) {
    console.error("SR No. is required to delete customer payments.");
    return;
  }
  const q = query(customerPaymentsCollection, where("paidFor", "array-contains", { srNo }));
  const paymentsSnapshot = await getDocs(q);
  
  const batch = writeBatch(firestoreDB);
  paymentsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
  });

  await batch.commit();
}


// --- Fund Transaction Functions ---

export function getFundTransactionsRealtime(callback: (transactions: FundTransaction[]) => void, onError: (error: Error) => void): () => void {
  const q = query(fundTransactionsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate ? doc.data().date.toDate().toISOString() : doc.data().date } as FundTransaction));
    callback(transactions);
  }, onError);
}

export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'transactionId' | 'date'>): Promise<FundTransaction> {
  const dataWithDate = {
    ...transactionData,
    date: new Date().toISOString()
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

export function getAttendanceForDateRealtime(
  date: string, // YYYY-MM-DD format
  callback: (records: AttendanceEntry[]) => void, 
  onError: (error: Error) => void
): () => void {
    const q = query(collection(firestoreDB, "attendance"), where("date", "==", date));
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
        callback(records);
    }, onError);
}

export async function setAttendance(entry: AttendanceEntry): Promise<void> {
    const docRef = doc(firestoreDB, "attendance", entry.id);
    await setDoc(docRef, entry, { merge: true });
}

// --- Project Functions ---
const projectsCollection = collection(firestoreDB, "projects");

export function getProjectsRealtime(callback: (projects: Project[]) => void, onError: (error: Error) => void): () => void {
    const q = query(projectsCollection, orderBy("startDate", "desc"));
    return onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        callback(projects);
    }, onError);
}

export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const docRef = await addDoc(projectsCollection, projectData);
    return { id: docRef.id, ...projectData };
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    const projectRef = doc(firestoreDB, "projects", id);
    await updateDoc(projectRef, projectData);
}

export async function deleteProject(id: string): Promise<void> {
    const projectRef = doc(firestoreDB, "projects", id);
    await deleteDoc(projectRef);
}


// --- Loan Functions ---
export function getLoansRealtime(callback: (loans: Loan[]) => void, onError: (error: Error) => void): () => void {
    const q = query(loansCollection, orderBy("startDate", "desc"));
    return onSnapshot(q, (snapshot) => {
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        callback(loans);
    }, onError);
}

export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    return runTransaction(firestoreDB, async (transaction) => {
        const newLoanRef = doc(collection(firestoreDB, "loans"));
        transaction.set(newLoanRef, { ...loanData, id: newLoanRef.id });

        if ((loanData.loanType === 'Bank' || loanData.loanType === 'Outsider') && loanData.totalAmount > 0) {
            const capitalInflowData: Omit<FundTransaction, 'id' | 'date' > = {
                type: 'CapitalInflow',
                source: loanData.loanType === 'Bank' ? 'BankLoan' : 'ExternalLoan',
                destination: loanData.depositTo,
                amount: loanData.totalAmount,
                description: `Capital inflow from ${loanData.loanName}`
            };
             await addFundTransaction(capitalInflowData);
        }
        
        return { id: newLoanRef.id, ...loanData };
    });
}

export async function updateLoan(id: string, loanData: Partial<Loan>): Promise<void> {
    const loanRef = doc(firestoreDB, "loans", id);
    await updateDoc(loanRef, loanData);
}

export async function deleteLoan(id: string): Promise<void> {
    const loanRef = doc(firestoreDB, "loans", id);
    await deleteDoc(loanRef);
}


// --- Customer Payment Functions ---

export async function addCustomerPayment(paymentData: Omit<CustomerPayment, 'id'>): Promise<CustomerPayment> {
    const docRef = doc(firestoreDB, 'customer_payments', paymentData.paymentId);
    await setDoc(docRef, { ...paymentData, id: docRef.id });
    return { ...paymentData, id: docRef.id };
}

export async function deletePayment(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "payments", id);
    await deleteDoc(docRef);
}

export async function deleteCustomerPayment(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "customer_payments", id);
    await deleteDoc(docRef);
}


// --- Income and Expense specific functions ---
export function getIncomeRealtime(callback: (income: Income[]) => void, onError: (error: Error) => void): () => void {
    const q = query(incomesCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const incomeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        callback(incomeList);
    }, onError);
}

export function getExpensesRealtime(callback: (expenses: Expense[]) => void, onError: (error: Error) => void): () => void {
    const q = query(expensesCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const expenseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        callback(expenseList);
    }, onError);
}

export async function addIncome(incomeData: Omit<Income, 'id'>): Promise<Income> {
    const docRef = await addDoc(incomesCollection, incomeData);
    await updateDoc(docRef, { id: docRef.id });
    return { id: docRef.id, ...incomeData };
}

export async function addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const docRef = await addDoc(expensesCollection, expenseData);
    await updateDoc(docRef, { id: docRef.id });
    return { id: docRef.id, ...expenseData };
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    const docRef = doc(incomesCollection, id);
    await updateDoc(docRef, incomeData);
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    const docRef = doc(expensesCollection, id);
    await updateDoc(docRef, expenseData);
}

export async function deleteIncome(id: string): Promise<void> {
    await deleteDoc(doc(incomesCollection, id));
}

export async function deleteExpense(id: string): Promise<void> {
    await deleteDoc(doc(expensesCollection, id));
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
  const q = query(suppliersCollection);
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(firestoreDB);
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}
