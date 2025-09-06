
import { db } from "./firebase";
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
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory } from "@/lib/definitions";

const suppliersCollection = collection(db, "suppliers");
const customersCollection = collection(db, "customers");
const paymentsCollection = collection(db, "payments");
const transactionsCollection = collection(db, "transactions");
const fundTransactionsCollection = collection(db, "fund_transactions");
const banksCollection = collection(db, "banks");
const bankBranchesCollection = collection(db, "bankBranches");
const settingsCollection = collection(db, "settings");
const usersCollection = collection(db, "users");


// --- User Refresh Token Functions ---
export async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, { refreshToken: refreshToken }, { merge: true });
}

export async function getRefreshToken(userId: string): Promise<string | null> {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && docSnap.data().refreshToken) {
        return docSnap.data().refreshToken;
    }
    return null;
}


// --- Dynamic Options Functions ---

export function getOptionsRealtime(collectionName: string, callback: (options: OptionItem[]) => void, onError: (error: Error) => void): () => void {
    const q = query(collection(db, collectionName), orderBy("name", "asc"));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as OptionItem));
        callback(data);
    }, onError);
}

export async function addOption(collectionName: string, optionData: { name: string }): Promise<OptionItem> {
    const docRef = await addDoc(collection(db, collectionName), optionData);
    return { id: docRef.id, ...optionData };
}

export async function updateOption(collectionName: string, id: string, optionData: Partial<{ name: string }>): Promise<void> {
    const optionRef = doc(db, collectionName, id);
    await updateDoc(optionRef, optionData);
}

export async function deleteOption(collectionName: string, id: string): Promise<void> {
    const optionRef = doc(db, collectionName, id);
    await deleteDoc(optionRef);
}


// --- Company & RTGS Settings Functions ---

export async function getCompanySettings(userId: string): Promise<{ email: string; appPassword: string } | null> {
    if (!userId) return null;
    const docRef = doc(db, "users", userId);
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
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, settings, { merge: true });
}

export async function deleteCompanySettings(userId: string): Promise<void> {
    const userDocRef = doc(db, "users", userId);
    // We update the document to remove the field, rather than deleting the user doc
    await updateDoc(userDocRef, {
        appPassword: '' 
    });
}


export async function getRtgsSettings(): Promise<RtgsSettings | null> {
    const docRef = doc(settingsCollection, "rtgs");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as RtgsSettings;
        if (!data.type) {
            data.type = "SB";
        }
        return data;
    }
    return null;
}

export async function updateRtgsSettings(settings: Partial<RtgsSettings>): Promise<void> {
    const docRef = doc(settingsCollection, "rtgs");
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
    const docRef = doc(settingsCollection, "receiptDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as Partial<ReceiptSettings>;
        return {
            companyName: data.companyName || "JAGDAMBE RICE MILL",
            address1: data.address1 || "Devkali Road, Banda, Shajahanpur",
            address2: data.address2 || "Near Devkali, Uttar Pradesh",
            contactNo: data.contactNo || "9555130735",
            email: data.email || "JRMDofficial@gmail.com",
            fields: { ...defaultReceiptFields, ...data.fields }
        };
    }
    return {
        companyName: "JAGDAMBE RICE MILL",
        address1: "Devkali Road, Banda, Shajahanpur",
        address2: "Near Devkali, Uttar Pradesh",
        contactNo: "9555130735",
        email: "JRMDofficial@gmail.com",
        fields: defaultReceiptFields,
    };
}

export async function updateReceiptSettings(settings: ReceiptSettings): Promise<void> {
    const docRef = doc(settingsCollection, "receiptDetails");
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
  const docRef = await addDoc(banksCollection, { name: bankName });
  return { id: docRef.id, name: bankName };
}

export async function addBankBranch(branchData: Omit<BankBranch, 'id'>): Promise<BankBranch> {
    const docRef = await addDoc(bankBranchesCollection, branchData);
    return { id: docRef.id, ...branchData };
}

// --- Supplier Functions ---

export function getSuppliersRealtime(callback: (suppliers: Customer[]) => void, onError: (error: Error) => void): () => void {
  const q = query(suppliersCollection, orderBy("srNo", "asc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    callback(data);
  }, onError);
}

export async function addSupplier(supplierData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(db, 'suppliers', supplierData.srNo);
    const newSupplier = { ...supplierData, id: docRef.id };
    await setDoc(docRef, newSupplier);
    return newSupplier;
}

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) {
    console.error("updateSupplier requires a valid ID.");
    return false;
  }
  const supplierRef = doc(db, "suppliers", id);
  const supplierDoc = await getDoc(supplierRef);

  if (!supplierDoc.exists()) {
    console.error(`FirebaseError: No document to update: suppliers/${id}`);
    return false;
  }
  await updateDoc(supplierRef, supplierData);
  return true;
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) {
    console.error("deleteSupplier requires a valid ID.");
    return;
  }
  await deleteDoc(doc(db, "suppliers", id));
}

// --- Customer Functions ---

export function getCustomersRealtime(callback: (customers: Customer[]) => void, onError: (error: Error) => void): () => void {
  const q = query(customersCollection, orderBy("srNo", "asc"));
  return onSnapshot(q, (querySnapshot) => {
    const customers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    callback(customers);
  }, (error) => {
      console.error("Error fetching customers in real-time:", error);
      onError(error);
  });
}

export async function addCustomer(customerData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(db, 'customers', customerData.srNo);
    const newCustomer = { ...customerData, id: docRef.id };
    await setDoc(docRef, newCustomer);
    return newCustomer;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        console.error("updateCustomer requires a valid ID.");
        return false;
    }
    const customerRef = doc(db, "customers", id);
    const customerDoc = await getDoc(customerRef);
    if (!customerDoc.exists()) {
        console.error(`FirebaseError: No document to update: customers/${id}`);
        return false;
    }
    await updateDoc(customerRef, customerData as any);
    return true;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
      console.error("deleteCustomer requires a valid ID.");
      return;
    }
    await deleteDoc(doc(db, "customers", id));
}

// --- Inventory Item Functions ---
// (These are assumed from inventory page, keeping them for completeness)
export function getInventoryItems(callback: (items: any[]) => void, onError: (error: Error) => void) {
  const q = query(collection(db, "inventoryItems"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  }, onError);
}
export async function addInventoryItem(item: any) {
  return await addDoc(collection(db, "inventoryItems"), item);
}
export async function updateInventoryItem(id: string, item: any) {
  return await updateDoc(doc(db, "inventoryItems", id), item);
}
export async function deleteInventoryItem(id: string) {
  return await deleteDoc(doc(db, "inventoryItems", id));
}


// --- Payment Functions ---

export function getPaymentsRealtime(callback: (payments: Payment[]) => void, onError: (error: Error) => void): () => void {
  const q = query(paymentsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    callback(payments);
  }, onError);
}

export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) {
    console.error("SR No. is required to delete payments.");
    return;
  }
  
  const paymentsSnapshot = await getDocs(query(paymentsCollection));
  
  const batch = writeBatch(db);
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

// --- General Transaction Functions ---

export function getTransactionsRealtime(callback: (transactions: Transaction[]) => void, onError: (error: Error) => void): () => void {
  const q = query(transactionsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    callback(transactions);
  }, onError);
}

// --- Fund Transaction Functions ---

export function getFundTransactionsRealtime(callback: (transactions: FundTransaction[]) => void, onError: (error: Error) => void): () => void {
  const q = query(fundTransactionsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FundTransaction));
    callback(transactions);
  }, onError);
}

export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'date'>): Promise<FundTransaction> {
  const finalData = { ...transactionData, date: new Date().toISOString() };
  const docRef = await addDoc(fundTransactionsCollection, finalData);
  return { id: docRef.id, ...finalData };
}

// --- Income/Expense Category Functions ---

export function getIncomeCategories(callback: (data: IncomeCategory[]) => void, onError: (error: Error) => void) {
    const q = query(collection(db, "incomeCategories"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeCategory));
        callback(categories);
    }, onError);
}

export function getExpenseCategories(callback: (data: ExpenseCategory[]) => void, onError: (error: Error) => void) {
    const q = query(collection(db, "expenseCategories"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
        callback(categories);
    }, onError);
}

export async function addCategory(collectionName: "incomeCategories" | "expenseCategories", category: { name: string; nature?: string }) {
    await addDoc(collection(db, collectionName), { ...category, subCategories: [] });
}

export async function updateCategoryName(collectionName: "incomeCategories" | "expenseCategories", id: string, name: string) {
    await updateDoc(doc(db, collectionName, id), { name });
}

export async function deleteCategory(collectionName: "incomeCategories" | "expenseCategories", id: string) {
    await deleteDoc(doc(db, collectionName, id));
}

export async function addSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    await updateDoc(doc(db, collectionName, categoryId), {
        subCategories: arrayUnion(subCategoryName)
    });
}

export async function deleteSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    await updateDoc(doc(db, collectionName, categoryId), {
        subCategories: arrayRemove(subCategoryName)
    });
}
