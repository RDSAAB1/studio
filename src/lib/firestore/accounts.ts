import { doc, getDoc, getDocs, query, where, writeBatch, limit } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { 
  accountsCollection, 
  expensesCollection, 
  incomesCollection,
  createLocalSubscription,
  stripUndefined,
  isSqliteMode
} from "./core";
import { Account } from "@/lib/definitions";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { getTenantCollectionPath } from "../tenancy";

export function getAccountsRealtime(callback: (data: Account[]) => void, onError: (error: Error) => void) {
  return createLocalSubscription<Account>("accounts", callback);
}

export async function addAccount(accountData: Omit<Account, 'id'>): Promise<Account> {
  const timestamp = new Date().toISOString();
  const docRef = doc(accountsCollection);
  const data = withCreateMetadata({ ...accountData, id: docRef.id, createdAt: timestamp, updatedAt: timestamp } as Record<string, unknown>);
  
  if (!isSqliteMode()) {
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('accounts', { batch });
    await batch.commit();
  }
  
  logActivity({ 
    type: "create", 
    collection: "accounts", 
    docId: docRef.id, 
    docPath: getTenantCollectionPath("accounts").join("/"), 
    summary: `Created account ${accountData.name}`, 
    afterData: data 
  }).catch(() => {});

  const saved = { id: docRef.id, ...data } as Account;
  if (db) await db.accounts.put(saved);
  return saved;
}

export async function updateAccount(accountData: Partial<Account> & { id: string }, oldName?: string): Promise<void> {
  const { id, ...dataToUpdate } = accountData;
  if (!id) throw new Error("Account ID is required for update.");

  const docRef = doc(accountsCollection, id);
  const data = withEditMetadata({ ...dataToUpdate, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  
  if (!isSqliteMode()) {
    const batch = writeBatch(firestoreDB);
    batch.set(docRef, data, { merge: true });
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('accounts', { batch });
    await batch.commit();
  }

  logActivity({ 
    type: "edit", 
    collection: "accounts", 
    docId: id, 
    docPath: getTenantCollectionPath("accounts").join("/"), 
    summary: `Updated account ${accountData.name || id}`, 
    afterData: data 
  }).catch(() => {});

  if (db) {
    const existing = await db.accounts.get(id);
    if (existing) {
      await db.accounts.put({ ...existing, ...dataToUpdate, updatedAt: (data as any).updatedAt });
    } else if (accountData.name) {
      // Fallback for older data keyed by name
      const byName = await db.accounts.get(accountData.name);
      if (byName) await db.accounts.put({ ...byName, ...dataToUpdate, updatedAt: (data as any).updatedAt });
    }
  }
}

/**
 * Cascades account changes (Name, Category, Sub-category, Nature) to all related transactions.
 */
export async function updateAccountTransactionsCascade(
  oldName: string, 
  updatedData: { name?: string; category?: string; subCategory?: string; nature?: string }
): Promise<void> {
  const { name: newName, category, subCategory, nature } = updatedData;
  const timestamp = new Date().toISOString();

  // 1. Update Firestore Incomes
  const qIncome = query(incomesCollection, where('payee', '==', oldName));
  if (!isSqliteMode()) {
    const snapIncome = await getDocs(qIncome);
    if (!snapIncome.empty) {
      const batch = writeBatch(firestoreDB);
      snapIncome.forEach(docSnap => {
        const updateObj: any = { updatedAt: timestamp };
        if (newName) updateObj.payee = newName;
        if (category !== undefined) updateObj.category = category;
        if (subCategory !== undefined) updateObj.subCategory = subCategory;
        batch.update(docSnap.ref, updateObj);
      });
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('incomes', { batch });
      await batch.commit();
    }
  }

  // 2. Update Firestore Expenses
  const qExpense = query(expensesCollection, where('payee', '==', oldName));
  if (!isSqliteMode()) {
    const snapExpense = await getDocs(qExpense);
    if (!snapExpense.empty) {
      const batch = writeBatch(firestoreDB);
      snapExpense.forEach(docSnap => {
        const updateObj: any = { updatedAt: timestamp };
        if (newName) updateObj.payee = newName;
        if (category !== undefined) updateObj.category = category;
        if (subCategory !== undefined) updateObj.subCategory = subCategory;
        if (nature !== undefined) updateObj.expenseNature = nature;
        batch.update(docSnap.ref, updateObj);
      });
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('expenses', { batch });
      await batch.commit();
    }
  }

  // 3. Update SQLite Transactions (combined for income/expense)
  if (db) {
    const local = await db.transactions.where('payee').equals(oldName).toArray();
    for (const item of local) {
      const updateObj: any = { updatedAt: timestamp };
      if (newName) updateObj.payee = newName;
      if (category !== undefined) updateObj.category = category;
      if (subCategory !== undefined) updateObj.subCategory = subCategory;
      if (nature !== undefined) {
          if (item.transactionType === 'Expense') updateObj.expenseNature = nature;
          // Incomes don't strictly use expenseNature, but we keep it sync if needed
      }
      await db.transactions.update(item.id, updateObj);
    }
    
    // Also update separate tables if they exist
    const localIncomes = await db.incomes.where('payee').equals(oldName).toArray();
    for (const item of localIncomes) {
      const updateObj: any = { updatedAt: timestamp };
      if (newName) updateObj.payee = newName;
      if (category !== undefined) updateObj.category = category;
      if (subCategory !== undefined) updateObj.subCategory = subCategory;
      await db.incomes.update(item.id, updateObj);
    }

    const localExpenses = await db.expenses.where('payee').equals(oldName).toArray();
    for (const item of localExpenses) {
      const updateObj: any = { updatedAt: timestamp };
      if (newName) updateObj.payee = newName;
      if (category !== undefined) updateObj.category = category;
      if (subCategory !== undefined) updateObj.subCategory = subCategory;
      if (nature !== undefined) updateObj.expenseNature = nature;
      await db.expenses.update(item.id, updateObj);
    }
  }
}

export async function deleteAccount(name: string): Promise<void> {
  const docRef = doc(accountsCollection, name);
  const snap = await getDoc(docRef);
  
  if (snap.exists()) {
    await moveToRecycleBin({ 
      collection: "accounts", 
      docId: name, 
      docPath: getTenantCollectionPath("accounts").join("/"), 
      data: { id: snap.id, ...snap.data() } as Record<string, unknown>, 
      summary: `Deleted account ${name}` 
    });
  }

  if (!isSqliteMode()) {
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('accounts', { batch });
    await batch.commit();
  }

  if (db) await db.accounts.delete(name);
}

// Payee Update Logic (Cascades)

export async function updateExpensePayee(oldName: string, newName: string): Promise<void> {
  const timestamp = new Date().toISOString();
  if (!isSqliteMode()) {
    const q = query(expensesCollection, where('payee', '==', oldName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(firestoreDB);
      snapshot.forEach(docSnap => {
        batch.update(docSnap.ref, { payee: newName, updatedAt: timestamp });
      });
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('expenses', { batch });
      await batch.commit();
    }
  }

  if (db) {
    const local = await db.transactions.where('payee').equals(oldName).toArray();
    for (const item of local) {
      await db.transactions.update(item.id, { payee: newName, updatedAt: timestamp });
    }
  }
}

export async function updateIncomePayee(oldName: string, newName: string): Promise<void> {
  const timestamp = new Date().toISOString();
  if (!isSqliteMode()) {
    const q = query(incomesCollection, where('payee', '==', oldName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(firestoreDB);
      snapshot.forEach(docSnap => {
        batch.update(docSnap.ref, { payee: newName, updatedAt: timestamp });
      });
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('incomes', { batch });
      await batch.commit();
    }
  }

  if (db) {
    const local = await db.transactions.where('payee').equals(oldName).toArray();
    for (const item of local) {
      await db.transactions.update(item.id, { payee: newName, updatedAt: timestamp });
    }
  }
}

export async function deleteExpensesForPayee(payee: string): Promise<void> {
  if (!isSqliteMode()) {
    const q = query(expensesCollection, where('payee', '==', payee));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(firestoreDB);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('expenses', { batch });
      await batch.commit();
    }
  }

  if (db) await db.transactions.where('payee').equals(payee).delete();
}

export async function deleteIncomesForPayee(payee: string): Promise<void> {
  if (!isSqliteMode()) {
    const q = query(incomesCollection, where('payee', '==', payee));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(firestoreDB);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('incomes', { batch });
      await batch.commit();
    }
  }

  if (db) await db.transactions.where('payee').equals(payee).delete();
}
