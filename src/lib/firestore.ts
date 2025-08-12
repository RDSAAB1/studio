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

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<void> {
  const supplierRef = doc(db, "suppliers", id);
  await updateDoc(supplierRef, supplierData);
}

export async function deleteSupplier(id: string): Promise<void> {
  await deleteDoc(doc(db, "suppliers", id));
}

// --- Customer Functions ---

export function getCustomersRealtime(callback: (customers: Customer[]) => void, onError: (error: Error) => void): () => void {
  const q = query(customersCollection, orderBy("customerId", "asc"));
  onSnapshot(q, (querySnapshot) => {
    const customers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    callback(customers);
  }, onError);
}


export async function getCustomers() {
    const querySnapshot = await getDocs(customersCollection);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
}

export async function addCustomer(customerData: Omit<Customer, 'id'>): Promise<string> {
    const docRef = await addDoc(customersCollection, customerData);
    return docRef.id;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<void> {
    const customerRef = doc(db, "customers", id);
    await updateDoc(customerRef, customerData);
}

export async function deleteCustomer(id: string): Promise<void> {
    await deleteDoc(doc(db, "customers", id));
}

export const updateCustomerFirestore = async (id: string, data: Partial<Customer>): Promise<void> => {
    const customerRef = doc(db, "customers", id);
    await updateDoc(customerRef, data);
};

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

export async function addPayment(paymentData: Omit<Payment, 'paymentId'> & { paymentId?: string }): Promise<Payment> {
  const docRef = await addDoc(paymentsCollection, paymentData);
  return { id: docRef.id, ...paymentData } as Payment;
}

export async function updatePayment(paymentData: Payment): Promise<void> {
    const paymentRef = doc(db, "payments", paymentData.paymentId);
    await updateDoc(paymentRef, paymentData);
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, "payments", id));
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
