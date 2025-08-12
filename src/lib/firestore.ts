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
} from "firebase/firestore";
import type { Customer, FundTransaction, Payment, Transaction } from "@/lib/definitions";

const suppliersCollection = collection(db, "suppliers");
const customersCollection = collection(db, "customers");
const paymentsCollection = collection(db, "payments");
const transactionsCollection = collection(db, "transactions");
const fundTransactionsCollection = collection(db, "fund_transactions");

// --- Supplier Functions ---

export function getSuppliersRealtime(callback: (suppliers: Customer[]) => void, onError: (error: Error) => void): () => void {
  const q = query(suppliersCollection, orderBy("srNo", "asc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    callback(data);
  }, onError);
}

export async function addSupplier(supplierData: Omit<Customer, 'id'>): Promise<Customer> {
  const docRef = await addDoc(suppliersCollection, supplierData);
  return { id: docRef.id, ...supplierData };
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
  await deleteDoc(doc(db, "suppliers", id));
}

// --- Customer Functions ---

export function getCustomersRealtime(callback: (customers: Customer[]) => void, onError: (error: Error) => void): () => void {
  const q = query(customersCollection, orderBy("customerId", "asc"));
  return onSnapshot(q, (querySnapshot) => {
    const customers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    callback(customers);
  }, (error) => {
      console.error("Error fetching customers in real-time:", error);
      onError(error);
  });
}

export async function addCustomer(customerData: Omit<Customer, 'id'>): Promise<string> {
    const docRef = await addDoc(customersCollection, customerData);
    return docRef.id;
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

export async function addPayment(paymentData: Omit<Payment, 'id'> & { id?: string }): Promise<Payment> {
  const docRef = await addDoc(paymentsCollection, paymentData);
  return { id: docRef.id, ...paymentData } as Payment;
}

export async function updatePayment(id: string, paymentData: Partial<Payment>): Promise<boolean> {
    if (!id) {
        console.error("updatePayment requires a valid ID.");
        return false;
    }
    try {
        const paymentRef = doc(db, "payments", id);
        await setDoc(paymentRef, paymentData, { merge: true });
        return true;
    } catch (error) {
        console.error("Error in updatePayment:", error);
        return false; 
    }
}


export async function deletePayment(id: string): Promise<void> {
    if (!id) {
        console.error("deletePayment requires a valid ID.");
        return;
    }
    const paymentRef = doc(db, "payments", id);
    await deleteDoc(paymentRef);
}

export function getPaymentsRealtime(callback: (payments: Payment[]) => void, onError: (error: Error) => void): () => void {
  const q = query(paymentsCollection, orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    callback(payments);
  }, onError);
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
