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
  onSnapshot, // Import onSnapshot for real-time listeners
} from "firebase/firestore";
import type { Customer, Payment } from "@/lib/definitions"; // Assuming Customer and Payment types are defined here

const suppliersCollection = collection(db, "suppliers");
const customersCollection = collection(db, "customers"); // Added customers collection reference

// Function to get all suppliers, ordered by srNo
export async function getAllSuppliers(): Promise<Customer[]> {
  try {
    const q = query(suppliersCollection, orderBy("srNo", "asc"));
    const querySnapshot = await getDocs(q);
    const suppliers: Customer[] = [];
    querySnapshot.forEach((doc) => {
      suppliers.push({ id: doc.id, ...doc.data() } as Customer);
    });
    return suppliers;
  } catch (e) {
    console.error("Error getting all suppliers: ", e);
    throw e;
  }
}

// Function to get real-time updates for customers
export function getCustomersRealtime(callback: (customers: Customer[]) => void): () => void {
  const q = query(customersCollection, orderBy("customerId", "asc")); // Assuming customerId or similar field for ordering
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const customers: Customer[] = [];
    querySnapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() } as Customer);
    });
    callback(customers);
  }, (error) => {
    console.error("Error getting real-time customers: ", error);
    // Handle error appropriately
  });

  return unsubscribe; // Return the unsubscribe function
}

// --- Payment Functions ---
const paymentsCollection = collection(db, "payments"); // Added payments collection reference

// Function to add a new payment
export async function addPayment(paymentData: Omit<Payment, 'id'>): Promise<Payment> {
  try {
    const docRef = await addDoc(paymentsCollection, paymentData);
    const newPayment: Payment = { id: docRef.id, ...paymentData };
    console.log("Payment document written with ID: ", docRef.id);
    return newPayment;
  } catch (e) {
    console.error("Error adding payment document: ", e);
    throw e;
  }
}

// Function to update an existing payment by Firestore document ID
export async function updatePayment(id: string, paymentData: Partial<Omit<Payment, 'id'>>): Promise<void> {
  try {
    const paymentRef = doc(db, "payments", id);
    await updateDoc(paymentRef, paymentData);
    console.log("Payment document with ID ", id, " updated.");
  } catch (e) {
    console.error("Error updating payment document: ", e);
    throw e;
  }
}

// Function to delete a payment by Firestore document ID
export async function deletePayment(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "payments", id));
    console.log("Payment document with ID ", id, " deleted.");
  } catch (e) {
    console.error("Error deleting payment document: ", e);
    throw e;
  }
}

// Function to get real-time updates for payments
export function getPaymentsRealtime(callback: (payments: Payment[]) => void): () => void {
  const q = query(paymentsCollection, orderBy("date", "desc")); // Assuming 'date' field for ordering
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const payments: Payment[] = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() } as Payment);
    });
    callback(payments);
  }, (error) => { console.error("Error getting real-time payments: ", error); });
  return unsubscribe; // Return the unsubscribe function
}

// Function to get a single supplier by Firestore document ID
export async function getSupplierById(id: string): Promise<Customer | null> {
  try {
    const docRef = doc(db, "suppliers", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Customer;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (e) {
    console.error("Error getting supplier by ID: ", e);
    throw e;
  }
}


// Function to get a supplier by SR No.
export async function getSupplierBySrNo(srNo: string): Promise<Customer | null> {
  try {
    // Firestore queries are case-sensitive, so we'll query for the exact srNo format
    const q = query(suppliersCollection, where("srNo", "==", srNo));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Assuming srNo is unique, there should be only one document
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Customer;
    } else {
      // console.log("No supplier found with SR No:", srNo);
      return null;
    }
  } catch (e) {
    console.error("Error getting supplier by SR No: ", e);
    throw e;
  }
}


// Function to add a new supplier
export async function addSupplier(supplierData: Omit<Customer, 'id'>): Promise<Customer> {
  try {
    const docRef = await addDoc(suppliersCollection, supplierData);
    const newSupplier: Customer = { id: docRef.id, ...supplierData };
    console.log("Document written with ID: ", docRef.id);
    return newSupplier;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
}

// Function to update an existing supplier by Firestore document ID
export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<void> {
  try {
    const supplierRef = doc(db, "suppliers", id);
    await updateDoc(supplierRef, supplierData);
    console.log("Document with ID ", id, " updated.");
  } catch (e) {
    console.error("Error updating document: ", e);
    throw e;
  }
}

// Function to delete a supplier by Firestore document ID
export async function deleteSupplier(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "suppliers", id));
    console.log("Document with ID ", id, " deleted.");
  } catch (e) {
    console.error("Error deleting document: ", e);
    throw e;
  }
}

// Helper function to get the next sequential SR number
export async function getNextSrNo(): Promise<string> {
  try {
    const q = query(suppliersCollection, orderBy("srNo", "desc"), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // If no documents exist, start from 1
      return "SR000001";
    } else {
      const lastDoc = querySnapshot.docs[0];
      const lastSrNo = lastDoc.data().srNo as string; // Assuming srNo is stored as a string like "SR000001"
      const lastNumber = parseInt(lastSrNo.replace("SR", "")) || 0;
      const nextNumber = lastNumber + 1;
      // Format to "SR" followed by 6 digits, padded with leading zeros
      return `SR${nextNumber.toString().padStart(6, '0')}`;
    }
  } catch (e) {
    console.error("Error getting next SR No: ", e);
    // Fallback or error handling if unable to get the next SR No
    return "SR000001"; // Or throw an error
  }
}

// Function to get real-time updates for suppliers
export function getSuppliersRealtime(callback: (suppliers: Customer[]) => void): () => void {
  const q = query(suppliersCollection, orderBy("srNo", "asc"));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const suppliers: Customer[] = [];
    querySnapshot.forEach((doc) => {
      suppliers.push({ id: doc.id, ...doc.data() } as Customer);
    });
    callback(suppliers);
  }, (error) => {
    console.error("Error getting real-time suppliers: ", error);
    // Depending on your error handling strategy, you might want to
    // call the callback with an empty array or throw an error.
    // For now, we just log the error.
  });

  return unsubscribe; // Return the unsubscribe function
}

// --- Customer Functions ---

// Function to get all customers
export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const querySnapshot = await getDocs(customersCollection);
    const customers: Customer[] = [];
    querySnapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() } as Customer);
    });
    return customers;
  } catch (e) {
    console.error("Error getting all customers: ", e);
    throw e;
  }
}

// Function to get a single customer by Firestore document ID
export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    const docRef = doc(db, "customers", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Customer;
    } else {
      console.log("No such customer document!");
      return null;
    }
  } catch (e) {
    console.error("Error getting customer by ID: ", e);
    throw e;
  }
}

// Function to add a new customer
export async function addCustomer(customerData: Omit<Customer, 'id'>): Promise<Customer> {
  try {
    const docRef = await addDoc(customersCollection, customerData);
    const newCustomer: Customer = { id: docRef.id, ...customerData };
    console.log("Customer document written with ID: ", docRef.id);
    return newCustomer;
  } catch (e) {
    console.error("Error adding customer document: ", e);
    throw e;
  }
}

// Function to update an existing customer by Firestore document ID
export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<void> {
  try {
    const customerRef = doc(db, "customers", id);
    await updateDoc(customerRef, customerData);
    console.log("Customer document with ID ", id, " updated.");
  } catch (e) {
    console.error("Error updating customer document: ", e);
    throw e;
  }
}


// Added limit to getNextSrNo based on a thought
import { limit } from "firebase/firestore";