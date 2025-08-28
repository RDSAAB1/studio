

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
} from "firebase/firestore";
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings } from "@/lib/definitions";

const suppliersCollection = collection(db, "suppliers");
const customersCollection = collection(db, "customers");
const paymentsCollection = collection(db, "payments");
const transactionsCollection = collection(db, "transactions");
const fundTransactionsCollection = collection(db, "fund_transactions");
const banksCollection = collection(db, "banks");
const bankBranchesCollection = collection(db, "bankBranches");
const settingsCollection = collection(db, "settings");


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


// --- RTGS Settings Functions ---
export async function getRtgsSettings(): Promise<RtgsSettings | null> {
    const docRef = doc(settingsCollection, "rtgs");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as RtgsSettings;
    }
    return null;
}

export async function updateRtgsSettings(settings: RtgsSettings): Promise<void> {
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
        // Merge with defaults to ensure `fields` object exists
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
  
  // This function now needs to handle the nested `paidFor` array.
  // It finds all payment documents that contain a reference to the given srNo.
  const q = query(paymentsCollection, where("paidFor", "array-contains-any", [{srNo: srNo}]));

  // A more robust query would be `where('paidFor.srNo', '==', srNo)`, but Firestore doesn't support querying nested array fields directly like this.
  // The workaround is to fetch potentially matching documents and filter client-side.
  // A better data model might be a subcollection of payments on each supplier entry.
  // Given the current model, this is the approach:
  const paymentsSnapshot = await getDocs(query(paymentsCollection));
  
  const batch = writeBatch(db);
  let paymentsDeleted = 0;

  paymentsSnapshot.forEach(paymentDoc => {
    const payment = paymentDoc.data() as Payment;
    const initialPaidFor = payment.paidFor || [];
    const filteredPaidFor = initialPaidFor.filter(pf => pf.srNo !== srNo);
    
    if (filteredPaidFor.length < initialPaidFor.length) {
      if (filteredPaidFor.length === 0) {
        // If no other entries are being paid by this payment, delete the whole payment.
        batch.delete(paymentDoc.ref);
      } else {
        // Otherwise, just remove the specific entry from the `paidFor` array.
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
